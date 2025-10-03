/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */

import React, { useState, useEffect, useRef, useMemo, useCallback, useReducer } from 'react';
import axios from 'axios';

import HorticultureMapComponent from '../components/horticulture/HorticultureMapComponent';
import HorticultureDrawingManager from '../components/horticulture/HorticultureDrawingManager';
import CurvedPipeEditor from '../components/horticulture/CurvedPipeEditor';
import EnhancedHorticultureSearchControl from '../components/horticulture/HorticultureSearchControl';
import PlantRotationControl from '../components/horticulture/PlantRotationControl';
import LateralPipeInfoPanel from '../components/horticulture/LateralPipeInfoPanel';
import LateralPipeModeSelector from '../components/horticulture/LateralPipeModeSelector';
import ContinuousLateralPipePanel from '../components/horticulture/ContinuousLateralPipePanel';
import DeletePipePanel from '../components/horticulture/DeletePipePanel';
import AutoLateralPipeModal from '../components/horticulture/AutoLateralPipeModal';
import { loadSprinklerConfig } from '../utils/sprinklerUtils';
// import { calculateZoneStats } from '../utils/irrigationZoneUtils';
import {
    snapMainPipeEndToSubMainPipe,
    findClosestPointOnLineSegment,
    calculateWaterFlowRate,
    calculatePipeLength,
    calculateDistanceBetweenPoints,
} from '../utils/horticultureUtils';
import {
    createAutomaticZones,
    validateZones,
    AutoZoneConfig,
    AutoZoneResult,
    // AutoZoneDebugInfo,
    clipPolygonToMainArea,
} from '../utils/autoZoneUtils';
import { generatePerpendicularDimensionLines } from '../utils/horticultureUtils';
import {
    // findPlantsInLateralPath,
    calculateTotalWaterNeed,
    generateLateralPipeId,
    generateEmitterLines,
    generateEmitterLinesForBetweenPlantsMode,
    generateEmitterLinesForMultiSegment,
    isPointOnSubMainPipe,
    findClosestConnectionPoint,
    computeAlignedLateral,
    computeAlignedLateralFromMainPipe,
    findLateralSubMainIntersection,
    calculateLateralPipeSegmentStats,
    findMainToSubMainConnections,
    findEndToEndConnections,
    findSubMainToLateralStartConnections,
    // 🚀 เพิ่มฟังก์ชันใหม่สำหรับ multi-segment
    // accumulatePlantsFromAllSegments,
    computeMultiSegmentAlignment,
    findSubMainToMainIntersections,
    findLateralToSubMainIntersections,
    findMidConnections,
} from '../utils/lateralPipeUtils';
import {
    generateAutoLateralPipes,
    validateAutoLateralPipes,
    AutoLateralPipeResult,
} from '../utils/autoLateralPipeUtils';

import { router } from '@inertiajs/react';
import { useLanguage } from '../contexts/LanguageContext';
import Navbar from '../components/Navbar';
import SprinklerConfigModal from '../components/horticulture/SprinklerConfigModal';
import HeadLossCalculationModal, {
    HeadLossResult,
} from '../components/horticulture/HeadLossCalculationModal';
import {
    SprinklerFormData,
    calculateTotalFlowRate,
    formatFlowRate,
    formatFlowRatePerHour,
    formatPressure,
    formatRadius,
} from '../utils/sprinklerUtils';

import {
    FaTree,
    FaUndo,
    FaCheck,
    // FaMousePointer,
    FaRedo,
    // FaEdit,
    FaTrash,
    FaPlus,
    FaShower,
    FaSave,
    FaTimes,
    FaCog,
    FaLink,
    FaBars,
    FaCompress,
    FaExpand,
    FaCopy,
    FaPaste,
    // FaEye,
    // FaEyeSlash,
    FaMagic,
    FaCut,
    FaArrowsAlt,
    // FaKeyboard,
    FaRuler,
    FaBezierCurve,
} from 'react-icons/fa';

// Function to clean up localStorage when quota is exceeded
const cleanupLocalStorage = () => {
    try {
        console.log('🧹 Starting localStorage cleanup...');

        // Get all keys
        const keys = Object.keys(localStorage);
        console.log(`📊 Found ${keys.length} localStorage items`);

        // Remove old project data (keep only the most recent)
        const projectKeys = keys.filter(
            (key) =>
                key.startsWith('horticultureIrrigationData') ||
                key.startsWith('savedProductProject_') ||
                key.startsWith('projectMapImage')
        );

        console.log(`🗂️ Found ${projectKeys.length} project-related keys`);

        if (projectKeys.length > 2) {
            // Keep only the 2 most recent items
            const keysToRemove = projectKeys.slice(0, projectKeys.length - 2);
            console.log(`🗑️ Removing ${keysToRemove.length} old project keys`);
            keysToRemove.forEach((key) => {
                localStorage.removeItem(key);
            });
        }

        // Remove old mock fields
        const mockKeys = keys.filter((key) => key.startsWith('mock-'));
        if (mockKeys.length > 0) {
            console.log(`🗑️ Removing ${mockKeys.length} mock keys`);
            mockKeys.forEach((key) => {
                localStorage.removeItem(key);
            });
        }

        // Remove other large data that might be taking up space
        const otherKeys = keys.filter(
            (key) =>
                key.startsWith('fieldCropData') ||
                key.startsWith('fieldMapData') ||
                key.startsWith('autoZoneConfig') ||
                key.startsWith('plantRotation')
        );

        if (otherKeys.length > 0) {
            console.log(`🗑️ Removing ${otherKeys.length} other large data keys`);
            otherKeys.forEach((key) => {
                localStorage.removeItem(key);
            });
        }

        console.log('✅ localStorage cleanup completed');
        return true;
    } catch (error) {
        console.error('❌ localStorage cleanup failed:', error);
        return false;
    }
};

// Make cleanup function available globally for console access
if (typeof window !== 'undefined') {
    (window as unknown as { clearHorticultureStorage: () => void }).clearHorticultureStorage =
        () => {
            console.log('🧹 Manual localStorage cleanup initiated...');
            if (cleanupLocalStorage()) {
                console.log('✅ Manual cleanup successful!');
                alert('localStorage cleanup completed successfully!');
            } else {
                console.log('❌ Manual cleanup failed!');
                alert('localStorage cleanup failed!');
            }
        };

    (window as unknown as { clearAllStorage: () => void }).clearAllStorage = () => {
        console.log('🧹 Clearing ALL localStorage...');
        localStorage.clear();
        console.log('✅ All localStorage cleared!');
        alert('All localStorage cleared!');
    };

    // Add a function to check localStorage usage
    (window as unknown as { checkStorageUsage: () => void }).checkStorageUsage = () => {
        let totalSize = 0;
        const items: { key: string; size: number }[] = [];

        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                const value = localStorage.getItem(key) || '';
                const size = new Blob([value]).size;
                totalSize += size;
                items.push({ key, size });
            }
        }

        console.log(`📊 Total localStorage usage: ${(totalSize / 1024).toFixed(2)}KB`);
        console.log('📋 Items by size:');
        items
            .sort((a, b) => b.size - a.size)
            .forEach((item) => {
                console.log(`  ${item.key}: ${(item.size / 1024).toFixed(2)}KB`);
            });

        alert(`localStorage usage: ${(totalSize / 1024).toFixed(2)}KB\nCheck console for details.`);
    };
}

// Function to safely save to localStorage with cleanup
// Function to compress data by reducing precision and removing unnecessary fields
const compressProjectData = (data: any): any => {
    try {
        const compressed = {
            ...data,
            // Reduce coordinate precision to 6 decimal places
            mainArea: Array.isArray(data.mainArea)
                ? data.mainArea.map((coord: any) => ({
                      lat: Math.round(coord.lat * 1000000) / 1000000,
                      lng: Math.round(coord.lng * 1000000) / 1000000,
                  }))
                : data.mainArea,

            // Compress plants data
            plants: Array.isArray(data.plants)
                ? data.plants.map((plant: any) => ({
                      id: plant.id,
                      position: {
                          lat: Math.round(plant.position.lat * 1000000) / 1000000,
                          lng: Math.round(plant.position.lng * 1000000) / 1000000,
                      },
                      plantData: plant.plantData,
                  }))
                : data.plants,

            // Compress zones data
            zones: Array.isArray(data.zones)
                ? data.zones.map((zone: any) => ({
                      ...zone,
                      coordinates: Array.isArray(zone.coordinates)
                          ? zone.coordinates.map((coord: any) => ({
                                lat: Math.round(coord.lat * 1000000) / 1000000,
                                lng: Math.round(coord.lng * 1000000) / 1000000,
                            }))
                          : zone.coordinates,
                  }))
                : data.zones,

            // Compress irrigation zones
            irrigationZones: Array.isArray(data.irrigationZones)
                ? data.irrigationZones.map((zone: any) => ({
                      ...zone,
                      coordinates: Array.isArray(zone.coordinates)
                          ? zone.coordinates.map((coord: any) => ({
                                lat: Math.round(coord.lat * 1000000) / 1000000,
                                lng: Math.round(coord.lng * 1000000) / 1000000,
                            }))
                          : zone.coordinates,
                  }))
                : data.irrigationZones,

            // Compress pipes data
            mainPipes: Array.isArray(data.mainPipes)
                ? data.mainPipes.map((pipe: any) => ({
                      ...pipe,
                      coordinates: Array.isArray(pipe.coordinates)
                          ? pipe.coordinates.map((coord: any) => ({
                                lat: Math.round(coord.lat * 1000000) / 1000000,
                                lng: Math.round(coord.lng * 1000000) / 1000000,
                            }))
                          : pipe.coordinates,
                  }))
                : data.mainPipes,

            subMainPipes: Array.isArray(data.subMainPipes)
                ? data.subMainPipes.map((pipe: any) => ({
                      ...pipe,
                      coordinates: Array.isArray(pipe.coordinates)
                          ? pipe.coordinates.map((coord: any) => ({
                                lat: Math.round(coord.lat * 1000000) / 1000000,
                                lng: Math.round(coord.lng * 1000000) / 1000000,
                            }))
                          : pipe.coordinates,
                  }))
                : data.subMainPipes,

            // Remove debug and temporary fields
            debugInfo: undefined,
            tempData: undefined,
            _temp: undefined,
        };

        return compressed;
    } catch (error) {
        console.warn('Failed to compress data, using original:', error);
        return data;
    }
};

const safeLocalStorageSet = (key: string, value: string): boolean => {
    try {
        // Check data size first
        const dataSizeKB = new Blob([value]).size / 1024;
        console.log(`📊 Data size: ${dataSizeKB.toFixed(2)}KB for key: ${key}`);

        if (dataSizeKB > 2000) {
            // If larger than 2MB, try compression
            console.warn(
                `⚠️ Large data detected (${dataSizeKB.toFixed(2)}KB), attempting compression...`
            );
            try {
                const parsedData = JSON.parse(value);
                const compressedData = compressProjectData(parsedData);
                const compressedValue = JSON.stringify(compressedData);
                const compressedSizeKB = new Blob([compressedValue]).size / 1024;
                console.log(
                    `📦 Compressed size: ${compressedSizeKB.toFixed(2)}KB (${((1 - compressedSizeKB / dataSizeKB) * 100).toFixed(1)}% reduction)`
                );

                localStorage.setItem(key, compressedValue);
                return true;
            } catch (compressError) {
                console.warn('Compression failed, trying original data:', compressError);
            }
        }

        localStorage.setItem(key, value);
        return true;
    } catch (error) {
        if (error instanceof Error && error.name === 'QuotaExceededError') {
            console.warn('⚠️ localStorage quota exceeded, attempting cleanup...');
            if (cleanupLocalStorage()) {
                try {
                    // Try compression after cleanup
                    const parsedData = JSON.parse(value);
                    const compressedData = compressProjectData(parsedData);
                    const compressedValue = JSON.stringify(compressedData);

                    localStorage.setItem(key, compressedValue);
                    console.log('✅ Successfully saved compressed data after cleanup');
                    return true;
                } catch (retryError) {
                    console.error('❌ Still failed after cleanup and compression:', retryError);
                    return false;
                }
            }
        }
        console.error('❌ localStorage save failed:', error);
        return false;
    }
};

const isPointInPolygon = (
    point: { lat: number; lng: number },
    polygon: { lat: number; lng: number }[]
): boolean => {
    if (!point || !polygon || polygon.length < 3) return false;

    try {
        let inside = false;
        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].lat;
            const yi = polygon[i].lng;
            const xj = polygon[j].lat;
            const yj = polygon[j].lng;

            const intersect =
                yi > point.lng !== yj > point.lng &&
                point.lat < ((xj - xi) * (point.lng - yi)) / (yj - yi) + xi;
            if (intersect) inside = !inside;
        }

        return inside;
    } catch (error) {
        console.error('Error checking point in polygon:', error);
        return false;
    }
};

const getDragOrientation = (
    start: { lat: number; lng: number },
    end: { lat: number; lng: number }
): 'rows' | 'columns' => {
    const dLat = Math.abs(end.lat - start.lat);
    const dLng = Math.abs(end.lng - start.lng);

    const threshold = 0.1;

    if (dLat > dLng * (1 + threshold)) {
        return 'columns';
    } else if (dLng > dLat * (1 + threshold)) {
        return 'rows';
    } else {
        return dLat > dLng ? 'columns' : 'rows';
    }
};

const generateUniqueId = (prefix: string = 'id'): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${prefix}_${timestamp}_${random}`;
};

// ฟังก์ชันสำหรับเสริมข้อมูลให้ ManualIrrigationZone ให้เหมือน automatic zones
const enhanceManualZone = (zone: ManualIrrigationZone): ManualIrrigationZone => {
    const area = calculateAreaFromCoordinates(zone.coordinates);
    const areaInRai = area / 1600; // แปลงจากตารางเมตรเป็นไร่

    // คำนวณอัตราการไหลน้ำ
    const sprinklerConfig = loadSprinklerConfig();
    const waterFlowRate = sprinklerConfig
        ? calculateWaterFlowRate(zone.plants.length, sprinklerConfig)
        : 0;

    // คำนวณข้อมูลท่อ - สำหรับ manual zone จะประมาณจากจำนวนต้นไม้และพื้นที่
    const estimatedPipeLength = Math.sqrt(area) * 3; // ประมาณการความยาวท่อจากขนาดพื้นที่
    const bestPipeInfo = {
        longest: estimatedPipeLength * 0.6, // ท่อที่ยาวที่สุดประมาณ 60% ของความยาวรวม
        totalLength: estimatedPipeLength,
        count: Math.max(1, Math.ceil(zone.plants.length / 20)), // ประมาณ 20 ต้นต่อท่อ
    };

    return {
        ...zone,
        area,
        areaInRai,
        waterFlowRate,
        bestPipeInfo,
    };
};

const snapPointToMainAreaBoundary = (
    point: { lat: number; lng: number },
    mainArea: { lat: number; lng: number }[],
    snapThreshold: number = 5
): { lat: number; lng: number } => {
    if (!mainArea || mainArea.length < 3) {
        return point;
    }

    let closestPoint = point;
    let minDistance = Infinity;

    for (let i = 0; i < mainArea.length; i++) {
        const start = mainArea[i];
        const end = mainArea[(i + 1) % mainArea.length];

        const closestPointOnSegment = findClosestPointOnLineSegment(point, start, end);
        const distance = calculateDistanceBetweenPoints(point, closestPointOnSegment);

        if (distance < minDistance) {
            minDistance = distance;
            closestPoint = closestPointOnSegment;
        }
    }

    if (minDistance <= snapThreshold) {
        return closestPoint;
    }

    return point;
};

// ฟังก์ชัน findClosestPointOnLineSegment ถูกย้ายไปอยู่ใน horticultureUtils.ts แล้ว

const advancedSnapToMainArea = (
    coordinates: { lat: number; lng: number }[],
    mainArea: { lat: number; lng: number }[]
): { lat: number; lng: number }[] => {
    if (!mainArea || mainArea.length < 3) {
        return coordinates;
    }

    let longestEdge = 0;
    let longestEdgeStart: { lat: number; lng: number } | null = null;
    let longestEdgeEnd: { lat: number; lng: number } | null = null;
    // let longestEdgeIndex = -1;

    for (let i = 0; i < mainArea.length; i++) {
        const start = mainArea[i];
        const end = mainArea[(i + 1) % mainArea.length];
        const edgeLength = calculateDistanceBetweenPoints(start, end);

        if (edgeLength > longestEdge) {
            longestEdge = edgeLength;
            longestEdgeStart = start;
            longestEdgeEnd = end;
            // longestEdgeIndex = i;
        }
    }

    const snappedCoordinates = coordinates.map((coord) => {
        if (longestEdgeStart && longestEdgeEnd) {
            const distanceToLongestEdge = calculateDistanceBetweenPoints(
                coord,
                findClosestPointOnLineSegment(coord, longestEdgeStart, longestEdgeEnd)
            );

            if (distanceToLongestEdge <= 5) {
                const snappedPoint = findClosestPointOnLineSegment(
                    coord,
                    longestEdgeStart,
                    longestEdgeEnd
                );
                return snappedPoint;
            }
        }

        return snapPointToMainAreaBoundary(coord, mainArea, 5);
    });

    return snappedCoordinates;
};

const calculateAreaFromCoordinates = (coordinates: { lat: number; lng: number }[]): number => {
    if (!coordinates || coordinates.length < 3) return 0;

    try {
        let area = 0;
        for (let i = 0; i < coordinates.length; i++) {
            const j = (i + 1) % coordinates.length;
            area += coordinates[i].lat * coordinates[j].lng;
            area -= coordinates[j].lat * coordinates[i].lng;
        }
        area = Math.abs(area) / 2;

        const avgLat = coordinates.reduce((sum, coord) => sum + coord.lat, 0) / coordinates.length;
        const latFactor = 111000;
        const lngFactor = 111000 * Math.cos((avgLat * Math.PI) / 180);

        const areaInSquareMeters = area * latFactor * lngFactor;
        return Math.max(0, areaInSquareMeters);
    } catch (error) {
        console.error('Error calculating area:', error);
        return 0;
    }
};

const interpolatePositionAlongPipe = (
    coordinates: { lat: number; lng: number }[],
    targetDistance: number
): { lat: number; lng: number } | null => {
    if (!coordinates || coordinates.length < 2 || targetDistance < 0) return null;

    try {
        let accumulatedDistance = 0;

        for (let i = 1; i < coordinates.length; i++) {
            const segmentLength = calculateDistanceBetweenPoints(
                coordinates[i - 1],
                coordinates[i]
            );

            if (accumulatedDistance + segmentLength >= targetDistance) {
                const segmentProgress =
                    segmentLength > 0 ? (targetDistance - accumulatedDistance) / segmentLength : 0;

                return {
                    lat:
                        coordinates[i - 1].lat +
                        (coordinates[i].lat - coordinates[i - 1].lat) * segmentProgress,
                    lng:
                        coordinates[i - 1].lng +
                        (coordinates[i].lng - coordinates[i - 1].lng) * segmentProgress,
                };
            }

            accumulatedDistance += segmentLength;
        }

        return coordinates[coordinates.length - 1];
    } catch (error) {
        console.error('Error interpolating position:', error);
        return null;
    }
};

const findClosestPointOnPipe = (
    position: { lat: number; lng: number },
    pipeCoordinates: { lat: number; lng: number }[]
): { position: { lat: number; lng: number }; distance: number; segmentIndex: number } | null => {
    if (!pipeCoordinates || pipeCoordinates.length < 2) return null;

    let closestPoint: { lat: number; lng: number } | null = null;
    let minDistance = Infinity;
    let bestSegmentIndex = 0;

    for (let i = 0; i < pipeCoordinates.length - 1; i++) {
        const segmentStart = pipeCoordinates[i];
        const segmentEnd = pipeCoordinates[i + 1];

        const segmentLength = calculateDistanceBetweenPoints(segmentStart, segmentEnd);
        if (segmentLength === 0) continue;

        const t = Math.max(
            0,
            Math.min(
                1,
                ((position.lat - segmentStart.lat) * (segmentEnd.lat - segmentStart.lat) +
                    (position.lng - segmentStart.lng) * (segmentEnd.lng - segmentStart.lng)) /
                    ((segmentLength * segmentLength) / (111000 * 111000))
            )
        );

        const closestOnSegment = {
            lat: segmentStart.lat + t * (segmentEnd.lat - segmentStart.lat),
            lng: segmentStart.lng + t * (segmentEnd.lng - segmentStart.lng),
        };

        const distance = calculateDistanceBetweenPoints(position, closestOnSegment);

        if (distance < minDistance) {
            minDistance = distance;
            closestPoint = closestOnSegment;
            bestSegmentIndex = i;
        }
    }

    return closestPoint
        ? {
              position: closestPoint,
              distance: minDistance,
              segmentIndex: bestSegmentIndex,
          }
        : null;
};

const findClosestPointOnPipeExtended = (
    position: { lat: number; lng: number },
    pipeCoordinates: { lat: number; lng: number }[]
): { position: { lat: number; lng: number }; distance: number; segmentIndex: number } | null => {
    if (!pipeCoordinates || pipeCoordinates.length < 2) return null;

    let closestPoint: { lat: number; lng: number } | null = null;
    let minDistance = Infinity;
    let bestSegmentIndex = 0;

    for (let i = 0; i < pipeCoordinates.length - 1; i++) {
        const a = pipeCoordinates[i];
        const b = pipeCoordinates[i + 1];

        const ab = { lat: b.lat - a.lat, lng: b.lng - a.lng };
        const ap = { lat: position.lat - a.lat, lng: position.lng - a.lng };

        const abLenSq = ab.lat * ab.lat + ab.lng * ab.lng;
        if (abLenSq === 0) continue;

        const t = (ap.lat * ab.lat + ap.lng * ab.lng) / abLenSq;

        const proj = { lat: a.lat + t * ab.lat, lng: a.lng + t * ab.lng };
        const distance = calculateDistanceBetweenPoints(position, proj);

        if (distance < minDistance) {
            minDistance = distance;
            closestPoint = proj;
            bestSegmentIndex = i;
        }
    }

    return closestPoint
        ? { position: closestPoint, distance: minDistance, segmentIndex: bestSegmentIndex }
        : null;
};

const trimSubMainPipeToFitBranches = (
    subMainCoordinates: { lat: number; lng: number }[],
    branchPipes: { coordinates: { lat: number; lng: number }[] }[],
    isConnectedToMainPipe: boolean = false
): { lat: number; lng: number }[] => {
    if (
        !subMainCoordinates ||
        subMainCoordinates.length < 2 ||
        !branchPipes ||
        branchPipes.length === 0
    ) {
        return subMainCoordinates;
    }

    try {
        const pipeLength = calculatePipeLength(subMainCoordinates);
        const branchPositions = branchPipes
            .map((branch) => (branch as any).connectionPoint || 0)
            .filter((point) => point >= 0 && point <= 1)
            .sort((a, b) => a - b);

        if (branchPositions.length === 0) {
            return subMainCoordinates;
        }

        const firstBranchPosition = branchPositions[0];
        const lastBranchPosition = branchPositions[branchPositions.length - 1];

        const firstBranchDistance = firstBranchPosition * pipeLength;
        const lastBranchDistance = lastBranchPosition * pipeLength;

        const firstBranchCoord = interpolatePositionAlongPipe(
            subMainCoordinates,
            firstBranchDistance
        );
        const lastBranchCoord = interpolatePositionAlongPipe(
            subMainCoordinates,
            lastBranchDistance
        );

        if (!firstBranchCoord || !lastBranchCoord) {
            return subMainCoordinates;
        }

        if (isConnectedToMainPipe) {
            return [subMainCoordinates[0], lastBranchCoord];
        } else {
            return [firstBranchCoord, lastBranchCoord];
        }
    } catch (error) {
        console.error('Error trimming sub-main pipe:', error);
        return subMainCoordinates;
    }
};

const _calculateBranchEndPosition = (
    startPos: { lat: number; lng: number },
    direction: { lat: number; lng: number },
    multiplier: number,
    length: number
) => {
    return {
        lat: startPos.lat + (direction.lat * multiplier * length) / 111000,
        lng:
            startPos.lng +
            (direction.lng * multiplier * length) /
                (111000 * Math.cos((startPos.lat * Math.PI) / 180)),
    };
};

const checkBoundaryOverlap = (
    areaBounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
    mainBounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
    boundaryBufferLat: number,
    boundaryBufferLng: number,
    direction: 'top' | 'bottom' | 'left' | 'right'
): boolean => {
    switch (direction) {
        case 'top':
            return (
                areaBounds.minLat < mainBounds.maxLat &&
                areaBounds.maxLat > mainBounds.maxLat - boundaryBufferLat &&
                areaBounds.minLng < mainBounds.maxLng &&
                areaBounds.maxLng > mainBounds.minLng
            );
        case 'bottom':
            return (
                areaBounds.maxLat > mainBounds.minLat &&
                areaBounds.minLat < mainBounds.minLat + boundaryBufferLat &&
                areaBounds.minLng < mainBounds.maxLng &&
                areaBounds.maxLng > mainBounds.minLng
            );
        case 'left':
            return (
                areaBounds.maxLng > mainBounds.minLng &&
                areaBounds.minLng < mainBounds.minLng + boundaryBufferLng &&
                areaBounds.minLat < mainBounds.maxLat &&
                areaBounds.maxLat > mainBounds.minLat
            );
        case 'right':
            return (
                areaBounds.minLng < mainBounds.maxLng &&
                areaBounds.maxLng > mainBounds.maxLng - boundaryBufferLng &&
                areaBounds.minLat < mainBounds.maxLat &&
                areaBounds.maxLat > mainBounds.minLat
            );
        default:
            return false;
    }
};

/**
 * สร้างต้นไม้อัตโนมัติในพื้นที่ที่กำหนด
 */
const generatePlantsInAreaWithSmartBoundary = (
    areaCoordinates: Coordinate[],
    plantData: PlantData,
    layoutPattern: 'grid' | 'staggered',
    exclusionAreas: ExclusionArea[] = [],
    otherPlantAreas: PlantArea[] = [],
    rotationAngle: number = 0,
    sharedBaseline?: number
): PlantLocation[] => {
    if (areaCoordinates.length < 3) return [];

    const plants: PlantLocation[] = [];

    const bounds = {
        minLat: Math.min(...areaCoordinates.map((c) => c.lat)),
        maxLat: Math.max(...areaCoordinates.map((c) => c.lat)),
        minLng: Math.min(...areaCoordinates.map((c) => c.lng)),
        maxLng: Math.max(...areaCoordinates.map((c) => c.lng)),
    };

    const latSpacing = plantData.rowSpacing / 111000;
    const lngSpacing =
        plantData.plantSpacing / (111000 * Math.cos((bounds.minLat * Math.PI) / 180));
    const boundaryBufferLat = (plantData.rowSpacing * 0.5) / 111000;
    const boundaryBufferLng =
        (plantData.plantSpacing * 0.5) / (111000 * Math.cos((bounds.minLat * Math.PI) / 180));

    const hasPlantsOnTop = otherPlantAreas.some((area) => {
        const areaBounds = {
            minLat: Math.min(...area.coordinates.map((c) => c.lat)),
            maxLat: Math.max(...area.coordinates.map((c) => c.lat)),
            minLng: Math.min(...area.coordinates.map((c) => c.lng)),
            maxLng: Math.max(...area.coordinates.map((c) => c.lng)),
        };
        return checkBoundaryOverlap(
            areaBounds,
            bounds,
            boundaryBufferLat,
            boundaryBufferLng,
            'top'
        );
    });

    const hasPlantsOnBottom = otherPlantAreas.some((area) => {
        const areaBounds = {
            minLat: Math.min(...area.coordinates.map((c) => c.lat)),
            maxLat: Math.max(...area.coordinates.map((c) => c.lat)),
            minLng: Math.min(...area.coordinates.map((c) => c.lng)),
            maxLng: Math.max(...area.coordinates.map((c) => c.lng)),
        };
        return checkBoundaryOverlap(
            areaBounds,
            bounds,
            boundaryBufferLat,
            boundaryBufferLng,
            'bottom'
        );
    });

    const hasPlantsOnLeft = otherPlantAreas.some((area) => {
        const areaBounds = {
            minLat: Math.min(...area.coordinates.map((c) => c.lat)),
            maxLat: Math.max(...area.coordinates.map((c) => c.lat)),
            minLng: Math.min(...area.coordinates.map((c) => c.lng)),
            maxLng: Math.max(...area.coordinates.map((c) => c.lng)),
        };
        return checkBoundaryOverlap(
            areaBounds,
            bounds,
            boundaryBufferLat,
            boundaryBufferLng,
            'left'
        );
    });

    const hasPlantsOnRight = otherPlantAreas.some((area) => {
        const areaBounds = {
            minLat: Math.min(...area.coordinates.map((c) => c.lat)),
            maxLat: Math.max(...area.coordinates.map((c) => c.lat)),
            minLng: Math.min(...area.coordinates.map((c) => c.lng)),
            maxLng: Math.max(...area.coordinates.map((c) => c.lng)),
        };
        return checkBoundaryOverlap(
            areaBounds,
            bounds,
            boundaryBufferLat,
            boundaryBufferLng,
            'right'
        );
    });

    const adjustedBounds = {
        minLat: bounds.minLat + (hasPlantsOnBottom ? 0 : boundaryBufferLat),
        maxLat: bounds.maxLat - (hasPlantsOnTop ? 0 : boundaryBufferLat),
        minLng: bounds.minLng + (hasPlantsOnLeft ? 0 : boundaryBufferLng),
        maxLng: bounds.maxLng - (hasPlantsOnRight ? 0 : boundaryBufferLng),
    };

    let startingLat: number;
    if (sharedBaseline !== undefined) {
        // หาแถวที่ใกล้ที่สุดกับ shared baseline ในขอบเขตของพื้นที่นี้
        const candidateRows: number[] = [];

        // สร้างแถวที่เป็นไปได้ในขอบเขตนี้
        for (let lat = adjustedBounds.minLat; lat <= adjustedBounds.maxLat; lat += latSpacing) {
            candidateRows.push(lat);
        }

        if (candidateRows.length > 0) {
            // เลือกแถวที่ใกล้ที่สุดกับ shared baseline
            startingLat = candidateRows.reduce((closest, current) => {
                const closestDistance = Math.abs(closest - sharedBaseline);
                const currentDistance = Math.abs(current - sharedBaseline);
                return currentDistance < closestDistance ? current : closest;
            });
        } else {
            // ถ้าไม่มีแถวที่เหมาะสม ให้ใช้ shared baseline โดยตรง
            startingLat = sharedBaseline;
        }
    } else {
        startingLat = adjustedBounds.minLat;
    }

    const center = {
        lat: (adjustedBounds.minLat + adjustedBounds.maxLat) / 2,
        lng: (adjustedBounds.minLng + adjustedBounds.maxLng) / 2,
    };

    // ขยายขอบเขตเพื่อให้ครอบคลุมการหมุน (rotation) ได้ดีขึ้น
    const expansionFactor = rotationAngle !== 0 ? 1.5 : 1.2; // ขยายมากขึ้นถ้ามีการหมุน
    const latRange = (adjustedBounds.maxLat - adjustedBounds.minLat) * expansionFactor;
    const lngRange = (adjustedBounds.maxLng - adjustedBounds.minLng) * expansionFactor;

    const expandedBounds = {
        minLat: center.lat - latRange / 2,
        maxLat: center.lat + latRange / 2,
        minLng: center.lng - lngRange / 2,
        maxLng: center.lng + lngRange / 2,
    };

    let gridPoints: Coordinate[];

    if (layoutPattern === 'grid') {
        gridPoints = generateRotatedGridPointsWithBaseline(
            expandedBounds,
            latSpacing,
            lngSpacing,
            rotationAngle,
            sharedBaseline !== undefined ? startingLat : undefined
        );
    } else {
        gridPoints = generateRotatedStaggeredPointsWithBaseline(
            expandedBounds,
            latSpacing,
            lngSpacing,
            rotationAngle,
            sharedBaseline !== undefined ? startingLat : undefined
        );
    }

    // กรองจุดและตรวจสอบความถูกต้อง
    for (const position of gridPoints) {
        if (isPointInPolygon(position, areaCoordinates)) {
            const inExclusion = exclusionAreas.some((exclusion) =>
                isPointInPolygon(position, exclusion.coordinates)
            );

            if (!inExclusion) {
                plants.push({
                    id: generateUniqueId('plant'),
                    position,
                    plantData,
                    isSelected: false,
                    isEditable: true,
                    health: 'good',
                    rotationAngle: rotationAngle,
                });
            }
        }
    }

    // ตรวจสอบความครอบคลุมของพื้นที่ ถ้าครอบคลุมไม่ดีให้เพิ่มจุดเพิ่มเติม
    const coverageRatio = plants.length / (gridPoints.length > 0 ? gridPoints.length : 1);
    if (coverageRatio < 0.3 && plants.length < 10) {
        console.warn(
            `⚠️ การครอบคลุมพื้นที่ต่ำ: ${(coverageRatio * 100).toFixed(1)}% (ต้นไม้ ${plants.length} จากจุดทั้งหมด ${gridPoints.length})`
        );

        // ลองเพิ่มจุดด้วยการลดระยะห่าง
        const reducedSpacing = {
            lat: latSpacing * 0.8,
            lng: lngSpacing * 0.8,
        };

        const additionalPoints =
            layoutPattern === 'grid'
                ? generateRotatedGridPointsWithBaseline(
                      expandedBounds,
                      reducedSpacing.lat,
                      reducedSpacing.lng,
                      rotationAngle,
                      sharedBaseline !== undefined ? startingLat : undefined
                  )
                : generateRotatedStaggeredPointsWithBaseline(
                      expandedBounds,
                      reducedSpacing.lat,
                      reducedSpacing.lng,
                      rotationAngle,
                      sharedBaseline !== undefined ? startingLat : undefined
                  );

        for (const position of additionalPoints) {
            if (isPointInPolygon(position, areaCoordinates)) {
                const inExclusion = exclusionAreas.some((exclusion) =>
                    isPointInPolygon(position, exclusion.coordinates)
                );

                // ตรวจสอบว่าไม่ซ้ำกับจุดที่มีอยู่แล้ว
                const tooClose = plants.some((existingPlant) => {
                    const distance = calculateDistanceBetweenPoints(
                        position,
                        existingPlant.position
                    );
                    return distance < plantData.plantSpacing * 0.7; // ระยะห่างขั้นต่ำ 70%
                });

                if (!inExclusion && !tooClose) {
                    plants.push({
                        id: generateUniqueId('plant'),
                        position,
                        plantData,
                        isSelected: false,
                        isEditable: true,
                        health: 'good',
                        rotationAngle: rotationAngle,
                    });
                }
            }
        }
    }

    return plants;
};

const rotatePoint = (point: Coordinate, center: Coordinate, angleDegrees: number): Coordinate => {
    const angleRadians = (angleDegrees * Math.PI) / 180;
    const cos = Math.cos(angleRadians);
    const sin = Math.sin(angleRadians);

    const dx = point.lat - center.lat;
    const dy = point.lng - center.lng;

    const rotatedLat = center.lat + dx * cos - dy * sin;
    const rotatedLng = center.lng + dx * sin + dy * cos;

    return { lat: rotatedLat, lng: rotatedLng };
};

const generateRotatedGridPoints = (
    bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
    latSpacing: number,
    lngSpacing: number,
    rotationAngle: number
): Coordinate[] => {
    const center = {
        lat: (bounds.minLat + bounds.maxLat) / 2,
        lng: (bounds.minLng + bounds.maxLng) / 2,
    };

    const points: Coordinate[] = [];

    for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += latSpacing) {
        for (let lng = bounds.minLng; lng <= bounds.maxLng; lng += lngSpacing) {
            const originalPoint = { lat, lng };
            const rotatedPoint = rotatePoint(originalPoint, center, rotationAngle);
            points.push(rotatedPoint);
        }
    }

    return points;
};

const generateRotatedGridPointsWithBaseline = (
    bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
    latSpacing: number,
    lngSpacing: number,
    rotationAngle: number,
    baselineLat?: number
): Coordinate[] => {
    const center = {
        lat: (bounds.minLat + bounds.maxLat) / 2,
        lng: (bounds.minLng + bounds.maxLng) / 2,
    };

    const points: Coordinate[] = [];

    // ถ้ามี baseline ให้สร้างจุดทั้งด้านบนและด้านล่าง baseline
    if (baselineLat !== undefined) {
        // สร้างจุดจาก baseline ขึ้นไปด้านบน
        for (let lat = baselineLat; lat <= bounds.maxLat; lat += latSpacing) {
            for (let lng = bounds.minLng; lng <= bounds.maxLng; lng += lngSpacing) {
                const originalPoint = { lat, lng };
                const rotatedPoint = rotatePoint(originalPoint, center, rotationAngle);
                points.push(rotatedPoint);
            }
        }

        // สร้างจุดจาก baseline ลงไปด้านล่าง (ไม่รวม baseline ซ้ำ)
        for (let lat = baselineLat - latSpacing; lat >= bounds.minLat; lat -= latSpacing) {
            for (let lng = bounds.minLng; lng <= bounds.maxLng; lng += lngSpacing) {
                const originalPoint = { lat, lng };
                const rotatedPoint = rotatePoint(originalPoint, center, rotationAngle);
                points.push(rotatedPoint);
            }
        }
    } else {
        // ถ้าไม่มี baseline ให้ใช้วิธีเดิม
        for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += latSpacing) {
            for (let lng = bounds.minLng; lng <= bounds.maxLng; lng += lngSpacing) {
                const originalPoint = { lat, lng };
                const rotatedPoint = rotatePoint(originalPoint, center, rotationAngle);
                points.push(rotatedPoint);
            }
        }
    }

    return points;
};

const generateRotatedStaggeredPoints = (
    bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
    latSpacing: number,
    lngSpacing: number,
    rotationAngle: number
): Coordinate[] => {
    const center = {
        lat: (bounds.minLat + bounds.maxLat) / 2,
        lng: (bounds.minLng + bounds.maxLng) / 2,
    };

    const points: Coordinate[] = [];
    let rowOffset = 0;

    for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += latSpacing) {
        const startLng = bounds.minLng + (rowOffset % 2) * (lngSpacing / 2);

        for (let lng = startLng; lng <= bounds.maxLng; lng += lngSpacing) {
            const originalPoint = { lat, lng };
            const rotatedPoint = rotatePoint(originalPoint, center, rotationAngle);
            points.push(rotatedPoint);
        }
        rowOffset++;
    }

    return points;
};

const generateRotatedStaggeredPointsWithBaseline = (
    bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number },
    latSpacing: number,
    lngSpacing: number,
    rotationAngle: number,
    baselineLat?: number
): Coordinate[] => {
    const center = {
        lat: (bounds.minLat + bounds.maxLat) / 2,
        lng: (bounds.minLng + bounds.maxLng) / 2,
    };

    const points: Coordinate[] = [];

    // ถ้ามี baseline ให้สร้างจุดทั้งด้านบนและด้านล่าง baseline
    if (baselineLat !== undefined) {
        let rowOffset = 0;

        // สร้างจุดจาก baseline ขึ้นไปด้านบน
        for (let lat = baselineLat; lat <= bounds.maxLat; lat += latSpacing) {
            const startLng = bounds.minLng + (rowOffset % 2) * (lngSpacing / 2);

            for (let lng = startLng; lng <= bounds.maxLng; lng += lngSpacing) {
                const originalPoint = { lat, lng };
                const rotatedPoint = rotatePoint(originalPoint, center, rotationAngle);
                points.push(rotatedPoint);
            }
            rowOffset++;
        }

        // สร้างจุดจาก baseline ลงไปด้านล่าง (ไม่รวม baseline ซ้ำ)
        rowOffset = -1; // เริ่มจากแถวก่อนหน้า baseline
        for (let lat = baselineLat - latSpacing; lat >= bounds.minLat; lat -= latSpacing) {
            const startLng = bounds.minLng + (Math.abs(rowOffset) % 2) * (lngSpacing / 2);

            for (let lng = startLng; lng <= bounds.maxLng; lng += lngSpacing) {
                const originalPoint = { lat, lng };
                const rotatedPoint = rotatePoint(originalPoint, center, rotationAngle);
                points.push(rotatedPoint);
            }
            rowOffset--;
        }
    } else {
        // ถ้าไม่มี baseline ให้ใช้วิธีเดิม
        let rowOffset = 0;
        for (let lat = bounds.minLat; lat <= bounds.maxLat; lat += latSpacing) {
            const startLng = bounds.minLng + (rowOffset % 2) * (lngSpacing / 2);

            for (let lng = startLng; lng <= bounds.maxLng; lng += lngSpacing) {
                const originalPoint = { lat, lng };
                const rotatedPoint = rotatePoint(originalPoint, center, rotationAngle);
                points.push(rotatedPoint);
            }
            rowOffset++;
        }
    }

    return points;
};

/**
 * Calculate shared baseline for aligning plant rows
 * @param plantAreas List of all plant areas
 * @param plantData Plant data used for calculation
 * @returns Latitude value for the first row to align
 */
const calculateSharedBaseline = (
    plantAreas: PlantArea[],
    plantData: PlantData
): number | undefined => {
    if (plantAreas.length < 2) return undefined;

    const latSpacing = plantData.rowSpacing / 111000;
    const boundaryBufferLat = (plantData.rowSpacing * 0.5) / 111000;

    // คำนวณขอบเขตของแต่ละพื้นที่
    const areaBounds = plantAreas.map((area) => {
        const bounds = {
            minLat: Math.min(...area.coordinates.map((c) => c.lat)),
            maxLat: Math.max(...area.coordinates.map((c) => c.lat)),
            minLng: Math.min(...area.coordinates.map((c) => c.lng)),
            maxLng: Math.max(...area.coordinates.map((c) => c.lng)),
        };

        return {
            adjustedMinLat: bounds.minLat + boundaryBufferLat,
            adjustedMaxLat: bounds.maxLat - boundaryBufferLat,
            originalBounds: bounds,
        };
    });

    // หาขอบเขตรวมของทุกพื้นที่
    const overallMinLat = Math.min(...areaBounds.map((b) => b.adjustedMinLat));
    const overallMaxLat = Math.max(...areaBounds.map((b) => b.adjustedMaxLat));

    // ใช้ค่าเฉลี่ยของขอบเขตรวมเป็น baseline เพื่อให้ครอบคลุมพื้นที่ทั้งหมด
    const centerLat = (overallMinLat + overallMaxLat) / 2;

    // หาแถวที่ใกล้ที่สุดกับจุดกลาง
    let bestBaseline = centerLat;
    let minDistance = Infinity;

    // ทดสอบแถวต่างๆ รอบจุดกลาง
    for (let testLat = overallMinLat; testLat <= overallMaxLat; testLat += latSpacing) {
        const totalDistance = areaBounds.reduce((sum, bounds) => {
            return sum + Math.abs(testLat - (bounds.adjustedMinLat + bounds.adjustedMaxLat) / 2);
        }, 0);

        if (totalDistance < minDistance) {
            minDistance = totalDistance;
            bestBaseline = testLat;
        }
    }

    return bestBaseline;
};

const generatePlantsInArea = (
    areaCoordinates: Coordinate[],
    plantData: PlantData,
    layoutPattern: 'grid' | 'staggered',
    exclusionAreas: ExclusionArea[] = [],
    rotationAngle: number = 0
): PlantLocation[] => {
    if (areaCoordinates.length < 3) return [];

    const plants: PlantLocation[] = [];

    const bounds = {
        minLat: Math.min(...areaCoordinates.map((c) => c.lat)),
        maxLat: Math.max(...areaCoordinates.map((c) => c.lat)),
        minLng: Math.min(...areaCoordinates.map((c) => c.lng)),
        maxLng: Math.max(...areaCoordinates.map((c) => c.lng)),
    };

    const latSpacing = plantData.rowSpacing / 111000;
    const lngSpacing =
        plantData.plantSpacing / (111000 * Math.cos((bounds.minLat * Math.PI) / 180));
    const boundaryBufferLat = (plantData.rowSpacing * 0.5) / 111000;
    const boundaryBufferLng =
        (plantData.plantSpacing * 0.5) / (111000 * Math.cos((bounds.minLat * Math.PI) / 180));

    const adjustedBounds = {
        minLat: bounds.minLat + boundaryBufferLat,
        maxLat: bounds.maxLat - boundaryBufferLat,
        minLng: bounds.minLng + boundaryBufferLng,
        maxLng: bounds.maxLng - boundaryBufferLng,
    };

    const center = {
        lat: (adjustedBounds.minLat + adjustedBounds.maxLat) / 2,
        lng: (adjustedBounds.minLng + adjustedBounds.maxLng) / 2,
    };

    const diagonal = Math.sqrt(
        Math.pow(adjustedBounds.maxLat - adjustedBounds.minLat, 2) +
            Math.pow(adjustedBounds.maxLng - adjustedBounds.minLng, 2)
    );

    const expandedBounds = {
        minLat: center.lat - diagonal / 2,
        maxLat: center.lat + diagonal / 2,
        minLng: center.lng - diagonal / 2,
        maxLng: center.lng + diagonal / 2,
    };

    let gridPoints: Coordinate[];

    if (layoutPattern === 'grid') {
        gridPoints = generateRotatedGridPoints(
            expandedBounds,
            latSpacing,
            lngSpacing,
            rotationAngle
        );
    } else {
        gridPoints = generateRotatedStaggeredPoints(
            expandedBounds,
            latSpacing,
            lngSpacing,
            rotationAngle
        );
    }

    for (const position of gridPoints) {
        if (isPointInPolygon(position, areaCoordinates)) {
            const inExclusion = exclusionAreas.some((exclusion) =>
                isPointInPolygon(position, exclusion.coordinates)
            );

            if (!inExclusion) {
                plants.push({
                    id: generateUniqueId('plant'),
                    position,
                    plantData,
                    isSelected: false,
                    isEditable: true,
                    health: 'good',
                    rotationAngle: rotationAngle,
                });
            }
        }
    }

    return plants;
};

const removePlantsInExclusionZones = (
    plants: PlantLocation[],
    exclusionAreas: ExclusionArea[]
): PlantLocation[] => {
    if (!exclusionAreas || exclusionAreas.length === 0) {
        return plants;
    }

    return plants.filter((plant) => {
        return !exclusionAreas.some((exclusion) =>
            isPointInPolygon(plant.position, exclusion.coordinates)
        );
    });
};

const generateDimensionLines = (
    exclusionArea: ExclusionArea,
    mainArea: Coordinate[],
    angleOffset: number = 0
): { id: string; start: Coordinate; end: Coordinate; distance: number; angle: number }[] => {
    return generatePerpendicularDimensionLines(exclusionArea, mainArea, angleOffset);
};

const _distanceFromPointToLineSegment = (
    point: { lat: number; lng: number },
    lineStart: { lat: number; lng: number },
    lineEnd: { lat: number; lng: number }
): number => {
    const A = point.lat - lineStart.lat;
    const B = point.lng - lineStart.lng;
    const C = lineEnd.lat - lineStart.lat;
    const D = lineEnd.lng - lineStart.lng;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;

    if (lenSq === 0) {
        return calculateDistanceBetweenPoints(point, lineStart);
    }

    const param = dot / lenSq;

    let closestPointOnSegment: { lat: number; lng: number };

    if (param < 0) {
        closestPointOnSegment = lineStart;
    } else if (param > 1) {
        closestPointOnSegment = lineEnd;
    } else {
        closestPointOnSegment = {
            lat: lineStart.lat + param * C,
            lng: lineStart.lng + param * D,
        };
    }

    return calculateDistanceBetweenPoints(point, closestPointOnSegment);
};

interface Coordinate {
    lat: number;
    lng: number;
}

interface PlantData {
    id: number;
    name: string;
    plantSpacing: number;
    rowSpacing: number;
    waterNeed: number;
}

/**
 * @deprecated Use IrrigationZone instead - this interface will be removed in the future
 * Currently used for irrigation zones (💧 Irrigation Zones) and manual irrigation zones (💧 Manual Irrigation Zones)
 */
interface Zone {
    id: string;
    name: string;
    coordinates: Coordinate[];
    plantData: PlantData;
    plantCount: number;
    totalWaterNeed: number;
    area: number;
    color: string;
    isLocked?: boolean;
    createdAt?: string;
    updatedAt?: string;
    shape?: 'circle' | 'polygon' | 'rectangle';
    isCustomPlant?: boolean;
}

interface Pump {
    id: string;
    position: Coordinate;
    type: 'submersible' | 'centrifugal' | 'jet';
    capacity: number;
    head: number;
    power?: number;
    efficiency?: number;
}

interface MainPipe {
    id: string;
    fromPump: string;
    toZone: string;
    coordinates: Coordinate[];
    length: number;
    diameter: number;
    material?: 'pvc' | 'hdpe' | 'steel';
    pressure?: number;
    flowRate?: number;
}

interface SubMainPipe {
    id: string;
    zoneId: string;
    coordinates: Coordinate[];
    length: number;
    diameter: number;
    branchPipes: BranchPipe[];
    material?: 'pvc' | 'hdpe' | 'steel';
    isEditable?: boolean;
    currentAngle?: number;
}

interface BranchPipe {
    id: string;
    subMainPipeId: string;
    coordinates: Coordinate[];
    length: number;
    diameter: number;
    plants: PlantLocation[];
    sprinklerType?: string;
    isEditable?: boolean;
    isSelected?: boolean;
    isHovered?: boolean;
    isHighlighted?: boolean;
    isDisabled?: boolean;
    isVisible?: boolean;
    isActive?: boolean;
    angle?: number;
    connectionPoint?: number;
}

interface LateralPipe {
    id: string;
    subMainPipeId: string;
    coordinates: Coordinate[];
    length: number;
    diameter: number;
    plants: PlantLocation[];
    placementMode: 'over_plants' | 'between_plants';
    emitterLines: EmitterLine[];
    isEditable?: boolean;
    isSelected?: boolean;
    isHovered?: boolean;
    isHighlighted?: boolean;
    isDisabled?: boolean;
    isVisible?: boolean;
    isActive?: boolean;
    connectionPoint?: Coordinate;
    totalWaterNeed: number;
    plantCount: number;
    // 🚀 เพิ่มข้อมูลจุดตัดและสถิติแยกส่วน
    intersectionData?: {
        point: Coordinate;
        subMainPipeId: string;
        segmentIndex: number;
        segmentStats: {
            segment1: {
                length: number;
                plants: PlantLocation[];
                waterNeed: number;
            };
            segment2: {
                length: number;
                plants: PlantLocation[];
                waterNeed: number;
            };
            total: {
                length: number;
                plants: PlantLocation[];
                waterNeed: number;
            };
        };
    };
    zoneId?: string; // เพิ่มเพื่อระบุโซน
}

interface EmitterLine {
    id: string;
    lateralPipeId: string;
    plantId: string;
    coordinates: Coordinate[];
    length: number;
    diameter: number;
    emitterType?: string;
    isVisible?: boolean;
    isActive?: boolean;
}

interface PlantLocation {
    id: string;
    position: Coordinate;
    plantData: PlantData;
    isSelected?: boolean;
    isEditable?: boolean;
    elevation?: number;
    soilType?: string;
    health?: 'good' | 'fair' | 'poor';
    zoneId?: string;
    plantAreaId?: string;
    plantAreaColor?: string;
    rotationAngle?: number;
    isDragging?: boolean;
}

interface ExclusionArea {
    id: string;
    type: 'building' | 'powerplant' | 'river' | 'road' | 'other';
    coordinates: Coordinate[];
    name: string;
    color: string;
    description?: string;
    isLocked?: boolean;
    shape?: 'circle' | 'polygon' | 'rectangle';
}

interface PipeSegment {
    index: number;
    startPlant: PlantLocation;
    endPlant: PlantLocation;
    length: number;
    label: string;
}

interface PlantArea {
    id: string;
    name: string;
    coordinates: Coordinate[];
    plantData: PlantData;
    color: string;
    isCompleted: boolean;
}

interface PlantGenerationSettings {
    layoutPattern: 'grid' | 'staggered';
    isGenerating: boolean;
    rotationAngle: number;
}

interface ExclusionZone {
    id: string;
    coordinates: Coordinate[];
    dimensionLines: {
        id: string;
        start: Coordinate;
        end: Coordinate;
        distance: number;
        angle: number;
    }[];
    showDimensionLines: boolean;
}

interface IrrigationZone {
    id: string;
    name: string;
    coordinates: Coordinate[];
    plants: PlantLocation[];
    totalWaterNeed: number;
    color: string;
    layoutIndex: number;
}

interface ManualIrrigationZone {
    id: string;
    name: string;
    coordinates: Coordinate[];
    plants: PlantLocation[];
    totalWaterNeed: number;
    color: string;
    zoneIndex: number;
    isAccepted: boolean;
    area?: number; // เพิ่มพื้นที่ในตารางเมตร
    areaInRai?: number; // เพิ่มพื้นที่ในหน่วยไร่
    waterFlowRate?: number; // เพิ่มอัตราการไหลน้ำ (ลิตร/นาที)
    bestPipeInfo?: {
        longest: number;
        totalLength: number;
        count: number;
    }; // เพิ่มข้อมูลท่อที่ดีที่สุด
}

interface PlantSelectionMode {
    type: 'single' | 'multiple';
    isCompleted: boolean;
}

interface ProjectState {
    mainArea: Coordinate[];
    plantAreas: PlantArea[];
    zones: Zone[];
    pump: Pump | null;
    mainPipes: MainPipe[];
    subMainPipes: SubMainPipe[];
    lateralPipes: LateralPipe[];
    plants: PlantLocation[];
    exclusionAreas: ExclusionArea[];
    exclusionZones: ExclusionZone[];
    irrigationZones: IrrigationZone[];
    useZones: boolean;
    selectedPlantType: PlantData;
    availablePlants: PlantData[];
    editMode: string | null; // 🚀 เพิ่ม editMode property เพื่อจัดการโหมดการแก้ไข
    plantGenerationSettings: PlantGenerationSettings;
    plantSelectionMode: PlantSelectionMode;
    spacingValidationStats: {
        totalBranches: number;
        averageRowSpacing: number;
        averagePlantSpacing: number;
        spacingAccuracy: number;
    };
    areaUtilizationStats: {
        totalBranches: number;
        averageUtilization: number;
        maxUtilization: number;
    };
    isEditModeEnabled: boolean;
    branchPipeSettings: {
        defaultAngle: number;
        maxAngle: number;
        minAngle: number;
        angleStep: number;
    };
    lateralPipeSettings: {
        placementMode: 'over_plants' | 'between_plants';
        snapThreshold: number;
        autoGenerateEmitters: boolean;
        emitterDiameter: number;
    };
    selectedItems: {
        plants: string[];
        pipes: string[];
        zones: string[];
    };
    clipboard: {
        plants: PlantLocation[];
        pipes: (MainPipe | SubMainPipe | BranchPipe | LateralPipe)[];
    };
    editModeSettings: {
        snapToGrid: boolean;
        gridSize: number;
        showMeasurements: boolean;
        autoConnect: boolean;
        batchMode: boolean;
        selectionMode: 'single' | 'multi' | 'rectangle';
        dragMode: 'none' | 'plant' | 'pipe';
    };
    layerVisibility: {
        plants: boolean;
        pipes: boolean;
        zones: boolean;
        exclusions: boolean;
        grid: boolean;
        measurements: boolean;
        plantAreas: boolean;
        dimensionLines: boolean;
        lateralPipes: boolean;
        emitterLines: boolean;
    };
    realTimeEditing: {
        activePipeId: string | null;
        activeAngle: number;
        isAdjusting: boolean;
    };
    curvedPipeEditing: {
        isEnabled: boolean;
        editingPipes: Set<string>;
    };
    lateralPipeDrawing: {
        isActive: boolean;
        isContinuousMode: boolean; // 🚀 เพิ่มสำหรับการวาดต่อเนื่อง
        placementMode: 'over_plants' | 'between_plants' | null;
        startPoint: Coordinate | null;
        snappedStartPoint: Coordinate | null;
        currentPoint: Coordinate | null;
        rawCurrentPoint: Coordinate | null;
        selectedPlants: PlantLocation[];
        totalWaterNeed: number;
        plantCount: number;
        // 🚀 เพิ่มสำหรับ multi-segment drawing
        waypoints: Coordinate[]; // จุดหักเลี้ยวที่ผู้ใช้คลิกขวา
        currentSegmentDirection: 'horizontal' | 'vertical' | 'diagonal' | null; // ทิศทางปัจจุบัน
        allSegmentPlants: PlantLocation[]; // ต้นไม้ทั้งหมดในทุกส่วน
        segmentPlants: PlantLocation[][]; // ต้นไม้แยกตามแต่ละส่วน
        isMultiSegmentMode: boolean; // กำลังวาดแบบหลายส่วนหรือไม่
    };
    firstLateralPipeWaterNeeds: {
        [zoneId: string]: number;
        'main-area': number;
    };
    firstLateralPipePlantCounts: {
        [zoneId: string]: number;
        'main-area': number;
    };
    lateralPipeComparison: {
        isComparing: boolean;
        currentZoneId: string | null;
        firstPipeWaterNeed: number;
        currentPipeWaterNeed: number;
        difference: number;
        isMoreThanFirst: boolean;
    };
    pipeConnection: {
        isActive: boolean;
        selectedPoints: Array<{
            id: string;
            type: 'plant' | 'subMainPipe' | 'lateralPipe';
            position: Coordinate;
            data?: Record<string, unknown>;
        }>;
        tempConnections: Array<{
            from: { id: string; type: string; position: Coordinate };
            to: { id: string; type: string; position: Coordinate };
            coordinates: Coordinate[];
        }>;
    };
}

interface HistoryState {
    past: ProjectState[];
    present: ProjectState;
    future: ProjectState[];
}

type HistoryAction =
    | { type: 'PUSH_STATE'; state: ProjectState }
    | { type: 'UNDO' }
    | { type: 'REDO' }
    | { type: 'CLEAR_HISTORY' };

const DEFAULT_PLANT_TYPES = (t: (key: string) => string): PlantData[] => [
    { id: 1, name: t('ทุเรียน'), plantSpacing: 8, rowSpacing: 8, waterNeed: 200 },
    { id: 2, name: t('มังคุด'), plantSpacing: 8, rowSpacing: 8, waterNeed: 50 },
    { id: 3, name: t('มะม่วง'), plantSpacing: 8, rowSpacing: 8, waterNeed: 50 },
    { id: 4, name: t('ลำไย'), plantSpacing: 10, rowSpacing: 10, waterNeed: 70 },
    { id: 5, name: t('ลิ้นจี่'), plantSpacing: 8, rowSpacing: 8, waterNeed: 40 },
    { id: 6, name: t('ลองกอง'), plantSpacing: 8, rowSpacing: 8, waterNeed: 40 },
    { id: 7, name: t('เงาะ'), plantSpacing: 8, rowSpacing: 8, waterNeed: 40 },
    { id: 8, name: t('ส้มโอ'), plantSpacing: 7, rowSpacing: 7, waterNeed: 30 },
    { id: 9, name: t('มะพร้าว'), plantSpacing: 8, rowSpacing: 8, waterNeed: 100 },
    { id: 10, name: t('ชมพู่'), plantSpacing: 4, rowSpacing: 4, waterNeed: 30 },
];

// 🎨 ใช้สีชุดเดียวกับ ZONE_COLORS ใน horticultureUtils.ts
// 🌈 5 โซนแรกใช้สีที่แตกต่างกันมากที่สุด
const ZONE_COLORS = [
    '#FF6B6B',
    '#9B59B6',
    '#F39C12',
    '#1ABC9C',
    '#3498DB',
    '#DDA0DD',
    '#98D8C8',
    '#F7DC6F',
    '#BB8FCE',
    '#85C1E9',
    '#F8C471',
    '#82E0AA',
    '#F1948A',
    '#AED6F1',
    '#D2B4DE',
    '#F9E79F',
    '#A9DFBF',
    '#FAD7A0',
    '#D5A6BD',
    '#B2DFDB',
];

const EXCLUSION_COLORS = {
    building: '#F59E0B',
    powerplant: '#EF4444',
    river: '#3B82F6',
    road: '#6B7280',
    other: '#8B5CF6',
};

const getExclusionTypeName = (type: string, t: (key: string) => string): string => {
    switch (type) {
        case 'building':
            return t('สิ่งก่อสร้าง');
        case 'powerplant':
            return t('ห้องควบคุม');
        case 'river':
            return t('แหล่งน้ำ');
        case 'road':
            return t('ถนน');
        case 'other':
            return t('อื่นๆ');
        default:
            return t('พื้นที่หลีกเลี่ยง');
    }
};

const getPolygonCenter = (coordinates: Coordinate[]): Coordinate => {
    if (coordinates.length === 0) return { lat: 0, lng: 0 };

    const totalLat = coordinates.reduce((sum, coord) => sum + coord.lat, 0);
    const totalLng = coordinates.reduce((sum, coord) => sum + coord.lng, 0);

    return {
        lat: totalLat / coordinates.length,
        lng: totalLng / coordinates.length,
    };
};

const createAreaTextOverlay = (
    map: google.maps.Map,
    coordinates: Coordinate[],
    labelText: string,
    color: string
): google.maps.OverlayView => {
    const center = getPolygonCenter(coordinates);

    class TextOverlay extends google.maps.OverlayView {
        private position: google.maps.LatLng;
        private text: string;
        private color: string;
        private div?: HTMLDivElement;

        constructor(position: google.maps.LatLng, text: string, color: string) {
            super();
            this.position = position;
            this.text = text;
            this.color = color;
        }

        onAdd() {
            this.div = document.createElement('div');
            this.div.style.position = 'absolute';
            this.div.style.fontSize = '10px';
            this.div.style.fontWeight = 'normal';
            this.div.style.color = 'black';
            this.div.style.textShadow = `
                -1px -1px 0 rgba(255,255,255,0.8),
                1px -1px 0 rgba(255,255,255,0.8),
                -1px 1px 0 rgba(255,255,255,0.8),
                1px 1px 0 rgba(255,255,255,0.8),
                0 0 3px rgba(255,255,255,0.5)
            `;
            this.div.style.pointerEvents = 'none';
            this.div.style.userSelect = 'none';
            this.div.style.opacity = '0.7';
            this.div.style.whiteSpace = 'nowrap';
            this.div.style.textAlign = 'center';
            this.div.style.transform = 'translate(-50%, -50%)';
            this.div.innerHTML = this.text;

            const panes = this.getPanes();
            if (panes) {
                panes.overlayLayer.appendChild(this.div);
            }
        }

        draw() {
            if (this.div) {
                const overlayProjection = this.getProjection();
                if (overlayProjection) {
                    const position = overlayProjection.fromLatLngToDivPixel(this.position);
                    if (position) {
                        this.div.style.left = position.x + 'px';
                        this.div.style.top = position.y + 'px';
                    }
                }
            }
        }

        onRemove() {
            if (this.div && this.div.parentNode) {
                this.div.parentNode.removeChild(this.div);
                this.div = undefined;
            }
        }
    }

    const overlay = new TextOverlay(
        new google.maps.LatLng(center.lat, center.lng),
        labelText,
        color
    );

    overlay.setMap(map);
    return overlay;
};

const createPointTextOverlay = (
    map: google.maps.Map,
    coordinate: Coordinate,
    labelText: string,
    color: string,
    offset: { x: number; y: number } = { x: 0, y: 0 }
): google.maps.OverlayView => {
    class TextOverlay extends google.maps.OverlayView {
        private position: google.maps.LatLng;
        private text: string;
        private color: string;
        private offset: { x: number; y: number };
        private div?: HTMLDivElement;

        constructor(
            position: google.maps.LatLng,
            text: string,
            color: string,
            offset: { x: number; y: number }
        ) {
            super();
            this.position = position;
            this.text = text;
            this.color = color;
            this.offset = offset;
        }

        onAdd() {
            this.div = document.createElement('div');
            this.div.style.position = 'absolute';
            this.div.style.fontSize = '12px';
            this.div.style.fontWeight = 'bold';
            this.div.style.color = color;
            this.div.style.textShadow = `
                -1px -1px 0 rgba(255,255,255,1.0),
                1px -1px 0 rgba(255,255,255,1.0),
                -1px 1px 0 rgba(255,255,255,1.0),
                1px 1px 0 rgba(255,255,255,1.0),
                0 0 6px rgba(255,255,255,1.0)
            `;
            this.div.style.pointerEvents = 'none';
            this.div.style.userSelect = 'none';
            this.div.style.opacity = '1.0';
            this.div.style.whiteSpace = 'nowrap';
            this.div.style.textAlign = 'center';
            this.div.style.transform = 'translate(-50%, -50%)';
            this.div.style.backgroundColor = 'rgba(255, 255, 255, 1.0)';
            this.div.style.padding = '4px 8px';
            this.div.style.borderRadius = '5px';
            this.div.style.border = `3px solid ${color}`;
            this.div.style.boxShadow = '0 3px 6px rgba(0,0,0,0.3)';
            this.div.innerHTML = this.text;

            const panes = this.getPanes();
            if (panes) {
                panes.overlayLayer.appendChild(this.div);
            }
        }

        draw() {
            if (this.div) {
                const overlayProjection = this.getProjection();
                if (overlayProjection) {
                    const position = overlayProjection.fromLatLngToDivPixel(this.position);
                    if (position) {
                        this.div.style.left = position.x + this.offset.x + 'px';
                        this.div.style.top = position.y + this.offset.y + 'px';
                    }
                }
            }
        }

        onRemove() {
            if (this.div && this.div.parentNode) {
                this.div.parentNode.removeChild(this.div);
                this.div = undefined;
            }
        }
    }

    const overlay = new TextOverlay(
        new google.maps.LatLng(coordinate.lat, coordinate.lng),
        labelText,
        color,
        offset
    );

    overlay.setMap(map);
    return overlay;
};

const formatArea = (area: number, t: (key: string) => string): string => {
    if (typeof area !== 'number' || isNaN(area) || area < 0) return `0 ${t('ตร.ม.')}`;
    if (area >= 1600) {
        return `${(area / 1600).toFixed(2)} ${t('ไร่')}`;
    } else {
        return `${area.toFixed(2)} ${t('ตร.ม.')}`;
    }
};

const formatWaterVolume = (volume: number, t: (key: string) => string): string => {
    if (typeof volume !== 'number' || isNaN(volume) || volume < 0) return `0 ${t('ลิตร/ครั้ง')}`;
    if (volume >= 1000000) {
        return `${(volume / 1000000).toFixed(2)} ${t('ล้านลิตร/ครั้ง')}`;
    } else if (volume >= 1000) {
        return `${volume.toLocaleString('th-TH')} ${t('ลิตร/ครั้ง')}`;
    } else {
        return `${volume.toFixed(2)} ${t('ลิตร/ครั้ง')}`;
    }
};

// Helper function for displaying water volume with flow rate
const formatWaterVolumeWithFlowRate = (
    volume: number,
    plantCount: number,
    sprinklerConfig: {
        flowRatePerMinute: number;
        pressureBar: number;
        radiusMeters: number;
    } | null,
    t: (key: string) => string,
    _showFlowRate: boolean = true
): string => {
    // const baseText = formatWaterVolume(volume, t);

    // if (!showFlowRate || !sprinklerConfig || plantCount <= 0) {
    //     return baseText;
    // }

    const flowRate = plantCount * (sprinklerConfig?.flowRatePerMinute || 0);
    return `${flowRate.toFixed(2)} ${t('ลิตร/นาที')}`;
};

const getZoneColor = (index: number): string => {
    return ZONE_COLORS[index % ZONE_COLORS.length];
};

const calculatePlantCount = (
    zoneArea: number,
    plantSpacing: number,
    rowSpacing: number
): number => {
    if (zoneArea <= 0 || plantSpacing <= 0 || rowSpacing <= 0) return 0;
    try {
        const effectiveArea = zoneArea * 0.85;
        const plantArea = plantSpacing * rowSpacing;
        const estimatedPlants = Math.floor(effectiveArea / plantArea);
        return Math.max(0, estimatedPlants);
    } catch (error) {
        console.error('Error calculating plant count:', error);
        return 0;
    }
};

const findZoneContainingPoint = (point: Coordinate, zones: Zone[]): Zone | null => {
    for (const zone of zones) {
        if (isPointInPolygon(point, zone.coordinates)) {
            return zone;
        }
    }
    return null;
};

// 🔧 เพิ่มฟังก์ชันสำหรับหาจุดที่ใกล้ที่สุดในพื้นที่หลัก
const findClosestPointInMainArea = (point: Coordinate, mainArea: Coordinate[]): Coordinate => {
    if (isPointInPolygon(point, mainArea)) {
        return point;
    }

    // หาจุดที่ใกล้ที่สุดบนขอบเขตของพื้นที่หลัก
    let closestPoint = point;
    let minDistance = Infinity;

    for (let i = 0; i < mainArea.length; i++) {
        const start = mainArea[i];
        const end = mainArea[(i + 1) % mainArea.length];

        const closestOnSegment = findClosestPointOnLineSegment(point, start, end);
        const distance = calculateDistanceBetweenPoints(point, closestOnSegment);

        if (distance < minDistance) {
            minDistance = distance;
            closestPoint = closestOnSegment;
        }
    }

    return closestPoint;
};

const findZoneForPipe = (coordinates: Coordinate[], zones: Zone[]): Zone | null => {
    if (coordinates.length === 0) return null;
    const midIndex = Math.floor(coordinates.length / 2);
    const midPoint = coordinates[midIndex];
    const midZone = findZoneContainingPoint(midPoint, zones);
    if (midZone) return midZone;
    const startZone = findZoneContainingPoint(coordinates[0], zones);
    if (startZone) return startZone;
    const endZone = findZoneContainingPoint(coordinates[coordinates.length - 1], zones);
    return endZone;
};

const findTargetZoneForMainPipe = (
    coordinates: Coordinate[],
    zones: Zone[],
    useZones: boolean
): string => {
    if (!useZones || zones.length === 0) {
        return 'main-area';
    }
    const endPoint = coordinates[coordinates.length - 1];
    const targetZone = findZoneContainingPoint(endPoint, zones);
    return targetZone ? targetZone.id : zones[0].id;
};

const calculateExactSpacingStats = (subMainPipes: SubMainPipe[]) => {
    let totalBranches = 0;
    const totalRowSpacings: number[] = [];
    const totalPlantSpacings: number[] = [];

    subMainPipes.forEach((subMain) => {
        const branchCount = subMain.branchPipes.length;
        totalBranches += branchCount;

        if (branchCount > 1) {
            for (let i = 1; i < subMain.branchPipes.length; i++) {
                const prevBranch = subMain.branchPipes[i - 1];
                const currentBranch = subMain.branchPipes[i];

                const distance1 = calculateDistanceAlongPipe(
                    subMain.coordinates,
                    prevBranch.coordinates[0]
                );
                const distance2 = calculateDistanceAlongPipe(
                    subMain.coordinates,
                    currentBranch.coordinates[0]
                );
                const branchSpacing = Math.abs(distance2 - distance1);

                totalRowSpacings.push(branchSpacing);
            }
        }

        subMain.branchPipes.forEach((branch) => {
            if (branch.plants.length > 1) {
                for (let i = 1; i < branch.plants.length; i++) {
                    const plant1 = branch.plants[i - 1];
                    const plant2 = branch.plants[i];

                    const distance1 = calculateDistanceAlongPipe(
                        branch.coordinates,
                        plant1.position
                    );
                    const distance2 = calculateDistanceAlongPipe(
                        branch.coordinates,
                        plant2.position
                    );
                    const plantSpacing = Math.abs(distance2 - distance1);

                    totalPlantSpacings.push(plantSpacing);
                }
            }
        });
    });

    const averageRowSpacing =
        totalRowSpacings.length > 0
            ? totalRowSpacings.reduce((sum, spacing) => sum + spacing, 0) / totalRowSpacings.length
            : 0;

    const averagePlantSpacing =
        totalPlantSpacings.length > 0
            ? totalPlantSpacings.reduce((sum, spacing) => sum + spacing, 0) /
              totalPlantSpacings.length
            : 0;

    return {
        totalBranches,
        averageRowSpacing,
        averagePlantSpacing,
        spacingAccuracy: 100,
    };
};

const calculateDistanceAlongPipe = (pipeCoords: Coordinate[], targetPoint: Coordinate): number => {
    let minDistance = Infinity;
    let closestIndex = 0;

    for (let i = 0; i < pipeCoords.length; i++) {
        const distance = Math.sqrt(
            Math.pow(pipeCoords[i].lat - targetPoint.lat, 2) +
                Math.pow(pipeCoords[i].lng - targetPoint.lng, 2)
        );
        if (distance < minDistance) {
            minDistance = distance;
            closestIndex = i;
        }
    }

    let accumulatedDistance = 0;
    for (let i = 1; i <= closestIndex; i++) {
        const segmentDistance = calculateDistanceBetweenPoints(pipeCoords[i - 1], pipeCoords[i]);
        accumulatedDistance += segmentDistance;
    }

    return accumulatedDistance;
};

const historyReducer = (state: HistoryState, action: HistoryAction): HistoryState => {
    switch (action.type) {
        case 'PUSH_STATE':
            return {
                past: [...state.past, state.present],
                present: action.state,
                future: [],
            };
        case 'UNDO':
            if (state.past.length === 0) return state;
            return {
                past: state.past.slice(0, -1),
                present: state.past[state.past.length - 1],
                future: [state.present, ...state.future],
            };
        case 'REDO':
            if (state.future.length === 0) return state;
            return {
                past: [...state.past, state.present],
                present: state.future[0],
                future: state.future.slice(1),
            };
        case 'CLEAR_HISTORY':
            return {
                past: [],
                present: state.present,
                future: [],
            };
        default:
            return state;
    }
};

const CustomPlantModal = ({
    isOpen,
    onClose,
    onSave,
    defaultValues,
    onAfterSave,
    t,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (plantData: PlantData) => void;
    defaultValues?: Partial<PlantData>;
    onAfterSave?: () => void;
    t: (key: string) => string;
}) => {
    const [plantData, setPlantData] = useState<PlantData>({
        id: defaultValues?.id || Date.now(),
        name: defaultValues?.name || '',
        plantSpacing: defaultValues?.plantSpacing || 5,
        rowSpacing: defaultValues?.rowSpacing || 5,
        waterNeed: defaultValues?.waterNeed || 10,
    });

    // อัปเดตข้อมูลเมื่อ defaultValues เปลี่ยน (กรณีแก้ไข)
    useEffect(() => {
        if (defaultValues && defaultValues.id) {
            setPlantData({
                id: defaultValues.id,
                name: defaultValues.name || '',
                plantSpacing: defaultValues.plantSpacing || 5,
                rowSpacing: defaultValues.rowSpacing || 5,
                waterNeed: defaultValues.waterNeed || 10,
            });
        } else {
            // รีเซ็ตฟอร์มเมื่อไม่ใช่การแก้ไข
            setPlantData({
                id: Date.now(),
                name: '',
                plantSpacing: 5,
                rowSpacing: 5,
                waterNeed: 10,
            });
        }
    }, [defaultValues]);

    const handleSave = () => {
        if (plantData.name.trim() === '') {
            alert(t('กรุณากรอกชื่อพืช'));
            return;
        }
        if (plantData.plantSpacing <= 0 || plantData.rowSpacing <= 0 || plantData.waterNeed <= 0) {
            alert(t('กรุณากรอกค่าที่มากกว่า 0'));
            return;
        }
        onSave(plantData);
        onClose();

        // เรียกใช้ callback หลังจากบันทึกเสร็จ
        if (onAfterSave) {
            onAfterSave();
        }

        // รีเซ็ตฟอร์มเพื่อเตรียมสำหรับการเพิ่มพืชต่อไป
        setPlantData({
            id: Date.now(),
            name: '',
            plantSpacing: 5,
            rowSpacing: 5,
            waterNeed: 10,
        });
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-gray-900 p-6 shadow-2xl">
                <h3 className="mb-4 text-xl font-semibold text-white">🌱 {t('กำหนดพืชใหม่')}</h3>

                <div className="space-y-4">
                    <div>
                        <label className="mb-2 block text-sm font-medium text-white">
                            {t('ชื่อพืช *')}
                        </label>
                        <input
                            type="text"
                            value={plantData.name}
                            onChange={(e) => setPlantData({ ...plantData, name: e.target.value })}
                            className="w-full rounded border border-gray-300 px-3 py-2 text-black focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            placeholder={t('เช่น มะม่วงพันธุ์ใหม่')}
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-white">
                            {t('น้ำต่อต้น (ลิตร/ครั้ง) *')}
                        </label>
                        <input
                            type="number"
                            step="0.1"
                            min="0.1"
                            value={plantData.waterNeed}
                            onChange={(e) =>
                                setPlantData({
                                    ...plantData,
                                    waterNeed: parseFloat(e.target.value) || 0,
                                })
                            }
                            className="w-full rounded border border-gray-300 px-3 py-2 text-black focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-white">
                                {t('ระยะห่างต้น (ม.) *')}
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                min="0.1"
                                value={plantData.plantSpacing}
                                onChange={(e) =>
                                    setPlantData({
                                        ...plantData,
                                        plantSpacing: parseFloat(e.target.value) || 0,
                                    })
                                }
                                className="w-full rounded border border-gray-300 px-3 py-2 text-black focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>

                        <div>
                            <label className="mb-2 block text-sm font-medium text-white">
                                {t('ระยะห่างแถว (ม.) *')}
                            </label>
                            <input
                                type="number"
                                step="0.1"
                                min="0.1"
                                value={plantData.rowSpacing}
                                onChange={(e) =>
                                    setPlantData({
                                        ...plantData,
                                        rowSpacing: parseFloat(e.target.value) || 0,
                                    })
                                }
                                className="w-full rounded border border-gray-300 px-3 py-2 text-black focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 rounded bg-gray-100 px-4 py-2 text-black transition-colors hover:bg-gray-200"
                    >
                        {t('ยกเลิก')}
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 rounded bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700"
                    >
                        {t('บันทึก')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ZonePlantSelectionModal = ({
    isOpen,
    onClose,
    zone,
    availablePlants,
    onSave,
    onCreateCustomPlant,
    onEditPlant,
    t,
}: {
    isOpen: boolean;
    onClose: () => void;
    zone: Zone | null;
    availablePlants: PlantData[];
    onSave: (zoneId: string, plantData: PlantData) => void;
    onCreateCustomPlant: () => void;
    onEditPlant: (plantData: PlantData) => void;
    t: (key: string) => string;
}) => {
    const [selectedPlant, setSelectedPlant] = useState<PlantData | null>(zone?.plantData || null);

    useEffect(() => {
        if (zone) {
            setSelectedPlant(zone.plantData);
        }
    }, [zone]);

    const handleSave = () => {
        if (!selectedPlant || !zone) return;
        onSave(zone.id, selectedPlant);
        onClose();
    };

    if (!isOpen || !zone) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black bg-opacity-50">
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-gray-900 p-6 shadow-2xl">
                <h3 className="mb-4 text-xl font-semibold text-white">
                    🌱 {t('เลือกพืชสำหรับ')} {t(zone.name)}
                </h3>

                <div className="mb-4 rounded bg-blue-900 p-3 text-sm">
                    <div className="text-blue-200">📐 {t('ข้อมูลโซน')}:</div>
                    <div className="text-gray-300">
                        • {t('พื้นที่')}: {formatArea(zone.area, t)}
                    </div>
                    <div className="flex items-center">
                        <span className="text-gray-300">• {t('สี')}: </span>
                        <span
                            className="ml-2 inline-block h-4 w-4 rounded"
                            style={{ backgroundColor: zone.color }}
                        ></span>
                    </div>
                </div>

                <div className="max-h-64 space-y-2 overflow-y-auto">
                    {availablePlants.map((plant) => (
                        <div
                            key={plant.id}
                            className={`relative cursor-pointer rounded p-3 transition-colors ${
                                selectedPlant?.id === plant.id
                                    ? 'border border-green-400 bg-green-800'
                                    : 'border border-gray-600 bg-gray-800 hover:bg-gray-700'
                            }`}
                            onClick={() => setSelectedPlant(plant)}
                        >
                            <div className="font-medium text-white">{t(plant.name)}</div>
                            <div className="text-sm text-gray-300">
                                {t('ระยะ')}: {plant.plantSpacing}×{plant.rowSpacing}
                                {t('ม.')} | {t('น้ำ')}: {plant.waterNeed} {t('ล./ครั้ง')}
                            </div>
                            {/* ปุ่มแก้ไขสำหรับพืชทุกชนิด */}
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    // เปิดโมดัลแก้ไขพืชโดยไม่ปิดโมดัลปัจจุบัน
                                    onEditPlant(plant);
                                }}
                                className="absolute right-1 top-1 rounded bg-yellow-600 p-1 text-xs text-white hover:bg-yellow-700"
                                title={t('แก้ไขพืช')}
                            >
                                ✏️
                            </button>
                        </div>
                    ))}
                </div>

                <div className="mt-4">
                    <button
                        onClick={onCreateCustomPlant}
                        className="w-full rounded border border-purple-300 bg-purple-100 px-4 py-2 text-sm text-purple-700 transition-colors hover:bg-purple-200"
                    >
                        ➕ {t('เพิ่มพืชใหม่')}
                    </button>
                </div>

                <div className="mt-6 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 rounded bg-gray-100 px-4 py-2 text-gray-700 transition-colors hover:bg-gray-200"
                    >
                        {t('ยกเลิก')}
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!selectedPlant}
                        className={`flex-1 rounded px-4 py-2 transition-colors ${
                            selectedPlant
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'cursor-not-allowed bg-gray-300 text-gray-500'
                        }`}
                    >
                        {t('บันทึก')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const SimpleMousePlantEditModal = ({
    isOpen,
    onClose,
    plant,
    onSave,
    onDelete,
    availablePlants,
    onCreateCustomPlant,
    onEditPlant,
    // onShowPlantSelector,
    t,
}: {
    isOpen: boolean;
    onClose: () => void;
    plant: PlantLocation | null;
    onSave: (plantId: string, newPlantData: PlantData) => void;
    onDelete: (plantId: string) => void;
    availablePlants: PlantData[];
    onCreateCustomPlant: () => void;
    onEditPlant: (plantData: PlantData) => void;
    onShowPlantSelector?: () => void;
    t: (key: string) => string;
}) => {
    const [selectedPlantData, setSelectedPlantData] = useState<PlantData | null>(null);
    const [showPlantSelector, setShowPlantSelector] = useState(false);

    // Listen for custom event to show plant selector
    useEffect(() => {
        const handleShowPlantSelector = () => {
            setShowPlantSelector(true);
        };

        document.addEventListener('showPlantSelector', handleShowPlantSelector);

        return () => {
            document.removeEventListener('showPlantSelector', handleShowPlantSelector);
        };
    }, []);

    useEffect(() => {
        if (plant) {
            setSelectedPlantData(plant.plantData);
        }
    }, [plant]);

    const handleSave = () => {
        if (!plant || !selectedPlantData) return;
        onSave(plant.id, selectedPlantData);
        onClose();
    };

    const handleDelete = () => {
        if (!plant) return;
        onDelete(plant.id);
        onClose();
    };

    const handlePlantChange = (newPlantData: PlantData) => {
        setSelectedPlantData(newPlantData);
        setShowPlantSelector(false);
    };

    if (!isOpen || !plant) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black bg-opacity-50">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-gray-900 p-6 shadow-2xl">
                <h3 className="mb-4 text-xl font-semibold text-white">🌱 {t('แก้ไขต้นไม้')}</h3>
                <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-900 p-3 text-sm text-yellow-100">
                    <div className="font-semibold">⚠️ {t('คำเตือน')}</div>
                    <div>
                        {!plant.zoneId
                            ? `${t('การแก้ไขจะเปลี่ยนต้นไม้ทั้งหมดในพื้นที่หลัก')}`
                            : `${t('การแก้ไขจะเปลี่ยนต้นไม้ทั้งหมดในพื้นที่ปลูกนี้')}`}
                    </div>
                </div>

                <div className="space-y-4">
                    {selectedPlantData && (
                        <div className="rounded-lg border border-green-200 bg-gray-900 p-3 text-sm">
                            <div className="text-white">
                                <strong>{t('พืช')}:</strong> {t(selectedPlantData.name)}
                            </div>
                            <div className="text-white">
                                <strong>{t('ระยะห่างต้น')}:</strong>{' '}
                                {selectedPlantData.plantSpacing} {t('ม.')}
                            </div>
                            <div className="text-white">
                                <strong>{t('ระยะห่างแถว')}:</strong> {selectedPlantData.rowSpacing}{' '}
                                {t('ม.')}
                            </div>
                            <div className="text-white">
                                <strong>{t('น้ำต่อต้น')}:</strong> {selectedPlantData.waterNeed}{' '}
                                {t('ลิตร/ครั้ง')}
                                {(() => {
                                    const config = loadSprinklerConfig();
                                    if (config) {
                                        return ` (${config.flowRatePerMinute.toFixed(2)} ${t('ลิตร/นาที')})`;
                                    }
                                    return '';
                                })()}
                            </div>
                        </div>
                    )}

                    {/* ปุ่มเปลี่ยนต้นไม้ */}
                    <div className="space-y-2">
                        <button
                            onClick={() => setShowPlantSelector(!showPlantSelector)}
                            className="w-full rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700"
                        >
                            🔄 {t('เปลี่ยนต้นไม้')}
                        </button>

                        {showPlantSelector && (
                            <div className="max-h-60 space-y-2 overflow-y-auto rounded border border-gray-600 bg-gray-800 p-3">
                                {availablePlants.map((plantData) => (
                                    <div key={plantData.id} className="relative">
                                        <button
                                            onClick={() => handlePlantChange(plantData)}
                                            className={`w-full rounded p-2 text-left text-sm transition-colors ${
                                                selectedPlantData?.id === plantData.id
                                                    ? 'bg-green-600 text-white'
                                                    : 'bg-gray-700 text-white hover:bg-gray-600'
                                            }`}
                                        >
                                            <div className="font-semibold">{t(plantData.name)}</div>
                                            <div className="text-xs text-gray-300">
                                                {t('ระยะปลูก')}: {plantData.plantSpacing}×
                                                {plantData.rowSpacing} {t('ม.')} |{t('น้ำ')}:{' '}
                                                {plantData.waterNeed} {t('ล./ครั้ง')}
                                            </div>
                                        </button>
                                        {/* ปุ่มแก้ไขสำหรับพืชทุกชนิด */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowPlantSelector(false);
                                                // เปิดโมดัลแก้ไขพืชโดยไม่ปิดโมดัลปัจจุบัน
                                                onEditPlant(plantData);
                                            }}
                                            className="absolute right-1 top-1 rounded bg-yellow-600 p-1 text-xs text-white hover:bg-yellow-700"
                                            title={t('แก้ไขพืช')}
                                        >
                                            ✏️
                                        </button>
                                    </div>
                                ))}

                                {/* ปุ่มเพิ่มพืชใหม่ */}
                                <button
                                    onClick={() => {
                                        setShowPlantSelector(false);
                                        // เปิดโมดัลสร้างพืชใหม่โดยไม่ปิดโมดัลปัจจุบัน
                                        onCreateCustomPlant();
                                    }}
                                    className="w-full rounded border border-purple-300 bg-purple-100 px-4 py-2 text-sm text-purple-700 transition-colors hover:bg-purple-200"
                                >
                                    ➕ {t('เพิ่มพืชใหม่')}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* ปุ่มเพิ่มพืชใหม่แยกต่างหาก */}
                    <div className="border-t border-gray-700 pt-3">
                        <button
                            onClick={() => {
                                // เปิดโมดัลสร้างพืชใหม่โดยไม่ปิดโมดัลปัจจุบัน
                                onCreateCustomPlant();
                            }}
                            className="w-full rounded border border-purple-300 bg-purple-100 px-4 py-2 text-sm text-purple-700 transition-colors hover:bg-purple-200"
                        >
                            ➕ {t('เพิ่มพืชใหม่')}
                        </button>
                    </div>
                </div>

                <div className="mt-6 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 rounded bg-gray-600 px-4 py-2 text-white transition-colors hover:bg-gray-700"
                    >
                        {t('ยกเลิก')}
                    </button>
                    <button
                        onClick={handleDelete}
                        className="flex-1 rounded bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
                    >
                        <FaTrash className="mr-2 inline" />
                        {t('ลบ')}
                    </button>
                    <button
                        onClick={handleSave}
                        className="flex-1 rounded bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700"
                    >
                        {t('บันทึก')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const PipeSegmentSelectionModal = ({
    isOpen,
    onClose,
    branchPipe,
    onDeleteSegment,
    onDeleteWholePipe,
    t,
}: {
    isOpen: boolean;
    onClose: () => void;
    branchPipe: BranchPipe | null;
    onDeleteSegment: (branchPipeId: string, segmentIndex: number) => void;
    onDeleteWholePipe: (branchPipeId: string) => void;
    t: (key: string) => string;
}) => {
    const [selectedSegment, setSelectedSegment] = useState<number | null>(null);

    useEffect(() => {
        if (branchPipe && branchPipe.plants.length >= 2) {
            setSelectedSegment(0);
        }
    }, [branchPipe]);

    const handleDeleteSegment = () => {
        if (!branchPipe || selectedSegment === null) return;
        onDeleteSegment(branchPipe.id, selectedSegment);
        onClose();
    };

    const handleDeleteWhole = () => {
        if (!branchPipe) return;
        onDeleteWholePipe(branchPipe.id);
        onClose();
    };

    if (!isOpen || !branchPipe) return null;

    const segments: PipeSegment[] = [];
    for (let i = 0; i < branchPipe.plants.length - 1; i++) {
        const startPlant = branchPipe.plants[i];
        const endPlant = branchPipe.plants[i + 1];
        const segmentLength = calculateDistanceBetweenPoints(
            startPlant.position,
            endPlant.position
        );

        segments.push({
            index: i,
            startPlant,
            endPlant,
            length: segmentLength,
            label: `ส่วนที่ ${i + 1}: ต้นไม้ ${i + 1} → ต้นไม้ ${i + 2}`,
        });
    }

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black bg-opacity-50">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-gray-900 p-6 shadow-2xl">
                <h3 className="mb-4 text-xl font-semibold text-white">
                    <FaCut className="mr-2 inline" />
                    {t('ลบท่อย่อยระหว่างต้นไม้')}
                </h3>

                <div className="mb-4 rounded-lg border border-blue-200 bg-gray-900 p-3 text-sm text-white">
                    <div className="font-medium">{t('ข้อมูลท่อ')}:</div>
                    <div>
                        • {t('ความยาวรวม')}: {branchPipe.length.toFixed(2)} {t('ม.')}
                    </div>
                    <div>
                        • {t('จำนวนต้นไม้')}: {branchPipe.plants.length} {t('ต้น')}
                    </div>
                    <div>
                        • {t('จำนวนส่วนที่ตัดได้')}: {segments.length} {t('ส่วน')}
                    </div>
                </div>

                {segments.length > 0 ? (
                    <div className="space-y-4">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-white">
                                {t('เลือกส่วนท่อที่ต้องการลบ')}:
                            </label>
                            <div className="max-h-40 space-y-2 overflow-y-auto">
                                {segments.map((segment, index) => (
                                    <div
                                        key={index}
                                        onClick={() => setSelectedSegment(segment.index)}
                                        className={`cursor-pointer rounded p-3 transition-colors ${
                                            selectedSegment === segment.index
                                                ? 'border border-red-300 bg-red-900'
                                                : 'border border-gray-300 bg-gray-800 hover:bg-gray-700'
                                        }`}
                                    >
                                        <div className="font-medium text-white">
                                            {segment.label}
                                        </div>
                                        <div className="text-sm text-gray-300">
                                            {t('ความยาวส่วน')}: {segment.length.toFixed(2)}{' '}
                                            {t('ม.')}
                                        </div>
                                        <div className="text-xs text-yellow-300">
                                            💡 {t('ลบท่อระหว่างต้นไม้')} - {t('ต้นไม้ยังอยู่')}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="rounded-lg border border-yellow-200 bg-gray-900 p-3 text-sm text-white">
                            <div className="mb-2 font-medium text-yellow-400">
                                💡 {t('วิธีการทำงาน')}:
                            </div>
                            <div>• {t('เลือกส่วนท่อระหว่างต้นไม้ที่ต้องการลบ')}</div>
                            <div>• {t('ต้นไม้จะไม่ถูกลบ แต่ท่อเชื่อมต่อจะหาย')}</div>
                            <div>• {t('ท่อย่อยจะแยกเป็นส่วนๆ หรือสั้นลง')}</div>
                            <div>• {t('สามารถลบทั้งเส้นได้ถ้าต้องการ')}</div>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 rounded bg-gray-600 px-4 py-2 text-white transition-colors hover:bg-gray-700"
                            >
                                {t('ยกเลิก')}
                            </button>
                            <button
                                onClick={handleDeleteWhole}
                                className="flex-1 rounded bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
                            >
                                <FaTrash className="mr-1 inline" />
                                {t('ลบทั้งเส้น')}
                            </button>
                            <button
                                onClick={handleDeleteSegment}
                                disabled={selectedSegment === null}
                                className={`flex-1 rounded px-4 py-2 transition-colors ${
                                    selectedSegment !== null
                                        ? 'bg-orange-600 text-white hover:bg-orange-700'
                                        : 'cursor-not-allowed bg-gray-300 text-gray-500'
                                }`}
                            >
                                <FaCut className="mr-1 inline" />
                                {t('ลบส่วนนี้')}
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="space-y-4">
                        <div className="rounded-lg border border-gray-300 bg-gray-800 p-3 text-center text-gray-300">
                            {t('ไม่สามารถแยกส่วนได้')} - {t('มีต้นไม้น้อยเกินไป')}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={onClose}
                                className="flex-1 rounded bg-gray-600 px-4 py-2 text-white transition-colors hover:bg-gray-700"
                            >
                                {t('ยกเลิก')}
                            </button>
                            <button
                                onClick={handleDeleteWhole}
                                className="flex-1 rounded bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
                            >
                                <FaTrash className="mr-1 inline" />
                                {t('ลบทั้งเส้น')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

const BatchOperationsModal = ({
    isOpen,
    onClose,
    selectedItems,
    onBatchDelete,
    // onBatchMove,
    onBatchCopy,
    onBatchPaste,
    onCreateTemplate,
    onDeleteSpecificPlants,
    onDeleteBranchPipe,
    onSegmentedPipeDeletion,
    t,
}: {
    isOpen: boolean;
    onClose: () => void;
    selectedItems: { plants: string[]; pipes: string[]; zones: string[] };
    onBatchDelete: () => void;
    onBatchMove: (offset: Coordinate) => void;
    onBatchCopy: () => void;
    onBatchPaste: () => void;
    onCreateTemplate: (name: string) => void;
    onDeleteSpecificPlants?: (plantIds: string[]) => void;
    onDeleteBranchPipe?: (branchPipeIds: string[]) => void;
    onSegmentedPipeDeletion?: (branchPipeId: string) => void;
    t: (key: string) => string;
}) => {
    const [templateName, setTemplateName] = useState('');

    const totalSelected =
        selectedItems.plants.length + selectedItems.pipes.length + selectedItems.zones.length;

    if (!isOpen || totalSelected === 0) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black bg-opacity-50">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-gray-900 p-6 shadow-2xl">
                <h3 className="mb-4 text-xl font-semibold text-white">
                    🔧 {t('การดำเนินการแบบกลุ่ม')}
                </h3>

                <div className="mb-4 rounded-lg border border-blue-200 bg-gray-900 p-3">
                    <div className="text-sm text-white">
                        <div className="font-medium">{t('รายการที่เลือก')}:</div>
                        <div>
                            • {t('ต้นไม้')}: {selectedItems.plants.length} {t('ต้น')}
                        </div>
                        <div>
                            • {t('ท่อ')}: {selectedItems.pipes.length} {t('เส้น')}
                        </div>
                        <div>
                            • {t('โซน')}: {selectedItems.zones.length} {t('โซน')}
                        </div>
                        <div className="mt-1 font-medium">
                            {t('รวม')}: {totalSelected} {t('รายการ')}
                        </div>
                    </div>
                </div>

                <div className="space-y-4">
                    {selectedItems.plants.length > 0 && onDeleteSpecificPlants && (
                        <div className="rounded-lg border border-orange-200 bg-gray-900 p-4">
                            <h4 className="mb-3 font-medium text-white">🌱 {t('จัดการต้นไม้')}</h4>
                            <button
                                onClick={() => onDeleteSpecificPlants(selectedItems.plants)}
                                className="w-full rounded bg-orange-600 px-3 py-2 text-sm text-white transition-colors hover:bg-orange-700"
                            >
                                🗑️ {t('ลบต้นไม้ที่เลือก')} ({selectedItems.plants.length} {t('ต้น')}
                                )
                            </button>
                            <div className="mt-2 text-xs text-orange-300">
                                * {t('ลบเฉพาะต้นไม้')} {t('ไม่ลบท่อย่อยทั้งเส้น')}
                            </div>
                        </div>
                    )}

                    {selectedItems.pipes.length > 0 && onDeleteBranchPipe && (
                        <div className="rounded-lg border border-red-200 bg-gray-900 p-4">
                            <h4 className="mb-3 font-medium text-white">
                                <img
                                    src="/images/water-pump.png"
                                    alt="Water Pump"
                                    className="mr-1 inline h-4 w-4 object-contain"
                                />
                                {t('จัดการท่อ')}
                            </h4>
                            <div className="space-y-2">
                                <button
                                    onClick={() => onDeleteBranchPipe(selectedItems.pipes)}
                                    className="w-full rounded bg-red-600 px-3 py-2 text-sm text-white transition-colors hover:bg-red-700"
                                >
                                    🗑️ {t('ลบท่อที่เลือก')} ({selectedItems.pipes.length}{' '}
                                    {t('เส้น')})
                                </button>

                                {selectedItems.pipes.length === 1 && onSegmentedPipeDeletion && (
                                    <button
                                        onClick={() =>
                                            onSegmentedPipeDeletion(selectedItems.pipes[0])
                                        }
                                        className="w-full rounded bg-orange-600 px-3 py-2 text-sm text-white transition-colors hover:bg-orange-700"
                                    >
                                        <FaCut className="mr-1 inline" />
                                        {t('ลบท่อระหว่างต้นไม้')}
                                    </button>
                                )}
                            </div>
                            <div className="mt-2 text-xs text-red-300">
                                * {t('ลบท่อย่อยโดยไม่ลบต้นไม้')} {t('หรือลบแค่ส่วนระหว่างต้นไม้')}
                            </div>
                        </div>
                    )}

                    <div className="rounded-lg border border-green-200 bg-gray-900 p-4">
                        <h4 className="mb-3 font-medium text-white">📋 {t('คัดลอกและวาง')}</h4>
                        <div className="flex gap-2">
                            <button
                                onClick={onBatchCopy}
                                className="flex-1 rounded bg-green-600 px-3 py-2 text-sm text-white transition-colors hover:bg-green-700"
                            >
                                <FaCopy className="mr-1 inline" />
                                {t('คัดลอก')}
                            </button>
                            <button
                                onClick={onBatchPaste}
                                className="flex-1 rounded bg-blue-600 px-3 py-2 text-sm text-white transition-colors hover:bg-blue-700"
                            >
                                <FaPaste className="mr-1 inline" />
                                {t('วาง')}
                            </button>
                        </div>
                    </div>

                    <div className="rounded-lg border border-purple-200 bg-gray-900 p-4">
                        <h4 className="mb-3 font-medium text-white">📄 {t('สร้างแม่แบบ')}</h4>
                        <div className="mb-3">
                            <input
                                type="text"
                                value={templateName}
                                onChange={(e) => setTemplateName(e.target.value)}
                                placeholder={t('ชื่อแม่แบบ')}
                                className="w-full rounded border border-gray-300 bg-gray-900 px-3 py-2 text-sm text-white"
                            />
                        </div>
                        <button
                            onClick={() => {
                                if (templateName.trim()) {
                                    onCreateTemplate(templateName);
                                    setTemplateName('');
                                }
                            }}
                            disabled={!templateName.trim()}
                            className="w-full rounded bg-purple-600 px-3 py-2 text-sm text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
                        >
                            <FaMagic className="mr-1 inline" />
                            {t('สร้างแม่แบบ')}
                        </button>
                    </div>

                    <div className="rounded-lg border border-red-200 bg-gray-900 p-4">
                        <h4 className="mb-3 font-medium text-white">🗑️ {t('ลบรายการ')}</h4>
                        <button
                            onClick={onBatchDelete}
                            className="w-full rounded bg-red-600 px-3 py-2 text-sm text-white transition-colors hover:bg-red-700"
                        >
                            <FaTrash className="mr-1 inline" />
                            {t('ลบรายการที่เลือก')} ({totalSelected} {t('รายการ')})
                        </button>
                    </div>
                </div>

                <div className="mt-6 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 rounded bg-gray-600 px-4 py-2 text-white transition-colors hover:bg-gray-700"
                    >
                        {t('ปิด')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const PlantTypeSelectionModal = ({
    isOpen,
    onClose,
    onSinglePlant,
    onMultiplePlants,
    t,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSinglePlant: () => void;
    onMultiplePlants: () => void;
    t: (key: string) => string;
}) => {
    return (
        <div
            className={`fixed inset-0 z-[9999] flex items-center justify-center ${
                isOpen ? 'block' : 'hidden'
            }`}
        >
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
            <div className="relative w-full max-w-lg rounded-lg bg-gray-900 p-6 shadow-xl">
                <div className="mb-6 text-center">
                    <h3 className="text-xl font-semibold text-white">
                        🌱 {t('เลือกประเภทการปลูกพืช')}
                    </h3>
                    <p className="mt-2 text-sm text-gray-300">
                        {t('เลือกว่าต้องการปลูกพืชชนิดเดียวหรือหลายชนิดในพื้นที่นี้')}
                    </p>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <button
                        onClick={onSinglePlant}
                        className="group rounded-lg border-2 border-blue-400 bg-blue-900 p-6 text-center transition-all hover:border-blue-300 hover:bg-blue-800"
                    >
                        <div className="mb-3 text-4xl">🌳</div>
                        <h4 className="mb-2 text-lg font-semibold text-white">
                            {t('ปลูกพืชชนิดเดียว')}
                        </h4>
                        <p className="text-sm text-blue-200">
                            {t('ปลูกพืชชนิดเดียวกันทั้งพื้นที่')}
                        </p>
                        <div className="mt-3 text-xs text-blue-300">
                            {t('เหมาะสำหรับการปลูกพืชเชิงเดี่ยว')}
                        </div>
                    </button>

                    {/* ตัวเลือกพืชหลายชนิด */}
                    <button
                        onClick={onMultiplePlants}
                        className="group rounded-lg border-2 border-purple-400 bg-purple-900 p-6 text-center transition-all hover:border-purple-300 hover:bg-purple-800"
                    >
                        <div className="mb-3 text-4xl">🌿</div>
                        <h4 className="mb-2 text-lg font-semibold text-white">
                            {t('ปลูกพืชหลายชนิด')}
                        </h4>
                        <p className="text-sm text-purple-200">
                            {t('ปลูกพืชหลายชนิดในพื้นที่เดียวกัน')}
                        </p>
                        <div className="mt-3 text-xs text-purple-300">
                            {t('เหมาะสำหรับการปลูกพืชผสมผสาน')}
                        </div>
                    </button>
                </div>

                <div className="mt-6 flex justify-center">
                    <button
                        onClick={onClose}
                        className="rounded-lg border border-gray-600 bg-gray-700 px-6 py-2 text-sm font-medium text-white hover:bg-gray-600"
                    >
                        {t('ยกเลิก')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const PlantAreaSelectionModal = ({
    isOpen,
    onClose,
    onSave,
    availablePlants,
    selectedPlantType,
    onPlantTypeChange,
    onCreateCustomPlant,
    t,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (plantType: PlantData) => void;
    availablePlants: PlantData[];
    selectedPlantType: PlantData;
    onPlantTypeChange: (plantType: PlantData) => void;
    onCreateCustomPlant: () => void;
    t: (key: string) => string;
}) => {
    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center ${
                isOpen ? 'block' : 'hidden'
            }`}
        >
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
            <div className="relative w-full max-w-md rounded-lg bg-gray-900 p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">
                        🌱 {t('เลือกพืชสำหรับพื้นที่ปลูก')}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <FaTimes />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="mb-2 block text-sm font-medium text-white">
                            {t('เลือกพืช')}
                        </label>
                        <select
                            value={selectedPlantType.id}
                            onChange={(e) => {
                                const plantType = availablePlants.find(
                                    (p) => p.id === Number(e.target.value)
                                );
                                if (plantType) {
                                    onPlantTypeChange(plantType);
                                }
                            }}
                            className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            {availablePlants.map((plant) => (
                                <option key={plant.id} value={plant.id}>
                                    {t(plant.name)}
                                </option>
                            ))}
                        </select>

                        <div className="mt-2">
                            <button
                                onClick={onCreateCustomPlant}
                                className="w-full rounded border border-purple-300 bg-purple-100 px-4 py-2 text-sm text-purple-700 transition-colors hover:bg-purple-200"
                            >
                                ➕ {t('เพิ่มพืชใหม่')}
                            </button>
                        </div>
                    </div>

                    <div className="rounded-lg bg-gray-800 p-3">
                        <div className="text-sm text-gray-200">
                            <p className="font-medium">{t('ข้อมูลพืชที่เลือก')}:</p>
                            <ul className="mt-1 space-y-1">
                                <li>
                                    • {t('ระยะปลูก')}: {selectedPlantType.plantSpacing}×
                                    {selectedPlantType.rowSpacing} {t('ม.')}
                                </li>
                                <li>
                                    • {t('น้ำที่ต้องการ')}: {selectedPlantType.waterNeed}{' '}
                                    {t('ล./ต้น/ครั้ง')}
                                </li>
                            </ul>
                        </div>
                    </div>

                    <div className="rounded-lg bg-blue-900 p-3">
                        <div className="text-sm text-blue-200">
                            <p className="font-medium">{t('ข้อมูลพื้นที่ปลูก')}:</p>
                            <ul className="mt-1 space-y-1">
                                <li>• {t('เลือกพืชที่ต้องการปลูกในพื้นที่นี้')}</li>
                                <li>• {t('ระบบจะใช้ข้อมูลระยะห่างและน้ำที่ต้องการของพืชนี้')}</li>
                                <li>• {t('สามารถเพิ่มพืชใหม่ได้หากไม่มีในรายการ')}</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex space-x-3">
                    <button
                        onClick={onCreateCustomPlant}
                        className="flex-1 rounded-lg border border-purple-400 bg-purple-800 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
                    >
                        ➕ {t('เพิ่มพืชใหม่')}
                    </button>
                </div>

                <div className="mt-4 flex space-x-3">
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600"
                    >
                        {t('ยกเลิก')}
                    </button>
                    <button
                        onClick={() => onSave(selectedPlantType)}
                        className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                        🌱 {t('บันทึกพืช')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const PlantGenerationModal = ({
    isOpen,
    onClose,
    onGenerate,
    settings,
    onSettingsChange,
    availablePlants,
    selectedPlantType,
    onPlantTypeChange,
    onCreateCustomPlant,
    onEditPlant,
    plantSelectionMode,
    plantAreas,
    t,
}: {
    isOpen: boolean;
    onClose: () => void;
    onGenerate: () => void;
    settings: PlantGenerationSettings;
    onSettingsChange: (settings: PlantGenerationSettings) => void;
    availablePlants: PlantData[];
    selectedPlantType: PlantData;
    onPlantTypeChange: (plantType: PlantData) => void;
    onCreateCustomPlant: () => void;
    onEditPlant: (plantData: PlantData) => void;
    plantSelectionMode: PlantSelectionMode;
    plantAreas: PlantArea[];
    t: (key: string) => string;
}) => {
    return (
        <div
            className={`fixed inset-0 z-[9990] flex items-center justify-center ${
                isOpen ? 'block' : 'hidden'
            }`}
        >
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
            <div className="relative w-full max-w-md rounded-lg bg-gray-900 p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">
                        🌱 {t('สร้างต้นไม้อัตโนมัติ')}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <FaTimes />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* เลือกพืช (เฉพาะกรณีพืชเดียว) */}
                    {plantSelectionMode.type === 'single' && (
                        <div>
                            <label className="mb-2 block text-sm font-medium text-white">
                                {t('เลือกพืช')}
                            </label>

                            {/* แสดงรายการพืชพร้อมปุ่มแก้ไข */}
                            <div className="max-h-60 space-y-2 overflow-y-auto rounded border border-gray-600 bg-gray-800 p-3">
                                {availablePlants.map((plantData) => (
                                    <div key={plantData.id} className="relative">
                                        <button
                                            onClick={() => onPlantTypeChange(plantData)}
                                            className={`w-full rounded p-2 text-left text-sm transition-colors ${
                                                selectedPlantType?.id === plantData.id
                                                    ? 'bg-green-600 text-white'
                                                    : 'bg-gray-700 text-white hover:bg-gray-600'
                                            }`}
                                        >
                                            <div className="font-semibold">{t(plantData.name)}</div>
                                            <div className="text-xs text-gray-300">
                                                {t('ระยะปลูก')}: {plantData.plantSpacing}×
                                                {plantData.rowSpacing} {t('ม.')} |{t('น้ำ')}:{' '}
                                                {plantData.waterNeed} {t('ล./ครั้ง')}
                                            </div>
                                        </button>
                                        {/* ปุ่มแก้ไขสำหรับพืชทุกชนิด */}
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                onEditPlant(plantData);
                                            }}
                                            className="absolute right-1 top-1 rounded bg-yellow-600 p-1 text-xs text-white hover:bg-yellow-700"
                                            title={t('แก้ไขพืช')}
                                        >
                                            ✏️
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* แสดงข้อมูลพืชที่เลือก (สำหรับพืชหลายชนิด) */}
                    {plantSelectionMode.type === 'multiple' && (
                        <div className="rounded-lg bg-purple-900 p-3">
                            <div className="text-sm text-purple-200">
                                <p className="font-medium">{t('ข้อมูลพืชหลายชนิด')}:</p>
                                <ul className="mt-1 space-y-1">
                                    {plantAreas.map((area) => (
                                        <li key={area.id}>
                                            • {t(area.plantData.name)}:{' '}
                                            {area.plantData.plantSpacing}×
                                            {area.plantData.rowSpacing} {t('ม.')} |{' '}
                                            {area.plantData.waterNeed} {t('ล./ต้น/ครั้ง')}
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* ข้อมูลพืชที่เลือก */}
                    <div className="rounded-lg bg-gray-800 p-3">
                        <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-200">{t('ระยะห่างต้น')}:</span>
                                <span className="font-medium text-white">
                                    {selectedPlantType.plantSpacing} {t('ม')}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-200">{t('ระยะห่างแถว')}:</span>
                                <span className="font-medium text-white">
                                    {selectedPlantType.rowSpacing} {t('ม')}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-200">{t('น้ำต่อต้น')}:</span>
                                <span className="font-medium text-white">
                                    {selectedPlantType.waterNeed} {t('ล./ครั้ง')}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* ปุ่มเพิ่มพืชใหม่ */}
                    <button
                        onClick={onCreateCustomPlant}
                        className="w-full rounded border border-purple-300 bg-purple-100 px-4 py-2 text-sm text-purple-700 transition-colors hover:bg-purple-200"
                    >
                        ➕ {t('เพิ่มพืชใหม่')}
                    </button>

                    {/* รูปแบบการวาง */}
                    <div>
                        <label className="mb-2 block text-sm font-medium text-white">
                            {t('รูปแบบการวาง')}
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                            <label
                                className={`flex cursor-pointer flex-col items-center rounded-lg p-2 transition-colors ${
                                    settings.layoutPattern === 'grid'
                                        ? 'border-2 border-blue-400 bg-blue-800'
                                        : 'border border-gray-700 bg-gray-800'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="layoutPattern"
                                    value="grid"
                                    checked={settings.layoutPattern === 'grid'}
                                    onChange={(e) =>
                                        onSettingsChange({
                                            ...settings,
                                            layoutPattern: e.target.value as 'grid' | 'staggered',
                                        })
                                    }
                                    className="hidden"
                                />
                                <img
                                    src="/images/grid.png"
                                    alt={t('แบบกริด')}
                                    className="h-20 w-20 rounded border border-gray-400 bg-white object-contain"
                                />
                                <span className="mt-2 text-sm text-gray-200">{t('แบบกริด')}</span>
                            </label>
                            <label
                                className={`flex cursor-pointer flex-col items-center rounded-lg p-2 transition-colors ${
                                    settings.layoutPattern === 'staggered'
                                        ? 'border-2 border-blue-400 bg-blue-800'
                                        : 'border border-gray-700 bg-gray-800'
                                }`}
                            >
                                <input
                                    type="radio"
                                    name="layoutPattern"
                                    value="staggered"
                                    checked={settings.layoutPattern === 'staggered'}
                                    onChange={(e) =>
                                        onSettingsChange({
                                            ...settings,
                                            layoutPattern: e.target.value as 'grid' | 'staggered',
                                        })
                                    }
                                    className="hidden"
                                />
                                <img
                                    src="/images/staggered.png"
                                    alt={t('แบบสลับฟันปลา')}
                                    className="h-20 w-20 rounded border border-gray-400 bg-white object-contain"
                                />
                                <span className="mt-2 text-sm text-gray-200">
                                    {t('แบบสลับฟันปลา')}
                                </span>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex space-x-3">
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600"
                    >
                        {t('ยกเลิก')}
                    </button>
                    <button
                        onClick={onGenerate}
                        disabled={settings.isGenerating}
                        className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                    >
                        {settings.isGenerating ? (
                            <span className="flex items-center justify-center">
                                <svg className="mr-2 h-4 w-4 animate-spin" viewBox="0 0 24 24">
                                    <circle
                                        className="opacity-25"
                                        cx="12"
                                        cy="12"
                                        r="10"
                                        stroke="currentColor"
                                        strokeWidth="4"
                                    />
                                    <path
                                        className="opacity-75"
                                        fill="currentColor"
                                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                    />
                                </svg>
                                {t('กำลังสร้าง...')}
                            </span>
                        ) : (
                            `🌱 ${t('สร้างต้นไม้')}`
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ManualZoneInfoModal: React.FC<{
    isOpen: boolean;
    onClose: () => void;
    zone: ManualIrrigationZone | null;
    targetWaterPerZone: number;
    numberOfZones: number;
    onAccept: () => void;
    onRedraw: () => void;
    t: (key: string) => string;
}> = ({ isOpen, onClose, zone, targetWaterPerZone, numberOfZones, onAccept, onRedraw, t }) => {
    if (!zone) return null;

    const waterDifference = zone.totalWaterNeed - targetWaterPerZone;
    const isOverTarget = waterDifference > 0;

    const isPerfect = Math.abs(waterDifference) < 0.1;

    return (
        <div
            className={`fixed inset-0 z-[9999] flex items-center justify-center ${
                isOpen ? 'block' : 'hidden'
            }`}
        >
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
            <div className="relative w-full max-w-md rounded-lg bg-gray-900 p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">📊 {t('ข้อมูลโซนที่วาด')}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <FaTimes />
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="rounded-lg border border-gray-600 p-4">
                        <h4 className="mb-3 font-medium text-white">
                            {zone.name} ({zone.zoneIndex + 1} / {numberOfZones})
                        </h4>

                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-300">{t('จำนวนต้นไม้')}:</span>
                                <span className="font-medium text-white">
                                    {zone.plants.length} {t('ต้น')}
                                </span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-300">{t('ความต้องการน้ำต่อต้น')}:</span>
                                <span className="font-medium text-white">
                                    {formatWaterVolume(zone.plants[0]?.plantData.waterNeed || 0, t)}
                                </span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-300">{t('ความต้องการน้ำทั้งหมด')}:</span>
                                <span className="font-medium text-white">
                                    {(() => {
                                        const config = loadSprinklerConfig();
                                        return formatWaterVolumeWithFlowRate(
                                            zone.totalWaterNeed,
                                            zone.plants.length,
                                            config,
                                            t
                                        );
                                    })()}
                                </span>
                            </div>

                            <div className="flex justify-between">
                                <span className="text-gray-300">{t('เป้าหมายต่อโซน')}:</span>
                                <span className="font-medium text-white">
                                    {formatWaterVolume(targetWaterPerZone, t)}
                                </span>
                            </div>

                            {zone.areaInRai && (
                                <div className="flex justify-between">
                                    <span className="text-gray-300">{t('พื้นที่โซน')}:</span>
                                    <span className="font-medium text-white">
                                        {zone.areaInRai.toFixed(2)} {t('ไร่')}
                                    </span>
                                </div>
                            )}

                            {zone.waterFlowRate && (
                                <div className="flex justify-between">
                                    <span className="text-gray-300">{t('อัตราการไหลน้ำ')}:</span>
                                    <span className="font-medium text-white">
                                        {zone.waterFlowRate.toLocaleString()} {t('ลิตร/นาที')}
                                    </span>
                                </div>
                            )}

                            {zone.bestPipeInfo && (
                                <div className="flex justify-between">
                                    <span className="text-gray-300">{t('ความยาวท่อประมาณ')}:</span>
                                    <span className="font-medium text-white">
                                        {zone.bestPipeInfo.totalLength.toFixed(1)} {t('เมตร')}
                                    </span>
                                </div>
                            )}
                        </div>
                    </div>

                    <div
                        className={`rounded-lg p-3 ${
                            isPerfect
                                ? 'bg-green-900'
                                : isOverTarget
                                  ? 'bg-yellow-900'
                                  : 'bg-red-900'
                        }`}
                    >
                        <div
                            className={`text-sm ${
                                isPerfect
                                    ? 'text-green-200'
                                    : isOverTarget
                                      ? 'text-yellow-200'
                                      : 'text-red-200'
                            }`}
                        >
                            {isPerfect ? (
                                <p className="font-medium">✅ {t('ปริมาณน้ำเหมาะสม')}</p>
                            ) : isOverTarget ? (
                                <p className="font-medium">
                                    ⚠️ {t('ปริมาณน้ำมากกว่าที่ควร')}{' '}
                                    {formatWaterVolume(Math.abs(waterDifference), t)}
                                </p>
                            ) : (
                                <p className="font-medium">
                                    ⚠️ {t('ปริมาณน้ำน้อยกว่าที่ควร')}{' '}
                                    {formatWaterVolume(Math.abs(waterDifference), t)}
                                </p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex space-x-3">
                    <button
                        onClick={onRedraw}
                        className="flex-1 rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600"
                    >
                        ✏️ {t('วาดใหม่')}
                    </button>
                    <button
                        onClick={onAccept}
                        className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                    >
                        ✅ {t('ยอมรับ')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ManualZoneDrawingManager: React.FC<{
    onDrawingComplete: (coordinates: Coordinate[], shapeType: string) => void;
    onCancel: () => void;
    t: (key: string) => string;
    currentZoneIndex?: number;
    totalZones?: number;
    manualZones?: ManualIrrigationZone[];
}> = ({
    // onDrawingComplete,
    onCancel,
    t,
    currentZoneIndex = 0,
    totalZones = 0,
    manualZones = [],
}) => {
    return (
        <div className="fixed right-2 top-[190px] z-[9999] w-80 rounded-lg border border-gray-600 bg-gray-900 p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
                <h3 className="text-lg font-semibold text-white">✏️ {t('วาดโซน')}</h3>
                <button onClick={onCancel} className="text-gray-400 hover:text-white">
                    <FaTimes />
                </button>
            </div>

            <div className="space-y-3">
                <div className="rounded-lg bg-blue-900 p-2">
                    <div className="flex items-center justify-between space-x-3">
                        <p className="text-sm text-blue-200">{t('ลากเพื่อวาดโซน')}</p>
                        <p className="mt-0 text-xs text-blue-300">
                            {t('โซนที่')} {currentZoneIndex + 1} / {totalZones}
                        </p>
                    </div>
                </div>

                {/* แสดงโซนที่วาดแล้ว */}
                {manualZones.length > 0 && (
                    <div className="mt-2 space-y-1">
                        {manualZones.map((zone) => {
                            const plantSummary: Record<
                                string,
                                { count: number; totalWater: number }
                            > = {};
                            let totalPlantCount = 0;
                            let totalWaterNeed = 0;
                            zone.plants.forEach((plant) => {
                                const name = plant.plantData.name;
                                const waterNeed = Number(plant.plantData.waterNeed) || 0;
                                if (!plantSummary[name]) {
                                    plantSummary[name] = { count: 0, totalWater: 0 };
                                }
                                plantSummary[name].count += 1;
                                plantSummary[name].totalWater += waterNeed;
                                totalPlantCount += 1;
                                totalWaterNeed += waterNeed;
                            });
                            // const plantNames = Object.keys(plantSummary);

                            return (
                                <div key={zone.id} className="flex flex-col text-xs">
                                    <div className="mb-1 flex items-center justify-between space-x-2 rounded-lg bg-gray-800 p-2">
                                        <div className="flex items-center space-x-2">
                                            <div
                                                className="h-3 w-3 rounded"
                                                style={{ backgroundColor: zone.color }}
                                            ></div>
                                            <span
                                                className={`text-${zone.color}-700 font-semibold`}
                                            >
                                                {zone.name}
                                            </span>
                                        </div>
                                        {/* รวมจำนวนต้นไม้และใช้น้ำรวม */}
                                        <div className="flex flex-row items-center space-x-3">
                                            <span className="font-semibold text-white">
                                                {(() => {
                                                    const config = loadSprinklerConfig();
                                                    return formatWaterVolumeWithFlowRate(
                                                        totalWaterNeed,
                                                        totalPlantCount,
                                                        config,
                                                        t
                                                    );
                                                })()}
                                            </span>
                                        </div>
                                    </div>
                                    {/* <div className="ml-5 flex flex-col space-y-1">
                                            {plantNames.length === 0 ? (
                                                <span className="text-gray-400">
                                                    - ไม่มีพืชในโซนนี้ -
                                                </span>
                                            ) : (
                                                plantNames.map((name, index) => (
                                                    <span key={name} className="text-white">
                                                        {index + 1}. {name}{' '}
                                                        {plantSummary[name].count.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}{' '}
                                                        ต้น - ใช้น้ำ{' '}
                                                        {(() => {
                                                            const config = loadSprinklerConfig();
                                                            return formatWaterVolumeWithFlowRate(
                                                                plantSummary[name].totalWater, 
                                                                plantSummary[name].count, 
                                                                config, 
                                                                t
                                                            );
                                                        })()}
                                                    </span>
                                                ))
                                            )}
                                        </div> */}
                                </div>
                            );
                        })}
                    </div>
                )}

                <div className="flex space-x-2">
                    <button
                        onClick={onCancel}
                        className="flex-1 rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-sm font-medium text-white hover:bg-gray-600"
                    >
                        {t('ยกเลิก')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const ManualIrrigationZoneModal = ({
    isOpen,
    onClose,
    numberOfZones,
    onNumberOfZonesChange,
    onStartDrawing,
    t,
}: {
    isOpen: boolean;
    onClose: () => void;
    numberOfZones: number;
    onNumberOfZonesChange: (number: number) => void;
    onStartDrawing: () => void;
    t: (key: string) => string;
}) => {
    return (
        <div
            className={`fixed inset-0 z-[9999] flex items-center justify-center ${
                isOpen ? 'block' : 'hidden'
            }`}
        >
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
            <div className="relative w-full max-w-md rounded-lg bg-gray-900 p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">💧 {t('แบ่งโซนน้ำเอง')}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <FaTimes />
                    </button>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="mb-2 block text-sm font-medium text-white">
                            {t('จำนวนโซนที่ต้องการ')}
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="20"
                            step="1"
                            value={numberOfZones}
                            onChange={(e) => onNumberOfZonesChange(parseInt(e.target.value) || 1)}
                            className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    <div className="rounded-lg bg-blue-900 p-3">
                        <div className="text-sm text-blue-200">
                            <p className="font-medium">{t('หลักการแบ่งโซนน้ำเอง')}:</p>
                            <ul className="mt-1 space-y-1">
                                <li>• {t('ระบบจะคำนวณปริมาณน้ำที่ต้องการทั้งหมดหารจำนวนโซน')}</li>
                                <li>• {t('คุณจะวาดโซนทีละโซนตามต้องการ')}</li>
                                <li>
                                    •{' '}
                                    {t(
                                        'ระบบจะแจ้งเตือนว่าปริมาณน้ำในโซนที่วาดมากหรือน้อยกว่าที่ควร'
                                    )}
                                </li>
                                <li>• {t('สามารถยอมรับหรือวาดใหม่ได้ตามต้องการ')}</li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex space-x-3">
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-sm font-medium text-white hover:bg-gray-600"
                    >
                        {t('ยกเลิก')}
                    </button>
                    <button
                        onClick={onStartDrawing}
                        className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                        ✏️ {t('เริ่มวาดโซน')}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Auto Zone Modal
const AutoZoneModal = ({
    isOpen,
    onClose,
    config,
    onConfigChange,
    onCreateZones,
    onRegenerateZones,
    isCreating,
    hasExistingZones,
    totalPlants,
    totalWaterNeed,
    t,
}: {
    isOpen: boolean;
    onClose: () => void;
    config: AutoZoneConfig;
    onConfigChange: (config: AutoZoneConfig) => void;
    onCreateZones: () => void;
    onRegenerateZones?: () => void;
    isCreating: boolean;
    hasExistingZones: boolean;
    totalPlants: number;
    totalWaterNeed: number;
    t: (key: string) => string;
}) => {
    if (!isOpen) return null;

    const averageWaterPerZone =
        config.numberOfZones > 0 ? totalWaterNeed / config.numberOfZones : 0;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
            <div className="relative w-full max-w-lg rounded-lg bg-gray-900 p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">🤖 {t('แบ่งโซนอัตโนมัติ')}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <FaTimes />
                    </button>
                </div>

                <div className="space-y-4">
                    {/* จำนวนโซน */}
                    <div>
                        <label className="mb-2 block text-sm font-medium text-white">
                            {t('จำนวนโซนที่ต้องการ')}
                        </label>
                        <input
                            type="number"
                            min="2"
                            max={Math.min(totalPlants, 20)}
                            step="1"
                            value={config.numberOfZones === 0 ? '' : config.numberOfZones}
                            onChange={(e) => {
                                const val = e.target.value;
                                // Allow empty string for clearing input
                                if (val === '') {
                                    onConfigChange({
                                        ...config,
                                        numberOfZones: 0,
                                    });
                                } else {
                                    const num = parseInt(val, 10);
                                    onConfigChange({
                                        ...config,
                                        numberOfZones: Math.max(
                                            2,
                                            Math.min(isNaN(num) ? 2 : num, totalPlants)
                                        ),
                                    });
                                }
                            }}
                            className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                        />
                        <p className="mt-1 text-xs text-gray-400">
                            {t('สูงสุด')} {Math.min(totalPlants, 20)} {t('โซน')}
                        </p>
                    </div>

                    {/* ตัวเลือกการสมดุล */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-white">{t('รูปแบบการแบ่งโซน')}</h4>

                        {/* สมดุลจำนวนต้นไม้ */}
                        <div>
                            <label className="flex items-center space-x-2">
                                <input
                                    type="radio"
                                    name="balanceMode"
                                    checked={config.balancePlantCount}
                                    onChange={(e) =>
                                        onConfigChange({
                                            ...config,
                                            balancePlantCount: e.target.checked,
                                            balanceWaterNeed: false,
                                        })
                                    }
                                    className="border-gray-600 bg-gray-800 text-green-600 focus:ring-green-500"
                                />
                                <span className="text-sm text-white">
                                    🌱 {t('สมดุลจำนวนต้นไม้ในแต่ละโซน')}
                                </span>
                            </label>
                            <p className="ml-6 mt-1 text-xs text-gray-400">
                                {t('แต่ละโซนจะมีจำนวนต้นไม้เท่ากันหรือใกล้เคียงกัน')}
                            </p>
                        </div>

                        {/* สมดุลปริมาณน้ำ */}
                        <div>
                            <label className="flex items-center space-x-2">
                                <input
                                    type="radio"
                                    name="balanceMode"
                                    checked={config.balanceWaterNeed}
                                    onChange={(e) =>
                                        onConfigChange({
                                            ...config,
                                            balanceWaterNeed: e.target.checked,
                                            balancePlantCount: false,
                                        })
                                    }
                                    className="border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-white">
                                    💧 {t('สมดุลปริมาณน้ำในแต่ละโซน')}
                                </span>
                            </label>
                            <p className="ml-6 mt-1 text-xs text-gray-400">
                                {t('แต่ละโซนจะมีปริมาณน้ำใกล้เคียงกัน')}
                            </p>
                        </div>

                        {/* แบ่งตามตำแหน่งเท่านั้น */}
                        <div>
                            <label className="flex items-center space-x-2">
                                <input
                                    type="radio"
                                    name="balanceMode"
                                    checked={!config.balanceWaterNeed && !config.balancePlantCount}
                                    onChange={() =>
                                        onConfigChange({
                                            ...config,
                                            balanceWaterNeed: false,
                                            balancePlantCount: false,
                                        })
                                    }
                                    className="border-gray-600 bg-gray-800 text-purple-600 focus:ring-purple-500"
                                />
                                <span className="text-sm text-white">
                                    📍 {t('แบ่งโซนตามตำแหน่งเท่านั้น')}
                                </span>
                            </label>
                            <p className="ml-6 mt-1 text-xs text-gray-400">
                                {t('แบ่งโซนตามตำแหน่งที่ใกล้กันโดยไม่สนใจจำนวนต้นไม้หรือปริมาณน้ำ')}
                            </p>
                        </div>
                    </div>

                    {/* วิธีการสร้างโซน */}
                    <div>
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={config.useVoronoi}
                                onChange={(e) =>
                                    onConfigChange({
                                        ...config,
                                        useVoronoi: e.target.checked,
                                    })
                                }
                                className="rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-white">
                                {t('ใช้วิธี Voronoi (ครอบคลุมพื้นที่เต็ม)')}
                            </span>
                        </label>
                        <div className="mt-1 text-xs text-gray-400">
                            {config.balancePlantCount ? (
                                <div className="space-y-1">
                                    <p>
                                        🌱 <strong>สำหรับสมดุลจำนวนต้นไม้:</strong>
                                    </p>
                                    <p>
                                        • ✅ <strong>เปิด Voronoi:</strong> โซนแยกกันชัดเจน +
                                        รักษาจำนวนต้นไม้ (แนะนำ)
                                    </p>
                                    <p>
                                        • ⚠️ <strong>ปิด Voronoi:</strong> โซนอาจทับกัน
                                        แต่ครอบคลุมเฉพาะต้นไม้ที่แบ่ง
                                    </p>
                                </div>
                            ) : (
                                <p>{t('แนะนำ: ทำให้โซนครอบคลุมพื้นที่หลักทั้งหมด')}</p>
                            )}
                        </div>
                    </div>

                    {/* ระยะห่างขอบโซน - แสดงเฉพาะเมื่อไม่ใช้ Voronoi */}
                    {!config.useVoronoi && (
                        <div>
                            <label className="mb-2 block text-sm font-medium text-white">
                                {t('ระยะห่างขอบโซน')} (เมตร)
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="10"
                                step="0.5"
                                value={config.paddingMeters}
                                onChange={(e) =>
                                    onConfigChange({
                                        ...config,
                                        paddingMeters: Math.max(
                                            0,
                                            Math.min(parseFloat(e.target.value) || 0, 10)
                                        ),
                                    })
                                }
                                className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                            />
                            <p className="mt-1 text-xs text-gray-400">
                                {t('ระยะห่างจากต้นไม้ถึงขอบโซน (0-10 เมตร)')}
                            </p>
                        </div>
                    )}

                    {/* โหมด Debug */}
                    <div>
                        <label className="flex items-center space-x-2">
                            <input
                                type="checkbox"
                                checked={config.debugMode}
                                onChange={(e) =>
                                    onConfigChange({
                                        ...config,
                                        debugMode: e.target.checked,
                                    })
                                }
                                className="rounded border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-white">{t('แสดงข้อมูล Debug')}</span>
                        </label>
                        <p className="mt-1 text-xs text-gray-400">
                            {t('แสดงรายละเอียดการประมวลผลและสถิติ')}
                        </p>
                    </div>

                    {/* ข้อมูลสรุป */}
                    <div className="rounded-lg bg-blue-900 p-3">
                        <div className="text-sm text-blue-200">
                            <p className="font-medium">{t('ข้อมูลสรุป')}:</p>
                            <ul className="mt-1 space-y-1">
                                <li>
                                    • {t('ต้นไม้ทั้งหมด')}: {totalPlants} {t('ต้น')}
                                </li>
                                <li>
                                    • {t('ปริมาณน้ำรวม')}:{' '}
                                    {(() => {
                                        const config = loadSprinklerConfig();
                                        return formatWaterVolumeWithFlowRate(
                                            totalWaterNeed,
                                            totalPlants,
                                            config,
                                            t
                                        );
                                    })()}
                                </li>
                                <li>
                                    • {t('ปริมาณน้ำเฉลี่ยต่อโซน')}: {averageWaterPerZone.toFixed(2)}{' '}
                                    {t('ลิตร/ครั้ง')}
                                </li>
                            </ul>
                        </div>
                    </div>

                    {/* คำอธิบายวิธีการ */}
                    {/* <div className="rounded-lg bg-green-900 p-3">
                        <div className="text-sm text-green-200">
                            <p className="font-medium">{t('วิธีการแบ่งโซน')}:</p>
                            <ul className="mt-1 space-y-1">
                                <li>• {t('ใช้อัลกอริทึม K-means จัดกลุ่มต้นไม้')}</li>
                                {config.useVoronoi ? (
                                    <>
                                        <li>• {t('สร้างตาราง Voronoi ครอบคลุมพื้นที่เต็ม')}</li>
                                        <li>• {t('แบ่งโซนตามระยะใกล้สุดจากจุดศูนย์กลาง')}</li>
                                    </>
                                ) : (
                                    <>
                                        <li>• {t('สร้าง Convex Hull รอบกลุ่มต้นไม้')}</li>
                                        <li>• {t('เพิ่ม padding รอบขอบโซน')}</li>
                                    </>
                                )}
                                <li>• {t('ตัดโซนให้อยู่ในพื้นที่หลัก')}</li>
                                <li>• {t('ปรับสมดุลปริมาณน้ำระหว่างโซน')}</li>
                                <li>• {t('ตรวจสอบไม่ให้โซนทับกันหรือเกินพื้นที่')}</li>
                            </ul>
                        </div>
                    </div> */}
                </div>

                <div className="mt-6 flex space-x-3">
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-lg border border-gray-600 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800"
                    >
                        {t('ยกเลิก')}
                    </button>

                    {/* แสดงปุ่ม "เปลี่ยนรูปแบบโซน" เมื่อมีโซนอยู่แล้ว */}
                    {hasExistingZones && onRegenerateZones && (
                        <button
                            onClick={onRegenerateZones}
                            disabled={isCreating || totalPlants === 0}
                            className="flex-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-600"
                        >
                            {isCreating ? (
                                <>
                                    <span className="mr-2 animate-spin">⚙️</span>
                                    {t('กำลังสร้าง...')}
                                </>
                            ) : (
                                <>🔄 {t('เปลี่ยนแบบโซน')}</>
                            )}
                        </button>
                    )}

                    <button
                        onClick={onCreateZones}
                        disabled={isCreating || totalPlants === 0}
                        className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-600"
                    >
                        {isCreating ? (
                            <>
                                <span className="mr-2 animate-spin">⚙️</span>
                                {t('กำลังสร้าง...')}
                            </>
                        ) : (
                            <>🤖 {t(hasExistingZones ? 'สร้างโซนใหม่' : 'สร้างโซนอัตโนมัติ')}</>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Auto Zone Debug Modal
const AutoZoneDebugModal = ({
    isOpen,
    onClose,
    result,
    t,
}: {
    isOpen: boolean;
    onClose: () => void;
    result: AutoZoneResult | null;
    t: (key: string) => string;
}) => {
    if (!isOpen || !result) return null;

    const { debugInfo, zones } = result;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
            <div className="relative max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-lg bg-gray-900 p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">
                        🔍 {t('ข้อมูล Debug การแบ่งโซน')}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <FaTimes />
                    </button>
                </div>

                <div className="space-y-6">
                    {/* สถิติรวม */}
                    <div className="rounded-lg bg-blue-900 p-4">
                        <h4 className="mb-3 font-medium text-blue-200">
                            {t('สถิติรวม')}
                            <span className="ml-2 text-xs text-blue-300">
                                (ข้อมูลจากโซนจริงบนแผนที่)
                            </span>
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-blue-300">
                                    {t('ต้นไม้ทั้งหมด')}:{' '}
                                    <span className="text-white">{debugInfo.totalPlants}</span>
                                </p>
                                <p className="text-blue-300">
                                    {t('ต้นไม้ในโซน')}:{' '}
                                    <span className="text-white">
                                        {zones.reduce((sum, zone) => sum + zone.plants.length, 0)}
                                    </span>
                                </p>
                                <p className="text-blue-300">
                                    {t('ปริมาณน้ำรวม')}:{' '}
                                    <span className="text-white">
                                        {(() => {
                                            const config = loadSprinklerConfig();
                                            const actualPlantsInZones = zones.reduce(
                                                (sum, zone) => sum + zone.plants.length,
                                                0
                                            );
                                            const actualTotalWaterNeed = zones.reduce(
                                                (sum, zone) => sum + zone.totalWaterNeed,
                                                0
                                            );
                                            return formatWaterVolumeWithFlowRate(
                                                actualTotalWaterNeed,
                                                actualPlantsInZones,
                                                config,
                                                t
                                            );
                                        })()}
                                    </span>
                                </p>
                                <p className="text-blue-300">
                                    {t('เวลาประมวลผล')}:{' '}
                                    <span className="text-white">{debugInfo.timeTaken} ms</span>
                                </p>
                            </div>
                            <div>
                                <p className="text-blue-300">
                                    {t('ปริมาณน้ำเฉลี่ย')}:{' '}
                                    <span className="text-white">
                                        {(() => {
                                            const actualTotalWaterNeed = zones.reduce(
                                                (sum, zone) => sum + zone.totalWaterNeed,
                                                0
                                            );
                                            const actualAverageWaterNeed =
                                                zones.length > 0
                                                    ? actualTotalWaterNeed / zones.length
                                                    : 0;
                                            return actualAverageWaterNeed.toFixed(2);
                                        })()}{' '}
                                        ลิตร/ครั้ง
                                    </span>
                                </p>
                                <p className="text-blue-300">
                                    {t('ความแปรปรวน')}:{' '}
                                    <span className="text-white">
                                        {(() => {
                                            const waterNeeds = zones.map(
                                                (zone) => zone.totalWaterNeed
                                            );
                                            const mean =
                                                waterNeeds.reduce((sum, need) => sum + need, 0) /
                                                waterNeeds.length;
                                            const variance =
                                                waterNeeds.reduce(
                                                    (sum, need) => sum + Math.pow(need - mean, 2),
                                                    0
                                                ) / waterNeeds.length;
                                            return variance.toFixed(4);
                                        })()}
                                    </span>
                                </p>
                                <p className="text-blue-300">
                                    {t('จำนวนโซน')}:{' '}
                                    <span className="text-white">{zones.length}</span>
                                </p>
                                <p className="text-blue-300">
                                    {t('การแจกแจงต้นไม้')}:{' '}
                                    <span className="text-white">
                                        {(() => {
                                            const plantCounts = zones.map(
                                                (zone) => zone.plants.length
                                            );
                                            const minCount = Math.min(...plantCounts);
                                            const maxCount = Math.max(...plantCounts);
                                            return `${minCount}-${maxCount} ต้น/โซน`;
                                        })()}
                                    </span>
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* รายละเอียดแต่ละโซน */}
                    <div className="rounded-lg bg-green-900 p-4">
                        <h4 className="mb-3 font-medium text-green-200">
                            {t('รายละเอียดแต่ละโซน')}
                        </h4>
                        <div className="space-y-2">
                            {zones.map((zone) => (
                                <div
                                    key={zone.id}
                                    className="flex items-center justify-between rounded bg-green-800 p-2 text-sm"
                                >
                                    <div className="flex items-center space-x-3">
                                        <div
                                            className="h-4 w-4 rounded"
                                            style={{ backgroundColor: zone.color }}
                                        ></div>
                                        <span className="text-green-100">{zone.name}</span>
                                    </div>
                                    <div className="text-green-200">
                                        {zone.plants.length} ต้น |{' '}
                                        {(() => {
                                            const config = loadSprinklerConfig();
                                            return formatWaterVolumeWithFlowRate(
                                                zone.totalWaterNeed,
                                                zone.plants.length,
                                                config,
                                                t
                                            );
                                        })()}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* เปรียบเทียบข้อมูล Clustering vs โซนจริง */}
                    <div className="rounded-lg bg-yellow-900 p-4">
                        <h4 className="mb-3 font-medium text-yellow-200">
                            🔍 {t('เปรียบเทียบข้อมูล Clustering vs โซนจริง')}
                        </h4>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                            <div className="rounded bg-yellow-800 p-3">
                                <h5 className="mb-2 font-medium text-yellow-200">
                                    📊 ข้อมูลจาก Clustering Algorithm
                                </h5>
                                <p className="text-yellow-300">
                                    ต้นไม้รวม:{' '}
                                    <span className="text-white">{debugInfo.totalPlants}</span>
                                </p>
                                <p className="text-yellow-300">
                                    ปริมาณน้ำรวม:{' '}
                                    <span className="text-white">
                                        {debugInfo.totalWaterNeed.toFixed(2)} ลิตร
                                    </span>
                                </p>
                                <p className="text-yellow-300">
                                    เฉลี่ย/โซน:{' '}
                                    <span className="text-white">
                                        {debugInfo.averageWaterNeedPerZone.toFixed(2)} ลิตร
                                    </span>
                                </p>
                            </div>
                            <div className="rounded bg-green-800 p-3">
                                <h5 className="mb-2 font-medium text-green-200">
                                    🗺️ ข้อมูลจากโซนจริงบนแผนที่
                                </h5>
                                <p className="text-green-300">
                                    ต้นไม้รวม:{' '}
                                    <span className="text-white">
                                        {zones.reduce((sum, zone) => sum + zone.plants.length, 0)}
                                    </span>
                                </p>
                                <p className="text-green-300">
                                    ปริมาณน้ำรวม:{' '}
                                    <span className="text-white">
                                        {zones
                                            .reduce((sum, zone) => sum + zone.totalWaterNeed, 0)
                                            .toFixed(2)}{' '}
                                        ลิตร
                                    </span>
                                </p>
                                <p className="text-green-300">
                                    เฉลี่ย/โซน:{' '}
                                    <span className="text-white">
                                        {(() => {
                                            const actualTotal = zones.reduce(
                                                (sum, zone) => sum + zone.totalWaterNeed,
                                                0
                                            );
                                            return zones.length > 0
                                                ? (actualTotal / zones.length).toFixed(2)
                                                : '0.00';
                                        })()}{' '}
                                        ลิตร
                                    </span>
                                </p>
                            </div>
                        </div>
                        <div className="mt-3 text-xs text-yellow-300">
                            💡 <strong>หมายเหตุ:</strong> ความแตกต่างเกิดจากการที่ Voronoi diagram
                            อาจจัดกลุ่มต้นไม้ต่างจาก Clustering algorithm
                        </div>

                        {/* รายละเอียดเปรียบเทียบแต่ละโซน */}
                        <div className="mt-4">
                            <h5 className="mb-2 font-medium text-yellow-200">
                                📋 เปรียบเทียบรายโซน
                            </h5>
                            <div className="space-y-2">
                                {zones.map((zone, index) => {
                                    // หาข้อมูลจาก clustering (ถ้ามี)
                                    const clusteringPlantCount =
                                        debugInfo.waterBalanceDetails?.[index]?.plantCount || 0;
                                    const actualPlantCount = zone.plants.length;
                                    const difference = actualPlantCount - clusteringPlantCount;

                                    return (
                                        <div
                                            key={index}
                                            className="flex items-center justify-between rounded bg-yellow-800 p-2 text-xs"
                                        >
                                            <div className="flex items-center space-x-2">
                                                <div
                                                    className="h-3 w-3 rounded"
                                                    style={{ backgroundColor: zone.color }}
                                                ></div>
                                                <span className="text-yellow-200">{zone.name}</span>
                                            </div>
                                            <div className="text-yellow-300">
                                                <span className="text-orange-300">
                                                    Clustering: {clusteringPlantCount} ต้น
                                                </span>
                                                <span className="mx-2">→</span>
                                                <span className="text-green-300">
                                                    จริง: {actualPlantCount} ต้น
                                                </span>
                                                <span
                                                    className={`ml-2 ${difference >= 0 ? 'text-green-400' : 'text-red-400'}`}
                                                >
                                                    ({difference >= 0 ? '+' : ''}
                                                    {difference})
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* การกระจายปริมาณน้ำ */}
                    <div className="rounded-lg bg-purple-900 p-4">
                        <h4 className="mb-3 font-medium text-purple-200">
                            {t('การกระจายปริมาณน้ำ')}
                            <span className="ml-2 text-xs text-purple-300">
                                (ข้อมูลจากโซนจริงบนแผนที่)
                            </span>
                        </h4>
                        <div className="space-y-2">
                            {zones.map((zone, index) => {
                                const waterNeed = zone.totalWaterNeed;
                                const plantCount = zone.plants.length; // ใช้จำนวนต้นไม้จริงจากโซน
                                const actualTotalWaterNeed = zones.reduce(
                                    (sum, z) => sum + z.totalWaterNeed,
                                    0
                                );
                                const actualAverageWaterNeed =
                                    zones.length > 0 ? actualTotalWaterNeed / zones.length : 0;
                                const percentage =
                                    actualTotalWaterNeed > 0
                                        ? (waterNeed / actualTotalWaterNeed) * 100
                                        : 0;
                                const deviation = Math.abs(waterNeed - actualAverageWaterNeed);
                                const deviationPercent =
                                    actualAverageWaterNeed > 0
                                        ? (deviation / actualAverageWaterNeed) * 100
                                        : 0;

                                return (
                                    <div key={index} className="text-sm">
                                        <div className="flex justify-between text-purple-200">
                                            <span>โซน {index + 1}</span>
                                            <span>
                                                {(() => {
                                                    const config = loadSprinklerConfig();
                                                    return formatWaterVolumeWithFlowRate(
                                                        waterNeed,
                                                        plantCount,
                                                        config,
                                                        t
                                                    );
                                                })()}{' '}
                                                ({percentage.toFixed(1)}%)
                                            </span>
                                        </div>
                                        <div className="mt-1 text-xs text-purple-300">
                                            🌱 ต้นไม้: {plantCount} ต้น
                                        </div>
                                        <div className="mt-1 h-2 rounded bg-purple-800">
                                            <div
                                                className="h-full rounded bg-purple-400"
                                                style={{ width: `${percentage}%` }}
                                            ></div>
                                        </div>
                                        <div className="mt-1 text-xs text-purple-300">
                                            ส่วนเบี่ยงเบน: ±{deviation.toFixed(2)} (
                                            {deviationPercent.toFixed(1)}%)
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex justify-end">
                    <button
                        onClick={onClose}
                        className="rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-white hover:bg-gray-700"
                    >
                        {t('ปิด')}
                    </button>
                </div>
            </div>
        </div>
    );
};

// IrrigationZoneModal ถูกลบออกแล้ว - ใช้การสร้างโซนด้วยตัวเองแทน

const RealTimeBranchControlModal = ({
    isOpen,
    onClose,
    subMainPipe,
    currentAngle,
    onAngleChange,
    onApply,
    branchSettings,
    t,
}: {
    isOpen: boolean;
    onClose: () => void;
    subMainPipe: SubMainPipe | null;
    currentAngle: number;
    onAngleChange: (angle: number) => void;
    onApply: () => void;
    branchSettings: {
        defaultAngle: number;
        maxAngle: number;
        minAngle: number;
        angleStep: number;
    };
    t: (key: string) => string;
}) => {
    if (!isOpen || !subMainPipe) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-start justify-start bg-black bg-opacity-50">
            <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-gray-900 p-6 shadow-2xl">
                <h3 className="mb-4 text-xl font-semibold text-white">
                    🎛️ {t('ปรับเอียงท่อย่อย')}
                </h3>

                <div className="mb-4 rounded-lg border border-blue-200 bg-gray-900 p-3 text-sm text-white">
                    <div>
                        <strong>{t('ท่อเมนรอง')}:</strong> {subMainPipe.id}
                    </div>
                    <div>
                        <strong>{t('จำนวนท่อย่อย')}:</strong> {subMainPipe.branchPipes.length}{' '}
                        {t('เส้น')}
                    </div>
                    <div>
                        <strong>{t('จำนวนต้นไม้')}:</strong>{' '}
                        {subMainPipe.branchPipes.reduce((sum, bp) => sum + bp.plants.length, 0)}{' '}
                        {t('ต้น')}
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="mb-2 block text-sm font-medium text-white">
                            {t('ท่อย่อย')}: {currentAngle}°
                        </label>
                        <div className="mb-2 flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() =>
                                    onAngleChange(
                                        Math.max(branchSettings.minAngle, currentAngle - 0.5)
                                    )
                                }
                                className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                                disabled={currentAngle <= branchSettings.minAngle}
                            >
                                -0.5°
                            </button>
                            <input
                                type="range"
                                min={branchSettings.minAngle}
                                max={branchSettings.maxAngle}
                                step={0.5}
                                value={currentAngle}
                                onChange={(e) => onAngleChange(parseFloat(e.target.value))}
                                className="flex-1 accent-blue-600"
                            />
                            <button
                                type="button"
                                onClick={() =>
                                    onAngleChange(
                                        Math.min(branchSettings.maxAngle, currentAngle + 0.5)
                                    )
                                }
                                className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                                disabled={currentAngle >= branchSettings.maxAngle}
                            >
                                +0.5°
                            </button>
                        </div>
                        <div className="flex justify-between text-xs text-white">
                            <span>{branchSettings.minAngle}°</span>
                            <span>90°</span>
                            <span>{branchSettings.maxAngle}°</span>
                        </div>
                    </div>

                    <div className="rounded-lg border border-yellow-200 bg-gray-900 p-3 text-sm text-white">
                        <div className="mb-2 font-medium">💡 {t('การใช้งาน')}:</div>
                        <div>• {t('ลากแถบเลื่อนเพื่อดูผลแบบเรียลไทม์')}</div>
                        <div>• {t('คลิก "ยืนยัน" เพื่อบันทึกการเปลี่ยนแปลง')}</div>
                        <div>• {t('ท่อย่อยและต้นไม้จะปรับตำแหน่งตามมุมใหม่')}</div>
                    </div>
                </div>

                <div className="mt-6 flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 rounded bg-gray-600 px-4 py-2 text-white transition-colors hover:bg-gray-700"
                    >
                        {t('ยกเลิก')}
                    </button>
                    <button
                        onClick={onApply}
                        className="flex-1 rounded bg-green-600 px-4 py-2 text-white transition-colors hover:bg-green-700"
                    >
                        <FaCheck className="mr-2 inline" />
                        {t('ยืนยัน')}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ฟังก์ชันคำนวณปริมาณน้ำของท่อแต่ละเส้นตามโซน (แยกโซนตัวเอง)
const _calculatePipeWaterFlowByZone = (
    mainPipes: { id: string; coordinates: { lat: number; lng: number }[]; zoneId?: string }[],
    subMainPipes: { id: string; coordinates: { lat: number; lng: number }[]; zoneId?: string }[],
    lateralPipes: {
        id: string;
        coordinates: { lat: number; lng: number }[];
        plants: { id: string; position: { lat: number; lng: number } }[];
    }[],
    plants: { id: string; position: { lat: number; lng: number }; zoneId?: string }[],
    irrigationZones: { id: string; name: string; coordinates: { lat: number; lng: number }[] }[]
) => {
    const sprinklerConfig = loadSprinklerConfig();
    const flowRatePerPlant = sprinklerConfig?.flowRatePerMinute || 2.5;

    // สร้างแมป plant ID -> zone ID และ position -> zone ID
    const plantToZoneMap = new Map();
    const positionToZoneMap = new Map();

    plants.forEach((plant) => {
        if (plant.zoneId) {
            plantToZoneMap.set(plant.id, plant.zoneId);
            positionToZoneMap.set(`${plant.position.lat},${plant.position.lng}`, plant.zoneId);
        }
    });

    // ฟังก์ชันหา zone จากพิกัด
    const findZoneFromCoordinate = (coordinate: any): string => {
        if (!irrigationZones || irrigationZones.length === 0) return 'no-zone';

        for (const zone of irrigationZones) {
            // ตรวจสอบว่าจุดอยู่ในโซนหรือไม่
            if (isPointInPolygon(coordinate, zone.coordinates)) {
                return zone.id;
            }
        }
        return 'no-zone';
    };

    // ฟังก์ชันตรวจสอบจุดอยู่ในรูปหลายเหลี่ยม
    const isPointInPolygon = (point: any, polygon: any[]): boolean => {
        if (!point || !polygon || polygon.length < 3) return false;

        const x = point.lat;
        const y = point.lng;
        let inside = false;

        for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
            const xi = polygon[i].lat,
                yi = polygon[i].lng;
            const xj = polygon[j].lat,
                yj = polygon[j].lng;

            if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
                inside = !inside;
            }
        }

        return inside;
    };

    // คำนวณท่อย่อย (lateral pipes) - แยกตามโซนของพืช
    const calculateLateralPipeFlow = () => {
        const lateralByZone = new Map();

        lateralPipes.forEach((lateral) => {
            const plantCount = lateral.plants?.length || 0;
            const flowRate = plantCount * flowRatePerPlant;

            // หาโซนจากพืชที่เชื่อมต่อ
            let zoneId = 'no-zone';
            if (lateral.plants && lateral.plants.length > 0) {
                const firstPlant = lateral.plants[0];
                zoneId =
                    (firstPlant as any).zoneId ||
                    findZoneFromCoordinate(firstPlant.position) ||
                    'no-zone';
            } else if (lateral.coordinates && lateral.coordinates.length > 0) {
                // หาโซนจากตำแหน่งท่อ
                zoneId = findZoneFromCoordinate(lateral.coordinates[0]) || 'no-zone';
            }

            if (!lateralByZone.has(zoneId)) {
                lateralByZone.set(zoneId, []);
            }

            lateralByZone.get(zoneId).push({
                id: lateral.id,
                length: (lateral as any).length || 0,
                flowRate,
                plantCount,
            });
        });

        return lateralByZone;
    };

    // คำนวณท่อเมนรอง (sub-main pipes) - แยกตามโซน
    const calculateSubMainPipeFlow = () => {
        const subMainByZone = new Map();

        subMainPipes.forEach((subMain) => {
            const allBranchPipes = (subMain as any).branchPipes || [];
            let totalFlowRate = 0;
            let zoneId = 'no-zone';

            // หาโซนจากท่อย่อยที่เชื่อมต่อ
            allBranchPipes.forEach((branch) => {
                const plantCount = branch.plants?.length || 0;
                const branchFlowRate = plantCount * flowRatePerPlant;

                if (branch.plants && branch.plants.length > 0) {
                    const branchZone =
                        branch.plants[0].zoneId ||
                        findZoneFromCoordinate(branch.plants[0].position) ||
                        'no-zone';
                    if (zoneId === 'no-zone' || branchZone !== 'no-zone') {
                        zoneId = branchZone;
                    }
                    // เฉพาะท่อย่อยในโซนเดียวกันเท่านั้นที่นับรวม
                    if (branchZone === zoneId) {
                        totalFlowRate += branchFlowRate;
                    }
                }
            });

            // รวมท่อย่อยใหม่ที่เชื่อมต่อในโซนเดียวกัน
            lateralPipes.forEach((lateral) => {
                if ((lateral as any).subMainPipeId === subMain.id) {
                    const plantCount = lateral.plants?.length || 0;
                    const lateralFlowRate = plantCount * flowRatePerPlant;

                    if (lateral.plants && lateral.plants.length > 0) {
                        const lateralZone =
                            (lateral.plants[0] as any).zoneId ||
                            findZoneFromCoordinate(lateral.plants[0].position) ||
                            'no-zone';
                        if (zoneId === 'no-zone' || lateralZone !== 'no-zone') {
                            zoneId = lateralZone;
                        }
                        // เฉพาะท่อย่อยในโซนเดียวกันเท่านั้นที่นับรวม
                        if (lateralZone === zoneId) {
                            totalFlowRate += lateralFlowRate;
                        }
                    }
                }
            });

            // หากไม่มีโซนจากท่อย่อย ให้หาจากตำแหน่งท่อเมนรอง
            if (zoneId === 'no-zone' && subMain.coordinates && subMain.coordinates.length > 0) {
                zoneId = findZoneFromCoordinate(subMain.coordinates[0]) || 'no-zone';
            }

            if (!subMainByZone.has(zoneId)) {
                subMainByZone.set(zoneId, []);
            }

            subMainByZone.get(zoneId).push({
                id: subMain.id,
                length: (subMain as any).length || 0,
                flowRate: totalFlowRate,
                branchCount:
                    allBranchPipes.filter((branch) => {
                        if (!branch.plants || branch.plants.length === 0) return false;
                        const branchZone =
                            branch.plants[0].zoneId ||
                            findZoneFromCoordinate(branch.plants[0].position) ||
                            'no-zone';
                        return branchZone === zoneId;
                    }).length +
                    lateralPipes.filter((l) => {
                        if (
                            (l as any).subMainPipeId !== subMain.id ||
                            !l.plants ||
                            l.plants.length === 0
                        )
                            return false;
                        const lateralZone =
                            (l.plants[0] as any).zoneId ||
                            findZoneFromCoordinate(l.plants[0].position) ||
                            'no-zone';
                        return lateralZone === zoneId;
                    }).length,
            });
        });

        return subMainByZone;
    };

    // คำนวณท่อเมน (main pipes) - ให้ท่อเมนรองแต่ละเส้นเชื่อมต่อกับท่อเมนที่ใกล้ที่สุดเส้นเดียว
    const calculateMainPipeFlow = () => {
        const mainByZone = new Map();

        // สร้างแมปสำหรับเก็บการจับคู่ระหว่างท่อเมนรองและท่อเมน
        const subMainToMainMapping = new Map();

        // หาท่อเมนที่ใกล้ที่สุดสำหรับแต่ละท่อเมนรอง
        subMainPipes.forEach((subMain) => {
            if (!subMain.coordinates || subMain.coordinates.length === 0) return;

            const subMainStart = subMain.coordinates[0];
            let closestMainId: string | null = null;
            let minDistanceToAnyMain = Infinity;

            mainPipes.forEach((main) => {
                if (!main.coordinates || main.coordinates.length === 0) return;

                // หาระยะห่างที่ใกล้ที่สุดไปยังท่อเมนนี้
                let minDistance = Infinity;

                for (const mainPoint of main.coordinates) {
                    // คำนวณระยะห่างแบบ Haversine
                    const R = 6371000;
                    const dLat = ((subMainStart.lat - mainPoint.lat) * Math.PI) / 180;
                    const dLng = ((subMainStart.lng - mainPoint.lng) * Math.PI) / 180;
                    const a =
                        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                        Math.cos((mainPoint.lat * Math.PI) / 180) *
                            Math.cos((subMainStart.lat * Math.PI) / 180) *
                            Math.sin(dLng / 2) *
                            Math.sin(dLng / 2);
                    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
                    const distance = R * c;

                    if (distance < minDistance) {
                        minDistance = distance;
                    }
                }

                // เก็บท่อเมนที่ใกล้ที่สุด
                if (minDistance < minDistanceToAnyMain) {
                    minDistanceToAnyMain = minDistance;
                    closestMainId = main.id;
                }
            });

            // เก็บการจับคู่ (threshold 200 เมตร)
            if (closestMainId && minDistanceToAnyMain < 200) {
                subMainToMainMapping.set(subMain.id, {
                    mainId: closestMainId,
                    distance: minDistanceToAnyMain,
                });
            }
        });

        // คำนวณ flow rate สำหรับแต่ละท่อเมน
        mainPipes.forEach((main) => {
            if (!main.coordinates || main.coordinates.length === 0) return;

            // หาโซนจากปลายท่อเมน
            const mainEndPoint = main.coordinates[main.coordinates.length - 1];
            const mainZoneId = findZoneFromCoordinate(mainEndPoint) || 'no-zone';

            let totalFlowRate = 0;
            let connectedSubMains = 0;
            const connectedSubMainIds: string[] = [];
            const connectedSubMainDetails: any[] = [];

            // หาท่อเมนรองที่เชื่อมต่อกับท่อเมนนี้
            for (const [subMainId, connection] of subMainToMainMapping.entries()) {
                if (connection.mainId === main.id) {
                    connectedSubMains++;
                    connectedSubMainIds.push(subMainId);

                    // หา flow rate ของท่อเมนรองจาก subMainByZone
                    let subMainFlowRate = 0;
                    for (const [zoneId, subMainsInZone] of subMainByZone.entries()) {
                        const foundSubMain = subMainsInZone.find((sm) => sm.id === subMainId);
                        if (foundSubMain) {
                            subMainFlowRate = foundSubMain.flowRate;
                            connectedSubMainDetails.push({
                                id: subMainId,
                                zoneId: zoneId,
                                flowRate: foundSubMain.flowRate,
                                distance: connection.distance.toFixed(1) + 'm',
                            });
                            break;
                        }
                    }

                    totalFlowRate += subMainFlowRate;
                }
            }

            if (!mainByZone.has(mainZoneId)) {
                mainByZone.set(mainZoneId, []);
            }

            mainByZone.get(mainZoneId).push({
                id: main.id,
                length: (main as any).length || 0,
                flowRate: totalFlowRate,
                connectedSubMains: connectedSubMains,
                endZone: mainZoneId,
                connectedSubMainIds,
                connectedSubMainDetails,
            });
        });

        return mainByZone;
    };

    const lateralByZone = calculateLateralPipeFlow();
    const subMainByZone = calculateSubMainPipeFlow();
    const mainByZone = calculateMainPipeFlow();

    return {
        lateralByZone,
        subMainByZone,
        mainByZone,
        flowRatePerPlant,
    };
};

export default function EnhancedHorticulturePlannerPage() {
    const { t } = useLanguage();

    const hasLargeModalOpen = () => {
        return (
            showManualZoneInfoModal ||
            showManualIrrigationZoneModal ||
            showCustomPlantModal ||
            showZonePlantModal ||
            showPlantEditModal ||
            showBatchModal ||
            showRealTimeBranchModal ||
            showPipeSegmentModal ||
            showPlantGenerationModal ||
            showPlantTypeSelectionModal ||
            showPlantAreaSelectionModal
        );
    };

    const FirstLateralPipeWaterDisplay: React.FC<{
        isVisible: boolean;
        waterNeed: number;
        zoneName: string;
        plantCount?: number;
        t: (key: string) => string;
    }> = ({ isVisible, waterNeed, zoneName, plantCount = 0, t }) => {
        if (!isVisible || waterNeed <= 0) {
            return null;
        }

        const formatWaterVolume = (volume: number): string => {
            const baseText = `${Number(volume).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${t('ลิตร')}`;

            // Add flow rate if sprinkler config and plant count are available
            const config = loadSprinklerConfig();
            if (config && plantCount > 0) {
                const flowRate = plantCount * config.flowRatePerMinute;
                return `${baseText} (${flowRate.toFixed(2)} ${t('ลิตร/นาที')})`;
            }

            return baseText;
        };

        return (
            <div className="fixed bottom-4 left-[350px] z-50">
                <div className="min-w-64 rounded-lg border border-gray-200 bg-white/95 p-4 shadow-lg backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                        <div className="h-4 w-4 flex-shrink-0 rounded-full bg-blue-500"></div>
                        <div className="flex-1">
                            <div className="text-sm font-medium text-gray-700">
                                {t('ท่อย่อยเส้นแรกใน')}{' '}
                                <span className="font-bold text-green-600">{zoneName}</span>
                            </div>
                            <div className="text-lg font-bold text-blue-600">
                                {formatWaterVolume(waterNeed)}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const LateralPipeInfoModal: React.FC<{
        isOpen: boolean;
        onClose: () => void;
        lateralPipe: LateralPipe | null;
        t: (key: string) => string;
    }> = ({ isOpen, onClose, lateralPipe, t }) => {
        if (!isOpen || !lateralPipe) return null;

        const sprinklerConfig = loadSprinklerConfig();
        const flowRatePerMinute = sprinklerConfig?.flowRatePerMinute || 0;
        const totalFlowRate = lateralPipe.plantCount * flowRatePerMinute;

        return (
            <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
                <div className="mx-4 max-h-[90vh] w-full max-w-md overflow-y-auto rounded-lg bg-white shadow-xl">
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-gray-200 p-6">
                        <h2 className="flex items-center gap-2 text-xl font-bold text-gray-800">
                            <span className="text-blue-600">🚿</span>
                            {t('ข้อมูลท่อย่อย')}
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-1 text-gray-400 transition-colors hover:text-gray-600"
                        >
                            <span className="text-2xl">×</span>
                        </button>
                    </div>

                    {/* Content */}
                    <div className="space-y-4 p-6">
                        {/* Basic Info */}
                        <div className="rounded-lg bg-blue-50 p-4">
                            <h3 className="mb-3 font-semibold text-blue-800">
                                {t('ข้อมูลพื้นฐาน')}
                            </h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-blue-600">{t('รหัสท่อ')}:</span>
                                    <span className="font-mono text-blue-800">
                                        {lateralPipe.id}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-blue-600">{t('ความยาว')}:</span>
                                    <span className="font-semibold text-blue-800">
                                        {lateralPipe.length.toFixed(1)} {t('เมตร')}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-blue-600">{t('เส้นผ่านศูนย์กลาง')}:</span>
                                    <span className="font-semibold text-blue-800">
                                        {lateralPipe.diameter} {t('มม.')}
                                    </span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-blue-600">{t('โหมดการวาง')}:</span>
                                    <span className="font-semibold text-blue-800">
                                        {lateralPipe.placementMode === 'over_plants'
                                            ? t('วางทับแนวต้นไม้')
                                            : t('วางระหว่างแนวต้นไม้')}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Water & Flow Rate Info */}
                        <div className="rounded-lg bg-green-50 p-4">
                            <h3 className="mb-3 font-semibold text-green-800">
                                {t('ข้อมูลการใช้น้ำ')}
                            </h3>
                            <div className="space-y-3">
                                <div className="rounded-lg bg-white p-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-green-600">{t('จำนวนต้นไม้')}:</span>
                                        <span className="text-lg font-bold text-green-800">
                                            {lateralPipe.plantCount.toLocaleString()} {t('ต้น')}
                                        </span>
                                    </div>
                                </div>
                                <div className="rounded-lg bg-white p-3">
                                    <div className="flex items-center justify-between">
                                        <span className="text-green-600">
                                            {t('ปริมาณน้ำต้องการ')}:
                                        </span>
                                        <div className="text-right">
                                            <div className="text-lg font-bold text-green-800">
                                                {lateralPipe.totalWaterNeed.toFixed(1)} {t('ลิตร')}
                                            </div>
                                            {sprinklerConfig && (
                                                <div className="text-sm text-green-600">
                                                    ({totalFlowRate.toFixed(2)} {t('ลิตร/นาที')})
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                {sprinklerConfig && (
                                    <div className="rounded-lg bg-white p-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-green-600">{t('Q ต่อต้น')}:</span>
                                            <span className="font-bold text-green-800">
                                                {flowRatePerMinute.toFixed(2)} {t('ลิตร/นาที')}
                                            </span>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Plant Details */}
                        {lateralPipe.plants && lateralPipe.plants.length > 0 && (
                            <div className="rounded-lg bg-yellow-50 p-4">
                                <h3 className="mb-3 font-semibold text-yellow-800">
                                    {t('รายละเอียดพืช')}
                                </h3>
                                <div className="max-h-32 space-y-2 overflow-y-auto text-sm">
                                    {(() => {
                                        const plantSummary: Record<
                                            string,
                                            { count: number; totalWater: number }
                                        > = {};
                                        lateralPipe.plants.forEach((plant) => {
                                            const name = plant.plantData.name;
                                            if (!plantSummary[name]) {
                                                plantSummary[name] = { count: 0, totalWater: 0 };
                                            }
                                            plantSummary[name].count++;
                                            plantSummary[name].totalWater +=
                                                plant.plantData.waterNeed;
                                        });

                                        return Object.entries(plantSummary).map(
                                            ([name, data], index) => (
                                                <div
                                                    key={name}
                                                    className="flex justify-between rounded bg-white p-2"
                                                >
                                                    <span className="text-yellow-700">
                                                        {index + 1}. {name}
                                                    </span>
                                                    <span className="font-semibold text-yellow-800">
                                                        {data.count} {t('ต้น')} •{' '}
                                                        {data.totalWater.toFixed(1)} {t('ลิตร')}
                                                        {sprinklerConfig && (
                                                            <span className="ml-1 text-xs">
                                                                (
                                                                {(
                                                                    data.count * flowRatePerMinute
                                                                ).toFixed(1)}{' '}
                                                                L/Min)
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            )
                                        );
                                    })()}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="flex justify-end border-t border-gray-200 p-6">
                        <button
                            onClick={onClose}
                            className="rounded-lg bg-gray-600 px-4 py-2 text-white transition-colors hover:bg-gray-700"
                        >
                            {t('ปิด')}
                        </button>
                    </div>
                </div>
            </div>
        );
    };

    const LateralPipeComparisonAlert: React.FC<{
        isVisible: boolean;
        isMoreThanFirst: boolean;
        difference: number;
        currentWaterNeed: number;
        firstPipeWaterNeed: number;
        zoneName: string;
        currentPlantCount?: number;
        firstPlantCount?: number;
        flowRatePerMinute?: number;
        t: (key: string) => string;
    }> = ({
        isVisible,
        isMoreThanFirst,
        difference,
        currentWaterNeed,
        firstPipeWaterNeed,
        // zoneName,
        currentPlantCount = 0,
        firstPlantCount = 0,
        flowRatePerMinute = 0,
        t,
    }) => {
        if (!isVisible || firstPipeWaterNeed <= 0) {
            return null;
        }

        const formatWaterVolume = (volume: number): string => {
            return `${Number(volume).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} ${t('ลิตร')}`;
        };

        const formatFlowRate = (plantCount: number, flowRate: number): string => {
            const totalFlowRate = plantCount * flowRate;
            return `${totalFlowRate.toFixed(2)} ${t('ลิตร/นาที')}`;
        };

        const _formatFlowRatePerHour = (plantCount: number, flowRate: number): string => {
            const totalFlowRate = plantCount * flowRate;
            return `${totalFlowRate.toFixed(2)} ${t('ลิตร/ชั่วโมง')}`;
        };

        const getDifferenceText = () => {
            const absDifference = Math.abs(difference);
            const absLiter = Math.abs(currentWaterNeed - firstPipeWaterNeed);
            if (absDifference < 5) {
                return t('ใกล้เคียงกับท่อแรก');
            }

            const direction = isMoreThanFirst ? t('มากกว่า') : t('น้อยกว่า');
            return `${direction} ท่อแรก ${absLiter.toFixed(2)} ${t('ลิตร')} (${absDifference.toFixed(1)}%)`;
        };

        const getAlertColor = () => {
            const absDifference = Math.abs(difference);
            if (absDifference < 5) {
                return 'bg-green-50 border-green-200 text-green-800';
            } else if (absDifference < 15) {
                return 'bg-yellow-50 border-yellow-200 text-yellow-800';
            } else {
                return 'bg-red-50 border-red-200 text-red-800';
            }
        };

        const _getIcon = () => {
            const absDifference = Math.abs(difference);
            if (absDifference < 5) {
                return (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white">
                        ✓
                    </div>
                );
            } else if (isMoreThanFirst) {
                return (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                        ↑
                    </div>
                );
            } else {
                return (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-blue-500 text-xs font-bold text-white">
                        ↓
                    </div>
                );
            }
        };

        const _getWarningIcon = () => {
            const absDifference = Math.abs(difference);
            if (absDifference >= 15) {
                return (
                    <div className="flex h-4 w-4 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
                        !
                    </div>
                );
            }
            return null;
        };

        return (
            <div className="fixed bottom-4 left-[350px] z-50">
                <div
                    className={`min-w-80 max-w-96 rounded-lg border p-4 shadow-lg backdrop-blur-sm ${getAlertColor()}`}
                >
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex-shrink-0">{/* {getIcon()} */}</div>
                        <div className="flex-1">
                            {/* <div className="flex items-center gap-2">
                                <div className="text-sm font-medium">
                                    {t('เปรียบเทียบกับท่อแรกใน')} <span className="font-bold text-green-600">{zoneName}</span>
                                </div>
                                {getWarningIcon()}
                            </div> */}

                            <div className="mt-1 space-y-1">
                                <div className="flex justify-between">
                                    <div className="text-xs opacity-75">
                                        {t('ท่อแรก')}: {formatWaterVolume(firstPipeWaterNeed)}
                                        {flowRatePerMinute > 0 && firstPlantCount > 0 && (
                                            <div className="text-[10px] text-gray-500">
                                                (
                                                {formatFlowRate(firstPlantCount, flowRatePerMinute)}
                                                )
                                            </div>
                                        )}
                                    </div>
                                    <div className="text-xs opacity-75">
                                        {t('ท่อปัจจุบัน')}: {formatWaterVolume(currentWaterNeed)}
                                        {flowRatePerMinute > 0 && currentPlantCount > 0 && (
                                            <div className="text-[10px] text-gray-500">
                                                (
                                                {formatFlowRate(
                                                    currentPlantCount,
                                                    flowRatePerMinute
                                                )}
                                                )
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="mt-2 text-sm font-semibold">{getDifferenceText()}</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    const [projectName, setProjectName] = useState<string>('');
    const [customerName, setCustomerName] = useState<string>('');
    const [sprinklerConfig, setSprinklerConfig] = useState<SprinklerFormData | null>(null);
    const [showSprinklerConfigModal, setShowSprinklerConfigModal] = useState(false);
    const [selectedLateralPipe, setSelectedLateralPipe] = useState<LateralPipe | null>(null);
    const [showLateralPipeInfoModal, setShowLateralPipeInfoModal] = useState(false);
    const [showSprinklerRadius, setShowSprinklerRadius] = useState(false);

    // Auto Lateral Pipe Modal
    const [showAutoLateralPipeModal, setShowAutoLateralPipeModal] = useState(false);

    // Head Loss Calculation Modal
    const [showHeadLossModal, setShowHeadLossModal] = useState(false);
    const [selectedPipeForHeadLoss, setSelectedPipeForHeadLoss] = useState<{
        pipeId: string;
        pipeType: 'mainPipe' | 'subMainPipe' | 'branchPipe';
        zoneName: string;
        zoneId: string;
        length: number;
        pipeName?: string;
    } | null>(null);
    const [headLossResults, setHeadLossResults] = useState<HeadLossResult[]>([]);
    const [expandedZones, setExpandedZones] = useState<Set<string>>(new Set());
    const [isEditingExistingField, setIsEditingExistingField] = useState<boolean>(false);

    // Head Loss Functions
    const _toggleZoneExpansion = (zoneId: string) => {
        setExpandedZones((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(zoneId)) {
                newSet.delete(zoneId);
            } else {
                newSet.add(zoneId);
            }
            return newSet;
        });
    };

    const _isZoneExpanded = (zoneId: string) => {
        return expandedZones.has(zoneId);
    };

    // ย่นชื่อท่อให้สั้นลง
    const _getShortenedPipeName = (
        pipeName: string | undefined,
        pipeType: string,
        index: number
    ): string => {
        if (!pipeName) {
            switch (pipeType) {
                case 'mainPipe':
                    return `ท่อเมน #${index + 1}`;
                case 'subMainPipe':
                    return `ท่อเมนรอง #${index + 1}`;
                case 'branchPipe':
                    return `ท่อย่อย #${index + 1}`;
                default:
                    return `ท่อ #${index + 1}`;
            }
        }

        // ถ้าชื่อยาวเกิน 15 ตัวอักษร ให้ตัดและแสดงแค่ส่วนท้าย
        if (pipeName.length > 15) {
            // ตัด timestamp และ random string ออก
            const parts = pipeName.split('_');
            if (parts.length > 2) {
                // เอาส่วนแรกและส่วนสุดท้าย
                return `${parts[0]}_${parts[parts.length - 1]}`;
            }
            // ถ้าไม่มี underscore หรือมีแค่ 2 ส่วน ให้ตัดแค่ 12 ตัวอักษรแรก + ...
            return pipeName.substring(0, 12) + '...';
        }

        return pipeName;
    };
    const _handlePipeClick = (
        pipeId: string,
        pipeType: 'mainPipe' | 'subMainPipe' | 'branchPipe',
        zoneName: string,
        zoneId: string,
        length: number,
        pipeName?: string
    ) => {
        setSelectedPipeForHeadLoss({
            pipeId,
            pipeType,
            zoneName,
            zoneId,
            length,
            pipeName,
        });
        setShowHeadLossModal(true);
    };

    const handleHeadLossCalculationSave = (result: HeadLossResult) => {
        setHeadLossResults((prev) => {
            // อัปเดตหรือเพิ่มผลการคำนวณใหม่
            const existingIndex = prev.findIndex((r) => r.pipeId === result.pipeId);
            if (existingIndex >= 0) {
                const updated = [...prev];
                updated[existingIndex] = result;
                return updated;
            } else {
                // ถ้าเป็นผลการคำนวณแรกในโซนนี้ ให้ขยายโซนออกมา
                setExpandedZones((prev) => new Set([...prev, result.zoneId]));
                return [...prev, result];
            }
        });
        setShowHeadLossModal(false);
    };

    const getHeadLossForPipe = (pipeId: string): HeadLossResult | undefined => {
        return headLossResults.find((r) => r.pipeId === pipeId);
    };

    // Load sprinkler config from localStorage on component mount
    useEffect(() => {
        const savedConfig = loadSprinklerConfig();
        if (savedConfig) {
            setSprinklerConfig({
                flowRatePerMinute: savedConfig.flowRatePerMinute.toString(),
                pressureBar: savedConfig.pressureBar.toString(),
                radiusMeters: savedConfig.radiusMeters.toString(),
            });
        }
    }, []);

    const [showCustomPlantModal, setShowCustomPlantModal] = useState(false);
    const [showZonePlantModal, setShowZonePlantModal] = useState(false);
    const [selectedZoneForPlant, setSelectedZoneForPlant] = useState<Zone | null>(null);
    const [editingPlant, setEditingPlant] = useState<PlantData | null>(null);
    const [shouldShowPlantSelectorAfterSave, setShouldShowPlantSelectorAfterSave] = useState(false);
    const [showPlantEditModal, setShowPlantEditModal] = useState(false);
    const [selectedPlantForEdit, setSelectedPlantForEdit] = useState<PlantLocation | null>(null);
    const [showBatchModal, setShowBatchModal] = useState(false);
    const [showRealTimeBranchModal, setShowRealTimeBranchModal] = useState(false);

    const [showPipeSegmentModal, setShowPipeSegmentModal] = useState(false);
    const [selectedBranchForSegment, setSelectedBranchForSegment] = useState<BranchPipe | null>(
        null
    );

    const [showPlantGenerationModal, setShowPlantGenerationModal] = useState(false);

    const [showManualIrrigationZoneModal, setShowManualIrrigationZoneModal] = useState(false);
    const [numberOfManualZones, setNumberOfManualZones] = useState(2);
    const [isDrawingManualZone, setIsDrawingManualZone] = useState(false);
    const [currentManualZoneIndex, setCurrentManualZoneIndex] = useState(0);
    const [manualZones, setManualZones] = useState<ManualIrrigationZone[]>([]);
    const [showManualZoneInfoModal, setShowManualZoneInfoModal] = useState(false);

    // Auto Zone States
    const [showAutoZoneModal, setShowAutoZoneModal] = useState(false);
    const [autoZoneConfig, setAutoZoneConfig] = useState<AutoZoneConfig>({
        numberOfZones: 2,
        balanceWaterNeed: false,
        balancePlantCount: true, // 🌱 ตั้งค่าเริ่มต้นให้สมดุลจำนวนต้นไม้
        debugMode: false, // 🌱 ปิด debug mode เป็นค่าเริ่มต้น
        paddingMeters: 2,
        useVoronoi: true,
    });
    const [isCreatingAutoZones, setIsCreatingAutoZones] = useState(false);
    const [autoZoneResult, setAutoZoneResult] = useState<AutoZoneResult | null>(null);
    const [showAutoZoneDebugModal, setShowAutoZoneDebugModal] = useState(false);
    const [currentDrawnZone, setCurrentDrawnZone] = useState<ManualIrrigationZone | null>(null);
    const [targetWaterPerZone, setTargetWaterPerZone] = useState(0);

    // Zone Edit States
    const [isZoneEditMode, setIsZoneEditMode] = useState(false);
    const [selectedZoneForEdit, setSelectedZoneForEdit] = useState<IrrigationZone | null>(null);
    const [zoneControlPoints, setZoneControlPoints] = useState<Coordinate[]>([]);
    const [_draggedControlPointIndex, setDraggedControlPointIndex] = useState<number | null>(null);

    const [showPlantTypeSelectionModal, setShowPlantTypeSelectionModal] = useState(false);
    const [showPlantAreaSelectionModal, setShowPlantAreaSelectionModal] = useState(false);
    const [currentPlantArea, setCurrentPlantArea] = useState<PlantArea | null>(null);
    const [_isDrawingPlantArea, setIsDrawingPlantArea] = useState(false);

    // Sprinkler states are declared above with project name and customer name

    const [activeTab, setActiveTab] = useState('area');
    const [editMode, setEditMode] = useState<string | null>(null);

    const [isCompactMode, setIsCompactMode] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isRetrying, setIsRetrying] = useState(false);

    const [mapCenter, setMapCenter] = useState<[number, number]>([12.609731, 102.050412]);
    const [_map, setMap] = useState<google.maps.Map | null>(null);
    const [_selectedZone, _setSelectedZone] = useState<Zone | null>(null);
    const [selectedExclusionType, setSelectedExclusionType] =
        useState<keyof typeof EXCLUSION_COLORS>('building');
    const [_drawingMainPipe, setDrawingMainPipe] = useState<{ toZone: string | null }>({
        toZone: null,
    });

    const [_isNewPlantMode, setIsNewPlantMode] = useState(false);
    const [isCreatingConnection, setIsCreatingConnection] = useState(false);
    const [connectionStartPlant, setConnectionStartPlant] = useState<PlantLocation | null>(null);
    const [plantPlacementMode, setPlantPlacementMode] = useState<'free' | 'plant_grid'>('free');
    const [highlightedPipes, setHighlightedPipes] = useState<string[]>([]);
    const [_dragMode, setDragMode] = useState<'none' | 'connecting'>('none');
    const [tempConnectionLine, setTempConnectionLine] = useState<Coordinate[] | null>(null);

    const [showQuickActionPanel, setShowQuickActionPanel] = useState(false);

    const [isDragging, setIsDragging] = useState(false);
    const [dragTarget, setDragTarget] = useState<{ id: string; type: 'plant' | 'pipe' } | null>(
        null
    );
    const [dimensionLineAngleOffset, setDimensionLineAngleOffset] = useState<number>(0);
    const isUpdatingRef = useRef<boolean>(false);

    const [isPlantMoveMode, setIsPlantMoveMode] = useState(false);
    const [plantMoveStep, setPlantMoveStep] = useState(0.00001);

    const [selectedPlantsForMove, setSelectedPlantsForMove] = useState<Set<string>>(new Set());
    const [isPlantSelectionMode, setIsPlantSelectionMode] = useState(false);
    const [plantMoveMode, setPlantMoveMode] = useState<'all' | 'selected' | 'area'>('all');
    const [selectedPlantAreaForMove, setSelectedPlantAreaForMove] = useState<string | null>(null);

    // เพิ่ม state สำหรับฟีเจอร์ลบ
    const [isDeleteMode, setIsDeleteMode] = useState(false);
    const [showDeleteMainAreaConfirm, setShowDeleteMainAreaConfirm] = useState(false);
    const [deletedPipeCount, setDeletedPipeCount] = useState(0);

    // 🌱 เพิ่ม state สำหรับต้นไม้ที่ถูก highlight ขณะลากท่อย่อย
    const [highlightedPlants, setHighlightedPlants] = useState<Set<string>>(new Set());

    const [isRulerMode, setIsRulerMode] = useState(false);
    const [rulerStartPoint, setRulerStartPoint] = useState<Coordinate | null>(null);
    const [currentMousePosition, setCurrentMousePosition] = useState<Coordinate | null>(null);
    const [currentDistance, setCurrentDistance] = useState(0);
    const [showRulerWindow, setShowRulerWindow] = useState(false);

    const [showPlantRotationControl, setShowPlantRotationControl] = useState(false);
    const [isApplyingRotation, setIsApplyingRotation] = useState(false);
    const [tempRotationAngle, setTempRotationAngle] = useState(0);

    const mapRef = useRef<google.maps.Map | null>(null);
    const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
    const polygonsRef = useRef<Map<string, google.maps.Polygon>>(new Map());
    const polylinesRef = useRef<Map<string, google.maps.Polyline>>(new Map());
    const _featureGroupRef = useRef<any>(null);
    const _lateralPipeMouseMoveRef = useRef<NodeJS.Timeout | null>(null);
    const lastMouseMoveTime = useRef<number>(0);
    const mouseMoveCacheRef = useRef<{
        lastRawPoint: Coordinate | null;
        lastResult: {
            alignedEnd: Coordinate;
            selectedPlants: PlantLocation[];
            snappedStart: Coordinate;
        } | null;
    }>({
        lastRawPoint: null,
        lastResult: null,
    });

    const initialState: ProjectState = useMemo(
        () => ({
            mainArea: [],
            plantAreas: [],
            zones: [],
            pump: null,
            mainPipes: [],
            subMainPipes: [],
            lateralPipes: [],
            plants: [],
            exclusionAreas: [],
            exclusionZones: [],
            irrigationZones: [],
            useZones: false,
            selectedPlantType: DEFAULT_PLANT_TYPES(t)[0],
            availablePlants: DEFAULT_PLANT_TYPES(t),
            editMode: null, // 🚀 ตั้งค่า editMode เริ่มต้นเป็น null
            plantGenerationSettings: {
                layoutPattern: 'grid',
                isGenerating: false,
                rotationAngle: 0,
            },
            plantSelectionMode: {
                type: 'single',
                isCompleted: false,
            },
            spacingValidationStats: {
                totalBranches: 0,
                averageRowSpacing: 0,
                averagePlantSpacing: 0,
                spacingAccuracy: 0,
            },
            areaUtilizationStats: {
                totalBranches: 0,
                averageUtilization: 0,
                maxUtilization: 0,
            },
            isEditModeEnabled: false,
            branchPipeSettings: {
                defaultAngle: 90,
                maxAngle: 180,
                minAngle: 0,
                angleStep: 1,
            },
            lateralPipeSettings: {
                placementMode: 'over_plants',
                snapThreshold: 30,
                autoGenerateEmitters: true,
                emitterDiameter: 4,
            },
            selectedItems: {
                plants: [],
                pipes: [],
                zones: [],
            },
            clipboard: {
                plants: [],
                pipes: [],
            },
            editModeSettings: {
                snapToGrid: false,
                gridSize: 1,
                showMeasurements: false,
                autoConnect: true,
                batchMode: false,
                selectionMode: 'single',
                dragMode: 'none',
            },
            layerVisibility: {
                plants: true,
                pipes: true,
                zones: true,
                exclusions: true,
                grid: false,
                measurements: false,
                plantAreas: true,
                dimensionLines: true,
                lateralPipes: true,
                emitterLines: true,
            },
            realTimeEditing: {
                activePipeId: null,
                activeAngle: 90,
                isAdjusting: false,
            },
            curvedPipeEditing: {
                isEnabled: false,
                editingPipes: new Set<string>(),
            },
            lateralPipeDrawing: {
                isActive: false,
                isContinuousMode: false, // 🚀 เพิ่มสำหรับการวาดต่อเนื่อง
                placementMode: null,
                startPoint: null,
                snappedStartPoint: null,
                currentPoint: null,
                rawCurrentPoint: null,
                selectedPlants: [],
                totalWaterNeed: 0,
                plantCount: 0,
                // 🚀 เพิ่มสำหรับ multi-segment drawing
                waypoints: [],
                currentSegmentDirection: null,
                allSegmentPlants: [],
                segmentPlants: [],
                isMultiSegmentMode: false,
            },
            firstLateralPipeWaterNeeds: {
                'main-area': 0,
            },
            firstLateralPipePlantCounts: {
                'main-area': 0,
            },
            lateralPipeComparison: {
                isComparing: false,
                currentZoneId: null,
                firstPipeWaterNeed: 0,
                currentPipeWaterNeed: 0,
                difference: 0,
                isMoreThanFirst: false,
            },
            pipeConnection: {
                isActive: false,
                selectedPoints: [],
                tempConnections: [],
            },
        }),
        [t]
    );

    const [history, dispatchHistory] = useReducer(historyReducer, {
        past: [],
        present: initialState,
        future: [],
    });

    // 🚀 Ref เก็บข้อมูล lateralPipes ล่าสุดเพื่อใช้ในการตรวจสอบ connection
    const latestLateralPipesRef = useRef(history.present.lateralPipes);

    // อัปเดต ref เมื่อ lateralPipes เปลี่ยนแปลง
    useEffect(() => {
        latestLateralPipesRef.current = history.present.lateralPipes;
    }, [history.present.lateralPipes]);

    const totalArea = useMemo(
        () => calculateAreaFromCoordinates(history.present.mainArea),
        [history.present.mainArea]
    );

    const actualTotalPlants = useMemo(
        () => history.present.plants.length,
        [history.present.plants]
    );

    const actualTotalWaterNeed = useMemo(() => {
        return history.present.plants.reduce((sum, plant) => sum + plant.plantData.waterNeed, 0);
    }, [history.present.plants]);

    const canEnableEditMode = useMemo(() => {
        return (
            history.present.mainArea.length > 0 &&
            history.present.pump &&
            history.present.plants.length > 0 &&
            (history.present.mainPipes.length > 0 || history.present.subMainPipes.length > 0)
        );
    }, [history.present]);

    const selectedItemsCount = useMemo(() => {
        return (
            history.present.selectedItems.plants.length +
            history.present.selectedItems.pipes.length +
            history.present.selectedItems.zones.length
        );
    }, [history.present.selectedItems]);

    const prevHistoryRef = useRef(history.present);

    useEffect(() => {
        prevHistoryRef.current = history.present;
    }, [history.present]);

    const pushToHistory = useCallback(
        (newState: Partial<ProjectState>) => {
            const hasChanges = Object.keys(newState).some((key) => {
                const currentValue = newState[key as keyof ProjectState];
                const previousValue = prevHistoryRef.current[key as keyof ProjectState];

                if (Array.isArray(currentValue) && Array.isArray(previousValue)) {
                    return JSON.stringify(currentValue) !== JSON.stringify(previousValue);
                }

                return currentValue !== previousValue;
            });

            if (hasChanges) {
                const updatedState = { ...history.present, ...newState };
                dispatchHistory({ type: 'PUSH_STATE', state: updatedState });
                prevHistoryRef.current = updatedState;
            }
        },
        [history.present]
    );

    const moveAllPlants = useCallback(
        (direction: 'up' | 'down' | 'left' | 'right') => {
            if (history.present.plants.length === 0) {
                return;
            }

            const offset: Coordinate = {
                lat: 0,
                lng: 0,
            };

            switch (direction) {
                case 'up':
                    offset.lat = plantMoveStep;
                    break;
                case 'down':
                    offset.lat = -plantMoveStep;
                    break;
                case 'left':
                    offset.lng = -plantMoveStep;
                    break;
                case 'right':
                    offset.lng = plantMoveStep;
                    break;
            }

            const updatedPlants = history.present.plants.map((plant) => ({
                ...plant,
                position: {
                    lat: plant.position.lat + offset.lat,
                    lng: plant.position.lng + offset.lng,
                },
            }));

            const updatedSubMainPipes = history.present.subMainPipes.map((subMainPipe) => ({
                ...subMainPipe,
                branchPipes: subMainPipe.branchPipes.map((branchPipe) => ({
                    ...branchPipe,
                    plants: branchPipe.plants.map((plant) => ({
                        ...plant,
                        position: {
                            lat: plant.position.lat + offset.lat,
                            lng: plant.position.lng + offset.lng,
                        },
                    })),
                })),
            }));

            pushToHistory({
                plants: updatedPlants,
                subMainPipes: updatedSubMainPipes,
            });
        },
        [history.present.plants, history.present.subMainPipes, plantMoveStep, pushToHistory]
    );

    const moveSelectedPlants = useCallback(
        (direction: 'up' | 'down' | 'left' | 'right') => {
            if (selectedPlantsForMove.size === 0) {
                return;
            }

            const offset: Coordinate = {
                lat: 0,
                lng: 0,
            };

            switch (direction) {
                case 'up':
                    offset.lat = plantMoveStep;
                    break;
                case 'down':
                    offset.lat = -plantMoveStep;
                    break;
                case 'left':
                    offset.lng = -plantMoveStep;
                    break;
                case 'right':
                    offset.lng = plantMoveStep;
                    break;
            }

            const updatedPlants = history.present.plants.map((plant) => {
                if (selectedPlantsForMove.has(plant.id)) {
                    return {
                        ...plant,
                        position: {
                            lat: plant.position.lat + offset.lat,
                            lng: plant.position.lng + offset.lng,
                        },
                    };
                }
                return plant;
            });

            const updatedSubMainPipes = history.present.subMainPipes.map((subMainPipe) => ({
                ...subMainPipe,
                branchPipes: subMainPipe.branchPipes.map((branchPipe) => ({
                    ...branchPipe,
                    plants: branchPipe.plants.map((plant) => {
                        if (selectedPlantsForMove.has(plant.id)) {
                            return {
                                ...plant,
                                position: {
                                    lat: plant.position.lat + offset.lat,
                                    lng: plant.position.lng + offset.lng,
                                },
                            };
                        }
                        return plant;
                    }),
                })),
            }));

            pushToHistory({
                plants: updatedPlants,
                subMainPipes: updatedSubMainPipes,
            });
        },
        [
            selectedPlantsForMove,
            history.present.plants,
            history.present.subMainPipes,
            plantMoveStep,
            pushToHistory,
        ]
    );

    const movePlantsInArea = useCallback(
        (direction: 'up' | 'down' | 'left' | 'right') => {
            if (!selectedPlantAreaForMove) {
                return;
            }

            const offset: Coordinate = {
                lat: 0,
                lng: 0,
            };

            switch (direction) {
                case 'up':
                    offset.lat = plantMoveStep;
                    break;
                case 'down':
                    offset.lat = -plantMoveStep;
                    break;
                case 'left':
                    offset.lng = -plantMoveStep;
                    break;
                case 'right':
                    offset.lng = plantMoveStep;
                    break;
            }

            const updatedPlants = history.present.plants.map((plant) => {
                if (plant.plantAreaId === selectedPlantAreaForMove) {
                    return {
                        ...plant,
                        position: {
                            lat: plant.position.lat + offset.lat,
                            lng: plant.position.lng + offset.lng,
                        },
                    };
                }
                return plant;
            });

            const updatedSubMainPipes = history.present.subMainPipes.map((subMainPipe) => ({
                ...subMainPipe,
                branchPipes: subMainPipe.branchPipes.map((branchPipe) => ({
                    ...branchPipe,
                    plants: branchPipe.plants.map((plant) => {
                        if (plant.plantAreaId === selectedPlantAreaForMove) {
                            return {
                                ...plant,
                                position: {
                                    lat: plant.position.lat + offset.lat,
                                    lng: plant.position.lng + offset.lng,
                                },
                            };
                        }
                        return plant;
                    }),
                })),
            }));

            pushToHistory({
                plants: updatedPlants,
                subMainPipes: updatedSubMainPipes,
            });
        },
        [
            selectedPlantAreaForMove,
            history.present.plants,
            history.present.subMainPipes,
            plantMoveStep,
            pushToHistory,
        ]
    );

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!isPlantMoveMode) return;
            const target = event.target as HTMLElement;
            if (
                target.tagName === 'INPUT' ||
                target.tagName === 'TEXTAREA' ||
                target.contentEditable === 'true'
            ) {
                return;
            }

            switch (event.key) {
                case 'ArrowUp':
                    event.preventDefault();
                    if (plantMoveMode === 'selected' && selectedPlantsForMove.size > 0) {
                        moveSelectedPlants('up');
                    } else if (plantMoveMode === 'area' && selectedPlantAreaForMove) {
                        movePlantsInArea('up');
                    } else {
                        moveAllPlants('up');
                    }
                    break;
                case 'ArrowDown':
                    event.preventDefault();
                    if (plantMoveMode === 'selected' && selectedPlantsForMove.size > 0) {
                        moveSelectedPlants('down');
                    } else if (plantMoveMode === 'area' && selectedPlantAreaForMove) {
                        movePlantsInArea('down');
                    } else {
                        moveAllPlants('down');
                    }
                    break;
                case 'ArrowLeft':
                    event.preventDefault();
                    if (plantMoveMode === 'selected' && selectedPlantsForMove.size > 0) {
                        moveSelectedPlants('left');
                    } else if (plantMoveMode === 'area' && selectedPlantAreaForMove) {
                        movePlantsInArea('left');
                    } else {
                        moveAllPlants('left');
                    }
                    break;
                case 'ArrowRight':
                    event.preventDefault();
                    if (plantMoveMode === 'selected' && selectedPlantsForMove.size > 0) {
                        moveSelectedPlants('right');
                    } else if (plantMoveMode === 'area' && selectedPlantAreaForMove) {
                        movePlantsInArea('right');
                    } else {
                        moveAllPlants('right');
                    }
                    break;
                case 'Escape':
                    event.preventDefault();
                    setIsPlantMoveMode(false);
                    if (typeof window !== 'undefined' && (window as any).showSnapNotification) {
                        (window as any).showSnapNotification('ออกจากโหมดเลื่อนต้นไม้');
                    }
                    break;
            }
        };

        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, [
        isPlantMoveMode,
        moveAllPlants,
        moveSelectedPlants,
        movePlantsInArea,
        selectedPlantsForMove,
        plantMoveMode,
        selectedPlantAreaForMove,
    ]);
    const startRulerMode = () => {
        setIsRulerMode(true);
        setShowRulerWindow(true);
        setRulerStartPoint(null);
        setCurrentMousePosition(null);
        setCurrentDistance(0);
        setIsPlantMoveMode(false);
        setEditMode(null);
    };

    const stopRulerMode = useCallback(() => {
        try {
            // Cancel any pending RAF
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }

            setIsRulerMode(false);
            setShowRulerWindow(false);
            setRulerStartPoint(null);
            setCurrentMousePosition(null);
            setCurrentDistance(0);
        } catch (error) {
            console.error('Error in stopRulerMode:', error);
        }
    }, []);

    const _clearRulerMeasurements = useCallback(() => {
        try {
            // Cancel any pending RAF
            if (rafIdRef.current) {
                cancelAnimationFrame(rafIdRef.current);
                rafIdRef.current = null;
            }

            setRulerStartPoint(null);
            setCurrentMousePosition(null);
            setCurrentDistance(0);
        } catch (error) {
            console.error('Error in clearRulerMeasurements:', error);
        }
    }, []);

    const handleRulerClick = useCallback(
        (position: Coordinate) => {
            if (!isRulerMode) return;

            // ตรวจสอบความถูกต้องของตำแหน่ง
            if (!position || typeof position.lat !== 'number' || typeof position.lng !== 'number') {
                console.warn('Invalid position for ruler click:', position);
                return;
            }

            try {
                // ถ้าไม่มีจุดเริ่มต้น หรือต้องการเริ่มวัดใหม่
                if (!rulerStartPoint) {
                    setRulerStartPoint(position);
                    setCurrentMousePosition(null);
                    setCurrentDistance(0);
                } else {
                    // คลิกซ้ำเพื่อเริ่มวัดใหม่
                    setRulerStartPoint(position);
                    setCurrentMousePosition(null);
                    setCurrentDistance(0);
                }
            } catch (error) {
                console.error('Error in handleRulerClick:', error);
            }
        },
        [isRulerMode, rulerStartPoint]
    );

    const handleRulerDoubleClick = useCallback(
        (position: Coordinate) => {
            if (!isRulerMode) return;
            handleRulerClick(position);
            setCurrentMousePosition(null);
        },
        [isRulerMode, handleRulerClick]
    );

    const rafIdRef = useRef<number | null>(null);

    const handleRulerMouseMove = useCallback(
        (position: Coordinate) => {
            if (!isRulerMode || !rulerStartPoint) return;

            // ตรวจสอบความถูกต้องของตำแหน่ง
            if (!position || typeof position.lat !== 'number' || typeof position.lng !== 'number') {
                return;
            }

            try {
                // Cancel previous RAF to prevent stacking
                if (rafIdRef.current) {
                    cancelAnimationFrame(rafIdRef.current);
                }

                // Use RAF for smooth UI updates
                rafIdRef.current = requestAnimationFrame(() => {
                    setCurrentMousePosition(position);

                    // คำนวณระยะจากจุดเริ่มต้นไปยังเมาส์ปัจจุบัน
                    const distance = calculateDistanceBetweenPoints(rulerStartPoint, position);
                    if (distance > 0 && distance < 100000) {
                        setCurrentDistance(distance);
                    }

                    rafIdRef.current = null;
                });
            } catch (error) {
                console.error('Error in handleRulerMouseMove:', error);
            }
        },
        [isRulerMode, rulerStartPoint]
    );

    const prevDimensionStateRef = useRef({
        dimensionLineAngleOffset,
        exclusionAreas: history.present.exclusionAreas,
        mainArea: history.present.mainArea,
        exclusionZones: history.present.exclusionZones,
    });

    useEffect(() => {
        if (isUpdatingRef.current) {
            return;
        }

        if (
            !history.present ||
            !history.present.exclusionAreas ||
            history.present.exclusionAreas.length === 0 ||
            !history.present.mainArea ||
            history.present.mainArea.length === 0 ||
            !history.present.exclusionZones ||
            history.present.exclusionZones.length === 0
        ) {
            return;
        }

        if (dimensionLineAngleOffset === 0 && history.present.exclusionAreas.length === 0) {
            return;
        }

        const currentDimensionState = {
            dimensionLineAngleOffset,
            exclusionAreas: history.present.exclusionAreas,
            mainArea: history.present.mainArea,
            exclusionZones: history.present.exclusionZones,
        };

        const hasDimensionChanges =
            currentDimensionState.dimensionLineAngleOffset !==
                prevDimensionStateRef.current.dimensionLineAngleOffset ||
            JSON.stringify(currentDimensionState.exclusionAreas) !==
                JSON.stringify(prevDimensionStateRef.current.exclusionAreas) ||
            JSON.stringify(currentDimensionState.mainArea) !==
                JSON.stringify(prevDimensionStateRef.current.mainArea);

        if (!hasDimensionChanges) {
            return;
        }

        isUpdatingRef.current = true;

        const updatedExclusionZones = history.present.exclusionZones.map((exclusionZone) => {
            const exclusionArea = history.present.exclusionAreas.find(
                (area) => area.id === exclusionZone.id
            );
            if (exclusionArea && generateDimensionLines) {
                const newDimensionLines = generateDimensionLines(
                    exclusionArea,
                    history.present.mainArea,
                    dimensionLineAngleOffset
                );
                if (newDimensionLines && Array.isArray(newDimensionLines)) {
                    return {
                        ...exclusionZone,
                        dimensionLines: newDimensionLines,
                    };
                }
            }
            return exclusionZone;
        });

        const hasChanges = updatedExclusionZones.some((zone, index) => {
            const originalZone = history.present.exclusionZones[index];
            return (
                originalZone &&
                JSON.stringify(zone.dimensionLines) !== JSON.stringify(originalZone.dimensionLines)
            );
        });

        if (hasChanges && pushToHistory) {
            pushToHistory({
                exclusionZones: updatedExclusionZones,
            });
        }

        prevDimensionStateRef.current = currentDimensionState;
        isUpdatingRef.current = false;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        dimensionLineAngleOffset,
        history.present.exclusionAreas,
        history.present.mainArea,
        history.present.exclusionZones,
        pushToHistory,
    ]);

    useEffect(() => {
        return () => {
            isUpdatingRef.current = false;
        };
    }, []);

    const handleUndo = useCallback(() => {
        dispatchHistory({ type: 'UNDO' });
    }, []);

    const handleRedo = useCallback(() => {
        dispatchHistory({ type: 'REDO' });
    }, []);

    const togglePipeConnectionMode = useCallback(() => {
        pushToHistory({
            pipeConnection: {
                isActive: !history.present.pipeConnection.isActive,
                selectedPoints: [],
                tempConnections: [],
            },
        });
    }, [history.present.pipeConnection.isActive, pushToHistory]);

    // ฟังก์ชันหาท่อย่อยที่ผ่านต้นไม้ - รับ lateralPipes เป็น parameter เพื่อใช้ข้อมูลล่าสุด
    const findLateralPipePassingThroughPlant = useCallback(
        (plant: PlantLocation, currentLateralPipes?: any[]): any | null => {
            const threshold = 5; // ระยะห่างในการตรวจสอบ (เมตร)
            const pipesToCheck = currentLateralPipes || history.present.lateralPipes;

            for (const lateralPipe of pipesToCheck) {
                if (!lateralPipe.coordinates || lateralPipe.coordinates.length < 2) continue;

                // ตรวจสอบแต่ละส่วนของท่อย่อย
                for (let i = 0; i < lateralPipe.coordinates.length - 1; i++) {
                    const segmentStart = lateralPipe.coordinates[i];
                    const segmentEnd = lateralPipe.coordinates[i + 1];

                    // หาจุดที่ใกล้ที่สุดบนส่วนท่อนี้
                    const closestPoint = findClosestPointOnLineSegment(
                        plant.position,
                        segmentStart,
                        segmentEnd
                    );

                    // คำนวณระยะห่าง
                    const distance = calculateDistanceBetweenPoints(plant.position, closestPoint);

                    if (distance <= threshold) {
                        return lateralPipe;
                    }
                }
            }

            return null;
        },
        [history.present.lateralPipes]
    );

    // ฟังก์ชันรวมท่อย่อยเป็นเส้นเดียวกัน
    const mergeLateralPipes = useCallback(
        (existingPipe: any, newCoordinates: Coordinate[], newPlants: PlantLocation[]) => {
            // รวม coordinates โดยเชื่อมต่อกัน
            const mergedCoordinates = [...existingPipe.coordinates, ...newCoordinates];

            // รวม plants โดยไม่ให้ซ้ำ
            const existingPlantIds = new Set(existingPipe.plants.map((p: any) => p.id));
            const uniqueNewPlants = newPlants.filter((plant) => !existingPlantIds.has(plant.id));
            const mergedPlants = [...existingPipe.plants, ...uniqueNewPlants];

            // คำนวณค่าใหม่
            const mergedLength = calculatePipeLength(mergedCoordinates);
            const mergedWaterNeed = mergedPlants.reduce(
                (sum, plant) => sum + (plant.plantData?.waterNeed || 0),
                0
            );
            const sprinklerConfig = loadSprinklerConfig();
            const mergedFlowRate = mergedPlants.length * (sprinklerConfig?.flowRatePerMinute || 0);

            return {
                ...existingPipe,
                coordinates: mergedCoordinates,
                length: mergedLength,
                plants: mergedPlants,
                totalWaterNeed: mergedWaterNeed,
                totalFlowRate: mergedFlowRate,
                plantCount: mergedPlants.length,
                // รวม emitterLines ถ้ามี
                emitterLines: [
                    ...(existingPipe.emitterLines || []),
                    // สร้าง emitterLines ใหม่สำหรับ plants ที่เพิ่มเข้ามา
                    ...generateEmitterLines(
                        existingPipe.id,
                        newCoordinates[0],
                        newCoordinates[newCoordinates.length - 1],
                        uniqueNewPlants,
                        4,
                        existingPipe.placementMode
                    ),
                ],
            };
        },
        []
    );

    const createConnectionPipe = useCallback(
        (fromPoint: any, toPoint: any) => {
            // รวบรวมต้นไม้ทั้งหมดที่คลิก
            const plants: PlantLocation[] = [];
            if (fromPoint.type === 'plant') {
                plants.push(fromPoint.data);
            }
            if (toPoint.type === 'plant') {
                plants.push(toPoint.data);
            }
            const totalWaterNeed = plants.reduce(
                (sum, plant) => sum + (plant.plantData?.waterNeed || 0),
                0
            );
            const pipeLength = calculateDistanceBetweenPoints(fromPoint.position, toPoint.position);

            // 🚀 ใช้ข้อมูลท่อย่อยล่าสุดจาก ref (รวมท่อที่เพิ่งสร้างใหม่)
            const currentLateralPipes = latestLateralPipesRef.current;

            // 🚀 ตรวจสอบว่ามีการเชื่อมต่อกับท่อย่อยที่มีอยู่แล้วหรือไม่
            let fromLateralPipe =
                fromPoint.type === 'lateralPipe'
                    ? currentLateralPipes.find((pipe) => pipe.id === fromPoint.id)
                    : null;
            let toLateralPipe =
                toPoint.type === 'lateralPipe'
                    ? currentLateralPipes.find((pipe) => pipe.id === toPoint.id)
                    : null;

            // 🌱 ตรวจสอบว่าต้นไม้มีท่อย่อยผ่านหรือไม่ - ส่งข้อมูลท่อล่าสุดเข้าไป
            if (fromPoint.type === 'plant' && !fromLateralPipe) {
                fromLateralPipe = findLateralPipePassingThroughPlant(
                    fromPoint.data,
                    currentLateralPipes
                );
            }
            if (toPoint.type === 'plant' && !toLateralPipe) {
                toLateralPipe = findLateralPipePassingThroughPlant(
                    toPoint.data,
                    currentLateralPipes
                );
            }

            if (fromLateralPipe && toLateralPipe) {
                // 🔄 รวมสองท่อย่อยเป็นเส้นเดียว
                const mergedPipe = mergeLateralPipes(
                    fromLateralPipe,
                    [fromPoint.position, toPoint.position],
                    toLateralPipe.plants
                );

                // รวม coordinates ของท่อทั้งสอง
                mergedPipe.coordinates = [
                    ...fromLateralPipe.coordinates,
                    fromPoint.position,
                    toPoint.position,
                    ...toLateralPipe.coordinates,
                ];

                // รวม plants จากท่อทั้งสอง
                const allPlantIds = new Set<string>();
                const allPlants: PlantLocation[] = [];

                [...fromLateralPipe.plants, ...toLateralPipe.plants].forEach(
                    (plant: PlantLocation) => {
                        if (!allPlantIds.has(plant.id)) {
                            allPlantIds.add(plant.id);
                            allPlants.push(plant);
                        }
                    }
                );

                mergedPipe.plants = allPlants;
                mergedPipe.plantCount = allPlants.length;
                mergedPipe.length = calculatePipeLength(mergedPipe.coordinates);
                mergedPipe.totalWaterNeed = allPlants.reduce(
                    (sum, plant) => sum + (plant.plantData?.waterNeed || 0),
                    0
                );
                mergedPipe.totalFlowRate =
                    allPlants.length * (loadSprinklerConfig()?.flowRatePerMinute || 0);

                console.log('✅ ผลลัพธ์ (รวมสองท่อ):', {
                    mergedPipeId: mergedPipe.id,
                    plantCount: mergedPipe.plants?.length || 0,
                    plants: mergedPipe.plants?.map((p: any) => p.id) || [],
                });

                // ลบท่อเดิมทั้งสองและเพิ่มท่อที่รวมแล้ว
                const updatedLateralPipes = latestLateralPipesRef.current
                    .filter(
                        (pipe) => pipe.id !== fromLateralPipe.id && pipe.id !== toLateralPipe.id
                    )
                    .concat([mergedPipe]);

                pushToHistory({
                    lateralPipes: updatedLateralPipes,
                    pipeConnection: {
                        ...history.present.pipeConnection,
                        selectedPoints: [],
                    },
                });
            } else if (fromLateralPipe || toLateralPipe) {
                // 🔗 เชื่อมต่อกับท่อย่อยที่มีอยู่แล้ว
                const existingPipe = fromLateralPipe || toLateralPipe;

                // 🌱 ตรวจสอบกรณีต่างๆ ของการเชื่อมต่อ
                const bothPlantsHavePipes =
                    fromPoint.type === 'plant' &&
                    fromLateralPipe &&
                    toPoint.type === 'plant' &&
                    toLateralPipe;

                const onePlantHasPipe =
                    (fromPoint.type === 'plant' &&
                        fromLateralPipe &&
                        toPoint.type === 'plant' &&
                        !toLateralPipe) ||
                    (fromPoint.type === 'plant' &&
                        !fromLateralPipe &&
                        toPoint.type === 'plant' &&
                        toLateralPipe);

                if (bothPlantsHavePipes) {
                    // 🔄 กรณีต้นไม้ทั้งสองมีท่อย่อยผ่าน: รวมท่อทั้งสองเป็นเส้นเดียว

                    // รวบรวมต้นไม้ทั้งหมดจากท่อทั้งสอง
                    const allPlantsFromBothPipes: PlantLocation[] = [...plants]; // ต้นไม้ที่คลิก

                    // เพิ่มต้นไม้จากท่อแรก
                    if (fromLateralPipe) {
                        fromLateralPipe.plants.forEach((plant: any) => {
                            if (!allPlantsFromBothPipes.some((p) => p.id === plant.id)) {
                                allPlantsFromBothPipes.push(plant);
                            }
                        });
                    }

                    // เพิ่มต้นไม้จากท่อที่สอง
                    if (toLateralPipe) {
                        toLateralPipe.plants.forEach((plant: any) => {
                            if (!allPlantsFromBothPipes.some((p) => p.id === plant.id)) {
                                allPlantsFromBothPipes.push(plant);
                            }
                        });
                    }

                    // รวม coordinates จากท่อทั้งสอง + เส้นเชื่อมต่อ
                    const mergedCoordinates = [
                        ...fromLateralPipe!.coordinates,
                        fromPoint.position,
                        toPoint.position,
                        ...toLateralPipe!.coordinates,
                    ];

                    // สร้างท่อรวมใหม่ (เส้นเดียว)
                    const mergedPipe = {
                        ...fromLateralPipe!,
                        coordinates: mergedCoordinates,
                        length:
                            fromLateralPipe!.length +
                            calculateDistanceBetweenPoints(fromPoint.position, toPoint.position) +
                            toLateralPipe!.length,
                        plants: allPlantsFromBothPipes, // รวมต้นไม้ทั้งหมด
                        plantCount: allPlantsFromBothPipes.length,
                        totalFlowRate:
                            allPlantsFromBothPipes.length *
                            (loadSprinklerConfig()?.flowRatePerMinute || 0),
                        totalWaterNeed: allPlantsFromBothPipes.reduce(
                            (sum, plant) => sum + (plant.plantData?.waterNeed || 0),
                            0
                        ),
                    } as any;

                    // ลบท่อเดิมทั้งสองและเพิ่มท่อรวม
                    const updatedLateralPipes = latestLateralPipesRef.current
                        .filter(
                            (pipe) =>
                                pipe.id !== fromLateralPipe!.id && pipe.id !== toLateralPipe!.id
                        )
                        .concat([mergedPipe]);

                    pushToHistory({
                        lateralPipes: updatedLateralPipes,
                        pipeConnection: {
                            ...history.present.pipeConnection,
                            selectedPoints: [],
                        },
                    });

                    // 🚀 อัปเดต ref ทันทีเพื่อให้การเชื่อมต่อครั้งต่อไปใช้ข้อมูลล่าสุด
                    latestLateralPipesRef.current = updatedLateralPipes;
                } else if (onePlantHasPipe) {
                    // 🔗 กรณีต้นไม้หนึ่งมีท่อย่อย อีกต้นไม่มี: สร้างท่อเชื่อมต่อที่เป็นกลุ่มเดียวกัน

                    // รวบรวมต้นไม้ทั้งหมดที่เกี่ยวข้อง
                    const allPlantsForGroup: PlantLocation[] = [...existingPipe!.plants]; // ต้นไม้เดิม

                    // เพิ่มต้นไม้ใหม่ที่ยังไม่อยู่ในท่อเดิม
                    plants.forEach((plant) => {
                        if (!allPlantsForGroup.some((p) => p.id === plant.id)) {
                            allPlantsForGroup.push(plant);
                        }
                    });

                    // สร้าง groupId สำหรับกลุ่มท่อ
                    const groupId = (existingPipe! as any).groupId || existingPipe!.id;

                    // อัปเดตท่อเดิมให้มี groupId และต้นไม้ทั้งหมด
                    const updatedExistingPipe = {
                        ...existingPipe!,
                        plants: allPlantsForGroup,
                        plantCount: allPlantsForGroup.length,
                        totalWaterNeed: allPlantsForGroup.reduce(
                            (sum, plant) => sum + (plant.plantData?.waterNeed || 0),
                            0
                        ),
                        groupId: groupId, // เพิ่ม groupId
                    };

                    // อัปเดต totalFlowRate ถ้ามี property นี้
                    if ('totalFlowRate' in updatedExistingPipe) {
                        (updatedExistingPipe as any).totalFlowRate =
                            allPlantsForGroup.length *
                            (loadSprinklerConfig()?.flowRatePerMinute || 0);
                    }

                    // สร้างท่อเชื่อมต่อใหม่ (เส้นระหว่าง 2 ต้นไม้ที่คลิก) ที่อยู่ในกลุ่มเดียวกัน
                    const connectionPipe = {
                        id: generateLateralPipeId(),
                        coordinates: [fromPoint.position, toPoint.position],
                        length: calculateDistanceBetweenPoints(
                            fromPoint.position,
                            toPoint.position
                        ),
                        plants: allPlantsForGroup, // ต้นไม้ทั้งหมดในกลุ่ม
                        placementMode: 'over_plants' as 'over_plants' | 'between_plants',
                        totalFlowRate:
                            allPlantsForGroup.length *
                            (loadSprinklerConfig()?.flowRatePerMinute || 0),
                        connectionPoint: fromPoint.position,
                        totalWaterNeed: allPlantsForGroup.reduce(
                            (sum, plant) => sum + (plant.plantData?.waterNeed || 0),
                            0
                        ),
                        plantCount: allPlantsForGroup.length,
                        emitterLines: [],
                        groupId: groupId, // ใช้ groupId เดียวกัน
                        isConnectionSegment: true, // ระบุว่าเป็นส่วนเชื่อมต่อ
                    } as any;

                    // อัปเดต lateralPipes: แทนที่ท่อเดิม + เพิ่มท่อเชื่อมต่อ
                    const updatedLateralPipes = latestLateralPipesRef.current
                        .map((pipe) => (pipe.id === existingPipe!.id ? updatedExistingPipe : pipe))
                        .concat([connectionPipe]);

                    pushToHistory({
                        lateralPipes: updatedLateralPipes,
                        pipeConnection: {
                            ...history.present.pipeConnection,
                            selectedPoints: [],
                        },
                    });

                    // 🚀 อัปเดต ref ทันทีเพื่อให้การเชื่อมต่อครั้งต่อไปใช้ข้อมูลล่าสุด
                    latestLateralPipesRef.current = updatedLateralPipes;
                } else {
                    // 🔗 กรณีปกติ: เชื่อมต่อกับท่อย่อยโดยสร้างเส้นทางใหม่
                    const allPlantsToAdd: PlantLocation[] = [...plants];
                    const newCoordinates = [fromPoint.position, toPoint.position];
                    const mergedPipe = mergeLateralPipes(
                        existingPipe!,
                        newCoordinates,
                        allPlantsToAdd
                    );

                    // อัปเดตรายการท่อย่อย
                    const updatedLateralPipes = latestLateralPipesRef.current.map((pipe) =>
                        pipe.id === existingPipe!.id ? mergedPipe : pipe
                    );

                    pushToHistory({
                        lateralPipes: updatedLateralPipes,
                        pipeConnection: {
                            ...history.present.pipeConnection,
                            selectedPoints: [],
                        },
                    });

                    // 🚀 อัปเดต ref ทันทีเพื่อให้การเชื่อมต่อครั้งต่อไปใช้ข้อมูลล่าสุด
                    latestLateralPipesRef.current = updatedLateralPipes;
                }
            } else {
                // 🆕 สร้างท่อย่อยใหม่ (กรณีไม่มีการเชื่อมต่อกับท่อย่อยที่มีอยู่)

                // 🌱 รวบรวมต้นไม้ทั้งหมดที่เกี่ยวข้อง (รวมต้นไม้ที่มีท่อผ่านด้วย)
                const allPlantsForNewPipe: PlantLocation[] = [...plants]; // ต้นไม้ที่คลิก

                // เพิ่มต้นไม้จากท่อที่มีอยู่แล้ว (ถ้ามี)
                if (fromPoint.type === 'plant' && fromLateralPipe) {
                    (fromLateralPipe as any).plants.forEach((plant: any) => {
                        if (!allPlantsForNewPipe.some((p) => p.id === plant.id)) {
                            allPlantsForNewPipe.push(plant);
                        }
                    });
                }
                if (toPoint.type === 'plant' && toLateralPipe) {
                    (toLateralPipe as any).plants.forEach((plant: any) => {
                        if (!allPlantsForNewPipe.some((p) => p.id === plant.id)) {
                            allPlantsForNewPipe.push(plant);
                        }
                    });
                }

                const newLateralPipe = {
                    id: generateLateralPipeId(),
                    coordinates: [fromPoint.position, toPoint.position],
                    length: pipeLength,
                    plants: allPlantsForNewPipe, // ใช้ต้นไม้ทั้งหมดที่รวบรวมได้
                    placementMode: 'over_plants' as 'over_plants' | 'between_plants',
                    totalFlowRate:
                        allPlantsForNewPipe.length *
                        (loadSprinklerConfig()?.flowRatePerMinute || 0),
                    connectionPoint: fromPoint.position,
                    totalWaterNeed: allPlantsForNewPipe.reduce(
                        (sum, plant) => sum + (plant.plantData?.waterNeed || 0),
                        0
                    ),
                    plantCount: allPlantsForNewPipe.length,
                    emitterLines: [],
                } as any;

                // ลบท่อเดิมที่รวมเข้าท่อใหม่แล้ว (ถ้ามี) และเพิ่มท่อใหม่
                let updatedLateralPipes = latestLateralPipesRef.current;

                // ลบท่อเดิมที่มีอยู่ (ถ้ามี)
                if (fromLateralPipe) {
                    updatedLateralPipes = updatedLateralPipes.filter(
                        (pipe) => pipe.id !== (fromLateralPipe as any).id
                    );
                }
                if (toLateralPipe && (toLateralPipe as any).id !== (fromLateralPipe as any)?.id) {
                    updatedLateralPipes = updatedLateralPipes.filter(
                        (pipe) => pipe.id !== (toLateralPipe as any).id
                    );
                }

                // เพิ่มท่อใหม่
                updatedLateralPipes = [...updatedLateralPipes, newLateralPipe];

                pushToHistory({
                    lateralPipes: updatedLateralPipes,
                    pipeConnection: {
                        ...history.present.pipeConnection,
                        selectedPoints: [],
                    },
                });

                // 🚀 อัปเดต ref ทันทีเพื่อให้การเชื่อมต่อครั้งต่อไปใช้ข้อมูลล่าสุด
                latestLateralPipesRef.current = updatedLateralPipes;
            }
        },
        [
            history.present.pipeConnection,
            pushToHistory,
            mergeLateralPipes,
            findLateralPipePassingThroughPlant,
        ]
    );

    const handlePlantClickInConnectionMode = useCallback(
        (plant: PlantLocation) => {
            if (!history.present.pipeConnection.isActive) return;

            const newPoint = {
                id: plant.id,
                type: 'plant' as const,
                position: plant.position,
                data: plant,
            };

            const existingIndex = history.present.pipeConnection.selectedPoints.findIndex(
                (p) => p.id === plant.id
            );

            if (existingIndex >= 0) {
                const updatedPoints = [...history.present.pipeConnection.selectedPoints];
                updatedPoints.splice(existingIndex, 1);

                pushToHistory({
                    pipeConnection: {
                        ...history.present.pipeConnection,
                        selectedPoints: updatedPoints as any,
                    },
                });
            } else {
                const updatedPoints = [...history.present.pipeConnection.selectedPoints, newPoint];

                pushToHistory({
                    pipeConnection: {
                        ...history.present.pipeConnection,
                        selectedPoints: updatedPoints as any,
                    },
                });

                if (updatedPoints.length >= 2) {
                    const lastTwoPoints = updatedPoints.slice(-2);
                    createConnectionPipe(lastTwoPoints[0], lastTwoPoints[1]);
                }
            }
        },
        [history.present.pipeConnection, pushToHistory, createConnectionPipe]
    );

    const handlePipeClickInConnectionMode = useCallback(
        (pipeId: string, pipeType: 'subMainPipe' | 'lateralPipe', position: Coordinate) => {
            if (!history.present.pipeConnection.isActive) return;

            const newPoint = {
                id: pipeId,
                type: pipeType,
                position: position,
                data: { pipeId, pipeType },
            };

            const existingIndex = history.present.pipeConnection.selectedPoints.findIndex(
                (p) => p.id === pipeId
            );

            if (existingIndex >= 0) {
                const updatedPoints = [...history.present.pipeConnection.selectedPoints];
                updatedPoints.splice(existingIndex, 1);

                pushToHistory({
                    pipeConnection: {
                        ...history.present.pipeConnection,
                        selectedPoints: updatedPoints as any,
                    },
                });
            } else {
                const updatedPoints = [...history.present.pipeConnection.selectedPoints, newPoint];

                pushToHistory({
                    pipeConnection: {
                        ...history.present.pipeConnection,
                        selectedPoints: updatedPoints as any,
                    },
                });

                if (updatedPoints.length >= 2) {
                    const lastTwoPoints = updatedPoints.slice(-2);
                    createConnectionPipe(lastTwoPoints[0], lastTwoPoints[1]);
                }
            }
        },
        [history.present.pipeConnection, pushToHistory, createConnectionPipe]
    );

    useEffect(() => {
        const isEditingExisting = localStorage.getItem('isEditingExistingProject');
        const savedData = localStorage.getItem('horticultureIrrigationData');

        // Check if we're editing a field from the database
        const urlParams = new URLSearchParams(window.location.search);
        const editFieldId = urlParams.get('editFieldId');

        if (editFieldId) {
            // Load field data from database
            loadFieldDataFromDatabase(editFieldId);
        } else if (isEditingExisting === 'true' && savedData) {
            try {
                const projectData = JSON.parse(savedData);

                const loadedState: ProjectState = {
                    ...initialState,
                    mainArea: projectData.mainArea || [],
                    zones: projectData.zones || [],
                    pump: projectData.pump || null,
                    mainPipes: projectData.mainPipes || [],
                    subMainPipes: projectData.subMainPipes || [],
                    lateralPipes: projectData.lateralPipes || [], // เพิ่ม lateral pipes
                    plants: projectData.plants || [],
                    exclusionAreas: projectData.exclusionAreas || [],
                    irrigationZones: projectData.irrigationZones || [], // เพิ่ม irrigation zones
                    useZones: projectData.useZones || false,
                    selectedPlantType: projectData.selectedPlantType || DEFAULT_PLANT_TYPES(t)[0],
                    availablePlants: projectData.availablePlants || DEFAULT_PLANT_TYPES(t),
                    branchPipeSettings: projectData.branchPipeSettings || {
                        defaultAngle: 90,
                        maxAngle: 180,
                        minAngle: 0,
                        angleStep: 1,
                    },
                };

                dispatchHistory({ type: 'PUSH_STATE', state: loadedState });

                if (projectData.mainArea && projectData.mainArea.length > 0) {
                    setTimeout(() => {
                        if (mapRef.current) {
                            try {
                                const bounds = new google.maps.LatLngBounds();

                                projectData.mainArea.forEach((coord: any) => {
                                    bounds.extend(new google.maps.LatLng(coord.lat, coord.lng));
                                });

                                mapRef.current.fitBounds(bounds, {
                                    top: 50,
                                    right: 50,
                                    bottom: 50,
                                    left: 50,
                                });
                            } catch (error) {
                                console.warn('⚠️ Could not auto-zoom to area:', error);
                            }
                        }
                    }, 1000);
                }

                localStorage.removeItem('isEditingExistingProject');
            } catch (error) {
                console.error('❌ Error loading project data:', error);
                localStorage.removeItem('isEditingExistingProject');
            }
        }
    }, [initialState, t]);

    const regeneratePlantsForAllZones = (state: ProjectState) => {
        try {
            console.log('🔄 Regenerating plants for all zones...');

            // If plants already exist, don't regenerate them
            if (state.plants && state.plants.length > 0) {
                console.log(
                    '✅ Plants already exist, skipping regeneration:',
                    state.plants.length,
                    'plants'
                );
                return;
            }

            const updatedState = { ...state };
            let allPlants: PlantLocation[] = [];

            // Regenerate plants for each zone
            if (state.useZones && state.zones.length > 0) {
                state.zones.forEach((zone) => {
                    // Find sub-main pipes for this zone
                    const zoneSubMainPipes = state.subMainPipes.filter(
                        (pipe) => pipe.zoneId === zone.id
                    );

                    zoneSubMainPipes.forEach((_subMainPipe) => {
                        // TODO: Implement generateEnhancedBranchPipes function
                        const branchPipes: any[] = [];

                        // Collect plants from all branch pipes
                        branchPipes.forEach((branch) => {
                            if (branch.plants) {
                                allPlants = [...allPlants, ...branch.plants];
                            }
                        });
                    });
                });
            } else {
                // For non-zone mode, regenerate plants for all sub-main pipes
                state.subMainPipes.forEach((subMainPipe) => {
                    // TODO: Implement generateEnhancedBranchPipes function
                    const branchPipes: any[] = [];

                    // Collect plants from all branch pipes
                    branchPipes.forEach((branch) => {
                        if (branch.plants) {
                            allPlants = [...allPlants, ...branch.plants];
                        }
                    });
                });
            }

            // Only update plants if we actually generated some
            if (allPlants.length > 0) {
                updatedState.plants = allPlants;
                // Update history with the new state
                dispatchHistory({ type: 'PUSH_STATE', state: updatedState });
                console.log('✅ Plants regenerated successfully:', allPlants.length, 'plants');
            } else {
                console.log('⚠️ No plants generated, keeping existing plants');
            }
        } catch (error) {
            console.error('❌ Error regenerating plants:', error);
        }
    };

    const loadFieldDataFromDatabase = async (fieldId: string) => {
        try {
            console.log('🔄 Loading field data from database:', fieldId);

            const response = await axios.get(`/api/fields/${fieldId}`);

            if (response.data.success && response.data.field) {
                const fieldData = response.data.field;
                console.log('📦 Field data loaded:', fieldData);

                // Extract project data from the field
                const projectData = fieldData.project_data || {};
                // const projectStats = fieldData.project_stats || {};

                // Convert the data to the format expected by the planner
                const loadedState: ProjectState = {
                    ...initialState,
                    mainArea: projectData.mainArea || [],
                    zones: projectData.zones || [],
                    pump: projectData.pump || null,
                    mainPipes: projectData.mainPipes || [],
                    subMainPipes: projectData.subMainPipes || [],
                    lateralPipes: projectData.lateralPipes || [], // Add lateral pipes
                    plants: projectData.plants || [],
                    exclusionAreas: projectData.exclusionAreas || [],
                    irrigationZones: projectData.irrigationZones || [], // Add irrigation zones
                    useZones: projectData.useZones || false,
                    selectedPlantType: projectData.selectedPlantType || DEFAULT_PLANT_TYPES(t)[0],
                    availablePlants: projectData.availablePlants || DEFAULT_PLANT_TYPES(t), // Use saved available plants
                    branchPipeSettings: projectData.branchPipeSettings || {
                        defaultAngle: 90,
                        maxAngle: 180,
                        minAngle: 0,
                        angleStep: 1,
                    },
                    lateralPipeSettings: projectData.lateralPipeSettings || {
                        placementMode: 'over_plants',
                        snapThreshold: 5,
                        autoGenerateEmitters: true,
                        emitterDiameter: 4,
                    },
                };

                // Store the field ID for later use when saving
                if (!safeLocalStorageSet('currentFieldId', fieldId)) {
                    console.error('❌ Failed to save currentFieldId');
                }
                if (!safeLocalStorageSet('currentFieldName', fieldData.name || 'Edited Field')) {
                    console.error('❌ Failed to save currentFieldName');
                }

                // Set flag to indicate we're editing an existing field
                setIsEditingExistingField(true);

                console.log('📊 Loaded state:', loadedState);
                console.log('🗺️ Main area coordinates:', loadedState.mainArea);
                console.log('🚫 Exclusion areas:', loadedState.exclusionAreas);
                console.log('🌱 Plants loaded:', loadedState.plants.length);
                console.log('🏗️ Zones loaded:', loadedState.zones.length);
                console.log('💧 Irrigation zones loaded:', loadedState.irrigationZones.length);
                console.log('🔧 Lateral pipes loaded:', loadedState.lateralPipes.length);

                dispatchHistory({ type: 'PUSH_STATE', state: loadedState });

                // Force map refresh and regenerate plants
                setTimeout(() => {
                    console.log('🔄 Forcing map refresh...');

                    // Trigger a map resize to force re-render
                    if (mapRef.current) {
                        google.maps.event.trigger(mapRef.current, 'resize');
                    }

                    // Regenerate plants for all zones to ensure proper display
                    regeneratePlantsForAllZones(loadedState);
                }, 500);

                // Auto-zoom to the main area
                if (projectData.mainArea && projectData.mainArea.length > 0) {
                    setTimeout(() => {
                        if (mapRef.current) {
                            try {
                                const bounds = new google.maps.LatLngBounds();

                                projectData.mainArea.forEach((coord: any) => {
                                    bounds.extend(new google.maps.LatLng(coord.lat, coord.lng));
                                });

                                mapRef.current.fitBounds(bounds, {
                                    top: 50,
                                    right: 50,
                                    bottom: 50,
                                    left: 50,
                                });

                                console.log('✅ Auto-zoomed to main area');
                            } catch (error) {
                                console.warn('⚠️ Could not auto-zoom to area:', error);
                            }
                        }
                    }, 1000);
                }

                console.log('✅ Field data loaded successfully');
            } else {
                console.error('❌ Failed to load field data:', response.data);
                alert(t('failed_to_load_field'));
            }
        } catch (error) {
            console.error('❌ Error loading field data:', error);
            alert(t('error_loading_field'));
        }
    };

    const tabs = [
        {
            id: 'area',
            name: t('พื้นที่'),
            icon: '🗺️',
            description: t('จัดการพื้นที่หลักและโซน'),
        },
        {
            id: 'water',
            name: t('ระบบน้ำ'),
            icon: '💧',
            description: t('ปั๊มและท่อน้ำ'),
        },
        {
            id: 'summary',
            name: t('สรุป'),
            icon: '📊',
            description: t('สถิติและบันทึก'),
        },
    ];

    const _handleToggleEditMode = useCallback(() => {
        if (!canEnableEditMode) {
            alert(t('กรุณาสร้างพื้นที่หลัก ปั๊ม และสร้างท่อพร้อมต้นไม้ก่อนเข้าสู่โหมดแก้ไข'));
            return;
        }

        const newEditModeEnabled = !history.present.isEditModeEnabled;

        pushToHistory({
            isEditModeEnabled: newEditModeEnabled,
            selectedItems: { plants: [], pipes: [], zones: [] },
        });

        if (!newEditModeEnabled) {
            setEditMode(null);
            setShowQuickActionPanel(false);
        } else {
            setShowQuickActionPanel(true);
        }

        setIsNewPlantMode(false);
        setIsCreatingConnection(false);
        setConnectionStartPlant(null);
        setHighlightedPipes([]);
        setDragMode('none');
        setTempConnectionLine(null);
        setIsDeleteMode(false); // รีเซ็ตโหมดลบเมื่อเปลี่ยนโหมดแก้ไข
    }, [canEnableEditMode, history.present.isEditModeEnabled, pushToHistory, t]);

    const handleSelectItem = useCallback(
        (id: string, type: 'plants' | 'pipes' | 'zones') => {
            const currentSelection = history.present.selectedItems[type];
            const isSelected = currentSelection.includes(id);

            let newSelection: string[];

            if (history.present.editModeSettings.selectionMode === 'multi') {
                newSelection = isSelected
                    ? currentSelection.filter((item) => item !== id)
                    : [...currentSelection, id];
            } else {
                newSelection = isSelected ? [] : [id];
            }

            pushToHistory({
                selectedItems: {
                    ...history.present.selectedItems,
                    [type]: newSelection,
                },
            });
        },
        [
            history.present.selectedItems,
            history.present.editModeSettings.selectionMode,
            pushToHistory,
        ]
    );

    const _handleSelectAll = useCallback(
        (type: 'plants' | 'pipes' | 'zones') => {
            let allIds: string[] = [];

            switch (type) {
                case 'plants':
                    allIds = history.present.plants.map((plant) => plant.id);
                    break;
                case 'pipes':
                    allIds = [
                        ...history.present.mainPipes.map((pipe) => pipe.id),
                        ...history.present.subMainPipes.map((pipe) => pipe.id),
                        ...history.present.subMainPipes.flatMap((sm) =>
                            sm.branchPipes.map((bp) => bp.id)
                        ),
                    ];
                    break;
                case 'zones':
                    allIds = history.present.zones.map((zone) => zone.id);
                    break;
            }

            pushToHistory({
                selectedItems: {
                    ...history.present.selectedItems,
                    [type]: allIds,
                },
            });
        },
        [history.present, pushToHistory]
    );

    const handleClearSelection = useCallback(() => {
        pushToHistory({
            selectedItems: { plants: [], pipes: [], zones: [] },
        });
    }, [pushToHistory]);

    const handleDeleteSpecificPlants = useCallback(
        (plantIds: string[]) => {
            const remainingPlants = history.present.plants.filter(
                (plant) => !plantIds.includes(plant.id)
            );

            const updatedSubMainPipes = history.present.subMainPipes.map((subMain) => ({
                ...subMain,
                branchPipes: subMain.branchPipes.map((branch) => {
                    const remainingBranchPlants = branch.plants.filter(
                        (plant) => !plantIds.includes(plant.id)
                    );

                    if (remainingBranchPlants.length === 0) {
                        return {
                            ...branch,
                            plants: [],
                        };
                    }

                    const lastPlant = remainingBranchPlants[remainingBranchPlants.length - 1];
                    const newCoordinates = [branch.coordinates[0], lastPlant.position];

                    return {
                        ...branch,
                        plants: remainingBranchPlants,
                        coordinates: newCoordinates,
                        length: calculatePipeLength(newCoordinates),
                    };
                }),
            }));

            pushToHistory({
                plants: remainingPlants,
                subMainPipes: updatedSubMainPipes,
                selectedItems: { plants: [], pipes: [], zones: [] },
            });
        },
        [history.present, pushToHistory]
    );

    const handleDeleteBranchPipe = useCallback(
        (branchPipeIds: string[]) => {
            const updatedSubMainPipes = history.present.subMainPipes.map((subMain) => {
                const remainingBranchPipes = subMain.branchPipes.filter((branch) => {
                    return !branchPipeIds.includes(branch.id);
                });

                return {
                    ...subMain,
                    branchPipes: remainingBranchPipes,
                };
            });

            pushToHistory({
                subMainPipes: updatedSubMainPipes,
                selectedItems: { plants: [], pipes: [], zones: [] },
            });
        },
        [history.present, pushToHistory]
    );

    const handleDeletePump = useCallback(() => {
        if (!confirm(t('คุณต้องการลบปั๊มน้ำนี้หรือไม่?'))) {
            return;
        }

        pushToHistory({
            pump: null,
        });
    }, [pushToHistory, t]);

    const handleDeletePipeSegment = useCallback(
        (branchPipeId: string, segmentIndex: number) => {
            const updatedSubMainPipes = history.present.subMainPipes.map((subMain) => ({
                ...subMain,
                branchPipes: subMain.branchPipes
                    .map((branch) => {
                        if (branch.id !== branchPipeId) return branch;

                        if (branch.plants.length <= 2) {
                            return null;
                        }

                        const beforePlants = branch.plants.slice(0, segmentIndex + 1);
                        const afterPlants = branch.plants.slice(segmentIndex + 1);

                        if (beforePlants.length >= 2) {
                            const newCoordinates1 = [
                                branch.coordinates[0],
                                ...beforePlants.map((plant) => plant.position),
                            ];

                            return {
                                ...branch,
                                plants: beforePlants,
                                coordinates: newCoordinates1,
                                length: calculatePipeLength(newCoordinates1),
                                id: generateUniqueId('branch'),
                            };
                        }

                        if (afterPlants.length >= 1) {
                            const newCoordinates = [
                                branch.coordinates[0],
                                ...beforePlants.map((plant) => plant.position),
                            ];

                            return {
                                ...branch,
                                plants: beforePlants,
                                coordinates: newCoordinates,
                                length: calculatePipeLength(newCoordinates),
                            };
                        }

                        return branch;
                    })
                    .filter(Boolean) as BranchPipe[],
            }));

            pushToHistory({
                subMainPipes: updatedSubMainPipes,
                selectedItems: { plants: [], pipes: [], zones: [] },
            });
        },
        [history.present, pushToHistory]
    );

    const handleSegmentedPipeDeletion = useCallback(
        (branchPipeId: string) => {
            let targetBranch: BranchPipe | null = null;
            for (const subMain of history.present.subMainPipes) {
                const branch = subMain.branchPipes.find((bp) => bp.id === branchPipeId);
                if (branch) {
                    targetBranch = branch;
                    break;
                }
            }

            if (targetBranch) {
                setSelectedBranchForSegment(targetBranch);
                setShowPipeSegmentModal(true);
            }
        },
        [history.present.subMainPipes]
    );

    const handleBatchDelete = useCallback(() => {
        const { plants: plantIds, pipes: pipeIds, zones: zoneIds } = history.present.selectedItems;
        const remainingPlants = history.present.plants.filter(
            (plant) => !plantIds.includes(plant.id)
        );

        const remainingMainPipes = history.present.mainPipes.filter(
            (pipe) => !pipeIds.includes(pipe.id)
        );
        const remainingSubMainPipes = history.present.subMainPipes
            .filter((pipe) => !pipeIds.includes(pipe.id))
            .map((subMain) => ({
                ...subMain,
                branchPipes: subMain.branchPipes.filter((branch) => !pipeIds.includes(branch.id)),
            }));

        const deletedSubMainPipes = history.present.subMainPipes.filter((pipe) =>
            pipeIds.includes(pipe.id)
        );
        deletedSubMainPipes.forEach((pipe) => {
            const storageKey = `original-submain-${pipe.id}`;
            localStorage.removeItem(storageKey);
        });

        const remainingZones = history.present.zones.filter((zone) => !zoneIds.includes(zone.id));

        const deletedSubMainIds = history.present.subMainPipes
            .filter((pipe) => pipeIds.includes(pipe.id))
            .map((p) => p.id);
        const remainingLateralPipes = history.present.lateralPipes.filter(
            (lp) => !deletedSubMainIds.includes(lp.subMainPipeId) && !pipeIds.includes(lp.id)
        );

        pushToHistory({
            plants: remainingPlants,
            mainPipes: remainingMainPipes,
            subMainPipes: remainingSubMainPipes,
            zones: remainingZones,
            lateralPipes: remainingLateralPipes,
            selectedItems: { plants: [], pipes: [], zones: [] },
        });
    }, [history.present, pushToHistory]);

    const handleBatchMove = useCallback(
        (offset: Coordinate) => {
            const { plants: plantIds } = history.present.selectedItems;

            const updatedPlants = history.present.plants.map((plant) => {
                if (plantIds.includes(plant.id)) {
                    return {
                        ...plant,
                        position: {
                            lat: plant.position.lat + offset.lat,
                            lng: plant.position.lng + offset.lng,
                        },
                    };
                }
                return plant;
            });

            pushToHistory({ plants: updatedPlants });
        },
        [history.present, pushToHistory]
    );

    const handleBatchCopy = useCallback(() => {
        const { plants: plantIds } = history.present.selectedItems;

        const selectedPlants = history.present.plants.filter((plant) =>
            plantIds.includes(plant.id)
        );

        pushToHistory({
            clipboard: {
                ...history.present.clipboard,
                plants: selectedPlants,
            },
        });
    }, [history.present, pushToHistory]);

    const handleBatchPaste = useCallback(() => {
        const { plants: clipboardPlants } = history.present.clipboard;

        if (clipboardPlants.length === 0) return;

        const offset = { lat: 0.001, lng: 0.001 };

        const pastedPlants = clipboardPlants.map((plant) => ({
            ...plant,
            id: generateUniqueId('plant'),
            position: {
                lat: plant.position.lat + offset.lat,
                lng: plant.position.lng + offset.lng,
            },
        }));

        pushToHistory({
            plants: [...history.present.plants, ...pastedPlants],
        });
    }, [history.present, pushToHistory]);

    const handleCreateTemplate = useCallback(
        (name: string) => {
            const { plants: plantIds, pipes: _pipeIds } = history.present.selectedItems;

            const selectedPlants = history.present.plants.filter((plant) =>
                plantIds.includes(plant.id)
            );

            const _template = {
                name,
                plants: selectedPlants,
                createdAt: new Date().toISOString(),
            };
        },
        [history.present]
    );

    const _handleToggleLayer = useCallback(
        (layer: keyof ProjectState['layerVisibility']) => {
            pushToHistory({
                layerVisibility: {
                    ...history.present.layerVisibility,
                    [layer]: !history.present.layerVisibility[layer],
                },
            });
        },
        [history.present.layerVisibility, pushToHistory]
    );

    const _handleUpdateEditSettings = useCallback(
        (settings: Partial<ProjectState['editModeSettings']>) => {
            pushToHistory({
                editModeSettings: {
                    ...history.present.editModeSettings,
                    ...settings,
                },
            });
        },
        [history.present.editModeSettings, pushToHistory]
    );

    const handleRealTimeBranchAngleChange = useCallback(
        (newAngle: number) => {
            const { activePipeId } = history.present.realTimeEditing;
            if (!activePipeId) return;

            const subMainPipe = history.present.subMainPipes.find((sm) => sm.id === activePipeId);
            if (!subMainPipe) return;

            const targetZone = history.present.useZones
                ? history.present.zones.find((z) => z.id === subMainPipe.zoneId)
                : {
                      id: 'main-area',
                      coordinates: history.present.mainArea,
                      plantData: history.present.selectedPlantType,
                  };

            if (!targetZone) return;

            let originalSubMainCoordinates = subMainPipe.coordinates;

            const connectedMainPipe = history.present.mainPipes.find((mainPipe) => {
                if (!mainPipe.coordinates || mainPipe.coordinates.length === 0) return false;
                const mainPipeEnd = mainPipe.coordinates[mainPipe.coordinates.length - 1];
                const subMainStart = subMainPipe.coordinates[0];
                const distance = calculateDistanceBetweenPoints(mainPipeEnd, subMainStart);
                return distance < 10;
            });

            const storageKey = `original-submain-${subMainPipe.id}`;
            const storedOriginal = localStorage.getItem(storageKey);
            if (storedOriginal) {
                try {
                    originalSubMainCoordinates = JSON.parse(storedOriginal);
                } catch {
                    console.warn(
                        'Cannot parse stored original coordinates, using current coordinates'
                    );
                }
            }

            const _originalSubMainPipe = {
                ...subMainPipe,
                coordinates: originalSubMainCoordinates,
            };

            const newBranchPipes: any[] = [];
            const trimmedCoordinates = trimSubMainPipeToFitBranches(
                originalSubMainCoordinates,
                newBranchPipes,
                !!connectedMainPipe
            );

            const updatedSubMainPipes = history.present.subMainPipes.map((sm) =>
                sm.id === activePipeId
                    ? {
                          ...sm,
                          coordinates: trimmedCoordinates,
                          length: calculatePipeLength(trimmedCoordinates),
                          branchPipes: newBranchPipes,
                          currentAngle: newAngle,
                      }
                    : sm
            );

            const newPlants = history.present.plants.filter((plant) => {
                return !subMainPipe.branchPipes.some((bp) =>
                    bp.plants.some((p) => p.id === plant.id)
                );
            });

            pushToHistory({
                subMainPipes: updatedSubMainPipes,
                plants: newPlants,
                realTimeEditing: {
                    ...history.present.realTimeEditing,
                    activeAngle: newAngle,
                },
            });
        },
        [history.present, pushToHistory]
    );

    const handleApplyRealTimeBranchEdit = useCallback(() => {
        pushToHistory({
            realTimeEditing: {
                activePipeId: null,
                activeAngle: 90,
                isAdjusting: false,
            },
        });
        setShowRealTimeBranchModal(false);
    }, [pushToHistory]);

    const toggleCurvedPipeEditMode = useCallback(() => {
        pushToHistory({
            curvedPipeEditing: {
                isEnabled: !history.present.curvedPipeEditing.isEnabled,
                editingPipes: new Set<string>(),
            },
        });
    }, [history.present.curvedPipeEditing.isEnabled, pushToHistory]);

    const handleCurvedPipeUpdate = useCallback(
        (pipeId: string, newCoordinates: Coordinate[]) => {
            const mainPipe = history.present.mainPipes.find((p) => p.id === pipeId);
            const subMainPipe = history.present.subMainPipes.find((p) => p.id === pipeId);

            if (mainPipe) {
                const updatedMainPipes = history.present.mainPipes.map((pipe) =>
                    pipe.id === pipeId
                        ? {
                              ...pipe,
                              coordinates: newCoordinates,
                              length: calculatePipeLength(newCoordinates),
                          }
                        : pipe
                );
                pushToHistory({ mainPipes: updatedMainPipes });
            } else if (subMainPipe) {
                const updatedSubMainPipes = history.present.subMainPipes.map((pipe) =>
                    pipe.id === pipeId
                        ? {
                              ...pipe,
                              coordinates: newCoordinates,
                              length: calculatePipeLength(newCoordinates),
                          }
                        : pipe
                );
                pushToHistory({ subMainPipes: updatedSubMainPipes });
            }
        },
        [history.present.mainPipes, history.present.subMainPipes, pushToHistory]
    );

    const handleCurvedPipeEditingChange = useCallback(
        (pipeId: string, isEditing: boolean) => {
            const newEditingPipes = new Set(history.present.curvedPipeEditing.editingPipes);

            if (isEditing) {
                newEditingPipes.add(pipeId);
            } else {
                newEditingPipes.delete(pipeId);
            }

            pushToHistory({
                curvedPipeEditing: {
                    ...history.present.curvedPipeEditing,
                    editingPipes: newEditingPipes,
                },
            });
        },
        [history.present.curvedPipeEditing, pushToHistory]
    );

    const handlePlantDragStart = useCallback(
        (plantId: string) => {
            if (!history.present.isEditModeEnabled) {
                return;
            }

            setIsDragging(true);
            setDragTarget({ id: plantId, type: 'plant' });

            pushToHistory({
                editModeSettings: {
                    ...history.present.editModeSettings,
                    dragMode: 'plant',
                },
            });
        },
        [history.present.isEditModeEnabled, history.present.editModeSettings, pushToHistory]
    );

    const handlePlantDragEnd = useCallback(
        (plantId: string, newPosition: Coordinate) => {
            if (
                !isDragging ||
                !dragTarget ||
                dragTarget.id !== plantId ||
                !history.present.isEditModeEnabled
            ) {
                return;
            }

            let canPlace = true;
            let targetZoneId = 'main-area';

            if (history.present.useZones && history.present.irrigationZones.length > 0) {
                const containingZone = findZoneContainingPoint(newPosition, history.present.zones);
                if (containingZone) {
                    targetZoneId = containingZone.id;
                } else {
                    const isInMainArea =
                        history.present.mainArea.length > 0 &&
                        isPointInPolygon(newPosition, history.present.mainArea);
                    if (!isInMainArea) {
                        canPlace = false;
                    }
                }
            } else if (history.present.mainArea.length > 0) {
                const isInMainArea = isPointInPolygon(newPosition, history.present.mainArea);
                if (!isInMainArea) {
                    canPlace = false;
                }
            }

            if (!canPlace) {
                alert('❌ ' + t('ไม่สามารถวางต้นไม้นอกพื้นที่หลักหรือโซนได้'));
                setIsDragging(false);
                setDragTarget(null);
                return;
            }

            let finalPosition = newPosition;
            if (history.present.editModeSettings.snapToGrid) {
                const gridSize = history.present.editModeSettings.gridSize;
                const latGrid =
                    Math.round(newPosition.lat * (111000 / gridSize)) / (111000 / gridSize);
                const lngGrid =
                    Math.round(newPosition.lng * (111000 / gridSize)) / (111000 / gridSize);
                finalPosition = { lat: latGrid, lng: lngGrid };
            }

            const updatedPlants = history.present.plants.map((plant) =>
                plant.id === plantId
                    ? { ...plant, position: finalPosition, isDragging: false, zoneId: targetZoneId }
                    : plant
            );

            const updatedSubMainPipes = history.present.subMainPipes.map((subMain) => ({
                ...subMain,
                branchPipes: subMain.branchPipes.map((branch) => {
                    const plantIndex = branch.plants.findIndex((p) => p.id === plantId);
                    if (plantIndex === -1) return branch;

                    const updatedPlants = branch.plants.map((p) =>
                        p.id === plantId
                            ? { ...p, position: finalPosition, zoneId: targetZoneId }
                            : p
                    );

                    if (plantIndex === branch.plants.length - 1) {
                        const newCoordinates = [branch.coordinates[0], finalPosition];
                        return {
                            ...branch,
                            plants: updatedPlants,
                            coordinates: newCoordinates,
                            length: calculatePipeLength(newCoordinates),
                        };
                    }

                    return { ...branch, plants: updatedPlants };
                }),
            }));

            pushToHistory({
                plants: updatedPlants,
                subMainPipes: updatedSubMainPipes,
                editModeSettings: {
                    ...history.present.editModeSettings,
                    dragMode: 'none',
                },
            });

            setIsDragging(false);
            setDragTarget(null);
        },
        [
            isDragging,
            dragTarget,
            history.present.isEditModeEnabled,
            history.present.useZones,
            history.present.zones,
            history.present.mainArea,
            history.present.editModeSettings,
            history.present.plants,
            history.present.subMainPipes,
            history.present.irrigationZones.length,
            pushToHistory,
            t,
        ]
    );

    useEffect(() => {
        if (!history.present.useZones && editMode === 'mainPipe') {
            setDrawingMainPipe({ toZone: 'main-area' });
        }
    }, [history.present.useZones, editMode]);

    const handleCreateCustomPlant = useCallback((plantData?: PlantData) => {
        setEditingPlant(plantData || null);
        setShowCustomPlantModal(true);
    }, []);

    const handleSaveCustomPlant = useCallback(
        (plantData: PlantData) => {
            const newPlant = { ...plantData, id: plantData.id || Date.now() };

            let updatedAvailablePlants;

            // ตรวจสอบว่าเป็นการแก้ไขพืชที่มีอยู่หรือไม่
            const existingPlantIndex = history.present.availablePlants.findIndex(
                (p) => p.id === newPlant.id
            );

            if (existingPlantIndex !== -1) {
                // แก้ไขพืชที่มีอยู่
                updatedAvailablePlants = history.present.availablePlants.map((p) =>
                    p.id === newPlant.id ? newPlant : p
                );
            } else {
                // เพิ่มพืชใหม่
                const customPlants = history.present.availablePlants.filter((p) => p.id > 10); // พืชที่ ID > 10 คือพืชที่เพิ่มเอง
                const defaultPlants = history.present.availablePlants.filter((p) => p.id <= 10); // พืชเริ่มต้น

                // ตรวจสอบจำนวนพืชที่เพิ่มเอง ถ้าเกิน 10 ชนิด ให้เอาตัวล่าสุดออก
                const maxCustomPlants = 10;
                let newCustomPlants = [newPlant, ...customPlants];

                if (newCustomPlants.length > maxCustomPlants) {
                    newCustomPlants = newCustomPlants.slice(0, maxCustomPlants);

                    // แจ้งเตือนผู้ใช้
                    alert(t('สามารถเพิ่มพืชได้สูงสุด 10 ชนิด พืชที่เพิ่มล่าสุดจะถูกแทนที่'));
                }

                // รวมพืชเริ่มต้นกับพืชที่เพิ่มเอง โดยให้พืชใหม่อยู่ด้านบน
                updatedAvailablePlants = [...newCustomPlants, ...defaultPlants];
            }

            let updatedZones = history.present.zones;
            if (editingPlant) {
                updatedZones = history.present.zones.map((zone) =>
                    zone.plantData.id === editingPlant.id
                        ? {
                              ...zone,
                              plantData: newPlant,
                              plantCount: calculatePlantCount(
                                  zone.area,
                                  newPlant.plantSpacing,
                                  newPlant.rowSpacing
                              ),
                              totalWaterNeed:
                                  calculatePlantCount(
                                      zone.area,
                                      newPlant.plantSpacing,
                                      newPlant.rowSpacing
                                  ) * newPlant.waterNeed,
                          }
                        : zone
                );
            }

            pushToHistory({
                availablePlants: updatedAvailablePlants,
                zones: updatedZones,
                selectedPlantType: newPlant, // เลือกพืชที่เพิ่งสร้างโดยอัตโนมัติ
            });

            setEditingPlant(null);
        },
        [editingPlant, history.present.availablePlants, history.present.zones, pushToHistory, t]
    );

    const handleZonePlantSelection = useCallback((zone: Zone) => {
        setSelectedZoneForPlant(zone);
        setShowZonePlantModal(true);
    }, []);

    const handleSaveZonePlant = useCallback(
        (zoneId: string, plantData: PlantData) => {
            const updatedZones = history.present.zones.map((zone) => {
                if (zone.id === zoneId) {
                    const newPlantCount = calculatePlantCount(
                        zone.area,
                        plantData.plantSpacing,
                        plantData.rowSpacing
                    );
                    const newWaterNeed = newPlantCount * plantData.waterNeed;

                    return {
                        ...zone,
                        plantData,
                        plantCount: newPlantCount,
                        totalWaterNeed: newWaterNeed,
                        isCustomPlant: plantData.id === 99,
                    };
                }
                return zone;
            });

            pushToHistory({ zones: updatedZones });
        },
        [history.present.zones, pushToHistory]
    );

    const handlePlantEdit = useCallback((plant: PlantLocation) => {
        setSelectedPlantForEdit(plant);
        setIsNewPlantMode(false);
        setShowPlantEditModal(true);
    }, []);

    const handlePlantSave = useCallback(
        (plantId: string, newPlantData: PlantData) => {
            const editedPlant = history.present.plants.find((plant) => plant.id === plantId);
            if (!editedPlant) return;

            let updatedPlants: PlantLocation[] = [];
            let updatedSelectedPlantType = history.present.selectedPlantType;
            let updatedPlantAreas = history.present.plantAreas;

            if (!editedPlant.zoneId) {
                updatedPlants = history.present.plants.map((plant) => {
                    if (!plant.zoneId) {
                        return { ...plant, plantData: newPlantData };
                    }
                    return plant;
                });
                updatedSelectedPlantType = newPlantData;
            } else {
                const targetZoneId = editedPlant.zoneId;
                updatedPlants = history.present.plants.map((plant) => {
                    if (plant.zoneId === targetZoneId) {
                        return { ...plant, plantData: newPlantData };
                    }
                    return plant;
                });

                updatedPlantAreas = history.present.plantAreas.map((area) => {
                    if (area.id === targetZoneId) {
                        return {
                            ...area,
                            plantData: newPlantData,
                        };
                    }
                    return area;
                });
            }

            const updatedSubMainPipes = history.present.subMainPipes.map((subMain) => ({
                ...subMain,
                branchPipes: subMain.branchPipes.map((branch) => ({
                    ...branch,
                    plants: branch.plants.map((plant) => {
                        const updatedPlant = updatedPlants.find((p) => p.id === plant.id);
                        return updatedPlant || plant;
                    }),
                })),
            }));

            const settings = history.present.plantGenerationSettings;
            let regeneratedPlants: PlantLocation[] = [];

            const originalPlantsInArea = history.present.plants.filter((plant) => {
                if (!editedPlant.zoneId) {
                    return !plant.zoneId;
                } else {
                    return plant.zoneId === editedPlant.zoneId;
                }
            });

            const currentRotationAngle =
                originalPlantsInArea.length > 0
                    ? (originalPlantsInArea[0].rotationAngle ?? settings.rotationAngle)
                    : settings.rotationAngle;

            if (!editedPlant.zoneId) {
                regeneratedPlants = generatePlantsInArea(
                    history.present.mainArea,
                    newPlantData,
                    settings.layoutPattern,
                    history.present.exclusionAreas,
                    currentRotationAngle
                );
            } else {
                const targetArea = history.present.plantAreas.find(
                    (area) => area.id === editedPlant.zoneId
                );
                if (targetArea) {
                    // คำนวณ shared baseline เมื่อมีหลายพื้นที่ปลูกพืช
                    const sharedBaseline =
                        history.present.plantAreas.length > 1
                            ? calculateSharedBaseline(history.present.plantAreas, newPlantData)
                            : undefined;

                    regeneratedPlants = generatePlantsInAreaWithSmartBoundary(
                        targetArea.coordinates,
                        newPlantData,
                        settings.layoutPattern,
                        history.present.exclusionAreas,
                        history.present.plantAreas.filter((a) => a.id !== targetArea.id),
                        currentRotationAngle,
                        sharedBaseline
                    ).map((plant) => ({
                        ...plant,
                        zoneId: targetArea.id,
                        plantAreaId: targetArea.id,
                        plantAreaColor: targetArea.color,
                    }));
                }
            }

            const plantsToKeep = history.present.plants.filter((plant) => {
                if (!editedPlant.zoneId) {
                    return plant.zoneId;
                } else {
                    return plant.zoneId !== editedPlant.zoneId;
                }
            });

            const finalPlants = [...plantsToKeep, ...regeneratedPlants];

            pushToHistory({
                plants: finalPlants,
                subMainPipes: updatedSubMainPipes,
                selectedPlantType: updatedSelectedPlantType,
                plantAreas: updatedPlantAreas,
            });

            if (typeof window !== 'undefined' && (window as any).showNotification) {
                const areaType = !editedPlant.zoneId ? 'พื้นที่หลัก' : 'พื้นที่ปลูก';
                (window as any).showNotification(
                    `แก้ไขต้นไม้สำเร็จ: ${t(newPlantData.name)} ใน${areaType} (${regeneratedPlants.length} ต้น)`,
                    'success'
                );
            }
        },
        [
            history.present.plants,
            history.present.subMainPipes,
            history.present.mainArea,
            history.present.selectedPlantType,
            history.present.plantAreas,
            history.present.plantGenerationSettings,
            history.present.exclusionAreas,
            pushToHistory,
            t,
        ]
    );

    const handlePlantDelete = useCallback(
        (plantId: string) => {
            handleDeleteSpecificPlants([plantId]);
        },
        [handleDeleteSpecificPlants]
    );

    const _handleAddPlant = useCallback(
        (position: Coordinate, plantData?: PlantData) => {
            const newPlant: PlantLocation = {
                id: generateUniqueId('plant'),
                position,
                plantData: plantData || history.present.selectedPlantType,
                isSelected: false,
                isEditable: true,
                health: 'good',
                zoneId: history.present.useZones
                    ? findZoneContainingPoint(position, history.present.zones)?.id
                    : 'main-area',
            };

            const updatedPlants = [...history.present.plants, newPlant];
            pushToHistory({ plants: updatedPlants });

            setConnectionStartPlant(newPlant);
            setIsCreatingConnection(true);
            setDragMode('connecting');
            setIsNewPlantMode(true);
            setSelectedPlantForEdit(newPlant);
            setShowPlantEditModal(true);
        },
        [
            history.present.plants,
            history.present.selectedPlantType,
            history.present.useZones,
            history.present.zones,
            pushToHistory,
        ]
    );

    const handleCreatePlantConnection = useCallback(
        (plantId: string) => {
            const plant = history.present.plants.find((p) => p.id === plantId);
            if (!plant) return;

            setConnectionStartPlant(plant);
            setIsCreatingConnection(true);
            setDragMode('connecting');

            const availablePipeIds: string[] = [
                ...history.present.subMainPipes.map((p) => p.id),
                ...history.present.subMainPipes.flatMap((sm) => sm.branchPipes.map((bp) => bp.id)),
            ];

            const availablePlantIds = history.present.plants
                .filter((p) => p.id !== plantId)
                .map((p) => p.id);

            setHighlightedPipes([...availablePipeIds, ...availablePlantIds]);
        },
        [history.present.plants, history.present.subMainPipes]
    );

    const handleConnectToPipe = useCallback(
        (clickPosition: Coordinate, pipeId: string, pipeType: 'subMain' | 'branch') => {
            if (!connectionStartPlant || !isCreatingConnection) return;

            let targetPipe: SubMainPipe | BranchPipe | null = null;
            let targetSubMainId = '';

            if (pipeType === 'subMain') {
                targetPipe = history.present.subMainPipes.find((p) => p.id === pipeId) || null;
                targetSubMainId = pipeId;
            } else {
                for (const subMain of history.present.subMainPipes) {
                    const branch = subMain.branchPipes.find((bp) => bp.id === pipeId);
                    if (branch) {
                        targetPipe = branch;
                        targetSubMainId = subMain.id;
                        break;
                    }
                }
            }

            if (!targetPipe) return;

            const closestPoint = findClosestPointOnPipe(clickPosition, targetPipe.coordinates);
            if (!closestPoint) return;

            const newBranchPipe: BranchPipe = {
                id: generateUniqueId('branch'),
                subMainPipeId: targetSubMainId,
                coordinates: [closestPoint.position, connectionStartPlant.position],
                length: calculateDistanceBetweenPoints(
                    closestPoint.position,
                    connectionStartPlant.position
                ),
                diameter: 20,
                plants: [connectionStartPlant],
                isEditable: true,
                sprinklerType: 'standard',
                angle: 90,
                connectionPoint: 0.5,
            };

            const updatedSubMainPipes = history.present.subMainPipes.map((subMain) => {
                if (subMain.id === targetSubMainId) {
                    return {
                        ...subMain,
                        branchPipes: [...subMain.branchPipes, newBranchPipe],
                    };
                }
                return subMain;
            });

            pushToHistory({ subMainPipes: updatedSubMainPipes });

            setIsCreatingConnection(false);
            setConnectionStartPlant(null);
            setHighlightedPipes([]);
            setDragMode('none');
            setTempConnectionLine(null);
        },
        [connectionStartPlant, isCreatingConnection, history.present.subMainPipes, pushToHistory]
    );

    const handleConnectToPlant = useCallback(
        (targetPlantId: string) => {
            if (!connectionStartPlant || !isCreatingConnection) return;

            const targetPlant = history.present.plants.find((p) => p.id === targetPlantId);
            if (!targetPlant) return;

            const newBranchPipe: BranchPipe = {
                id: generateUniqueId('branch'),
                subMainPipeId: 'standalone',
                coordinates: [connectionStartPlant.position, targetPlant.position],
                length: calculateDistanceBetweenPoints(
                    connectionStartPlant.position,
                    targetPlant.position
                ),
                diameter: 20,
                plants: [connectionStartPlant, targetPlant],
                isEditable: true,
                sprinklerType: 'standard',
                angle: 90,
                connectionPoint: 0.5,
            };

            const hasExistingSubMain = history.present.subMainPipes.length > 0;

            if (hasExistingSubMain) {
                const targetSubMain = history.present.subMainPipes[0];
                const updatedSubMainPipes = history.present.subMainPipes.map((subMain) => {
                    if (subMain.id === targetSubMain.id) {
                        return {
                            ...subMain,
                            branchPipes: [
                                ...subMain.branchPipes,
                                { ...newBranchPipe, subMainPipeId: subMain.id },
                            ],
                        };
                    }
                    return subMain;
                });
                pushToHistory({ subMainPipes: updatedSubMainPipes });
            } else {
                const newSubMainPipe: SubMainPipe = {
                    id: generateUniqueId('submain'),
                    zoneId: 'main-area',
                    coordinates: [connectionStartPlant.position, targetPlant.position],
                    length: calculateDistanceBetweenPoints(
                        connectionStartPlant.position,
                        targetPlant.position
                    ),
                    diameter: 32,
                    branchPipes: [{ ...newBranchPipe, subMainPipeId: generateUniqueId('submain') }],
                    material: 'pvc',
                    currentAngle: history.present.branchPipeSettings.defaultAngle,
                };

                pushToHistory({
                    subMainPipes: [...history.present.subMainPipes, newSubMainPipe],
                });
            }

            setIsCreatingConnection(false);
            setConnectionStartPlant(null);
            setHighlightedPipes([]);
            setDragMode('none');
            setTempConnectionLine(null);
        },
        [
            connectionStartPlant,
            isCreatingConnection,
            history.present.plants,
            history.present.subMainPipes,
            history.present.branchPipeSettings.defaultAngle,
            pushToHistory,
        ]
    );

    const handleSearch = useCallback((lat: number, lng: number, placeDetails?: any) => {
        setMapCenter([lat, lng]);
        if (mapRef.current) {
            mapRef.current.setCenter({ lat, lng });

            let zoomLevel = 18;

            if (placeDetails?.types) {
                const types = placeDetails.types;

                if (types.includes('country')) {
                    zoomLevel = 6;
                } else if (
                    types.includes('administrative_area_level_1') ||
                    types.includes('state')
                ) {
                    zoomLevel = 8;
                } else if (
                    types.includes('administrative_area_level_2') ||
                    types.includes('city')
                ) {
                    zoomLevel = 12;
                } else if (types.includes('locality') || types.includes('sublocality')) {
                    zoomLevel = 15;
                } else if (types.includes('route') || types.includes('street_address')) {
                    zoomLevel = 18;
                } else if (types.includes('premise') || types.includes('building')) {
                    zoomLevel = 20;
                } else if (types.includes('park') || types.includes('airport')) {
                    zoomLevel = 16;
                } else if (types.includes('restaurant') || types.includes('store')) {
                    zoomLevel = 19;
                }
            }

            mapRef.current.setZoom(zoomLevel);
        }
    }, []);

    const handleMapLoad = useCallback((map: google.maps.Map) => {
        mapRef.current = map;
        setMap(map);

        map.addListener('zoom_changed', () => {
            if (mapRef.current) {
                // const currentZoom = mapRef.current.getZoom();
            }
        });
    }, []);

    const zoomToMainArea = useCallback(() => {
        if (!mapRef.current || history.present.mainArea.length === 0) {
            console.warn('❌ No map or main area to zoom to');
            return;
        }

        try {
            const bounds = new google.maps.LatLngBounds();

            history.present.mainArea.forEach((coord) => {
                bounds.extend(new google.maps.LatLng(coord.lat, coord.lng));
            });

            mapRef.current.fitBounds(bounds, {
                top: 50,
                right: 50,
                bottom: 50,
                left: 50,
            });
        } catch (error) {
            console.error('❌ Error zooming to main area:', error);
        }
    }, [history.present.mainArea]);

    const autoZoomToMainArea = useCallback(() => {
        if (!mapRef.current || history.present.mainArea.length === 0) {
            return;
        }

        try {
            const bounds = new google.maps.LatLngBounds();

            history.present.mainArea.forEach((coord) => {
                bounds.extend(new google.maps.LatLng(coord.lat, coord.lng));
            });

            mapRef.current.fitBounds(bounds, {
                top: 50,
                right: 50,
                bottom: 50,
                left: 50,
            });
        } catch (error) {
            console.error('❌ Error auto-zooming to main area:', error);
        }
    }, [history.present.mainArea]);

    const handleDrawingComplete = useCallback(
        (coordinates: Coordinate[], _shapeType: string) => {
            if (!coordinates || coordinates.length === 0) {
                return;
            }

            const isPolyline = editMode === 'mainPipe' || editMode === 'subMainPipe';
            const isValidForPolyline = isPolyline && coordinates.length >= 2;
            const isValidForPolygon = !isPolyline && coordinates.length >= 3;

            if (!isValidForPolyline && !isValidForPolygon) {
                return;
            }

            if (history.present.mainArea.length === 0) {
                const center = coordinates.reduce(
                    (acc, point) => [acc[0] + point.lat, acc[1] + point.lng],
                    [0, 0]
                );
                setMapCenter([center[0] / coordinates.length, center[1] / coordinates.length]);
                pushToHistory({ mainArea: coordinates });

                // ยกเลิกการกดปุ่มวาดพื้นที่หลักอัตโนมัติ
                setEditMode(null);

                setTimeout(() => {
                    if (mapRef.current && coordinates.length > 0) {
                        try {
                            const bounds = new google.maps.LatLngBounds();
                            coordinates.forEach((coord) => {
                                bounds.extend(new google.maps.LatLng(coord.lat, coord.lng));
                            });
                            mapRef.current.fitBounds(bounds, {
                                top: 50,
                                right: 50,
                                bottom: 50,
                                left: 50,
                            });
                        } catch (error) {
                            console.error(
                                '❌ Error auto-zooming to main area after drawing:',
                                error
                            );
                        }
                    }
                }, 100);
                return;
            }

            if (editMode === 'zone') {
                let snappedCoordinates = coordinates;
                if (history.present.mainArea.length > 0) {
                    snappedCoordinates = advancedSnapToMainArea(
                        coordinates,
                        history.present.mainArea
                    );
                }

                const zoneArea = calculateAreaFromCoordinates(snappedCoordinates);
                const plantDataForZone = history.present.selectedPlantType;
                const estimatedPlantCount = calculatePlantCount(
                    zoneArea,
                    plantDataForZone.plantSpacing,
                    plantDataForZone.rowSpacing
                );
                const estimatedWaterNeed = estimatedPlantCount * plantDataForZone.waterNeed;

                const newZone: Zone = {
                    id: generateUniqueId('zone'),
                    name: `${t('โซน')} ${history.present.irrigationZones.length + 1}`,
                    coordinates: snappedCoordinates,
                    plantData: plantDataForZone,
                    plantCount: estimatedPlantCount,
                    totalWaterNeed: estimatedWaterNeed,
                    area: zoneArea,
                    color: getZoneColor(history.present.irrigationZones.length),
                    isCustomPlant: plantDataForZone.id === 99,
                };

                pushToHistory({ zones: [...history.present.zones, newZone] });
                setEditMode(null);

                setTimeout(() => autoZoomToMainArea(), 100);
            } else if (editMode === 'exclusion') {
                const newExclusion: ExclusionArea = {
                    id: generateUniqueId('exclusion'),
                    type: selectedExclusionType,
                    coordinates,
                    name: `${selectedExclusionType} ${
                        history.present.exclusionAreas.filter(
                            (e) => e.type === selectedExclusionType
                        ).length + 1
                    }`,
                    color: EXCLUSION_COLORS[selectedExclusionType],
                };

                const dimensionLines = generateDimensionLines(
                    newExclusion,
                    history.present.mainArea,
                    dimensionLineAngleOffset
                );

                const newExclusionZone: ExclusionZone = {
                    id: newExclusion.id,
                    coordinates: newExclusion.coordinates,
                    dimensionLines: dimensionLines,
                    showDimensionLines: true,
                };

                const updatedPlants = removePlantsInExclusionZones(history.present.plants, [
                    ...history.present.exclusionAreas,
                    newExclusion,
                ]);

                const removedPlants = history.present.plants.filter((plant) =>
                    isPointInPolygon(plant.position, newExclusion.coordinates)
                );

                if (removedPlants.length > 0) {
                    const storedData = localStorage.getItem('removedPlants') || '{}';
                    const removedPlantsData = JSON.parse(storedData);
                    removedPlantsData[newExclusion.id] = removedPlants;
                    localStorage.setItem('removedPlants', JSON.stringify(removedPlantsData));
                }

                pushToHistory({
                    exclusionAreas: [...history.present.exclusionAreas, newExclusion],
                    exclusionZones: [...history.present.exclusionZones, newExclusionZone],
                    plants: updatedPlants,
                });

                setEditMode(null);

                setTimeout(() => autoZoomToMainArea(), 100);
            } else if (editMode === 'plantArea') {
                const newPlantArea: PlantArea = {
                    id: generateUniqueId('plantArea'),
                    name: `พื้นที่ปลูกพืช ${history.present.plantAreas.length + 1}`,
                    coordinates,
                    plantData: history.present.availablePlants[0],
                    color: getZoneColor(history.present.plantAreas.length),
                    isCompleted: false,
                };

                pushToHistory({
                    plantAreas: [...history.present.plantAreas, newPlantArea],
                });

                setCurrentPlantArea(newPlantArea);
                setEditMode(null);
                setIsDeleteMode(false); // รีเซ็ตโหมดลบเมื่อวาดเสร็จ
                setShowPlantAreaSelectionModal(true);
                setTimeout(() => autoZoomToMainArea(), 100);
            } else if (editMode === 'mainPipe' && history.present.pump) {
                const pipeLength = calculatePipeLength(coordinates);
                const targetZoneId = findTargetZoneForMainPipe(
                    coordinates,
                    history.present.zones,
                    history.present.useZones
                );

                const newMainPipe: MainPipe = {
                    id: generateUniqueId('mainpipe'),
                    fromPump: history.present.pump.id,
                    toZone: targetZoneId,
                    coordinates,
                    length: pipeLength,
                    diameter: 50,
                };

                pushToHistory({ mainPipes: [...history.present.mainPipes, newMainPipe] });
                setDrawingMainPipe({ toZone: null });
                setEditMode(null);

                setTimeout(() => autoZoomToMainArea(), 100);
            } else if (editMode === 'lateralPipe' && history.present.lateralPipeDrawing.isActive) {
                if (coordinates.length >= 2) {
                    const startPoint = coordinates[0];
                    const endPoint = coordinates[coordinates.length - 1];

                    if (!history.present.lateralPipeDrawing.startPoint) {
                        dispatchHistory({
                            type: 'PUSH_STATE',
                            state: {
                                ...history.present,
                                lateralPipeDrawing: {
                                    ...history.present.lateralPipeDrawing,
                                    startPoint: startPoint,
                                    currentPoint: startPoint,
                                    rawCurrentPoint: startPoint,
                                },
                            },
                        });
                    }

                    handleFinishLateralPipeDrawing(endPoint);
                }
                return;
            } else if (editMode === 'subMainPipe') {
                // const pipeLength = calculatePipeLength(coordinates);

                let targetZone: Zone;
                if (history.present.useZones) {
                    if (_selectedZone) {
                        targetZone = _selectedZone;
                    } else {
                        const detectedZone = findZoneForPipe(coordinates, history.present.zones);
                        if (!detectedZone) {
                            alert('กรุณาเลือกโซนก่อนวางปั๊ม');
                            return;
                        }
                        targetZone = detectedZone;
                    }
                } else {
                    targetZone = {
                        id: 'main-area',
                        name: t('พื้นที่หลัก'),
                        coordinates: history.present.mainArea,
                        plantData: history.present.selectedPlantType,
                        plantCount: 0,
                        totalWaterNeed: 0,
                        area: calculateAreaFromCoordinates(history.present.mainArea),
                        color: '#4ECDC4',
                    };
                }

                const branchPipes: any[] = [];
                const newPlants: any[] = [];

                const isConnectedToMainPipe = history.present.mainPipes.some((mainPipe) => {
                    if (!mainPipe.coordinates || mainPipe.coordinates.length === 0) return false;
                    const mainPipeEnd = mainPipe.coordinates[mainPipe.coordinates.length - 1];
                    const subMainStart = coordinates[0];
                    const distance = calculateDistanceBetweenPoints(mainPipeEnd, subMainStart);
                    return distance < 10;
                });

                const trimmedCoordinates = trimSubMainPipeToFitBranches(
                    coordinates,
                    branchPipes,
                    isConnectedToMainPipe
                );

                const subMainPipeId = generateUniqueId('submain');
                const storageKey = `original-submain-${subMainPipeId}`;
                if (!safeLocalStorageSet(storageKey, JSON.stringify(coordinates))) {
                    console.error('❌ Failed to save original submain coordinates');
                }

                const newSubMainPipe: SubMainPipe = {
                    id: subMainPipeId,
                    zoneId: targetZone.id,
                    coordinates: trimmedCoordinates,
                    length: calculatePipeLength(trimmedCoordinates),
                    diameter: 32,
                    branchPipes,
                    material: 'pvc',
                    currentAngle: history.present.branchPipeSettings.defaultAngle,
                };

                const exactSpacingStats = calculateExactSpacingStats([
                    ...history.present.subMainPipes,
                    newSubMainPipe,
                ]);

                // ใช้ฟังก์ชัน snap ใหม่ที่ปรับปรุงแล้ว
                const { mainPipes: updatedMainPipes, snapped } = snapMainPipeEndToSubMainPipe(
                    history.present.mainPipes,
                    newSubMainPipe.coordinates
                );

                if (snapped && typeof window !== 'undefined' && (window as any).showNotification) {
                    (window as any).showNotification(
                        'ท่อเมนเชื่อมต่อกับท่อเมนรองสำเร็จ',
                        'success'
                    );
                }

                pushToHistory({
                    subMainPipes: [...history.present.subMainPipes, newSubMainPipe],
                    plants: [...history.present.plants, ...newPlants],
                    spacingValidationStats: exactSpacingStats,
                    mainPipes: updatedMainPipes,
                });

                setEditMode(null);

                if (typeof window !== 'undefined' && (window as any).showNotification) {
                    (window as any).showNotification('วาดท่อเมนรองเสร็จสิ้น', 'success');
                }

                setTimeout(() => autoZoomToMainArea(), 100);
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            editMode,
            pushToHistory,
            t,
            autoZoomToMainArea,
            selectedExclusionType,
            dimensionLineAngleOffset,
            _selectedZone,
        ]
    );

    const _getNearestPointOnBranchPipes = useCallback(
        (
            point: Coordinate
        ): { snapped: Coordinate; branchPipeId: string | null; distance: number } | null => {
            let closest: {
                snapped: Coordinate;
                branchPipeId: string | null;
                distance: number;
            } | null = null;

            for (const sub of history.present.subMainPipes) {
                if (!sub.branchPipes || sub.branchPipes.length === 0) continue;
                for (const bp of sub.branchPipes) {
                    if (!bp.coordinates || bp.coordinates.length < 2) continue;
                    const res =
                        findClosestPointOnPipeExtended(point, bp.coordinates) ||
                        findClosestPointOnPipe(point, bp.coordinates);
                    if (res) {
                        if (!closest || res.distance < closest.distance) {
                            closest = {
                                snapped: res.position,
                                branchPipeId: bp.id,
                                distance: res.distance,
                            };
                        }
                    }
                }
            }

            return closest;
        },
        [history.present.subMainPipes]
    );

    const getNearestPointOnPlantGrid = useCallback(
        (
            point: Coordinate
        ): { snapped: Coordinate; gridType: 'row' | 'column'; distance: number } | null => {
            if (history.present.plants.length < 2) return null;

            let closestRowPoint: { snapped: Coordinate; distance: number } | null = null;
            let closestColumnPoint: { snapped: Coordinate; distance: number } | null = null;

            const LAT_THRESHOLD = 0.001;
            const LNG_THRESHOLD = 0.001;

            const allPlants = history.present.plants;

            for (let i = 0; i < allPlants.length; i++) {
                const plant = allPlants[i];
                const plantsInSameRow: PlantLocation[] = [plant];

                for (let j = 0; j < allPlants.length; j++) {
                    if (i === j) continue;
                    const otherPlant = allPlants[j];
                    const latDiff = Math.abs(plant.position.lat - otherPlant.position.lat);

                    if (latDiff <= LAT_THRESHOLD) {
                        plantsInSameRow.push(otherPlant);
                    }
                }

                if (plantsInSameRow.length >= 2) {
                    const rowLat = plant.position.lat;
                    const distanceToRow = Math.abs(point.lat - rowLat);

                    if (!closestRowPoint || distanceToRow < closestRowPoint.distance) {
                        const lngs = plantsInSameRow.map((p) => p.position.lng);
                        const minLng = Math.min(...lngs);
                        const maxLng = Math.max(...lngs);
                        const avgSpacing =
                            lngs.length > 1 ? (maxLng - minLng) / (lngs.length - 1) : 0.001;

                        const extendedMinLng = minLng - avgSpacing;
                        const extendedMaxLng = maxLng + avgSpacing;
                        const snappedLng = Math.max(
                            extendedMinLng,
                            Math.min(extendedMaxLng, point.lng)
                        );

                        closestRowPoint = {
                            snapped: { lat: rowLat, lng: snappedLng },
                            distance: distanceToRow,
                        };
                    }
                }
            }

            for (let i = 0; i < allPlants.length; i++) {
                const plant = allPlants[i];
                const plantsInSameColumn: PlantLocation[] = [plant];

                for (let j = 0; j < allPlants.length; j++) {
                    if (i === j) continue;
                    const otherPlant = allPlants[j];
                    const lngDiff = Math.abs(plant.position.lng - otherPlant.position.lng);

                    if (lngDiff <= LNG_THRESHOLD) {
                        plantsInSameColumn.push(otherPlant);
                    }
                }

                if (plantsInSameColumn.length >= 2) {
                    const columnLng = plant.position.lng;
                    const distanceToColumn = Math.abs(point.lng - columnLng);

                    if (!closestColumnPoint || distanceToColumn < closestColumnPoint.distance) {
                        const lats = plantsInSameColumn.map((p) => p.position.lat);
                        const minLat = Math.min(...lats);
                        const maxLat = Math.max(...lats);
                        const avgSpacing =
                            lats.length > 1 ? (maxLat - minLat) / (lats.length - 1) : 0.001;

                        const extendedMinLat = minLat - avgSpacing;
                        const extendedMaxLat = maxLat + avgSpacing;
                        const snappedLat = Math.max(
                            extendedMinLat,
                            Math.min(extendedMaxLat, point.lat)
                        );

                        closestColumnPoint = {
                            snapped: { lat: snappedLat, lng: columnLng },
                            distance: distanceToColumn,
                        };
                    }
                }
            }

            if (!closestRowPoint && !closestColumnPoint) {
                return null;
            }

            if (!closestRowPoint) {
                return { ...closestColumnPoint!, gridType: 'column' };
            }

            if (!closestColumnPoint) {
                return { ...closestRowPoint!, gridType: 'row' };
            }

            if (closestRowPoint.distance <= closestColumnPoint.distance) {
                return { ...closestRowPoint!, gridType: 'row' };
            } else {
                return { ...closestColumnPoint!, gridType: 'column' };
            }
        },
        [history.present.plants]
    );

    const handleMapClick = useCallback(
        (event: google.maps.MapMouseEvent) => {
            if (!event.latLng) return;

            const lat = event.latLng.lat();
            const lng = event.latLng.lng();
            const clickPoint = { lat, lng };

            if (
                history.present.lateralPipeDrawing.isActive &&
                history.present.lateralPipeDrawing.placementMode
            ) {
                // ตรวจสอบการคลิกท่อเมนรองก่อน
                // 🚀 ปรับปรุง logic: ตรวจสอบทั้งต้นไม้และท่อเมนรอง แล้วเลือกสิ่งที่ใกล้กว่า
                if (!history.present.lateralPipeDrawing.startPoint) {
                    // หาต้นไม้ที่ใกล้จุดคลิกที่สุด
                    const clickedPlant = findClosestPlantToPoint(
                        clickPoint,
                        history.present.plants,
                        15 // threshold สำหรับการคลิก
                    );

                    // หาท่อเมนรองที่ใกล้จุดคลิกที่สุด (พร้อมตรวจสอบ zone)
                    const clickedSubMainPipe = findClosestSubMainPipeInSameZone(
                        clickPoint,
                        history.present.subMainPipes,
                        history.present.zones,
                        history.present.irrigationZones,
                        10 // threshold สำหรับท่อเมนรอง
                    );

                    // เปรียบเทียบระยะทางและให้สิ่งที่ใกล้กว่ามี priority
                    const plantDistance = clickedPlant
                        ? calculateDistanceBetweenPoints(clickPoint, clickedPlant.position)
                        : Infinity;
                    const pipeDistance = clickedSubMainPipe
                        ? clickedSubMainPipe.distance
                        : Infinity;

                    if (clickedPlant && clickedSubMainPipe) {
                        // ถ้ามีทั้งสองอย่าง ให้เลือกตัวที่ใกล้กว่า
                        if (plantDistance < pipeDistance) {
                            // ต้นไม้ใกล้กว่า
                            handleStartLateralPipeFromPlant(clickPoint, clickedPlant);
                            return;
                        } else {
                            // ท่อเมนรองใกล้กว่า
                            handleLateralPipeClick(event);
                            return;
                        }
                    } else if (clickedPlant) {
                        // มีแค่ต้นไม้
                        handleStartLateralPipeFromPlant(clickPoint, clickedPlant);
                        return;
                    } else if (clickedSubMainPipe) {
                        // มีแค่ท่อเมนรอง
                        handleLateralPipeClick(event);
                        return;
                    }
                } else {
                    // หากมี startPoint แล้ว ให้จบการวาด
                    const distance = calculateDistanceBetweenPoints(
                        history.present.lateralPipeDrawing.startPoint,
                        clickPoint
                    );
                    if (distance > 5) {
                        handleFinishLateralPipeDrawing(clickPoint);
                        return;
                    } else {
                        return;
                    }
                }
            }

            if (isRulerMode) {
                handleRulerClick(clickPoint);
                return;
            }

            if (editMode === 'pump') {
                if (history.present.mainArea.length > 0) {
                    const isInMainArea = isPointInPolygon(clickPoint, history.present.mainArea);
                    if (!isInMainArea) {
                        alert(t('กรุณาวางปั๊มภายในพื้นที่หลัก'));
                        return;
                    }
                }

                const newPump: Pump = {
                    id: generateUniqueId('pump'),
                    position: clickPoint,
                    type: 'submersible',
                    capacity: 1000,
                    head: 50,
                };

                pushToHistory({ pump: newPump });
                setEditMode(null);

                setTimeout(() => autoZoomToMainArea(), 100);
                return;
            }

            if (editMode === 'plantArea') {
                return;
            }

            const isPlantMode = editMode === 'plant';

            if (isPlantMode) {
                if (!history.present.selectedPlantType) {
                    alert('❌ ' + t('กรุณาเลือกชนิดพืชก่อนวางต้นไม้'));
                    return;
                }

                let targetPoint: Coordinate = clickPoint;
                if (plantPlacementMode === 'plant_grid') {
                    const nearestGrid = getNearestPointOnPlantGrid(clickPoint);
                    if (nearestGrid) {
                        targetPoint = nearestGrid.snapped;
                    } else {
                        alert(t('ไม่พบแนวแถวหรือคอลัมน์ของต้นไม้สำหรับการวาง'));
                        return;
                    }
                }

                if (
                    history.present.mainArea.length === 0 &&
                    history.present.irrigationZones.length === 0
                ) {
                    console.error('❌ No main area or zones defined');
                    alert('❌ ' + t('กรุณากำหนดพื้นที่หลักหรือโซนก่อนวางต้นไม้'));
                    return;
                }

                let canPlacePlant = false;
                let targetZoneId = 'main-area';

                if (history.present.useZones && history.present.irrigationZones.length > 0) {
                    const containingZone = findZoneContainingPoint(
                        targetPoint,
                        history.present.zones
                    );

                    if (containingZone) {
                        targetZoneId = containingZone.id;
                        canPlacePlant = true;
                    } else if (history.present.mainArea.length > 0) {
                        const inMainArea = isPointInPolygon(targetPoint, history.present.mainArea);
                        canPlacePlant = inMainArea;
                    }
                } else if (history.present.mainArea.length > 0) {
                    const inMainArea = isPointInPolygon(targetPoint, history.present.mainArea);
                    canPlacePlant = inMainArea;
                }

                if (!canPlacePlant) {
                    console.error('❌ Cannot place plant - outside valid area');
                    alert('❌ ' + t('กรุณาวางต้นไม้ภายในพื้นที่หลักหรือโซนที่กำหนด'));
                    return;
                }

                const newPlant: PlantLocation = {
                    id: generateUniqueId('plant'),
                    position: targetPoint,
                    plantData: history.present.selectedPlantType,
                    isSelected: false,
                    isEditable: true,
                    health: 'good',
                    zoneId: targetZoneId,
                };

                pushToHistory({ plants: [...history.present.plants, newPlant] });

                return;
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [
            isRulerMode,
            editMode,
            handleRulerClick,
            pushToHistory,
            t,
            autoZoomToMainArea,
            plantPlacementMode,
            getNearestPointOnPlantGrid,
        ]
    );

    const handleSaveDraft = useCallback(async () => {
        console.log('💾 Saving draft...');

        // Check if we're editing an existing field
        const existingFieldId = localStorage.getItem('currentFieldId');
        const isEditingExisting = existingFieldId && !existingFieldId.startsWith('mock-');

        // Create a draft name with timestamp (or use existing name if editing)
        const draftName = isEditingExisting
            ? localStorage.getItem('currentFieldName') ||
              `Draft - ${new Date().toLocaleString('th-TH')}`
            : `Draft - ${new Date().toLocaleString('th-TH')}`;

        // Prepare project data for draft
        const projectData = {
            projectName: draftName,
            customerName: customerName || 'Draft Customer',
            version: '4.0.0',
            totalArea: totalArea,
            mainArea: history.present.mainArea,
            pump: history.present.pump,
            zones: history.present.zones,
            mainPipes: history.present.mainPipes,
            subMainPipes: history.present.subMainPipes,
            exclusionAreas: history.present.exclusionAreas,
            plants: history.present.plants,
            useZones: history.present.useZones,
            selectedPlantType: history.present.selectedPlantType,
            branchPipeSettings: history.present.branchPipeSettings,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        // Save to localStorage for backup (same format as new fields)
        const saveSuccess = safeLocalStorageSet(
            'horticultureIrrigationData',
            JSON.stringify(projectData)
        );
        if (!saveSuccess) {
            console.error('❌ Failed to save to horticultureIrrigationData');
            // Show user-friendly error message
            alert('ไม่สามารถบันทึกข้อมูลได้เนื่องจากพื้นที่เก็บข้อมูลเต็ม กรุณาลองใหม่อีกครั้ง');
            return;
        }

        // Also save to field-specific localStorage for product page compatibility
        const fieldSpecificKey = `savedProductProject_${existingFieldId || 'new'}`;
        const productPageData = {
            projectMode: 'horticulture',
            projectData: projectData,
            projectStats: {
                totalAreaInRai: totalArea / 1600,
                totalPlants: history.present.plants.length,
                totalWaterNeedPerSession:
                    history.present.plants.length *
                    (history.present.selectedPlantType?.waterNeed || 50),
                zones: history.present.zones.length,
                mainPipes: history.present.mainPipes.length,
                subMainPipes: history.present.subMainPipes.length,
                branchPipes: history.present.subMainPipes.reduce(
                    (total, pipe) => total + (pipe.branchPipes?.length || 0),
                    0
                ),
                exclusionAreas: history.present.exclusionAreas.length,
            },
            activeZoneId:
                history.present.zones.length > 0 ? history.present.zones[0].id : 'main-area',
            zoneInputs: {},
            zoneSprinklers: {},
            selectedPipes: {},
            selectedPump: null,
            showPumpOption: true,
            zoneOperationMode: 'sequential',
            zoneOperationGroups: [],
            quotationData: {},
            quotationDataCustomer: {},
            gardenData: null,
            gardenStats: null,
            fieldCropData: null,
            greenhouseData: null,
            projectImage: null,
        };
        if (!safeLocalStorageSet(fieldSpecificKey, JSON.stringify(productPageData))) {
            console.error('❌ Failed to save to field-specific storage');
        }

        // Create field data for database
        const fieldData = {
            name: draftName,
            field_name: draftName, // Add field_name for updateField method
            customer_name: customerName || 'Draft Customer',
            category: 'horticulture',
            status: 'unfinished',
            is_completed: false,
            total_area: totalArea / 1600, // Convert to rai
            total_plants: history.present.plants.length,
            total_water_need:
                history.present.plants.length *
                (history.present.selectedPlantType?.waterNeed || 50),
            area_coordinates: history.present.mainArea, // Changed from 'area' to 'area_coordinates'
            plant_type_id: (() => {
                // Map frontend plant type IDs to database IDs
                const frontendToDbIdMap: { [key: number]: number } = {
                    1: 21, // มะม่วง
                    2: 22, // ทุเรียน
                    3: 23, // สับปะรด
                    4: 24, // กล้วย
                    5: 25, // มะละกอ
                    6: 26, // มะพร้าว
                    7: 27, // กาแฟอาราบิก้า
                    8: 28, // โกโก้
                    9: 29, // ปาล์มน้ำมัน
                    10: 30, // ยางพารา
                };

                const frontendId = history.present.selectedPlantType?.id;
                return frontendId && frontendToDbIdMap[frontendId]
                    ? frontendToDbIdMap[frontendId]
                    : 21; // Default to มะม่วง
            })(),
            area_type: 'polygon',
            zone_operation_mode: 'sequential', // Add required field
            zone_operation_groups: [], // Add required field
            zone_inputs: {}, // Add required field
            selected_pipes: {}, // Add required field
            selected_pump: null, // Add required field
            zone_sprinklers: {}, // Add required field
            effective_equipment: {}, // Add required field
            zone_calculation_data: [], // Add required field
            active_zone_id: '', // Add required field
            show_pump_option: true, // Add required field
            quotation_data: {}, // Add required field
            quotation_data_customer: {}, // Add required field
            garden_data: null, // Add required field
            garden_stats: null, // Add required field
            field_crop_data: null, // Add required field
            greenhouse_data: null, // Add required field
            project_mode: 'horticulture',
            project_data: projectData,
            project_stats: {
                totalAreaInRai: totalArea / 1600,
                totalPlants: history.present.plants.length,
                totalWaterNeedPerSession:
                    history.present.plants.length *
                    (history.present.selectedPlantType?.waterNeed || 50),
                zones: history.present.zones.length,
                mainPipes: history.present.mainPipes.length,
                subMainPipes: history.present.subMainPipes.length,
                branchPipes: history.present.subMainPipes.reduce(
                    (total, pipe) => total + (pipe.branchPipes?.length || 0),
                    0
                ),
                exclusionAreas: history.present.exclusionAreas.length,
            },
            last_saved: new Date().toISOString(),
        };

        console.log('📦 Field data to send:', fieldData);
        console.log('🌱 Selected plant type:', history.present.selectedPlantType);
        console.log('🆔 Plant type ID being sent:', fieldData.plant_type_id);
        console.log('🔄 Is editing existing field:', isEditingExisting);
        console.log('🆔 Existing field ID:', existingFieldId);

        try {
            let response;

            if (isEditingExisting) {
                // Update existing field using updateFieldData for JSON fields
                console.log('🔄 Updating existing draft field:', existingFieldId);

                // First, get the existing field data to preserve any existing work
                let existingProjectData: any = null;
                try {
                    const existingFieldResponse = await axios.get(`/api/fields/${existingFieldId}`);
                    if (existingFieldResponse.data.success && existingFieldResponse.data.field) {
                        existingProjectData = existingFieldResponse.data.field.project_data;
                        console.log('📦 Found existing project data:', existingProjectData);
                    }
                } catch (error) {
                    console.warn('⚠️ Could not fetch existing field data:', error);
                }

                // Merge existing data with current data to preserve work
                const mergedProjectData = {
                    ...(existingProjectData || {}), // Preserve existing data (or empty object if null)
                    ...projectData, // Override with current data
                    updatedAt: new Date().toISOString(), // Update timestamp
                };

                console.log(
                    '🔄 Merged project data - existing zones:',
                    existingProjectData?.zones?.length || 0
                );
                console.log('🔄 Merged project data - current zones:', projectData.zones.length);
                console.log(
                    '🔄 Merged project data - existing plants:',
                    existingProjectData?.plants?.length || 0
                );
                console.log('🔄 Merged project data - current plants:', projectData.plants.length);

                // First update the basic field information
                const basicFieldData = {
                    name: draftName,
                    field_name: draftName,
                    customer_name: customerName || 'Draft Customer',
                    category: 'horticulture',
                    status: 'unfinished',
                    is_completed: false,
                    total_area: totalArea / 1600,
                    total_plants: history.present.plants.length,
                    total_water_need:
                        history.present.plants.length *
                        (history.present.selectedPlantType?.waterNeed || 50),
                    area_coordinates: history.present.mainArea,
                    plant_type_id: (() => {
                        const frontendToDbIdMap: { [key: number]: number } = {
                            1: 21,
                            2: 22,
                            3: 23,
                            4: 24,
                            5: 25,
                            6: 26,
                            7: 27,
                            8: 28,
                            9: 29,
                            10: 30,
                        };
                        const frontendId = history.present.selectedPlantType?.id;
                        return frontendId && frontendToDbIdMap[frontendId]
                            ? frontendToDbIdMap[frontendId]
                            : 21;
                    })(),
                    area_type: 'polygon',
                };

                // Update basic field info using updateField
                await axios.put(`/api/fields/${existingFieldId}`, basicFieldData);

                // Then update the JSON data using updateFieldData with merged data
                const jsonFieldData = {
                    status: 'unfinished',
                    is_completed: false,
                    zone_operation_mode: 'sequential',
                    zone_operation_groups: [],
                    zone_inputs: {},
                    selected_pipes: {},
                    selected_pump: null,
                    zone_sprinklers: {},
                    effective_equipment: {},
                    zone_calculation_data: [],
                    active_zone_id: '',
                    show_pump_option: true,
                    quotation_data: {},
                    quotation_data_customer: {},
                    garden_data: null,
                    garden_stats: null,
                    field_crop_data: null,
                    greenhouse_data: null,
                    project_mode: 'horticulture',
                    project_data: mergedProjectData, // Use merged data instead of current data
                    project_stats: {
                        totalAreaInRai: totalArea / 1600,
                        totalPlants: history.present.plants.length,
                        totalWaterNeedPerSession:
                            history.present.plants.length *
                            (history.present.selectedPlantType?.waterNeed || 50),
                        zones: history.present.zones.length,
                        mainPipes: history.present.mainPipes.length,
                        subMainPipes: history.present.subMainPipes.length,
                        branchPipes: history.present.subMainPipes.reduce(
                            (total, pipe) => total + (pipe.branchPipes?.length || 0),
                            0
                        ),
                        exclusionAreas: history.present.exclusionAreas.length,
                    },
                    last_saved: new Date().toISOString(),
                };

                response = await axios.put(`/api/fields/${existingFieldId}/data`, jsonFieldData);
            } else {
                // Create new field
                console.log('🆕 Creating new draft field');
                response = await axios.post('/api/fields', fieldData);
            }

            if (response.data.success) {
                // Handle different response formats from createField vs updateField
                const fieldId = response.data.field?.id || response.data.field_id;
                console.log('✅ Draft saved successfully:', fieldId);

                // Store the field ID for future reference
                if (!safeLocalStorageSet('currentFieldId', fieldId)) {
                    console.error('❌ Failed to save currentFieldId');
                }
                if (!safeLocalStorageSet('currentFieldName', draftName)) {
                    console.error('❌ Failed to save currentFieldName');
                }

                const message = isEditingExisting
                    ? t('อัปเดตร่างสำเร็จ! แปลงได้รับการอัปเดตในโฟลเดอร์ "ยังไม่เสร็จ"')
                    : t('บันทึกร่างสำเร็จ! แปลงจะถูกเก็บในโฟลเดอร์ "ยังไม่เสร็จ"');

                alert(message);

                // Navigate to home page to show the saved draft
                router.visit('/');
            } else {
                throw new Error('Failed to save draft');
            }
        } catch (error: any) {
            console.error('❌ Error saving draft:', error);
            console.error('Error details:', error.response?.data);
            console.error('Request data:', fieldData);
            alert(t('เกิดข้อผิดพลาดในการบันทึกร่าง กรุณาลองใหม่อีกครั้ง'));
        }
    }, [
        history.present.mainArea,
        history.present.pump,
        history.present.zones,
        history.present.mainPipes,
        history.present.subMainPipes,
        history.present.exclusionAreas,
        history.present.plants,
        history.present.useZones,
        history.present.selectedPlantType,
        history.present.branchPipeSettings,
        customerName,
        totalArea,
        t,
    ]);

    const handleSaveProject = useCallback(() => {
        if (!history.present.pump || history.present.mainArea.length === 0) {
            alert(t('กรุณาวางปั๊มและสร้างพื้นที่หลักก่อนบันทึก'));
            return;
        }

        const projectData = {
            projectName,
            customerName,
            version: '4.0.0',
            totalArea,
            mainArea: history.present.mainArea,
            pump: history.present.pump,
            zones: history.present.zones,
            mainPipes: history.present.mainPipes,
            subMainPipes: history.present.subMainPipes,
            lateralPipes: history.present.lateralPipes, // เพิ่มท่อย่อย
            exclusionAreas: history.present.exclusionAreas,
            plants: history.present.plants,
            useZones: history.present.useZones,
            selectedPlantType: history.present.selectedPlantType,
            availablePlants: history.present.availablePlants, // เพิ่มการบันทึกพืชที่มีทั้งหมด
            branchPipeSettings: history.present.branchPipeSettings,
            irrigationZones: history.present.irrigationZones, // เพิ่มโซนชลประทาน
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const saveSuccess = safeLocalStorageSet(
            'horticultureIrrigationData',
            JSON.stringify(projectData)
        );
        if (!saveSuccess) {
            console.error('❌ Failed to save to horticultureIrrigationData');
            // Show user-friendly error message
            alert('ไม่สามารถบันทึกข้อมูลได้เนื่องจากพื้นที่เก็บข้อมูลเต็ม กรุณาลองใหม่อีกครั้ง');
            return;
        }

        // Always go to results page first, regardless of whether it's a new project or finished draft
        const params = new URLSearchParams({
            projectName,
            customerName,
            totalArea: totalArea.toString(),
        });

        console.log('✅ Project saved successfully, navigating to results page...');
        router.visit(`/horticulture/results?${params.toString()}`);
    }, [
        history.present.pump,
        history.present.mainArea,
        history.present.zones,
        history.present.mainPipes,
        history.present.subMainPipes,
        history.present.lateralPipes,
        history.present.exclusionAreas,
        history.present.plants,
        history.present.useZones,
        history.present.selectedPlantType,
        history.present.branchPipeSettings,
        history.present.irrigationZones,
        history.present.availablePlants,
        projectName,
        customerName,
        totalArea,
        t,
    ]);

    const canSaveProject = history.present.pump && history.present.mainArea.length > 0;
    const canSaveDraft = history.present.mainArea.length > 0;

    const handleRetry = () => {
        setIsRetrying(true);
        setError(null);
        window.location.reload();
    };

    const handlePlantSelection = () => {
        if (history.present.plants.length > 0) {
            pushToHistory({
                plants: [],
                plantAreas: [],
                plantSelectionMode: {
                    type: 'single',
                    isCompleted: false,
                },
            });
        }
        setShowPlantTypeSelectionModal(true);
    };

    const handleSinglePlantSelection = () => {
        pushToHistory({
            plants: [],
            plantAreas: [],
            plantSelectionMode: {
                type: 'single',
                isCompleted: true,
            },
        });
        setShowPlantTypeSelectionModal(false);
        setShowPlantGenerationModal(true);
    };

    const handleMultiplePlantsSelection = () => {
        pushToHistory({
            plants: [],
            plantAreas: [],
            plantSelectionMode: {
                type: 'multiple',
                isCompleted: false,
            },
        });
        setShowPlantTypeSelectionModal(false);
        setIsDrawingPlantArea(true);
        setEditMode('plantArea');
    };

    const _handlePlantAreaCreated = (coordinates: Coordinate[], plantData: PlantData) => {
        const newPlantArea: PlantArea = {
            id: generateUniqueId('plantArea'),
            name: `พื้นที่ปลูก ${plantData.name}`,
            coordinates,
            plantData,
            color: getZoneColor(history.present.plantAreas.length),
            isCompleted: false,
        };

        pushToHistory({
            plantAreas: [...history.present.plantAreas, newPlantArea],
        });

        setCurrentPlantArea(newPlantArea);
    };

    const handleCompletePlantAreas = () => {
        // ตรวจสอบว่ามีพื้นที่ที่ยังไม่ได้เลือกพืชหรือไม่
        const incompleteAreas = history.present.plantAreas.filter((area) => !area.isCompleted);

        if (incompleteAreas.length > 0) {
            // แสดงข้อความแจ้งเตือนและเปิด modal สำหรับพื้นที่แรกที่ยังไม่เสร็จ
            if (typeof window !== 'undefined' && (window as any).showNotification) {
                (window as any).showNotification(
                    `กรุณาเลือกพืชสำหรับพื้นที่ที่ยังไม่เสร็จ (${incompleteAreas.length} พื้นที่)`,
                    'warning'
                );
            }
            setCurrentPlantArea(incompleteAreas[0]);
            setShowPlantAreaSelectionModal(true);
            return;
        }

        // ถ้าทุกพื้นที่เสร็จแล้ว ให้ดำเนินการต่อ
        pushToHistory({
            plantSelectionMode: {
                ...history.present.plantSelectionMode,
                isCompleted: true,
            },
        });
        setIsDrawingPlantArea(false);
        setEditMode(null);
        setShowPlantGenerationModal(true);
    };

    const handleGeneratePlants = () => {
        try {
            const settings = history.present.plantGenerationSettings;
            pushToHistory({
                plantGenerationSettings: { ...settings, isGenerating: true },
            });

            let allPlants: PlantLocation[] = [];

            if (
                history.present.plantSelectionMode.type === 'multiple' &&
                history.present.plantAreas.length > 0
            ) {
                // ตรวจสอบว่าทุกพื้นที่มีการเลือกพืชแล้ว
                const incompleteAreas = history.present.plantAreas.filter(
                    (area) => !area.isCompleted
                );
                if (incompleteAreas.length > 0) {
                    pushToHistory({
                        plantGenerationSettings: { ...settings, isGenerating: false },
                    });

                    if (typeof window !== 'undefined' && (window as any).showNotification) {
                        (window as any).showNotification(
                            `กรุณาเลือกพืชสำหรับพื้นที่ที่ยังไม่เสร็จ (${incompleteAreas.length} พื้นที่)`,
                            'error'
                        );
                    }
                    return;
                }

                // คำนวณ shared baseline สำหรับการจัดแถวแรกให้อยู่ในระดับเดียวกัน
                // ใช้ข้อมูลพืชจากพื้นที่แรกเป็น reference สำหรับการคำนวณ
                const completedAreas = history.present.plantAreas.filter(
                    (area) => area.isCompleted
                );
                if (completedAreas.length === 0) {
                    throw new Error('ไม่พบพื้นที่ปลูกที่เสร็จสมบูรณ์');
                }

                const referenceArea = completedAreas[0];
                const sharedBaseline = calculateSharedBaseline(
                    completedAreas,
                    referenceArea.plantData
                );

                completedAreas.forEach((area, areaIndex) => {
                    try {
                        const plants = generatePlantsInAreaWithSmartBoundary(
                            area.coordinates,
                            area.plantData,
                            settings.layoutPattern,
                            history.present.exclusionAreas,
                            completedAreas.filter((a) => a.id !== area.id),
                            settings.rotationAngle,
                            sharedBaseline
                        );

                        const plantsWithAreaInfo = plants.map((plant) => ({
                            ...plant,
                            zoneId: area.id,
                            plantAreaId: area.id,
                            plantAreaColor: area.color,
                        }));

                        allPlants = [...allPlants, ...plantsWithAreaInfo];
                    } catch (error) {
                        console.error(`Error generating plants for area ${area.name}:`, error);
                        if (typeof window !== 'undefined' && (window as any).showNotification) {
                            (window as any).showNotification(
                                `เกิดข้อผิดพลาดในการสร้างพืชสำหรับ ${area.name}`,
                                'error'
                            );
                        }
                    }
                });
            } else {
                // โหมดพืชชนิดเดียว
                if (!history.present.selectedPlantType) {
                    throw new Error('กรุณาเลือกชนิดพืชก่อนสร้างต้นไม้');
                }

                allPlants = generatePlantsInArea(
                    history.present.mainArea,
                    history.present.selectedPlantType,
                    settings.layoutPattern,
                    history.present.exclusionAreas,
                    settings.rotationAngle
                );
            }

            allPlants = removePlantsInExclusionZones(allPlants, history.present.exclusionAreas);

            if (allPlants.length === 0) {
                throw new Error('ไม่สามารถสร้างต้นไม้ได้ กรุณาตรวจสอบพื้นที่และการตั้งค่า');
            }

            pushToHistory({
                plants: allPlants,
                plantGenerationSettings: { ...settings, isGenerating: false },
            });

            setShowPlantGenerationModal(false);

            // แสดง popup กรอกข้อมูลหัวฉีดน้ำหลังจากสร้างต้นไม้เสร็จ
            setShowSprinklerConfigModal(true);

            if (typeof window !== 'undefined' && (window as any).showNotification) {
                (window as any).showNotification(
                    `สร้างต้นไม้สำเร็จ: ${allPlants.length} ต้น กรุณากรอกข้อมูลหัวฉีดน้ำ`,
                    'success'
                );
            }
        } catch (error) {
            console.error('Error in handleGeneratePlants:', error);

            pushToHistory({
                plantGenerationSettings: {
                    ...history.present.plantGenerationSettings,
                    isGenerating: false,
                },
            });

            if (typeof window !== 'undefined' && (window as any).showNotification) {
                (window as any).showNotification(
                    error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการสร้างต้นไม้',
                    'error'
                );
            }
        }
    };

    const getCurrentRotationAngle = () => {
        // ตรวจสอบว่ามีต้นไม้หรือไม่
        if (history.present.plants.length > 0) {
            // หาต้นไม้ที่มีข้อมูล rotationAngle
            const plantsWithRotation = history.present.plants.filter(
                (plant) => plant.rotationAngle !== undefined && plant.rotationAngle !== null
            );

            if (plantsWithRotation.length > 0) {
                // ใช้มุมหมุนจากต้นไม้ต้นแรกที่มีข้อมูล
                const rotationAngle = plantsWithRotation[0].rotationAngle!;
                return typeof rotationAngle === 'number' ? rotationAngle : 0;
            }
        }

        // ถ้าไม่มีต้นไม้หรือต้นไม้ไม่มีข้อมูล rotationAngle ให้ใช้ค่าจาก plantGenerationSettings
        const settingsRotation = history.present.plantGenerationSettings?.rotationAngle;
        return typeof settingsRotation === 'number' ? settingsRotation : 0;
    };

    // ฟังก์ชันช่วย: รับประกันว่าต้นไม้มี rotationAngle ที่ถูกต้อง
    const getPlantsWithCorrectRotationAngle = (): PlantLocation[] => {
        const currentRotationAngle = getCurrentRotationAngle();

        return history.present.plants.map((plant) => ({
            ...plant,
            rotationAngle: currentRotationAngle,
        }));
    };

    // ฟังก์ชันใหม่: อัปเดต rotationAngle ของต้นไม้ทั้งหมดในระบบ
    const updatePlantsRotationAngle = (newRotationAngle: number) => {
        dispatchHistory({
            type: 'PUSH_STATE',
            state: {
                ...history.present,
                plants: history.present.plants.map((plant) => ({
                    ...plant,
                    rotationAngle: newRotationAngle,
                })),
                plantGenerationSettings: {
                    ...history.present.plantGenerationSettings,
                    rotationAngle: newRotationAngle,
                },
            },
        });
    };

    // Sprinkler Configuration Handlers
    const handleSprinklerConfigSave = (config: SprinklerFormData) => {
        setSprinklerConfig(config);
        setShowSprinklerConfigModal(false);

        // คำนวณ Q รวม
        const flowRate = parseFloat(config.flowRatePerMinute);
        const totalFlowRate = calculateTotalFlowRate(history.present.plants.length, flowRate);

        // อัปเดตรัศมีที่แสดงอยู่ (ถ้ามี)
        if (showSprinklerRadius) {
            // เรียกใช้ useEffect เพื่ออัปเดตการแสดงผล
            setShowSprinklerRadius(false);
            setTimeout(() => setShowSprinklerRadius(true), 100);
        }

        if (typeof window !== 'undefined' && (window as any).showNotification) {
            const totalWaterNeed = history.present.plants.reduce(
                (sum, plant) => sum + plant.plantData.waterNeed,
                0
            );
            (window as any).showNotification(
                `บันทึกการตั้งค่าหัวฉีดเรียบร้อย\nปริมาณน้ำรวม: ${totalWaterNeed.toFixed(2)} ลิตร\nQ รวม: ${totalFlowRate.toFixed(2)} ลิตร/นาที`,
                'success'
            );
        }
    };

    const handleSprinklerConfigClose = () => {
        setShowSprinklerConfigModal(false);
    };

    const toggleSprinklerRadius = () => {
        const sprinklerConfig = loadSprinklerConfig();
        if (!sprinklerConfig || sprinklerConfig.radiusMeters <= 0) {
            // แสดงข้อความแจ้งเตือนให้ผู้ใช้ตั้งค่าหัวฉีดก่อน
            if (typeof window !== 'undefined' && (window as any).showNotification) {
                (window as any).showNotification(
                    t('กรุณาตั้งค่าหัวฉีดน้ำก่อนเพื่อแสดงรัศมี'),
                    'warning'
                );
            }
            // เปิด modal ตั้งค่าหัวฉีด
            setShowSprinklerConfigModal(true);
            return;
        }
        setShowSprinklerRadius(!showSprinklerRadius);
    };

    // Handler for clicking on completed lateral pipes (not in drawing mode)
    const handleCompletedLateralPipeClick = (lateralPipeId: string) => {
        const lateralPipe = history.present.lateralPipes.find((pipe) => pipe.id === lateralPipeId);
        if (lateralPipe) {
            setSelectedLateralPipe(lateralPipe);
            setShowLateralPipeInfoModal(true);
        }
    };

    const handleLateralPipeInfoModalClose = () => {
        setShowLateralPipeInfoModal(false);
        setSelectedLateralPipe(null);
    };

    // โหลดข้อมูลหัวฉีดเมื่อเริ่มต้น
    useEffect(() => {
        const savedConfig = loadSprinklerConfig();
        if (savedConfig) {
            setSprinklerConfig({
                flowRatePerMinute: savedConfig.flowRatePerMinute.toString(),
                pressureBar: savedConfig.pressureBar.toString(),
                radiusMeters: savedConfig.radiusMeters.toString(),
            });
        }
    }, []);

    const handleOpenPlantRotationControl = () => {
        const currentRotationAngle = getCurrentRotationAngle();
        setTempRotationAngle(currentRotationAngle);
        setShowPlantRotationControl(true);
    };

    const handleClosePlantRotationControl = () => {
        setShowPlantRotationControl(false);
        const currentRotationAngle = getCurrentRotationAngle();
        setTempRotationAngle(currentRotationAngle);
    };

    const handleRotationChange = (angle: number) => {
        setTempRotationAngle(angle);
    };

    const handleApplyRotation = () => {
        setIsApplyingRotation(true);

        // 🔧 แก้ไข: อัปเดต rotationAngle ของต้นไม้ที่มีอยู่แล้วในระบบ
        updatePlantsRotationAngle(tempRotationAngle);

        const settings = {
            ...history.present.plantGenerationSettings,
            rotationAngle: tempRotationAngle,
        };

        let allPlants: PlantLocation[] = [];

        if (
            history.present.plantSelectionMode.type === 'multiple' &&
            history.present.plantAreas.length > 0
        ) {
            // คำนวณ shared baseline สำหรับการจัดแถวแรกให้อยู่ในระดับเดียวกัน
            const referenceArea = history.present.plantAreas[0];
            const sharedBaseline = calculateSharedBaseline(
                history.present.plantAreas,
                referenceArea.plantData
            );

            history.present.plantAreas.forEach((area, areaIndex) => {
                const plants = generatePlantsInAreaWithSmartBoundary(
                    area.coordinates,
                    area.plantData,
                    settings.layoutPattern,
                    history.present.exclusionAreas,
                    history.present.plantAreas.filter((a) => a.id !== area.id),
                    settings.rotationAngle,
                    sharedBaseline
                );

                const plantsWithAreaInfo = plants.map((plant) => ({
                    ...plant,
                    zoneId: area.id,
                    plantAreaId: area.id,
                    plantAreaColor: area.color,
                    rotationAngle: settings.rotationAngle,
                }));

                allPlants = [...allPlants, ...plantsWithAreaInfo];
            });
        } else {
            allPlants = generatePlantsInArea(
                history.present.mainArea,
                history.present.selectedPlantType,
                settings.layoutPattern,
                history.present.exclusionAreas,
                settings.rotationAngle
            ).map((plant) => ({
                ...plant,
                rotationAngle: settings.rotationAngle,
            }));
        }

        allPlants = removePlantsInExclusionZones(allPlants, history.present.exclusionAreas);

        pushToHistory({
            plants: allPlants,
        });

        setIsApplyingRotation(false);

        if (typeof window !== 'undefined' && (window as any).showNotification) {
            (window as any).showNotification(
                `ปรับมุมเอียงต้นไม้สำเร็จ: ${tempRotationAngle}°`,
                'success'
            );
        }
    };

    const handleMainPipeClick = useCallback(
        (pipeId: string, clickPosition: Coordinate) => {
            if (editMode === 'subMainPipe') {
                const newSubMainPipe: SubMainPipe = {
                    id: generateUniqueId('subMain'),
                    zoneId: pipeId,
                    coordinates: [clickPosition],
                    length: 0,
                    diameter: 50,
                    branchPipes: [],
                    material: 'pvc',
                    isEditable: true,
                };

                pushToHistory({
                    subMainPipes: [...history.present.subMainPipes, newSubMainPipe],
                });

                if (typeof window !== 'undefined' && (window as any).showNotification) {
                    (window as any).showNotification(
                        `เริ่มวาดท่อเมนรองจากท่อเมน ${pipeId} ที่จุด ${clickPosition.lat.toFixed(6)}, ${clickPosition.lng.toFixed(6)}`,
                        'info'
                    );
                }

                setEditMode('subMainPipe');
            }
        },
        [editMode, pushToHistory, history.present.subMainPipes]
    );

    const handleToggleDimensionLines = (exclusionZoneId: string) => {
        pushToHistory({
            exclusionZones: history.present.exclusionZones.map((zone) =>
                zone.id === exclusionZoneId
                    ? { ...zone, showDimensionLines: !zone.showDimensionLines }
                    : zone
            ),
        });
    };

    const handleTogglePlantAreaVisibility = (areaId: string) => {
        pushToHistory({
            layerVisibility: {
                ...history.present.layerVisibility,
                plantAreas: !history.present.layerVisibility.plantAreas,
            },
        });
    };

    const handleGenerateIrrigationZones = () => {
        // ฟังก์ชันนี้ถูกลบออกแล้ว - ใช้การสร้างโซนด้วยตัวเองแทน
        console.warn('การสร้างโซนอัตโนมัติถูกลบออกแล้ว กรุณาใช้การสร้างโซนด้วยตัวเอง');
    };

    const handleRegenerateIrrigationZones = () => {
        // ฟังก์ชันนี้ถูกลบออกแล้ว - ใช้การสร้างโซนด้วยตัวเองแทน
        console.warn('การสร้างโซนอัตโนมัติถูกลบออกแล้ว กรุณาใช้การสร้างโซนด้วยตัวเอง');
    };

    const handleStartManualIrrigationZones = () => {
        pushToHistory({ irrigationZones: [] });

        const totalWaterNeed = history.present.plants.reduce(
            (sum, plant) => sum + plant.plantData.waterNeed,
            0
        );
        const targetWater = totalWaterNeed / numberOfManualZones;

        setTargetWaterPerZone(targetWater);
        setCurrentManualZoneIndex(0);
        setManualZones([]);
        setIsDrawingManualZone(true);
        setEditMode('manualZone');
        setShowManualIrrigationZoneModal(false);
    };

    // Zone Edit Functions
    const handleStartZoneEditMode = () => {
        setIsZoneEditMode(true);
        setSelectedZoneForEdit(null);
        setZoneControlPoints([]);
        setDraggedControlPointIndex(null);
    };

    const handleExitZoneEditMode = () => {
        setIsZoneEditMode(false);
        setSelectedZoneForEdit(null);
        setZoneControlPoints([]);
        setDraggedControlPointIndex(null);
    };

    // เพิ่มฟังก์ชัน toggle สำหรับความสอดคล้อง
    const handleToggleZoneEditMode = () => {
        if (isZoneEditMode) {
            handleExitZoneEditMode();
        } else {
            handleStartZoneEditMode();
        }
    };

    const generateZoneControlPoints = (zoneCoordinates: Coordinate[]): Coordinate[] => {
        if (zoneCoordinates.length < 3) return [];

        const controlPoints: Coordinate[] = [];

        // เพิ่มเฉพาะจุดมุมของโซน - ใช้ deep copy เพื่อหลีกเลี่ยง reference sharing
        zoneCoordinates.forEach((coord) => {
            controlPoints.push({ lat: coord.lat, lng: coord.lng });
        });

        // ไม่เพิ่มจุดกึ่งกลางแล้ว - แสดงเฉพาะจุดมุม

        return controlPoints;
    };

    const handleZoneSelect = (zone: IrrigationZone) => {
        if (!isZoneEditMode) return;

        setSelectedZoneForEdit(zone);
        const controlPoints = generateZoneControlPoints(zone.coordinates);
        setZoneControlPoints(controlPoints);
    };

    // เพิ่มฟังก์ชันสำหรับจัดการการเลือกโซนที่วาดเอง (Manual Zones)
    const handleManualZoneSelect = (manualZone: ManualIrrigationZone) => {
        if (!isZoneEditMode) return;

        // แปลง ManualIrrigationZone เป็น IrrigationZone เพื่อใช้กับระบบแก้ไขที่มีอยู่
        const convertedZone: IrrigationZone = {
            id: manualZone.id,
            name: manualZone.name,
            coordinates: manualZone.coordinates,
            plants: manualZone.plants,
            totalWaterNeed: manualZone.totalWaterNeed,
            color: manualZone.color,
            layoutIndex: manualZone.zoneIndex,
        };

        setSelectedZoneForEdit(convertedZone);
        const controlPoints = generateZoneControlPoints(manualZone.coordinates);
        setZoneControlPoints(controlPoints);
    };

    const handleUpdateZone = (updatedCoordinates: Coordinate[]) => {
        if (!selectedZoneForEdit) return;

        // 🎯 Zone Edit Feature: ใช้ Polygon Clipping (ปรับปรุงให้มีความยืดหยุ่นมากขึ้น)
        // ผู้ใช้สามารถลากจุดควบคุมออกนอกพื้นที่หลักได้
        // แต่โซนที่แสดงจะถูกตัด (clip) ให้แสดงเฉพาะส่วนที่ทับกับพื้นที่หลัก

        // ตรวจสอบว่า coordinates ที่อัปเดตมีอย่างน้อย 3 จุด
        if (updatedCoordinates.length < 3) {
            console.warn('⚠️ Zone has insufficient coordinates, keeping original');
            return;
        }

        const clippedCoordinates = clipPolygonToMainArea(
            updatedCoordinates,
            history.present.mainArea
        );

        // 🔧 แก้ไข: ใช้ coordinates ที่ดีที่สุดแทนการกรองออก
        let finalCoordinates: Coordinate[];

        if (clippedCoordinates.length >= 3) {
            // ใช้ clipped coordinates ถ้าถูกต้อง
            finalCoordinates = clippedCoordinates;
        } else {
            // 🔧 แก้ไข: ใช้ original coordinates แทนการทำให้โซนหาย
            // แต่จำกัดให้อยู่ในพื้นที่หลักเท่าที่เป็นไปได้
            const constrainedCoordinates = updatedCoordinates.map((coord) => {
                // ตรวจสอบว่าจุดอยู่ในพื้นที่หลักหรือไม่
                if (isPointInPolygon(coord, history.present.mainArea)) {
                    return coord;
                } else {
                    // หาจุดที่ใกล้ที่สุดในพื้นที่หลัก
                    return findClosestPointInMainArea(coord, history.present.mainArea);
                }
            });
            finalCoordinates = constrainedCoordinates;
            console.warn('⚠️ Zone partially outside main area, using constrained coordinates');
        }

        // หาต้นไม้ที่อยู่ในโซนสุดท้าย (ใช้ coordinates ที่ถูก clip แล้ว)
        const plantsInUpdatedZone =
            finalCoordinates.length >= 3
                ? history.present.plants.filter((plant) =>
                      isPointInPolygon(plant.position, finalCoordinates)
                  )
                : [];

        // คำนวณความต้องการน้ำใหม่
        const newWaterNeed = plantsInUpdatedZone.reduce(
            (sum, plant) => sum + plant.plantData.waterNeed,
            0
        );

        // ตรวจสอบว่าเป็น Manual Zone หรือ Irrigation Zone
        const isManualZone = manualZones.some((zone) => zone.id === selectedZoneForEdit.id);

        if (isManualZone) {
            // อัปเดต Manual Zone
            const updatedManualZones = manualZones.map((zone) =>
                zone.id === selectedZoneForEdit.id
                    ? {
                          ...zone,
                          coordinates: finalCoordinates.map((coord) => ({
                              lat: coord.lat,
                              lng: coord.lng,
                          })),
                          plants: plantsInUpdatedZone,
                          totalWaterNeed: newWaterNeed,
                      }
                    : zone
            );
            setManualZones(updatedManualZones);
        } else {
            // อัปเดต Irrigation Zone (โค้ดเดิม)
            const updatedZones = history.present.irrigationZones.map((zone) =>
                zone.id === selectedZoneForEdit.id
                    ? {
                          ...zone,
                          coordinates: finalCoordinates.map((coord) => ({
                              lat: coord.lat,
                              lng: coord.lng,
                          })),
                          plants: plantsInUpdatedZone,
                          totalWaterNeed: newWaterNeed,
                      }
                    : zone
            );

            // อัปเดตการกำหนด zoneId ให้ต้นไม้ (ใช้ updated coordinates ตรงๆ)
            const updatedPlants = history.present.plants.map((plant) => {
                // หาโซนที่ต้นไม้อยู่ โดยใช้ coordinates ตำแหน่งจริงที่ user ลาก
                const plantZone = updatedZones.find(
                    (zone) =>
                        zone.coordinates.length >= 3 &&
                        isPointInPolygon(plant.position, zone.coordinates)
                );

                return {
                    ...plant,
                    zoneId: plantZone ? plantZone.id : undefined,
                };
            });

            pushToHistory({
                irrigationZones: updatedZones,
                plants: updatedPlants,
            });
        }

        // อัปเดต selectedZoneForEdit ให้ตรงกับ zone ที่อัปเดตแล้ว
        if (isManualZone) {
            const updatedManualZone = manualZones.find(
                (zone) => zone.id === selectedZoneForEdit.id
            );
            if (updatedManualZone) {
                // แปลง ManualIrrigationZone เป็น IrrigationZone เพื่อใช้กับ selectedZoneForEdit
                const convertedZone: IrrigationZone = {
                    id: updatedManualZone.id,
                    name: updatedManualZone.name,
                    coordinates: updatedManualZone.coordinates,
                    plants: updatedManualZone.plants,
                    totalWaterNeed: updatedManualZone.totalWaterNeed,
                    color: updatedManualZone.color,
                    layoutIndex: updatedManualZone.zoneIndex,
                };
                setSelectedZoneForEdit(convertedZone);
            }
        } else {
            const updatedSelectedZone = history.present.irrigationZones.find(
                (zone) => zone.id === selectedZoneForEdit.id
            );
            if (updatedSelectedZone) {
                setSelectedZoneForEdit(updatedSelectedZone);
            }
        }

        // 🔧 แก้ไขปัญหา: อัปเดต zoneControlPoints ให้ตรงกับ finalCoordinates
        // เพื่อให้ control points sync กับโซนที่แสดงจริงหลังจาก clipping
        const newControlPoints = generateZoneControlPoints(finalCoordinates);
        setZoneControlPoints(newControlPoints);
    };

    const handleManualZoneDrawingComplete = (coordinates: Coordinate[], shapeType: string) => {
        const plantsInZone = history.present.plants.filter((plant) =>
            isPointInPolygon(plant.position, coordinates)
        );

        const totalWaterNeed = plantsInZone.reduce(
            (sum, plant) => sum + plant.plantData.waterNeed,
            0
        );

        const basicZone: ManualIrrigationZone = {
            id: generateUniqueId('manualZone'),
            name: `โซน ${currentManualZoneIndex + 1}`,
            coordinates: coordinates,
            plants: plantsInZone,
            totalWaterNeed: totalWaterNeed,
            color: getZoneColor(currentManualZoneIndex),
            zoneIndex: currentManualZoneIndex,
            isAccepted: false,
        };

        // เสริมข้อมูลให้ครบถ้วนเหมือน automatic zones
        const newZone = enhanceManualZone(basicZone);

        setCurrentDrawnZone(newZone);
        setShowManualZoneInfoModal(true);
        setIsDrawingManualZone(false);
        setEditMode(null);
    };

    const handleAcceptManualZone = () => {
        if (currentDrawnZone) {
            const updatedZone = { ...currentDrawnZone, isAccepted: true };
            setManualZones((prev) => [...prev, updatedZone]);
            setShowManualZoneInfoModal(false);
            setCurrentDrawnZone(null);

            if (currentManualZoneIndex + 1 >= numberOfManualZones) {
                const allZones = [...manualZones, updatedZone];
                const allPlantsInZones = allZones.flatMap((zone) => zone.plants);
                const unassignedPlants = history.present.plants.filter(
                    (plant) => !allPlantsInZones.some((zonePlant) => zonePlant.id === plant.id)
                );

                const irrigationZones: IrrigationZone[] = allZones.map((zone, index) => ({
                    id: zone.id,
                    name: zone.name,
                    coordinates: zone.coordinates,
                    plants: zone.plants,
                    totalWaterNeed: zone.totalWaterNeed,
                    color: zone.color,
                    layoutIndex: index,
                    // เพิ่มข้อมูลเสริมให้เหมือน automatic zones
                    area: zone.area || calculateAreaFromCoordinates(zone.coordinates),
                    areaInRai:
                        zone.areaInRai || calculateAreaFromCoordinates(zone.coordinates) / 1600,
                    waterFlowRate:
                        zone.waterFlowRate ||
                        calculateWaterFlowRate(zone.plants.length, loadSprinklerConfig()),
                    bestPipeInfo: zone.bestPipeInfo || {
                        longest: Math.max(...(zone.plants.length > 0 ? [50] : [0])), // ประมาณการ
                        totalLength: zone.plants.length * 10, // ประมาณการ 10m ต่อต้น
                        count: Math.max(1, Math.floor(zone.plants.length / 10)), // ประมาณ 1 ท่อต่อ 10 ต้น
                    },
                }));

                // 🔧 Assign zoneId to plants based on zone assignments (Manual Zones)
                const updatedPlants = history.present.plants.map((plant) => {
                    // ค้นหาโซนที่ plant นี้อยู่
                    const assignedZone = allZones.find((zone) =>
                        zone.plants.some((zonePlant) => zonePlant.id === plant.id)
                    );
                    if (assignedZone) {
                        return {
                            ...plant,
                            zoneId: assignedZone.id,
                        };
                    }
                    return plant;
                });

                pushToHistory({
                    irrigationZones: irrigationZones,
                    plants: updatedPlants,
                });

                setIsDrawingManualZone(false);
                setManualZones([]);
                setCurrentManualZoneIndex(0);
                setEditMode(null);

                let notificationMessage = `สร้างโซนให้น้ำเองสำเร็จ: ${irrigationZones.length} โซน`;
                if (unassignedPlants.length > 0) {
                    notificationMessage += `\nมีต้นไม้ ${unassignedPlants.length} ต้นที่ไม่ได้อยู่ในโซนไหน`;
                }

                if (typeof window !== 'undefined' && (window as any).showNotification) {
                    (window as any).showNotification(
                        notificationMessage,
                        unassignedPlants.length > 0 ? 'warning' : 'success'
                    );
                }
            } else {
                setCurrentManualZoneIndex(currentManualZoneIndex + 1);
                setIsDrawingManualZone(true);
                setEditMode('manualZone');
            }
        }
    };

    // Auto Zone Functions
    const handleCreateAutoZones = async () => {
        if (history.present.plants.length === 0) {
            if (typeof window !== 'undefined' && (window as any).showNotification) {
                (window as any).showNotification(
                    'ไม่มีต้นไม้ในพื้นที่ ไม่สามารถแบ่งโซนได้',
                    'error'
                );
            }
            return;
        }

        setIsCreatingAutoZones(true);

        try {
            // Clear existing zones
            pushToHistory({ irrigationZones: [] });

            // 🔧 กรองต้นไม้ที่ไม่อยู่ในพื้นที่หลีกเลี่ยงก่อนส่งไปแบ่งโซน
            const validPlants = history.present.plants.filter((plant) => {
                // ตรวจสอบว่าต้นไม้ไม่อยู่ในพื้นที่หลีกเลี่ยงใดๆ
                const inExclusion = history.present.exclusionAreas.some((exclusion) =>
                    isPointInPolygon(plant.position, exclusion.coordinates)
                );
                return !inExclusion;
            });

            if (validPlants.length === 0) {
                if (typeof window !== 'undefined' && (window as any).showNotification) {
                    (window as any).showNotification(
                        'ไม่พบต้นไม้ที่สามารถแบ่งโซนได้ (ต้นไม้ทั้งหมดอยู่ในพื้นที่หลีกเลี่ยง)',
                        'warning'
                    );
                }
                setIsCreatingAutoZones(false);
                return;
            }

            console.log(
                `🌱 กำลังแบ่งโซนสำหรับต้นไม้ ${validPlants.length} ต้น (กรองจาก ${history.present.plants.length} ต้น)`
            );

            // Use current config with optional random seed reset
            const configWithRandomSeed = {
                ...autoZoneConfig,
                randomSeed: undefined, // ใช้ random ธรรมดาสำหรับการสร้างใหม่
            };

            const result = createAutomaticZones(
                validPlants, // ใช้ต้นไม้ที่กรองแล้ว
                history.present.mainArea,
                configWithRandomSeed
            );

            setAutoZoneResult(result);

            if (result.success && result.zones.length > 0) {
                // Validate zones
                const validation = validateZones(result.zones, history.present.mainArea);

                if (validation.errors.length > 0) {
                    console.warn('🚨 Zone validation warnings:', validation.errors);
                    if (typeof window !== 'undefined' && (window as any).showNotification) {
                        (window as any).showNotification(
                            `พบปัญหาในการแบ่งโซน: ${validation.errors.join(', ')}`,
                            'warning'
                        );
                    }
                }

                if (validation.warnings.length > 0) {
                    console.warn('⚠️ Zone validation warnings:', validation.warnings);
                }

                // Convert to IrrigationZone format and save
                const irrigationZones = result.zones.map((zone, index) => ({
                    ...zone,
                    layoutIndex: index,
                }));

                // 🔧 Assign zoneId to plants based on zone assignments
                const updatedPlants = history.present.plants.map((plant) => {
                    // ตรวจสอบว่าต้นไม้อยู่ในพื้นที่หลีกเลี่ยงหรือไม่
                    const inExclusion = history.present.exclusionAreas.some((exclusion) =>
                        isPointInPolygon(plant.position, exclusion.coordinates)
                    );

                    if (inExclusion) {
                        // ต้นไม้ในพื้นที่หลีกเลี่ยงไม่ควรมี zoneId
                        return {
                            ...plant,
                            zoneId: undefined,
                        };
                    }

                    // ต้นไม้ที่ไม่อยู่ในพื้นที่หลีกเลี่ยงให้ assign zone
                    const assignedZoneId = result.debugInfo?.plantAssignments?.[plant.id];
                    if (assignedZoneId) {
                        return {
                            ...plant,
                            zoneId: assignedZoneId,
                        };
                    }
                    return plant;
                });

                pushToHistory({
                    irrigationZones,
                    plants: updatedPlants,
                });

                // Show success notification
                const stats = result.debugInfo;
                const config = loadSprinklerConfig();
                const totalPlants = stats.totalPlants; // จำนวนต้นไม้ที่ใช้ในการแบ่งโซนจริง
                const totalPlantsInSystem = history.present.plants.length; // จำนวนต้นไม้ทั้งหมดในระบบ
                const plantsInExclusion = totalPlantsInSystem - totalPlants; // ต้นไม้ในพื้นที่หลีกเลี่ยง
                const avgPlantsPerZone =
                    totalPlants > 0 ? Math.ceil(totalPlants / result.zones.length) : 0;

                let message = `สร้างโซนอัตโนมัติสำเร็จ: ${result.zones.length} โซน\n`;
                message += `ต้นไม้ในโซน: ${totalPlants} ต้น`;
                if (plantsInExclusion > 0) {
                    message += ` (ไม่รวม ${plantsInExclusion} ต้นในพื้นที่หลีกเลี่ยง)`;
                }
                message += `\nปริมาณน้ำเฉลี่ย: ${stats.averageWaterNeedPerZone.toFixed(2)} ลิตร/วัน`;
                if (config && avgPlantsPerZone > 0) {
                    const avgFlowRate = avgPlantsPerZone * config.flowRatePerMinute;
                    message += ` (${avgFlowRate.toFixed(2)} ลิตร/นาที)`;
                }
                message += `\nความแปรปรวน: ${stats.waterNeedVariance.toFixed(2)}`;

                if (typeof window !== 'undefined' && (window as any).showNotification) {
                    (window as any).showNotification(message, 'success');
                }

                // Show debug info if enabled
                if (autoZoneConfig.debugMode) {
                    setShowAutoZoneDebugModal(true);
                }
            } else {
                throw new Error(result.error || 'ไม่สามารถสร้างโซนได้');
            }
        } catch (error) {
            console.error('❌ Auto zone creation failed:', error);
            if (typeof window !== 'undefined' && (window as any).showNotification) {
                (window as any).showNotification(
                    `เกิดข้อผิดพลาดในการสร้างโซน: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    'error'
                );
            }
        } finally {
            setIsCreatingAutoZones(false);
            setShowAutoZoneModal(false);
        }
    };

    // Regenerate zones with different layout but same config
    const handleRegenerateZones = async () => {
        if (history.present.plants.length === 0) {
            if (typeof window !== 'undefined' && (window as any).showNotification) {
                (window as any).showNotification(
                    'ไม่มีต้นไม้ในพื้นที่ ไม่สามารถแบ่งโซนได้',
                    'error'
                );
            }
            return;
        }

        setIsCreatingAutoZones(true);

        try {
            // Clear existing zones
            pushToHistory({ irrigationZones: [] });

            // Use current config with new random seed
            const newSeed = Date.now() + Math.floor(Math.random() * 10000);
            const configWithNewSeed = {
                ...autoZoneConfig,
                randomSeed: newSeed, // สร้าง seed ใหม่เพื่อได้รูปแบบที่แตกต่าง
            };

            const result = createAutomaticZones(
                history.present.plants,
                history.present.mainArea,
                configWithNewSeed
            );

            setAutoZoneResult(result);

            if (result.success && result.zones.length > 0) {
                // Validate zones
                const validation = validateZones(result.zones, history.present.mainArea);

                if (validation.errors.length > 0) {
                    console.warn('🚨 Zone validation warnings:', validation.errors);
                    if (typeof window !== 'undefined' && (window as any).showNotification) {
                        (window as any).showNotification(
                            `พบปัญหาในการแบ่งโซน: ${validation.errors.join(', ')}`,
                            'warning'
                        );
                    }
                }

                if (validation.warnings.length > 0) {
                    console.warn('⚠️ Zone validation warnings:', validation.warnings);
                }

                // Convert to IrrigationZone format and save
                const irrigationZones = result.zones.map((zone, index) => ({
                    ...zone,
                    layoutIndex: index,
                }));

                // 🔧 Assign zoneId to plants based on zone assignments (Regenerate)
                const updatedPlants = history.present.plants.map((plant) => {
                    const assignedZoneId = result.debugInfo?.plantAssignments?.[plant.id];
                    if (assignedZoneId) {
                        return {
                            ...plant,
                            zoneId: assignedZoneId,
                        };
                    }
                    return plant;
                });

                pushToHistory({
                    irrigationZones,
                    plants: updatedPlants,
                });

                // Show success notification
                const stats = result.debugInfo;
                const config = loadSprinklerConfig();
                const totalPlants = stats.totalPlants;
                const avgPlantsPerZone =
                    totalPlants > 0 ? Math.ceil(totalPlants / result.zones.length) : 0;

                let message = `เปลี่ยนรูปแบบโซนสำเร็จ: ${result.zones.length} โซน\n`;
                message += `ปริมาณน้ำเฉลี่ย: ${stats.averageWaterNeedPerZone.toFixed(2)} ลิตร/วัน`;
                if (config && avgPlantsPerZone > 0) {
                    const avgFlowRate = avgPlantsPerZone * config.flowRatePerMinute;
                    message += ` (${avgFlowRate.toFixed(2)} ลิตร/นาที)`;
                }
                message += `\nความแปรปรวน: ${stats.waterNeedVariance.toFixed(2)}`;

                if (typeof window !== 'undefined' && (window as any).showNotification) {
                    (window as any).showNotification(message, 'success');
                }

                // Show debug info if enabled
                if (autoZoneConfig.debugMode) {
                    setShowAutoZoneDebugModal(true);
                }
            } else {
                throw new Error(result.error || 'ไม่สามารถเปลี่ยนรูปแบบโซนได้');
            }
        } catch (error) {
            console.error('❌ Auto zone regeneration failed:', error);
            if (typeof window !== 'undefined' && (window as any).showNotification) {
                (window as any).showNotification(
                    `เกิดข้อผิดพลาดในการเปลี่ยนรูปแบบโซน: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    'error'
                );
            }
        } finally {
            setIsCreatingAutoZones(false);
            setShowAutoZoneModal(false);
        }
    };

    const handleDeleteExclusion = (exclusionId: string) => {
        if (!confirm(t('คุณต้องการลบพื้นที่หลีกเลี่ยงนี้หรือไม่?'))) {
            return;
        }

        const exclusionToDelete = history.present.exclusionAreas.find(
            (area) => area.id === exclusionId
        );

        if (!exclusionToDelete) {
            return;
        }

        const updatedExclusionAreas = history.present.exclusionAreas.filter(
            (area) => area.id !== exclusionId
        );

        const updatedExclusionZones = history.present.exclusionZones.filter(
            (zone) => zone.id !== exclusionId
        );

        let restoredPlants = [...history.present.plants];
        const storedData = localStorage.getItem('removedPlants') || '{}';
        const removedPlantsData = JSON.parse(storedData);

        if (removedPlantsData[exclusionId]) {
            restoredPlants = [...restoredPlants, ...removedPlantsData[exclusionId]];

            delete removedPlantsData[exclusionId];
            localStorage.setItem('removedPlants', JSON.stringify(removedPlantsData));
        } else {
            const newPlants = generatePlantsInArea(
                exclusionToDelete.coordinates,
                history.present.selectedPlantType,
                'grid',
                updatedExclusionAreas,
                0
            );

            restoredPlants = [...restoredPlants, ...newPlants];
        }

        pushToHistory({
            exclusionAreas: updatedExclusionAreas,
            exclusionZones: updatedExclusionZones,
            plants: restoredPlants,
        });

        const restoredCount = restoredPlants.length - history.present.plants.length;
        if (restoredCount > 0) {
            if (typeof window !== 'undefined' && (window as any).showSnapNotification) {
                (window as any).showSnapNotification(`คืนต้นไม้ ${restoredCount} ต้นกลับมาแล้ว`);
            }
        }
    };

    // ฟังก์ชันลบพื้นที่หลัก
    const handleDeleteMainArea = () => {
        pushToHistory({
            mainArea: [],
            plantAreas: [],
            zones: [],
            pump: null,
            mainPipes: [],
            subMainPipes: [],
            lateralPipes: [],
            plants: [],
            exclusionAreas: [],
            exclusionZones: [],
            irrigationZones: [],
            useZones: false,
            selectedPlantType: DEFAULT_PLANT_TYPES(t)[0],
            plantSelectionMode: {
                type: 'single',
                isCompleted: false,
            },
            plantGenerationSettings: {
                layoutPattern: 'grid',
                isGenerating: false,
                rotationAngle: 0,
            },
            selectedItems: {
                plants: [],
                pipes: [],
                zones: [],
            },
            clipboard: {
                plants: [],
                pipes: [],
            },
            layerVisibility: {
                plants: true,
                pipes: true,
                zones: true,
                exclusions: true,
                grid: false,
                measurements: false,
                plantAreas: true,
                dimensionLines: true,
                lateralPipes: true,
                emitterLines: true,
            },
            realTimeEditing: {
                activePipeId: null,
                activeAngle: 90,
                isAdjusting: false,
            },
            curvedPipeEditing: {
                isEnabled: false,
                editingPipes: new Set<string>(),
            },
            lateralPipeDrawing: {
                isActive: false,
                isContinuousMode: false, // 🚀 เพิ่มสำหรับการวาดต่อเนื่อง
                placementMode: null,
                startPoint: null,
                snappedStartPoint: null,
                currentPoint: null,
                rawCurrentPoint: null,
                selectedPlants: [],
                totalWaterNeed: 0,
                plantCount: 0,
                // 🚀 เพิ่มสำหรับ multi-segment drawing
                waypoints: [],
                currentSegmentDirection: null,
                allSegmentPlants: [],
                segmentPlants: [],
                isMultiSegmentMode: false,
            },
            firstLateralPipeWaterNeeds: {
                'main-area': 0,
            },
            firstLateralPipePlantCounts: {
                'main-area': 0,
            },
            lateralPipeComparison: {
                isComparing: false,
                currentZoneId: null,
                firstPipeWaterNeed: 0,
                currentPipeWaterNeed: 0,
                difference: 0,
                isMoreThanFirst: false,
            },
            pipeConnection: {
                isActive: false,
                selectedPoints: [],
                tempConnections: [],
            },
        });
        setShowDeleteMainAreaConfirm(false);
        setIsDeleteMode(false); // รีเซ็ตโหมดลบ
    };

    // ฟังก์ชันลบท่อ
    const handleDeletePipe = (
        pipeId: string,
        pipeType: 'mainPipe' | 'subMainPipe' | 'lateralPipe' | 'branchPipe'
    ) => {
        if (pipeType === 'mainPipe') {
            const updatedMainPipes = history.present.mainPipes.filter((pipe) => pipe.id !== pipeId);
            pushToHistory({ mainPipes: updatedMainPipes });
        } else if (pipeType === 'subMainPipe') {
            const updatedSubMainPipes = history.present.subMainPipes.filter(
                (pipe) => pipe.id !== pipeId
            );
            pushToHistory({ subMainPipes: updatedSubMainPipes });
        } else if (pipeType === 'lateralPipe') {
            const updatedLateralPipes = history.present.lateralPipes.filter(
                (pipe) => pipe.id !== pipeId
            );
            pushToHistory({ lateralPipes: updatedLateralPipes });
        } else if (pipeType === 'branchPipe') {
            // ลบ branch pipe ออกจาก subMainPipe ที่มี branch pipe นั้น
            const updatedSubMainPipes = history.present.subMainPipes.map((subMain) => {
                return {
                    ...subMain,
                    branchPipes: subMain.branchPipes.filter((bp) => bp.id !== pipeId),
                };
            });
            pushToHistory({ subMainPipes: updatedSubMainPipes });
        }

        // เพิ่มจำนวนท่อที่ลบแล้ว
        setDeletedPipeCount((prev) => prev + 1);

        // ไม่รีเซ็ต isDeleteMode ให้สามารถลบได้ต่อเนื่อง
        // setIsDeleteMode(false); // ลบบรรทัดนี้ออก
    };

    // ฟังก์ชันออกจากโหมดลบท่อ
    const handleCancelDeleteMode = () => {
        setIsDeleteMode(false);
        setDeletedPipeCount(0);
    };

    const handleSavePlantArea = (plantType: PlantData) => {
        if (currentPlantArea) {
            const updatedPlantAreas = history.present.plantAreas.map((area) =>
                area.id === currentPlantArea.id
                    ? {
                          ...area,
                          name: `พื้นที่ปลูก ${plantType.name}`,
                          plantData: plantType,
                          isCompleted: true,
                      }
                    : area
            );

            pushToHistory({
                plantAreas: updatedPlantAreas,
            });

            setCurrentPlantArea(null);
            setShowPlantAreaSelectionModal(false);
        }
    };

    const prevStateRef = useRef({
        mainArea: history.present.mainArea,
        zones: history.present.zones,
        exclusionAreas: history.present.exclusionAreas,
        pump: history.present.pump,
        mainPipes: history.present.mainPipes,
        subMainPipes: history.present.subMainPipes,
        plants: history.present.plants,
    });

    // 🔥 ปรับปรุง useEffect ให้มีประสิทธิภาพมากขึ้น
    // ใช้ useMemo เพื่อสร้าง state hash แทน useEffect
    const currentStateHash = useMemo(() => {
        const state = {
            mainArea: history.present.mainArea,
            zones: history.present.zones,
            exclusionAreas: history.present.exclusionAreas,
            pump: history.present.pump,
            mainPipes: history.present.mainPipes,
            subMainPipes: history.present.subMainPipes,
            plants: history.present.plants,
        };
        return JSON.stringify(state);
    }, [
        history.present.mainArea,
        history.present.zones,
        history.present.exclusionAreas,
        history.present.pump,
        history.present.mainPipes,
        history.present.subMainPipes,
        history.present.plants,
    ]);

    // ใช้ useEffect ที่เรียบง่ายกว่า
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            // ล้าง overlays อย่างปลอดภัย
            try {
                if (polygonsRef.current) {
                    polygonsRef.current.forEach((polygon) => {
                        if (polygon && polygon.setMap) polygon.setMap(null);
                    });
                    polygonsRef.current.clear();
                }
                if (markersRef.current) {
                    markersRef.current.forEach((marker) => {
                        if (marker && marker.setMap) marker.setMap(null);
                    });
                    markersRef.current.clear();
                }
                if (polylinesRef.current) {
                    polylinesRef.current.forEach((polyline) => {
                        if (polyline && polyline.setMap) polyline.setMap(null);
                    });
                    polylinesRef.current.clear();
                }
            } catch (error) {
                console.warn('Error clearing overlays:', error);
            }
        }, 200); // เพิ่ม debounce เป็น 200ms

        return () => clearTimeout(timeoutId);
    }, [currentStateHash]);

    if (error) {
        return (
            <div className="min-h-screen bg-gray-900 text-white">
                <Navbar />
                <div className="flex h-screen items-center justify-center">
                    <div className="mx-auto max-w-md rounded-lg bg-gray-800 p-8 text-center">
                        <div className="mb-4 text-6xl">⚠️</div>
                        <h2 className="mb-4 text-xl font-semibold text-red-400">
                            {t('เกิดข้อผิดพลาด')}
                        </h2>
                        <p className="mb-6 text-gray-300">{error}</p>
                        <div className="space-y-3">
                            <button
                                onClick={handleRetry}
                                disabled={isRetrying}
                                className="w-full rounded-lg bg-blue-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                            >
                                {isRetrying ? (
                                    <div className="flex items-center justify-center">
                                        <div className="mr-2 h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                                        {t('กำลังลองใหม่...')}
                                    </div>
                                ) : (
                                    t('ลองใหม่')
                                )}
                            </button>
                            <button
                                onClick={() => (window.location.href = '/')}
                                className="w-full rounded-lg bg-gray-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-gray-700"
                            >
                                {t('กลับไปหน้าหลัก')}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const handleToggleAddPlantMode = () => {
        const newMode = editMode === 'plant' ? null : 'plant';
        setEditMode(newMode);
    };

    const handleTogglePlantMoveMode = () => {
        setIsPlantMoveMode(!isPlantMoveMode);
        if (!isPlantMoveMode) {
            // รีเซ็ตโหมดการเลื่อนเป็น 'all' เมื่อเริ่มโหมดใหม่
            setPlantMoveMode('all');
            setSelectedPlantAreaForMove(null);
            if (typeof window !== 'undefined' && (window as any).showSnapNotification) {
                (window as any).showSnapNotification(
                    'เข้าสู่โหมดเลื่อนต้นไม้ - เลือกโหมดการเลื่อนที่ต้องการ'
                );
            }
        }
        if (isPlantMoveMode) {
            setSelectedPlantsForMove(new Set());
            setIsPlantSelectionMode(false);
            setPlantMoveMode('all');
            setSelectedPlantAreaForMove(null);
        }
    };

    const handleTogglePlantSelectionMode = () => {
        setIsPlantSelectionMode(!isPlantSelectionMode);
        if (!isPlantSelectionMode) {
            if (typeof window !== 'undefined' && (window as any).showSnapNotification) {
                (window as any).showSnapNotification(
                    'เข้าสู่โหมดเลือกต้นไม้ - คลิกต้นไม้เพื่อเลือก แล้วใช้ปุ่มลูกศรเลื่อน'
                );
            }
        } else {
            setSelectedPlantsForMove(new Set());
        }
    };

    const handleSelectAllPlants = () => {
        const allPlantIds = new Set(history.present.plants.map((plant) => plant.id));
        setSelectedPlantsForMove(allPlantIds);
        if (typeof window !== 'undefined' && (window as any).showSnapNotification) {
            (window as any).showSnapNotification(`เลือกต้นไม้ทั้งหมด ${allPlantIds.size} ต้น`);
        }
    };

    const handleDeselectAllPlants = () => {
        setSelectedPlantsForMove(new Set());
        if (typeof window !== 'undefined' && (window as any).showSnapNotification) {
            (window as any).showSnapNotification('ยกเลิกการเลือกต้นไม้ทั้งหมด');
        }
    };

    const handlePlantMoveModeChange = (mode: 'all' | 'selected' | 'area') => {
        setPlantMoveMode(mode);
        if (mode === 'selected') {
            setIsPlantSelectionMode(true);
            setSelectedPlantAreaForMove(null);
            if (typeof window !== 'undefined' && (window as any).showSnapNotification) {
                (window as any).showSnapNotification(
                    'โหมดเลื่อนต้นไม้ที่เลือก - คลิกต้นไม้เพื่อเลือก'
                );
            }
        } else if (mode === 'area') {
            setIsPlantSelectionMode(false);
            setSelectedPlantsForMove(new Set());
            if (typeof window !== 'undefined' && (window as any).showSnapNotification) {
                (window as any).showSnapNotification(
                    'โหมดเลื่อนต้นไม้ในพื้นที่ - เลือกพื้นที่ปลูกที่ต้องการ'
                );
            }
        } else {
            setIsPlantSelectionMode(false);
            setSelectedPlantsForMove(new Set());
            setSelectedPlantAreaForMove(null);
            if (typeof window !== 'undefined' && (window as any).showSnapNotification) {
                (window as any).showSnapNotification(
                    'โหมดเลื่อนต้นไม้ทั้งหมด - ใช้ปุ่มลูกศรเลื่อนต้นไม้ทั้งหมด'
                );
            }
        }
    };

    const handlePlantAreaSelectForMove = (areaId: string) => {
        setSelectedPlantAreaForMove(areaId);
        const selectedArea = history.present.plantAreas.find((area) => area.id === areaId);
        if (selectedArea && typeof window !== 'undefined' && (window as any).showSnapNotification) {
            (window as any).showSnapNotification(
                `เลือกพื้นที่ปลูก: ${selectedArea.name} - ใช้ปุ่มลูกศรเลื่อนต้นไม้ในพื้นที่นี้`
            );
        }
    };

    const handleTogglePlantSelection = (plantId: string) => {
        setSelectedPlantsForMove((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(plantId)) {
                newSet.delete(plantId);
            } else {
                newSet.add(plantId);
            }
            return newSet;
        });
    };

    // ฟังก์ชันหาต้นไม้ที่ใกล้จุดคลิกที่สุด
    const findClosestPlantToPoint = (
        clickPoint: Coordinate,
        plants: PlantLocation[],
        threshold: number = 10
    ): PlantLocation | null => {
        if (!plants.length) return null;

        let closestPlant: PlantLocation | null = null;
        let minDistance = threshold;

        for (const plant of plants) {
            const distance = calculateDistanceBetweenPoints(clickPoint, plant.position);
            if (distance < minDistance) {
                minDistance = distance;
                closestPlant = plant;
            }
        }

        return closestPlant;
    };

    // 🚀 ฟังก์ชันหาท่อเมนรองที่ใกล้จุดคลิกที่สุดในโซนเดียวกัน
    const findClosestSubMainPipeInSameZone = (
        clickPoint: Coordinate,
        subMainPipes: any[],
        zones: any[],
        irrigationZones: any[],
        threshold: number = 10
    ): { pipe: any; distance: number } | null => {
        if (!subMainPipes.length) return null;

        // หาโซนที่จุดคลิกอยู่
        const clickedZone = findZoneAtClickPoint(clickPoint, zones, irrigationZones);

        let closestPipe: any = null;
        let minDistance = threshold;

        for (const subMainPipe of subMainPipes) {
            // ตรวจสอบว่าท่อเมนรองอยู่ในโซนเดียวกันกับจุดคลิกหรือไม่
            const pipeZone = findPipeZone(subMainPipe, zones, irrigationZones);

            // 🔧 ปรับปรุงการตรวจสอบ zone: อนุญาตให้เชื่อมต่อได้ถ้าไม่มี zone หรืออยู่ใน main-area
            const isZoneCompatible =
                !clickedZone ||
                !pipeZone || // ไม่มี zone หรือ pipe zone
                clickedZone.id === pipeZone.id || // อยู่ใน zone เดียวกัน
                clickedZone.id === 'main-area' ||
                pipeZone.id === 'main-area'; // อยู่ใน main-area

            // 🔧 เพิ่ม debug logging
            console.log('🔍 SubMain Pipe Check:', {
                pipeId: subMainPipe.id,
                clickedZone: clickedZone?.id,
                pipeZone: pipeZone?.id,
                isZoneCompatible,
                pipeCoordinates: subMainPipe.coordinates?.length,
            });

            if (!isZoneCompatible) {
                console.log('❌ Zone incompatible, skipping pipe:', subMainPipe.id);
                continue;
            }

            // 🔧 เพิ่ม threshold สำหรับการ snap ไปยัง submain pipe หลังหมุนต้นไม้
            const adjustedThreshold = threshold * 1.5; // เพิ่มเป็น 1.5 เท่า

            // ตรวจสอบระยะทางไปท่อเมนรอง
            const isOnPipe = isPointOnSubMainPipe(clickPoint, subMainPipe, adjustedThreshold);
            console.log('🔍 Pipe Distance Check:', {
                pipeId: subMainPipe.id,
                isOnPipe,
                adjustedThreshold,
            });

            if (isOnPipe) {
                const connectionPoint = findClosestConnectionPoint(clickPoint, subMainPipe);
                if (connectionPoint) {
                    const distance = calculateDistanceBetweenPoints(clickPoint, connectionPoint);
                    console.log('🔍 Connection Point Found:', {
                        pipeId: subMainPipe.id,
                        distance,
                        minDistance,
                    });
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestPipe = subMainPipe;
                    }
                }
            }
        }

        return closestPipe ? { pipe: closestPipe, distance: minDistance } : null;
    };

    // 🚀 ฟังก์ชันหาโซนที่จุดคลิกอยู่ - ปรับปรุงให้รองรับการหมุนต้นไม้
    const findZoneAtClickPoint = (
        clickPoint: Coordinate,
        zones: any[],
        irrigationZones: any[]
    ): { id: string; name: string } | null => {
        // ตรวจสอบใน zones ก่อน
        if (zones && zones.length > 0) {
            for (const zone of zones) {
                if (zone.coordinates && isPointInPolygon(clickPoint, zone.coordinates)) {
                    return { id: zone.id, name: zone.name };
                }
            }
        }

        // ตรวจสอบใน irrigationZones
        if (irrigationZones && irrigationZones.length > 0) {
            for (const zone of irrigationZones) {
                if (zone.coordinates && isPointInPolygon(clickPoint, zone.coordinates)) {
                    return { id: zone.id, name: zone.name };
                }
            }
        }

        // 🔧 หากไม่พบ zone ให้ตรวจสอบว่าอยู่ใกล้ต้นไม้ใน zone ใด
        // เพื่อรองรับกรณีที่ต้นไม้หมุนแล้วอยู่นอก zone boundaries เดิม
        if (history.present.plants.length > 0) {
            let closestPlant: PlantLocation | null = null;
            let minDistance = Infinity;

            for (const plant of history.present.plants) {
                const distance = calculateDistanceBetweenPoints(clickPoint, plant.position);
                if (distance < minDistance) {
                    minDistance = distance;
                    closestPlant = plant;
                }
            }

            // ถ้าอยู่ใกล้ต้นไม้มาก (ภายใน 10 เมตร) ให้ใช้ zone ของต้นไม้นั้น
            if (closestPlant && minDistance <= 10) {
                // หา zone ที่ต้นไม้ต้นนี้อยู่
                for (const zone of irrigationZones || []) {
                    if (
                        zone.coordinates &&
                        isPointInPolygon(closestPlant.position, zone.coordinates)
                    ) {
                        return { id: zone.id, name: zone.name };
                    }
                }
                for (const zone of zones || []) {
                    if (
                        zone.coordinates &&
                        isPointInPolygon(closestPlant.position, zone.coordinates)
                    ) {
                        return { id: zone.id, name: zone.name };
                    }
                }
            }
        }

        return null;
    };

    // 🚀 ฟังก์ชันหาโซนของท่อ
    const findPipeZone = (
        pipe: any,
        zones: any[],
        irrigationZones: any[]
    ): { id: string; name: string } | null => {
        if (!pipe.coordinates || pipe.coordinates.length === 0) return null;

        // ใช้จุดกึ่งกลางของท่อเป็นตัวแทน
        const midIndex = Math.floor(pipe.coordinates.length / 2);
        const midPoint = pipe.coordinates[midIndex];

        return findZoneAtClickPoint(midPoint, zones, irrigationZones);
    };

    // ฟังก์ชันเริ่มวาดท่อย่อยจากต้นไม้
    const handleStartLateralPipeFromPlant = (
        clickPoint: Coordinate,
        clickedPlant: PlantLocation
    ) => {
        const placementMode = history.present.lateralPipeDrawing.placementMode;
        if (!placementMode) return;

        let startPoint: Coordinate;
        let snappedStartPoint: Coordinate;

        if (placementMode === 'over_plants') {
            // โหมดวางทับต้นไม้ - ใช้ตำแหน่งต้นไม้เป็นจุดเริ่ม
            startPoint = clickedPlant.position;
            snappedStartPoint = clickedPlant.position;
        } else if (placementMode === 'between_plants') {
            // โหมดวางระหว่างต้นไม้ - ต้องพิจารณาทั้งแนวแถว (x) และแนวคอลัมน์ (y)
            const nearbyPlants = history.present.plants.filter(
                (plant) =>
                    plant.id !== clickedPlant.id &&
                    calculateDistanceBetweenPoints(clickPoint, plant.position) < 25
            );

            if (nearbyPlants.length > 0) {
                // หาต้นไม้ที่อยู่ในแนวเดียวกัน (แถวหรือคอลัมน์)
                const sameRowPlants = nearbyPlants.filter(
                    (plant) => Math.abs(plant.position.lat - clickedPlant.position.lat) < 0.00002 // แนวแถว (lat คล้ายกัน)
                );
                const sameColumnPlants = nearbyPlants.filter(
                    (plant) => Math.abs(plant.position.lng - clickedPlant.position.lng) < 0.00002 // แนวคอลัมน์ (lng คล้ายกัน)
                );

                let bestCandidate: {
                    plant: PlantLocation;
                    midPoint: Coordinate;
                    distance: number;
                } | null = null;

                // หาจุดกึ่งกลางที่ใกล้จุดคลิกที่สุด จากต้นไม้ในแนวแถว
                if (sameRowPlants.length > 0) {
                    for (const plant of sameRowPlants) {
                        const midPoint = {
                            lat: (clickedPlant.position.lat + plant.position.lat) / 2,
                            lng: (clickedPlant.position.lng + plant.position.lng) / 2,
                        };
                        const distanceFromClick = calculateDistanceBetweenPoints(
                            clickPoint,
                            midPoint
                        );

                        if (!bestCandidate || distanceFromClick < bestCandidate.distance) {
                            bestCandidate = { plant, midPoint, distance: distanceFromClick };
                        }
                    }
                }

                // หาจุดกึ่งกลางที่ใกล้จุดคลิกที่สุด จากต้นไม้ในแนวคอลัมน์
                if (sameColumnPlants.length > 0) {
                    for (const plant of sameColumnPlants) {
                        const midPoint = {
                            lat: (clickedPlant.position.lat + plant.position.lat) / 2,
                            lng: (clickedPlant.position.lng + plant.position.lng) / 2,
                        };
                        const distanceFromClick = calculateDistanceBetweenPoints(
                            clickPoint,
                            midPoint
                        );

                        if (!bestCandidate || distanceFromClick < bestCandidate.distance) {
                            bestCandidate = { plant, midPoint, distance: distanceFromClick };
                        }
                    }
                }

                // ถ้าไม่มีต้นไม้ในแนวเดียวกัน ให้หาต้นไม้ใกล้ที่สุดแล้วคำนวณจุดกึ่งกลาง
                if (!bestCandidate && nearbyPlants.length > 0) {
                    const closestPlant = nearbyPlants.reduce((closest, plant) => {
                        const distanceCurrent = calculateDistanceBetweenPoints(
                            clickedPlant.position,
                            plant.position
                        );
                        const distanceClosest = calculateDistanceBetweenPoints(
                            clickedPlant.position,
                            closest.position
                        );
                        return distanceCurrent < distanceClosest ? plant : closest;
                    });

                    const midPoint = {
                        lat: (clickedPlant.position.lat + closestPlant.position.lat) / 2,
                        lng: (clickedPlant.position.lng + closestPlant.position.lng) / 2,
                    };

                    bestCandidate = {
                        plant: closestPlant,
                        midPoint,
                        distance: calculateDistanceBetweenPoints(clickPoint, midPoint),
                    };
                }

                if (bestCandidate) {
                    startPoint = bestCandidate.midPoint;
                    snappedStartPoint = bestCandidate.midPoint;
                } else {
                    startPoint = clickPoint;
                    snappedStartPoint = clickPoint;
                }
            } else {
                // ถ้าไม่มีต้นไม้ใกล้ๆ ให้ใช้ตำแหน่งคลิก
                startPoint = clickPoint;
                snappedStartPoint = clickPoint;
            }
        } else {
            return;
        }

        // อัพเดต state
        dispatchHistory({
            type: 'PUSH_STATE',
            state: {
                ...history.present,
                lateralPipeDrawing: {
                    ...history.present.lateralPipeDrawing,
                    startPoint: startPoint,
                    snappedStartPoint: snappedStartPoint,
                    currentPoint: snappedStartPoint,
                    rawCurrentPoint: snappedStartPoint,
                    selectedPlants: [],
                    totalWaterNeed: 0,
                    plantCount: 0,
                },
            },
        });
    };

    // ฟังก์ชันเริ่มต้นระบบลากท่อย่อยอัตโนมัติ
    const handleStartAutoLateralPipeDrawing = () => {
        if (history.present.subMainPipes.length === 0) {
            alert(t('กรุณาวางท่อเมนรองก่อนใช้ระบบลากอัตโนมัติ'));
            return;
        }

        if (history.present.irrigationZones.length === 0) {
            alert(t('กรุณาสร้างโซนก่อนใช้ระบบลากอัตโนมัติ'));
            return;
        }

        setShowAutoLateralPipeModal(true);
    };

    // ฟังก์ชันจัดการเลือกโหมดลากอัตโนมัติ
    const handleAutoLateralPipeModeSelect = (
        mode: 'through_submain' | 'from_submain',
        selectedZoneId?: string
    ) => {
        setShowAutoLateralPipeModal(false);

        // เตรียมข้อมูลสำหรับ algorithm
        const subMainPipes = history.present.subMainPipes.map((pipe) => ({
            id: pipe.id,
            coordinates: pipe.coordinates,
            zoneId: pipe.zoneId,
        }));

        // กรองโซนตามที่เลือก
        let zones = history.present.irrigationZones.map((zone) => ({
            id: zone.id,
            name: zone.name,
            coordinates: zone.coordinates,
            plants: zone.plants,
        }));

        // ถ้าเลือกโซนเฉพาะ ให้กรองเฉพาะโซนนั้น
        if (selectedZoneId) {
            zones = zones.filter((zone) => zone.id === selectedZoneId);
            console.log(`🎯 Filtering to selected zone: ${selectedZoneId}`);
        }

        console.log('🎯 Auto Lateral Pipe Data:');
        console.log('📋 Mode:', mode);
        console.log('🔧 SubMain pipes:', subMainPipes);
        console.log('🌍 Zones:', zones);
        console.log(
            '🌱 Total plants across all zones:',
            zones.reduce((sum, zone) => sum + zone.plants.length, 0)
        );

        // ตรวจสอบข้อมูลพื้นฐาน
        if (subMainPipes.length === 0) {
            alert(t('ไม่พบท่อ Sub Main ในระบบ'));
            return;
        }

        if (zones.length === 0) {
            alert(t('ไม่พบโซนในระบบ'));
            return;
        }

        const totalPlants = zones.reduce((sum, zone) => sum + zone.plants.length, 0);
        if (totalPlants === 0) {
            alert(t('ไม่พบต้นไม้ในโซน กรุณาสร้างต้นไม้ก่อน'));
            return;
        }

        console.log('✅ Basic validation passed');

        try {
            // สร้างท่อย่อยอัตโนมัติ
            const autoLateralPipes = generateAutoLateralPipes(mode, subMainPipes, zones, {
                snapThreshold: 50, // เพิ่มจาก 20 เป็น 50 เมตร
                minPipeLength: 1, // ลดจาก 5 เป็น 1 เมตร
                maxPipeLength: 500, // เพิ่มจาก 200 เป็น 500 เมตร
            });

            // ตรวจสอบความถูกต้อง
            const { valid, invalid } = validateAutoLateralPipes(autoLateralPipes, zones);

            if (invalid.length > 0) {
                console.warn('Invalid lateral pipes:', invalid);
            }

            if (valid.length === 0) {
                alert(
                    t('ไม่สามารถสร้างท่อย่อยอัตโนมัติได้ กรุณาตรวจสอบการจัดเรียงต้นไม้และท่อเมนรอง')
                );
                return;
            }

            // แปลงเป็นรูปแบบที่ระบบใช้
            const newLateralPipes = valid.map((pipe) => {
                // สร้าง segmentStats สำหรับ intersectionData
                const segmentStats = pipe.intersectionData
                    ? {
                          segment1: {
                              length: pipe.length / 2,
                              plants: pipe.plants.slice(0, Math.floor(pipe.plants.length / 2)),
                              waterNeed: pipe.plants
                                  .slice(0, Math.floor(pipe.plants.length / 2))
                                  .reduce((sum, plant) => sum + plant.plantData.waterNeed, 0),
                          },
                          segment2: {
                              length: pipe.length / 2,
                              plants: pipe.plants.slice(Math.floor(pipe.plants.length / 2)),
                              waterNeed: pipe.plants
                                  .slice(Math.floor(pipe.plants.length / 2))
                                  .reduce((sum, plant) => sum + plant.plantData.waterNeed, 0),
                          },
                          total: {
                              length: pipe.length,
                              plants: pipe.plants,
                              waterNeed: pipe.totalFlowRate,
                          },
                      }
                    : undefined;

                return {
                    id: pipe.id,
                    subMainPipeId: pipe.intersectionData?.subMainPipeId || '',
                    coordinates: pipe.coordinates,
                    length: pipe.length,
                    diameter: 16, // ค่าเริ่มต้น
                    plants: pipe.plants,
                    placementMode: pipe.placementMode,
                    emitterLines: [], // จะสร้างทีหลัง
                    totalWaterNeed: pipe.totalFlowRate,
                    plantCount: pipe.plants.length,
                    connectionPoint: pipe.connectionPoint,
                    zoneId: pipe.zoneId,
                    intersectionData: pipe.intersectionData
                        ? {
                              point: pipe.intersectionData.point,
                              subMainPipeId: pipe.intersectionData.subMainPipeId,
                              segmentIndex: pipe.intersectionData.segmentIndex,
                              segmentStats: segmentStats!,
                          }
                        : undefined,
                } as LateralPipe;
            });

            // เพิ่มท่อย่อยใหม่เข้าไปในระบบ
            dispatchHistory({
                type: 'PUSH_STATE',
                state: {
                    ...history.present,
                    lateralPipes: [...history.present.lateralPipes, ...newLateralPipes],
                },
            });

            alert(t(`สร้างท่อย่อยอัตโนมัติสำเร็จ ${valid.length} เส้น`));
        } catch (error) {
            console.error('Error generating auto lateral pipes:', error);
            alert(t('เกิดข้อผิดพลาดในการสร้างท่อย่อยอัตโนมัติ'));
        }
    };

    // ฟังก์ชันยกเลิกโหมดลากอัตโนมัติ
    const handleCancelAutoLateralPipe = () => {
        setShowAutoLateralPipeModal(false);
    };

    const handleStartLateralPipeDrawing = () => {
        if (history.present.subMainPipes.length === 0 && history.present.plants.length === 0) {
            alert(t('กรุณาวางท่อเมนรองหรือต้นไม้ก่อนวางท่อย่อย'));
            return;
        }

        dispatchHistory({
            type: 'PUSH_STATE',
            state: {
                ...history.present,
                isEditModeEnabled: true,
                lateralPipeDrawing: {
                    ...history.present.lateralPipeDrawing,
                    isActive: true,
                    placementMode: null,
                    // 🚀 Reset multi-segment fields เมื่อเริ่มโหมดวาดท่อย่อย
                    waypoints: [],
                    currentSegmentDirection: null,
                    allSegmentPlants: [],
                    segmentPlants: [],
                    isMultiSegmentMode: false,
                    // Reset drawing state
                    startPoint: null,
                    snappedStartPoint: null,
                    currentPoint: null,
                    rawCurrentPoint: null,
                    selectedPlants: [],
                    totalWaterNeed: 0,
                    plantCount: 0,
                },
            },
        });
    };

    const handleLateralPipeModeSelect = (mode: 'over_plants' | 'between_plants') => {
        dispatchHistory({
            type: 'PUSH_STATE',
            state: {
                ...history.present,
                editMode: 'lateralPipe', // 🚀 ตั้งค่า editMode เป็น 'lateralPipe' เพื่อให้การวาดท่อย่อยทำงาน
                isEditModeEnabled: true,
                lateralPipeDrawing: {
                    ...history.present.lateralPipeDrawing,
                    placementMode: mode,
                    isActive: true,
                    isContinuousMode: true, // 🚀 เปิด continuous mode เมื่อเลือกโหมดการวาง
                    // 🚀 Reset multi-segment fields เมื่อเลือกโหมดใหม่
                    waypoints: [],
                    currentSegmentDirection: null,
                    allSegmentPlants: [],
                    segmentPlants: [],
                    isMultiSegmentMode: false,
                    // Reset drawing position state but keep mode settings
                    startPoint: null,
                    snappedStartPoint: null,
                    currentPoint: null,
                    rawCurrentPoint: null,
                    selectedPlants: [],
                    totalWaterNeed: 0,
                    plantCount: 0,
                },
            },
        });
    };

    // 🚀 Function to change placement mode during continuous drawing
    const handleChangePlacementMode = (mode: 'over_plants' | 'between_plants') => {
        dispatchHistory({
            type: 'PUSH_STATE',
            state: {
                ...history.present,
                lateralPipeDrawing: {
                    ...history.present.lateralPipeDrawing,
                    placementMode: mode,
                    // Reset drawing points when changing mode to avoid confusion
                    startPoint: null,
                    snappedStartPoint: null,
                    currentPoint: null,
                    rawCurrentPoint: null,
                    selectedPlants: [],
                    totalWaterNeed: 0,
                    plantCount: 0,
                },
            },
        });
    };

    const handleLateralPipeDrawingComplete = (coordinates: Coordinate[], shapeType: string) => {
        if (shapeType === 'polyline' && coordinates.length >= 2) {
            const startPoint = coordinates[0];
            const endPoint = coordinates[coordinates.length - 1];
            handleFinishLateralPipeDrawing(endPoint);
        }
    };

    const handleCancelLateralPipeDrawing = () => {
        dispatchHistory({
            type: 'PUSH_STATE',
            state: {
                ...history.present,
                editMode: null, // 🚀 รีเซ็ต editMode เมื่อยกเลิกการวาดท่อย่อย
                isEditModeEnabled: false,
                lateralPipeDrawing: {
                    ...history.present.lateralPipeDrawing,
                    isActive: false,
                    isContinuousMode: false, // 🚀 ปิด continuous mode เมื่อยกเลิก
                    placementMode: null,
                    startPoint: null,
                    snappedStartPoint: null,
                    currentPoint: null,
                    rawCurrentPoint: null,
                    selectedPlants: [],
                    totalWaterNeed: 0,
                    plantCount: 0,
                    // 🚀 Reset multi-segment fields เมื่อยกเลิกการวาด
                    waypoints: [],
                    currentSegmentDirection: null,
                    allSegmentPlants: [],
                    segmentPlants: [],
                    isMultiSegmentMode: false,
                },
            },
        });

        // 🌱 Reset highlighted plants เมื่อยกเลิกการวาดท่อย่อย
        setHighlightedPlants(new Set());
    };

    const handleLateralPipeMouseMove = (event: google.maps.MapMouseEvent) => {
        if (
            !history.present.lateralPipeDrawing.isActive ||
            !history.present.lateralPipeDrawing.placementMode ||
            !event.latLng
        ) {
            return;
        }

        if (!history.present.lateralPipeDrawing.startPoint) {
            return;
        }

        // 🚀 Light throttling to maintain responsiveness (8ms = ~120fps)
        const now = Date.now();
        if (now - lastMouseMoveTime.current < 8) {
            return;
        }
        lastMouseMoveTime.current = now;

        const latLng = event.latLng;
        const rawCurrentPoint = {
            lat: latLng.lat(),
            lng: latLng.lng(),
        };

        const effectiveCurrentPoint = rawCurrentPoint;

        // 🚀 Lighter cache checking for better responsiveness
        const cache = mouseMoveCacheRef.current;
        const pointDistance = cache.lastRawPoint
            ? Math.sqrt(
                  Math.pow(rawCurrentPoint.lat - cache.lastRawPoint.lat, 2) +
                      Math.pow(rawCurrentPoint.lng - cache.lastRawPoint.lng, 2)
              )
            : Infinity;

        // Use cached result only for very small movements (~0.2 meters)
        if (pointDistance < 0.000002 && cache.lastResult) {
            const cachedResult = cache.lastResult;
            updateLateralPipeState(
                rawCurrentPoint,
                cachedResult.alignedEnd,
                cachedResult.selectedPlants
            );
            return;
        }

        let selectedPlants: PlantLocation[] = [];
        let alignedCurrentPoint = effectiveCurrentPoint;

        if (
            history.present.lateralPipeDrawing.placementMode &&
            history.present.lateralPipeDrawing.snappedStartPoint &&
            history.present.plants.length > 0
        ) {
            try {
                // 🚀 รองรับ multi-segment drawing
                if (
                    history.present.lateralPipeDrawing.isMultiSegmentMode &&
                    history.present.lateralPipeDrawing.waypoints.length > 0
                ) {
                    // Multi-segment mode: คำนวณจากจุดสุดท้ายใน waypoints
                    const lastWaypoint =
                        history.present.lateralPipeDrawing.waypoints[
                            history.present.lateralPipeDrawing.waypoints.length - 1
                        ];
                    const currentDirection =
                        history.present.lateralPipeDrawing.currentSegmentDirection;

                    // 🚀 Align ตำแหน่งเมาส์ตามทิศทางที่กำหนด
                    let alignedMousePosition = effectiveCurrentPoint;
                    if (currentDirection === 'horizontal') {
                        // บังคับให้เป็นแนวนอน (lat เท่ากับ waypoint)
                        alignedMousePosition = {
                            lat: lastWaypoint.lat,
                            lng: effectiveCurrentPoint.lng,
                        };
                        // console.log(`🔄 Horizontal alignment: Fixed lat=${lastWaypoint.lat.toFixed(6)}, mouse lng=${effectiveCurrentPoint.lng.toFixed(6)}`);
                    } else if (currentDirection === 'vertical') {
                        // บังคับให้เป็นแนวตั้ง (lng เท่ากับ waypoint)
                        alignedMousePosition = {
                            lat: effectiveCurrentPoint.lat,
                            lng: lastWaypoint.lng,
                        };
                        // console.log(`🔄 Vertical alignment: Mouse lat=${effectiveCurrentPoint.lat.toFixed(6)}, fixed lng=${lastWaypoint.lng.toFixed(6)}`);
                    }
                    // สำหรับ diagonal ใช้ตำแหน่งเมาส์โดยตรง

                    // 🚀 ใช้ alignment logic ที่ถูกต้องสำหรับ multi-segment
                    const currentSegmentAligned = computeAlignedLateralFromMainPipe(
                        lastWaypoint,
                        alignedMousePosition,
                        history.present.plants, // 🔧 ใช้ข้อมูลต้นไม้จากระบบโดยตรง
                        history.present.lateralPipeDrawing.placementMode,
                        20 // ลด snapThreshold เพื่อให้แม่นยำขึ้น
                    );

                    const currentSegmentPlants = currentSegmentAligned.selectedPlants || [];

                    // 🚫 รวมต้นไม้โดยป้องกันการซ้ำ (แก้ไขปัญหาการนับซ้ำ)
                    const existingPlantIds = new Set(
                        history.present.lateralPipeDrawing.allSegmentPlants.map((plant) => plant.id)
                    );
                    const newPlantsOnly = currentSegmentPlants.filter(
                        (plant) => !existingPlantIds.has(plant.id)
                    );

                    selectedPlants = [
                        ...history.present.lateralPipeDrawing.allSegmentPlants,
                        ...newPlantsOnly,
                    ];
                    alignedCurrentPoint = currentSegmentAligned.alignedEnd || alignedMousePosition;
                } else {
                    // Single-segment mode (เดิม)
                    const aligned = computeAlignedLateralFromMainPipe(
                        history.present.lateralPipeDrawing.snappedStartPoint,
                        effectiveCurrentPoint,
                        history.present.plants, // 🔧 ใช้ข้อมูลต้นไม้จากระบบโดยตรง
                        history.present.lateralPipeDrawing.placementMode,
                        20 // ลด snapThreshold เพื่อให้แม่นยำขึ้น
                    );

                    selectedPlants = aligned.selectedPlants || [];
                    alignedCurrentPoint = aligned.alignedEnd || effectiveCurrentPoint;
                }
            } catch (error) {
                console.error('❌ Error in lateral pipe calculation:', error);
                selectedPlants = [];
                alignedCurrentPoint = effectiveCurrentPoint;
            }
        }

        // 🚀 Update cache
        cache.lastRawPoint = rawCurrentPoint;
        cache.lastResult = {
            alignedEnd: alignedCurrentPoint,
            selectedPlants,
            snappedStart:
                history.present.lateralPipeDrawing.snappedStartPoint ||
                history.present.lateralPipeDrawing.startPoint!,
        };

        updateLateralPipeState(rawCurrentPoint, alignedCurrentPoint, selectedPlants);
    };

    // 🚀 Extract state update logic to separate function for reuse
    const updateLateralPipeState = (
        rawCurrentPoint: Coordinate,
        alignedCurrentPoint: Coordinate,
        selectedPlants: PlantLocation[]
    ) => {
        const totalWaterNeed = calculateTotalWaterNeed(selectedPlants);
        const plantCount = selectedPlants.length;

        // 🌱 อัปเดต highlighted plants สำหรับแสดงการถูกนับ
        const newHighlightedPlants = new Set(selectedPlants.map((plant) => plant.id));
        setHighlightedPlants(newHighlightedPlants);

        let updatedLateralPipeComparison = { ...history.present.lateralPipeComparison };

        // 🚀 สร้าง coordinates สำหรับ preview รองรับ multi-segment
        let previewCoordinates: Coordinate[];
        if (
            history.present.lateralPipeDrawing.isMultiSegmentMode &&
            history.present.lateralPipeDrawing.waypoints.length > 0
        ) {
            // สำหรับ multi-segment: แสดงเฉพาะส่วนปัจจุบันจาก waypoint ล่าสุดไปยังเมาส์
            const lastWaypoint =
                history.present.lateralPipeDrawing.waypoints[
                    history.present.lateralPipeDrawing.waypoints.length - 1
                ];
            previewCoordinates = [lastWaypoint, alignedCurrentPoint];
        } else {
            previewCoordinates = [
                history.present.lateralPipeDrawing.snappedStartPoint ||
                    history.present.lateralPipeDrawing.startPoint!,
                alignedCurrentPoint,
            ];
        }

        const tempLateralPipe: LateralPipe = {
            id: 'temp',
            subMainPipeId: '',
            coordinates: previewCoordinates,
            length: 0,
            diameter: 16,
            plants: selectedPlants,
            placementMode: history.present.lateralPipeDrawing.placementMode!,
            emitterLines: [],
            totalWaterNeed,
            plantCount,
        };

        const currentZoneId = getCurrentZoneIdForLateralPipe(
            tempLateralPipe,
            history.present,
            manualZones
        );
        const existingLateralPipesInZone = getExistingLateralPipesInZone(
            currentZoneId,
            history.present,
            manualZones
        );
        const isFirstLateralPipeInZone = existingLateralPipesInZone.length === 0;

        if (
            !isFirstLateralPipeInZone &&
            history.present.firstLateralPipeWaterNeeds[currentZoneId] > 0
        ) {
            const firstPipeWaterNeed = history.present.firstLateralPipeWaterNeeds[currentZoneId];
            const difference =
                firstPipeWaterNeed > 0
                    ? ((totalWaterNeed - firstPipeWaterNeed) / firstPipeWaterNeed) * 100
                    : 0;

            updatedLateralPipeComparison = {
                isComparing: true,
                currentZoneId,
                firstPipeWaterNeed,
                currentPipeWaterNeed: totalWaterNeed,
                difference,
                isMoreThanFirst: totalWaterNeed > firstPipeWaterNeed,
            };
        } else {
            updatedLateralPipeComparison = {
                isComparing: false,
                currentZoneId: null,
                firstPipeWaterNeed: 0,
                currentPipeWaterNeed: 0,
                difference: 0,
                isMoreThanFirst: false,
            };
        }

        dispatchHistory({
            type: 'PUSH_STATE',
            state: {
                ...history.present,
                lateralPipeDrawing: {
                    ...history.present.lateralPipeDrawing,
                    currentPoint: alignedCurrentPoint,
                    rawCurrentPoint: rawCurrentPoint,
                    selectedPlants,
                    totalWaterNeed,
                    plantCount,
                },
                lateralPipeComparison: updatedLateralPipeComparison,
            },
        });
    };

    const handleLateralPipeClick = (event: google.maps.MapMouseEvent, lateralPipeId?: string) => {
        // 🚀 ตรวจสอบว่าเป็น right-click หรือไม่
        const customEvent = event as any;
        if (customEvent.isRightClick && customEvent.waypointPosition) {
            handleAddLateralPipeWaypoint(customEvent.waypointPosition);
            return;
        }

        // If not in drawing mode and we have a lateralPipeId, show info for completed pipe
        if (!history.present.lateralPipeDrawing.isActive && lateralPipeId) {
            handleCompletedLateralPipeClick(lateralPipeId);
            return;
        }

        // Original drawing mode logic
        if (
            !history.present.lateralPipeDrawing.isActive ||
            !history.present.lateralPipeDrawing.placementMode ||
            !event.latLng
        ) {
            return;
        }

        const clickPoint = {
            lat: event.latLng.lat(),
            lng: event.latLng.lng(),
        };

        // 🚀 ใช้ฟังก์ชันใหม่ที่ตรวจสอบ zone ด้วย
        const clickedSubMainPipeData = findClosestSubMainPipeInSameZone(
            clickPoint,
            history.present.subMainPipes,
            history.present.zones,
            history.present.irrigationZones,
            history.present.lateralPipeSettings.snapThreshold
        );

        // 🔧 เพิ่ม debug logging เพื่อตรวจสอบปัญหา
        console.log('🔍 Lateral Pipe Click Debug:', {
            clickPoint,
            subMainPipesCount: history.present.subMainPipes.length,
            zonesCount: history.present.zones.length,
            irrigationZonesCount: history.present.irrigationZones.length,
            snapThreshold: history.present.lateralPipeSettings.snapThreshold,
            clickedSubMainPipeData,
            hasRotation: history.present.plants.some(
                (p) => p.rotationAngle && p.rotationAngle !== 0
            ),
        });

        if (!clickedSubMainPipeData) {
            console.log('❌ No submain pipe found for lateral pipe connection');
            return;
        }

        const clickedSubMainPipe = clickedSubMainPipeData.pipe;

        if (!history.present.lateralPipeDrawing.startPoint) {
            const connectionPoint = findClosestConnectionPoint(clickPoint, clickedSubMainPipe);
            if (connectionPoint) {
                let snappedStartPoint = connectionPoint;

                if (
                    history.present.lateralPipeDrawing.placementMode &&
                    history.present.plants.length > 0
                ) {
                    try {
                        let closestPlant: any = null;
                        let minDistance = Infinity;

                        for (const plant of history.present.plants) {
                            const distance = calculateDistanceBetweenPoints(
                                connectionPoint,
                                plant.position
                            );
                            if (distance < minDistance) {
                                minDistance = distance;
                                closestPlant = plant;
                            }
                        }

                        // 🔧 แก้ไข: ไม่ต้อง snap ไปต้นไม้ ให้ใช้จุดเชื่อมต่อบนท่อเมนรองโดยตรง
                        // เพื่อให้สามารถเริ่มวาดท่อย่อยจากท่อเมนรองได้อย่างถูกต้อง
                        snappedStartPoint = connectionPoint;
                    } catch (error) {
                        console.error('❌ Error calculating snappedStartPoint:', error);
                        snappedStartPoint = connectionPoint;
                    }
                }

                dispatchHistory({
                    type: 'PUSH_STATE',
                    state: {
                        ...history.present,
                        lateralPipeDrawing: {
                            ...history.present.lateralPipeDrawing,
                            startPoint: connectionPoint,
                            snappedStartPoint: snappedStartPoint,
                            currentPoint: snappedStartPoint,
                            rawCurrentPoint: snappedStartPoint,
                            // 🚀 Reset multi-segment fields เมื่อเริ่มวาดใหม่
                            waypoints: [],
                            currentSegmentDirection: null,
                            allSegmentPlants: [],
                            segmentPlants: [],
                            isMultiSegmentMode: false,
                            // Reset other drawing-related fields
                            selectedPlants: [],
                            totalWaterNeed: 0,
                            plantCount: 0,
                        },
                    },
                });
            }
        } else {
            handleFinishLateralPipeDrawing(clickPoint);
        }
    };

    const getCurrentZoneIdForLateralPipe = (
        lateralPipe: LateralPipe,
        state: ProjectState,
        manualZonesParam?: ManualIrrigationZone[]
    ): string => {
        const currentManualZones = manualZonesParam || manualZones;

        // 🚀 หาโซนจากจุดปลายของท่อก่อน (ตามความต้องการใหม่)
        const lateralEnd = lateralPipe.coordinates[lateralPipe.coordinates.length - 1];

        if (currentManualZones.length > 0) {
            for (const zone of currentManualZones) {
                if (isPointInPolygon(lateralEnd, zone.coordinates)) {
                    return zone.id;
                }
            }
        }

        for (const zone of state.irrigationZones) {
            if (isPointInPolygon(lateralEnd, zone.coordinates)) {
                return zone.id;
            }
        }

        // ถ้าไม่เจอจากจุดปลาย ให้ลองดูจากต้นไม้
        if (lateralPipe.plants.length > 0) {
            const firstPlant = lateralPipe.plants[0];

            if (firstPlant.zoneId) {
                return firstPlant.zoneId;
            }

            if (currentManualZones.length > 0) {
                for (const zone of currentManualZones) {
                    if (isPointInPolygon(firstPlant.position, zone.coordinates)) {
                        return zone.id;
                    }
                }
            }

            for (const zone of state.irrigationZones) {
                if (isPointInPolygon(firstPlant.position, zone.coordinates)) {
                    return zone.id;
                }
            }
        }

        // สุดท้ายลองดูจากจุดเริ่มต้น
        const lateralStart = lateralPipe.coordinates[0];

        if (currentManualZones.length > 0) {
            for (const zone of currentManualZones) {
                if (isPointInPolygon(lateralStart, zone.coordinates)) {
                    return zone.id;
                }
            }
        }

        for (const zone of state.irrigationZones) {
            if (isPointInPolygon(lateralStart, zone.coordinates)) {
                return zone.id;
            }
        }

        return 'main-area';
    };

    const getExistingLateralPipesInZone = (
        zoneId: string,
        state: ProjectState,
        manualZonesParam?: ManualIrrigationZone[]
    ): LateralPipe[] => {
        return state.lateralPipes.filter((lateralPipe) => {
            const pipeZoneId = getCurrentZoneIdForLateralPipe(lateralPipe, state, manualZonesParam);
            return pipeZoneId === zoneId;
        });
    };

    const getZoneNameById = (
        zoneId: string,
        state: ProjectState,
        manualZonesParam?: ManualIrrigationZone[]
    ): string => {
        if (zoneId === 'main-area') {
            return t('พื้นที่หลัก');
        }

        const currentManualZones = manualZonesParam || manualZones;
        if (currentManualZones.length > 0) {
            const manualZone = currentManualZones.find((z) => z.id === zoneId);
            if (manualZone) {
                return manualZone.name;
            }
        }

        const zone = state.irrigationZones.find((z) => z.id === zoneId);
        return zone?.name || t('โซนไม่ระบุ');
    };

    // 🚀 ฟังก์ชันสำหรับเพิ่ม waypoint (right-click)
    const handleAddLateralPipeWaypoint = (waypointPosition: Coordinate) => {
        if (
            !history.present.lateralPipeDrawing.isActive ||
            !history.present.lateralPipeDrawing.startPoint ||
            !history.present.lateralPipeDrawing.placementMode
        ) {
            return;
        }

        const currentWaypoints = history.present.lateralPipeDrawing.waypoints;

        // 🚀 Snap waypoint ให้พอดีกับต้นไม้ในโหมด over_plants
        let snappedWaypointPosition = waypointPosition;
        if (history.present.lateralPipeDrawing.placementMode === 'over_plants') {
            // หาต้นไม้ที่ใกล้ที่สุดกับตำแหน่งคลิก
            const snapThreshold = 0.00005; // ~5 เมตร
            let closestPlant: any = null;
            let minDistance = Infinity;

            history.present.plants.forEach((plant: any) => {
                const distance = Math.sqrt(
                    Math.pow(plant.position.lat - waypointPosition.lat, 2) +
                        Math.pow(plant.position.lng - waypointPosition.lng, 2)
                );

                if (distance < minDistance && distance < snapThreshold) {
                    minDistance = distance;
                    closestPlant = plant;
                }
            });

            // ถ้าเจอต้นไม้ใกล้ ให้ snap ไปที่ต้นไม้
            if (closestPlant && closestPlant.position) {
                snappedWaypointPosition = closestPlant.position as Coordinate;
            }
        }

        const newWaypoints = [...currentWaypoints, snappedWaypointPosition];

        // คำนวณทิศทางใหม่สำหรับ segment ถัดไป
        let newDirection: 'horizontal' | 'vertical' | 'diagonal' | null = null;

        if (currentWaypoints.length === 0) {
            // ส่วนแรก: กำหนดทิศทางตามการลากปัจจุบัน แล้วสลับทิศทางสำหรับส่วนถัดไป
            const startPoint = history.present.lateralPipeDrawing.startPoint;
            const deltaLat = Math.abs(snappedWaypointPosition.lat - startPoint.lat);
            const deltaLng = Math.abs(snappedWaypointPosition.lng - startPoint.lng);

            // กำหนดทิศทางปัจจุบัน แล้วสลับสำหรับส่วนถัดไป
            if (deltaLat > deltaLng * 1.5) {
                // ปัจจุบันเป็น vertical → ส่วนถัดไปเป็น horizontal
                newDirection = 'horizontal';
            } else if (deltaLng > deltaLat * 1.5) {
                // ปัจจุบันเป็น horizontal → ส่วนถัดไปเป็น vertical
                newDirection = 'vertical';
            } else {
                // ถ้าเป็นแนวทแยง ให้สลับจากทิศทางที่เด่นกว่า
                newDirection = deltaLng > deltaLat ? 'vertical' : 'horizontal';
            }
        } else {
            // สลับทิศทางจากส่วนก่อนหน้า (X ↔ Y)
            const currentDirection = history.present.lateralPipeDrawing.currentSegmentDirection;
            if (currentDirection === 'horizontal') {
                newDirection = 'vertical';
            } else if (currentDirection === 'vertical') {
                newDirection = 'horizontal';
            } else {
                // ถ้าเป็น diagonal หรือ null ให้เริ่มต้นด้วย horizontal
                newDirection = 'horizontal';
            }
        }

        // คำนวณต้นไม้ที่เลือกสำหรับส่วนใหม่
        const allPathPoints = [history.present.lateralPipeDrawing.startPoint, ...newWaypoints];

        // 🚀 ใช้ฟังก์ชันใหม่เพื่อคำนวณต้นไม้แบบ multi-segment ที่แม่นยำกว่า
        const multiSegmentResult = computeMultiSegmentAlignment(
            history.present.lateralPipeDrawing.startPoint,
            newWaypoints,
            snappedWaypointPosition,
            getPlantsWithCorrectRotationAngle(),
            history.present.lateralPipeDrawing.placementMode || 'over_plants',
            history.present.lateralPipeSettings.snapThreshold
        );

        const allSegmentPlants = multiSegmentResult.allSelectedPlants;
        const segmentPlants: PlantLocation[][] = multiSegmentResult.segmentResults.map(
            (result) => result.selectedPlants
        );

        // 🚀 Debug log เพื่อตรวจสอบทิศทาง (ปิดไว้)
        // console.log(`🔄 Waypoint added: Direction changed to "${newDirection}" (${newWaypoints.length} waypoints total)`);

        // อัปเดต state
        dispatchHistory({
            type: 'PUSH_STATE',
            state: {
                ...history.present,
                lateralPipeDrawing: {
                    ...history.present.lateralPipeDrawing,
                    waypoints: newWaypoints,
                    currentSegmentDirection: newDirection,
                    allSegmentPlants: allSegmentPlants,
                    segmentPlants: segmentPlants,
                    isMultiSegmentMode: true,
                    currentPoint: snappedWaypointPosition,
                    rawCurrentPoint: snappedWaypointPosition,
                    selectedPlants: allSegmentPlants, // แสดงต้นไม้ทั้งหมด
                    totalWaterNeed: calculateTotalWaterNeed(allSegmentPlants),
                    plantCount: allSegmentPlants.length,
                },
            },
        });
    };

    const handleFinishLateralPipeDrawing = (endPoint: Coordinate) => {
        if (
            !history.present.lateralPipeDrawing.startPoint ||
            !history.present.lateralPipeDrawing.snappedStartPoint ||
            !history.present.lateralPipeDrawing.placementMode
        ) {
            return;
        }

        const originalStartPoint = history.present.lateralPipeDrawing.startPoint;
        const snappedStartPoint = history.present.lateralPipeDrawing.snappedStartPoint;
        const placementMode = history.present.lateralPipeDrawing.placementMode;

        // 🚀 รองรับ multi-segment drawing
        let finalCoordinates: Coordinate[];
        let selectedPlants: PlantLocation[];

        if (
            history.present.lateralPipeDrawing.isMultiSegmentMode &&
            history.present.lateralPipeDrawing.waypoints.length > 0
        ) {
            // 🚀 Multi-segment mode: ใช้ฟังก์ชันใหม่เพื่อคำนวณเส้นทางและต้นไม้แบบครบถ้วน
            const finalMultiSegmentResult = computeMultiSegmentAlignment(
                snappedStartPoint,
                history.present.lateralPipeDrawing.waypoints,
                endPoint,
                getPlantsWithCorrectRotationAngle(),
                placementMode || 'over_plants',
                history.present.lateralPipeSettings.snapThreshold
            );

            finalCoordinates = [
                snappedStartPoint,
                ...history.present.lateralPipeDrawing.waypoints,
                finalMultiSegmentResult.alignedEndPoint,
            ];

            // ใช้ต้นไม้ทั้งหมดที่คำนวณได้จาก multi-segment alignment
            selectedPlants = finalMultiSegmentResult.allSelectedPlants;
        } else {
            // Single-segment mode (เดิม)
            const alignedFinal = computeAlignedLateralFromMainPipe(
                snappedStartPoint,
                endPoint,
                getPlantsWithCorrectRotationAngle(),
                placementMode,
                history.present.lateralPipeSettings.snapThreshold
            );

            finalCoordinates = [snappedStartPoint, alignedFinal.alignedEnd];
            selectedPlants = history.present.lateralPipeDrawing.selectedPlants;
        }

        if (selectedPlants.length === 0) {
            alert(t('ไม่พบต้นไม้ในเส้นทางที่เลือก'));
            return;
        }

        const snappedEnd = finalCoordinates[finalCoordinates.length - 1];

        // 🚀 ตรวจจับจุดตัดระหว่างท่อย่อยกับท่อเมนรอง
        // ตรวจสอบทั้งการลากผ่านท่อ submain และการเริ่มต้นใกล้ท่อ submain
        let intersectionData = findLateralSubMainIntersection(
            snappedStartPoint,
            snappedEnd,
            history.present.subMainPipes
        );

        // 🔥 ถ้าไม่มีการลากผ่าน ให้ตรวจสอบการเริ่มต้นใกล้ท่อ submain
        if (!intersectionData) {
            const closestSubMain = history.present.subMainPipes.find((sm) =>
                isPointOnSubMainPipe(
                    originalStartPoint,
                    sm,
                    history.present.lateralPipeSettings.snapThreshold
                )
            );

            if (closestSubMain) {
                // สร้าง intersection data สำหรับการเริ่มต้นใกล้ท่อ submain
                const connectionPoint = findClosestConnectionPoint(
                    originalStartPoint,
                    closestSubMain
                );
                if (connectionPoint) {
                    intersectionData = {
                        intersectionPoint: connectionPoint,
                        subMainPipeId: closestSubMain.id,
                        segmentIndex: 0, // ใช้ segment แรก
                    };
                }
            }
        }

        // 🚀 หาโซนของท่อย่อย (ดูจากจุดปลาย)
        const targetZoneId = getCurrentZoneIdForLateralPipe(
            {
                coordinates: finalCoordinates,
                plants: selectedPlants,
            } as any,
            history.present,
            manualZones
        );

        const lateralPipeId = generateLateralPipeId();
        const lateralPipe: LateralPipe = {
            id: lateralPipeId,
            subMainPipeId: (
                history.present.subMainPipes.find((sm) =>
                    isPointOnSubMainPipe(
                        originalStartPoint,
                        sm,
                        history.present.lateralPipeSettings.snapThreshold
                    )
                ) || history.present.subMainPipes[0]
            ).id,
            coordinates: finalCoordinates,
            length: calculatePipeLength(finalCoordinates), // 🚀 ใช้ calculatePipeLength สำหรับ multi-segment
            diameter: 16,
            plants: selectedPlants,
            placementMode,
            emitterLines: [],
            isEditable: true,
            isSelected: false,
            isHovered: false,
            isHighlighted: false,
            isDisabled: false,
            isVisible: true,
            isActive: true,
            connectionPoint: snappedStartPoint, // ใช้จุดเริ่มต้นที่ snap แล้วเป็นจุดเชื่อมต่อ
            totalWaterNeed: history.present.lateralPipeDrawing.totalWaterNeed,
            plantCount: history.present.lateralPipeDrawing.plantCount,
            zoneId: targetZoneId,
            // 🚀 เพิ่มข้อมูลจุดตัดถ้ามี
            intersectionData: intersectionData
                ? {
                      point: intersectionData.intersectionPoint,
                      subMainPipeId: intersectionData.subMainPipeId,
                      segmentIndex: intersectionData.segmentIndex,
                      segmentStats: calculateLateralPipeSegmentStats(
                          snappedStartPoint,
                          snappedEnd,
                          intersectionData.intersectionPoint,
                          selectedPlants
                      ),
                  }
                : undefined,
        };

        if (
            placementMode === 'between_plants' &&
            history.present.lateralPipeSettings.autoGenerateEmitters
        ) {
            console.log('🚀 Creating emitter lines for between_plants mode:', {
                lateralPipeId,
                selectedPlantsCount: selectedPlants.length,
                isMultiSegment: history.present.lateralPipeDrawing.isMultiSegmentMode,
                finalCoordinatesLength: finalCoordinates.length,
            });

            // 🔧 สำหรับ multi-segment ใช้ coordinates ที่สมบูรณ์
            if (
                history.present.lateralPipeDrawing.isMultiSegmentMode &&
                finalCoordinates.length > 2
            ) {
                lateralPipe.emitterLines = generateEmitterLinesForMultiSegment(
                    lateralPipeId,
                    finalCoordinates,
                    selectedPlants,
                    history.present.lateralPipeSettings.emitterDiameter
                );
            } else {
                lateralPipe.emitterLines = generateEmitterLinesForBetweenPlantsMode(
                    lateralPipeId,
                    originalStartPoint,
                    snappedEnd,
                    selectedPlants,
                    history.present.lateralPipeSettings.emitterDiameter
                );
            }

            console.log('🚀 Generated emitter lines:', lateralPipe.emitterLines?.length || 0);
        } else if (
            placementMode === 'over_plants' &&
            history.present.lateralPipeSettings.autoGenerateEmitters
        ) {
            lateralPipe.emitterLines = generateEmitterLines(
                lateralPipeId,
                originalStartPoint,
                snappedEnd,
                selectedPlants,
                history.present.lateralPipeSettings.emitterDiameter
            );
        }

        const currentZoneId = getCurrentZoneIdForLateralPipe(
            lateralPipe,
            history.present,
            manualZones
        );

        const existingLateralPipesInZone = getExistingLateralPipesInZone(
            currentZoneId,
            history.present,
            manualZones
        );
        const isFirstLateralPipeInZone = existingLateralPipesInZone.length === 0;

        let updatedFirstLateralPipeWaterNeeds;
        let updatedFirstLateralPipePlantCounts;
        let updatedLateralPipeComparison;

        if (isFirstLateralPipeInZone) {
            updatedFirstLateralPipeWaterNeeds = {
                ...history.present.firstLateralPipeWaterNeeds,
                [currentZoneId]: lateralPipe.totalWaterNeed,
            };
            updatedFirstLateralPipePlantCounts = {
                ...history.present.firstLateralPipePlantCounts,
                [currentZoneId]: lateralPipe.plantCount,
            };

            updatedLateralPipeComparison = {
                isComparing: false,
                currentZoneId: null,
                firstPipeWaterNeed: 0,
                currentPipeWaterNeed: 0,
                difference: 0,
                isMoreThanFirst: false,
            };
        } else {
            updatedFirstLateralPipeWaterNeeds = history.present.firstLateralPipeWaterNeeds;
            updatedFirstLateralPipePlantCounts = history.present.firstLateralPipePlantCounts;

            const firstPipeWaterNeed =
                history.present.firstLateralPipeWaterNeeds[currentZoneId] || 0;
            if (firstPipeWaterNeed > 0) {
                const difference =
                    ((lateralPipe.totalWaterNeed - firstPipeWaterNeed) / firstPipeWaterNeed) * 100;
                updatedLateralPipeComparison = {
                    isComparing: true,
                    currentZoneId,
                    firstPipeWaterNeed,
                    currentPipeWaterNeed: lateralPipe.totalWaterNeed,
                    difference,
                    isMoreThanFirst: lateralPipe.totalWaterNeed > firstPipeWaterNeed,
                };
            } else {
                updatedLateralPipeComparison = {
                    isComparing: false,
                    currentZoneId: null,
                    firstPipeWaterNeed: 0,
                    currentPipeWaterNeed: 0,
                    difference: 0,
                    isMoreThanFirst: false,
                };
            }
        }

        // 🚀 Check if continuous mode is enabled to keep drawing active
        const shouldContinueDrawing = history.present.lateralPipeDrawing.isContinuousMode;

        dispatchHistory({
            type: 'PUSH_STATE',
            state: {
                ...history.present,
                editMode: shouldContinueDrawing ? 'lateralPipe' : null, // 🚀 Keep editMode if continuous, reset if not
                isEditModeEnabled: shouldContinueDrawing, // Keep edit mode if continuous
                lateralPipes: [...history.present.lateralPipes, lateralPipe],
                firstLateralPipeWaterNeeds: updatedFirstLateralPipeWaterNeeds,
                firstLateralPipePlantCounts: updatedFirstLateralPipePlantCounts,
                lateralPipeComparison: updatedLateralPipeComparison,
                lateralPipeDrawing: {
                    ...history.present.lateralPipeDrawing,
                    isActive: shouldContinueDrawing, // Keep active if continuous
                    placementMode: shouldContinueDrawing
                        ? history.present.lateralPipeDrawing.placementMode
                        : null, // Keep mode if continuous
                    startPoint: null, // Always reset drawing points
                    snappedStartPoint: null,
                    currentPoint: null,
                    rawCurrentPoint: null,
                    selectedPlants: [],
                    totalWaterNeed: 0,
                    plantCount: 0,
                    // 🚀 Reset multi-segment fields
                    waypoints: [],
                    currentSegmentDirection: null,
                    allSegmentPlants: [],
                    segmentPlants: [],
                    isMultiSegmentMode: false,
                },
            },
        });

        // 🌱 Reset highlighted plants เมื่อจบการวาดท่อย่อย
        if (!shouldContinueDrawing) {
            setHighlightedPlants(new Set());
        }

        // alert(
        //     `✅ สร้างท่อย่อยสำเร็จ!\n🌱 จำนวนต้นไม้: ${selectedPlants.length} ต้น\n💧 ความต้องการน้ำ: ${history.present.lateralPipeDrawing.totalWaterNeed.toFixed(1)} ลิตร\n📏 ความยาวท่อ: ${lateralPipe.length.toFixed(1)} เมตร`
        // );
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            {/* Zone Edit Mode Status Popup - มุมบนขวา */}
            {isZoneEditMode && (
                <div className="animate-in fade-in fixed right-3 top-[190px] z-[9999] max-w-sm duration-300">
                    <div className="rounded-lg border border-orange-300 bg-gradient-to-r from-orange-50 to-amber-50 p-4 shadow-xl backdrop-blur-sm">
                        <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2">
                                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-orange-100">
                                    <span className="text-lg">🎯</span>
                                </div>
                                <div className="flex-1">
                                    <div className="text-sm font-semibold text-orange-800">
                                        {t('โหมดแก้ไขโซน')}
                                    </div>
                                    <div className="text-xs text-orange-700">
                                        {selectedZoneForEdit
                                            ? t('คลิกและลากจุดสีแดงเพื่อปรับขนาดโซน')
                                            : t('คลิกที่โซนที่ต้องการแก้ไข')}
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => handleExitZoneEditMode()}
                                className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-200 text-orange-600 transition-colors hover:bg-orange-300 hover:text-orange-800"
                                title={t('ออกจากโหมดแก้ไขโซน')}
                            >
                                ✕
                            </button>
                        </div>

                        {selectedZoneForEdit && (
                            <div className="mt-3 rounded-md bg-white/60 p-2">
                                <div className="text-xs font-medium text-orange-800">
                                    {t('กำลังแก้ไข')}:{' '}
                                    <span className="font-bold">{selectedZoneForEdit.name}</span>
                                </div>
                                <div className="mt-1 text-xs text-orange-600">
                                    💡{' '}
                                    {t(
                                        'ลากได้นอกพื้นที่หลัก แต่จะแสดงเฉพาะส่วนที่ทับกับพื้นที่หลัก'
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            <header className="sticky top-0 z-50 border-b border-gray-200 bg-gray-800 shadow-sm">
                <Navbar />
                <div className="px-4 py-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-6">
                            <div className="flex items-center space-x-2">
                                <FaTree className="text-xl text-green-600" />
                                <h1 className="text-xl font-bold text-white">
                                    {t('ระบบออกแบบระบบน้ำพืชสวน')}
                                </h1>
                                {isEditingExistingField && (
                                    <div className="flex items-center space-x-1 rounded-lg bg-blue-600 px-2 py-1 text-xs text-white">
                                        <span>✏️</span>
                                        <span>{t('แก้ไขแปลง')}</span>
                                    </div>
                                )}
                            </div>

                            {!isCompactMode && (
                                <div className="hidden items-center space-x-4 rounded-lg bg-gray-900 px-3 py-1 text-sm text-white md:flex">
                                    <div className="flex items-center space-x-1">
                                        <span>🗺️</span>
                                        <span>{formatArea(totalArea, t)}</span>
                                    </div>
                                    <div className="flex items-center space-x-1">
                                        <span>🌱</span>
                                        <span>
                                            {actualTotalPlants} {t('ต้น')}
                                        </span>
                                    </div>
                                    {history.present.pump && (
                                        <div className="flex items-center space-x-1 text-green-600">
                                            <img
                                                src="/images/water-pump.png"
                                                alt="Water Pump"
                                                className="h-4 w-4 object-contain"
                                            />
                                            <span>{t('ปั๊มพร้อม')}</span>
                                        </div>
                                    )}
                                    {isDragging && (
                                        <div className="flex items-center space-x-1 text-blue-400">
                                            <span>🖱️</span>
                                            <span>{t('กำลังลาก')}</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="flex items-center space-x-2">
                            <button
                                onClick={zoomToMainArea}
                                disabled={history.present.mainArea.length === 0}
                                className={`h-10 w-10 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                    history.present.mainArea.length === 0
                                        ? 'cursor-not-allowed bg-gray-600 text-white opacity-50'
                                        : 'bg-blue-600 text-white hover:bg-blue-700'
                                }`}
                                title={t('ซูมไปยังพื้นที่หลัก')}
                                type="button"
                            >
                                🎯
                            </button>

                            <button
                                onClick={isRulerMode ? stopRulerMode : startRulerMode}
                                className={`h-10 w-10 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${
                                    isRulerMode
                                        ? 'bg-red-600 text-white ring-2 ring-red-300 hover:bg-red-700'
                                        : 'bg-purple-600 text-white hover:bg-purple-700'
                                }`}
                                title={
                                    isRulerMode
                                        ? t('หยุดใช้ไม้บรรทัด')
                                        : t(
                                              'ไม้บรรทัดวัดระยะ - คลิกจุดเริ่มต้น แล้วเลื่อนเมาส์เพื่อวัดระยะ'
                                          )
                                }
                                type="button"
                            >
                                {isRulerMode ? (
                                    <>
                                        <FaTimes className="h-4 w-4" />
                                    </>
                                ) : (
                                    <>
                                        <FaRuler className="h-4 w-4" />
                                    </>
                                )}
                            </button>

                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    toggleCurvedPipeEditMode();
                                }}
                                className={`flex h-10 w-10 items-center rounded-md px-3 py-2 text-sm font-medium shadow-md transition-all duration-200 hover:shadow-lg ${
                                    history.present.curvedPipeEditing.isEnabled
                                        ? 'border-2 border-red-300 bg-red-600 text-white hover:bg-red-700'
                                        : 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50'
                                }`}
                                type="button"
                                title={t('แก้ไขรูปร่างท่อ')}
                            >
                                {history.present.curvedPipeEditing.isEnabled ? (
                                    <FaTimes className="h-4 w-4" />
                                ) : (
                                    <FaBezierCurve className="h-4 w-4" />
                                )}
                            </button>

                            {editMode === 'plant' && (
                                <div className="flex items-center space-x-2 rounded-lg border border-gray-600 bg-gray-800 px-2 py-1">
                                    <span className="text-xs text-gray-200">{t('โหมดวาง')}</span>
                                    <div className="inline-flex rounded-md shadow-sm" role="group">
                                        <button
                                            type="button"
                                            onClick={() => setPlantPlacementMode('free')}
                                            className={`border border-gray-600 px-2 py-1 text-xs font-medium ${
                                                plantPlacementMode === 'free'
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                                            } rounded-l-md`}
                                            title={t('วางได้ทุกที่ภายในพื้นที่ที่กำหนด')}
                                        >
                                            {t('อิสระ')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setPlantPlacementMode('plant_grid');
                                            }}
                                            className={`border border-l-0 border-gray-600 px-2 py-1 text-xs font-medium ${
                                                plantPlacementMode === 'plant_grid'
                                                    ? 'bg-blue-600 text-white'
                                                    : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                                            } rounded-r-md`}
                                            title={t(
                                                'วางตามแนวแถวหรือคอลัมน์ของต้นไม้ที่มีอยู่แล้ว'
                                            )}
                                        >
                                            {t('ตามแนวต้นไม้')}
                                        </button>
                                    </div>
                                </div>
                            )}
                            <button
                                onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();

                                    if (
                                        history.present.subMainPipes.length === 0 &&
                                        history.present.plants.length === 0 &&
                                        editMode !== 'plant'
                                    ) {
                                        alert(
                                            t(
                                                'กรุณาวางท่อเมนรองหรือสร้างต้นไม้อัตโนมัติก่อนเพิ่มต้นไม้'
                                            )
                                        );
                                        return;
                                    }

                                    handleToggleAddPlantMode();
                                }}
                                disabled={
                                    history.present.subMainPipes.length === 0 &&
                                    history.present.plants.length === 0 &&
                                    editMode !== 'plant'
                                }
                                className={`h-10 w-10 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${
                                    editMode === 'plant'
                                        ? 'bg-red-600 text-white hover:bg-red-700'
                                        : history.present.subMainPipes.length === 0 &&
                                            history.present.plants.length === 0
                                          ? 'cursor-not-allowed bg-gray-600 text-gray-400 opacity-50'
                                          : 'bg-green-600 text-white hover:bg-green-700'
                                }`}
                                title={
                                    editMode === 'plant'
                                        ? t('หยุดเพิ่มต้นไม้')
                                        : history.present.subMainPipes.length === 0 &&
                                            history.present.plants.length === 0
                                          ? t(
                                                'กรุณาวางท่อเมนรองหรือสร้างต้นไม้อัตโนมัติก่อนเพิ่มต้นไม้'
                                            )
                                          : t('เพิ่มต้นไม้')
                                }
                                type="button"
                            >
                                {editMode === 'plant' ? (
                                    <>
                                        <FaTimes className="h-4 w-4" />
                                    </>
                                ) : (
                                    <>
                                        <FaPlus className="h-4 w-4" />
                                    </>
                                )}
                            </button>

                            {isPlantMoveMode && (
                                <div className="flex flex-col space-y-2">
                                    {/* ตัวเลือกโหมดการเลื่อนต้นไม้ */}
                                    <div className="flex items-center space-x-2 rounded-lg border border-gray-600 bg-gray-800 px-2 py-1">
                                        <span className="text-xs text-gray-200">
                                            {t('โหมดเลื่อน')}
                                        </span>
                                        <div
                                            className="inline-flex rounded-md shadow-sm"
                                            role="group"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => handlePlantMoveModeChange('all')}
                                                className={`border border-gray-600 px-2 py-1 text-xs font-medium ${
                                                    plantMoveMode === 'all'
                                                        ? 'bg-blue-600 text-white'
                                                        : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                                                } rounded-l-md`}
                                                title={t('เลื่อนต้นไม้ทั้งหมด')}
                                            >
                                                {t('ทั้งหมด')}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    handlePlantMoveModeChange('selected')
                                                }
                                                className={`border border-l-0 border-gray-600 px-2 py-1 text-xs font-medium ${
                                                    plantMoveMode === 'selected'
                                                        ? 'bg-green-600 text-white'
                                                        : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                                                }`}
                                                title={t('เลื่อนเฉพาะต้นไม้ที่เลือก')}
                                            >
                                                {t('เลือก')}
                                            </button>
                                            {history.present.plantAreas.length > 0 && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        handlePlantMoveModeChange('area')
                                                    }
                                                    className={`border border-l-0 border-gray-600 px-2 py-1 text-xs font-medium ${
                                                        plantMoveMode === 'area'
                                                            ? 'bg-purple-600 text-white'
                                                            : 'bg-gray-700 text-gray-200 hover:bg-gray-600'
                                                    } rounded-r-md`}
                                                    title={t('เลื่อนต้นไม้ในพื้นที่ปลูกที่เลือก')}
                                                >
                                                    {t('พื้นที่')}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* แสดงตัวเลือกพื้นที่ปลูกเมื่ออยู่ในโหมด area */}
                                    {plantMoveMode === 'area' &&
                                        history.present.plantAreas.length > 0 && (
                                            <div className="flex items-center space-x-2 rounded-lg border border-purple-600 bg-purple-900 px-2 py-1">
                                                <span className="text-xs text-purple-200">
                                                    {t('เลือกพื้นที่')}
                                                </span>
                                                <select
                                                    value={selectedPlantAreaForMove || ''}
                                                    onChange={(e) =>
                                                        handlePlantAreaSelectForMove(e.target.value)
                                                    }
                                                    className="rounded border border-purple-400 bg-purple-800 px-2 py-1 text-xs text-purple-100 focus:border-purple-300 focus:outline-none"
                                                >
                                                    <option value="">
                                                        {t('-- เลือกพื้นที่ปลูก --')}
                                                    </option>
                                                    {history.present.plantAreas.map((area) => (
                                                        <option key={area.id} value={area.id}>
                                                            {area.name}
                                                        </option>
                                                    ))}
                                                </select>
                                            </div>
                                        )}

                                    {/* ปุ่มเลือกต้นไม้ (เฉพาะเมื่ออยู่ในโหมด selected) */}
                                    {/* {plantMoveMode === 'selected' && (
                              <button
                                        onClick={handleTogglePlantSelectionMode}
                                        className={`h-10 w-10 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                            isPlantSelectionMode
                                                ? 'bg-green-600 text-white ring-2 ring-green-300 hover:bg-green-700'
                                                : 'bg-purple-600 text-white hover:bg-purple-700'
                                        }`}
                                        title={
                                            isPlantSelectionMode
                                                ? t('ออกจากโหมดเลือกต้นไม้')
                                                : t(
                                                      'เข้าสู่โหมดเลือกต้นไม้ - เลือกต้นไม้ที่ต้องการเลื่อน'
                                                  )
                                        }
                                        type="button"
                                    >
                                        {isPlantSelectionMode ? (
                                            <>
                                                <FaCheck className="h-4 w-4" />
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-sm">🌳</span>
                                            </>
                                        )}
                                    </button>
                                    )} */}
                                </div>
                            )}

                            {/* แสดงคำแนะนำเมื่ออยู่ใน Plant Move Mode */}
                            {isPlantMoveMode && (
                                <div className="flex items-center space-x-2 rounded-lg border border-orange-300 bg-orange-50 px-3 py-2">
                                    <div className="flex items-center space-x-1">
                                        <span className="text-xs text-orange-600">
                                            {t('ระยะ')}: {(plantMoveStep * 111000).toFixed(1)}m
                                        </span>
                                        <div className="flex space-x-1">
                                            <button
                                                onClick={() =>
                                                    setPlantMoveStep(
                                                        Math.max(0.000005, plantMoveStep - 0.000005)
                                                    )
                                                }
                                                className="rounded bg-orange-200 px-1 py-0.5 text-xs text-orange-700 hover:bg-orange-300"
                                                title={t('ลดระยะการเลื่อน')}
                                            >
                                                -
                                            </button>
                                            <button
                                                onClick={() =>
                                                    setPlantMoveStep(
                                                        Math.min(0.0001, plantMoveStep + 0.000005)
                                                    )
                                                }
                                                className="rounded bg-orange-200 px-1 py-0.5 text-xs text-orange-700 hover:bg-orange-300"
                                                title={t('เพิ่มระยะการเลื่อน')}
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {history.present.isEditModeEnabled && (
                                <div className="flex items-center rounded-lg border border-yellow-300 bg-yellow-50 px-2 py-1">
                                    <button
                                        onClick={() =>
                                            setShowQuickActionPanel(!showQuickActionPanel)
                                        }
                                        className="rounded p-1 text-yellow-700 hover:bg-yellow-100"
                                        title={t('แผงเครื่องมือด่วน')}
                                    >
                                        <FaBars />
                                    </button>

                                    {selectedItemsCount > 0 && (
                                        <>
                                            <div className="mx-2 h-4 w-px bg-yellow-300"></div>
                                            <span className="text-xs text-yellow-700">
                                                {t('เลือก')}: {selectedItemsCount}
                                            </span>
                                            <button
                                                onClick={() => setShowBatchModal(true)}
                                                className="ml-1 rounded bg-yellow-200 px-2 py-1 text-xs text-yellow-800 hover:bg-yellow-300"
                                            >
                                                <FaCog className="mr-1 inline" />
                                                {t('จัดการ')}
                                            </button>
                                            <button
                                                onClick={handleClearSelection}
                                                className="ml-1 rounded bg-red-200 px-2 py-1 text-xs text-red-800 hover:bg-red-300"
                                            >
                                                <FaTimes />
                                            </button>
                                        </>
                                    )}
                                </div>
                            )}

                            {/* ปุ่มเลื่อนต้นไม้ */}
                            {history.present.plants.length > 0 && (
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={handleTogglePlantMoveMode}
                                        className={`h-10 w-10 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                            isPlantMoveMode
                                                ? 'bg-red-600 text-white ring-2 ring-red-300 hover:bg-red-700'
                                                : 'bg-blue-600 text-white hover:bg-blue-700'
                                        }`}
                                        title={
                                            isPlantMoveMode
                                                ? t('ออกจากโหมดเลื่อนต้นไม้ (กด Escape)')
                                                : t(
                                                      'เข้าสู่โหมดเลื่อนต้นไม้ - ใช้ปุ่มลูกศรเพื่อเลื่อนต้นไม้ทั้งหมด หรือเฉพาะต้นไม้ที่เลือก'
                                                  )
                                        }
                                        type="button"
                                    >
                                        {isPlantMoveMode ? (
                                            <>
                                                <FaTimes className="h-4 w-4" />
                                            </>
                                        ) : (
                                            <>
                                                <FaArrowsAlt className="h-4 w-4" />
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            <button
                                onClick={() => togglePipeConnectionMode()}
                                className={`h-10 w-10 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                                    history.present.pipeConnection.isActive
                                        ? 'bg-red-600 text-white hover:bg-red-700'
                                        : 'bg-green-600 text-white hover:bg-green-700'
                                }`}
                                title={
                                    history.present.pipeConnection.isActive
                                        ? t('ออกจากโหมดเชื่อมท่อ')
                                        : t('เชื่อมท่อ')
                                }
                            >
                                {history.present.pipeConnection.isActive ? (
                                    <FaTimes className="h-4 w-4" />
                                ) : (
                                    <FaLink className="h-4 w-4" />
                                )}
                            </button>

                            <div className="flex items-center rounded-lg border border-gray-200">
                                <button
                                    onClick={handleUndo}
                                    disabled={history.past.length === 0}
                                    className={`rounded-l-lg p-2 transition-colors ${
                                        history.past.length === 0
                                            ? 'cursor-not-allowed bg-gray-600 text-gray-400'
                                            : 'bg-blue-600 text-gray-100 hover:bg-blue-500'
                                    }`}
                                    title={t('ย้อนกลับ')}
                                >
                                    <FaUndo />
                                </button>

                                <button
                                    onClick={handleRedo}
                                    disabled={history.future.length === 0}
                                    className={`border-l border-gray-200 p-2 transition-colors ${
                                        history.future.length === 0
                                            ? 'cursor-not-allowed bg-gray-600 text-gray-400'
                                            : 'bg-blue-600 text-gray-100 hover:bg-blue-500'
                                    }`}
                                    title={t('ไปข้างหน้า')}
                                >
                                    <FaRedo />
                                </button>

                                <button
                                    onClick={toggleSprinklerRadius}
                                    className={`rounded-r-lg border-l border-gray-200 p-2 transition-colors ${
                                        showSprinklerRadius
                                            ? 'bg-green-600 text-white hover:bg-green-500'
                                            : 'bg-gray-600 text-gray-100 hover:bg-gray-500'
                                    }`}
                                    title={
                                        showSprinklerRadius
                                            ? t('ซ่อนรัศมีหัวฉีด')
                                            : t('แสดงรัศมีหัวฉีด')
                                    }
                                >
                                    <FaShower />
                                </button>
                            </div>

                            <button
                                onClick={() => setIsCompactMode(!isCompactMode)}
                                className="rounded-lg border border-gray-200 p-2 text-gray-600 transition-colors hover:bg-gray-100"
                                title={isCompactMode ? 'ขยายแผง' : 'ย่อแผง'}
                            >
                                {isCompactMode ? <FaExpand /> : <FaCompress />}
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex h-[calc(91vh-64px)]">
                <div
                    className={`flex flex-col border-r border-gray-200 bg-gray-800 transition-all duration-300 ${
                        isCompactMode ? 'w-16' : 'w-80'
                    }`}
                >
                    <div className="border-b border-gray-200 bg-red-500">
                        <nav className={`${isCompactMode ? 'px-2' : 'px-4'} py-2`}>
                            <div
                                className={`grid gap-1 ${isCompactMode ? 'grid-cols-1' : 'grid-cols-3'}`}
                            >
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        className={`rounded-lg p-1 text-sm font-medium transition-colors ${
                                            activeTab === tab.id
                                                ? 'bg-blue-600 text-white shadow-md'
                                                : 'text-white hover:bg-gray-200'
                                        }`}
                                        title={isCompactMode ? tab.name : undefined}
                                    >
                                        <div className="flex flex-col items-center">
                                            <span className="text-lg">{tab.icon}</span>
                                            {!isCompactMode && (
                                                <span className="mt-1 text-xs">{tab.name}</span>
                                            )}
                                        </div>
                                    </button>
                                ))}
                            </div>
                        </nav>
                    </div>

                    {!isCompactMode && (
                        <div className="flex-1 overflow-y-auto">
                            {activeTab === 'area' && (
                                <div className="p-4">
                                    <h3 className="mb-4 flex items-center font-semibold text-white">
                                        <span className="mr-2">🗺️</span>
                                        {t('จัดการพื้นที่')}
                                    </h3>

                                    <div className="space-y-4">
                                        <div className="rounded-lg border border-gray-200 bg-gray-900 p-4">
                                            <h4 className="mb-3 font-medium text-white">
                                                {t('พื้นที่หลัก')}
                                            </h4>

                                            <button
                                                onClick={() =>
                                                    setEditMode(
                                                        editMode === 'mainArea' ? null : 'mainArea'
                                                    )
                                                }
                                                className={`w-full rounded-lg border px-4 py-3 font-medium transition-colors ${
                                                    editMode === 'mainArea'
                                                        ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                                                        : 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                                                }`}
                                            >
                                                {editMode === 'mainArea' ? (
                                                    <>{t('❌ หยุดวาดพื้นที่')}</>
                                                ) : (
                                                    <>✏️ {t('วาดพื้นที่หลัก')}</>
                                                )}
                                            </button>

                                            {history.present.mainArea.length > 0 && (
                                                <div className="mt-3 rounded-lg border border-green-200 bg-gray-900 p-1">
                                                    <div className="flex items-center justify-between text-sm text-green-700">
                                                        <div className="flex items-center">
                                                            <span className="mr-1">✅</span>
                                                            <span className="font-medium">
                                                                {t('สร้างพื้นที่แล้ว')} :{' '}
                                                                {formatArea(totalArea, t)}
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={() =>
                                                                setShowDeleteMainAreaConfirm(true)
                                                            }
                                                            className="flex items-center justify-center px-1 py-2 text-xs font-medium hover:bg-gray-200"
                                                            title={t('ลบพื้นที่หลัก')}
                                                            style={{
                                                                background: 'none',
                                                                border: 'none',
                                                                color: '#ef4444',
                                                            }}
                                                        >
                                                            <svg
                                                                xmlns="http://www.w3.org/2000/svg"
                                                                width="20"
                                                                height="20"
                                                                fill="none"
                                                                viewBox="0 0 20 20"
                                                            >
                                                                <path
                                                                    d="M6 7.5V15.5C6 16.0523 6.44772 16.5 7 16.5H13C13.5523 16.5 14 16.0523 14 15.5V7.5M4 5.5H16M8.5 9.5V13.5M11.5 9.5V13.5M7 5.5V4.5C7 3.94772 7.44772 3.5 8 3.5H12C12.5523 3.5 13 3.94772 13 4.5V5.5"
                                                                    stroke="#ef4444"
                                                                    strokeWidth="1.5"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                />
                                                            </svg>
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            {/* ส่วนการวาดพื้นที่ปลูกพืชหลายชนิด - แสดงเฉพาะเมื่ออยู่ในโหมด multiple และยังไม่เสร็จและยังไม่มีต้นไม้ */}
                                            {history.present.plantSelectionMode.type ===
                                                'multiple' &&
                                                !history.present.plantSelectionMode.isCompleted &&
                                                history.present.plants.length === 0 && (
                                                    <div className="mt-4 rounded-lg border border-blue-200 bg-gray-900 p-4">
                                                        <h5 className="mb-3 font-medium text-white">
                                                            🌱 {t('วาดพื้นที่ปลูกพืช')}
                                                        </h5>

                                                        <div className="space-y-2">
                                                            <button
                                                                onClick={() => {
                                                                    setEditMode(
                                                                        editMode === 'plantArea'
                                                                            ? null
                                                                            : 'plantArea'
                                                                    );
                                                                }}
                                                                className={`w-full rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${
                                                                    editMode === 'plantArea'
                                                                        ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                                                                        : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                                                                }`}
                                                            >
                                                                {editMode === 'plantArea' ? (
                                                                    <>❌ {t('หยุดวาด')}</>
                                                                ) : (
                                                                    <>✏️ {t('วาดพื้นที่พืช')}</>
                                                                )}
                                                            </button>

                                                            {history.present.plantAreas.length >
                                                                0 && (
                                                                <button
                                                                    onClick={
                                                                        handleCompletePlantAreas
                                                                    }
                                                                    disabled={
                                                                        history.present.plantAreas
                                                                            .length === 0
                                                                    }
                                                                    className={`w-full rounded-lg border px-4 py-2 text-sm font-medium ${
                                                                        history.present.plantAreas
                                                                            .length === 0
                                                                            ? 'cursor-not-allowed border-gray-300 bg-gray-100 text-gray-500'
                                                                            : 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                                                                    }`}
                                                                >
                                                                    {history.present.plantAreas.some(
                                                                        (area) => !area.isCompleted
                                                                    )
                                                                        ? `⚠️ ${t('กรุณาเลือกพืชให้ครบ')}`
                                                                        : `✅ ${t('วาดพื้นที่ต้นไม้เสร็จสิ้น')}`}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                            {/* ส่วนการสร้างต้นไม้ - แสดงเฉพาะเมื่อมีพื้นที่หลัก */}
                                            {history.present.mainArea.length > 0 && (
                                                <div className="mt-4 rounded-lg border border-green-200 bg-gray-900 p-2">
                                                    <h5 className="mb-2 font-medium text-white">
                                                        🌱 {t('สร้างต้นไม้')}
                                                    </h5>

                                                    <div className="space-y-2">
                                                        {/* แสดงสถานะต้นไม้ที่สร้างแล้ว - แสดงเฉพาะเมื่อมีต้นไม้แล้วและต้องการแสดงสถานะ */}
                                                        {history.present.plants.length > 0 && (
                                                            <div className="">
                                                                <p className="text-sm text-white">
                                                                    ✅ {t('สร้างต้นไม้แล้ว')}{' '}
                                                                    {history.present.plants.length}{' '}
                                                                    {t('ต้น')}
                                                                </p>
                                                                {history.present.plantSelectionMode
                                                                    .type === 'single' && (
                                                                    <p className="mb-2 mt-1 text-xs text-white">
                                                                        🌳{' '}
                                                                        {history.present
                                                                            .selectedPlantType
                                                                            ?.name ||
                                                                            t('พืชชนิดเดียว')}
                                                                    </p>
                                                                )}
                                                                {history.present.plantSelectionMode
                                                                    .type === 'multiple' && (
                                                                    <p className="mb-2 mt-1 text-xs text-white">
                                                                        🌿 {t('พืชหลายชนิด')} (
                                                                        {
                                                                            history.present
                                                                                .plantAreas.length
                                                                        }{' '}
                                                                        {t('พื้นที่')})
                                                                    </p>
                                                                )}
                                                                {history.present.plantAreas.length >
                                                                    0 && (
                                                                    <div className="max-h-32 space-y-2 overflow-y-auto">
                                                                        {history.present.plantAreas.map(
                                                                            (area) => (
                                                                                <div
                                                                                    key={area.id}
                                                                                    className="rounded border bg-gray-900 p-2 text-xs"
                                                                                >
                                                                                    <div className="flex items-center justify-between">
                                                                                        <div className="flex items-center space-x-2">
                                                                                            <div
                                                                                                className="h-3 w-3 rounded"
                                                                                                style={{
                                                                                                    backgroundColor:
                                                                                                        area.color,
                                                                                                }}
                                                                                            ></div>
                                                                                            <span className="font-medium text-white">
                                                                                                {
                                                                                                    area.name
                                                                                                }
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="flex items-center space-x-2">
                                                                                            <span className="text-xs text-gray-400">
                                                                                                {area.isCompleted
                                                                                                    ? area
                                                                                                          .plantData
                                                                                                          .name
                                                                                                    : t(
                                                                                                          'รอเลือกพืช'
                                                                                                      )}
                                                                                            </span>
                                                                                            {!area.isCompleted && (
                                                                                                <button
                                                                                                    onClick={() => {
                                                                                                        setCurrentPlantArea(
                                                                                                            area
                                                                                                        );
                                                                                                        setShowPlantAreaSelectionModal(
                                                                                                            true
                                                                                                        );
                                                                                                    }}
                                                                                                    className="rounded bg-yellow-600 px-1 py-0.5 text-xs text-white hover:bg-yellow-700"
                                                                                                    title={t(
                                                                                                        'เลือกพืช'
                                                                                                    )}
                                                                                                >
                                                                                                    ✏️
                                                                                                </button>
                                                                                            )}
                                                                                            {area.isCompleted && (
                                                                                                <button
                                                                                                    onClick={() => {
                                                                                                        setCurrentPlantArea(
                                                                                                            area
                                                                                                        );
                                                                                                        setShowPlantAreaSelectionModal(
                                                                                                            true
                                                                                                        );
                                                                                                    }}
                                                                                                    className="rounded bg-blue-600 px-1 py-0.5 text-xs text-white hover:bg-blue-700"
                                                                                                    title={t(
                                                                                                        'เปลี่ยนพืช'
                                                                                                    )}
                                                                                                >
                                                                                                    🔄
                                                                                                </button>
                                                                                            )}
                                                                                            <button
                                                                                                onClick={() => {
                                                                                                    const updatedPlantAreas =
                                                                                                        history.present.plantAreas.filter(
                                                                                                            (
                                                                                                                a
                                                                                                            ) =>
                                                                                                                a.id !==
                                                                                                                area.id
                                                                                                        );
                                                                                                    pushToHistory(
                                                                                                        {
                                                                                                            plantAreas:
                                                                                                                updatedPlantAreas,
                                                                                                        }
                                                                                                    );
                                                                                                }}
                                                                                                className="rounded bg-red-600 px-1 py-0.5 text-xs text-white hover:bg-red-700"
                                                                                                title={t(
                                                                                                    'ลบพื้นที่'
                                                                                                )}
                                                                                            >
                                                                                                🗑️
                                                                                            </button>
                                                                                            <button
                                                                                                onClick={() =>
                                                                                                    handleTogglePlantAreaVisibility(
                                                                                                        area.id
                                                                                                    )
                                                                                                }
                                                                                                className={`rounded px-2 py-1 text-xs ${
                                                                                                    history
                                                                                                        .present
                                                                                                        .layerVisibility
                                                                                                        .plantAreas
                                                                                                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                                                                                                        : 'bg-gray-500 text-white hover:bg-gray-600'
                                                                                                }`}
                                                                                                title={
                                                                                                    history
                                                                                                        .present
                                                                                                        .layerVisibility
                                                                                                        .plantAreas
                                                                                                        ? t(
                                                                                                              'ซ่อนสีพื้นที่'
                                                                                                          )
                                                                                                        : t(
                                                                                                              'แสดงสีพื้นที่'
                                                                                                          )
                                                                                                }
                                                                                            >
                                                                                                {history
                                                                                                    .present
                                                                                                    .layerVisibility
                                                                                                    .plantAreas ? (
                                                                                                    <svg
                                                                                                        xmlns="http://www.w3.org/2000/svg"
                                                                                                        className="inline h-4 w-4"
                                                                                                        fill="none"
                                                                                                        viewBox="0 0 24 24"
                                                                                                        stroke="currentColor"
                                                                                                    >
                                                                                                        <path
                                                                                                            strokeLinecap="round"
                                                                                                            strokeLinejoin="round"
                                                                                                            strokeWidth={
                                                                                                                2
                                                                                                            }
                                                                                                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                                                                                        />
                                                                                                        <path
                                                                                                            strokeLinecap="round"
                                                                                                            strokeLinejoin="round"
                                                                                                            strokeWidth={
                                                                                                                2
                                                                                                            }
                                                                                                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                                                                                        />
                                                                                                    </svg>
                                                                                                ) : (
                                                                                                    <svg
                                                                                                        xmlns="http://www.w3.org/2000/svg"
                                                                                                        className="inline h-4 w-4"
                                                                                                        fill="none"
                                                                                                        viewBox="0 0 24 24"
                                                                                                        stroke="currentColor"
                                                                                                    >
                                                                                                        <path
                                                                                                            strokeLinecap="round"
                                                                                                            strokeLinejoin="round"
                                                                                                            strokeWidth={
                                                                                                                2
                                                                                                            }
                                                                                                            d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.956 9.956 0 012.293-3.95m3.25-2.568A9.956 9.956 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.965 9.965 0 01-4.293 5.03M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                                                                                        />
                                                                                                        <path
                                                                                                            strokeLinecap="round"
                                                                                                            strokeLinejoin="round"
                                                                                                            strokeWidth={
                                                                                                                2
                                                                                                            }
                                                                                                            d="M3 3l18 18"
                                                                                                        />
                                                                                                    </svg>
                                                                                                )}
                                                                                            </button>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            )
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* ปุ่มเริ่มต้นสร้างต้นไม้ - แสดงเฉพาะเมื่อยังไม่มีต้นไม้และยังไม่ได้เลือกประเภทการปลูก */}
                                                        {history.present.plants.length === 0 &&
                                                            !history.present.plantSelectionMode
                                                                .isCompleted && (
                                                                <button
                                                                    onClick={handlePlantSelection}
                                                                    className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 hover:text-white"
                                                                >
                                                                    🌱 {t('เริ่มสร้างต้นไม้')}
                                                                </button>
                                                            )}

                                                        {/* แสดงสถานะการสร้างต้นไม้ - แสดงเฉพาะเมื่อเลือกประเภทการปลูกแล้วและยังไม่มีต้นไม้ */}
                                                        {history.present.plantSelectionMode
                                                            .isCompleted &&
                                                            history.present.plants.length === 0 && (
                                                                <div className="p-3">
                                                                    <p className="text-sm text-white">
                                                                        ✅{' '}
                                                                        {history.present
                                                                            .plantSelectionMode
                                                                            .type === 'single'
                                                                            ? t(
                                                                                  'พร้อมสร้างต้นไม้ในพื้นที่หลัก'
                                                                              )
                                                                            : t(
                                                                                  'พร้อมสร้างต้นไม้ในพื้นที่ปลูกพืช'
                                                                              )}
                                                                    </p>
                                                                    {history.present
                                                                        .plantSelectionMode.type ===
                                                                        'single' && (
                                                                        <p className="mt-1 text-xs text-white">
                                                                            🌳{' '}
                                                                            {history.present
                                                                                .selectedPlantType
                                                                                ?.name ||
                                                                                t('พืชชนิดเดียว')}
                                                                        </p>
                                                                    )}
                                                                    {history.present
                                                                        .plantSelectionMode.type ===
                                                                        'multiple' && (
                                                                        <p className="mt-1 text-xs text-white">
                                                                            🌿 {t('พืชหลายชนิด')} (
                                                                            {
                                                                                history.present
                                                                                    .plantAreas
                                                                                    .length
                                                                            }{' '}
                                                                            {t('พื้นที่')})
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            )}

                                                        {/* ปุ่มสร้างต้นไม้อัตโนมัติ - แสดงเฉพาะเมื่อเลือกประเภทการปลูกแล้วและยังไม่มีต้นไม้ */}
                                                        {history.present.plantSelectionMode
                                                            .isCompleted &&
                                                            history.present.plants.length === 0 && (
                                                                <button
                                                                    onClick={handleGeneratePlants}
                                                                    className="w-full rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 hover:text-white"
                                                                >
                                                                    🌿 {t('สร้างต้นไม้อัตโนมัติ')}
                                                                </button>
                                                            )}

                                                        {/* ปุ่มปรับมุมเอียงเมื่อมีต้นไม้แล้ว */}
                                                        {history.present.plants.length > 0 && (
                                                            <div className="space-y-2">
                                                                <button
                                                                    onClick={
                                                                        handleOpenPlantRotationControl
                                                                    }
                                                                    className="w-full rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                                                                >
                                                                    🔄 {t('ปรับมุมเอียงต้นไม้')} (
                                                                    {getCurrentRotationAngle().toFixed(
                                                                        1
                                                                    )}
                                                                    °)
                                                                </button>
                                                            </div>
                                                        )}

                                                        {/* ปุ่มปลูกใหม่เมื่อมีต้นไม้แล้ว - แสดงเฉพาะเมื่อมีต้นไม้แล้วและต้องการปลูกใหม่ */}
                                                        {history.present.plants.length > 0 && (
                                                            <div className="space-y-2">
                                                                <p className="text-center text-xs text-gray-400">
                                                                    🔄 {t('ปลูกใหม่')}
                                                                </p>
                                                                <div className="grid grid-cols-2 gap-2">
                                                                    <button
                                                                        onClick={
                                                                            handleSinglePlantSelection
                                                                        }
                                                                        className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-100"
                                                                    >
                                                                        🌳 {t('พืชเดียว')}
                                                                    </button>
                                                                    <button
                                                                        onClick={
                                                                            handleMultiplePlantsSelection
                                                                        }
                                                                        className="rounded-lg border border-green-300 bg-green-50 px-3 py-2 text-xs font-medium text-green-700 hover:bg-green-100"
                                                                    >
                                                                        🌿 {t('หลายพืช')}
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {history.present.plants.length > 0 && (
                                            <div className="rounded-lg border border-gray-200 bg-gray-900 p-4">
                                                <h4 className="mb-3 font-medium text-white">
                                                    {t('พื้นที่หลีกเลี่ยง')}
                                                </h4>

                                                <div className="space-y-2">
                                                    <select
                                                        value={selectedExclusionType}
                                                        onChange={(e) =>
                                                            setSelectedExclusionType(
                                                                e.target
                                                                    .value as keyof typeof EXCLUSION_COLORS
                                                            )
                                                        }
                                                        className="w-full rounded-lg border border-gray-300 bg-gray-900 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500"
                                                    >
                                                        <option value="building">
                                                            {t('สิ่งก่อสร้าง')}
                                                        </option>
                                                        <option value="powerplant">
                                                            {t('ห้องควบคุม')}
                                                        </option>
                                                        <option value="river">
                                                            {t('แหล่งน้ำ')}
                                                        </option>
                                                        <option value="road">{t('ถนน')}</option>
                                                        <option value="other">{t('อื่นๆ')}</option>
                                                    </select>

                                                    <button
                                                        onClick={() =>
                                                            setEditMode(
                                                                editMode === 'exclusion'
                                                                    ? null
                                                                    : 'exclusion'
                                                            )
                                                        }
                                                        className={`w-full rounded-lg border px-4 py-2 font-medium transition-colors ${
                                                            editMode === 'exclusion'
                                                                ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                                                                : 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100'
                                                        }`}
                                                    >
                                                        {editMode === 'exclusion' ? (
                                                            <>{t('❌ หยุดวาด')}</>
                                                        ) : (
                                                            <>✏️ {t('วาดพื้นที่หลีกเลี่ยง')}</>
                                                        )}
                                                    </button>
                                                </div>

                                                {history.present.exclusionAreas.length > 0 && (
                                                    <div className="mt-3 max-h-32 space-y-2 overflow-y-auto">
                                                        {history.present.exclusionAreas.map(
                                                            (area) => {
                                                                const exclusionZone =
                                                                    history.present.exclusionZones.find(
                                                                        (zone) =>
                                                                            zone.id === area.id
                                                                    );
                                                                return (
                                                                    <div
                                                                        key={area.id}
                                                                        className="rounded border bg-gray-900 p-2 text-xs"
                                                                    >
                                                                        <div className="flex items-center justify-between">
                                                                            <span className="flex items-center space-x-1 font-medium">
                                                                                <div
                                                                                    className="h-3 w-3 rounded"
                                                                                    style={{
                                                                                        backgroundColor:
                                                                                            area.color,
                                                                                    }}
                                                                                ></div>
                                                                                <span className="mb-1">
                                                                                    {area.name}
                                                                                </span>
                                                                            </span>
                                                                            <div className="flex items-center space-x-1">
                                                                                {/* ปุ่มปรับมุมเส้นวัด */}
                                                                                {exclusionZone &&
                                                                                    exclusionZone.showDimensionLines && (
                                                                                        <div className="flex items-center space-x-1">
                                                                                            <button
                                                                                                onClick={() =>
                                                                                                    setDimensionLineAngleOffset(
                                                                                                        (
                                                                                                            prev
                                                                                                        ) =>
                                                                                                            Math.max(
                                                                                                                0,
                                                                                                                prev -
                                                                                                                    0.5
                                                                                                            )
                                                                                                    )
                                                                                                }
                                                                                                className="rounded bg-gray-600 px-1 text-xs text-white hover:bg-gray-700"
                                                                                                title="ลดมุม 0.5°"
                                                                                            >
                                                                                                -
                                                                                            </button>
                                                                                            <span className="w-8 text-center text-xs text-gray-300">
                                                                                                {dimensionLineAngleOffset.toFixed(
                                                                                                    1
                                                                                                )}
                                                                                                °
                                                                                            </span>
                                                                                            <button
                                                                                                onClick={() =>
                                                                                                    setDimensionLineAngleOffset(
                                                                                                        (
                                                                                                            prev
                                                                                                        ) =>
                                                                                                            Math.min(
                                                                                                                360,
                                                                                                                prev +
                                                                                                                    0.5
                                                                                                            )
                                                                                                    )
                                                                                                }
                                                                                                className="rounded bg-gray-600 px-1 text-xs text-white hover:bg-gray-700"
                                                                                                title="เพิ่มมุม 0.5°"
                                                                                            >
                                                                                                +
                                                                                            </button>
                                                                                        </div>
                                                                                    )}

                                                                                {exclusionZone && (
                                                                                    <button
                                                                                        onClick={() =>
                                                                                            handleToggleDimensionLines(
                                                                                                area.id
                                                                                            )
                                                                                        }
                                                                                        className={`flex items-center rounded py-1 text-xs `}
                                                                                        title={
                                                                                            exclusionZone.showDimensionLines
                                                                                                ? t(
                                                                                                      'ซ่อนเส้นวัดระยะ'
                                                                                                  )
                                                                                                : t(
                                                                                                      'แสดงเส้นวัดระยะ'
                                                                                                  )
                                                                                        }
                                                                                    >
                                                                                        {exclusionZone.showDimensionLines ? (
                                                                                            // ตาเปิด (แสดง)
                                                                                            <svg
                                                                                                xmlns="http://www.w3.org/2000/svg"
                                                                                                className="h-4 w-4"
                                                                                                fill="none"
                                                                                                viewBox="0 0 24 24"
                                                                                                stroke="currentColor"
                                                                                            >
                                                                                                <path
                                                                                                    strokeLinecap="round"
                                                                                                    strokeLinejoin="round"
                                                                                                    strokeWidth={
                                                                                                        2
                                                                                                    }
                                                                                                    d="M1.5 12s4.5-7.5 10.5-7.5S22.5 12 22.5 12s-4.5 7.5-10.5 7.5S1.5 12 1.5 12z"
                                                                                                />
                                                                                                <circle
                                                                                                    cx="12"
                                                                                                    cy="12"
                                                                                                    r="3.5"
                                                                                                    stroke="currentColor"
                                                                                                    strokeWidth={
                                                                                                        2
                                                                                                    }
                                                                                                    fill="none"
                                                                                                />
                                                                                            </svg>
                                                                                        ) : (
                                                                                            // ตาปิด (ซ่อน)
                                                                                            <svg
                                                                                                xmlns="http://www.w3.org/2000/svg"
                                                                                                className="h-4 w-4"
                                                                                                fill="none"
                                                                                                viewBox="0 0 24 24"
                                                                                                stroke="currentColor"
                                                                                            >
                                                                                                <path
                                                                                                    strokeLinecap="round"
                                                                                                    strokeLinejoin="round"
                                                                                                    strokeWidth={
                                                                                                        2
                                                                                                    }
                                                                                                    d="M17.94 17.94A10.06 10.06 0 0112 19.5c-6 0-10.5-7.5-10.5-7.5a21.6 21.6 0 014.06-5.94M6.12 6.12A10.06 10.06 0 0112 4.5c6 0 10.5 7.5 10.5 7.5a21.6 21.6 0 01-4.06 5.94M1.5 1.5l21 21"
                                                                                                />
                                                                                            </svg>
                                                                                        )}
                                                                                    </button>
                                                                                )}

                                                                                <button
                                                                                    onClick={() =>
                                                                                        handleDeleteExclusion(
                                                                                            area.id
                                                                                        )
                                                                                    }
                                                                                    className="text-red-400 hover:text-red-600"
                                                                                    title={t('ลบ')}
                                                                                >
                                                                                    <FaTrash className="h-3 w-3" />
                                                                                </button>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                );
                                                            }
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        <div className="space-y-4">
                                            {actualTotalPlants > 0 && (
                                                <div className="rounded-lg border border-green-200 bg-gray-900 p-4">
                                                    <div className="mb-2 flex items-center justify-between">
                                                        <h4 className="font-medium text-green-500">
                                                            {t('สถิติพืช')}
                                                        </h4>
                                                        <button
                                                            onClick={() =>
                                                                setShowSprinklerConfigModal(true)
                                                            }
                                                            className="rounded bg-blue-600 px-2 py-1 text-xs text-white transition-colors hover:bg-blue-500"
                                                            title={t('เปลี่ยนการตั้งค่าหัวฉีด')}
                                                        >
                                                            <FaCog className="mr-1 inline h-3 w-3" />
                                                            {t('ตั้งค่าหัวฉีด')}
                                                        </button>
                                                    </div>
                                                    <div className="space-y-1 text-sm">
                                                        <div className="flex justify-between">
                                                            <span className="text-green-500">
                                                                {t('จำนวนต้น')}:
                                                            </span>
                                                            <span className="font-bold text-green-500">
                                                                {actualTotalPlants} {t('ต้น')}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-green-500">
                                                                {t('ต้องการน้ำรวม')}:
                                                            </span>
                                                            <span className="font-bold text-blue-500">
                                                                {formatWaterVolume(
                                                                    actualTotalWaterNeed,
                                                                    t
                                                                )}
                                                            </span>
                                                        </div>

                                                        {/* ข้อมูลหัวฉีดน้ำ */}
                                                        {(() => {
                                                            const sprinklerConfig =
                                                                loadSprinklerConfig();
                                                            if (
                                                                sprinklerConfig &&
                                                                actualTotalPlants > 0
                                                            ) {
                                                                const totalFlowRatePerMinute =
                                                                    calculateTotalFlowRate(
                                                                        actualTotalPlants,
                                                                        sprinklerConfig.flowRatePerMinute
                                                                    );
                                                                const totalFlowRatePerHour =
                                                                    totalFlowRatePerMinute * 60;

                                                                return (
                                                                    <>
                                                                        <div className="mt-2 border-t border-green-600 pt-2">
                                                                            <div className="flex justify-between">
                                                                                <span className="text-yellow-400">
                                                                                    {t(
                                                                                        'Q รวมต่อนาที'
                                                                                    )}
                                                                                    :
                                                                                </span>
                                                                                <span className="font-bold text-yellow-400">
                                                                                    {formatFlowRate(
                                                                                        totalFlowRatePerMinute
                                                                                    )}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex justify-between">
                                                                                <span className="text-yellow-400">
                                                                                    {t(
                                                                                        'Q รวมต่อชั่วโมง'
                                                                                    )}
                                                                                    :
                                                                                </span>
                                                                                <span className="font-bold text-yellow-400">
                                                                                    {formatFlowRatePerHour(
                                                                                        totalFlowRatePerHour
                                                                                    )}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex justify-between">
                                                                                <span className="text-cyan-400">
                                                                                    {t('Q หัวฉีด')}:
                                                                                </span>
                                                                                <span className="font-bold text-cyan-400">
                                                                                    {sprinklerConfig.flowRatePerMinute.toFixed(
                                                                                        1
                                                                                    )}{' '}
                                                                                    {t('ลิตร/นาที')}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex justify-between">
                                                                                <span className="text-orange-400">
                                                                                    {t(
                                                                                        'แรงดันหัวฉีด'
                                                                                    )}
                                                                                    :
                                                                                </span>
                                                                                <span className="font-bold text-orange-400">
                                                                                    {formatPressure(
                                                                                        sprinklerConfig.pressureBar
                                                                                    )}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex justify-between">
                                                                                <span className="text-purple-400">
                                                                                    {t(
                                                                                        'รัศมีหัวฉีด'
                                                                                    )}
                                                                                    :
                                                                                </span>
                                                                                <span className="font-bold text-purple-400">
                                                                                    {formatRadius(
                                                                                        sprinklerConfig.radiusMeters
                                                                                    )}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    </>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                    </div>
                                                </div>
                                            )}

                                            {/* ส่วนโซนให้น้ำอัจฉริยะ */}
                                            {history.present.plants.length > 0 && (
                                                <div className="mt-4 rounded-lg border border-purple-200 bg-gray-900 p-4">
                                                    <div className="flex flex-row justify-between">
                                                        <h5 className="font-medium text-white">
                                                            💧 {t('แบ่งโซนให้น้ำ')}
                                                        </h5>
                                                        {history.present.irrigationZones.length >
                                                            0 && (
                                                            <p className="text-sm text-green-500">
                                                                {t('สร้างแล้ว')}{' '}
                                                                {
                                                                    history.present.irrigationZones
                                                                        .length
                                                                }{' '}
                                                                {t('โซน')}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {history.present.irrigationZones.length === 0 &&
                                                    manualZones.length === 0 ? (
                                                        <div className="space-y-2">
                                                            <button
                                                                onClick={() =>
                                                                    setShowAutoZoneModal(true)
                                                                }
                                                                className="mt-2 w-full rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                                                            >
                                                                🤖 {t('แบ่งโซนอัตโนมัติ')}
                                                            </button>
                                                            <button
                                                                onClick={() =>
                                                                    setShowManualIrrigationZoneModal(
                                                                        true
                                                                    )
                                                                }
                                                                className="w-full rounded-lg border border-purple-300 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100"
                                                            >
                                                                💧 {t('แบ่งโซนด้วยตัวเอง')}
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {manualZones.length > 0 && (
                                                                <div className="rounded-lg bg-blue-50 p-3">
                                                                    <p className="text-sm text-blue-800">
                                                                        ✏️ {t('กำลังวางโซน')}{' '}
                                                                        {currentManualZoneIndex + 1}{' '}
                                                                        / {numberOfManualZones}
                                                                    </p>
                                                                    <div className="mt-2 space-y-1">
                                                                        {manualZones.map((zone) => {
                                                                            const plantSummary: Record<
                                                                                string,
                                                                                {
                                                                                    count: number;
                                                                                    totalWater: number;
                                                                                }
                                                                            > = {};
                                                                            let totalPlantCount = 0;
                                                                            let totalWaterNeed = 0;
                                                                            zone.plants.forEach(
                                                                                (plant) => {
                                                                                    const name =
                                                                                        plant
                                                                                            .plantData
                                                                                            .name;
                                                                                    const waterNeed =
                                                                                        Number(
                                                                                            plant
                                                                                                .plantData
                                                                                                .waterNeed
                                                                                        ) || 0;
                                                                                    if (
                                                                                        !plantSummary[
                                                                                            name
                                                                                        ]
                                                                                    ) {
                                                                                        plantSummary[
                                                                                            name
                                                                                        ] = {
                                                                                            count: 0,
                                                                                            totalWater: 0,
                                                                                        };
                                                                                    }
                                                                                    plantSummary[
                                                                                        name
                                                                                    ].count += 1;
                                                                                    plantSummary[
                                                                                        name
                                                                                    ].totalWater +=
                                                                                        waterNeed;
                                                                                    totalPlantCount += 1;
                                                                                    totalWaterNeed +=
                                                                                        waterNeed;
                                                                                }
                                                                            );
                                                                            const plantNames =
                                                                                Object.keys(
                                                                                    plantSummary
                                                                                );

                                                                            return (
                                                                                <div
                                                                                    key={zone.id}
                                                                                    className="mb-2 flex flex-col text-xs"
                                                                                >
                                                                                    <div className="mb-1 flex items-center justify-between space-x-2 rounded-lg bg-gray-100 py-1">
                                                                                        <div className="flex items-center space-x-2">
                                                                                            <div
                                                                                                className="h-3 w-3 rounded"
                                                                                                style={{
                                                                                                    backgroundColor:
                                                                                                        zone.color,
                                                                                                }}
                                                                                            ></div>
                                                                                            <span className="font-semibold text-blue-700">
                                                                                                {
                                                                                                    zone.name
                                                                                                }
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="flex flex-row items-center space-x-3">
                                                                                            <span className="font-semibold text-blue-800">
                                                                                                {(() => {
                                                                                                    const config =
                                                                                                        loadSprinklerConfig();
                                                                                                    return formatWaterVolumeWithFlowRate(
                                                                                                        totalWaterNeed,
                                                                                                        totalPlantCount,
                                                                                                        config,
                                                                                                        t
                                                                                                    );
                                                                                                })()}
                                                                                            </span>
                                                                                        </div>
                                                                                    </div>
                                                                                    <div className="ml-5 flex flex-col space-y-1">
                                                                                        {plantNames.length ===
                                                                                        0 ? (
                                                                                            <span className="text-gray-400">
                                                                                                -
                                                                                                ไม่มีพืชในโซนนี้
                                                                                                -
                                                                                            </span>
                                                                                        ) : (
                                                                                            plantNames.map(
                                                                                                (
                                                                                                    name,
                                                                                                    index
                                                                                                ) => (
                                                                                                    <span
                                                                                                        key={
                                                                                                            name
                                                                                                        }
                                                                                                        className="flex flex-row justify-between text-blue-900"
                                                                                                    >
                                                                                                        <p>
                                                                                                            {index +
                                                                                                                1}

                                                                                                            .{' '}
                                                                                                            {
                                                                                                                name
                                                                                                            }{' '}
                                                                                                            {plantSummary[
                                                                                                                name
                                                                                                            ].count.toLocaleString()}{' '}
                                                                                                            {t(
                                                                                                                'ต้น'
                                                                                                            )}{' '}
                                                                                                        </p>
                                                                                                        <p>
                                                                                                            {(() => {
                                                                                                                const config =
                                                                                                                    loadSprinklerConfig();
                                                                                                                return formatWaterVolumeWithFlowRate(
                                                                                                                    plantSummary[
                                                                                                                        name
                                                                                                                    ]
                                                                                                                        .totalWater,
                                                                                                                    plantSummary[
                                                                                                                        name
                                                                                                                    ]
                                                                                                                        .count,
                                                                                                                    config,
                                                                                                                    t
                                                                                                                );
                                                                                                            })()}
                                                                                                        </p>
                                                                                                    </span>
                                                                                                )
                                                                                            )
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            )}

                                                            {((manualZones.length ===
                                                                numberOfManualZones &&
                                                                numberOfManualZones > 0) ||
                                                                (manualZones.length === 0 &&
                                                                    history.present.irrigationZones
                                                                        .length > 0)) && (
                                                                <div className="space-y-2">
                                                                    {manualZones.length === 0 &&
                                                                        history.present
                                                                            .irrigationZones
                                                                            .length > 0 &&
                                                                        numberOfManualZones === 0 &&
                                                                        !isDrawingManualZone && (
                                                                            <button
                                                                                onClick={
                                                                                    handleRegenerateIrrigationZones
                                                                                }
                                                                                className="w-full rounded-lg border border-purple-300 bg-purple-500 px-4 py-2 text-sm font-medium text-white hover:bg-purple-600"
                                                                            >
                                                                                🔄{' '}
                                                                                {t(
                                                                                    'เปลี่ยนรูปแบบโซน'
                                                                                )}
                                                                            </button>
                                                                        )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    )}

                                                    {history.present.irrigationZones.length > 0 && (
                                                        <>
                                                            <div className="mt-3 max-h-32 space-y-2 overflow-y-auto">
                                                                {history.present.irrigationZones.map(
                                                                    (zone) => (
                                                                        <div
                                                                            key={zone.id}
                                                                            className="rounded border bg-gray-900 p-2 text-xs"
                                                                        >
                                                                            <div className="flex items-center justify-between">
                                                                                <div className="flex items-center space-x-2">
                                                                                    <div
                                                                                        className="h-3 w-3 rounded"
                                                                                        style={{
                                                                                            backgroundColor:
                                                                                                zone.color,
                                                                                        }}
                                                                                    ></div>
                                                                                    <span className="font-medium text-white">
                                                                                        {zone.name}
                                                                                    </span>
                                                                                </div>
                                                                                <span className="text-xs text-green-400">
                                                                                    {
                                                                                        zone.plants
                                                                                            .length
                                                                                    }{' '}
                                                                                    {t('ต้น')}
                                                                                </span>
                                                                            </div>
                                                                            <div className="mt-1 flex flex-row justify-between text-xs text-gray-400">
                                                                                <span className="text-xs text-gray-400">
                                                                                    {
                                                                                        zone.totalWaterNeed
                                                                                    }{' '}
                                                                                    {t(
                                                                                        'ลิตร/ครั้ง'
                                                                                    )}
                                                                                </span>
                                                                                <span className="text-xs text-blue-400">
                                                                                    {/* ERROR: totalFlowRatePerMinute is not defined in this scope. */}
                                                                                    {/* To debug, calculate per-zone flow rate using sprinklerConfig if available */}
                                                                                    {(() => {
                                                                                        const sprinklerConfig =
                                                                                            loadSprinklerConfig?.();
                                                                                        if (
                                                                                            sprinklerConfig &&
                                                                                            typeof sprinklerConfig.flowRatePerMinute ===
                                                                                                'number'
                                                                                        ) {
                                                                                            const zoneFlowRate =
                                                                                                zone
                                                                                                    .plants
                                                                                                    .length *
                                                                                                sprinklerConfig.flowRatePerMinute;
                                                                                            return (
                                                                                                <>
                                                                                                    {
                                                                                                        zoneFlowRate
                                                                                                    }{' '}
                                                                                                    {t(
                                                                                                        'ลิตร/นาที'
                                                                                                    )}
                                                                                                </>
                                                                                            );
                                                                                        }
                                                                                        return null;
                                                                                    })()}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    )
                                                                )}
                                                            </div>

                                                            {/* เพิ่มปุ่มสำหรับจัดการโซนเมื่อมีโซนแล้ว */}
                                                            <div className="mt-3 space-y-2">
                                                                <button
                                                                    onClick={() => {
                                                                        setShowManualIrrigationZoneModal(
                                                                            true
                                                                        );
                                                                    }}
                                                                    className="w-full rounded-lg border border-purple-300 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100"
                                                                >
                                                                    💧 {t('แบ่งโซนด้วยตัวเองใหม่')}
                                                                </button>
                                                                {/* ปุ่มแก้ไขโซน - เพิ่มใหม่ */}
                                                                <button
                                                                    onClick={
                                                                        handleToggleZoneEditMode
                                                                    }
                                                                    disabled={
                                                                        !history.present
                                                                            .irrigationZones ||
                                                                        history.present
                                                                            .irrigationZones
                                                                            .length === 0
                                                                    }
                                                                    className={`
                                                                        w-full rounded-lg border px-4 py-2 text-sm font-medium 
                                                                        transition-all duration-200 ease-in-out
                                                                        ${
                                                                            history.present
                                                                                .irrigationZones &&
                                                                            history.present
                                                                                .irrigationZones
                                                                                .length > 0
                                                                                ? isZoneEditMode
                                                                                    ? 'border-red-400 bg-red-50 text-red-700 hover:bg-red-100 hover:shadow-sm active:scale-95'
                                                                                    : 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100 hover:shadow-sm active:scale-95'
                                                                                : 'cursor-not-allowed border-gray-200 bg-gray-100 text-gray-400'
                                                                        }
                                                                    `}
                                                                    title={
                                                                        history.present
                                                                            .irrigationZones &&
                                                                        history.present
                                                                            .irrigationZones
                                                                            .length > 0
                                                                            ? isZoneEditMode
                                                                                ? t(
                                                                                      'คลิกเพื่อออกจากโหมดแก้ไขโซน'
                                                                                  )
                                                                                : t(
                                                                                      'คลิกเพื่อแก้ไขโซนอัตโนมัติ'
                                                                                  )
                                                                            : t(
                                                                                  'ต้องมีโซนก่อนจึงจะแก้ไขได้'
                                                                              )
                                                                    }
                                                                >
                                                                    {isZoneEditMode ? '❌ ' : '✏️ '}
                                                                    {isZoneEditMode
                                                                        ? t('ออกจากการแก้ไข')
                                                                        : t('แก้ไขโซน')}
                                                                </button>
                                                                <button
                                                                    onClick={() =>
                                                                        setShowAutoZoneModal(true)
                                                                    }
                                                                    className="w-full rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
                                                                >
                                                                    🔄 {t('เปลี่ยนแบบโซนอัตโนมัติ')}
                                                                </button>
                                                                <button
                                                                    onClick={() => {
                                                                        if (
                                                                            confirm(
                                                                                t(
                                                                                    'คุณต้องการลบโซนทั้งหมดและสร้างใหม่หรือไม่?'
                                                                                )
                                                                            )
                                                                        ) {
                                                                            pushToHistory({
                                                                                irrigationZones: [],
                                                                            });
                                                                        }
                                                                    }}
                                                                    className="w-full rounded-lg border border-red-300 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-100"
                                                                >
                                                                    🗑️ {t('ลบโซนทั้งหมด')}
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'water' && (
                                <div className="p-4">
                                    <h3 className="mb-4 flex items-center font-semibold text-white">
                                        💧 {t('ระบบน้ำ')}
                                    </h3>

                                    <div className="space-y-4">
                                        <div className="rounded-lg border border-gray-200 bg-gray-900 p-4">
                                            <h4 className="mb-3 font-medium text-white">
                                                {t('ปั๊มน้ำ')}
                                            </h4>

                                            <button
                                                onClick={() =>
                                                    setEditMode(editMode === 'pump' ? null : 'pump')
                                                }
                                                className={`w-full rounded-lg border px-4 py-3 font-medium transition-colors ${
                                                    editMode === 'pump'
                                                        ? 'border-red-300 bg-red-300 text-red-900 hover:bg-red-100'
                                                        : 'border-blue-300 bg-blue-300 text-blue-900 hover:bg-blue-100'
                                                }`}
                                            >
                                                {history.present.pump ? (
                                                    editMode === 'pump' ? (
                                                        <>{t('❌ หยุดวางปั๊ม')}</>
                                                    ) : (
                                                        <>
                                                            <img
                                                                src="/images/water-pump.png"
                                                                alt="Water Pump"
                                                                className="mr-1 inline h-4 w-4 object-contain"
                                                            />
                                                            {t('เปลี่ยนตำแหน่งปั๊ม')}
                                                        </>
                                                    )
                                                ) : editMode === 'pump' ? (
                                                    <>{t('❌ หยุดวางปั๊ม')}</>
                                                ) : (
                                                    <>
                                                        <img
                                                            src="/images/water-pump.png"
                                                            alt="Water Pump"
                                                            className="mr-1 inline h-4 w-4 object-contain"
                                                        />
                                                        {t('วางปั๊มน้ำ')}
                                                    </>
                                                )}
                                            </button>

                                            {history.present.pump && (
                                                <div className="mt-3 rounded-lg border border-blue-200 bg-gray-900 p-3">
                                                    <div className="flex items-center justify-between text-sm text-blue-700">
                                                        <div className="flex items-center">
                                                            <span className="mr-1">✅</span>
                                                            <span className="font-medium">
                                                                {t('ปั๊มพร้อมใช้งาน')}
                                                            </span>
                                                        </div>
                                                        <button
                                                            onClick={handleDeletePump}
                                                            className="flex items-center text-red-400 transition-colors hover:text-red-300"
                                                            title={t('ลบปั๊มน้ำ')}
                                                        >
                                                            <FaTrash className="h-4 w-4" />
                                                        </button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        <div className="rounded-lg border border-gray-200 bg-gray-900 p-4">
                                            <h4 className="mb-3 font-medium text-white">
                                                {t('ท่อน้ำ')}
                                            </h4>

                                            <div className="space-y-2">
                                                <button
                                                    onClick={() =>
                                                        setEditMode(
                                                            editMode === 'mainPipe'
                                                                ? null
                                                                : 'mainPipe'
                                                        )
                                                    }
                                                    disabled={
                                                        !history.present.pump ||
                                                        (history.present.useZones &&
                                                            history.present.irrigationZones
                                                                .length === 0)
                                                    }
                                                    className={`w-full rounded-lg border px-4 py-3 font-medium transition-colors ${
                                                        !history.present.pump ||
                                                        (history.present.useZones &&
                                                            history.present.irrigationZones
                                                                .length === 0)
                                                            ? 'cursor-not-allowed border-red-300 bg-red-300 text-red-700'
                                                            : editMode === 'mainPipe'
                                                              ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                                                              : 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                                                    }`}
                                                >
                                                    {editMode === 'mainPipe' ? (
                                                        <>❌ {t('หยุดวางท่อเมน')}</>
                                                    ) : (
                                                        <>🔧 {t('วางท่อเมน')}</>
                                                    )}
                                                </button>

                                                <button
                                                    onClick={() =>
                                                        setEditMode(
                                                            editMode === 'subMainPipe'
                                                                ? null
                                                                : 'subMainPipe'
                                                        )
                                                    }
                                                    disabled={
                                                        !history.present.pump ||
                                                        (history.present.useZones &&
                                                            history.present.irrigationZones
                                                                .length === 0) ||
                                                        (!history.present.useZones &&
                                                            history.present.mainArea.length === 0)
                                                    }
                                                    className={`w-full rounded-lg border px-4 py-3 font-medium transition-colors ${
                                                        !history.present.pump ||
                                                        (history.present.useZones &&
                                                            history.present.irrigationZones
                                                                .length === 0) ||
                                                        (!history.present.useZones &&
                                                            history.present.mainArea.length === 0)
                                                            ? 'cursor-not-allowed border-purple-300 bg-purple-300 text-purple-900'
                                                            : editMode === 'subMainPipe'
                                                              ? 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100'
                                                              : 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100'
                                                    }`}
                                                >
                                                    {editMode === 'subMainPipe' ? (
                                                        <>❌ {t('หยุดวางท่อเมนรอง')}</>
                                                    ) : (
                                                        <>🔧 {t('วางท่อเมนรอง')}</>
                                                    )}
                                                </button>
                                                <div className="grid grid-cols-2 gap-2">
                                                    <button
                                                        onClick={handleStartLateralPipeDrawing}
                                                        disabled={
                                                            history.present.subMainPipes.length ===
                                                            0
                                                        }
                                                        className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
                                                            history.present.subMainPipes.length ===
                                                            0
                                                                ? 'cursor-not-allowed border-yellow-300 bg-yellow-300 text-yellow-700'
                                                                : 'border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                                                        }`}
                                                    >
                                                        🔧 {t('วางท่อย่อย')}
                                                    </button>
                                                    <button
                                                        onClick={handleStartAutoLateralPipeDrawing}
                                                        disabled={
                                                            history.present.subMainPipes.length ===
                                                                0 ||
                                                            history.present.irrigationZones
                                                                .length === 0
                                                        }
                                                        className={`rounded-lg border-2 px-3 py-2 text-sm font-medium transition-colors ${
                                                            history.present.subMainPipes.length ===
                                                                0 ||
                                                            history.present.irrigationZones
                                                                .length === 0
                                                                ? 'cursor-not-allowed border-orange-300 bg-orange-300 text-orange-700'
                                                                : 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100'
                                                        }`}
                                                        title={
                                                            t('ลากท่อย่อยอัตโนมัติตามแนวต้นไม้') ||
                                                            'ลากท่อย่อยอัตโนมัติตามแนวต้นไม้'
                                                        }
                                                    >
                                                        🤖 {t('ลากอัตโนมัติ')}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* ปุ่มลบท่อ */}
                                            <div className="mt-3">
                                                <button
                                                    onClick={() => {
                                                        if (isDeleteMode) {
                                                            handleCancelDeleteMode();
                                                        } else {
                                                            setIsDeleteMode(true);
                                                            setDeletedPipeCount(0); // รีเซ็ตตัวนับ
                                                        }
                                                    }}
                                                    disabled={
                                                        history.present.mainPipes.length === 0 &&
                                                        history.present.subMainPipes.length === 0 &&
                                                        history.present.lateralPipes.length === 0
                                                    }
                                                    className={`w-full rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${
                                                        isDeleteMode
                                                            ? 'border-red-300 bg-red-100 text-red-800 hover:bg-red-200'
                                                            : 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                                                    }`}
                                                >
                                                    {isDeleteMode ? '❌ ' : '🗑️ '}
                                                    {t('ลบท่อ')}
                                                </button>
                                            </div>

                                            {!history.present.pump && (
                                                <div className="mt-3 rounded-lg border border-amber-200 bg-gray-900 p-3 text-sm text-white">
                                                    ⚠️ {t('ต้องวางปั๊มก่อนจึงจะสร้างท่อได้')}
                                                </div>
                                            )}

                                            {(history.present.mainPipes.length > 0 ||
                                                history.present.subMainPipes.length > 0) && (
                                                <div className="mt-3 rounded-lg border bg-gray-900 p-3">
                                                    <div className="text-sm text-white">
                                                        <div className="flex justify-between">
                                                            <span>{t('ท่อเมน')}:</span>
                                                            <span className="font-medium">
                                                                {history.present.mainPipes.length}{' '}
                                                                {t('เส้น')}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>{t('ท่อเมนรอง')}:</span>
                                                            <span className="font-medium">
                                                                {
                                                                    history.present.subMainPipes
                                                                        .length
                                                                }{' '}
                                                                {t('เส้น')}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>{t('ท่อย่อย')}:</span>
                                                            <span className="font-medium">
                                                                {history.present.subMainPipes.reduce(
                                                                    (sum, sm) =>
                                                                        sum + sm.branchPipes.length,
                                                                    0
                                                                ) +
                                                                    history.present.lateralPipes
                                                                        .length}{' '}
                                                                {t('เส้น')}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>{t('ท่อย่อยใหม่')}:</span>
                                                            <span className="font-medium">
                                                                {
                                                                    history.present.lateralPipes
                                                                        .length
                                                                }{' '}
                                                                {t('เส้น')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'summary' && (
                                <div className="p-4">
                                    <h3 className="mb-4 flex items-center font-semibold text-white">
                                        <span className="mr-2">📊</span>
                                        {t('สรุปโครงการ')}
                                    </h3>

                                    <div className="mb-4 rounded-lg border border-gray-100 bg-gray-900 p-4">
                                        <div className="space-y-3">
                                            <div>
                                                <label className="mb-1 block text-sm font-medium text-white">
                                                    {t('ชื่อโครงการ')}:
                                                </label>
                                                <input
                                                    type="text"
                                                    value={projectName}
                                                    onChange={(e) => setProjectName(e.target.value)}
                                                    className="w-full rounded-lg border border-gray-300 bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    disabled={history.present.isEditModeEnabled}
                                                    placeholder={t('ชื่อโครงการ')}
                                                />
                                            </div>
                                            <div>
                                                <label className="mb-1 block text-sm font-medium text-white">
                                                    {t('ชื่อลูกค้า')}
                                                </label>
                                                <input
                                                    type="text"
                                                    value={customerName}
                                                    onChange={(e) =>
                                                        setCustomerName(e.target.value)
                                                    }
                                                    placeholder={t('ชื่อ - นามสกุล')}
                                                    className="w-full rounded-lg border border-gray-300 bg-gray-900 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    disabled={history.present.isEditModeEnabled}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <div className="rounded-lg border border-gray-200 bg-gray-900 p-4">
                                            <h4 className="mb-3 font-medium text-white">
                                                {t('ข้อมูลโครงการ')}
                                            </h4>

                                            <div className="space-y-2 text-sm">
                                                <div className="flex justify-between">
                                                    <span className="text-white">
                                                        {t('พื้นที่รวม')}:
                                                    </span>
                                                    <span className="font-medium">
                                                        {formatArea(totalArea, t)}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-white">
                                                        {t('จำนวนโซน')}:
                                                    </span>
                                                    <span className="font-medium">
                                                        {history.present.irrigationZones.length > 0
                                                            ? history.present.irrigationZones.length
                                                            : 1}{' '}
                                                        {t('โซน')}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-white">
                                                        {t('จำนวนต้นไม้')}:
                                                    </span>
                                                    <span className="font-medium text-green-600">
                                                        {actualTotalPlants} {t('ต้น')}
                                                    </span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-white">
                                                        {t('น้ำต่อครั้ง')}:
                                                    </span>
                                                    <span className="font-medium text-blue-600">
                                                        {formatWaterVolume(actualTotalWaterNeed, t)}
                                                    </span>
                                                </div>

                                                {/* ข้อมูลหัวฉีดใน summary */}
                                                {(() => {
                                                    const sprinklerConfig = loadSprinklerConfig();
                                                    if (sprinklerConfig && actualTotalPlants > 0) {
                                                        const totalFlowRatePerMinute =
                                                            calculateTotalFlowRate(
                                                                actualTotalPlants,
                                                                sprinklerConfig.flowRatePerMinute
                                                            );
                                                        return (
                                                            <div className="flex justify-between">
                                                                <span className="text-white">
                                                                    🚿 {t('Q รวมต่อนาที')}:
                                                                </span>
                                                                <span className="font-medium text-yellow-600">
                                                                    {formatFlowRate(
                                                                        totalFlowRatePerMinute
                                                                    )}
                                                                </span>
                                                            </div>
                                                        );
                                                    }
                                                    return null;
                                                })()}

                                                <div className="flex justify-between">
                                                    <span className="text-white">
                                                        {t('สถานะปั๊ม')}:
                                                    </span>
                                                    <span
                                                        className={`font-medium ${history.present.pump ? 'text-green-600' : 'text-red-600'}`}
                                                    >
                                                        {history.present.pump
                                                            ? t('พร้อมใช้งาน')
                                                            : t('ยังไม่ได้วาง')}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        {history.present.isEditModeEnabled && (
                                            <div className="rounded-lg border border-yellow-200 bg-gray-900 p-4">
                                                <h4 className="mb-3 font-medium text-white">
                                                    📈 {t('สถิติการแก้ไข')}
                                                </h4>
                                                <div className="space-y-2 text-sm">
                                                    <div className="flex justify-between">
                                                        <span className="text-white">
                                                            {t('รายการที่เลือก')}:
                                                        </span>
                                                        <span className="font-medium text-yellow-600">
                                                            {selectedItemsCount} {t('รายการ')}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-white">
                                                            {t('โหมดการเลือก')}:
                                                        </span>
                                                        <span className="font-medium">
                                                            {history.present.editModeSettings
                                                                .selectionMode === 'single' &&
                                                                t('เลือกทีละตัว')}
                                                            {history.present.editModeSettings
                                                                .selectionMode === 'multi' &&
                                                                t('เลือกหลายตัว')}
                                                            {history.present.editModeSettings
                                                                .selectionMode === 'rectangle' &&
                                                                t('เลือกโดยพื้นที่')}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-white">
                                                            {t('ประวัติการแก้ไข')}:
                                                        </span>
                                                        <span className="font-medium text-blue-600">
                                                            {history.past.length} {t('ขั้นตอน')}
                                                        </span>
                                                    </div>
                                                    <div className="flex justify-between">
                                                        <span className="text-white">
                                                            {t('การลากวัตถุ')}:
                                                        </span>
                                                        <span
                                                            className={`font-medium ${isDragging ? 'text-orange-400' : 'text-gray-400'}`}
                                                        >
                                                            {isDragging
                                                                ? t('กำลังลาง')
                                                                : t('พร้อม')}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    <button
                        onClick={handleSaveDraft}
                        disabled={!canSaveDraft}
                        className={`flex items-center justify-center space-x-2 px-4 py-2 font-medium transition-colors ${
                            canSaveDraft
                                ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                                : 'cursor-not-allowed bg-gray-300 text-gray-500'
                        }`}
                    >
                        {!isCompactMode ? (
                            <div className="flex items-center space-x-2">
                                <FaSave />
                                <span>{t('บันทึกร่าง')}</span>
                            </div>
                        ) : (
                            <FaSave />
                        )}
                    </button>
                    <button
                        onClick={handleSaveProject}
                        disabled={!canSaveProject}
                        className={`flex items-center justify-center space-x-2 px-4 py-2 font-medium transition-colors ${
                            canSaveProject
                                ? 'bg-green-600 text-white hover:bg-green-700'
                                : 'cursor-not-allowed bg-gray-300 text-gray-500'
                        }`}
                    >
                        {!isCompactMode ? (
                            <div className="flex items-center space-x-2">
                                <FaSave />
                                <span>{t('บันทึกโครงการ')}</span>
                            </div>
                        ) : (
                            <FaSave />
                        )}
                    </button>
                </div>

                <div className="relative flex-1 bg-gray-900">
                    <div className="h-full w-full">
                        <HorticultureMapComponent
                            center={mapCenter}
                            zoom={mapRef.current ? mapRef.current.getZoom() || 16 : 16}
                            onMapLoad={handleMapLoad}
                        >
                            <EnhancedHorticultureSearchControl
                                onPlaceSelect={handleSearch}
                                placeholder="🔍 ค้นหาสถานที่..."
                            />

                            <HorticultureDrawingManager
                                map={mapRef.current || undefined}
                                editMode={
                                    history.present.lateralPipeDrawing.isActive
                                        ? 'lateralPipe'
                                        : editMode
                                }
                                onCreated={
                                    editMode === 'manualZone'
                                        ? handleManualZoneDrawingComplete
                                        : handleDrawingComplete
                                }
                                fillColor={
                                    editMode === 'zone'
                                        ? getZoneColor(history.present.irrigationZones.length)
                                        : editMode === 'exclusion'
                                          ? EXCLUSION_COLORS[selectedExclusionType]
                                          : editMode === 'plantArea'
                                            ? '#8B5CF6'
                                            : editMode === 'manualZone'
                                              ? '#3B82F6'
                                              : undefined
                                }
                                strokeColor={
                                    editMode === 'zone'
                                        ? getZoneColor(history.present.irrigationZones.length)
                                        : editMode === 'exclusion'
                                          ? EXCLUSION_COLORS[selectedExclusionType]
                                          : editMode === 'plantArea'
                                            ? '#8B5CF6'
                                            : editMode === 'manualZone'
                                              ? '#3B82F6'
                                              : undefined
                                }
                                isEditModeEnabled={
                                    history.present.isEditModeEnabled || editMode === 'manualZone'
                                }
                                mainArea={history.present.mainArea}
                                pump={history.present.pump?.position || null}
                                mainPipes={history.present.mainPipes}
                                subMainPipes={history.present.subMainPipes}
                                onMainPipesUpdate={(updatedMainPipes) => {
                                    pushToHistory({ mainPipes: updatedMainPipes as any });
                                }}
                                enableCurvedDrawing={true}
                                t={t}
                                onMainPipeClick={handleMainPipeClick}
                                onLateralPipeClick={handleLateralPipeClick}
                                onLateralPipeMouseMove={handleLateralPipeMouseMove}
                            />

                            <CurvedPipeEditor
                                map={mapRef.current || undefined}
                                pipes={[
                                    ...history.present.mainPipes.map((pipe) => ({
                                        id: pipe.id,
                                        coordinates: pipe.coordinates,
                                        type: 'mainPipe' as const,
                                        anchorPoints:
                                            pipe.coordinates.length >= 3
                                                ? [
                                                      pipe.coordinates[0], // จุดเริ่ม
                                                      pipe.coordinates[
                                                          Math.floor(pipe.coordinates.length / 2)
                                                      ], // จุดกลาง
                                                      pipe.coordinates[pipe.coordinates.length - 1], // จุดสิ้นสุด
                                                  ]
                                                : pipe.coordinates,
                                        isEditing:
                                            history.present.curvedPipeEditing.editingPipes.has(
                                                pipe.id
                                            ),
                                    })),
                                    ...history.present.subMainPipes.map((pipe) => ({
                                        id: pipe.id,
                                        coordinates: pipe.coordinates,
                                        type: 'subMainPipe' as const,
                                        anchorPoints:
                                            pipe.coordinates.length >= 3
                                                ? [
                                                      pipe.coordinates[0], // จุดเริ่ม
                                                      pipe.coordinates[
                                                          Math.floor(pipe.coordinates.length / 2)
                                                      ], // จุดกลาง
                                                      pipe.coordinates[pipe.coordinates.length - 1], // จุดสิ้นสุด
                                                  ]
                                                : pipe.coordinates,
                                        isEditing:
                                            history.present.curvedPipeEditing.editingPipes.has(
                                                pipe.id
                                            ),
                                    })),
                                ]}
                                onPipeUpdate={handleCurvedPipeUpdate}
                                onEditingChange={handleCurvedPipeEditingChange}
                                editMode={history.present.curvedPipeEditing.isEnabled}
                                strokeColor="#2563eb"
                                strokeWeight={2}
                            />

                            {(() => {
                                return null;
                            })()}
                            <EnhancedGoogleMapsOverlays
                                key={`overlays-${history.present.mainArea.length}-${history.present.exclusionAreas.length}-${history.present.zones.length}`}
                                map={mapRef.current}
                                data={history.present}
                                currentDrawnZone={currentDrawnZone}
                                showSprinklerRadius={showSprinklerRadius}
                                manualZones={manualZones}
                                onMapClick={handleMapClick}
                                isZoneEditMode={isZoneEditMode}
                                selectedZoneForEdit={selectedZoneForEdit}
                                zoneControlPoints={zoneControlPoints}
                                onZoneSelect={handleZoneSelect}
                                onManualZoneSelect={handleManualZoneSelect}
                                onZoneUpdate={handleUpdateZone}
                                setDraggedControlPointIndex={setDraggedControlPointIndex}
                                setZoneControlPoints={setZoneControlPoints}
                                generateZoneControlPoints={generateZoneControlPoints}
                                onLateralPipeClick={handleLateralPipeClick}
                                onLateralPipeMouseMove={handleLateralPipeMouseMove}
                                onPlantClickInConnectionMode={handlePlantClickInConnectionMode}
                                onPipeClickInConnectionMode={handlePipeClickInConnectionMode}
                                onMapDoubleClick={(event) => {
                                    if (!event.latLng) return;

                                    const lat = event.latLng.lat();
                                    const lng = event.latLng.lng();
                                    const clickPoint = { lat, lng };

                                    if (isRulerMode) {
                                        handleRulerDoubleClick(clickPoint);
                                        return;
                                    }

                                    if (editMode === 'plantArea') {
                                        setEditMode(null);
                                        setCurrentPlantArea(null);
                                    }
                                }}
                                onPlantEdit={handlePlantEdit}
                                onConnectToPipe={handleConnectToPipe}
                                onConnectToPlant={handleConnectToPlant}
                                isCreatingConnection={isCreatingConnection}
                                highlightedPipes={highlightedPipes}
                                connectionStartPlant={connectionStartPlant}
                                tempConnectionLine={tempConnectionLine}
                                handleZonePlantSelection={handleZonePlantSelection}
                                handleCreatePlantConnection={handleCreatePlantConnection}
                                editMode={editMode}
                                onSelectItem={handleSelectItem}
                                onPlantDragStart={handlePlantDragStart}
                                onPlantDragEnd={handlePlantDragEnd}
                                onSegmentedPipeDeletion={handleSegmentedPipeDeletion}
                                isDragging={isDragging}
                                dragTarget={dragTarget}
                                isPlantMoveMode={isPlantMoveMode}
                                isRulerMode={isRulerMode}
                                rulerStartPoint={rulerStartPoint}
                                currentMousePosition={currentMousePosition}
                                currentDistance={currentDistance}
                                onRulerMouseMove={handleRulerMouseMove}
                                isPlantSelectionMode={isPlantSelectionMode}
                                selectedPlantsForMove={selectedPlantsForMove}
                                setSelectedPlantsForMove={setSelectedPlantsForMove}
                                isDeleteMode={isDeleteMode}
                                handleDeletePipe={handleDeletePipe}
                                handleCurvedPipeEditingChange={handleCurvedPipeEditingChange}
                                highlightedPlants={highlightedPlants}
                                t={t}
                            />
                        </HorticultureMapComponent>

                        {showRulerWindow && (
                            <div className="absolute right-4 top-4 z-[9999] w-80 rounded-lg border border-gray-300 bg-white shadow-2xl">
                                <div className="rounded-t-lg bg-purple-600 px-3 py-2 text-white">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2">
                                            <FaRuler className="text-sm" />
                                            <span className="text-sm font-medium">
                                                {t('ไม้บรรทัดวัดระยะ')}
                                            </span>
                                        </div>
                                        <button
                                            onClick={stopRulerMode}
                                            className="rounded p-1 text-white hover:bg-purple-700"
                                            title={t('ปิดไม้บรรทัด')}
                                        >
                                            <FaTimes className="text-sm" />
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-2 p-3">
                                    <div className="rounded-lg border border-purple-200 bg-purple-50 p-2">
                                        <div className="text-sm font-medium text-purple-800">
                                            {t('ระยะทาง')}:
                                            <span className="ml-1 font-bold">
                                                {currentDistance.toFixed(2)} ม.
                                            </span>
                                        </div>
                                    </div>

                                    <div className="rounded bg-gray-50 p-2 text-xs text-gray-600">
                                        {!rulerStartPoint
                                            ? t('คลิกจุดแรกบนแผนที่เพื่อเริ่มวัด')
                                            : currentMousePosition
                                              ? t('เลื่อนเมาส์เพื่อดูระยะทาง คลิกเพื่อเริ่มจุดใหม่')
                                              : t('เลื่อนเมาส์บนแผนที่เพื่อเริ่มวัด')}
                                    </div>
                                    {/* 
                                    <div className="flex space-x-2 border-t pt-2">
                                        <button
                                            onClick={clearRulerMeasurements}
                                            className="flex-1 rounded bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-200"
                                        >
                                            {t('วัดใหม่')}
                                        </button>
                                        <button
                                            onClick={stopRulerMode}
                                            className="flex-1 rounded bg-purple-600 px-3 py-1 text-xs font-medium text-white transition-colors hover:bg-purple-700"
                                        >
                                            {t('ปิดไม้บรรทัด')}
                                        </button> 
                                    </div> */}
                                </div>
                            </div>
                        )}

                        <PlantRotationControl
                            isVisible={showPlantRotationControl && !hasLargeModalOpen()}
                            onClose={handleClosePlantRotationControl}
                            currentRotationAngle={tempRotationAngle}
                            onRotationChange={handleRotationChange}
                            onApplyRotation={handleApplyRotation}
                            isApplying={isApplyingRotation}
                            t={t}
                        />

                        <LateralPipeModeSelector
                            isVisible={
                                history.present.lateralPipeDrawing.isActive &&
                                !history.present.lateralPipeDrawing.placementMode &&
                                !hasLargeModalOpen()
                            }
                            onModeSelect={handleLateralPipeModeSelect}
                            onCancel={handleCancelLateralPipeDrawing}
                            t={t}
                        />

                        <AutoLateralPipeModal
                            isVisible={showAutoLateralPipeModal && !hasLargeModalOpen()}
                            onModeSelect={handleAutoLateralPipeModeSelect}
                            onCancel={handleCancelAutoLateralPipe}
                            zones={history.present.irrigationZones}
                            t={t}
                        />

                        <LateralPipeInfoPanel
                            isVisible={
                                history.present.lateralPipeDrawing.isActive &&
                                !!history.present.lateralPipeDrawing.placementMode &&
                                !!history.present.lateralPipeDrawing.startPoint &&
                                !hasLargeModalOpen()
                            }
                            placementMode={history.present.lateralPipeDrawing.placementMode}
                            selectedPlants={history.present.lateralPipeDrawing.selectedPlants}
                            totalWaterNeed={history.present.lateralPipeDrawing.totalWaterNeed}
                            plantCount={history.present.lateralPipeDrawing.plantCount}
                            startPoint={
                                history.present.lateralPipeDrawing.snappedStartPoint ||
                                history.present.lateralPipeDrawing.startPoint!
                            }
                            currentPoint={history.present.lateralPipeDrawing.rawCurrentPoint}
                            snappedStartPoint={history.present.lateralPipeDrawing.snappedStartPoint}
                            alignedCurrentPoint={history.present.lateralPipeDrawing.currentPoint}
                            // 🚀 เพิ่ม multi-segment props
                            waypoints={history.present.lateralPipeDrawing.waypoints}
                            isMultiSegmentMode={
                                history.present.lateralPipeDrawing.isMultiSegmentMode
                            }
                            segmentCount={history.present.lateralPipeDrawing.waypoints.length + 1}
                            onCancel={handleCancelLateralPipeDrawing}
                            onConfirm={() => {
                                if (history.present.lateralPipeDrawing.currentPoint) {
                                    handleFinishLateralPipeDrawing(
                                        history.present.lateralPipeDrawing.currentPoint
                                    );
                                }
                            }}
                            t={t}
                        />

                        {/* 🚀 Continuous Lateral Pipe Panel - แสดงเมื่ออยู่ในโหมดการวาดต่อเนื่อง */}
                        <ContinuousLateralPipePanel
                            isVisible={
                                history.present.lateralPipeDrawing.isActive &&
                                history.present.lateralPipeDrawing.isContinuousMode &&
                                !!history.present.lateralPipeDrawing.placementMode &&
                                !hasLargeModalOpen()
                            }
                            currentPlacementMode={history.present.lateralPipeDrawing.placementMode}
                            totalPipesCreated={history.present.lateralPipes.length} // จำนวนท่อทั้งหมดในโปรเจกต์
                            onChangePlacementMode={handleChangePlacementMode}
                            onStopContinuousDrawing={handleCancelLateralPipeDrawing}
                            t={t}
                        />

                        {/* Delete Pipe Panel - แสดงเมื่ออยู่ในโหมดลบท่อ */}
                        <DeletePipePanel
                            isVisible={isDeleteMode}
                            onCancel={handleCancelDeleteMode}
                            deletedCount={deletedPipeCount}
                            t={t}
                        />

                        <FirstLateralPipeWaterDisplay
                            isVisible={(() => {
                                if (hasLargeModalOpen()) {
                                    return false;
                                }

                                if (history.present.lateralPipeComparison.isComparing) {
                                    return false;
                                }

                                const currentZoneId =
                                    history.present.lateralPipeDrawing.isActive &&
                                    history.present.lateralPipeDrawing.placementMode &&
                                    history.present.lateralPipeDrawing.selectedPlants.length > 0
                                        ? (() => {
                                              const tempLateralPipe: LateralPipe = {
                                                  id: 'temp',
                                                  subMainPipeId: '',
                                                  coordinates: [
                                                      history.present.lateralPipeDrawing
                                                          .snappedStartPoint ||
                                                          history.present.lateralPipeDrawing
                                                              .startPoint!,
                                                      history.present.lateralPipeDrawing
                                                          .currentPoint ||
                                                          history.present.lateralPipeDrawing
                                                              .startPoint!,
                                                  ],
                                                  length: 0,
                                                  diameter: 16,
                                                  plants: history.present.lateralPipeDrawing
                                                      .selectedPlants,
                                                  placementMode:
                                                      history.present.lateralPipeDrawing
                                                          .placementMode!,
                                                  emitterLines: [],
                                                  totalWaterNeed:
                                                      history.present.lateralPipeDrawing
                                                          .totalWaterNeed,
                                                  plantCount:
                                                      history.present.lateralPipeDrawing.plantCount,
                                              };
                                              return getCurrentZoneIdForLateralPipe(
                                                  tempLateralPipe,
                                                  history.present,
                                                  manualZones
                                              );
                                          })()
                                        : 'main-area';

                                const firstPipeWaterNeed =
                                    history.present.firstLateralPipeWaterNeeds[currentZoneId] || 0;
                                return firstPipeWaterNeed > 0;
                            })()}
                            waterNeed={(() => {
                                const currentZoneId =
                                    history.present.lateralPipeDrawing.isActive &&
                                    history.present.lateralPipeDrawing.placementMode &&
                                    history.present.lateralPipeDrawing.selectedPlants.length > 0
                                        ? (() => {
                                              const tempLateralPipe: LateralPipe = {
                                                  id: 'temp',
                                                  subMainPipeId: '',
                                                  coordinates: [
                                                      history.present.lateralPipeDrawing
                                                          .snappedStartPoint ||
                                                          history.present.lateralPipeDrawing
                                                              .startPoint!,
                                                      history.present.lateralPipeDrawing
                                                          .currentPoint ||
                                                          history.present.lateralPipeDrawing
                                                              .startPoint!,
                                                  ],
                                                  length: 0,
                                                  diameter: 16,
                                                  plants: history.present.lateralPipeDrawing
                                                      .selectedPlants,
                                                  placementMode:
                                                      history.present.lateralPipeDrawing
                                                          .placementMode!,
                                                  emitterLines: [],
                                                  totalWaterNeed:
                                                      history.present.lateralPipeDrawing
                                                          .totalWaterNeed,
                                                  plantCount:
                                                      history.present.lateralPipeDrawing.plantCount,
                                              };
                                              return getCurrentZoneIdForLateralPipe(
                                                  tempLateralPipe,
                                                  history.present,
                                                  manualZones
                                              );
                                          })()
                                        : 'main-area';
                                return (
                                    history.present.firstLateralPipeWaterNeeds[currentZoneId] || 0
                                );
                            })()}
                            zoneName={(() => {
                                const currentZoneId =
                                    history.present.lateralPipeDrawing.isActive &&
                                    history.present.lateralPipeDrawing.placementMode &&
                                    history.present.lateralPipeDrawing.selectedPlants.length > 0
                                        ? (() => {
                                              const tempLateralPipe: LateralPipe = {
                                                  id: 'temp',
                                                  subMainPipeId: '',
                                                  coordinates: [
                                                      history.present.lateralPipeDrawing
                                                          .snappedStartPoint ||
                                                          history.present.lateralPipeDrawing
                                                              .startPoint!,
                                                      history.present.lateralPipeDrawing
                                                          .currentPoint ||
                                                          history.present.lateralPipeDrawing
                                                              .startPoint!,
                                                  ],
                                                  length: 0,
                                                  diameter: 16,
                                                  plants: history.present.lateralPipeDrawing
                                                      .selectedPlants,
                                                  placementMode:
                                                      history.present.lateralPipeDrawing
                                                          .placementMode!,
                                                  emitterLines: [],
                                                  totalWaterNeed:
                                                      history.present.lateralPipeDrawing
                                                          .totalWaterNeed,
                                                  plantCount:
                                                      history.present.lateralPipeDrawing.plantCount,
                                              };
                                              return getCurrentZoneIdForLateralPipe(
                                                  tempLateralPipe,
                                                  history.present,
                                                  manualZones
                                              );
                                          })()
                                        : 'main-area';
                                return getZoneNameById(currentZoneId, history.present, manualZones);
                            })()}
                            plantCount={
                                history.present.firstLateralPipePlantCounts[
                                    (() => {
                                        const currentZoneId =
                                            history.present.lateralPipeDrawing.isActive &&
                                            history.present.lateralPipeDrawing.placementMode &&
                                            history.present.lateralPipeDrawing.selectedPlants
                                                .length > 0
                                                ? (() => {
                                                      const tempLateralPipe: LateralPipe = {
                                                          id: 'temp',
                                                          subMainPipeId: '',
                                                          coordinates: [
                                                              history.present.lateralPipeDrawing
                                                                  .snappedStartPoint ||
                                                                  history.present.lateralPipeDrawing
                                                                      .startPoint!,
                                                              history.present.lateralPipeDrawing
                                                                  .currentPoint ||
                                                                  history.present.lateralPipeDrawing
                                                                      .startPoint!,
                                                          ],
                                                          length: 0,
                                                          diameter: 16,
                                                          plants: history.present.lateralPipeDrawing
                                                              .selectedPlants,
                                                          placementMode:
                                                              history.present.lateralPipeDrawing
                                                                  .placementMode!,
                                                          emitterLines: [],
                                                          totalWaterNeed:
                                                              history.present.lateralPipeDrawing
                                                                  .totalWaterNeed,
                                                          plantCount:
                                                              history.present.lateralPipeDrawing
                                                                  .plantCount,
                                                      };
                                                      return getCurrentZoneIdForLateralPipe(
                                                          tempLateralPipe,
                                                          history.present,
                                                          manualZones
                                                      );
                                                  })()
                                                : 'main-area';
                                        return currentZoneId;
                                    })()
                                ] || 0
                            }
                            t={t}
                        />

                        <LateralPipeComparisonAlert
                            isVisible={
                                history.present.lateralPipeComparison.isComparing &&
                                !hasLargeModalOpen()
                            }
                            isMoreThanFirst={history.present.lateralPipeComparison.isMoreThanFirst}
                            difference={history.present.lateralPipeComparison.difference}
                            currentWaterNeed={
                                history.present.lateralPipeComparison.currentPipeWaterNeed
                            }
                            firstPipeWaterNeed={
                                history.present.lateralPipeComparison.firstPipeWaterNeed
                            }
                            zoneName={getZoneNameById(
                                history.present.lateralPipeComparison.currentZoneId || 'main-area',
                                history.present,
                                manualZones
                            )}
                            currentPlantCount={history.present.lateralPipeDrawing.plantCount}
                            firstPlantCount={
                                history.present.firstLateralPipePlantCounts[
                                    history.present.lateralPipeComparison.currentZoneId ||
                                        'main-area'
                                ] || 0
                            }
                            flowRatePerMinute={
                                sprinklerConfig ? parseFloat(sprinklerConfig.flowRatePerMinute) : 0
                            }
                            t={t}
                        />
                    </div>
                </div>
            </div>

            <CustomPlantModal
                isOpen={showCustomPlantModal}
                onClose={() => {
                    setShowCustomPlantModal(false);
                    setEditingPlant(null);
                    setShouldShowPlantSelectorAfterSave(false);
                }}
                onSave={handleSaveCustomPlant}
                defaultValues={editingPlant || undefined}
                onAfterSave={() => {
                    if (shouldShowPlantSelectorAfterSave && selectedPlantForEdit) {
                        // แสดง plant selector ใน SimpleMousePlantEditModal
                        setTimeout(() => {
                            const event = new CustomEvent('showPlantSelector');
                            document.dispatchEvent(event);
                        }, 100);
                    }
                    setShouldShowPlantSelectorAfterSave(false);
                }}
                t={t}
            />

            <ZonePlantSelectionModal
                isOpen={showZonePlantModal}
                onClose={() => {
                    setShowZonePlantModal(false);
                    setSelectedZoneForPlant(null);
                }}
                zone={selectedZoneForPlant}
                availablePlants={history.present.availablePlants}
                onSave={handleSaveZonePlant}
                onCreateCustomPlant={() => {
                    // เปิดโมดัลสร้างพืชใหม่โดยไม่ปิดโมดัลปัจจุบัน
                    handleCreateCustomPlant();
                }}
                onEditPlant={(plantData: PlantData) => {
                    // เปิดโมดัลแก้ไขพืชโดยไม่ปิดโมดัลปัจจุบัน
                    handleCreateCustomPlant(plantData);
                }}
                t={t}
            />

            <SimpleMousePlantEditModal
                isOpen={showPlantEditModal}
                onClose={() => {
                    setShowPlantEditModal(false);
                    setSelectedPlantForEdit(null);
                    setIsNewPlantMode(false);
                }}
                plant={selectedPlantForEdit}
                onSave={handlePlantSave}
                onDelete={handlePlantDelete}
                availablePlants={history.present.availablePlants}
                onCreateCustomPlant={() => {
                    // เปิดโมดัลสร้างพืชใหม่โดยไม่ปิดโมดัลปัจจุบัน
                    setShouldShowPlantSelectorAfterSave(true);
                    handleCreateCustomPlant();
                }}
                onEditPlant={(plantData) => {
                    // เปิดโมดัลแก้ไขพืชโดยไม่ปิดโมดัลปัจจุบัน
                    setShouldShowPlantSelectorAfterSave(true);
                    handleCreateCustomPlant(plantData);
                }}
                onShowPlantSelector={() => {
                    // แสดงหน้าเลือกพืชหลังจากสร้าง/แก้ไขพืชเสร็จ
                    // จะทำงานเมื่อ CustomPlantModal ปิดแล้ว
                }}
                t={t}
            />

            <PipeSegmentSelectionModal
                isOpen={showPipeSegmentModal}
                onClose={() => {
                    setShowPipeSegmentModal(false);
                    setSelectedBranchForSegment(null);
                }}
                branchPipe={selectedBranchForSegment}
                onDeleteSegment={handleDeletePipeSegment}
                onDeleteWholePipe={(branchPipeId) => handleDeleteBranchPipe([branchPipeId])}
                t={t}
            />

            <BatchOperationsModal
                isOpen={showBatchModal}
                onClose={() => setShowBatchModal(false)}
                selectedItems={history.present.selectedItems}
                onBatchDelete={handleBatchDelete}
                onBatchMove={handleBatchMove}
                onBatchCopy={handleBatchCopy}
                onBatchPaste={handleBatchPaste}
                onCreateTemplate={handleCreateTemplate}
                onDeleteSpecificPlants={handleDeleteSpecificPlants}
                onDeleteBranchPipe={handleDeleteBranchPipe}
                onSegmentedPipeDeletion={handleSegmentedPipeDeletion}
                t={t}
            />

            <RealTimeBranchControlModal
                isOpen={showRealTimeBranchModal}
                onClose={() => setShowRealTimeBranchModal(false)}
                subMainPipe={
                    history.present.subMainPipes.find(
                        (sm) => sm.id === history.present.realTimeEditing.activePipeId
                    ) || null
                }
                currentAngle={history.present.realTimeEditing.activeAngle}
                onAngleChange={handleRealTimeBranchAngleChange}
                onApply={handleApplyRealTimeBranchEdit}
                branchSettings={history.present.branchPipeSettings}
                t={t}
            />

            <PlantTypeSelectionModal
                isOpen={showPlantTypeSelectionModal}
                onClose={() => setShowPlantTypeSelectionModal(false)}
                onSinglePlant={handleSinglePlantSelection}
                onMultiplePlants={handleMultiplePlantsSelection}
                t={t}
            />

            <PlantTypeSelectionModal
                isOpen={showPlantTypeSelectionModal}
                onClose={() => setShowPlantTypeSelectionModal(false)}
                onSinglePlant={handleSinglePlantSelection}
                onMultiplePlants={handleMultiplePlantsSelection}
                t={t}
            />

            <PlantAreaSelectionModal
                isOpen={showPlantAreaSelectionModal}
                onClose={() => {
                    setShowPlantAreaSelectionModal(false);
                    setCurrentPlantArea(null);
                }}
                onSave={handleSavePlantArea}
                availablePlants={history.present.availablePlants}
                selectedPlantType={history.present.selectedPlantType}
                onPlantTypeChange={(plantType) =>
                    pushToHistory({
                        selectedPlantType: plantType,
                    })
                }
                onCreateCustomPlant={() => {
                    setShowPlantAreaSelectionModal(false);
                    setShowCustomPlantModal(true);
                }}
                t={t}
            />

            <PlantGenerationModal
                isOpen={showPlantGenerationModal}
                onClose={() => setShowPlantGenerationModal(false)}
                onGenerate={handleGeneratePlants}
                settings={history.present.plantGenerationSettings}
                onSettingsChange={(settings) =>
                    pushToHistory({
                        plantGenerationSettings: settings,
                    })
                }
                availablePlants={history.present.availablePlants}
                selectedPlantType={history.present.selectedPlantType}
                onPlantTypeChange={(plantType) =>
                    pushToHistory({
                        selectedPlantType: plantType,
                    })
                }
                onCreateCustomPlant={() => {
                    handleCreateCustomPlant();
                }}
                onEditPlant={(plantData) => {
                    handleCreateCustomPlant(plantData);
                }}
                plantSelectionMode={history.present.plantSelectionMode}
                plantAreas={history.present.plantAreas}
                t={t}
            />

            <SprinklerConfigModal
                isOpen={showSprinklerConfigModal}
                onClose={handleSprinklerConfigClose}
                onSave={handleSprinklerConfigSave}
                plantCount={history.present.plants.length}
                t={t}
            />

            <LateralPipeInfoModal
                isOpen={showLateralPipeInfoModal}
                onClose={handleLateralPipeInfoModalClose}
                lateralPipe={selectedLateralPipe}
                t={t}
            />

            <HeadLossCalculationModal
                isOpen={showHeadLossModal}
                onClose={() => setShowHeadLossModal(false)}
                onSave={handleHeadLossCalculationSave}
                pipeInfo={selectedPipeForHeadLoss}
                previousResult={
                    selectedPipeForHeadLoss
                        ? getHeadLossForPipe(selectedPipeForHeadLoss.pipeId)
                        : undefined
                }
                t={t}
            />

            <ManualIrrigationZoneModal
                isOpen={showManualIrrigationZoneModal}
                onClose={() => setShowManualIrrigationZoneModal(false)}
                numberOfZones={numberOfManualZones}
                onNumberOfZonesChange={setNumberOfManualZones}
                onStartDrawing={handleStartManualIrrigationZones}
                t={t}
            />

            <AutoZoneModal
                isOpen={showAutoZoneModal}
                onClose={() => setShowAutoZoneModal(false)}
                config={autoZoneConfig}
                onConfigChange={setAutoZoneConfig}
                onCreateZones={handleCreateAutoZones}
                onRegenerateZones={handleRegenerateZones}
                isCreating={isCreatingAutoZones}
                hasExistingZones={history.present.irrigationZones.length > 0}
                totalPlants={history.present.plants.length}
                totalWaterNeed={history.present.plants.reduce(
                    (sum, plant) => sum + plant.plantData.waterNeed,
                    0
                )}
                t={t}
            />

            <AutoZoneDebugModal
                isOpen={showAutoZoneDebugModal}
                onClose={() => setShowAutoZoneDebugModal(false)}
                result={autoZoneResult}
                t={t}
            />

            {isDrawingManualZone && (
                <ManualZoneDrawingManager
                    onDrawingComplete={handleManualZoneDrawingComplete}
                    onCancel={() => {
                        setIsDrawingManualZone(false);
                        setManualZones([]);
                        setEditMode(null);
                    }}
                    currentZoneIndex={currentManualZoneIndex}
                    totalZones={numberOfManualZones}
                    manualZones={manualZones}
                    t={t}
                />
            )}

            {showManualZoneInfoModal && (
                <ManualZoneInfoModal
                    isOpen={showManualZoneInfoModal}
                    onClose={() => setShowManualZoneInfoModal(false)}
                    zone={currentDrawnZone}
                    targetWaterPerZone={targetWaterPerZone}
                    numberOfZones={numberOfManualZones}
                    onAccept={handleAcceptManualZone}
                    onRedraw={() => {
                        setShowManualZoneInfoModal(false);
                        setIsDrawingManualZone(true);
                        setEditMode('manualZone');
                    }}
                    t={t}
                />
            )}

            {/* Modal ยืนยันการลบพื้นที่หลัก */}
            {showDeleteMainAreaConfirm && (
                <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black bg-opacity-50">
                    <div className="w-full max-w-md rounded-lg bg-gray-900 p-6 shadow-2xl">
                        <h3 className="mb-4 text-xl font-semibold text-white">
                            ⚠️ {t('ยืนยันการลบพื้นที่หลัก')}
                        </h3>
                        <div className="mb-6 rounded-lg border border-red-200 bg-red-900 p-4 text-sm text-red-100">
                            <p className="font-medium">{t('คำเตือน')}:</p>
                            <ul className="mt-2 space-y-1">
                                <li>• {t('การลบพื้นที่หลักจะลบทุกอย่างในแผนที่')}</li>
                                <li>• {t('ต้นไม้ทั้งหมดจะถูกลบ')}</li>
                                <li>• {t('ท่อทั้งหมดจะถูกลบ')}</li>
                                <li>• {t('โซนทั้งหมดจะถูกลบ')}</li>
                                <li>• {t('ไม่สามารถยกเลิกการดำเนินการนี้ได้')}</li>
                            </ul>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteMainAreaConfirm(false)}
                                className="flex-1 rounded bg-gray-600 px-4 py-2 text-white transition-colors hover:bg-gray-700"
                            >
                                {t('ยกเลิก')}
                            </button>
                            <button
                                onClick={handleDeleteMainArea}
                                className="flex-1 rounded bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
                            >
                                🗑️ {t('ลบพื้นที่หลัก')}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

const EnhancedGoogleMapsOverlays: React.FC<{
    map: google.maps.Map | null;
    data: ProjectState;
    currentDrawnZone?: ManualIrrigationZone | null;
    manualZones?: ManualIrrigationZone[];
    onMapClick: (event: google.maps.MapMouseEvent) => void;
    onMapDoubleClick?: (event: google.maps.MapMouseEvent) => void;
    isZoneEditMode?: boolean;
    selectedZoneForEdit?: IrrigationZone | null;
    zoneControlPoints?: Coordinate[];
    onZoneSelect?: (zone: IrrigationZone) => void;
    onManualZoneSelect?: (zone: ManualIrrigationZone) => void;
    onZoneUpdate?: (updatedCoordinates: Coordinate[]) => void;
    setDraggedControlPointIndex?: (index: number | null) => void;
    setZoneControlPoints?: (controlPoints: Coordinate[]) => void;
    generateZoneControlPoints?: (zoneCoordinates: Coordinate[]) => Coordinate[];
    onPlantEdit: (plant: PlantLocation) => void;
    onConnectToPipe: (position: Coordinate, pipeId: string, pipeType: 'subMain' | 'branch') => void;
    onConnectToPlant: (plantId: string) => void;
    isCreatingConnection: boolean;
    highlightedPipes: string[];
    connectionStartPlant: PlantLocation | null;
    tempConnectionLine: Coordinate[] | null;
    handleZonePlantSelection: (zone: Zone) => void;
    handleCreatePlantConnection: (plantId: string) => void;
    editMode: string | null;
    onSelectItem: (id: string, type: 'plants' | 'pipes' | 'zones') => void;
    onPlantDragStart: (plantId: string) => void;
    onPlantDragEnd: (plantId: string, newPosition: Coordinate) => void;
    onSegmentedPipeDeletion: (branchPipeId: string) => void;
    isDragging: boolean;
    dragTarget: { id: string; type: 'plant' | 'pipe' } | null;
    isPlantMoveMode: boolean;
    isRulerMode: boolean;
    rulerStartPoint: Coordinate | null;
    currentMousePosition: Coordinate | null;
    currentDistance: number;
    onRulerMouseMove: (position: Coordinate) => void;
    onLateralPipeClick?: (event: google.maps.MapMouseEvent, lateralPipeId?: string) => void;
    onLateralPipeMouseMove?: (event: google.maps.MapMouseEvent) => void;
    onPlantClickInConnectionMode: (plant: PlantLocation) => void;
    onPipeClickInConnectionMode: (
        pipeId: string,
        pipeType: 'subMainPipe' | 'lateralPipe',
        position: Coordinate
    ) => void;
    t: (key: string) => string;
    isPlantSelectionMode: boolean;
    selectedPlantsForMove: Set<string>;
    setSelectedPlantsForMove: React.Dispatch<React.SetStateAction<Set<string>>>;
    isDeleteMode: boolean;
    handleDeletePipe: (
        pipeId: string,
        pipeType: 'mainPipe' | 'subMainPipe' | 'lateralPipe' | 'branchPipe'
    ) => void;
    handleCurvedPipeEditingChange: (pipeId: string, isEditing: boolean) => void;
    highlightedPlants?: Set<string>; // 🌱 เพิ่มสำหรับต้นไม้ที่ถูก highlight ขณะลากท่อย่อย
    showSprinklerRadius?: boolean;
}> = ({
    map,
    data,
    currentDrawnZone,
    manualZones,
    onMapClick,
    onMapDoubleClick,
    isZoneEditMode = false,
    selectedZoneForEdit = null,
    zoneControlPoints = [],
    onZoneSelect,
    onManualZoneSelect,
    onZoneUpdate,
    setDraggedControlPointIndex,
    setZoneControlPoints,
    generateZoneControlPoints,
    onPlantEdit,
    onConnectToPipe,
    onConnectToPlant,
    isCreatingConnection,
    highlightedPipes,
    connectionStartPlant,
    tempConnectionLine,
    handleZonePlantSelection,
    handleCreatePlantConnection,
    editMode,
    onSelectItem,
    onPlantDragStart,
    onPlantDragEnd,
    onSegmentedPipeDeletion,
    isDragging,
    dragTarget,
    isPlantMoveMode,
    isRulerMode,
    rulerStartPoint,
    currentMousePosition,
    currentDistance,
    onRulerMouseMove,
    onLateralPipeClick,
    onLateralPipeMouseMove,
    onPlantClickInConnectionMode,
    onPipeClickInConnectionMode,
    t,
    isPlantSelectionMode,
    selectedPlantsForMove,
    setSelectedPlantsForMove,
    isDeleteMode,
    handleDeletePipe,
    handleCurvedPipeEditingChange,
    highlightedPlants = new Set(),
    showSprinklerRadius = false,
}) => {
    const overlaysRef = useRef<{
        polygons: Map<string, google.maps.Polygon>;
        polylines: Map<string, google.maps.Polyline>;
        markers: Map<string, google.maps.Marker>;
        infoWindows: Map<string, google.maps.InfoWindow>;
        overlays: Map<string, google.maps.OverlayView>;
        circles: Map<string, google.maps.Circle>;
    }>({
        polygons: new Map(),
        polylines: new Map(),
        markers: new Map(),
        infoWindows: new Map(),
        circles: new Map(),
        overlays: new Map(),
    });

    // 🔥 Helper function เพื่อหาโซนของท่อ
    const findPipeZone = (pipe: any, zones: any[], irrigationZones: any[]): string | null => {
        if (!pipe.coordinates || pipe.coordinates.length < 2) {
            return null;
        }

        // ใช้จุดปลายของท่อ
        const pipeEnd = pipe.coordinates[pipe.coordinates.length - 1];

        // ตรวจสอบใน irrigationZones ก่อน
        for (const zone of irrigationZones) {
            if (isPointInPolygon(pipeEnd, zone.coordinates)) {
                return zone.id;
            }
        }

        // ตรวจสอบใน zones
        for (const zone of zones) {
            if (isPointInPolygon(pipeEnd, zone.coordinates)) {
                return zone.id;
            }
        }

        return null;
    };

    const clearOverlays = useCallback(() => {
        overlaysRef.current.polygons.forEach((polygon) => polygon.setMap(null));
        overlaysRef.current.polylines.forEach((polyline) => polyline.setMap(null));
        overlaysRef.current.markers.forEach((marker) => marker.setMap(null));
        overlaysRef.current.infoWindows.forEach((infoWindow) => infoWindow.close());
        overlaysRef.current.overlays.forEach((overlay) => overlay.setMap(null));
        overlaysRef.current.circles.forEach((circle) => circle.setMap(null));

        overlaysRef.current.polygons.clear();
        overlaysRef.current.polylines.clear();
        overlaysRef.current.markers.clear();
        overlaysRef.current.infoWindows.clear();
        overlaysRef.current.overlays.clear();
        overlaysRef.current.circles.clear();
    }, []);

    useEffect(() => {
        if (!map) return;
        const mapDiv = map.getDiv();

        const domClickHandler = (event: MouseEvent) => {
            const bounds = map.getBounds();
            if (!bounds) return;

            const mapBounds = mapDiv.getBoundingClientRect();
            const relativeX = (event.clientX - mapBounds.left) / mapBounds.width;
            const relativeY = (event.clientY - mapBounds.top) / mapBounds.height;

            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();
            const lng = sw.lng() + (ne.lng() - sw.lng()) * relativeX;
            const lat = ne.lat() + (sw.lat() - ne.lat()) * relativeY;

            const fakeMapEvent = {
                latLng: new google.maps.LatLng(lat, lng),
                domEvent: event,
                pixel: new google.maps.Point(
                    event.clientX - mapBounds.left,
                    event.clientY - mapBounds.top
                ),
                stop: () => {},
            } as unknown as google.maps.MapMouseEvent;

            onMapClick(fakeMapEvent);
        };

        const googleClickListener = map.addListener('click', (event: google.maps.MapMouseEvent) => {
            if (event.latLng) {
                onMapClick(event);
            }
        });

        const googleDoubleClickListener = onMapDoubleClick
            ? map.addListener('dblclick', (event: google.maps.MapMouseEvent) => {
                  if (event.latLng && onMapDoubleClick) {
                      onMapDoubleClick(event);
                  }
              })
            : null;

        if (mapDiv) {
            mapDiv.addEventListener('click', domClickHandler);
        }

        // Throttled mouse move handling for ruler mode
        let lastRulerMoveTime = 0;
        const RULER_THROTTLE_MS = 16; // ~60fps

        const mouseMove = (event: google.maps.MapMouseEvent) => {
            if (isRulerMode && event.latLng) {
                const now = performance.now();
                if (now - lastRulerMoveTime >= RULER_THROTTLE_MS) {
                    lastRulerMoveTime = now;
                    onRulerMouseMove({
                        lat: event.latLng.lat(),
                        lng: event.latLng.lng(),
                    });
                }
            }
        };

        // เฉพาะ ruler mode listener (ไม่รวม lateral pipe)
        let mouseMoveListener: google.maps.MapsEventListener | null = null;
        if (isRulerMode) {
            // ปรับ map options เพื่อให้ ruler mode ทำงานได้ดี
            map.set('clickableIcons', false); // ป้องกัน icons ขัดขวาง
            map.set('gestureHandling', 'greedy');

            mouseMoveListener = map.addListener('mousemove', mouseMove);

            // เพิ่ม DOM-level mouse move listener สำหรับ fallback
            const mapDiv = map.getDiv();
            if (mapDiv) {
                const domMouseMove = (e: MouseEvent) => {
                    const bounds = map.getBounds();
                    if (!bounds) return;

                    const rect = mapDiv.getBoundingClientRect();
                    const relativeX = (e.clientX - rect.left) / rect.width;
                    const relativeY = (e.clientY - rect.top) / rect.height;

                    const ne = bounds.getNorthEast();
                    const sw = bounds.getSouthWest();
                    const lng = sw.lng() + (ne.lng() - sw.lng()) * relativeX;
                    const lat = ne.lat() + (sw.lat() - ne.lat()) * relativeY;

                    const now = performance.now();
                    if (now - lastRulerMoveTime >= RULER_THROTTLE_MS) {
                        lastRulerMoveTime = now;
                        onRulerMouseMove({ lat, lng });
                    }
                };

                mapDiv.addEventListener('mousemove', domMouseMove, { passive: true });
                (mapDiv as any)._rulerMouseMove = domMouseMove;
            }
        }

        return () => {
            if (mapDiv) {
                mapDiv.removeEventListener('click', domClickHandler);
                // Cleanup ruler mouse move listener
                if ((mapDiv as any)._rulerMouseMove) {
                    mapDiv.removeEventListener('mousemove', (mapDiv as any)._rulerMouseMove);
                    delete (mapDiv as any)._rulerMouseMove;
                }
            }
            if (googleClickListener) {
                google.maps.event.removeListener(googleClickListener);
            }
            if (googleDoubleClickListener) {
                google.maps.event.removeListener(googleDoubleClickListener);
            }
            if (mouseMoveListener) {
                google.maps.event.removeListener(mouseMoveListener);
            }

            // Reset map options เมื่อออกจาก ruler mode
            if (!isRulerMode) {
                map.set('clickableIcons', true);
            }
        };
    }, [map, onMapClick, editMode, isRulerMode, onRulerMouseMove, onMapDoubleClick]);

    // 🚀 Optimized useEffect สำหรับ lateral pipe mouse move (ใช้ single listener)
    useEffect(() => {
        if (!map || !data.lateralPipeDrawing.isActive) {
            return;
        }

        // 🚀 Optimized lateral pipe mouse move handler
        // ป้องกัน conflict กับ ruler mode
        const lateralPipeMouseMove = (event: google.maps.MapMouseEvent) => {
            if (onLateralPipeMouseMove && event.latLng && !isRulerMode) {
                onLateralPipeMouseMove(event);
            }
        };

        // 🚀 Right-click handler สำหรับเพิ่ม waypoint
        const lateralPipeRightClick = (event: google.maps.MapMouseEvent) => {
            if (
                event.latLng &&
                !isRulerMode &&
                data.lateralPipeDrawing.isActive &&
                data.lateralPipeDrawing.startPoint
            ) {
                // เรียกใช้ handleAddLateralPipeWaypoint โดยตรง
                const waypointPosition = {
                    lat: event.latLng.lat(),
                    lng: event.latLng.lng(),
                };

                // ส่งข้อมูลไปยัง parent component ผ่าน onLateralPipeClick แทน
                if (onLateralPipeClick) {
                    // ใช้ custom event เพื่อระบุว่าเป็น right-click
                    const customEvent = {
                        ...event,
                        isRightClick: true,
                        waypointPosition: waypointPosition,
                    } as any;
                    onLateralPipeClick(customEvent);
                }
            }
        };

        // 🚀 Primary Google Maps listener with backup fallback
        let lateralMouseMoveListener: google.maps.MapsEventListener | null = null;
        let lateralRightClickListener: google.maps.MapsEventListener | null = null; // 🚀 เพิ่ม right-click listener
        let backupListener: google.maps.MapsEventListener | null = null;

        try {
            // Ensure map can receive mouse events
            map.set('draggable', true);
            map.set('disableDoubleClickZoom', false);
            map.set('clickableIcons', true);

            // Primary Google Maps listener
            lateralMouseMoveListener = map.addListener('mousemove', lateralPipeMouseMove);

            // 🚀 Right-click listener สำหรับเพิ่ม waypoint
            lateralRightClickListener = map.addListener('rightclick', lateralPipeRightClick);

            // Lightweight backup listener in case primary fails
            backupListener = google.maps.event.addListener(map, 'mousemove', lateralPipeMouseMove);

            // 🚀 Add global DOM listener as ultimate fallback
            const mapDiv = map.getDiv();
            if (mapDiv) {
                const globalMouseMove = (e: MouseEvent) => {
                    // สร้าง synthetic Google Maps event
                    try {
                        const bounds = map.getBounds();
                        const mapSize = { width: mapDiv.offsetWidth, height: mapDiv.offsetHeight };

                        if (bounds && mapSize.width > 0 && mapSize.height > 0) {
                            const rect = mapDiv.getBoundingClientRect();
                            const x = e.clientX - rect.left;
                            const y = e.clientY - rect.top;

                            const ne = bounds.getNorthEast();
                            const sw = bounds.getSouthWest();

                            const lat = sw.lat() + (ne.lat() - sw.lat()) * (1 - y / mapSize.height);
                            const lng = sw.lng() + (ne.lng() - sw.lng()) * (x / mapSize.width);

                            const syntheticLatLng = new google.maps.LatLng(lat, lng);
                            const syntheticEvent = {
                                latLng: syntheticLatLng,
                                domEvent: e,
                            } as google.maps.MapMouseEvent;

                            lateralPipeMouseMove(syntheticEvent);
                        }
                    } catch (error) {
                        console.warn('Global fallback error:', error);
                    }
                };

                mapDiv.addEventListener('mousemove', globalMouseMove);

                // Store for cleanup
                (mapDiv as any)._globalMouseMove = globalMouseMove;
            }
        } catch (error) {
            console.error('❌ Error setting up lateral pipe listener:', error);
        }

        // 🚀 Cleanup all listeners
        return () => {
            if (lateralMouseMoveListener) {
                google.maps.event.removeListener(lateralMouseMoveListener);
            }
            if (lateralRightClickListener) {
                google.maps.event.removeListener(lateralRightClickListener);
            }
            if (backupListener) {
                google.maps.event.removeListener(backupListener);
            }

            // Cleanup global DOM listener
            const mapDiv = map.getDiv();
            if (mapDiv && (mapDiv as any)._globalMouseMove) {
                mapDiv.removeEventListener('mousemove', (mapDiv as any)._globalMouseMove);
                delete (mapDiv as any)._globalMouseMove;
            }
        };
    }, [
        map,
        data.lateralPipeDrawing.isActive,
        data.lateralPipeDrawing.startPoint,
        data.lateralPipeDrawing.placementMode,
        onLateralPipeMouseMove,
        onLateralPipeClick, // 🚀 เพิ่ม click handler สำหรับ right-click
        isRulerMode,
    ]);

    useEffect(() => {
        if (!map) return;
        clearOverlays();

        const { layerVisibility } = data;

        if (data.mainArea.length > 0) {
            const mainAreaPolygon = new google.maps.Polygon({
                paths: data.mainArea.map((coord) => ({ lat: coord.lat, lng: coord.lng })),
                fillColor: '#22C55E',
                fillOpacity: 0.1,
                strokeColor: '#22C55E',
                strokeWeight: 3,
                clickable: editMode !== 'pump' && !data.lateralPipeDrawing.isActive,
            });

            mainAreaPolygon.setMap(map);
            overlaysRef.current.polygons.set('main-area', mainAreaPolygon);

            if (editMode !== 'pump' && !data.lateralPipeDrawing.isActive) {
                mainAreaPolygon.addListener('click', (event: google.maps.MapMouseEvent) => {
                    if (!data.isEditModeEnabled && editMode !== 'plant' && event.latLng) {
                        event.stop();
                    } else if (event.latLng) {
                        event.stop();
                    }
                });
            }
        }

        if (layerVisibility.zones) {
            data.zones.forEach((zone) => {
                const isSelected = data.selectedItems.zones.includes(zone.id);

                const zonePolygon = new google.maps.Polygon({
                    paths: zone.coordinates.map((coord) => ({ lat: coord.lat, lng: coord.lng })),
                    fillColor: zone.color,
                    fillOpacity: isSelected ? 0.4 : 0.2,
                    strokeColor: zone.color,
                    strokeWeight: isSelected ? 3 : 2,
                    clickable: editMode !== 'pump',
                });

                zonePolygon.setMap(map);
                overlaysRef.current.polygons.set(zone.id, zonePolygon);

                const zoneIndex = data.zones.findIndex((z) => z.id === zone.id);
                const zoneLabel = createAreaTextOverlay(
                    map,
                    zone.coordinates,
                    `${t('โซน')} ${zoneIndex + 1}`,
                    zone.color
                );
                overlaysRef.current.overlays.set(`zone-label-${zone.id}`, zoneLabel);

                if (editMode !== 'pump') {
                    zonePolygon.addListener('dblclick', () => {
                        if (!data.isEditModeEnabled) {
                            handleZonePlantSelection(zone);
                        }
                    });

                    zonePolygon.addListener('click', (event: google.maps.MapMouseEvent) => {
                        const domEvent = event.domEvent as MouseEvent;
                        if (
                            data.isEditModeEnabled &&
                            data.editModeSettings.selectionMode !== 'single' &&
                            domEvent?.ctrlKey
                        ) {
                            event.stop();
                            onSelectItem(zone.id, 'zones');
                        } else if (
                            !data.isEditModeEnabled &&
                            editMode !== 'plant' &&
                            event.latLng
                        ) {
                            event.stop();
                        } else if (event.latLng) {
                            event.stop();
                        }
                    });
                }
            });
        }

        if (layerVisibility.exclusions) {
            data.exclusionAreas.forEach((area) => {
                const exclusionPolygon = new google.maps.Polygon({
                    paths: area.coordinates.map((coord) => ({ lat: coord.lat, lng: coord.lng })),
                    fillColor: area.color,
                    fillOpacity: 0.4,
                    strokeColor: area.color,
                    strokeWeight: 2,
                    clickable: editMode !== 'pump',
                });

                exclusionPolygon.setMap(map);
                overlaysRef.current.polygons.set(area.id, exclusionPolygon);

                const exclusionLabel = createAreaTextOverlay(
                    map,
                    area.coordinates,
                    getExclusionTypeName(area.type, t),
                    area.color
                );
                overlaysRef.current.overlays.set(`exclusion-label-${area.id}`, exclusionLabel);

                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div style="color: black; text-align: center;">
                            <strong>${area.name}</strong><br/>
                            ${t('ประเภท')}: ${getExclusionTypeName(area.type, t)}
                        </div>
                    `,
                });

                if (editMode !== 'pump') {
                    exclusionPolygon.addListener('click', (event: google.maps.MapMouseEvent) => {
                        infoWindow.setPosition(event.latLng);
                        infoWindow.open(map);
                    });
                }

                overlaysRef.current.infoWindows.set(area.id, infoWindow);
            });

            if (layerVisibility.dimensionLines) {
                data.exclusionZones.forEach((exclusionZone) => {
                    if (exclusionZone.showDimensionLines) {
                        exclusionZone.dimensionLines.forEach((dimensionLine) => {
                            const dimensionPolyline = new google.maps.Polyline({
                                path: [
                                    { lat: dimensionLine.start.lat, lng: dimensionLine.start.lng },
                                    { lat: dimensionLine.end.lat, lng: dimensionLine.end.lng },
                                ],
                                strokeColor: '#FF6600', // เปลี่ยนเป็นสีส้ม
                                strokeWeight: 1, // เพิ่มความหนา
                                strokeOpacity: 1.0, // เพิ่มความชัด
                                icons: [
                                    {
                                        icon: {
                                            path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                                            scale: 2, // เพิ่มขนาดหัวลูกศร
                                            strokeColor: '#FF6600', // สีส้มเหมือนเส้น
                                            fillColor: '#FF6600', // เติมสีส้ม
                                            fillOpacity: 1.0,
                                        },
                                        offset: '100%', // วางที่ปลายเส้น
                                    },
                                ],
                            });

                            dimensionPolyline.setMap(map);
                            overlaysRef.current.polylines.set(
                                `dimension-${dimensionLine.id}`,
                                dimensionPolyline
                            );

                            const angle = dimensionLine.angle;
                            let offsetX = 25;
                            let offsetY = -25;

                            if (angle >= 0 && angle < 90) {
                                offsetX = 0;
                                offsetY = -25;
                            } else if (angle >= 90 && angle < 180) {
                                offsetX = 35;
                                offsetY = 0;
                            } else if (angle >= 180 && angle < 270) {
                                offsetX = 0;
                                offsetY = 25;
                            } else {
                                offsetX = -35;
                                offsetY = 0;
                            }

                            const distanceLabel = createPointTextOverlay(
                                map,
                                dimensionLine.end,
                                `${Math.round(dimensionLine.distance)} ${t('ม')}`,
                                '#6B7280',
                                { x: offsetX, y: offsetY }
                            );
                            overlaysRef.current.overlays.set(
                                `dimension-label-${dimensionLine.id}`,
                                distanceLabel
                            );
                        });
                    }
                });
            }
        }

        if (layerVisibility.plantAreas && data.plantAreas && data.plantAreas.length > 0) {
            data.plantAreas.forEach((area) => {
                const plantAreaPolygon = new google.maps.Polygon({
                    paths: area.coordinates.map((coord) => ({ lat: coord.lat, lng: coord.lng })),
                    fillColor: area.color,
                    fillOpacity: 0.3,
                    strokeColor: area.color,
                    strokeWeight: 2,
                    clickable: true,
                });

                plantAreaPolygon.setMap(map);
                overlaysRef.current.polygons.set(area.id, plantAreaPolygon);

                const plantAreaLabel = createAreaTextOverlay(
                    map,
                    area.coordinates,
                    area.name,
                    area.color
                );
                overlaysRef.current.overlays.set(`plant-area-label-${area.id}`, plantAreaLabel);

                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div style="color: black; text-align: center;">
                            <strong>${area.name}</strong><br/>
                            ${t('พืช')}: ${area.plantData.name}<br/>
                            ${t('ระยะห่างต้น')}: ${area.plantData.plantSpacing} ${t('ม')}<br/>
                            ${t('ระยะห่างแถว')}: ${area.plantData.rowSpacing} ${t('ม')}<br/>
                            ${t('น้ำต่อต้น')}: ${area.plantData.waterNeed} ${t('ล./ครั้ง')}
                        </div>
                    `,
                });

                plantAreaPolygon.addListener('click', (event: google.maps.MapMouseEvent) => {
                    infoWindow.setPosition(event.latLng);
                    infoWindow.open(map);
                });

                overlaysRef.current.infoWindows.set(area.id, infoWindow);
            });
        }

        if (currentDrawnZone && currentDrawnZone.coordinates.length > 0) {
            const currentZonePolygon = new google.maps.Polygon({
                paths: currentDrawnZone.coordinates.map((coord) => ({
                    lat: coord.lat,
                    lng: coord.lng,
                })),
                fillColor: currentDrawnZone.color,
                fillOpacity: 0.2,
                strokeColor: currentDrawnZone.color,
                strokeWeight: 3,
                strokeOpacity: 0.8,
                clickable: true,
                zIndex: 101,
            });

            currentZonePolygon.setMap(map);
            overlaysRef.current.polygons.set(`current-${currentDrawnZone.id}`, currentZonePolygon);

            const currentZoneLabel = createAreaTextOverlay(
                map,
                currentDrawnZone.coordinates,
                `${currentDrawnZone.name} (${t('กำลังตรวจสอบ')})`,
                currentDrawnZone.color
            );
            overlaysRef.current.overlays.set(
                `current-zone-label-${currentDrawnZone.id}`,
                currentZoneLabel
            );
        }

        if (manualZones && manualZones.length > 0) {
            manualZones.forEach((zone, index) => {
                if (zone.coordinates.length > 0) {
                    const isSelectedForEdit =
                        isZoneEditMode && selectedZoneForEdit && selectedZoneForEdit.id === zone.id;
                    const zonePolygon = new google.maps.Polygon({
                        paths: zone.coordinates.map((coord) => ({
                            lat: coord.lat,
                            lng: coord.lng,
                        })),
                        fillColor: isSelectedForEdit ? '#ff6b6b' : zone.color,
                        fillOpacity: isSelectedForEdit ? 0.4 : 0.3,
                        strokeColor: isSelectedForEdit ? '#ff0000' : zone.color,
                        strokeWeight: isSelectedForEdit ? 3 : 2,
                        clickable: !data.lateralPipeDrawing.isActive,
                        zIndex: data.lateralPipeDrawing.isActive ? 1 : isSelectedForEdit ? 60 : 100,
                    });

                    zonePolygon.setMap(map);
                    overlaysRef.current.polygons.set(`manual-${zone.id}`, zonePolygon);

                    const zoneLabel = createAreaTextOverlay(
                        map,
                        zone.coordinates,
                        zone.name,
                        zone.color
                    );
                    overlaysRef.current.overlays.set(`manual-zone-label-${zone.id}`, zoneLabel);

                    const infoWindow = new google.maps.InfoWindow({
                        content: `
                            <div style="color: black; text-align: center;">
                                <strong>${zone.name}</strong><br/>
                                ${t('จำนวนต้น')}: ${zone.plants.length} ${t('ต้น')}<br/>
                                ${t('น้ำรวม')}: ${formatWaterVolume(zone.totalWaterNeed, t)}<br/>
                                ${t('สถานะ')}: ✅ ${t('ยอมรับแล้ว')}
                            </div>
                        `,
                    });

                    zonePolygon.addListener('click', (event: google.maps.MapMouseEvent) => {
                        if (isZoneEditMode && onManualZoneSelect) {
                            // โหมดแก้ไขโซน - เลือกโซนที่วาดเองเพื่อแก้ไข
                            onManualZoneSelect(zone);
                        } else if (data.lateralPipeDrawing.isActive && onLateralPipeClick) {
                            onLateralPipeClick(event);
                        } else {
                            infoWindow.setPosition(event.latLng);
                            infoWindow.open(map);
                        }
                    });

                    if (data.lateralPipeDrawing.isActive && onLateralPipeMouseMove) {
                        zonePolygon.addListener('mousemove', onLateralPipeMouseMove);
                    }

                    overlaysRef.current.infoWindows.set(`manual-${zone.id}`, infoWindow);
                }
            });
        }

        if (data.irrigationZones && data.irrigationZones.length > 0) {
            data.irrigationZones.forEach((zone, index) => {
                // 🔧 แก้ไข: ตรวจสอบโซนให้ละเอียดมากขึ้น
                if (zone && zone.coordinates && zone.coordinates.length >= 3) {
                    const isSelectedForEdit =
                        isZoneEditMode && selectedZoneForEdit && selectedZoneForEdit.id === zone.id;

                    // 🔧 แก้ไข: ตรวจสอบว่าพิกัดถูกต้องหรือไม่
                    const validCoordinates = zone.coordinates.filter(
                        (coord) =>
                            coord &&
                            typeof coord.lat === 'number' &&
                            typeof coord.lng === 'number' &&
                            !isNaN(coord.lat) &&
                            !isNaN(coord.lng)
                    );

                    if (validCoordinates.length >= 3) {
                        const zonePolygon = new google.maps.Polygon({
                            paths: validCoordinates.map((coord) => ({
                                lat: coord.lat,
                                lng: coord.lng,
                            })),
                            fillColor: isSelectedForEdit ? '#ff6b6b' : zone.color,
                            fillOpacity: isSelectedForEdit ? 0.4 : 0.3,
                            strokeColor: isSelectedForEdit ? '#ff0000' : zone.color,
                            strokeWeight: isSelectedForEdit ? 3 : 2,
                            clickable: !data.lateralPipeDrawing.isActive,
                            zIndex: data.lateralPipeDrawing.isActive
                                ? 1
                                : isSelectedForEdit
                                  ? 60
                                  : 50,
                        });

                        zonePolygon.setMap(map);
                        overlaysRef.current.polygons.set(zone.id, zonePolygon);

                        const zoneLabel = createAreaTextOverlay(
                            map,
                            validCoordinates,
                            zone.name,
                            zone.color
                        );
                        overlaysRef.current.overlays.set(
                            `irrigation-zone-label-${zone.id}`,
                            zoneLabel
                        );

                        const infoWindow = new google.maps.InfoWindow({
                            content: `
                                <div style="color: black; text-align: center;">
                                    <strong>${zone.name}</strong><br/>
                                    ${t('จำนวนต้น')}: ${zone.plants.length} ${t('ต้น')}<br/>
                                    ${t('น้ำรวม')}: ${formatWaterVolume(zone.totalWaterNeed, t)}
                                </div>
                            `,
                        });

                        zonePolygon.addListener('click', (event: google.maps.MapMouseEvent) => {
                            if (isZoneEditMode && onZoneSelect) {
                                // โหมดแก้ไขโซน - เลือกโซนเพื่อแก้ไข
                                onZoneSelect(zone);
                            } else if (data.lateralPipeDrawing.isActive && onLateralPipeClick) {
                                onLateralPipeClick(event);
                            } else {
                                infoWindow.setPosition(event.latLng);
                                infoWindow.open(map);
                            }
                        });

                        if (data.lateralPipeDrawing.isActive && onLateralPipeMouseMove) {
                            zonePolygon.addListener('mousemove', onLateralPipeMouseMove);
                        }

                        overlaysRef.current.infoWindows.set(zone.id, infoWindow);
                    } else {
                        console.warn(
                            `⚠️ Zone ${zone.id} has invalid coordinates, skipping rendering`
                        );
                    }
                }
            });
        }

        // แสดงจุดควบคุมสำหรับโซนที่เลือกแก้ไข
        if (isZoneEditMode && selectedZoneForEdit && zoneControlPoints.length > 0) {
            zoneControlPoints.forEach((point, index) => {
                // ตอนนี้ทุกจุดเป็น corner point เพราะไม่มี midpoint แล้ว
                const isCornerPoint = true;
                const controlPointMarker = new google.maps.Marker({
                    position: { lat: point.lat, lng: point.lng },
                    map: map,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 10, // เพิ่มขนาดให้คลิกง่าย
                        fillColor: '#ff0000', // สีแดงสำหรับจุดมุม
                        fillOpacity: 0.9,
                        strokeColor: '#ffffff',
                        strokeWeight: 3, // เพิ่มขอบให้หนาขึ้น
                    },
                    draggable: true,
                    clickable: true, // เพิ่มเพื่อให้คลิกได้
                    optimized: false, // ปิด optimization เพื่อให้ interaction ดีขึ้น
                    zIndex: 1000, // เพิ่ม z-index ให้สูงขึ้น
                    title: `จุดควบคุม ${index + 1} - ลากเพื่อปรับรูปร่างโซน`,
                    cursor: 'move', // เปลี่ยน cursor เป็นมือเมื่อ hover
                });

                // เพิ่ม hover effect
                controlPointMarker.addListener('mouseover', () => {
                    controlPointMarker.setIcon({
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 12, // ใหญ่ขึ้นเมื่อ hover
                        fillColor: '#ff4444', // สีแดงเข้มขึ้น
                        fillOpacity: 1,
                        strokeColor: '#ffff00', // ขอบสีเหลืองเมื่อ hover
                        strokeWeight: 3,
                    });
                });

                controlPointMarker.addListener('mouseout', () => {
                    controlPointMarker.setIcon({
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 10, // กลับมาขนาดเดิม
                        fillColor: '#ff0000', // กลับมาสีเดิม
                        fillOpacity: 0.9,
                        strokeColor: '#ffffff', // กลับมาขอบสีขาว
                        strokeWeight: 3,
                    });
                });

                // จัดการการลากจุดควบคุม
                controlPointMarker.addListener('dragstart', () => {
                    setDraggedControlPointIndex?.(index);
                    // เปลี่ยนสีเมื่อเริ่มลาก
                    controlPointMarker.setIcon({
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 10,
                        fillColor: '#00ff00', // สีเขียวเมื่อลาง
                        fillOpacity: 1,
                        strokeColor: '#ffffff',
                        strokeWeight: 3,
                    });
                });

                controlPointMarker.addListener('drag', (event: google.maps.MapMouseEvent) => {
                    if (event.latLng) {
                        const newLat = event.latLng.lat();
                        const newLng = event.latLng.lng();

                        // แค่อัปเดตตำแหน่งจุดควบคุมแบบเดิม (ไม่อัปเดต state)
                        // จะให้ dragend handler จัดการ state update
                    }
                });

                controlPointMarker.addListener('dragend', (event: google.maps.MapMouseEvent) => {
                    // กลับสีเป็นปกติหลังจากลากเสร็จ
                    controlPointMarker.setIcon({
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 10,
                        fillColor: '#ff0000', // กลับมาสีแดงปกติ
                        fillOpacity: 0.9,
                        strokeColor: '#ffffff',
                        strokeWeight: 3,
                    });

                    if (event.latLng && onZoneUpdate) {
                        const newLat = event.latLng.lat();
                        const newLng = event.latLng.lng();

                        // คำนวณพิกัดโซนใหม่จากจุดควบคุมที่ถูกลาก (ตอนนี้มีแต่ corner points เท่านั้น)
                        const updatedZoneCoordinates = zoneControlPoints.map((point, i) =>
                            i === index
                                ? { lat: newLat, lng: newLng }
                                : { lat: point.lat, lng: point.lng }
                        );

                        // อัปเดตโซน - handleUpdateZone จะจัดการ control points ให้
                        onZoneUpdate(updatedZoneCoordinates);

                        // selectedZoneForEdit และ zoneControlPoints จะถูกอัปเดตโดย handleUpdateZone
                        // ไม่ต้องอัปเดต control points ที่นี่เพื่อหลีกเลี่ยง race condition
                    }

                    // รีเซ็ต dragged index
                    setDraggedControlPointIndex?.(null);
                });

                overlaysRef.current.markers.set(`control-point-${index}`, controlPointMarker);
            });
        }

        if (data.pump) {
            const pumpMarker = new google.maps.Marker({
                position: { lat: data.pump.position.lat, lng: data.pump.position.lng },
                map: map,
                icon: {
                    url: '/images/water-pump.png',
                    scaledSize: new google.maps.Size(32, 32),
                    anchor: new google.maps.Point(16, 16),
                },
                title: t('ปั๊มน้ำ'),
            });

            overlaysRef.current.markers.set(data.pump.id, pumpMarker);

            const infoWindow = new google.maps.InfoWindow({
                content: `
                    <div style="color: black; text-align: center;">
                        <strong>${t('ปั๊มน้ำ')}</strong><br/>
                    </div>
                `,
            });

            pumpMarker.addListener('click', () => {
                infoWindow.open(map, pumpMarker);
            });

            overlaysRef.current.infoWindows.set(data.pump.id, infoWindow);
        }

        if (layerVisibility.pipes) {
            data.mainPipes.forEach((pipe) => {
                const isSelected = data.selectedItems.pipes.includes(pipe.id);

                // เพิ่มขนาดท่อในโหมดลบเพื่อให้คลิกได้ง่ายขึ้น
                let mainPipeStrokeWeight = 5; // ลดขนาดท่อเมนหลัก
                if (isDeleteMode) {
                    mainPipeStrokeWeight = 10; // ใหญ่มากในโหมดลบ
                } else if (isSelected) {
                    mainPipeStrokeWeight = 8; // ใหญ่เมื่อเลือก
                }

                const mainPipePolyline = new google.maps.Polyline({
                    path: pipe.coordinates.map((coord) => ({ lat: coord.lat, lng: coord.lng })),
                    strokeColor: isSelected ? '#FFD700' : '#FF0000',
                    strokeWeight: mainPipeStrokeWeight,
                    strokeOpacity: 0.9,
                    clickable: true,
                    zIndex: isDeleteMode ? 2100 : isSelected ? 1600 : 1300, // เพิ่ม z-index สูงสำหรับ mainPipe
                });

                mainPipePolyline.setMap(map);
                overlaysRef.current.polylines.set(pipe.id, mainPipePolyline);

                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div style="color: black; text-align: center;">
                            <strong>${t('ท่อเมน')}</strong><br/>
                            ${t('ความยาว')}: ${pipe.length.toFixed(2)} ${t('ม.')}<br/>
                            ${t('เส้นผ่านศูนย์กลาง')}: ${pipe.diameter} ${t('มม.')}<br/>
                            ${t('ไปยังโซน')}: ${pipe.toZone}<br/>
                            ${data.isEditModeEnabled ? '<br/><button onclick="window.selectPipe(\'' + pipe.id + '\')" style="background: #9333EA; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">' + (isSelected ? t('ยกเลิกเลือก') : t('เลือกท่อ')) + '</button>' : ''}
                        </div>
                    `,
                });

                mainPipePolyline.addListener('click', (event: google.maps.MapMouseEvent) => {
                    // หยุด event propagation ทันทีเพื่อป้องกันการคลิกโดนอื่น
                    if (event.stop) event.stop();
                    if (event.domEvent) {
                        event.domEvent.stopPropagation();
                        event.domEvent.preventDefault();
                    }

                    const domEvent = event.domEvent as MouseEvent;

                    // ปิดการลบในโหมด left-click
                    // if (isDeleteMode) {
                    //     // ในโหมดลบ ให้แสดงข้อความยืนยัน
                    //     if (confirm(t('คุณต้องการลบท่อเมนนี้หรือไม่?'))) {
                    //         handleDeletePipe(pipe.id, 'mainPipe');
                    //     }
                    // } else
                    if (data.curvedPipeEditing.isEnabled) {
                        // ในโหมดแก้ไขรูปร่างท่อ - เพิ่มท่อเข้าสู่การแก้ไข
                        const isCurrentlyEditing = data.curvedPipeEditing.editingPipes.has(pipe.id);
                        handleCurvedPipeEditingChange(pipe.id, !isCurrentlyEditing);
                    } else if (
                        data.isEditModeEnabled &&
                        data.editModeSettings.selectionMode !== 'single' &&
                        domEvent?.ctrlKey
                    ) {
                        // การเลือกท่อในโหมดแก้ไข
                        onSelectItem(pipe.id, 'pipes');
                    } else if (!data.lateralPipeDrawing.isActive) {
                        // แสดง info window เมื่อไม่อยู่ในโหมดวาดท่อย่อย
                        infoWindow.setPosition(event.latLng);
                        infoWindow.open(map);
                    }

                    // หยุด event bubble ขึ้นไปยัง map
                    return false;
                });

                // เพิ่ม right-click listener สำหรับการลบท่อ
                mainPipePolyline.addListener('rightclick', (event: google.maps.MapMouseEvent) => {
                    // หยุด event propagation
                    if (event.stop) event.stop();
                    if (event.domEvent) {
                        event.domEvent.stopPropagation();
                        event.domEvent.preventDefault();
                    }

                    // ลบท่อเฉพาะในโหมดลบเท่านั้น
                    if (isDeleteMode) {
                        handleDeletePipe(pipe.id, 'mainPipe');
                    }

                    return false;
                });

                overlaysRef.current.infoWindows.set(pipe.id, infoWindow);
            });

            if (
                data.lateralPipeDrawing.isActive &&
                data.lateralPipeDrawing.startPoint &&
                data.lateralPipeDrawing.rawCurrentPoint
            ) {
                const currentTimestamp = Date.now();

                // 🚀 กำหนดจุดเริ่มต้นสำหรับ preview ตาม multi-segment mode
                let previewStartPoint: Coordinate;
                if (
                    data.lateralPipeDrawing.isMultiSegmentMode &&
                    data.lateralPipeDrawing.waypoints.length > 0
                ) {
                    // ใช้ waypoint ล่าสุดเป็นจุดเริ่มต้น
                    previewStartPoint =
                        data.lateralPipeDrawing.waypoints[
                            data.lateralPipeDrawing.waypoints.length - 1
                        ];
                } else {
                    // ใช้จุดเริ่มต้นปกติ
                    previewStartPoint =
                        data.lateralPipeDrawing.snappedStartPoint ||
                        data.lateralPipeDrawing.startPoint;
                }

                const snappedStartPointLatLng = new google.maps.LatLng(
                    previewStartPoint.lat,
                    previewStartPoint.lng
                );
                const rawCurrentPointLatLng = new google.maps.LatLng(
                    data.lateralPipeDrawing.rawCurrentPoint.lat,
                    data.lateralPipeDrawing.rawCurrentPoint.lng
                );
                const alignedCurrentPointLatLng = data.lateralPipeDrawing.currentPoint
                    ? new google.maps.LatLng(
                          data.lateralPipeDrawing.currentPoint.lat,
                          data.lateralPipeDrawing.currentPoint.lng
                      )
                    : null;

                // 🚀 ล้าง preview polylines เก่า
                const mainPreviewPolyline =
                    overlaysRef.current.polylines.get('lateral-main-preview');
                if (mainPreviewPolyline) {
                    mainPreviewPolyline.setMap(null);
                    overlaysRef.current.polylines.delete('lateral-main-preview');
                }

                // 🚀 ล้าง waypoint polylines เก่า
                const waypointPreviewPolyline = overlaysRef.current.polylines.get(
                    'lateral-waypoint-preview'
                );
                if (waypointPreviewPolyline) {
                    waypointPreviewPolyline.setMap(null);
                    overlaysRef.current.polylines.delete('lateral-waypoint-preview');
                }

                // 🚀 แสดงเส้นท่อที่วาดไปแล้ว (waypoints) สำหรับ multi-segment
                if (
                    data.lateralPipeDrawing.isMultiSegmentMode &&
                    data.lateralPipeDrawing.waypoints.length > 0
                ) {
                    const completedPath: google.maps.LatLng[] = [];

                    // เริ่มจากจุดเริ่มต้น
                    const originalStartPoint =
                        data.lateralPipeDrawing.snappedStartPoint ||
                        data.lateralPipeDrawing.startPoint;
                    completedPath.push(
                        new google.maps.LatLng(originalStartPoint.lat, originalStartPoint.lng)
                    );

                    // เพิ่ม waypoints ทั้งหมด
                    data.lateralPipeDrawing.waypoints.forEach((waypoint) => {
                        completedPath.push(new google.maps.LatLng(waypoint.lat, waypoint.lng));
                    });

                    // สร้าง polyline สำหรับส่วนที่วาดเสร็จแล้ว
                    const waypointPolyline = new google.maps.Polyline({
                        path: completedPath,
                        strokeColor: '#FF6B35', // สีส้มสำหรับส่วนที่วาดเสร็จแล้ว
                        strokeWeight: 4,
                        strokeOpacity: 0.8,
                        icons: [
                            {
                                icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 2 },
                                offset: '0',
                                repeat: '10px',
                            },
                        ],
                        clickable: false,
                        zIndex: 2800,
                        map: map,
                    });
                    overlaysRef.current.polylines.set('lateral-waypoint-preview', waypointPolyline);
                }

                let snapPreviewPolyline = overlaysRef.current.polylines.get('lateral-snap-preview');
                if (
                    alignedCurrentPointLatLng &&
                    data.lateralPipeDrawing.selectedPlants.length > 0 &&
                    (Math.abs(alignedCurrentPointLatLng.lat() - rawCurrentPointLatLng.lat()) >
                        0.000001 ||
                        Math.abs(alignedCurrentPointLatLng.lng() - rawCurrentPointLatLng.lng()) >
                            0.000001)
                ) {
                    if (!snapPreviewPolyline) {
                        snapPreviewPolyline = new google.maps.Polyline({
                            path: [snappedStartPointLatLng, alignedCurrentPointLatLng],
                            strokeColor: '#00FF00',
                            strokeWeight: 6,
                            strokeOpacity: 1.0,
                            icons: [
                                {
                                    icon: {
                                        path: 'M 0,-1 0,1',
                                        strokeOpacity: 1,
                                        strokeColor: '#00FF00',
                                        scale: 4,
                                    },
                                    offset: '0',
                                    repeat: '40px',
                                },
                            ],
                            clickable: false,
                            zIndex: 2900,
                            map: map,
                        });
                        overlaysRef.current.polylines.set(
                            'lateral-snap-preview',
                            snapPreviewPolyline
                        );
                    } else {
                        snapPreviewPolyline.setPath([
                            snappedStartPointLatLng,
                            alignedCurrentPointLatLng,
                        ]);
                        snapPreviewPolyline.setOptions({
                            strokeColor: '#00FF00',
                            strokeWeight: 6,
                            strokeOpacity: 1.0,
                            zIndex: 2900 + (currentTimestamp % 100),
                        });
                        if (snapPreviewPolyline.getMap() !== map) {
                            snapPreviewPolyline.setMap(map);
                        }
                    }
                } else {
                    if (snapPreviewPolyline) {
                        snapPreviewPolyline.setMap(null);
                        overlaysRef.current.polylines.delete('lateral-snap-preview');
                    }
                }

                // 🚫 ล้าง selected plant markers (ถูกซ่อนแล้ว)
                // overlaysRef.current.markers.forEach((marker, key) => {
                //     if (key.startsWith('selected-plant-lateral-') || key.startsWith('lateral-start-point-')) {
                //         marker.setMap(null);
                //         overlaysRef.current.markers.delete(key);
                //     }
                // });

                if (
                    data.lateralPipeDrawing.currentPoint &&
                    data.lateralPipeDrawing.snappedStartPoint
                ) {
                    // 🔥 แสดงจุดเชื่อมกับท่อเมนรองด้วยสีแดงเหมือนจุดเชื่อมของท่อย่อยที่สร้างเสร็จแล้ว
                    const startPointMarker = new google.maps.Marker({
                        position: new google.maps.LatLng(
                            data.lateralPipeDrawing.snappedStartPoint.lat,
                            data.lateralPipeDrawing.snappedStartPoint.lng
                        ),
                        map: map,
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 3, // ปรับให้เท่ากับจุดเชื่อมต่ออื่นๆ
                            fillColor: '#FF6B6B', // เปลี่ยนจากสีเขียวเป็นสีแดงเหมือนจุดเชื่อมปกติ
                            fillOpacity: 1.0,
                            strokeColor: '#FFFFFF',
                            strokeWeight: 2, // เพิ่ม strokeWeight เพื่อให้เห็นชัดขึ้น
                        },
                        zIndex: 3600,
                        title: 'จุดเชื่อมต่อกับท่อเมนรอง - จุดเริ่มต้นท่อย่อย', // เปลี่ยน title ให้ชัดเจนขึ้น
                    });
                    overlaysRef.current.markers.set(
                        `lateral-start-point-${currentTimestamp}`,
                        startPointMarker
                    );
                }

                // 🚫 ซ่อน selected plant markers ตามคำขอของผู้ใช้
                // if (data.lateralPipeDrawing.selectedPlants.length > 0) {
                //     data.lateralPipeDrawing.selectedPlants.forEach((plant) => {
                //         const markerKey = `selected-plant-lateral-${plant.id}-${currentTimestamp}`;
                //         const plantMarker = new google.maps.Marker({
                //             position: new google.maps.LatLng(plant.position.lat, plant.position.lng),
                //             map: map,
                //             icon: {
                //                 path: google.maps.SymbolPath.CIRCLE,
                //                 scale: 8,
                //                 fillColor: '#FFD700',
                //                 fillOpacity: 1.0,
                //                 strokeColor: '#FF4500',
                //                 strokeWeight: 2,
                //             },
                //             zIndex: 3500 + (currentTimestamp % 100),
                //         });
                //         overlaysRef.current.markers.set(markerKey, plantMarker);
                //     });
                // }

                setTimeout(() => {
                    try {
                        if (map) {
                            map.panBy(0, 0);
                            google.maps.event.trigger(map, 'resize');
                            google.maps.event.trigger(map, 'idle');
                        }
                    } catch (error) {
                        console.error('Error:', error);
                    }
                }, 10);
            } else {
                const mainPreviewPolyline =
                    overlaysRef.current.polylines.get('lateral-main-preview');
                if (mainPreviewPolyline) {
                    mainPreviewPolyline.setMap(null);
                    overlaysRef.current.polylines.delete('lateral-main-preview');
                }
                const snapPreviewPolyline =
                    overlaysRef.current.polylines.get('lateral-snap-preview');
                if (snapPreviewPolyline) {
                    snapPreviewPolyline.setMap(null);
                    overlaysRef.current.polylines.delete('lateral-snap-preview');
                }
                // 🚀 ล้าง waypoint polyline ด้วย
                const waypointPreviewPolyline = overlaysRef.current.polylines.get(
                    'lateral-waypoint-preview'
                );
                if (waypointPreviewPolyline) {
                    waypointPreviewPolyline.setMap(null);
                    overlaysRef.current.polylines.delete('lateral-waypoint-preview');
                }
                // 🚫 ล้าง selected plant markers (ถูกซ่อนแล้ว)
                // overlaysRef.current.markers.forEach((marker, key) => {
                //     if (key.startsWith('selected-plant-lateral-') || key.startsWith('lateral-start-point-')) {
                //         marker.setMap(null);
                //         overlaysRef.current.markers.delete(key);
                //     }
                // });
            }

            data.lateralPipes.forEach((lateralPipe) => {
                if (!data.layerVisibility.lateralPipes) return;

                const isSelectedInConnectionMode =
                    data.pipeConnection.isActive &&
                    data.pipeConnection.selectedPoints.some(
                        (p) => p.id === lateralPipe.id && p.type === 'lateralPipe'
                    );
                const isSelected = data.selectedItems.pipes.includes(lateralPipe.id);
                const isHighlighted = highlightedPipes.includes(lateralPipe.id);

                let strokeColor = '#FFD700';
                let strokeWeight = 2; // ลดขนาดท่อเมน
                let strokeOpacity = 0.9;

                // เพิ่มขนาดท่อในโหมดลบเพื่อให้คลิกได้ง่ายขึ้น
                if (isDeleteMode) {
                    strokeWeight = 10; // ใหญ่มากในโหมดลบ
                    strokeOpacity = 1;
                } else if (isSelectedInConnectionMode) {
                    strokeColor = '#FFD700';
                    strokeWeight = 6; // ลดขนาดท่อ
                    strokeOpacity = 1;
                } else if (isSelected || isHighlighted) {
                    strokeWeight = 4; // ลดขนาดเมื่อเลือก
                    strokeOpacity = 1;
                } else if (data.pipeConnection.isActive) {
                    strokeColor = '#D1D5DB';
                    strokeOpacity = 0.7;
                }

                const lateralPolyline = new google.maps.Polyline({
                    path: lateralPipe.coordinates.map((coord) => ({
                        lat: coord.lat,
                        lng: coord.lng,
                    })),
                    strokeColor: strokeColor,
                    strokeWeight: strokeWeight,
                    strokeOpacity: strokeOpacity,
                    clickable: true,
                    zIndex: isDeleteMode ? 1900 : isSelected || isHighlighted ? 1400 : 1100, // เพิ่ม z-index สูงสำหรับ lateral pipe
                });

                lateralPolyline.setMap(map);
                overlaysRef.current.polylines.set(lateralPipe.id, lateralPolyline);

                // 🚀 แสดงจุดเชื่อมต่อถ้ามี intersection data และอยู่ในโซนเดียวกัน
                if (lateralPipe.intersectionData && data.layerVisibility.lateralPipes) {
                    // 🔥 เช็คโซนของท่อย่อย
                    const lateralZone = findPipeZone(
                        lateralPipe,
                        data.zones,
                        data.irrigationZones || manualZones
                    );

                    // 🔥 หาท่อเมนรองที่เชื่อมด้วย
                    const connectedSubMain = data.subMainPipes.find(
                        (pipe) => pipe.id === lateralPipe.intersectionData?.subMainPipeId
                    );
                    const subMainZone = connectedSubMain
                        ? findPipeZone(
                              connectedSubMain,
                              data.zones,
                              data.irrigationZones || manualZones
                          )
                        : null;

                    // 🚨 แสดงจุดเชื่อมเฉพาะเมื่ออยู่ในโซนเดียวกัน
                    if (lateralZone && subMainZone && lateralZone === subMainZone) {
                        const connectionMarker = new google.maps.Marker({
                            position: new google.maps.LatLng(
                                lateralPipe.intersectionData.point.lat,
                                lateralPipe.intersectionData.point.lng
                            ),
                            map: map,
                            icon: {
                                path: google.maps.SymbolPath.CIRCLE,
                                scale: 3, // ลดขนาดจาก 4 เป็น 3
                                fillColor: '#F59E0B', // ใช้สีเหลืองเหมือนหน้า Results
                                fillOpacity: 1.0,
                                strokeColor: '#FFFFFF',
                                strokeWeight: 1.5, // ลดความหนาของขอบ
                            },
                            zIndex: 2000,
                            title: `จุดเชื่อมต่อท่อย่อย: ${lateralPipe.id}`,
                        });
                        overlaysRef.current.markers.set(
                            `connection-${lateralPipe.id}`,
                            connectionMarker
                        );

                        // เพิ่ม info window สำหรับแสดงสถิติ
                        const infoWindow = new google.maps.InfoWindow({
                            content: `
                            <div class="p-3 min-w-[250px]">
                                <h4 class="font-bold text-gray-800 mb-2">📊 สถิติท่อย่อย</h4>
                                <div class="space-y-1 text-sm">
                                    <p><strong>ท่อเส้นรวม:</strong> ${lateralPipe.intersectionData.segmentStats.total.length.toFixed(1)} ม.</p>
                                    <p><strong>ต้นไม้ทั้งหมด:</strong> ${lateralPipe.intersectionData.segmentStats.total.plants.length} ต้น</p>
                                    <p><strong>น้ำรวม:</strong> ${lateralPipe.intersectionData.segmentStats.total.waterNeed.toFixed(1)} ลิตร/นาที</p>
                                    <hr class="my-2">
                                    <p><strong>ส่วนที่ 1:</strong> ${lateralPipe.intersectionData.segmentStats.segment1.length.toFixed(1)} ม. 
                                    (${lateralPipe.intersectionData.segmentStats.segment1.plants.length} ต้น, 
                                    ${lateralPipe.intersectionData.segmentStats.segment1.waterNeed.toFixed(1)} ลิตร/นาที)</p>
                                    <p><strong>ส่วนที่ 2:</strong> ${lateralPipe.intersectionData.segmentStats.segment2.length.toFixed(1)} ม. 
                                    (${lateralPipe.intersectionData.segmentStats.segment2.plants.length} ต้น, 
                                    ${lateralPipe.intersectionData.segmentStats.segment2.waterNeed.toFixed(1)} ลิตร/นาที)</p>
                                </div>
                            </div>
                        `,
                        });

                        connectionMarker.addListener('click', () => {
                            infoWindow.open(map, connectionMarker);
                        });
                    }
                }

                lateralPolyline.addListener('click', (event: google.maps.MapMouseEvent) => {
                    // หยุด event propagation ทันทีเพื่อป้องกันการคลิกโดนอื่น
                    if (event.stop) event.stop();
                    if (event.domEvent) {
                        event.domEvent.stopPropagation();
                        event.domEvent.preventDefault();
                    }

                    // ปิดการลบในโหมด left-click
                    // if (isDeleteMode) {
                    //     if (confirm(t('คุณต้องการลบท่อย่อยนี้หรือไม่?'))) {
                    //         handleDeletePipe(lateralPipe.id, 'lateralPipe');
                    //     }
                    // } else
                    if (data.pipeConnection.isActive && event.latLng) {
                        onPipeClickInConnectionMode(lateralPipe.id, 'lateralPipe', {
                            lat: event.latLng.lat(),
                            lng: event.latLng.lng(),
                        });
                    } else if (onLateralPipeClick && !data.curvedPipeEditing.isEnabled) {
                        onLateralPipeClick(event, lateralPipe.id);
                    }

                    // หยุด event bubble ขึ้นไปยัง map
                    return false;
                });

                // เพิ่ม right-click listener สำหรับการลบท่อย่อย
                lateralPolyline.addListener('rightclick', (event: google.maps.MapMouseEvent) => {
                    // หยุด event propagation
                    if (event.stop) event.stop();
                    if (event.domEvent) {
                        event.domEvent.stopPropagation();
                        event.domEvent.preventDefault();
                    }

                    // ลบท่อเฉพาะในโหมดลบเท่านั้น
                    if (isDeleteMode) {
                        handleDeletePipe(lateralPipe.id, 'lateralPipe');
                    }

                    return false;
                });

                if (
                    data.layerVisibility.emitterLines &&
                    lateralPipe.emitterLines &&
                    lateralPipe.emitterLines.length > 0
                ) {
                    lateralPipe.emitterLines.forEach((emitterLine) => {
                        const emitterPolyline = new google.maps.Polyline({
                            path: emitterLine.coordinates.map((coord) => ({
                                lat: coord.lat,
                                lng: coord.lng,
                            })),
                            strokeColor: '#FFB347',
                            strokeWeight: 2, // 🚀 เพิ่มความหนาให้เห็นชัดขึ้น
                            strokeOpacity: 0.8, // 🚀 เพิ่มความชัดของเส้น
                            clickable: false,
                        });

                        emitterPolyline.setMap(map);
                        overlaysRef.current.polylines.set(emitterLine.id, emitterPolyline);
                    });
                } else if (
                    data.layerVisibility.emitterLines &&
                    lateralPipe.placementMode === 'between_plants'
                ) {
                    // 🚀 ถ้าไม่มี emitterLines แต่เป็นโหมด between_plants ให้สร้างใหม่
                    console.log(
                        'Generating emitter lines for existing lateral pipe:',
                        lateralPipe.id,
                        lateralPipe.plants?.length || 0,
                        'plants'
                    );

                    if (
                        lateralPipe.plants &&
                        lateralPipe.plants.length > 0 &&
                        lateralPipe.coordinates.length >= 2
                    ) {
                        const generatedEmitterLines = generateEmitterLinesForBetweenPlantsMode(
                            lateralPipe.id,
                            lateralPipe.coordinates[0],
                            lateralPipe.coordinates[lateralPipe.coordinates.length - 1],
                            lateralPipe.plants,
                            4 // emitterDiameter
                        );

                        generatedEmitterLines.forEach((emitterLine) => {
                            const emitterPolyline = new google.maps.Polyline({
                                path: emitterLine.coordinates.map((coord) => ({
                                    lat: coord.lat,
                                    lng: coord.lng,
                                })),
                                strokeColor: '#FF6B35', // 🚀 ใช้สีส้มให้เห็นชัด
                                strokeWeight: 2,
                                strokeOpacity: 0.8,
                                clickable: false,
                            });

                            emitterPolyline.setMap(map);
                            overlaysRef.current.polylines.set(emitterLine.id, emitterPolyline);
                        });
                    }
                }

                const lateralInfoWindow = new google.maps.InfoWindow({
                    content: `
                        <div style="color: black; text-align: center;">
                            <strong>${t('ท่อย่อย')}</strong><br/>
                            ${t('ความยาว')}: ${(lateralPipe.length || 0).toFixed(2)} ${t('ม.')}<br/>
                            ${t('ต้นไม้')}: ${lateralPipe.plantCount || 0} ${t('ต้น')}<br/>
                            ${t('ปริมาณน้ำ')}: ${(lateralPipe.totalWaterNeed || 0).toFixed(1)} L<br/>
                            ${t('โหมดการวาง')}: ${lateralPipe.placementMode === 'over_plants' ? t('วางทับแนวต้นไม้') : t('วางระหว่างแนวต้นไม้')}<br/>
                            ${t('ท่อแยกย่อย')}: ${(lateralPipe.emitterLines || []).length} ${t('เส้น')}<br/>
                        </div>
                    `,
                });

                lateralPolyline.addListener('click', (event: google.maps.MapMouseEvent) => {
                    lateralInfoWindow.setPosition(event.latLng);
                    lateralInfoWindow.open(map);
                });

                overlaysRef.current.infoWindows.set(lateralPipe.id, lateralInfoWindow);
            });

            // 🚀 แสดงจุดเชื่อมต่อระหว่างท่อเมนกับท่อเมนรอง (เฉพาะท่อในโซนเดียวกัน)
            if (data.layerVisibility.pipes) {
                // 🔥 แสดงจุดเชื่อมต่อปลาย-ปลาย (End-to-End) - สีแดง (เฉพาะระยะไม่เกิน 1 เมตร)
                const endToEndConnections = findEndToEndConnections(
                    data.mainPipes,
                    data.subMainPipes,
                    data.zones,
                    data.irrigationZones || manualZones,
                    15 // ใช้ snapThreshold 15 เมตรสำหรับการค้นหา แต่ภายในฟังก์ชันจะใช้ 1 เมตรสำหรับ end-to-end
                );

                // ✅ แสดงเฉพาะจุดเชื่อมต่อที่มีการเชื่อมต่อจริงๆ
                endToEndConnections.forEach((connection, index) => {
                    const connectionMarker = new google.maps.Marker({
                        position: new google.maps.LatLng(
                            connection.connectionPoint.lat,
                            connection.connectionPoint.lng
                        ),
                        map: map,
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 5, // เพิ่มขนาดให้เห็นชัดขึ้น
                            fillColor: '#DC2626', // สีแดงสำหรับปลาย-ปลาย
                            fillOpacity: 0.9,
                            strokeColor: '#FFFFFF',
                            strokeWeight: 2,
                        },
                        zIndex: 2001,
                        title: `จุดเชื่อมต่อปลาย-ปลาย (ท่อเมน ↔ ท่อเมนรอง)`,
                    });
                    overlaysRef.current.markers.set(
                        `end-to-end-connection-${connection.mainPipeId}-${connection.subMainPipeId}`,
                        connectionMarker
                    );

                    // เพิ่ม info window
                    const infoWindow = new google.maps.InfoWindow({
                        content: `
                            <div class="p-2 min-w-[200px]">
                                <h4 class="font-bold text-gray-800 mb-2">🔗 จุดเชื่อมต่อปลาย-ปลาย (≤ 1m)</h4>
                                <div class="space-y-1 text-sm">
                                    <p><strong>ท่อเมน:</strong> ${connection.mainPipeId}</p>
                                    <p><strong>ท่อเมนรอง:</strong> ${connection.subMainPipeId}</p>
                                </div>
                            </div>
                        `,
                    });

                    connectionMarker.addListener('click', () => {
                        infoWindow.open(map, connectionMarker);
                    });
                });

                // 🔥 แสดงจุดเชื่อมต่อปลายท่อเมนกับระหว่างท่อเมนรอง - สีน้ำเงิน (mid-connection)
                const mainToSubMainConnections = findMainToSubMainConnections(
                    data.mainPipes,
                    data.subMainPipes,
                    data.zones, // ส่ง zones
                    data.irrigationZones || manualZones, // ส่ง irrigationZones
                    15 // ใช้ snapThreshold 15 เมตรสำหรับ mid-connection
                );

                // ✅ แสดงจุดเชื่อมต่อระหว่างท่อเมนกับท่อเมนรอง
                mainToSubMainConnections.forEach((connection, index) => {
                    // ใช้ AdvancedMarkerElement แทน Marker (deprecated)
                    const connectionMarker = new google.maps.Marker({
                        position: new google.maps.LatLng(
                            connection.connectionPoint.lat,
                            connection.connectionPoint.lng
                        ),
                        map: map,
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 4, // เพิ่มขนาดให้เห็นชัดขึ้น
                            fillColor: '#3B82F6', // สีน้ำเงินสำหรับปลายเมน-ระหว่างเมนรอง
                            fillOpacity: 1.0,
                            strokeColor: '#FFFFFF',
                            strokeWeight: 2, // เพิ่มความหนาของขอบ
                        },
                        zIndex: 2001,
                        title: `จุดเชื่อมต่อปลายท่อเมน → ระหว่างท่อเมนรอง`,
                    });
                    overlaysRef.current.markers.set(
                        `main-submain-connection-${connection.mainPipeId}-${connection.subMainPipeId}`,
                        connectionMarker
                    );

                    // เพิ่ม info window
                    const infoWindow = new google.maps.InfoWindow({
                        content: `
                            <div class="p-2 min-w-[200px]">
                                <h4 class="font-bold text-gray-800 mb-2">🔗 จุดเชื่อมต่อปลายท่อเมน → ระหว่างท่อเมนรอง (mid-connection)</h4>
                                <div class="space-y-1 text-sm">
                                    <p><strong>ท่อเมน:</strong> ${connection.mainPipeId}</p>
                                    <p><strong>ท่อเมนรอง:</strong> ${connection.subMainPipeId}</p>
                                </div>
                            </div>
                        `,
                    });

                    connectionMarker.addListener('click', () => {
                        infoWindow.open(map, connectionMarker);
                    });
                });

                // 🔥 แสดงจุดเชื่อมต่อแบบ Mid-connections (ท่อเมนรองเชื่อมกลางท่อเมน)
                const subMainToMainMidConnections = findMidConnections(
                    data.subMainPipes,
                    data.mainPipes,
                    20, // snapThreshold
                    data.zones,
                    data.irrigationZones || manualZones
                );

                subMainToMainMidConnections.forEach((connection, index) => {
                    const midConnectionMarker = new google.maps.Marker({
                        position: new google.maps.LatLng(
                            connection.connectionPoint.lat,
                            connection.connectionPoint.lng
                        ),
                        map: map,
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 4, // เพิ่มขนาดให้เห็นชัดขึ้น
                            fillColor: '#8B5CF6', // สีม่วงเข้มสำหรับเมนรอง-กลางเมน
                            fillOpacity: 1.0,
                            strokeColor: '#FFFFFF',
                            strokeWeight: 2, // เพิ่มความหนาของขอบ
                        },
                        zIndex: 2004,
                        title: `จุดเชื่อมท่อเมนรอง → กลางท่อเมน`,
                    });
                    overlaysRef.current.markers.set(
                        `submain-mainmid-connection-${connection.sourcePipeId}-${connection.targetPipeId}`,
                        midConnectionMarker
                    );

                    // เพิ่ม info window
                    const infoWindow = new google.maps.InfoWindow({
                        content: `
                            <div class="p-2 min-w-[200px]">
                                <h4 class="font-bold text-gray-800 mb-2">🔗 จุดเชื่อมท่อเมนรอง → กลางท่อเมน</h4>
                                <div class="space-y-1 text-sm">
                                    <p><strong>ท่อเมนรอง:</strong> ${connection.sourcePipeId}</p>
                                    <p><strong>ท่อเมน:</strong> ${connection.targetPipeId}</p>
                                </div>
                            </div>
                        `,
                    });

                    midConnectionMarker.addListener('click', () => {
                        infoWindow.open(map, midConnectionMarker);
                    });
                });

                // 🚀 แสดงจุดเชื่อมต่อระหว่างท่อเมนรองกับท่อย่อย (เฉพาะท่อในโซนเดียวกัน)
                const subMainToLateralConnections = findSubMainToLateralStartConnections(
                    data.subMainPipes,
                    data.lateralPipes,
                    data.zones, // ส่ง zones
                    data.irrigationZones || manualZones, // ส่ง irrigationZones
                    10 // snapThreshold - ลดเป็น 10 เมตร เพื่อความแม่นยำ
                );

                // ✅ แสดงจุดเชื่อมต่อระหว่างท่อเมนรองกับท่อย่อย
                subMainToLateralConnections.forEach((connection, index) => {
                    const connectionMarker = new google.maps.Marker({
                        position: new google.maps.LatLng(
                            connection.connectionPoint.lat,
                            connection.connectionPoint.lng
                        ),
                        map: map,
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 3, // ปรับให้เท่ากับจุดเชื่อมต่ออื่นๆ
                            fillColor: '#F59E0B', // สีเหลืองทองเหมือนในหน้า Results
                            fillOpacity: 1.0,
                            strokeColor: '#FFFFFF',
                            strokeWeight: 1.5, // ปรับให้เท่ากับจุดเชื่อมต่ออื่นๆ
                        },
                        zIndex: 2002,
                        title: `จุดเชื่อมต่อท่อเมนรอง → ท่อย่อย`,
                    });
                    overlaysRef.current.markers.set(
                        `submain-lateral-connection-${connection.subMainPipeId}-${connection.lateralPipeId}`,
                        connectionMarker
                    );

                    // เพิ่ม info window
                    const infoWindow = new google.maps.InfoWindow({
                        content: `
                            <div class="p-2 min-w-[200px]">
                                <h4 class="font-bold text-gray-800 mb-2">🔗 จุดเชื่อมต่อ</h4>
                                <div class="space-y-1 text-sm">
                                    <p><strong>ท่อเมนรอง:</strong> ${connection.subMainPipeId}</p>
                                    <p><strong>ท่อย่อย:</strong> ${connection.lateralPipeId}</p>
                                </div>
                            </div>
                        `,
                    });

                    connectionMarker.addListener('click', () => {
                        infoWindow.open(map, connectionMarker);
                    });
                });

                // 🚀 แสดงจุดตัดระหว่างท่อเมนรองกับท่อเมน (เฉพาะท่อในโซนเดียวกัน)
                const subMainToMainIntersections = findSubMainToMainIntersections(
                    data.subMainPipes,
                    data.mainPipes,
                    data.zones, // ส่ง zones
                    data.irrigationZones || manualZones // ส่ง irrigationZones
                );

                // ✅ แสดงจุดตัดระหว่างท่อเมนรองกับท่อเมน
                subMainToMainIntersections.forEach((intersection, index) => {
                    const intersectionMarker = new google.maps.Marker({
                        position: new google.maps.LatLng(
                            intersection.intersectionPoint.lat,
                            intersection.intersectionPoint.lng
                        ),
                        map: map,
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 4, // เพิ่มขนาดให้เห็นชัดขึ้น
                            fillColor: '#3B82F6', // สีน้ำเงินสำหรับตัดเมนรอง-เมน
                            fillOpacity: 1.0,
                            strokeColor: '#FFFFFF',
                            strokeWeight: 2, // เพิ่มความหนาของขอบ
                        },
                        zIndex: 2003,
                        title: `จุดตัดท่อเมนรอง ↔ ท่อเมน`,
                    });
                    overlaysRef.current.markers.set(
                        `submain-main-intersection-${intersection.subMainPipeId}-${intersection.mainPipeId}`,
                        intersectionMarker
                    );

                    // เพิ่ม info window
                    const infoWindow = new google.maps.InfoWindow({
                        content: `
                            <div class="p-2 min-w-[200px]">
                                <h4 class="font-bold text-gray-800 mb-2">⚡ จุดตัดท่อ</h4>
                                <div class="space-y-1 text-sm">
                                    <p><strong>ท่อเมนรอง:</strong> ${intersection.subMainPipeId}</p>
                                    <p><strong>ท่อเมน:</strong> ${intersection.mainPipeId}</p>
                                    <p class="text-xs text-gray-600">ท่อเมนรองลากผ่านท่อเมน</p>
                                </div>
                            </div>
                        `,
                    });

                    intersectionMarker.addListener('click', () => {
                        infoWindow.open(map, intersectionMarker);
                    });
                });

                // 🚀 แสดงจุดตัดระหว่างท่อย่อยกับท่อเมนรอง (เมื่อท่อย่อยลากผ่านท่อเมนรอง)
                const lateralToSubMainIntersections = findLateralToSubMainIntersections(
                    data.lateralPipes,
                    data.subMainPipes,
                    data.zones,
                    data.irrigationZones || manualZones,
                    10 // snapThreshold - ลดเป็น 10 เมตร เพื่อความแม่นยำ
                );

                // ✅ แสดงจุดตัดระหว่างท่อย่อยกับท่อเมนรอง
                lateralToSubMainIntersections.forEach((intersection, index) => {
                    const intersectionMarker = new google.maps.Marker({
                        position: new google.maps.LatLng(
                            intersection.intersectionPoint.lat,
                            intersection.intersectionPoint.lng
                        ),
                        map: map,
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 3, // ขนาดเดียวกับจุดเชื่อมต่ออื่นๆ
                            fillColor: '#10B981', // สีเขียวอ่อนสำหรับจุดตัดท่อย่อย-เมนรอง
                            fillOpacity: 1.0,
                            strokeColor: '#FFFFFF',
                            strokeWeight: 1.5,
                        },
                        zIndex: 2005,
                        title: `จุดตัดท่อย่อย ↔ ท่อเมนรอง`,
                    });
                    overlaysRef.current.markers.set(
                        `lateral-submain-intersection-${intersection.lateralPipeId}-${intersection.subMainPipeId}`,
                        intersectionMarker
                    );

                    // เพิ่ม info window
                    const infoWindow = new google.maps.InfoWindow({
                        content: `
                            <div class="p-2 min-w-[200px]">
                                <h4 class="font-bold text-gray-800 mb-2">⚡ จุดตัดท่อย่อย-เมนรอง</h4>
                                <div class="space-y-1 text-sm">
                                    <p><strong>ท่อย่อย:</strong> ${intersection.lateralPipeId}</p>
                                    <p><strong>ท่อเมนรอง:</strong> ${intersection.subMainPipeId}</p>
                                    <p class="text-xs text-gray-600">ท่อย่อยลากผ่านท่อเมนรอง</p>
                                </div>
                            </div>
                        `,
                    });

                    intersectionMarker.addListener('click', () => {
                        infoWindow.open(map, intersectionMarker);
                    });
                });

                // 🚀 แสดงจุดเชื่อมต่อกลางท่อ (ท่อเมนเชื่อมกับตรงกลางท่อเมนรอง) - เฉพาะโซนเดียวกัน
                const mainToSubMainMidConnections = findMidConnections(
                    data.mainPipes,
                    data.subMainPipes,
                    10, // snapThreshold
                    data.zones, // ส่ง zones
                    data.irrigationZones || manualZones // ส่ง irrigationZones
                );

                // 🚫 ซ่อน main-to-submain mid connection markers ตามคำขอของผู้ใช้
                // mainToSubMainMidConnections.forEach((connection, index) => {
                //     const connectionMarker = new google.maps.Marker({
                //         position: new google.maps.LatLng(
                //             connection.connectionPoint.lat,
                //             connection.connectionPoint.lng
                //         ),
                //         map: map,
                //         icon: {
                //             path: google.maps.SymbolPath.CIRCLE,
                //             scale: 4,
                //             fillColor: '#EC4899', // สีชมพู
                //             fillOpacity: 1.0,
                //             strokeColor: '#FFFFFF',
                //             strokeWeight: 2,
                //         },
                //         zIndex: 2005,
                //         title: `จุดเชื่อมท่อเมน → กลางท่อเมนรอง`
                //     });
                //     overlaysRef.current.markers.set(`main-submainmid-connection-${index}`, connectionMarker);

                //     // เพิ่ม info window
                //     const infoWindow = new google.maps.InfoWindow({
                //         content: `
                //             <div class="p-2 min-w-[200px]">
                //                 <h4 class="font-bold text-gray-800 mb-2">🔗 จุดเชื่อมกลางท่อ</h4>
                //                 <div class="space-y-1 text-sm">
                //                     <p><strong>ท่อเมน:</strong> ${connection.sourcePipeId}</p>
                //                     <p><strong>ท่อเมนรอง:</strong> ${connection.targetPipeId}</p>
                //                     <p class="text-xs text-gray-600">เชื่อมกับตรงกลางท่อ</p>
                //                 </div>
                //             </div>
                //         `
                //     });
            }

            data.subMainPipes.forEach((pipe) => {
                const isHighlighted = highlightedPipes.includes(pipe.id);
                const isSelected = data.selectedItems.pipes.includes(pipe.id);
                const isSelectedInConnectionMode =
                    data.pipeConnection.isActive &&
                    data.pipeConnection.selectedPoints.some(
                        (p) => p.id === pipe.id && p.type === 'subMainPipe'
                    );

                let strokeColor = '#8B5CF6';
                let strokeWeight = 2;
                let strokeOpacity = 0.9;

                // เพิ่มขนาดท่อในโหมดลบเพื่อให้คลิกได้ง่ายขึ้น
                if (isDeleteMode) {
                    strokeWeight = 12; // ใหญ่มากในโหมดลบ
                    strokeOpacity = 1;
                } else if (isSelectedInConnectionMode) {
                    strokeColor = '#8B5CF6';
                    strokeWeight = 8; // ลดขนาดท่อ
                    strokeOpacity = 1;
                } else if (isSelected) {
                    strokeColor = '#FFD700';
                    strokeWeight = 8; // ลดขนาดท่อ
                    strokeOpacity = 1;
                } else if (isHighlighted) {
                    strokeColor = '#FFD700';
                    strokeWeight = 6; // ลดขนาดท่อ
                    strokeOpacity = 1;
                } else if (data.pipeConnection.isActive) {
                    strokeColor = '#D1D5DB';
                    strokeOpacity = 0.7;
                }

                const subMainPipePolyline = new google.maps.Polyline({
                    path: pipe.coordinates.map((coord) => ({ lat: coord.lat, lng: coord.lng })),
                    strokeColor: strokeColor,
                    strokeWeight: strokeWeight,
                    strokeOpacity: strokeOpacity,
                    clickable: true,
                    zIndex: isDeleteMode
                        ? 2000
                        : isSelected || isHighlighted || isSelectedInConnectionMode
                          ? 1500
                          : 1200, // เพิ่ม z-index สูงสำหรับท่อ
                });

                subMainPipePolyline.setMap(map);
                overlaysRef.current.polylines.set(pipe.id, subMainPipePolyline);

                subMainPipePolyline.addListener('click', (event: google.maps.MapMouseEvent) => {
                    // หยุด event propagation ทันทีเพื่อป้องกันการคลิกโดนอื่น
                    if (event.stop) event.stop();
                    if (event.domEvent) {
                        event.domEvent.stopPropagation();
                        event.domEvent.preventDefault();
                    }

                    // ปิดการลบในโหมด left-click
                    // if (isDeleteMode) {
                    //     if (confirm(t('คุณต้องการลบท่อเมนรองนี้หรือไม่?'))) {
                    //         handleDeletePipe(pipe.id, 'subMainPipe');
                    //     }
                    // } else
                    if (data.curvedPipeEditing.isEnabled) {
                        // ในโหมดแก้ไขรูปร่างท่อ - เพิ่มท่อเข้าสู่การแก้ไข
                        const isCurrentlyEditing = data.curvedPipeEditing.editingPipes.has(pipe.id);
                        handleCurvedPipeEditingChange(pipe.id, !isCurrentlyEditing);
                    } else if (data.pipeConnection.isActive && event.latLng) {
                        onPipeClickInConnectionMode(pipe.id, 'subMainPipe', {
                            lat: event.latLng.lat(),
                            lng: event.latLng.lng(),
                        });
                    } else if (isCreatingConnection && isHighlighted && event.latLng) {
                        onConnectToPipe(
                            { lat: event.latLng.lat(), lng: event.latLng.lng() },
                            pipe.id,
                            'subMain'
                        );
                    } else if (
                        data.lateralPipeDrawing.isActive &&
                        data.lateralPipeDrawing.placementMode
                    ) {
                        if (onLateralPipeClick) {
                            onLateralPipeClick(event);
                        }
                    } else if (
                        data.isEditModeEnabled &&
                        data.editModeSettings.selectionMode !== 'single' &&
                        (event.domEvent as MouseEvent)?.ctrlKey
                    ) {
                        onSelectItem(pipe.id, 'pipes');
                    }

                    // หยุด event bubble ขึ้นไปยัง map
                    return false;
                });

                // เพิ่ม right-click listener สำหรับการลบท่อเมนรอง
                subMainPipePolyline.addListener(
                    'rightclick',
                    (event: google.maps.MapMouseEvent) => {
                        // หยุด event propagation
                        if (event.stop) event.stop();
                        if (event.domEvent) {
                            event.domEvent.stopPropagation();
                            event.domEvent.preventDefault();
                        }

                        // ลบท่อเฉพาะในโหมดลบเท่านั้น
                        if (isDeleteMode) {
                            handleDeletePipe(pipe.id, 'subMainPipe');
                        }

                        return false;
                    }
                );

                pipe.branchPipes.forEach((branchPipe) => {
                    const isBranchHighlighted = highlightedPipes.includes(branchPipe.id);
                    const isBranchSelected = data.selectedItems.pipes.includes(branchPipe.id);

                    const branchPolyline = new google.maps.Polyline({
                        path: branchPipe.coordinates.map((coord) => ({
                            lat: coord.lat,
                            lng: coord.lng,
                        })),
                        strokeColor: isBranchSelected
                            ? '#FFD700'
                            : isBranchHighlighted
                              ? '#FFD700'
                              : '#32CD32',
                        strokeWeight: isBranchSelected ? 5 : isBranchHighlighted ? 3 : 2, // ลดขนาดท่อเมน
                        strokeOpacity: isBranchHighlighted || isBranchSelected ? 1 : 0.8,
                        clickable: true,
                        zIndex: isDeleteMode
                            ? 1800
                            : isBranchSelected || isBranchHighlighted
                              ? 1350
                              : 1000, // เพิ่ม z-index สูงสำหรับ branch pipe
                    });

                    branchPolyline.setMap(map);
                    overlaysRef.current.polylines.set(branchPipe.id, branchPolyline);

                    const branchInfoWindow = new google.maps.InfoWindow({
                        content: `
                            <div style="color: black; text-align: center;">
                                <strong>${t('ท่อย่อย')}</strong><br/>
                                ${t('ความยาว')}: ${branchPipe.length.toFixed(2)} ${t('ม.')}<br/>
                                ${t('ต้นไม้')}: ${branchPipe.plants.length} ${t('ต้น')}<br/>
                                ${branchPipe.angle ? `${t('มุม')}: ${branchPipe.angle}°<br/>` : ''}
                                ${branchPipe.connectionPoint ? `${t('จุดต่อ')}: ${(branchPipe.connectionPoint * 100).toFixed(1)}%<br/>` : ''}
                                ${data.isEditModeEnabled ? '<br/><button onclick="window.segmentedPipeDeletion(\'' + branchPipe.id + '\')" style="background: #F97316; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">✂️ ' + t('ลบท่อระหว่างต้นไม้') + '</button>' : ''}
                                ${data.isEditModeEnabled ? '<br/><button onclick="window.selectPipe(\'' + branchPipe.id + '\')" style="background: #9333EA; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer;">' + (isBranchSelected ? t('ยกเลิกเลือก') : t('เลือกท่อ')) + '</button>' : ''}
                                ${isCreatingConnection && isBranchHighlighted ? '<br/><div style="font-size: 12px; color: #FCD34D;">🔗 ' + t('คลิกเพื่อเชื่อมต่อ') + '</div>' : ''}
                            </div>
                        `,
                    });

                    branchPolyline.addListener('click', (event: google.maps.MapMouseEvent) => {
                        event.stop(); // ป้องกัน event propagation ในทุกกรณี
                        // ปิดการลบในโหมด left-click
                        // if (isDeleteMode) {
                        //     if (confirm(t('คุณต้องการลบท่อย่อยนี้หรือไม่?'))) {
                        //         handleDeletePipe(branchPipe.id, 'branchPipe');
                        //     }
                        // } else
                        if (isCreatingConnection && isBranchHighlighted && event.latLng) {
                            onConnectToPipe(
                                { lat: event.latLng.lat(), lng: event.latLng.lng() },
                                branchPipe.id,
                                'branch'
                            );
                        } else {
                            const domEvent = event.domEvent as MouseEvent;
                            if (
                                data.isEditModeEnabled &&
                                data.editModeSettings.selectionMode !== 'single' &&
                                domEvent?.ctrlKey
                            ) {
                                event.stop();
                                onSelectItem(branchPipe.id, 'pipes');
                            } else {
                                branchInfoWindow.setPosition(event.latLng);
                                branchInfoWindow.open(map);
                            }
                        }
                    });

                    // เพิ่ม right-click listener สำหรับการลบท่อสาขา
                    branchPolyline.addListener('rightclick', (event: google.maps.MapMouseEvent) => {
                        // หยุด event propagation
                        event.stop();
                        if (event.domEvent) {
                            event.domEvent.stopPropagation();
                            event.domEvent.preventDefault();
                        }

                        // ลบท่อเฉพาะในโหมดลบเท่านั้น
                        if (isDeleteMode) {
                            handleDeletePipe(branchPipe.id, 'branchPipe');
                        }

                        return false;
                    });

                    overlaysRef.current.infoWindows.set(branchPipe.id, branchInfoWindow);
                });
            });
        }

        if (layerVisibility.plants) {
            data.plants.forEach((plant) => {
                const isConnectionStart = connectionStartPlant?.id === plant.id;
                const isSelected = data.selectedItems.plants.includes(plant.id);
                const isCurrentlyDragging =
                    isDragging && dragTarget?.id === plant.id && dragTarget.type === 'plant';
                const isHighlightedForConnection = highlightedPipes.includes(plant.id);
                const isInPlantMoveMode = isPlantMoveMode;
                const isSelectedForMove = selectedPlantsForMove.has(plant.id);
                const isSelectedInConnectionMode =
                    data.pipeConnection.isActive &&
                    data.pipeConnection.selectedPoints.some(
                        (p) => p.id === plant.id && p.type === 'plant'
                    );

                // 🌱 ตรวจสอบว่าต้นไม้ถูก highlight ขณะลากท่อย่อยหรือไม่
                const isHighlightedForLateralPipe = highlightedPlants.has(plant.id);

                let plantColor = '#22C55E';
                let plantSymbol = '🌳';
                let symbolFontSize = 16;
                let circleRadius = 12;

                if (isSelectedInConnectionMode) {
                    plantColor = '#FF6B35';
                    plantSymbol = '🔗';
                    symbolFontSize = 18;
                    circleRadius = 14;
                } else if (isHighlightedForLateralPipe) {
                    // 🌱 ต้นไม้ที่ถูก highlight ขณะลากท่อย่อย - ขยายใหญ่ขึ้น
                    plantColor = '#10B981';
                    plantSymbol = '🌳';
                    symbolFontSize = 20; // ขยายใหญ่ขึ้น
                    circleRadius = 16; // ขยายใหญ่ขึ้น
                } else if (data.pipeConnection.isActive) {
                    plantColor = '#9CA3AF';
                    plantSymbol = '🌳';
                    symbolFontSize = 14;
                    circleRadius = 10;
                } else if (
                    data.plantSelectionMode.type === 'multiple' &&
                    (plant as any).plantAreaColor
                ) {
                    plantColor = (plant as any).plantAreaColor;
                    plantSymbol = '🌳';
                    symbolFontSize = 10;
                    circleRadius = 8;
                }

                // ปรับ z-index ให้เหมาะสมกับโหมดต่างๆ
                let plantZIndex = 500; // ค่าเริ่มต้นต่ำกว่าท่อ
                let plantClickable = true;
                let plantDraggable = data.isEditModeEnabled;

                // ในโหมดลบ ให้ต้นไม้มี z-index ต่ำและไม่สามารถคลิกได้
                if (isDeleteMode) {
                    plantZIndex = 100; // ต่ำมาก
                    plantClickable = false; // ปิดการคลิก
                    plantDraggable = false; // ปิดการลาก
                }
                // ในโหมดแก้ไขท่อโค้ง ให้ต้นไม้มี z-index ต่ำ
                else if (data.curvedPipeEditing.isEnabled) {
                    plantZIndex = 200;
                    plantClickable = false;
                    plantDraggable = false;
                }
                // ในโหมดวาดท่อย่อย ลด z-index ของต้นไม้ แต่เพิ่มสำหรับต้นไม้ที่ถูก highlight
                else if (data.lateralPipeDrawing.isActive) {
                    plantZIndex = isHighlightedForLateralPipe ? 1200 : 300; // 🌱 สูงขึ้นเมื่อถูก highlight
                }
                // ในโหมดเชื่อมต่อท่อ เพิ่ม z-index สำหรับต้นไม้ที่เกี่ยวข้อง
                else if (data.pipeConnection.isActive && isHighlightedForConnection) {
                    plantZIndex = 1500; // สูงกว่าท่อเพื่อให้คลิกได้
                }
                // โหมดย้ายต้นไม้หรือเลือกต้นไม้
                else if (
                    isInPlantMoveMode ||
                    isSelectedForMove ||
                    data.plantSelectionMode.type === 'multiple'
                ) {
                    plantZIndex = 1200; // สูงกว่าท่อเล็กน้อย
                }

                const plantMarker = new google.maps.Marker({
                    position: { lat: plant.position.lat, lng: plant.position.lng },
                    map: map,
                    icon: {
                        url:
                            'data:image/svg+xml;charset=UTF-8,' +
                            encodeURIComponent(`
                            <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
                                ${isConnectionStart ? '<circle cx="14" cy="14" r="12" fill="none" stroke="#FFD700" stroke-width="3"/>' : ''}
                                ${isSelected ? '<circle cx="14" cy="14" r="11" fill="none" stroke="#9333EA" stroke-width="2"/>' : ''}
                                ${isCurrentlyDragging ? '<circle cx="14" cy="14" r="10" fill="none" stroke="#FF6B35" stroke-width="3"/>' : ''}
                                ${isHighlightedForConnection ? '<circle cx="14" cy="14" r="11" fill="none" stroke="#FFD700" stroke-width="2"/>' : ''}
                                ${isInPlantMoveMode ? '<circle cx="14" cy="14" r="13" fill="none" stroke="#F97316" stroke-width="2" stroke-dasharray="4,2"/>' : ''}
                                ${isSelectedForMove ? '<circle cx="14" cy="14" r="13" fill="none" stroke="#10B981" stroke-width="3"/>' : ''}
                                ${isHighlightedForLateralPipe ? '<circle cx="14" cy="14" r="14" fill="none" stroke="#10B981" stroke-width="3" stroke-dasharray="2,2"/>' : ''}
                            ${data.plantSelectionMode.type === 'multiple' ? `<circle cx="14" cy="14" r="${Math.max(6, circleRadius - 2)}" fill="${plantColor}" />` : ''}
                                <text x="14" y="14" text-anchor="middle" dominant-baseline="central" fill="white" font-size="10" font-weight="bold">${plantSymbol}</text>
                            </svg>
                        `),
                        scaledSize: new google.maps.Size(
                            isHighlightedForLateralPipe ? 36 : 28,
                            isHighlightedForLateralPipe ? 36 : 28
                        ), // 🌱 ขยายใหญ่ขึ้นเมื่อถูก highlight
                        anchor: new google.maps.Point(
                            isHighlightedForLateralPipe ? 18 : 14,
                            isHighlightedForLateralPipe ? 18 : 14
                        ),
                    },
                    title: `${plant.plantData.name} (${plant.id})`,
                    draggable: plantDraggable,
                    clickable: plantClickable,
                    zIndex: plantZIndex,
                });

                overlaysRef.current.markers.set(plant.id, plantMarker);

                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div style="color: black; text-align: center;">
                            <strong>${t(plant.plantData.name)}</strong><br/>
                            ${t('น้ำ')}: ${plant.plantData.waterNeed} ${t('ล./ครั้ง')}<br/>
                            ${t('ระยะปลูก')}: ${plant.plantData.plantSpacing}×${plant.plantData.rowSpacing} ${t('ม.')}<br/>
                            ${data.isEditModeEnabled ? `<div style="font-size: 12px; color: #22C55E;">🖱️ ${t('ลากเพื่อเปลี่ยนตำแหน่ง')}</div>` : ''}
                            ${
                                data.isEditModeEnabled
                                    ? `
                                <br/>
                                <button onclick="window.editPlant('${plant.id}')" style="background: #F59E0B; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; margin: 2px;">✏️ ${t('แก้ไข')}</button>
                                <button onclick="window.createPlantConnection('${plant.id}')" style="background: #3B82F6; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; margin: 2px;">🔗 ${t('เชื่อมต่อ')}</button>
                                <br/>
                                <button onclick="window.selectPlant('${plant.id}')" style="background: #9333EA; color: white; border: none; padding: 4px 8px; border-radius: 4px; cursor: pointer; margin: 2px;">${isSelected ? t('ยกเลิกเลือก') : t('เลือกต้นไม้')}</button>
                            `
                                    : ''
                            }
                            ${isCreatingConnection && isHighlightedForConnection ? '<br/><div style="font-size: 12px; color: #FCD34D;">🔗 คลิกเพื่อเชื่อมต่อ</div>' : ''}
                        </div>
                    `,
                });

                plantMarker.addListener('dblclick', () => {
                    onPlantEdit(plant);
                });

                plantMarker.addListener('click', (event: google.maps.MapMouseEvent) => {
                    if (data.pipeConnection.isActive) {
                        onPlantClickInConnectionMode(plant);
                    } else if (isCreatingConnection && isHighlightedForConnection) {
                        onConnectToPlant(plant.id);
                    } else if (isPlantSelectionMode) {
                        setSelectedPlantsForMove((prev) => {
                            const newSet = new Set(prev);
                            if (newSet.has(plant.id)) {
                                newSet.delete(plant.id);
                            } else {
                                newSet.add(plant.id);
                            }
                            return newSet;
                        });
                    } else {
                        const domEvent = event.domEvent as MouseEvent;
                        if (
                            data.isEditModeEnabled &&
                            data.editModeSettings.selectionMode !== 'single' &&
                            domEvent?.ctrlKey
                        ) {
                            onSelectItem(plant.id, 'plants');
                        } else if (data.isEditModeEnabled && !isCreatingConnection) {
                            onPlantEdit(plant);
                        } else {
                            infoWindow.open(map, plantMarker);
                        }
                    }
                });

                if (data.isEditModeEnabled) {
                    plantMarker.addListener('dragstart', () => {
                        onPlantDragStart(plant.id);
                    });

                    plantMarker.addListener('dragend', (event: google.maps.MapMouseEvent) => {
                        if (event.latLng) {
                            const newPosition = {
                                lat: event.latLng.lat(),
                                lng: event.latLng.lng(),
                            };

                            onPlantDragEnd(plant.id, newPosition);
                        }
                    });
                }

                overlaysRef.current.infoWindows.set(plant.id, infoWindow);
            });
        }

        // แสดงรัศมีหัวฉีดน้ำ
        if (showSprinklerRadius && layerVisibility.plants) {
            const sprinklerConfig = loadSprinklerConfig();

            if (sprinklerConfig && sprinklerConfig.radiusMeters > 0) {
                data.plants.forEach((plant) => {
                    const radiusCircle = new google.maps.Circle({
                        center: { lat: plant.position.lat, lng: plant.position.lng },
                        radius: sprinklerConfig.radiusMeters,
                        strokeColor: '#00BFFF',
                        strokeOpacity: 0.8,
                        strokeWeight: 2,
                        fillColor: '#00BFFF',
                        fillOpacity: 0.1,
                        clickable: false,
                        zIndex: 100, // ต่ำกว่าต้นไม้
                    });

                    // เพิ่มวงกลมเข้าไปในแผนที่
                    radiusCircle.setMap(map);
                    overlaysRef.current.circles.set(`sprinkler_${plant.id}`, radiusCircle);
                });
            }
        }

        if (tempConnectionLine && tempConnectionLine.length >= 2) {
            const tempPolyline = new google.maps.Polyline({
                path: tempConnectionLine.map((coord) => ({ lat: coord.lat, lng: coord.lng })),
                strokeColor: '#FFD700',
                strokeWeight: 2,
                strokeOpacity: 0.7,
                clickable: false,
            });

            tempPolyline.setMap(map);
            overlaysRef.current.polylines.set('temp-connection', tempPolyline);
        }

        (window as any).selectZonePlant = (zoneId: string) => {
            const zone = data.zones.find((z) => z.id === zoneId);
            if (zone) {
                handleZonePlantSelection(zone);
            }
        };

        (window as any).selectZone = (zoneId: string) => {
            onSelectItem(zoneId, 'zones');
        };

        (window as any).selectPipe = (pipeId: string) => {
            onSelectItem(pipeId, 'pipes');
        };

        if (isRulerMode && rulerStartPoint) {
            // แสดงจุดเริ่มต้น
            const startPointMarker = new google.maps.Marker({
                position: { lat: rulerStartPoint.lat, lng: rulerStartPoint.lng },
                map: map,
                icon: {
                    url:
                        'data:image/svg+xml;charset=UTF-8,' +
                        encodeURIComponent(`
                        <svg width="20" height="20" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="10" cy="10" r="8" fill="#10B981" stroke="white" stroke-width="2"/>
                            <text x="10" y="14" text-anchor="middle" fill="white" font-size="12" font-weight="bold">●</text>
                        </svg>
                    `),
                    scaledSize: new google.maps.Size(20, 20),
                    anchor: new google.maps.Point(10, 10),
                },
                clickable: false,
                zIndex: 9999,
            });

            overlaysRef.current.markers.set('ruler-start-point', startPointMarker);

            // แสดงเส้นวัดจากจุดเริ่มต้นไปยังเมาส์ปัจจุบัน
            if (currentMousePosition) {
                const measureLine = new google.maps.Polyline({
                    path: [
                        { lat: rulerStartPoint.lat, lng: rulerStartPoint.lng },
                        { lat: currentMousePosition.lat, lng: currentMousePosition.lng },
                    ],
                    strokeColor: '#9333EA',
                    strokeWeight: 2,
                    strokeOpacity: 0.8,
                    icons: [
                        {
                            icon: {
                                path: 'M 0,-1 0,1',
                                strokeOpacity: 0.8,
                                strokeColor: '#9333EA',
                                scale: 4,
                            },
                            offset: '0',
                            repeat: '15px',
                        },
                    ],
                    geodesic: true,
                    clickable: false,
                });

                measureLine.setMap(map);
                measureLine.set('zIndex', 9998);
                overlaysRef.current.polylines.set('ruler-measure-line', measureLine);

                // แสดงป้ายระยะทางตรงกลางเส้น
                const midLat = (rulerStartPoint.lat + currentMousePosition.lat) / 2;
                const midLng = (rulerStartPoint.lng + currentMousePosition.lng) / 2;

                const distanceLabel = new google.maps.Marker({
                    position: { lat: midLat, lng: midLng },
                    map: map,
                    icon: {
                        url:
                            'data:image/svg+xml;charset=UTF-8,' +
                            encodeURIComponent(`
                            <svg width="90" height="24" viewBox="0 0 90 24" xmlns="http://www.w3.org/2000/svg">
                                <rect x="0" y="0" width="90" height="24" fill="white" stroke="#9333EA" stroke-width="2" rx="12"/>
                                <text x="45" y="16" text-anchor="middle" fill="#9333EA" font-size="12" font-weight="bold">${currentDistance.toFixed(1)}m</text>
                            </svg>
                        `),
                        scaledSize: new google.maps.Size(90, 24),
                        anchor: new google.maps.Point(45, 12),
                    },
                    clickable: false,
                    zIndex: 9999,
                });

                overlaysRef.current.markers.set('ruler-distance-label', distanceLabel);

                // แสดงจุดปลายที่เมาส์
                const endPointMarker = new google.maps.Marker({
                    position: { lat: currentMousePosition.lat, lng: currentMousePosition.lng },
                    map: map,
                    icon: {
                        url:
                            'data:image/svg+xml;charset=UTF-8,' +
                            encodeURIComponent(`
                            <svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="8" cy="8" r="6" fill="#3B82F6" stroke="white" stroke-width="2"/>
                                <circle cx="8" cy="8" r="2" fill="white"/>
                            </svg>
                        `),
                        scaledSize: new google.maps.Size(16, 16),
                        anchor: new google.maps.Point(8, 8),
                    },
                    clickable: false,
                    zIndex: 9999,
                });

                overlaysRef.current.markers.set('ruler-end-point', endPointMarker);
            }
        }

        (window as any).selectPlant = (plantId: string) => {
            onSelectItem(plantId, 'plants');
        };

        (window as any).editPlant = (plantId: string) => {
            const plant = data.plants.find((p) => p.id === plantId);
            if (plant) {
                onPlantEdit(plant);
            }
        };

        (window as any).createPlantConnection = (plantId: string) => {
            handleCreatePlantConnection(plantId);
        };

        (window as any).segmentedPipeDeletion = (branchPipeId: string) => {
            onSegmentedPipeDeletion(branchPipeId);
        };
    }, [
        map,
        data,
        isCreatingConnection,
        isDragging,
        dragTarget,
        isRulerMode,
        rulerStartPoint,
        currentMousePosition,
        currentDistance,
        t,
        currentDrawnZone,
        manualZones,
        isPlantMoveMode,
        selectedPlantsForMove,
        isPlantSelectionMode,
        highlightedPlants,
        // ใช้ useCallback สำหรับ functions เพื่อลด re-render
        onPlantEdit,
        onConnectToPipe,
        onConnectToPlant,
        onSelectItem,
        onPlantDragStart,
        onPlantDragEnd,
        onSegmentedPipeDeletion,
        handleZonePlantSelection,
        handleCreatePlantConnection,
        clearOverlays,
        onMapDoubleClick,
        setSelectedPlantsForMove,
        onLateralPipeClick,
    ]);

    useEffect(() => {
        return () => {
            clearOverlays();
        };
    }, [clearOverlays]);

    return null;
};

const extractCoordinatesFromLayer = (layer: any): Coordinate[] => {
    if (!layer) return [];

    try {
        if (layer.getLatLngs) {
            const latlngs = layer.getLatLngs();
            if (Array.isArray(latlngs)) {
                return latlngs.map((latlng: any) => ({
                    lat: latlng.lat,
                    lng: latlng.lng,
                }));
            }
        }

        if (layer.getLatLng) {
            const latlng = layer.getLatLng();
            return [{ lat: latlng.lat, lng: latlng.lng }];
        }

        return [];
    } catch (error) {
        console.error('Error extracting coordinates from layer:', error);
        return [];
    }
};
