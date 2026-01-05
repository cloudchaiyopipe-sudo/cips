/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState, useEffect, useRef, useMemo, useCallback, useReducer } from 'react';
import axios from 'axios';

import HorticultureMapComponent from '../components/horticulture/HorticultureMapComponent';
import HorticultureDrawingManager from '../components/horticulture/HorticultureDrawingManager';
import FreehandPipeDrawingManager from '../components/horticulture/FreehandPipeDrawingManager';
import EnhancedHorticultureSearchControl from '../components/horticulture/HorticultureSearchControl';
import PlantRotationControl from '../components/horticulture/PlantRotationControl';
import LateralPipeInfoPanel from '../components/horticulture/LateralPipeInfoPanel';
import LateralPipeModeSelector from '../components/horticulture/LateralPipeModeSelector';
import ContinuousLateralPipePanel from '../components/horticulture/ContinuousLateralPipePanel';
import DeletePipePanel from '../components/horticulture/DeletePipePanel';
import ElevationControlPanel from '../components/horticulture/ElevationControlPanel';
import AutoLateralPipeModal from '../components/horticulture/AutoLateralPipeModal';
// import DrawingDistanceOverlay from '../components/horticulture/DrawingDistanceOverlay'; // REMOVED - using DistanceMeasurementOverlay instead
import DistanceMeasurementOverlay from '../components/horticulture/DistanceMeasurementOverlay';
import Cesium3DMapPopup from '../components/horticulture/Cesium3DMapPopup';
import SmartOnboardingTour from '../components/horticulture/SmartOnboardingTour';
import StepInfoModal from '../components/horticulture/StepInfoModal';
import {
    getInitialTourSteps,
    shouldShowTour,
    markTourCompleted,
    markTourSkipped,
    type TourStep,
} from '../utils/onboardingTourUtils';
import { loadSprinklerConfig, SprinklerConfig } from '../utils/sprinklerUtils';
import {
    snapMainPipeEndToSubMainPipe,
    findClosestPointOnLineSegment,
    calculateWaterFlowRate,
    calculatePipeLength,
    calculateDistanceBetweenPoints,
    distanceFromPointToLineSegment,
} from '../utils/horticultureUtils';
import { findPipeZoneImproved } from '../utils/horticultureProjectStats';
import {
    createAutomaticZones,
    AutoZoneConfig,
    AutoZoneResult,
    clipPolygonToMainArea,
} from '../utils/autoZoneUtils';
import { generatePerpendicularDimensionLines } from '../utils/horticultureUtils';
import {
    calculateTotalWaterNeed,
    generateLateralPipeId,
    generateEmitterLines,
    generateEmitterLinesForBetweenPlantsMode,
    generateEmitterLinesForMultiSegment,
    isPointOnSubMainPipe,
    findClosestConnectionPoint,
    computeAlignedLateralFromMainPipe,
    findLateralSubMainIntersection,
    calculateLateralPipeSegmentStats,
    findMainToSubMainConnections,
    findEndToEndConnections,
    findSubMainToLateralStartConnections,
    computeMultiSegmentAlignment,
    findSubMainToMainIntersections,
    findLateralToSubMainIntersections,
    findMidConnections,
    findMainToSubMainMidConnections,
    findPlantsInLateralPath,
    groupPlantsByRows,
    groupPlantsByColumns,
    transformToRotatedCoordinate,
    hasRotation,
    generateAutoLateralPipes,
} from '../utils/lateralPipeUtils';

import { router } from '@inertiajs/react';
import { useLanguage } from '../contexts/LanguageContext';
import Navbar from '../components/Navbar';
import SprinklerConfigModal from '../components/horticulture/SprinklerConfigModal';
import horticultureData from '../components/horticulture/data';

import {
    SprinklerFormData,
    calculateTotalFlowRate,
    formatFlowRate,
    formatPressure,
} from '../utils/sprinklerUtils';

import {
    FaTree,
    FaUndo,
    FaCheck,
    FaRedo,
    FaTrash,
    FaPlus,
    FaSave,
    FaTimes,
    FaCog,
    FaLink,
    FaBars,
    FaCompress,
    FaExpand,
    FaCopy,
    FaPaste,
    FaMagic,
    FaCut,
    FaArrowsAlt,
    FaRuler,
    FaMountain,
    FaCube,
} from 'react-icons/fa';

const cleanupLocalStorage = (): boolean => {
    try {
        // Get all keys and their sizes
        const items: { key: string; size: number; timestamp?: number }[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                const value = localStorage.getItem(key) || '';
                const size = new Blob([value]).size;
                let timestamp: number | undefined;

                // Try to extract timestamp from project data
                if (
                    key.startsWith('horticultureIrrigationData') ||
                    key.startsWith('horticultureSystemData') ||
                    key.startsWith('savedProductProject_')
                ) {
                    try {
                        const data = JSON.parse(value);
                        timestamp = new Date(data.updatedAt || data.createdAt || 0).getTime();
                    } catch {
                        timestamp = 0;
                    }
                }

                items.push({ key, size, timestamp });
            }
        }

        // Sort by timestamp (oldest first) and size (largest first)
        items.sort((a, b) => {
            if (a.timestamp && b.timestamp) {
                return a.timestamp - b.timestamp;
            }
            return b.size - a.size;
        });

        // Remove old project data (keep only the 2 most recent)
        const projectKeys = items.filter(
            (item) =>
                item.key.startsWith('horticultureIrrigationData') ||
                item.key.startsWith('horticultureSystemData') ||
                item.key.startsWith('savedProductProject_')
        );

        if (projectKeys.length > 2) {
            const keysToRemove = projectKeys.slice(0, projectKeys.length - 2);
            keysToRemove.forEach((item) => {
                localStorage.removeItem(item.key);
            });
        }

        // Remove mock data
        const mockKeys = items.filter((item) => item.key.startsWith('mock-'));
        mockKeys.forEach((item) => {
            localStorage.removeItem(item.key);
        });

        // Remove temporary data
        const tempKeys = items.filter(
            (item) =>
                item.key.startsWith('temp_') ||
                item.key.startsWith('_temp_') ||
                item.key.includes('temp')
        );
        tempKeys.forEach((item) => {
            localStorage.removeItem(item.key);
        });

        // Calculate remaining size
        let remainingSize = 0;
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key) {
                const value = localStorage.getItem(key) || '';
                remainingSize += new Blob([value]).size;
            }
        }

        console.log(
            `✅ Cleanup completed. Remaining storage: ${(remainingSize / 1024).toFixed(2)}KB`
        );
        return true;
    } catch (error) {
        console.error('❌ localStorage cleanup failed:', error);
        return false;
    }
};

if (typeof window !== 'undefined') {
    (window as unknown as { clearHorticultureStorage: () => void }).clearHorticultureStorage =
        () => {
            if (cleanupLocalStorage()) {
                alert('localStorage cleanup completed successfully!');
            } else {
                alert('localStorage cleanup failed!');
            }
        };

    (window as unknown as { clearAllStorage: () => void }).clearAllStorage = () => {
        localStorage.clear();
        alert('All localStorage cleared!');
    };

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

        items.sort((a, b) => b.size - a.size);
        console.table(items);
        alert(`localStorage usage: ${(totalSize / 1024).toFixed(2)}KB\nCheck console for details.`);
    };
}

const compressProjectData = (data: any): any => {
    try {
        const compressed = {
            ...data,
            mainArea: Array.isArray(data.mainArea)
                ? data.mainArea.map((coord: any) => ({
                    lat: Math.round(coord.lat * 1000000) / 1000000,
                    lng: Math.round(coord.lng * 1000000) / 1000000,
                }))
                : data.mainArea,

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

            debugInfo: undefined,
            tempData: undefined,
            _temp: undefined,
        };
        return compressed;
    } catch (error) {
        console.warn('⚠️ Compression failed, returning original data:', error);
        return data;
    }
};

// Function to synchronize data between different localStorage keys
const syncHorticultureData = (data: any): void => {
    try {
        // Save to both keys to ensure compatibility
        const dataString = JSON.stringify(data);

        // Use safeLocalStorageSet to handle quota exceeded errors
        const saved1 = safeLocalStorageSet('horticultureIrrigationData', dataString);
        const saved2 = safeLocalStorageSet('horticultureSystemData', dataString);

        if (!saved1 || !saved2) {
            console.warn('⚠️ Failed to save some horticulture data to localStorage');
            if (typeof window !== 'undefined' && (window as any).showNotification) {
                (window as any).showNotification(
                    'ไม่สามารถบันทึกข้อมูลทั้งหมดได้ เนื่องจากพื้นที่เก็บข้อมูลเต็ม กรุณาลบข้อมูลเก่าบางส่วน',
                    'warning'
                );
            }
        }
    } catch (error) {
        console.error('❌ Failed to sync horticulture data:', error);
        if (typeof window !== 'undefined' && (window as any).showNotification) {
            (window as any).showNotification(
                'เกิดข้อผิดพลาดในการบันทึกข้อมูล: ' +
                (error instanceof Error ? error.message : 'Unknown error'),
                'error'
            );
        }
    }
};

const safeLocalStorageSet = (key: string, value: string): boolean => {
    try {
        const dataSizeKB = new Blob([value]).size / 1024;
        console.log(`💾 Attempting to save ${dataSizeKB.toFixed(2)}KB to localStorage...`);

        // Try to save directly first
        localStorage.setItem(key, value);
        return true;
    } catch (error) {
        if (error instanceof Error && error.name === 'QuotaExceededError') {
            console.warn('⚠️ localStorage quota exceeded, attempting cleanup...');

            // First attempt: cleanup and try again
            if (cleanupLocalStorage()) {
                try {
                    localStorage.setItem(key, value);
                    return true;
                } catch {
                    console.warn('⚠️ Still failed after cleanup, attempting compression...');
                }
            }

            // Second attempt: compress and try again
            try {
                const originalSizeKB = new Blob([value]).size / 1024;
                const parsedData = JSON.parse(value);
                const compressedData = compressProjectData(parsedData);
                const compressedValue = JSON.stringify(compressedData);
                const compressedSizeKB = new Blob([compressedValue]).size / 1024;

                console.log(
                    `🗜️ Compressed from ${originalSizeKB.toFixed(2)}KB to ${compressedSizeKB.toFixed(2)}KB`
                );

                localStorage.setItem(key, compressedValue);
                return true;
            } catch (compressError) {
                console.error('❌ Compression failed:', compressError);
            }

            // Third attempt: aggressive cleanup and compression
            console.warn('⚠️ Attempting aggressive cleanup...');
            try {
                // Remove all non-essential data
                const keys = Object.keys(localStorage);
                keys.forEach((storageKey) => {
                    if (
                        storageKey !== key &&
                        !storageKey.startsWith('horticultureIrrigationData') &&
                        !storageKey.startsWith('horticultureSystemData') &&
                        !storageKey.startsWith('savedProductProject_')
                    ) {
                        localStorage.removeItem(storageKey);
                    }
                });

                const parsedData = JSON.parse(value);
                const compressedData = compressProjectData(parsedData);
                const compressedValue = JSON.stringify(compressedData);

                localStorage.setItem(key, compressedValue);
                return true;
            } catch (finalError) {
                console.error('❌ All attempts failed:', finalError);
                return false;
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

const generateUniqueId = (prefix: string = 'id'): string => {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    return `${prefix}_${timestamp}_${random}`;
};

const enhanceManualZone = (zone: ManualIrrigationZone): ManualIrrigationZone => {
    const area = calculateAreaFromCoordinates(zone.coordinates);
    const areaInRai = area / 1600;

    const sprinklerConfig = loadSprinklerConfig();
    const waterFlowRate = sprinklerConfig
        ? calculateWaterFlowRate(zone.plants.length, sprinklerConfig)
        : 0;

    const estimatedPipeLength = Math.sqrt(area) * 3;
    const bestPipeInfo = {
        longest: estimatedPipeLength * 0.6,
        totalLength: estimatedPipeLength,
        count: Math.max(1, Math.ceil(zone.plants.length / 20)),
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

    for (let i = 0; i < mainArea.length; i++) {
        const start = mainArea[i];
        const end = mainArea[(i + 1) % mainArea.length];
        const edgeLength = calculateDistanceBetweenPoints(start, end);

        if (edgeLength > longestEdge) {
            longestEdge = edgeLength;
            longestEdgeStart = start;
            longestEdgeEnd = end;
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

    // Helper: minimal distance from a point to the area's boundary (in meters)
    const minDistanceToBoundary = (point: Coordinate, polygon: Coordinate[]): number => {
        let minDist = Infinity;
        for (let i = 0; i < polygon.length; i++) {
            const a = polygon[i];
            const b = polygon[(i + 1) % polygon.length];
            const d = distanceFromPointToLineSegment(point, a, b);
            if (d < minDist) minDist = d;
        }
        return minDist;
    };
    const boundaryMinDistanceMeters = 2; // 2 meters from boundary

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
        const candidateRows: number[] = [];

        for (let lat = adjustedBounds.minLat; lat <= adjustedBounds.maxLat; lat += latSpacing) {
            candidateRows.push(lat);
        }

        if (candidateRows.length > 0) {
            startingLat = candidateRows.reduce((closest, current) => {
                const closestDistance = Math.abs(closest - sharedBaseline);
                const currentDistance = Math.abs(current - sharedBaseline);
                return currentDistance < closestDistance ? current : closest;
            });
        } else {
            startingLat = sharedBaseline;
        }
    } else {
        startingLat = adjustedBounds.minLat;
    }

    const center = {
        lat: (adjustedBounds.minLat + adjustedBounds.maxLat) / 2,
        lng: (adjustedBounds.minLng + adjustedBounds.maxLng) / 2,
    };

    const expansionFactor = rotationAngle !== 0 ? 1.5 : 1.2;
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

    for (const position of gridPoints) {
        if (isPointInPolygon(position, areaCoordinates)) {
            const inExclusion = exclusionAreas.some((exclusion) =>
                isPointInPolygon(position, exclusion.coordinates)
            );

            // Enforce 2m minimum distance from boundary for edge plants
            const distanceToBoundary = minDistanceToBoundary(position, areaCoordinates);

            if (!inExclusion && distanceToBoundary >= boundaryMinDistanceMeters) {
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

    const coverageRatio = plants.length / (gridPoints.length > 0 ? gridPoints.length : 1);
    if (coverageRatio < 0.3 && plants.length < 10) {
        console.warn(
            `⚠️ การครอบคลุมพื้นที่ต่ำ: ${(coverageRatio * 100).toFixed(1)}% (ต้นไม้ ${plants.length} จากจุดทั้งหมด ${gridPoints.length})`
        );

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

                const tooClose = plants.some((existingPlant) => {
                    const distance = calculateDistanceBetweenPoints(
                        position,
                        existingPlant.position
                    );
                    return distance < plantData.plantSpacing * 0.7;
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

    if (baselineLat !== undefined) {
        for (let lat = baselineLat; lat <= bounds.maxLat; lat += latSpacing) {
            for (let lng = bounds.minLng; lng <= bounds.maxLng; lng += lngSpacing) {
                const originalPoint = { lat, lng };
                const rotatedPoint = rotatePoint(originalPoint, center, rotationAngle);
                points.push(rotatedPoint);
            }
        }

        for (let lat = baselineLat - latSpacing; lat >= bounds.minLat; lat -= latSpacing) {
            for (let lng = bounds.minLng; lng <= bounds.maxLng; lng += lngSpacing) {
                const originalPoint = { lat, lng };
                const rotatedPoint = rotatePoint(originalPoint, center, rotationAngle);
                points.push(rotatedPoint);
            }
        }
    } else {
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

    if (baselineLat !== undefined) {
        let rowOffset = 0;

        for (let lat = baselineLat; lat <= bounds.maxLat; lat += latSpacing) {
            const startLng = bounds.minLng + (rowOffset % 2) * (lngSpacing / 2);

            for (let lng = startLng; lng <= bounds.maxLng; lng += lngSpacing) {
                const originalPoint = { lat, lng };
                const rotatedPoint = rotatePoint(originalPoint, center, rotationAngle);
                points.push(rotatedPoint);
            }
            rowOffset++;
        }

        rowOffset = -1;
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

    const overallMinLat = Math.min(...areaBounds.map((b) => b.adjustedMinLat));
    const overallMaxLat = Math.max(...areaBounds.map((b) => b.adjustedMaxLat));

    const centerLat = (overallMinLat + overallMaxLat) / 2;

    let bestBaseline = centerLat;
    let minDistance = Infinity;

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

    // Helper: minimal distance from a point to the area's boundary (in meters)
    const minDistanceToBoundary = (point: Coordinate, polygon: Coordinate[]): number => {
        let minDist = Infinity;
        for (let i = 0; i < polygon.length; i++) {
            const a = polygon[i];
            const b = polygon[(i + 1) % polygon.length];
            const d = distanceFromPointToLineSegment(point, a, b);
            if (d < minDist) minDist = d;
        }
        return minDist;
    };
    const boundaryMinDistanceMeters = 2; // 2 meters from boundary

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

            // Enforce 2m minimum distance from boundary for edge plants
            const distanceToBoundary = minDistanceToBoundary(position, areaCoordinates);

            if (!inExclusion && distanceToBoundary >= boundaryMinDistanceMeters) {
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
    flowLitersPerMinute?: number;
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
    zoneId?: string;
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
    area?: number;
    areaInRai?: number;
    waterFlowRate?: number;
    bestPipeInfo?: {
        longest: number;
        totalLength: number;
        count: number;
    };
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
    editMode: string | null;
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
    lateralPipeDrawing: {
        isActive: boolean;
        isContinuousMode: boolean;
        placementMode: 'over_plants' | 'between_plants' | null;
        startPoint: Coordinate | null;
        snappedStartPoint: Coordinate | null;
        currentPoint: Coordinate | null;
        rawCurrentPoint: Coordinate | null;
        selectedPlants: PlantLocation[];
        totalWaterNeed: number;
        plantCount: number;
        waypoints: Coordinate[];
        currentSegmentDirection: 'horizontal' | 'vertical' | 'diagonal' | null;
        allSegmentPlants: PlantLocation[];
        segmentPlants: PlantLocation[][];
        isMultiSegmentMode: boolean;
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

const DEFAULT_PLANT_TYPES = (): PlantData[] => {
    return horticultureData.map((plant, index) => ({
        id: index + 1,
        name: plant.name,
        plantSpacing: plant.plantSpacing,
        rowSpacing: plant.rowSpacing,
        waterNeed: plant.waterNeed,
        flowLitersPerMinute: plant.flowLitersPerMinute,
    }));
};

const ZONE_COLORS = [
    '#EF4444', // 1. Red (แดง)
    '#FBBF24', // 2. Yellow (เหลือง)
    '#3B82F6', // 3. Blue (น้ำเงิน)
    '#10B981', // 4. Green (เขียว)
    '#EC4899', // 5. Pink (ชมพู)
    '#8B5CF6', // 6. Purple (ม่วง)
    '#F97316', // 7. Orange (ส้ม)
    '#06B6D4', // 8. Cyan (ฟ้าอมเขียว)
    '#14B8A6', // 9. Teal (เขียวอมฟ้า)
    '#6366F1', // 10. Indigo (คราม)
    '#A855F7', // 11. Violet (ม่วงอ่อน)
    '#F59E0B', // 12. Amber (อำพัน)
    '#84CC16', // 13. Lime (เขียวอ่อน)
    '#22D3EE', // 14. Light Cyan (ฟ้าอ่อน)
    '#34D399', // 15. Emerald (มรกต)
    '#0EA5E9', // 16. Sky Blue (ฟ้าสดใส)
    '#C084FC', // 17. Light Purple (ม่วงอ่อน)
    '#FB7185', // 18. Light Rose (ชมพูอ่อน)
    '#60A5FA', // 19. Light Blue (น้ำเงินอ่อน)
    '#F43F5E', // 20. Rose (กุหลาบ)
];

const EXCLUSION_COLORS = {
    building: '#F59E0B',
    powerplant: '#EF4444',
    river: '#3B82F6',
    road: '#1F2937', // Dark gray/black
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

const formatWaterVolumeWithFlowRate = (
    volume: number,
    plantCount: number,
    sprinklerConfig: SprinklerConfig | null,
    t: (key: string) => string
): string => {
    const sprinklersPerTree = sprinklerConfig?.sprinklersPerTree || 1;
    const flowRate = plantCount * (sprinklerConfig?.flowRatePerMinute || 0) * sprinklersPerTree;
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

const findClosestPointInMainArea = (point: Coordinate, mainArea: Coordinate[]): Coordinate => {
    if (isPointInPolygon(point, mainArea)) {
        return point;
    }

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
    // สำหรับท่อเมนรอง: ใช้จุดสิ้นสุดเป็นหลักในการกำหนดโซน
    // เพราะท่อเมนรองจะถือว่าเป็นของโซนที่วาดจบ ไม่ใช่โซนที่เริ่มวาด
    const endPoint = coordinates[coordinates.length - 1];
    const endZone = findZoneContainingPoint(endPoint, zones);
    if (endZone) return endZone;
    // ถ้าจุดสิ้นสุดไม่อยู่ในโซนใด ให้ลองจุดกลาง
    const midIndex = Math.floor(coordinates.length / 2);
    const midPoint = coordinates[midIndex];
    const midZone = findZoneContainingPoint(midPoint, zones);
    if (midZone) return midZone;
    // ถ้ายังไม่เจอ ให้ลองจุดเริ่มต้น
    const startZone = findZoneContainingPoint(coordinates[0], zones);
    return startZone;
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

        if (onAfterSave) {
            onAfterSave();
        }

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
    const [searchTerm, setSearchTerm] = useState('');

    const filteredPlants = useMemo(() => {
        if (!searchTerm.trim()) {
            return availablePlants;
        }
        const searchLower = searchTerm.toLowerCase();
        return availablePlants.filter((plant) =>
            plant.name.toLowerCase().includes(searchLower)
        );
    }, [availablePlants, searchTerm]);

    useEffect(() => {
        if (zone) {
            setSelectedPlant(zone.plantData);
        }
    }, [zone]);

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
        }
    }, [isOpen]);

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

                <div className="mb-4">
                    <label className="mb-2 block text-sm font-medium text-white">
                        🔍 {t('ค้นหาพืช')}
                    </label>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder={t('พิมพ์ชื่อพืชเพื่อค้นหา...')}
                        className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                </div>

                <div className="max-h-64 space-y-2 overflow-y-auto">
                    {filteredPlants.length > 0 ? (
                        filteredPlants.map((plant) => (
                            <div
                                key={plant.id}
                                className={`relative cursor-pointer rounded p-3 transition-colors ${selectedPlant?.id === plant.id
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
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onEditPlant(plant);
                                    }}
                                    className="absolute right-1 top-1 rounded bg-yellow-600 p-1 text-xs text-white hover:bg-yellow-700"
                                    title={t('แก้ไขพืช')}
                                >
                                    ✏️
                                </button>
                            </div>
                        ))
                    ) : (
                        <div className="rounded-lg border border-gray-600 bg-gray-800 p-4 text-center text-gray-400">
                            {t('ไม่พบพืชที่ค้นหา')}
                        </div>
                    )}
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
                        className={`flex-1 rounded px-4 py-2 transition-colors ${selectedPlant
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
    t: (key: string) => string;
}) => {
    const [selectedPlantData, setSelectedPlantData] = useState<PlantData | null>(null);
    const [searchTerm, setSearchTerm] = useState('');

    // --- track the initial plantId (from first setSelectedPlantData when opened) ---
    const [initialSelectedPlantId, setInitialSelectedPlantId] = useState<number | null>(null);

    useEffect(() => {
        if (plant && isOpen) {
            setSelectedPlantData(plant.plantData);
            setInitialSelectedPlantId(plant.plantData.id);
        }
    }, [plant, isOpen]);

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
        }
    }, [isOpen]);

    const filteredPlants = useMemo(() => {
        if (!searchTerm.trim()) {
            return availablePlants;
        }
        const searchLower = searchTerm.toLowerCase();
        return availablePlants.filter((plant) =>
            plant.name.toLowerCase().includes(searchLower)
        );
    }, [availablePlants, searchTerm]);

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
    };

    if (!isOpen || !plant) return null;

    return (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center bg-black bg-opacity-50">
            <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg bg-gray-900 p-6 shadow-2xl">
                <h3 className="mb-4 text-xl font-semibold text-white">🌱 {t('แก้ไขต้นไม้')}</h3>

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

                    {/* แสดงรายการพืช (ไม่มีปุ่มเปลี่ยนต้นไม้แล้ว) */}
                    <div className="space-y-3">
                        <div>
                            <label className="mb-2 block text-sm font-medium text-white">
                                🔍 {t('ค้นหาพืช')}
                            </label>
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder={t('พิมพ์ชื่อพืชเพื่อค้นหา...')}
                                className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>

                        <div className="max-h-48 space-y-2 overflow-y-auto rounded border border-gray-600 bg-gray-800 p-3">
                            {(() => {
                                // โชว์อันที่ตรง initialSelectedPlantId ไว้บนสุดเท่านั้น (ตอน open modal)
                                let plantList = filteredPlants.slice();
                                if (initialSelectedPlantId) {
                                    const idx = plantList.findIndex(p => p.id === initialSelectedPlantId);
                                    if (idx > 0) {
                                        plantList = [
                                            plantList[idx],
                                            ...plantList.slice(0, idx),
                                            ...plantList.slice(idx + 1),
                                        ];
                                    }
                                }
                                return plantList.length > 0 ? (
                                    plantList.map((plantData) => (
                                        <div key={plantData.id} className="relative">
                                            <button
                                                onClick={() => handlePlantChange(plantData)}
                                                className={`w-full rounded p-2 text-left text-sm transition-colors ${selectedPlantData?.id === plantData.id
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
                                    ))
                                ) : (
                                    <div className="rounded-lg border border-gray-600 bg-gray-700 p-4 text-center text-gray-400">
                                        {t('ไม่พบพืชที่ค้นหา')}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    {/* ปุ่มเพิ่มพืชใหม่แยกต่างหาก */}
                    <div className="border-t border-gray-700 pt-3">
                        <button
                            onClick={() => {
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
                                        className={`cursor-pointer rounded p-3 transition-colors ${selectedSegment === segment.index
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
                                className={`flex-1 rounded px-4 py-2 transition-colors ${selectedSegment !== null
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
            className={`fixed inset-0 z-[9999] flex items-center justify-center ${isOpen ? 'block' : 'hidden'
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
    const [searchTerm, setSearchTerm] = useState('');

    const filteredPlants = useMemo(() => {
        if (!searchTerm.trim()) {
            return availablePlants;
        }
        const searchLower = searchTerm.toLowerCase();
        return availablePlants.filter((plant) =>
            plant.name.toLowerCase().includes(searchLower)
        );
    }, [availablePlants, searchTerm]);

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
        }
    }, [isOpen]);

    return (
        <div
            className={`fixed inset-0 z-50 flex items-center justify-center ${isOpen ? 'block' : 'hidden'
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
                            🔍 {t('ค้นหาพืช')}
                        </label>
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder={t('พิมพ์ชื่อพืชเพื่อค้นหา...')}
                            className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                    </div>

                    <div>
                        <label className="mb-2 block text-sm font-medium text-white">
                            {t('เลือกพืช')}
                        </label>
                        <select
                            value={selectedPlantType.id}
                            onChange={(e) => {
                                const plantType = filteredPlants.find(
                                    (p) => p.id === Number(e.target.value)
                                );
                                if (plantType) {
                                    onPlantTypeChange(plantType);
                                }
                            }}
                            className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        >
                            {filteredPlants.length > 0 ? (
                                filteredPlants.map((plant) => (
                                    <option key={plant.id} value={plant.id}>
                                        {t(plant.name)}
                                    </option>
                                ))
                            ) : (
                                <option value="">{t('ไม่พบพืชที่ค้นหา')}</option>
                            )}
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
    const [searchTerm, setSearchTerm] = useState('');

    const filteredPlants = useMemo(() => {
        if (!searchTerm.trim()) {
            return availablePlants;
        }
        const searchLower = searchTerm.toLowerCase();
        return availablePlants.filter((plant) =>
            plant.name.toLowerCase().includes(searchLower)
        );
    }, [availablePlants, searchTerm]);

    useEffect(() => {
        if (isOpen) {
            setSearchTerm('');
        }
    }, [isOpen]);

    return (
        <div
            className={`fixed inset-0 z-[9990] flex items-center justify-center ${isOpen ? 'block' : 'hidden'
                }`}
        >
            <div className="absolute inset-0 bg-black bg-opacity-80" onClick={onClose}></div>
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

                            <div className="mb-3">
                                <label className="mb-2 block text-sm font-medium text-white">
                                    🔍 {t('ค้นหาพืช')}
                                </label>
                                <input
                                    type="text"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    placeholder={t('พิมพ์ชื่อพืชเพื่อค้นหา...')}
                                    className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                                />
                            </div>

                            {/* แสดงรายการพืชพร้อมปุ่มแก้ไข */}
                            <div className="max-h-48 space-y-2 overflow-y-auto rounded border border-gray-600 bg-gray-800 p-3">
                                {filteredPlants.length > 0 ? (
                                    filteredPlants.map((plantData) => (
                                        <div key={plantData.id} className="relative">
                                            <button
                                                onClick={() => onPlantTypeChange(plantData)}
                                                className={`w-full rounded p-2 text-left text-sm transition-colors ${selectedPlantType?.id === plantData.id
                                                    ? 'bg-green-600 text-white'
                                                    : 'bg-gray-700 text-white hover:bg-gray-600'
                                                    }`}
                                            >
                                                <div className="font-semibold">{t(plantData.name)}</div>
                                                <div className="text-xs text-gray-300">
                                                    {t('ระยะปลูก')}: {plantData.plantSpacing}×
                                                    {plantData.rowSpacing} {t('ม.')} |{t(' ต้องการน้ำ')}:{' '}
                                                    {plantData.waterNeed} {t('ล./ครั้ง')} {' '}
                                                    {plantData.flowLitersPerMinute ? `(${plantData.flowLitersPerMinute} ${t('ล./นาที')})` : ''}
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
                                    ))
                                ) : (
                                    <div className="rounded-lg border border-gray-600 bg-gray-700 p-4 text-center text-gray-400">
                                        {t('ไม่พบพืชที่ค้นหา')}
                                    </div>
                                )}
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
                    {/* <div className="rounded-lg bg-gray-800 p-3">
                        <div className="flex items-center justify-between text-sm space-x-3">
                            <div className="flex items-center space-x-1">
                                <span className="text-gray-400 font-bold">⇆</span>
                                <span className="text-gray-200">{t('กว้าง')}</span>
                                <span className="font-semibold text-white">
                                    {selectedPlantType.plantSpacing}
                                </span>
                                <span className="text-gray-400">{t('ม.')}</span>
                            </div>
                            <span className="text-gray-500">|</span>
                            <div className="flex items-center space-x-1">
                                <span className="text-gray-400 font-bold">≡</span>
                                <span className="text-gray-200">{t('ยาว')}</span>
                                <span className="font-semibold text-white">
                                    {selectedPlantType.rowSpacing}
                                </span>
                                <span className="text-gray-400">{t('ม.')}</span>
                            </div>
                            <span className="text-gray-500">|</span>
                            <div className="flex items-center space-x-1">
                                <span className="text-blue-400 font-bold">💧</span>
                                <span className="text-gray-200">{t('น้ำ')}</span>
                                <span className="font-semibold text-white">
                                    {selectedPlantType.waterNeed}
                                </span>
                                <span className="text-gray-400">{t('ล./ครั้ง')}</span>
                            </div>
                        </div>
                    </div> */}

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
                                className={`flex cursor-pointer flex-col items-center rounded-lg p-2 transition-colors ${settings.layoutPattern === 'grid'
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
                                className={`flex cursor-pointer flex-col items-center rounded-lg p-2 transition-colors ${settings.layoutPattern === 'staggered'
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
            className={`fixed inset-0 z-[9999] flex items-center justify-center ${isOpen ? 'block' : 'hidden'
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
                                    {(() => {
                                        const config = loadSprinklerConfig();
                                        const sprinklersPerTree = config?.sprinklersPerTree || 1;
                                        if (sprinklersPerTree > 1) {
                                            return (
                                                <span className="ml-2 text-sm text-gray-400">
                                                    ({zone.plants.length * sprinklersPerTree}{' '}
                                                    หัวฉีด)
                                                </span>
                                            );
                                        }
                                        return null;
                                    })()}
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
                        className={`rounded-lg p-3 ${isPerfect
                            ? 'bg-green-900'
                            : isOverTarget
                                ? 'bg-yellow-900'
                                : 'bg-red-900'
                            }`}
                    >
                        <div
                            className={`text-sm ${isPerfect
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
}> = ({ onCancel, t, currentZoneIndex = 0, totalZones = 0, manualZones = [] }) => {
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
    totalPlants,
    t,
}: {
    isOpen: boolean;
    onClose: () => void;
    numberOfZones: number;
    onNumberOfZonesChange: (number: number) => void;
    onStartDrawing: () => void;
    totalPlants: number;
    t: (key: string) => string;
}) => {
    const [inputValue, setInputValue] = useState<string>(numberOfZones.toString());
    const [showPumpModal, setShowPumpModal] = useState(false);

    useEffect(() => {
        if (isOpen) {
            setInputValue(numberOfZones.toString());
        }
    }, [isOpen, numberOfZones]);

    const sprinklerConfig = loadSprinklerConfig();
    const totalWaterFlowRateLPM =
        totalPlants * (sprinklerConfig?.flowRatePerMinute || 0) * (sprinklerConfig?.sprinklersPerTree || 1);

    const handleApplyPumpZones = (numberOfZones: number) => {
        onNumberOfZonesChange(Math.min(numberOfZones, 20));
    };

    return (
        <div
            className={`fixed inset-0 z-[9999] flex items-center justify-center ${isOpen ? 'block' : 'hidden'
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
                            value={inputValue}
                            onChange={(e) => {
                                const val = e.target.value;
                                setInputValue(val);
                                if (val !== '') {
                                    const num = parseInt(val, 10);
                                    if (!isNaN(num) && num > 0) {
                                        // Allow typing freely, but clamp to max
                                        const clampedValue = Math.min(num, 20);
                                        onNumberOfZonesChange(clampedValue);
                                    }
                                }
                            }}
                            onBlur={(e) => {
                                const val = e.target.value;
                                if (val === '' || isNaN(parseInt(val, 10))) {
                                    // If empty or invalid, set to minimum value
                                    const minValue = 1;
                                    setInputValue(minValue.toString());
                                    onNumberOfZonesChange(minValue);
                                } else {
                                    const num = parseInt(val, 10);
                                    // Enforce minimum of 1 and maximum of 20 when user finishes typing
                                    const clampedValue = Math.max(1, Math.min(num, 20));
                                    setInputValue(clampedValue.toString());
                                    onNumberOfZonesChange(clampedValue);
                                }
                            }}
                            className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                        />
                        <button
                            onClick={() => setShowPumpModal(true)}
                            className="mt-2 w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
                        >
                            💧 {t('แบ่งโซนจากปั๊มน้ำของคุณ')}
                        </button>
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

                <PumpBasedZoneModal
                    isOpen={showPumpModal}
                    onClose={() => setShowPumpModal(false)}
                    totalWaterFlowRateLPM={totalWaterFlowRateLPM}
                    onApplyZones={handleApplyPumpZones}
                    t={t}
                />
            </div>
        </div>
    );
};

const PumpBasedZoneModal = ({
    isOpen,
    onClose,
    totalWaterFlowRateLPM,
    onApplyZones,
    t,
}: {
    isOpen: boolean;
    onClose: () => void;
    totalWaterFlowRateLPM: number;
    onApplyZones: (numberOfZones: number) => void;
    t: (key: string) => string;
}) => {
    const [selectedOption, setSelectedOption] = useState<'manual' | 'database'>('manual');
    const [manualFlowRate, setManualFlowRate] = useState<string>('');
    const [selectedPump, setSelectedPump] = useState<any>(null);
    const [pumps, setPumps] = useState<any[]>([]);
    const [loadingPumps, setLoadingPumps] = useState(false);
    const [calculatedZones, setCalculatedZones] = useState<number | null>(null);

    useEffect(() => {
        if (isOpen && selectedOption === 'database') {
            fetchPumps();
        }
    }, [isOpen, selectedOption]);

    useEffect(() => {
        calculateZones();
    }, [selectedOption, manualFlowRate, selectedPump, totalWaterFlowRateLPM]);

    const fetchPumps = async () => {
        setLoadingPumps(true);
        try {
            // Use category name 'pump' instead of hardcoded category_id
            const response = await axios.get('/api/equipments/by-category/pump');

            // Handle different response structures
            let pumpData = response.data;

            // If response is an error object
            if (pumpData && typeof pumpData === 'object' && !Array.isArray(pumpData)) {
                if (pumpData.error) {
                    console.error('API Error:', pumpData.error);
                    setPumps([]);
                    return;
                }
                // If response has a data property
                if (pumpData.data && Array.isArray(pumpData.data)) {
                    pumpData = pumpData.data;
                }
            }

            // Ensure we have an array
            const pumpsArray = Array.isArray(pumpData) ? pumpData : [];

            if (pumpsArray.length === 0) {
                console.warn('No pumps found for category "pump"');
            }

            setPumps(pumpsArray);
        } catch (error: any) {
            console.error('Error fetching pumps:', error);
            if (error.response) {
                console.error('Response status:', error.response.status);
                console.error('Response data:', error.response.data);
            }
            setPumps([]);
        } finally {
            setLoadingPumps(false);
        }
    };

    const calculateZones = () => {
        if (selectedOption === 'manual') {
            const flow = parseFloat(manualFlowRate);
            if (!isNaN(flow) && flow > 0 && totalWaterFlowRateLPM > 0) {
                const ratio = totalWaterFlowRateLPM / flow;
                const zones = ratio <= 1 ? 1 : Math.ceil(ratio);
                setCalculatedZones(zones);
            } else {
                setCalculatedZones(null);
            }
        } else if (selectedOption === 'database' && selectedPump) {
            const pumpFlowRate = selectedPump.max_flow_rate_lpm || 0;
            if (pumpFlowRate > 0 && totalWaterFlowRateLPM > 0) {
                const ratio = totalWaterFlowRateLPM / pumpFlowRate;
                const zones = ratio <= 1 ? 1 : Math.ceil(ratio);
                setCalculatedZones(zones);
            } else {
                setCalculatedZones(null);
            }
        } else {
            setCalculatedZones(null);
        }
    };

    const handleApply = () => {
        if (calculatedZones && calculatedZones >= 1) {
            onApplyZones(calculatedZones);
            onClose();
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center">
            <div className="absolute inset-0 bg-black bg-opacity-80" onClick={onClose}></div>
            <div className="relative w-full max-w-lg rounded-lg bg-gray-900 p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">
                        💧 {t('แบ่งโซนจากปั๊มน้ำของคุณ')}
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <FaTimes />
                    </button>
                </div>

                <div className="space-y-4">
                    <div className="rounded-lg bg-blue-900 p-3">
                        <div className="text-sm text-blue-200 flex items-center gap-3">
                            <p className="font-medium">{t('ปริมาณน้ำรวม')}:</p>
                            <p className="text-lg font-semibold">
                                {totalWaterFlowRateLPM.toFixed(2)} {t('ลิตร/นาที')}
                            </p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div>
                            <label className="flex items-center space-x-2">
                                <input
                                    type="radio"
                                    name="pumpOption"
                                    checked={selectedOption === 'manual'}
                                    onChange={() => {
                                        setSelectedOption('manual');
                                        setSelectedPump(null);
                                    }}
                                    className="border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-white">
                                    {t('ตัวเลือกที่ 1')}: {t('กรอกอัตราการไหลของปั๊มน้ำ')}
                                </span>
                            </label>
                        </div>

                        {selectedOption === 'manual' && (
                            <div className="ml-6">
                                <label className="mb-2 block text-sm font-medium text-white">
                                    {t('อัตราการไหล')} (LPM)
                                </label>
                                <input
                                    type="number"
                                    min="1"
                                    step="0.01"
                                    value={manualFlowRate}
                                    onChange={(e) => setManualFlowRate(e.target.value)}
                                    className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                                    placeholder={t('กรอกอัตราการไหล')}
                                />
                            </div>
                        )}

                        <div>
                            <label className="flex items-center space-x-2">
                                <input
                                    type="radio"
                                    name="pumpOption"
                                    checked={selectedOption === 'database'}
                                    onChange={() => {
                                        setSelectedOption('database');
                                        setManualFlowRate('');
                                    }}
                                    className="border-gray-600 bg-gray-800 text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-sm text-white">
                                    {t('ตัวเลือกที่ 2')}: {t('เลือกปั๊มน้ำจากฐานข้อมูล')}
                                </span>
                            </label>
                        </div>

                        {selectedOption === 'database' && (
                            <div className="ml-6">
                                <label className="mb-2 block text-sm font-medium text-white">
                                    {t('เลือกปั๊มน้ำ')}
                                </label>
                                {loadingPumps ? (
                                    <div className="text-center text-gray-400">
                                        {t('กำลังโหลด...')}
                                    </div>
                                ) : (
                                    <div className="max-h-48 space-y-2 overflow-y-auto rounded-lg border border-gray-600 bg-gray-800 p-2">
                                        {pumps.length === 0 ? (
                                            <div className="text-center text-gray-400 py-4">
                                                {t('ไม่พบข้อมูลปั๊มน้ำ')}
                                            </div>
                                        ) : (
                                            pumps.map((pump) => (
                                                <div
                                                    key={pump.id}
                                                    onClick={() => {
                                                        setSelectedPump(
                                                            selectedPump?.id === pump.id
                                                                ? null
                                                                : pump
                                                        );
                                                    }}
                                                    className={`flex cursor-pointer items-center space-x-3 rounded-lg border p-3 transition-colors ${selectedPump?.id === pump.id
                                                        ? 'border-blue-500 bg-blue-900/30'
                                                        : 'border-gray-600 bg-gray-700 hover:border-gray-500 hover:bg-gray-600'
                                                        }`}
                                                >
                                                    <div className="flex-shrink-0">
                                                        {pump.image ? (
                                                            <img
                                                                src={pump.image}
                                                                alt={pump.name || pump.product_code}
                                                                className="h-16 w-16 rounded border border-gray-500 object-cover"
                                                                onError={(e) => {
                                                                    const target =
                                                                        e.target as HTMLImageElement;
                                                                    target.style.display = 'none';
                                                                    const fallback =
                                                                        target.nextElementSibling as HTMLElement;
                                                                    if (fallback)
                                                                        fallback.style.display =
                                                                            'flex';
                                                                }}
                                                            />
                                                        ) : null}
                                                        <div
                                                            className="flex h-16 w-16 items-center justify-center rounded border border-gray-500 bg-gray-600 text-xs text-gray-300"
                                                            style={{
                                                                display: pump.image
                                                                    ? 'none'
                                                                    : 'flex',
                                                            }}
                                                        >
                                                            💧
                                                        </div>
                                                    </div>
                                                    <div className="flex-1">
                                                        <div className="font-medium text-white text-sm">
                                                            {pump.name || pump.product_code}
                                                        </div>
                                                        <div className="text-sm text-gray-300">
                                                            {t('อัตราการไหลสูงสุด')}:{' '}
                                                            {pump.max_flow_rate_lpm || 0} LPM
                                                        </div>
                                                    </div>
                                                    <div className="flex-shrink-0">
                                                        {selectedPump?.id === pump.id && (
                                                            <div className="text-blue-400">
                                                                ✓
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {calculatedZones !== null && calculatedZones === 1 && (
                        <div className="rounded-lg bg-blue-900 p-3">
                            <div className="text-sm text-blue-200 flex items-center gap-3">
                                <p className="font-medium">{t('ผลการคำนวณ')}:</p>
                                <p className="text-lg font-semibold">
                                    {t('ไม่ต้องแบ่งโซน ใช้โซนเดียว ก็เพียงพอ!!')}
                                </p>
                            </div>
                        </div>
                    )}

                    {calculatedZones !== null && calculatedZones >= 2 && (
                        <div className="rounded-lg bg-green-900 p-3">
                            <div className="text-sm text-green-200 flex items-center gap-3">
                                <p className="font-medium">{t('จำนวนโซนที่เหมาะสม')}:</p>
                                <p className="text-lg font-semibold">{calculatedZones} {t('โซน')}</p>
                            </div>
                        </div>
                    )}

                    <div className="rounded-lg bg-yellow-900 p-3">
                        <div className="text-xs text-yellow-200">
                            <p className="font-medium">⚠️ {t('คำเตือน')}:</p>
                            <p className="mt-1">
                                {t(
                                    'นี่คือการคำนวณแบบโดยประมาณ สำหรับกรณีที่พื้นที่เป็นที่เรียบและพืชเป็นพืชชนิดเดียวกันที่ต้องการน้ำเท่ากัน หากลูกค้ามีโซนอยู่แล้ว ให้กลับไปกดปุ่มแบ่งโซนเองเพื่อวาดตามจริงได้เลย แต่ถ้าลูกค้ายังไม่มีโซนและโซนไม่ได้เป็นพื้นที่ราบ ลองทดสอบแบ่งโซนเองได้ หรือปรึกษาทีมผู้เชี่ยวชาญของเราได้'
                                )}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex space-x-3">
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-lg border border-gray-600 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800"
                    >
                        {t('ยกเลิก')}
                    </button>
                    <button
                        onClick={handleApply}
                        disabled={!calculatedZones || calculatedZones < 1}
                        className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-gray-600"
                    >
                        {calculatedZones === 1 ? t('ใช้โซนเดียว') : t('ใช้จำนวนโซนนี้')}
                    </button>
                </div>
            </div>
        </div>
    );
};

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
    const [showPumpModal, setShowPumpModal] = useState(false);

    if (!isOpen) return null;

    const sprinklerConfig = loadSprinklerConfig();
    const totalWaterFlowRateLPM =
        totalPlants * (sprinklerConfig?.flowRatePerMinute || 0) * (sprinklerConfig?.sprinklersPerTree || 1);

    const handleApplyPumpZones = (numberOfZones: number) => {
        onConfigChange({
            ...config,
            numberOfZones: Math.min(numberOfZones, Math.min(totalPlants, 20)),
        });
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
            <div className="absolute inset-0 bg-black bg-opacity-80" onClick={onClose}></div>
            <div className="relative w-full max-w-lg rounded-lg bg-gray-900 p-6 shadow-xl">
                <div className="mb-4 flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-white">🤖 {t('แบ่งโซนอัตโนมัติ')}</h3>
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
                            max={Math.min(totalPlants, 20)}
                            step="1"
                            value={config.numberOfZones === 0 ? '' : config.numberOfZones}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === '') {
                                    onConfigChange({
                                        ...config,
                                        numberOfZones: 0,
                                    });
                                } else {
                                    const num = parseInt(val, 10);
                                    if (!isNaN(num)) {
                                        // Allow typing freely, but clamp to max
                                        onConfigChange({
                                            ...config,
                                            numberOfZones: Math.min(num, Math.min(totalPlants, 20)),
                                        });
                                    }
                                }
                            }}
                            onBlur={(e) => {
                                const val = e.target.value;
                                if (val === '') {
                                    onConfigChange({
                                        ...config,
                                        numberOfZones: 1,
                                    });
                                } else {
                                    const num = parseInt(val, 10);
                                    // Enforce minimum of 1 when user finishes typing
                                    onConfigChange({
                                        ...config,
                                        numberOfZones: Math.max(
                                            1,
                                            Math.min(isNaN(num) ? 1 : num, Math.min(totalPlants, 20))
                                        ),
                                    });
                                }
                            }}
                            className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-white focus:border-blue-500 focus:outline-none"
                        />
                        <p className="mt-1 text-xs text-gray-400">
                            {t('สูงสุด')} {Math.min(totalPlants, 20)} {t('โซน')}
                        </p>
                        <button
                            onClick={() => setShowPumpModal(true)}
                            className="mt-2 w-full rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
                        >
                            💧 {t('แบ่งโซนจากปั๊มน้ำของคุณ')}
                        </button>
                    </div>

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

                    <div className="rounded-lg bg-blue-900 p-3">
                        <div className="text-sm text-blue-200">
                            <p className="font-medium">{t('ข้อมูลสรุป')}:</p>
                            <ul className="mt-1 space-y-1">
                                <li>
                                    • {t('ใช้น้ำประมาณ')}:{' '}
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
                                    • {t('ใช้เวลารดน้ำประมาณ')}:{' '}
                                    {(() => {
                                        const sprinklerConfig = loadSprinklerConfig();
                                        const numberOfZones = config.numberOfZones || 1;
                                        const waterPerZone = numberOfZones > 0 ? totalWaterNeed / numberOfZones : 0;
                                        const totalFlowRateLPM = totalPlants * (sprinklerConfig?.flowRatePerMinute || 0) * (sprinklerConfig?.sprinklersPerTree || 1);

                                        if (totalFlowRateLPM > 0 && waterPerZone > 0) {
                                            const wateringTimeMinutes = waterPerZone / totalFlowRateLPM;
                                            if (wateringTimeMinutes >= 60) {
                                                const hours = Math.floor(wateringTimeMinutes / 60);
                                                const minutes = Math.round(wateringTimeMinutes % 60);
                                                return `${hours} ${t('ชั่วโมง')} ${minutes > 0 ? `${minutes} ${t('นาที')}` : ''} ${t('ต่อโซน')}`;
                                            } else {
                                                return `${wateringTimeMinutes.toFixed(1)} ${t('นาที')} ${t('ต่อโซน')}`;
                                            }
                                        }
                                        return `- ${t('ต่อโซน')}`;
                                    })()}
                                </li>
                            </ul>
                        </div>
                    </div>
                </div>

                <div className="mt-6 flex space-x-3">
                    <button
                        onClick={onClose}
                        className="flex-1 rounded-lg border border-gray-600 px-4 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800"
                    >
                        {t('ยกเลิก')}
                    </button>

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

                <PumpBasedZoneModal
                    isOpen={showPumpModal}
                    onClose={() => setShowPumpModal(false)}
                    totalWaterFlowRateLPM={totalWaterFlowRateLPM}
                    onApplyZones={handleApplyPumpZones}
                    t={t}
                />
            </div>
        </div>
    );
};

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
                                    {(() => {
                                        const config = loadSprinklerConfig();
                                        const sprinklersPerTree = config?.sprinklersPerTree || 1;
                                        if (sprinklersPerTree > 1) {
                                            return (
                                                <span className="ml-2 text-blue-200">
                                                    ({debugInfo.totalPlants * sprinklersPerTree}{' '}
                                                    หัวฉีด)
                                                </span>
                                            );
                                        }
                                        return null;
                                    })()}
                                </p>
                                <p className="text-blue-300">
                                    {t('ต้นไม้ในโซน')}:{' '}
                                    <span className="text-white">
                                        {zones.reduce((sum, zone) => sum + zone.plants.length, 0)}
                                    </span>
                                    {(() => {
                                        const config = loadSprinklerConfig();
                                        const sprinklersPerTree = config?.sprinklersPerTree || 1;
                                        const totalPlantsInZones = zones.reduce(
                                            (sum, zone) => sum + zone.plants.length,
                                            0
                                        );
                                        if (sprinklersPerTree > 1) {
                                            return (
                                                <span className="ml-2 text-blue-200">
                                                    ({totalPlantsInZones * sprinklersPerTree}{' '}
                                                    หัวฉีด)
                                                </span>
                                            );
                                        }
                                        return null;
                                    })()}
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
                                            const sprinklersPerTree =
                                                config?.sprinklersPerTree || 1;
                                            return formatWaterVolumeWithFlowRate(
                                                actualTotalWaterNeed * sprinklersPerTree,
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
                                        {zone.plants.length} ต้น
                                        {(() => {
                                            const config = loadSprinklerConfig();
                                            const sprinklersPerTree =
                                                config?.sprinklersPerTree || 1;
                                            if (sprinklersPerTree > 1) {
                                                return (
                                                    <span className="ml-1 text-green-300">
                                                        ({zone.plants.length * sprinklersPerTree}{' '}
                                                        หัวฉีด)
                                                    </span>
                                                );
                                            }
                                            return null;
                                        })()}
                                        {' | '}
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

                        <div className="mt-4">
                            <h5 className="mb-2 font-medium text-yellow-200">
                                📋 เปรียบเทียบรายโซน
                            </h5>
                            <div className="space-y-2">
                                {zones.map((zone, index) => {
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
                                const plantCount = zone.plants.length;
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
                                            {(() => {
                                                const config = loadSprinklerConfig();
                                                const sprinklersPerTree =
                                                    config?.sprinklersPerTree || 1;
                                                if (sprinklersPerTree > 1) {
                                                    return (
                                                        <span className="ml-1 text-purple-200">
                                                            ({plantCount * sprinklersPerTree}{' '}
                                                            หัวฉีด)
                                                        </span>
                                                    );
                                                }
                                                return null;
                                            })()}
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

export default function EnhancedHorticulturePlannerPage() {
    const { t } = useLanguage();

    // Separate state for lateral pipes to bypass history management issues
    const [lateralPipesState, setLateralPipesState] = useState<LateralPipe[]>([]);

    // Elevation control panel state
    const [showElevationControlPanel, setShowElevationControlPanel] = useState(false);

    // 3D Map popup state
    const [show3DMap, setShow3DMap] = useState(false);

    // Onboarding Tour state
    const [showOnboardingTour, setShowOnboardingTour] = useState(false);
    const [tourSteps, setTourSteps] = useState<TourStep[]>([]);

    // Initialize tour on mount
    useEffect(() => {
        if (shouldShowTour()) {
            setTourSteps(getInitialTourSteps(t));
            // Auto-start tour immediately when page loads
            // Use requestAnimationFrame to ensure DOM is ready
            requestAnimationFrame(() => {
                setShowOnboardingTour(true);
            });
        } else {
            setTourSteps(getInitialTourSteps(t));
        }
    }, [t]);

    const handleStartTour = () => {
        setTourSteps(getInitialTourSteps(t));
        setShowOnboardingTour(true);
    };

    const handleTourComplete = () => {
        markTourCompleted();
        setShowOnboardingTour(false);
    };

    const handleTourSkip = () => {
        markTourSkipped();
        setShowOnboardingTour(false);
    };

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

        // คำนวณ plantCount และ totalWaterNeed ถ้ายังไม่มี
        const plantCount = lateralPipe.plantCount ?? (lateralPipe.plants?.length || 0);
        const totalWaterNeed =
            lateralPipe.totalWaterNeed ??
            (lateralPipe.plants?.reduce(
                (sum, plant) => sum + (plant.plantData?.waterNeed || 0),
                0
            ) ||
                0);
        const sprinklersPerTree = sprinklerConfig?.sprinklersPerTree || 1;
        const totalFlowRate = plantCount * flowRatePerMinute * sprinklersPerTree;

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
                                            {plantCount.toLocaleString()} {t('ต้น')}
                                            {sprinklersPerTree > 1 && (
                                                <span className="ml-2 text-sm text-green-600">
                                                    ({plantCount * sprinklersPerTree} หัวฉีด)
                                                </span>
                                            )}
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
                                                {totalWaterNeed.toFixed(1)} {t('ลิตร')}
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
                const config = loadSprinklerConfig();
                const sprinklersPerTree = config?.sprinklersPerTree || 1;
                const totalFlowRate = plantCount * flowRate * sprinklersPerTree;
                return `${totalFlowRate.toFixed(2)} ${t('ลิตร/นาที')}`;
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

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [projectName, setProjectName] = useState<string>('');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const [customerName, setCustomerName] = useState<string>('');
    const [sprinklerConfig, setSprinklerConfig] = useState<SprinklerFormData | null>(null);
    const [showSprinklerConfigModal, setShowSprinklerConfigModal] = useState(false);
    const [selectedLateralPipe, setSelectedLateralPipe] = useState<LateralPipe | null>(null);
    const [showLateralPipeInfoModal, setShowLateralPipeInfoModal] = useState(false);

    const [isEditingExistingField, setIsEditingExistingField] = useState<boolean>(false);

    useEffect(() => {
        const savedConfig = loadSprinklerConfig();
        if (savedConfig) {
            setSprinklerConfig({
                flowRatePerMinute: savedConfig.flowRatePerMinute.toString(),
                pressureBar: savedConfig.pressureBar.toString(),
                sprinklersPerTree: (savedConfig.sprinklersPerTree || 1).toString(),
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
    // เก็บข้อมูลโซนที่ถูกลบ เพื่อวาดทับกลับด้วย id/สี/ชื่อเดิม
    const [pendingRedrawZone, setPendingRedrawZone] = useState<{
        id: string;
        name: string;
        color: string;
        layoutIndex: number;
    } | null>(null);

    const [showAutoZoneModal, setShowAutoZoneModal] = useState(false);
    const [autoZoneConfig, setAutoZoneConfig] = useState<AutoZoneConfig>({
        numberOfZones: 2,
        balanceWaterNeed: false,
        balancePlantCount: true,
        debugMode: false,
        paddingMeters: 2,
        useVoronoi: true,
    });
    const [isCreatingAutoZones, setIsCreatingAutoZones] = useState(false);
    const [autoZoneResult, setAutoZoneResult] = useState<AutoZoneResult | null>(null);
    const [showAutoZoneDebugModal, setShowAutoZoneDebugModal] = useState(false);
    const [currentDrawnZone, setCurrentDrawnZone] = useState<ManualIrrigationZone | null>(null);
    const [targetWaterPerZone, setTargetWaterPerZone] = useState(0);

    const [isZoneEditMode, setIsZoneEditMode] = useState(false);
    const [selectedZoneForEdit, setSelectedZoneForEdit] = useState<IrrigationZone | null>(null);
    const [zoneControlPoints, setZoneControlPoints] = useState<Coordinate[]>([]);
    const [, setDraggedControlPointIndex] = useState<number | null>(null);

    const [showPlantTypeSelectionModal, setShowPlantTypeSelectionModal] = useState(false);
    const [showPlantAreaSelectionModal, setShowPlantAreaSelectionModal] = useState(false);
    const [showStepInfoModal, setShowStepInfoModal] = useState(false);
    const [currentStepInfo, setCurrentStepInfo] = useState<1 | 2 | 3 | 4 | 5>(1);
    const [currentPlantArea, setCurrentPlantArea] = useState<PlantArea | null>(null);
    const [, setIsDrawingPlantArea] = useState(false);

    const [activeTab, setActiveTab] = useState('area');
    const [hasVisitedSummaryTab, setHasVisitedSummaryTab] = useState(false);
    const [editMode, setEditMode] = useState<string | null>(null);
    const [isFreehandMode, setIsFreehandMode] = useState(false);
    const [isFreehandLateralPipeMode, setIsFreehandLateralPipeMode] = useState(false);

    const [isCompactMode, setIsCompactMode] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isRetrying, setIsRetrying] = useState(false);

    const [mapCenter, setMapCenter] = useState<[number, number]>([12.609731, 102.050412]);
    const [, setMap] = useState<google.maps.Map | null>(null);
    const [selectedExclusionType, setSelectedExclusionType] =
        useState<keyof typeof EXCLUSION_COLORS>('building');
    const [, setDrawingMainPipe] = useState<{ toZone: string | null }>({
        toZone: null,
    });

    const [, setIsNewPlantMode] = useState(false);
    const [isCreatingConnection, setIsCreatingConnection] = useState(false);
    const [connectionStartPlant, setConnectionStartPlant] = useState<PlantLocation | null>(null);
    const [plantPlacementMode, setPlantPlacementMode] = useState<'free' | 'plant_grid'>('free');
    const [highlightedPipes, setHighlightedPipes] = useState<string[]>([]);
    const [, setDragMode] = useState<'none' | 'connecting'>('none');
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

    const [isDeleteMode, setIsDeleteMode] = useState(false);
    const [showDeleteMainAreaConfirm, setShowDeleteMainAreaConfirm] = useState(false);
    const [deletedPipeCount, setDeletedPipeCount] = useState(0);

    const [highlightedPlants, setHighlightedPlants] = useState<Set<string>>(new Set());

    const [isRulerMode, setIsRulerMode] = useState(false);
    const [rulerStartPoint, setRulerStartPoint] = useState<Coordinate | null>(null);
    const [currentMousePosition, setCurrentMousePosition] = useState<Coordinate | null>(null);
    const [currentDistance, setCurrentDistance] = useState(0);
    const [showRulerWindow, setShowRulerWindow] = useState(false);

    const [showPlantRotationControl, setShowPlantRotationControl] = useState(false);
    const [isApplyingRotation, setIsApplyingRotation] = useState(false);
    const [tempRotationAngle, setTempRotationAngle] = useState(0);

    // Auto Lateral Pipe Modal
    const [showAutoLateralPipeModal, setShowAutoLateralPipeModal] = useState(false);

    // Drawing distance overlay states - REMOVED (using DistanceMeasurementOverlay instead)

    const mapRef = useRef<google.maps.Map | null>(null);
    const markersRef = useRef<Map<string, google.maps.Marker>>(new Map());
    const polygonsRef = useRef<Map<string, google.maps.Polygon>>(new Map());
    const polylinesRef = useRef<Map<string, google.maps.Polyline>>(new Map());
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
            selectedPlantType: DEFAULT_PLANT_TYPES()[0],
            availablePlants: DEFAULT_PLANT_TYPES(),
            editMode: null,
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
            lateralPipeDrawing: {
                isActive: false,
                isContinuousMode: false,
                placementMode: null,
                startPoint: null,
                snappedStartPoint: null,
                currentPoint: null,
                rawCurrentPoint: null,
                selectedPlants: [],
                totalWaterNeed: 0,
                plantCount: 0,
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

    const latestLateralPipesRef = useRef(history.present.lateralPipes);

    useEffect(() => {
        latestLateralPipesRef.current = history.present.lateralPipes;
    }, [history.present.lateralPipes]);

    // Track when summary tab is visited
    useEffect(() => {
        if (activeTab === 'summary') {
            setHasVisitedSummaryTab(true);
        }
    }, [activeTab]);

    // Sync lateralPipesState with history.present.lateralPipes when history changes (for UNDO/REDO support)
    // This ensures UNDO/REDO properly updates the displayed pipes
    const prevLateralPipesFromHistoryRef = useRef(history.present.lateralPipes);
    useEffect(() => {
        // Only sync if history has actually changed (e.g., from UNDO/REDO)
        // Compare by reference first for performance, then by deep equality
        if (prevLateralPipesFromHistoryRef.current !== history.present.lateralPipes) {
            // Deep comparison to avoid unnecessary updates
            const prevStr = JSON.stringify(prevLateralPipesFromHistoryRef.current);
            const currentStr = JSON.stringify(history.present.lateralPipes);
            if (prevStr !== currentStr) {
                setLateralPipesState(history.present.lateralPipes);
                prevLateralPipesFromHistoryRef.current = history.present.lateralPipes;
            }
        }
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
            if (
                history.present.plants.length === 0 ||
                !history.present.mainArea ||
                history.present.mainArea.length < 3
            ) {
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

            // 1. เลื่อนต้นไม้ทั้งหมดและลบต้นไม้ที่ออกนอก mainArea
            const movedPlants: PlantLocation[] = [];
            const removedPlantIds = new Set<string>();

            history.present.plants.forEach((plant) => {
                const newPosition: Coordinate = {
                    lat: plant.position.lat + offset.lat,
                    lng: plant.position.lng + offset.lng,
                };

                // ตรวจสอบว่าอยู่ใน mainArea หรือไม่
                if (isPointInPolygon(newPosition, history.present.mainArea)) {
                    movedPlants.push({
                        ...plant,
                        position: newPosition,
                    });
                } else {
                    removedPlantIds.add(plant.id);
                }
            });

            // 2. สร้างต้นไม้ใหม่ในทิศทางตรงข้ามจากต้นไม้ที่เลื่อนแล้วไปจนถึงขอบ mainArea
            const newPlants: PlantLocation[] = [];
            const allCurrentPlants = [...movedPlants];

            // ตรวจสอบว่ามีการหมุนต้นไม้หรือไม่
            const rotationInfo = hasRotation(allCurrentPlants);

            const isHorizontal = direction === 'left' || direction === 'right';

            // หาแนวแถวหรือแนวคอลัมน์ตามทิศทาง
            let groups: PlantLocation[][];

            if (isHorizontal) {
                // เลื่อนซ้าย-ขวา → ใช้แนว row (แนวนอน)
                groups = groupPlantsByRows(allCurrentPlants);
            } else {
                // เลื่อนบน-ล่าง → ใช้แนว column (แนวตั้ง)
                groups = groupPlantsByColumns(allCurrentPlants);
            }

            groups.forEach((group) => {
                if (group.length === 0) return;

                const firstPlant = group[0];
                const plantSpacing = firstPlant.plantData.plantSpacing / 111000;

                // หาต้นไม้ที่อยู่ใกล้ขอบที่สุดในทิศทางตรงข้าม (ใช้ transformed coordinate ถ้ามีการหมุน)
                let edgePlant: Coordinate | null = null;
                let edgePlantTransformed: Coordinate | null = null;

                if (rotationInfo.hasRotation) {
                    // ใช้ transformed coordinate เพื่อหาต้นไม้ที่อยู่ขอบ
                    const plantsWithTransformed = group.map((plant) => ({
                        plant,
                        transformed: transformToRotatedCoordinate(
                            plant.position,
                            rotationInfo.center,
                            rotationInfo.rotationAngle
                        ),
                    }));

                    if (isHorizontal) {
                        if (direction === 'right') {
                            // เลื่อนขวา → หาต้นไม้ที่อยู่ซ้ายสุด (ใน transformed space)
                            const leftmost = plantsWithTransformed.reduce((min, p) =>
                                p.transformed.lng < min.transformed.lng ? p : min
                            );
                            edgePlant = leftmost.plant.position;
                            edgePlantTransformed = leftmost.transformed;
                        } else {
                            // เลื่อนซ้าย → หาต้นไม้ที่อยู่ขวาสุด (ใน transformed space)
                            const rightmost = plantsWithTransformed.reduce((max, p) =>
                                p.transformed.lng > max.transformed.lng ? p : max
                            );
                            edgePlant = rightmost.plant.position;
                            edgePlantTransformed = rightmost.transformed;
                        }
                    } else {
                        if (direction === 'up') {
                            // เลื่อนขึ้น → หาต้นไม้ที่อยู่ล่างสุด (ใน transformed space)
                            const bottommost = plantsWithTransformed.reduce((min, p) =>
                                p.transformed.lat < min.transformed.lat ? p : min
                            );
                            edgePlant = bottommost.plant.position;
                            edgePlantTransformed = bottommost.transformed;
                        } else {
                            // เลื่อนลง → หาต้นไม้ที่อยู่บนสุด (ใน transformed space)
                            const topmost = plantsWithTransformed.reduce((max, p) =>
                                p.transformed.lat > max.transformed.lat ? p : max
                            );
                            edgePlant = topmost.plant.position;
                            edgePlantTransformed = topmost.transformed;
                        }
                    }
                } else {
                    // ไม่มีการหมุน ใช้วิธีเดิม
                    if (isHorizontal) {
                        if (direction === 'right') {
                            const leftmost = group.reduce((min, p) =>
                                p.position.lng < min.position.lng ? p : min
                            );
                            edgePlant = leftmost.position;
                        } else {
                            const rightmost = group.reduce((max, p) =>
                                p.position.lng > max.position.lng ? p : max
                            );
                            edgePlant = rightmost.position;
                        }
                    } else {
                        if (direction === 'up') {
                            const bottommost = group.reduce((min, p) =>
                                p.position.lat < min.position.lat ? p : min
                            );
                            edgePlant = bottommost.position;
                        } else {
                            const topmost = group.reduce((max, p) =>
                                p.position.lat > max.position.lat ? p : max
                            );
                            edgePlant = topmost.position;
                        }
                    }
                }

                if (!edgePlant) return;

                // สร้างต้นไม้ใหม่จากต้นไม้ที่อยู่ขอบไปในทิศทางตรงข้าม
                const currentPosition = { ...edgePlant };
                const currentPositionTransformed = edgePlantTransformed
                    ? { ...edgePlantTransformed }
                    : { ...edgePlant };

                const step = isHorizontal
                    ? direction === 'right'
                        ? -plantSpacing
                        : plantSpacing
                    : direction === 'up'
                        ? -plantSpacing
                        : plantSpacing;

                const maxIterations = 500;
                let iteration = 0;

                while (iteration < maxIterations) {
                    // เลื่อนไปตำแหน่งถัดไป (ใน transformed space ถ้ามีการหมุน)
                    if (rotationInfo.hasRotation) {
                        if (isHorizontal) {
                            currentPositionTransformed.lng += step;
                        } else {
                            currentPositionTransformed.lat += step;
                        }

                        // แปลงกลับเป็นพิกัดจริง (inverse transform)
                        // transformToRotatedCoordinate ใช้ cos(-θ) และ sin(-θ)
                        // ซึ่ง cos(-θ) = cos(θ) และ sin(-θ) = -sin(θ)
                        // ดังนั้น forward matrix คือ: [cos(θ)  sin(θ)]  [dx]
                        //                              [-sin(θ) cos(θ)] [dy]
                        // Inverse matrix คือ: [cos(θ) -sin(θ)]  [dx]
                        //                      [sin(θ)  cos(θ)] [dy]
                        const angleRadians = (rotationInfo.rotationAngle * Math.PI) / 180;
                        const cos = Math.cos(angleRadians);
                        const sin = Math.sin(angleRadians);

                        const dx = currentPositionTransformed.lat - rotationInfo.center.lat;
                        const dy = currentPositionTransformed.lng - rotationInfo.center.lng;

                        // Inverse rotation: หมุนกลับด้วยมุม +θ
                        currentPosition.lat = rotationInfo.center.lat + (dx * cos - dy * sin);
                        currentPosition.lng = rotationInfo.center.lng + (dx * sin + dy * cos);
                    } else {
                        // ไม่มีการหมุน ใช้วิธีเดิม
                        if (isHorizontal) {
                            currentPosition.lng += step;
                        } else {
                            currentPosition.lat += step;
                        }
                    }

                    // ตรวจสอบว่าตำแหน่งนี้อยู่ใน mainArea หรือไม่
                    if (!isPointInPolygon(currentPosition, history.present.mainArea)) {
                        break;
                    }

                    // ตรวจสอบว่ามีต้นไม้อยู่แล้วหรือไม่
                    // ใช้ minDistance ที่ใหญ่ขึ้นเพื่อป้องกันการทับซ้อน (0.85 เท่าของ plantSpacing)
                    const minDistance = plantSpacing * 0.85;
                    let hasPlant = false;

                    // ตรวจสอบกับต้นไม้ทั้งหมด (รวมต้นไม้เดิมและต้นไม้ที่เลื่อนแล้ว)
                    for (const plant of allCurrentPlants) {
                        const distance = calculateDistanceBetweenPoints(
                            currentPosition,
                            plant.position
                        );
                        if (distance < minDistance) {
                            hasPlant = true;
                            break;
                        }
                    }

                    // ตรวจสอบกับต้นไม้ใหม่ที่สร้างแล้วในรอบนี้
                    if (!hasPlant) {
                        for (const newPlant of newPlants) {
                            const distance = calculateDistanceBetweenPoints(
                                currentPosition,
                                newPlant.position
                            );
                            if (distance < minDistance) {
                                hasPlant = true;
                                break;
                            }
                        }
                    }

                    // ตรวจสอบกับต้นไม้ในกลุ่มเดียวกัน (เพื่อป้องกันการสร้างต้นไม้ทับกับต้นไม้ในแถวเดียวกัน)
                    if (!hasPlant && group.length > 0) {
                        for (const groupPlant of group) {
                            const distance = calculateDistanceBetweenPoints(
                                currentPosition,
                                groupPlant.position
                            );
                            if (distance < minDistance) {
                                hasPlant = true;
                                break;
                            }
                        }
                    }

                    // สร้างต้นไม้ใหม่ถ้าไม่มีต้นไม้อยู่แล้ว
                    if (!hasPlant) {
                        newPlants.push({
                            ...firstPlant,
                            id: generateUniqueId('plant'),
                            position: { ...currentPosition },
                        });
                        // เพิ่มต้นไม้ใหม่เข้าไปใน allCurrentPlants เพื่อตรวจสอบในรอบถัดไป
                        allCurrentPlants.push({
                            ...firstPlant,
                            id: newPlants[newPlants.length - 1].id,
                            position: { ...currentPosition },
                        });
                    } else {
                        // ถ้ามีต้นไม้อยู่แล้ว แสดงว่าถึงจุดสิ้นสุด
                        break;
                    }

                    iteration++;
                }
            });

            // รวมต้นไม้ทั้งหมด
            const updatedPlants = [...movedPlants, ...newPlants];

            // อัปเดต subMainPipes
            const updatedSubMainPipes = history.present.subMainPipes.map((subMainPipe) => ({
                ...subMainPipe,
                branchPipes: subMainPipe.branchPipes.map((branchPipe) => ({
                    ...branchPipe,
                    plants: branchPipe.plants
                        .filter((plant) => !removedPlantIds.has(plant.id))
                        .map((plant) => {
                            const movedPlant = movedPlants.find((p) => p.id === plant.id);
                            if (movedPlant) {
                                return movedPlant;
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
            history.present.plants,
            history.present.subMainPipes,
            history.present.mainArea,
            plantMoveStep,
            pushToHistory,
        ]
    );

    const moveSelectedPlants = useCallback(
        (direction: 'up' | 'down' | 'left' | 'right') => {
            if (
                selectedPlantsForMove.size === 0 ||
                !history.present.mainArea ||
                history.present.mainArea.length < 3
            ) {
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

            // 1. เลื่อนต้นไม้ที่เลือกและลบต้นไม้ที่ออกนอก mainArea
            const movedPlants: PlantLocation[] = [];
            const unselectedPlants = history.present.plants.filter(
                (plant) => !selectedPlantsForMove.has(plant.id)
            );
            const removedPlantIds = new Set<string>();

            history.present.plants.forEach((plant) => {
                if (selectedPlantsForMove.has(plant.id)) {
                    const newPosition: Coordinate = {
                        lat: plant.position.lat + offset.lat,
                        lng: plant.position.lng + offset.lng,
                    };

                    // ตรวจสอบว่าอยู่ใน mainArea หรือไม่
                    if (isPointInPolygon(newPosition, history.present.mainArea)) {
                        movedPlants.push({
                            ...plant,
                            position: newPosition,
                        });
                    } else {
                        removedPlantIds.add(plant.id);
                    }
                }
            });

            // 2. สร้างต้นไม้ใหม่ในทิศทางตรงข้ามจากต้นไม้ที่เลื่อนแล้วไปจนถึงขอบ mainArea
            const newPlants: PlantLocation[] = [];
            const allCurrentPlants = [...unselectedPlants, ...movedPlants];

            // ตรวจสอบว่ามีการหมุนต้นไม้หรือไม่
            const rotationInfo = hasRotation(movedPlants);

            const isHorizontal = direction === 'left' || direction === 'right';

            // หาแนวแถวหรือแนวคอลัมน์ตามทิศทาง
            let groups: PlantLocation[][];

            if (isHorizontal) {
                // เลื่อนซ้าย-ขวา → ใช้แนว row (แนวนอน)
                groups = groupPlantsByRows(movedPlants);
            } else {
                // เลื่อนบน-ล่าง → ใช้แนว column (แนวตั้ง)
                groups = groupPlantsByColumns(movedPlants);
            }

            groups.forEach((group) => {
                if (group.length === 0) return;

                const firstPlant = group[0];
                const plantSpacing = firstPlant.plantData.plantSpacing / 111000;

                // หาต้นไม้ที่อยู่ใกล้ขอบที่สุดในทิศทางตรงข้าม (ใช้ transformed coordinate ถ้ามีการหมุน)
                let edgePlant: Coordinate | null = null;
                let edgePlantTransformed: Coordinate | null = null;

                if (rotationInfo.hasRotation) {
                    // ใช้ transformed coordinate เพื่อหาต้นไม้ที่อยู่ขอบ
                    const plantsWithTransformed = group.map((plant) => ({
                        plant,
                        transformed: transformToRotatedCoordinate(
                            plant.position,
                            rotationInfo.center,
                            rotationInfo.rotationAngle
                        ),
                    }));

                    if (isHorizontal) {
                        if (direction === 'right') {
                            // เลื่อนขวา → หาต้นไม้ที่อยู่ซ้ายสุด (ใน transformed space)
                            const leftmost = plantsWithTransformed.reduce((min, p) =>
                                p.transformed.lng < min.transformed.lng ? p : min
                            );
                            edgePlant = leftmost.plant.position;
                            edgePlantTransformed = leftmost.transformed;
                        } else {
                            // เลื่อนซ้าย → หาต้นไม้ที่อยู่ขวาสุด (ใน transformed space)
                            const rightmost = plantsWithTransformed.reduce((max, p) =>
                                p.transformed.lng > max.transformed.lng ? p : max
                            );
                            edgePlant = rightmost.plant.position;
                            edgePlantTransformed = rightmost.transformed;
                        }
                    } else {
                        if (direction === 'up') {
                            // เลื่อนขึ้น → หาต้นไม้ที่อยู่ล่างสุด (ใน transformed space)
                            const bottommost = plantsWithTransformed.reduce((min, p) =>
                                p.transformed.lat < min.transformed.lat ? p : min
                            );
                            edgePlant = bottommost.plant.position;
                            edgePlantTransformed = bottommost.transformed;
                        } else {
                            // เลื่อนลง → หาต้นไม้ที่อยู่บนสุด (ใน transformed space)
                            const topmost = plantsWithTransformed.reduce((max, p) =>
                                p.transformed.lat > max.transformed.lat ? p : max
                            );
                            edgePlant = topmost.plant.position;
                            edgePlantTransformed = topmost.transformed;
                        }
                    }
                } else {
                    // ไม่มีการหมุน ใช้วิธีเดิม
                    if (isHorizontal) {
                        if (direction === 'right') {
                            const leftmost = group.reduce((min, p) =>
                                p.position.lng < min.position.lng ? p : min
                            );
                            edgePlant = leftmost.position;
                        } else {
                            const rightmost = group.reduce((max, p) =>
                                p.position.lng > max.position.lng ? p : max
                            );
                            edgePlant = rightmost.position;
                        }
                    } else {
                        if (direction === 'up') {
                            const bottommost = group.reduce((min, p) =>
                                p.position.lat < min.position.lat ? p : min
                            );
                            edgePlant = bottommost.position;
                        } else {
                            const topmost = group.reduce((max, p) =>
                                p.position.lat > max.position.lat ? p : max
                            );
                            edgePlant = topmost.position;
                        }
                    }
                }

                if (!edgePlant) return;

                // สร้างต้นไม้ใหม่จากต้นไม้ที่อยู่ขอบไปในทิศทางตรงข้าม
                const currentPosition = { ...edgePlant };
                const currentPositionTransformed = edgePlantTransformed
                    ? { ...edgePlantTransformed }
                    : { ...edgePlant };

                const step = isHorizontal
                    ? direction === 'right'
                        ? -plantSpacing
                        : plantSpacing
                    : direction === 'up'
                        ? -plantSpacing
                        : plantSpacing;

                const maxIterations = 500;
                let iteration = 0;

                while (iteration < maxIterations) {
                    // เลื่อนไปตำแหน่งถัดไป (ใน transformed space ถ้ามีการหมุน)
                    if (rotationInfo.hasRotation) {
                        if (isHorizontal) {
                            currentPositionTransformed.lng += step;
                        } else {
                            currentPositionTransformed.lat += step;
                        }

                        // แปลงกลับเป็นพิกัดจริง (inverse transform)
                        // transformToRotatedCoordinate ใช้ cos(-θ) และ sin(-θ)
                        // ซึ่ง cos(-θ) = cos(θ) และ sin(-θ) = -sin(θ)
                        // ดังนั้น forward matrix คือ: [cos(θ)  sin(θ)]  [dx]
                        //                              [-sin(θ) cos(θ)] [dy]
                        // Inverse matrix คือ: [cos(θ) -sin(θ)]  [dx]
                        //                      [sin(θ)  cos(θ)] [dy]
                        const angleRadians = (rotationInfo.rotationAngle * Math.PI) / 180;
                        const cos = Math.cos(angleRadians);
                        const sin = Math.sin(angleRadians);

                        const dx = currentPositionTransformed.lat - rotationInfo.center.lat;
                        const dy = currentPositionTransformed.lng - rotationInfo.center.lng;

                        // Inverse rotation: หมุนกลับด้วยมุม +θ
                        currentPosition.lat = rotationInfo.center.lat + (dx * cos - dy * sin);
                        currentPosition.lng = rotationInfo.center.lng + (dx * sin + dy * cos);
                    } else {
                        // ไม่มีการหมุน ใช้วิธีเดิม
                        if (isHorizontal) {
                            currentPosition.lng += step;
                        } else {
                            currentPosition.lat += step;
                        }
                    }

                    // ตรวจสอบว่าตำแหน่งนี้อยู่ใน mainArea หรือไม่
                    if (!isPointInPolygon(currentPosition, history.present.mainArea)) {
                        break;
                    }

                    // ตรวจสอบว่ามีต้นไม้อยู่แล้วหรือไม่
                    // ใช้ minDistance ที่ใหญ่ขึ้นเพื่อป้องกันการทับซ้อน (0.85 เท่าของ plantSpacing)
                    const minDistance = plantSpacing * 0.85;
                    let hasPlant = false;

                    // ตรวจสอบกับต้นไม้ทั้งหมด (รวมต้นไม้เดิมและต้นไม้ที่เลื่อนแล้ว)
                    for (const plant of allCurrentPlants) {
                        const distance = calculateDistanceBetweenPoints(
                            currentPosition,
                            plant.position
                        );
                        if (distance < minDistance) {
                            hasPlant = true;
                            break;
                        }
                    }

                    // ตรวจสอบกับต้นไม้ใหม่ที่สร้างแล้วในรอบนี้
                    if (!hasPlant) {
                        for (const newPlant of newPlants) {
                            const distance = calculateDistanceBetweenPoints(
                                currentPosition,
                                newPlant.position
                            );
                            if (distance < minDistance) {
                                hasPlant = true;
                                break;
                            }
                        }
                    }

                    // ตรวจสอบกับต้นไม้ในกลุ่มเดียวกัน (เพื่อป้องกันการสร้างต้นไม้ทับกับต้นไม้ในแถวเดียวกัน)
                    if (!hasPlant && group.length > 0) {
                        for (const groupPlant of group) {
                            const distance = calculateDistanceBetweenPoints(
                                currentPosition,
                                groupPlant.position
                            );
                            if (distance < minDistance) {
                                hasPlant = true;
                                break;
                            }
                        }
                    }

                    // สร้างต้นไม้ใหม่ถ้าไม่มีต้นไม้อยู่แล้ว
                    if (!hasPlant) {
                        newPlants.push({
                            ...firstPlant,
                            id: generateUniqueId('plant'),
                            position: { ...currentPosition },
                        });
                        // เพิ่มต้นไม้ใหม่เข้าไปใน allCurrentPlants เพื่อตรวจสอบในรอบถัดไป
                        allCurrentPlants.push({
                            ...firstPlant,
                            id: newPlants[newPlants.length - 1].id,
                            position: { ...currentPosition },
                        });
                    } else {
                        // ถ้ามีต้นไม้อยู่แล้ว แสดงว่าถึงจุดสิ้นสุด
                        break;
                    }

                    iteration++;
                }
            });

            // รวมต้นไม้ทั้งหมด
            const updatedPlants = [...unselectedPlants, ...movedPlants, ...newPlants];

            // อัปเดต subMainPipes
            const updatedSubMainPipes = history.present.subMainPipes.map((subMainPipe) => ({
                ...subMainPipe,
                branchPipes: subMainPipe.branchPipes.map((branchPipe) => ({
                    ...branchPipe,
                    plants: branchPipe.plants
                        .filter((plant) => !removedPlantIds.has(plant.id))
                        .map((plant) => {
                            if (selectedPlantsForMove.has(plant.id)) {
                                const movedPlant = movedPlants.find((p) => p.id === plant.id);
                                if (movedPlant) {
                                    return movedPlant;
                                }
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
            history.present.mainArea,
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

    const handleRulerClick = useCallback(
        (position: Coordinate) => {
            if (!isRulerMode) return;

            if (!position || typeof position.lat !== 'number' || typeof position.lng !== 'number') {
                console.warn('Invalid position for ruler click:', position);
                return;
            }

            try {
                if (!rulerStartPoint) {
                    setRulerStartPoint(position);
                    setCurrentMousePosition(null);
                    setCurrentDistance(0);
                } else {
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

            if (!position || typeof position.lat !== 'number' || typeof position.lng !== 'number') {
                return;
            }

            try {
                if (rafIdRef.current) {
                    cancelAnimationFrame(rafIdRef.current);
                }

                rafIdRef.current = requestAnimationFrame(() => {
                    setCurrentMousePosition(position);

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

    // handleCloseDrawingDistanceOverlay - REMOVED (using DistanceMeasurementOverlay instead)

    // Distance measurement is now handled by DistanceMeasurementOverlay component

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
    }, [
        dimensionLineAngleOffset,
        history.present.exclusionAreas,
        history.present.mainArea,
        history.present.exclusionZones,
        pushToHistory,
        history.present,
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
        const newActiveState = !history.present.pipeConnection.isActive;

        pushToHistory({
            pipeConnection: {
                isActive: newActiveState,
                selectedPoints: [],
                tempConnections: [],
            },
        });
    }, [history.present.pipeConnection.isActive, pushToHistory]);

    const findLateralPipePassingThroughPlant = useCallback(
        (plant: PlantLocation, currentLateralPipes?: any[]): any | null => {
            const threshold = 5;
            const pipesToCheck = currentLateralPipes || history.present.lateralPipes;

            for (const lateralPipe of pipesToCheck) {
                if (!lateralPipe.coordinates || lateralPipe.coordinates.length < 2) continue;

                for (let i = 0; i < lateralPipe.coordinates.length - 1; i++) {
                    const segmentStart = lateralPipe.coordinates[i];
                    const segmentEnd = lateralPipe.coordinates[i + 1];

                    const closestPoint = findClosestPointOnLineSegment(
                        plant.position,
                        segmentStart,
                        segmentEnd
                    );

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

    const mergeLateralPipes = useCallback(
        (existingPipe: any, newCoordinates: Coordinate[], newPlants: PlantLocation[]) => {
            const mergedCoordinates = [...existingPipe.coordinates, ...newCoordinates];
            const existingPlantIds = new Set(existingPipe.plants.map((p: any) => p.id));
            const uniqueNewPlants = newPlants.filter((plant) => !existingPlantIds.has(plant.id));
            const mergedPlants = [...existingPipe.plants, ...uniqueNewPlants];

            const mergedLength = calculatePipeLength(mergedCoordinates);
            const mergedWaterNeed = mergedPlants.reduce(
                (sum, plant) => sum + (plant.plantData?.waterNeed || 0),
                0
            );
            const sprinklerConfig = loadSprinklerConfig();
            const sprinklersPerTree = sprinklerConfig?.sprinklersPerTree || 1;
            const mergedFlowRate =
                mergedPlants.length * (sprinklerConfig?.flowRatePerMinute || 0) * sprinklersPerTree;

            return {
                ...existingPipe,
                coordinates: mergedCoordinates,
                length: mergedLength,
                plants: mergedPlants,
                totalWaterNeed: mergedWaterNeed,
                totalFlowRate: mergedFlowRate,
                plantCount: mergedPlants.length,
                emitterLines: [
                    ...(existingPipe.emitterLines || []),
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

    // Simple test function to create a basic lateral pipe
    const createSimpleLateralPipe = useCallback(
        (fromPoint: any, toPoint: any) => {
            const plants: PlantLocation[] = [];
            if (fromPoint.type === 'plant') {
                plants.push(fromPoint.data);
            }
            if (toPoint.type === 'plant') {
                plants.push(toPoint.data);
            }
            const newLateralPipe = {
                id: generateLateralPipeId(),
                coordinates: [fromPoint.position, toPoint.position],
                length: calculateDistanceBetweenPoints(fromPoint.position, toPoint.position),
                plants: plants,
                placementMode: 'over_plants' as 'over_plants' | 'between_plants',
                totalFlowRate: (() => {
                    const config = loadSprinklerConfig();
                    const sprinklersPerTree = config?.sprinklersPerTree || 1;
                    return plants.length * (config?.flowRatePerMinute || 0) * sprinklersPerTree;
                })(),
                connectionPoint: fromPoint.position,
                totalWaterNeed: plants.reduce(
                    (sum, plant) => sum + (plant.plantData?.waterNeed || 0),
                    0
                ),
                plantCount: plants.length,
                emitterLines: [],
            };

            const currentLateralPipes = latestLateralPipesRef.current || [];
            const updatedLateralPipes = [...currentLateralPipes, newLateralPipe];
            pushToHistory({
                lateralPipes: updatedLateralPipes as LateralPipe[],
                pipeConnection: {
                    ...history.present.pipeConnection,
                    selectedPoints: [],
                },
            });

            latestLateralPipesRef.current = updatedLateralPipes as LateralPipe[];
            setLateralPipesState(updatedLateralPipes as LateralPipe[]);
        },
        [pushToHistory, history.present.pipeConnection, setLateralPipesState]
    );

    const createConnectionPipe = useCallback(
        (fromPoint: any, toPoint: any) => {
            try {
                createSimpleLateralPipe(fromPoint, toPoint);
                return;
            } catch (error) {
                console.error('❌ Simple approach failed:', error);
            }

            const plants: PlantLocation[] = [];
            if (fromPoint.type === 'plant') {
                plants.push(fromPoint.data);
            }
            if (toPoint.type === 'plant') {
                plants.push(toPoint.data);
            }
            const pipeLength = calculateDistanceBetweenPoints(fromPoint.position, toPoint.position);

            const currentLateralPipes = latestLateralPipesRef.current || [];

            let fromLateralPipe =
                fromPoint.type === 'lateralPipe'
                    ? currentLateralPipes.find((pipe) => pipe.id === fromPoint.id)
                    : null;
            let toLateralPipe =
                toPoint.type === 'lateralPipe'
                    ? currentLateralPipes.find((pipe) => pipe.id === toPoint.id)
                    : null;

            const shouldFindExistingPipes = false;
            if (shouldFindExistingPipes) {
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
            }

            if (fromLateralPipe && toLateralPipe) {
                const mergedPipe = mergeLateralPipes(
                    fromLateralPipe,
                    [fromPoint.position, toPoint.position],
                    toLateralPipe.plants
                );

                mergedPipe.coordinates = [
                    ...fromLateralPipe.coordinates,
                    fromPoint.position,
                    toPoint.position,
                    ...toLateralPipe.coordinates,
                ];

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
                const config = loadSprinklerConfig();
                const sprinklersPerTree = config?.sprinklersPerTree || 1;
                mergedPipe.totalFlowRate =
                    allPlants.length * (config?.flowRatePerMinute || 0) * sprinklersPerTree;

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
                const existingPipe = fromLateralPipe || toLateralPipe;

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
                    const allPlantsFromBothPipes: PlantLocation[] = [...plants];

                    if (fromLateralPipe) {
                        fromLateralPipe.plants.forEach((plant: any) => {
                            if (!allPlantsFromBothPipes.some((p) => p.id === plant.id)) {
                                allPlantsFromBothPipes.push(plant);
                            }
                        });
                    }

                    if (toLateralPipe) {
                        toLateralPipe.plants.forEach((plant: any) => {
                            if (!allPlantsFromBothPipes.some((p) => p.id === plant.id)) {
                                allPlantsFromBothPipes.push(plant);
                            }
                        });
                    }

                    const mergedCoordinates = [
                        ...fromLateralPipe!.coordinates,
                        fromPoint.position,
                        toPoint.position,
                        ...toLateralPipe!.coordinates,
                    ];

                    const mergedPipe = {
                        ...fromLateralPipe!,
                        coordinates: mergedCoordinates,
                        length:
                            fromLateralPipe!.length +
                            calculateDistanceBetweenPoints(fromPoint.position, toPoint.position) +
                            toLateralPipe!.length,
                        plants: allPlantsFromBothPipes,
                        plantCount: allPlantsFromBothPipes.length,
                        totalFlowRate: (() => {
                            const config = loadSprinklerConfig();
                            const sprinklersPerTree = config?.sprinklersPerTree || 1;
                            return (
                                allPlantsFromBothPipes.length *
                                (config?.flowRatePerMinute || 0) *
                                sprinklersPerTree
                            );
                        })(),
                        totalWaterNeed: allPlantsFromBothPipes.reduce(
                            (sum, plant) => sum + (plant.plantData?.waterNeed || 0),
                            0
                        ),
                    } as any;

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

                    latestLateralPipesRef.current = updatedLateralPipes;
                } else if (onePlantHasPipe) {
                    const allPlantsForGroup: PlantLocation[] = [...existingPipe!.plants];

                    plants.forEach((plant) => {
                        if (!allPlantsForGroup.some((p) => p.id === plant.id)) {
                            allPlantsForGroup.push(plant);
                        }
                    });

                    const groupId = (existingPipe! as any).groupId || existingPipe!.id;

                    const updatedExistingPipe = {
                        ...existingPipe!,
                        plants: allPlantsForGroup,
                        plantCount: allPlantsForGroup.length,
                        totalWaterNeed: allPlantsForGroup.reduce(
                            (sum, plant) => sum + (plant.plantData?.waterNeed || 0),
                            0
                        ),
                        groupId: groupId,
                    };

                    if ('totalFlowRate' in updatedExistingPipe) {
                        const config = loadSprinklerConfig();
                        const sprinklersPerTree = config?.sprinklersPerTree || 1;
                        (updatedExistingPipe as any).totalFlowRate =
                            allPlantsForGroup.length *
                            (config?.flowRatePerMinute || 0) *
                            sprinklersPerTree;
                    }

                    const connectionPipe = {
                        id: generateLateralPipeId(),
                        coordinates: [fromPoint.position, toPoint.position],
                        length: calculateDistanceBetweenPoints(
                            fromPoint.position,
                            toPoint.position
                        ),
                        plants: allPlantsForGroup,
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
                        groupId: groupId,
                        isConnectionSegment: true,
                    } as any;

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

                    latestLateralPipesRef.current = updatedLateralPipes;
                } else {
                    const allPlantsToAdd: PlantLocation[] = [...plants];
                    const newCoordinates = [fromPoint.position, toPoint.position];
                    const mergedPipe = mergeLateralPipes(
                        existingPipe!,
                        newCoordinates,
                        allPlantsToAdd
                    );

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

                    latestLateralPipesRef.current = updatedLateralPipes;
                }
            } else {
                // เริ่มต้นด้วยต้นไม้ที่เกี่ยวข้องกับจุดเริ่มต้นและจุดปลาย
                const allPlantsForNewPipe: PlantLocation[] = [];

                // เพิ่มต้นไม้จากจุดเริ่มต้น
                if (fromPoint.type === 'plant') {
                    const fromPlant = plants.find((p) => p.id === fromPoint.id);
                    if (fromPlant && !allPlantsForNewPipe.some((p) => p.id === fromPlant.id)) {
                        allPlantsForNewPipe.push(fromPlant);
                    }
                }
                if (fromLateralPipe) {
                    (fromLateralPipe as any).plants.forEach((plant: any) => {
                        if (!allPlantsForNewPipe.some((p) => p.id === plant.id)) {
                            allPlantsForNewPipe.push(plant);
                        }
                    });
                }

                // เพิ่มต้นไม้จากจุดปลาย
                if (toPoint.type === 'plant') {
                    const toPlant = plants.find((p) => p.id === toPoint.id);
                    if (toPlant && !allPlantsForNewPipe.some((p) => p.id === toPlant.id)) {
                        allPlantsForNewPipe.push(toPlant);
                    }
                }
                if (toLateralPipe) {
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
                    plants: allPlantsForNewPipe,
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

                let updatedLateralPipes = latestLateralPipesRef.current || [];

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

                updatedLateralPipes = [...updatedLateralPipes, newLateralPipe];

                pushToHistory({
                    lateralPipes: updatedLateralPipes,
                    pipeConnection: {
                        ...history.present.pipeConnection,
                        selectedPoints: [],
                    },
                });

                latestLateralPipesRef.current = updatedLateralPipes;
            }
        },
        [
            createSimpleLateralPipe,
            findLateralPipePassingThroughPlant,
            mergeLateralPipes,
            pushToHistory,
            history.present.pipeConnection,
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
        // Check for data migration between localStorage keys
        const irrigationData = localStorage.getItem('horticultureIrrigationData');
        const systemData = localStorage.getItem('horticultureSystemData');

        if (irrigationData && !systemData) {
            // Migrate from irrigationData to systemData
            try {
                localStorage.setItem('horticultureSystemData', irrigationData);
            } catch (error) {
                console.warn('⚠️ Failed to migrate data:', error);
            }
        } else if (systemData && !irrigationData) {
            // Migrate from systemData to irrigationData
            try {
                localStorage.setItem('horticultureIrrigationData', systemData);
            } catch (error) {
                console.warn('⚠️ Failed to migrate data:', error);
            }
        }

        const isEditingExisting = localStorage.getItem('isEditingExistingProject');
        const savedData = localStorage.getItem('horticultureIrrigationData');

        const urlParams = new URLSearchParams(window.location.search);
        const editFieldId = urlParams.get('editFieldId');

        if (editFieldId) {
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
                    lateralPipes: projectData.lateralPipes || [],
                    plants: projectData.plants || [],
                    exclusionAreas: projectData.exclusionAreas || [],
                    irrigationZones: projectData.irrigationZones || [],
                    useZones: projectData.useZones || false,
                    selectedPlantType: projectData.selectedPlantType || DEFAULT_PLANT_TYPES()[0],
                    availablePlants: projectData.availablePlants || DEFAULT_PLANT_TYPES(),
                    branchPipeSettings: projectData.branchPipeSettings || {
                        defaultAngle: 90,
                        maxAngle: 180,
                        minAngle: 0,
                        angleStep: 1,
                    },
                };

                dispatchHistory({ type: 'PUSH_STATE', state: loadedState });

                // Update lateral pipes state with loaded data
                setLateralPipesState(loadedState.lateralPipes || []);

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

    const loadFieldDataFromDatabase = async (fieldId: string) => {
        try {
            const response = await axios.get(`/api/fields/${fieldId}`);

            if (response.data.success && response.data.field) {
                const fieldData = response.data.field;
                const projectData = fieldData.project_data || {};

                if (projectData.lateralPipes && projectData.lateralPipes.length === 0) {
                    console.warn('⚠️ No lateralPipes data in database');
                }

                const loadedState: ProjectState = {
                    ...initialState,
                    mainArea: projectData.mainArea || [],
                    zones: projectData.zones || [],
                    pump: projectData.pump || null,
                    mainPipes: projectData.mainPipes || [],
                    subMainPipes: projectData.subMainPipes || [],
                    lateralPipes: projectData.lateralPipes || [],
                    plants: projectData.plants || [],
                    exclusionAreas: projectData.exclusionAreas || [],
                    irrigationZones: projectData.irrigationZones || [],
                    useZones: projectData.useZones || false,
                    selectedPlantType: projectData.selectedPlantType || DEFAULT_PLANT_TYPES()[0],
                    availablePlants: projectData.availablePlants || DEFAULT_PLANT_TYPES(),
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

                if (!safeLocalStorageSet('currentFieldId', fieldId)) {
                    console.error('❌ Failed to save currentFieldId');
                }
                if (!safeLocalStorageSet('currentFieldName', fieldData.name || 'Edited Field')) {
                    console.error('❌ Failed to save currentFieldName');
                }

                setIsEditingExistingField(true);

                dispatchHistory({ type: 'PUSH_STATE', state: loadedState });

                // Update lateral pipes state with loaded data
                setLateralPipesState(loadedState.lateralPipes || []);

                setTimeout(() => {
                    if (mapRef.current) {
                        google.maps.event.trigger(mapRef.current, 'resize');
                    }
                    // ไม่ต้องเรียก regeneratePlantsForAllZones เพราะข้อมูลพืชมีอยู่แล้ว
                }, 500);

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
            } else {
                console.error('❌ Failed to load field data:', response.data);
                alert(t('ไม่สามารถโหลดข้อมูลโปรเจคได้ กรุณาลองใหม่อีกครั้ง'));
            }
        } catch (error) {
            console.error('❌ Error loading field data:', error);
            alert(t('เกิดข้อผิดพลาดในการโหลดข้อมูลโปรเจค กรุณาลองใหม่อีกครั้ง'));
        }
    };

    const tabs = [
        {
            id: 'area',
            name: t('พื้นที่'),
            number: '1',
            description: t('จัดการพื้นที่หลักและโซน'),
        },
        {
            id: 'water',
            name: t('ระบบน้ำ'),
            number: '2',
            description: t('ปั๊มและท่อน้ำ'),
        },
        {
            id: 'summary',
            name: t('สรุป'),
            number: '3',
            description: t('สถิติและบันทึก'),
        },
    ];

    // Helper functions to check if tabs are enabled
    const isTabEnabled = (tabId: string) => {
        if (tabId === 'area') {
            return true; // Always enabled
        }
        if (tabId === 'water') {
            // ต้องมีโซนก่อน
            const hasZones =
                (history.present.irrigationZones && history.present.irrigationZones.length > 0) ||
                (history.present.zones && history.present.zones.length > 0);
            return hasZones;
        }
        if (tabId === 'summary') {
            // ต้องมีท่อย่อย (lateral pipes) ก่อน
            return (
                (history.present.lateralPipes && history.present.lateralPipes.length > 0) ||
                (lateralPipesState && lateralPipesState.length > 0)
            );
        }
        return false;
    };

    const isTabCompleted = (tabId: string) => {
        if (tabId === 'area') {
            // ถ้ามีโซนแล้วถือว่าเสร็จ
            const hasZones =
                (history.present.irrigationZones && history.present.irrigationZones.length > 0) ||
                (history.present.zones && history.present.zones.length > 0);
            return hasZones;
        }
        if (tabId === 'water') {
            // ถ้ามีท่อย่อย (lateral pipes) แล้วถือว่าเสร็จ
            return (
                (history.present.lateralPipes && history.present.lateralPipes.length > 0) ||
                (lateralPipesState && lateralPipesState.length > 0)
            );
        }
        if (tabId === 'summary') {
            // ถ้าเปิดอ่าน tab 3 แล้วถือว่าเสร็จ
            return hasVisitedSummaryTab;
        }
        return false;
    };

    // Navigation functions for tabs
    const canGoToNextTab = () => {
        if (activeTab === 'area') {
            // ต้องมีโซนก่อน (irrigationZones หรือ zones)
            const hasZones =
                (history.present.irrigationZones && history.present.irrigationZones.length > 0) ||
                (history.present.zones && history.present.zones.length > 0);
            return hasZones;
        }
        if (activeTab === 'water') {
            // ต้องมีท่อย่อยก่อน
            return (
                history.present.subMainPipes && history.present.subMainPipes.length > 0
            );
        }
        return true; // summary tab ไม่มีเงื่อนไข
    };

    const handleNextTab = () => {
        if (!canGoToNextTab()) {
            if (activeTab === 'area') {
                alert(t('กรุณาแบ่งโซนก่อนไปยังแท็บถัดไป'));
            } else if (activeTab === 'water') {
                alert(t('กรุณาวางท่อย่อยก่อนไปยังแท็บถัดไป'));
            }
            return;
        }
        const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
        if (currentIndex < tabs.length - 1) {
            setActiveTab(tabs[currentIndex + 1].id);
        }
    };

    const handlePreviousTab = () => {
        const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
        if (currentIndex > 0) {
            setActiveTab(tabs[currentIndex - 1].id);
        }
    };

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

    const handleCreateTemplate = useCallback(() => { }, []);

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
        [
            pushToHistory,
            history.present.mainArea,
            history.present.mainPipes,
            history.present.plants,
            history.present.realTimeEditing,
            history.present.selectedPlantType,
            history.present.subMainPipes,
            history.present.useZones,
            history.present.zones,
        ]
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

    // Reset freehand mode when editMode changes away from mainPipe or subMainPipe
    useEffect(() => {
        if (editMode !== 'mainPipe' && editMode !== 'subMainPipe') {
            setIsFreehandMode(false);
        }
    }, [editMode]);

    const handleCreateCustomPlant = useCallback((plantData?: PlantData) => {
        setEditingPlant(plantData || null);
        setShowCustomPlantModal(true);
    }, []);

    const handleSaveCustomPlant = useCallback(
        (plantData: PlantData) => {
            const newPlant = { ...plantData, id: plantData.id || Date.now() };

            let updatedAvailablePlants;

            const existingPlantIndex = history.present.availablePlants.findIndex(
                (p) => p.id === newPlant.id
            );

            if (existingPlantIndex !== -1) {
                updatedAvailablePlants = history.present.availablePlants.map((p) =>
                    p.id === newPlant.id ? newPlant : p
                );
            } else {
                const customPlants = history.present.availablePlants.filter((p) => p.id > 10);
                const defaultPlants = history.present.availablePlants.filter((p) => p.id <= 10);

                const maxCustomPlants = 10;
                let newCustomPlants = [newPlant, ...customPlants];

                if (newCustomPlants.length > maxCustomPlants) {
                    newCustomPlants = newCustomPlants.slice(0, maxCustomPlants);

                    alert(t('สามารถเพิ่มพืชได้สูงสุด 10 ชนิด พืชที่เพิ่มล่าสุดจะถูกแทนที่'));
                }

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
                selectedPlantType: newPlant,
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

        map.addListener('zoom_changed', () => { });
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

    const handleFreehandLateralPipeComplete = useCallback(
        (coordinates: Coordinate[]) => {
            if (!coordinates || coordinates.length < 2) {
                return;
            }

            const startPoint = coordinates[0];
            const endPoint = coordinates[coordinates.length - 1];

            // Default to 'over_plants' mode for freehand lateral pipes
            const placementMode: 'over_plants' | 'between_plants' = 'over_plants';

            // Find plants along the ENTIRE path (all segments), not just start to end
            // This ensures we capture plants from ALL rows/columns that the pipe passes through
            const plants = history.present.plants;
            const allSelectedPlantsSet = new Set<string>();
            const selectedPlantsArray: PlantLocation[] = [];

            // Get rotation info to properly handle rotated plant grids
            const rotationInfo = hasRotation(plants);

            // Transform function for rotation-aware calculations
            const transformPosition = (pos: Coordinate): Coordinate => {
                if (rotationInfo.hasRotation) {
                    return transformToRotatedCoordinate(
                        pos,
                        rotationInfo.center,
                        rotationInfo.rotationAngle
                    );
                }
                return pos;
            };

            // Calculate adaptive distance threshold based on plant spacing
            let distanceThreshold = 20 / 111320; // Default: 20 meters in degrees
            if (plants.length >= 2) {
                // Estimate average plant spacing from row groups
                const rows = groupPlantsByRows(plants);
                if (rows.length >= 2) {
                    // Calculate row spacing
                    const rowCenters = rows.map(row => {
                        const sumLat = row.reduce((sum, p) => {
                            const transformed = transformPosition(p.position);
                            return sum + transformed.lat;
                        }, 0);
                        return sumLat / row.length;
                    }).sort((a, b) => a - b);

                    const rowSpacings: number[] = [];
                    for (let i = 1; i < rowCenters.length; i++) {
                        rowSpacings.push(Math.abs(rowCenters[i] - rowCenters[i - 1]));
                    }

                    if (rowSpacings.length > 0) {
                        const avgRowSpacing = rowSpacings.reduce((a, b) => a + b, 0) / rowSpacings.length;
                        // Use 80% of row spacing as threshold to capture plants in the row
                        distanceThreshold = Math.max(5 / 111320, avgRowSpacing * 0.8);
                    }
                }
            }

            // For freehand pipes, find plants that are close to ANY segment of the path
            // This ensures we capture plants from all rows/columns that the pipe passes through
            for (let i = 0; i < coordinates.length - 1; i++) {
                const segmentStart = coordinates[i];
                const segmentEnd = coordinates[i + 1];

                // Method 1: Use findPlantsInLateralPath to find plants aligned with this segment
                const segmentPlants = findPlantsInLateralPath(
                    segmentStart,
                    segmentEnd,
                    plants,
                    placementMode,
                    30 // Increased threshold to capture more plants from different rows
                );

                // Method 2: Also check for plants that are close to the line segment
                // Use rotation-aware distance calculation
                plants.forEach((plant) => {
                    if (!allSelectedPlantsSet.has(plant.id)) {
                        // For rotated grids, transform positions before calculating distance
                        let distanceToSegment: number;

                        if (rotationInfo.hasRotation) {
                            // Transform all positions to the rotated coordinate system
                            const transformedPlant = transformPosition(plant.position);
                            const transformedStart = transformPosition(segmentStart);
                            const transformedEnd = transformPosition(segmentEnd);

                            distanceToSegment = distanceFromPointToLineSegment(
                                transformedPlant,
                                transformedStart,
                                transformedEnd
                            );
                        } else {
                            distanceToSegment = distanceFromPointToLineSegment(
                                plant.position,
                                segmentStart,
                                segmentEnd
                            );
                        }

                        // Include plants within the adaptive distance threshold
                        if (distanceToSegment < distanceThreshold) {
                            allSelectedPlantsSet.add(plant.id);
                            selectedPlantsArray.push(plant);
                        }
                    }
                });

                // Add plants found by findPlantsInLateralPath
                segmentPlants.forEach((plant) => {
                    if (!allSelectedPlantsSet.has(plant.id)) {
                        allSelectedPlantsSet.add(plant.id);
                        selectedPlantsArray.push(plant);
                    }
                });
            }

            // Remove duplicates (in case a plant was added multiple times)
            const selectedPlants = selectedPlantsArray.filter(
                (plant, index, self) => index === self.findIndex((p) => p.id === plant.id)
            );

            if (selectedPlants.length === 0) {
                alert(t('ไม่พบต้นไม้ในเส้นทางที่เลือก'));
                return;
            }

            // Find intersection with subMainPipe - check ALL segments of the freehand path
            let intersectionData: {
                intersectionPoint: Coordinate;
                subMainPipeId: string;
                segmentIndex: number;
            } | null = null;

            // Check every segment of the freehand path for intersection with subMainPipe
            for (let i = 0; i < coordinates.length - 1; i++) {
                const segmentStart = coordinates[i];
                const segmentEnd = coordinates[i + 1];

                const segmentIntersection = findLateralSubMainIntersection(
                    segmentStart,
                    segmentEnd,
                    history.present.subMainPipes
                );

                if (segmentIntersection) {
                    intersectionData = segmentIntersection;
                    break; // Use the first intersection found
                }
            }

            // Find closest subMainPipe for connection - ONLY if path actually intersects with subMainPipe
            let connectionPoint: Coordinate | null = null;
            let subMainPipeId: string | null = null;

            if (intersectionData) {
                // Path intersects with subMainPipe - use intersection point
                connectionPoint = intersectionData.intersectionPoint;
                subMainPipeId = intersectionData.subMainPipeId;
            } else {
                // Path does NOT intersect with subMainPipe - check if start point is on subMainPipe
                const closestSubMain = history.present.subMainPipes.find((sm) =>
                    isPointOnSubMainPipe(startPoint, sm, 20)
                );

                if (closestSubMain) {
                    const closestConnectionPoint = findClosestConnectionPoint(
                        startPoint,
                        closestSubMain
                    );
                    if (closestConnectionPoint) {
                        // Verify the connection point is actually on the subMainPipe
                        const distanceToSubMain = distanceFromPointToLineSegment(
                            closestConnectionPoint,
                            closestSubMain.coordinates[0],
                            closestSubMain.coordinates[closestSubMain.coordinates.length - 1]
                        );

                        // Only use if connection point is very close to subMainPipe (within 5 meters)
                        if (distanceToSubMain < 5 / 111320) {
                            connectionPoint = closestConnectionPoint;
                            subMainPipeId = closestSubMain.id;
                        }
                    }
                }
            }

            // If no valid connection point found, don't create one
            if (!connectionPoint || !subMainPipeId) {
                connectionPoint = null;
                subMainPipeId = null;
            }

            // Calculate total water need
            const totalWaterNeed = selectedPlants.reduce(
                (sum, plant) => sum + (plant.plantData?.waterNeed || 0),
                0
            );

            // Get zone ID
            const targetZoneId = getCurrentZoneIdForLateralPipe(
                {
                    coordinates,
                    plants: selectedPlants,
                } as any,
                history.present,
                manualZones
            );

            const lateralPipeId = generateLateralPipeId();

            // Only create intersection data if path actually intersects with subMainPipe
            let intersectionDataForPipe:
                | {
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
                }
                | undefined;

            if (intersectionData && connectionPoint) {
                intersectionDataForPipe = {
                    point: intersectionData.intersectionPoint,
                    subMainPipeId: intersectionData.subMainPipeId,
                    segmentIndex: intersectionData.segmentIndex,
                    segmentStats: calculateLateralPipeSegmentStats(
                        startPoint,
                        endPoint,
                        intersectionData.intersectionPoint,
                        selectedPlants
                    ),
                };
            } else {
                intersectionDataForPipe = undefined;
            }

            const lateralPipe: LateralPipe = {
                id: lateralPipeId,
                subMainPipeId: subMainPipeId || '', // Use empty string if no connection
                coordinates,
                length: calculatePipeLength(coordinates),
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
                connectionPoint: connectionPoint || startPoint, // Fallback to start point if no connection
                totalWaterNeed,
                plantCount: selectedPlants.length,
                zoneId: targetZoneId,
                intersectionData: intersectionDataForPipe,
            };

            // Generate emitter lines if needed (placementMode is always 'over_plants' for freehand)
            if (history.present.lateralPipeSettings.autoGenerateEmitters) {
                lateralPipe.emitterLines = generateEmitterLines(
                    lateralPipeId,
                    startPoint,
                    endPoint,
                    selectedPlants,
                    history.present.lateralPipeSettings.emitterDiameter
                );
            }

            // Add to lateral pipes
            const newLateralPipes = [...history.present.lateralPipes, lateralPipe];

            // Update first lateral pipe stats if needed
            const currentZoneId = targetZoneId;
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
                        ((lateralPipe.totalWaterNeed - firstPipeWaterNeed) / firstPipeWaterNeed) *
                        100;
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

            dispatchHistory({
                type: 'PUSH_STATE',
                state: {
                    ...history.present,
                    lateralPipes: newLateralPipes,
                    firstLateralPipeWaterNeeds: updatedFirstLateralPipeWaterNeeds,
                    firstLateralPipePlantCounts: updatedFirstLateralPipePlantCounts,
                    lateralPipeComparison: updatedLateralPipeComparison,
                },
            });

            // Update lateralPipesState to ensure the new pipe is visible
            setLateralPipesState(newLateralPipes);

            if (typeof window !== 'undefined' && (window as any).showNotification) {
                (window as any).showNotification(
                    t('วาดท่อย่อยอิสระเสร็จสิ้น') || 'วาดท่อย่อยอิสระเสร็จสิ้น',
                    'success'
                );
            }
        },
        [
            history.present.plants,
            history.present.subMainPipes,
            history.present.lateralPipes,
            history.present.lateralPipeSettings,
            history.present.firstLateralPipeWaterNeeds,
            history.present.firstLateralPipePlantCounts,
            manualZones,
            dispatchHistory,
            t,
        ]
    );

    const handleDrawingComplete = useCallback(
        (coordinates: Coordinate[], shapeType?: string) => {
            if (!coordinates || coordinates.length === 0) {
                return;
            }

            // Support both old signature (coordinates only) and new signature (coordinates + shapeType)
            // For freehand pipes, shapeType will be 'polyline'
            const isPolyline =
                editMode === 'mainPipe' || editMode === 'subMainPipe' || shapeType === 'polyline';
            const isValidForPolyline = isPolyline && coordinates.length >= 2;
            const isValidForPolygon = !isPolyline && coordinates.length >= 3;

            if (!isValidForPolyline && !isValidForPolygon) {
                return;
            }

            // Drawing distance overlay is now handled by DistanceMeasurementOverlay component

            if (history.present.mainArea.length === 0) {
                const center = coordinates.reduce(
                    (acc, point) => [acc[0] + point.lat, acc[1] + point.lng],
                    [0, 0]
                );
                setMapCenter([center[0] / coordinates.length, center[1] / coordinates.length]);
                pushToHistory({ mainArea: coordinates });
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
                // สร้างต้นไม้อัตโนมัติทันทีเมื่อวาดพื้นที่เสร็จ
                setTimeout(() => {
                    if (history.present.plants.length === 0 &&
                        !history.present.plantSelectionMode.isCompleted) {
                        handlePlantSelection();
                    }
                }, 200);
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
            } else if (editMode === 'exclusion') {
                const newExclusion: ExclusionArea = {
                    id: generateUniqueId('exclusion'),
                    type: selectedExclusionType,
                    coordinates,
                    name: `${selectedExclusionType} ${history.present.exclusionAreas.filter(
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
                setIsDeleteMode(false);
                setShowPlantAreaSelectionModal(true);
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
                    diameter: 100,
                    material: 'pvc',
                    flowRate: 1000,
                };

                pushToHistory({ mainPipes: [...history.present.mainPipes, newMainPipe] });
                setDrawingMainPipe({ toZone: null });
                setEditMode(null);
            } else if (editMode === 'lateralPipe') {
                // Handle freehand lateral pipe drawing
                if (isFreehandLateralPipeMode && coordinates.length >= 2) {
                    handleFreehandLateralPipeComplete(coordinates);
                    return;
                }

                // Handle regular lateral pipe drawing
                if (history.present.lateralPipeDrawing.isActive) {
                    if (coordinates.length >= 2) {
                        const endPoint = coordinates[coordinates.length - 1];

                        if (!history.present.lateralPipeDrawing.startPoint) {
                            dispatchHistory({
                                type: 'PUSH_STATE',
                                state: {
                                    ...history.present,
                                    lateralPipeDrawing: {
                                        ...history.present.lateralPipeDrawing,
                                        startPoint: coordinates[0],
                                        currentPoint: coordinates[0],
                                        rawCurrentPoint: coordinates[0],
                                    },
                                },
                            });
                        }

                        handleFinishLateralPipeDrawing(endPoint);
                    }
                    return;
                }
            } else if (editMode === 'subMainPipe') {
                let targetZone: Zone;
                // ตรวจสอบโซนเสมอ แม้ว่า useZones จะเป็น false ก็ตาม
                // เพื่อรองรับกรณีที่มีโซน manual zone หรือ irrigationZones
                let detectedZone: Zone | null = null;

                // ใช้ irrigationZones ก่อน (โซนอัตโนมัติหรือ manual zone) ถ้ามี
                if (history.present.irrigationZones && history.present.irrigationZones.length > 0) {
                    // ใช้ irrigationZones เพื่อหาโซน
                    const endPoint = coordinates[coordinates.length - 1];
                    for (const zone of history.present.irrigationZones) {
                        if (isPointInPolygon(endPoint, zone.coordinates)) {
                            // แปลง IrrigationZone เป็น Zone เพื่อใช้กับ targetZone
                            detectedZone = {
                                id: zone.id,
                                name: zone.name,
                                coordinates: zone.coordinates,
                                plantData: history.present.selectedPlantType,
                                plantCount: zone.plants.length,
                                totalWaterNeed: zone.totalWaterNeed,
                                area: calculateAreaFromCoordinates(zone.coordinates),
                                color: zone.color,
                            };
                            break;
                        }
                    }
                    // ถ้าไม่เจอที่จุดสิ้นสุด ให้ลองจุดกลาง
                    if (!detectedZone) {
                        const midIndex = Math.floor(coordinates.length / 2);
                        const midPoint = coordinates[midIndex];
                        for (const zone of history.present.irrigationZones) {
                            if (isPointInPolygon(midPoint, zone.coordinates)) {
                                detectedZone = {
                                    id: zone.id,
                                    name: zone.name,
                                    coordinates: zone.coordinates,
                                    plantData: history.present.selectedPlantType,
                                    plantCount: zone.plants.length,
                                    totalWaterNeed: zone.totalWaterNeed,
                                    area: calculateAreaFromCoordinates(zone.coordinates),
                                    color: zone.color,
                                };
                                break;
                            }
                        }
                    }
                    // ถ้ายังไม่เจอ ให้ลองจุดเริ่มต้น
                    if (!detectedZone) {
                        const startPoint = coordinates[0];
                        for (const zone of history.present.irrigationZones) {
                            if (isPointInPolygon(startPoint, zone.coordinates)) {
                                detectedZone = {
                                    id: zone.id,
                                    name: zone.name,
                                    coordinates: zone.coordinates,
                                    plantData: history.present.selectedPlantType,
                                    plantCount: zone.plants.length,
                                    totalWaterNeed: zone.totalWaterNeed,
                                    area: calculateAreaFromCoordinates(zone.coordinates),
                                    color: zone.color,
                                };
                                break;
                            }
                        }
                    }
                }

                // ถ้ายังไม่เจอ และมี zones (โซนแบบเดิม) ให้ลองใช้ zones
                if (!detectedZone && history.present.zones && history.present.zones.length > 0) {
                    detectedZone = findZoneForPipe(coordinates, history.present.zones);
                }

                // ถ้าเจอโซน ให้ใช้โซนนั้น
                if (detectedZone) {
                    targetZone = detectedZone;
                } else if (history.present.useZones) {
                    // ถ้า useZones เป็น true แต่ไม่เจอโซน ให้แจ้งเตือน
                    alert('กรุณาเลือกโซนก่อนวางท่อเมนรอง');
                    return;
                } else {
                    // ถ้า useZones เป็น false และไม่เจอโซน ให้ใช้ main-area
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

                const { mainPipes: updatedMainPipes, snapped } = snapMainPipeEndToSubMainPipe(
                    history.present.mainPipes,
                    newSubMainPipe.coordinates,
                    history.present.zones,
                    history.present.irrigationZones
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
            }
        },
        [
            editMode,
            pushToHistory,
            t,
            autoZoomToMainArea,
            selectedExclusionType,
            dimensionLineAngleOffset,
        ]
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
                (history.present.lateralPipeDrawing.isActive &&
                    history.present.lateralPipeDrawing.placementMode) ||
                editMode === 'lateralPipe'
            ) {
                if (!history.present.lateralPipeDrawing.startPoint) {
                    const clickedPlant = findClosestPlantToPoint(
                        clickPoint,
                        history.present.plants,
                        15
                    );

                    const clickedSubMainPipe = findClosestSubMainPipeInSameZone(
                        clickPoint,
                        history.present.subMainPipes,
                        history.present.zones,
                        history.present.irrigationZones,
                        10
                    );

                    const plantDistance = clickedPlant
                        ? calculateDistanceBetweenPoints(clickPoint, clickedPlant.position)
                        : Infinity;
                    const pipeDistance = clickedSubMainPipe
                        ? clickedSubMainPipe.distance
                        : Infinity;

                    if (clickedPlant && clickedSubMainPipe) {
                        if (plantDistance < pipeDistance) {
                            handleStartLateralPipeFromPlant(clickPoint, clickedPlant);
                            return;
                        } else {
                            handleLateralPipeClick(event);
                            return;
                        }
                    } else if (clickedPlant) {
                        handleStartLateralPipeFromPlant(clickPoint, clickedPlant);
                        return;
                    } else if (clickedSubMainPipe) {
                        handleLateralPipeClick(event);
                        return;
                    }
                } else {
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

            // จัดการ editMode สำหรับท่อ - เริ่มการลากแทนการสร้างท่อทันที
            if (editMode === 'mainPipe') {
                if (!history.present.pump) {
                    alert(t('กรุณาวางปั๊มก่อนวางท่อเมน'));
                    return;
                }

                // เริ่มการลากท่อเมนจากปั๊ม
                // ระบบจะใช้ handleDrawingComplete เมื่อเสร็จการลาก
                return;
            }

            if (editMode === 'subMainPipe') {
                // เริ่มการลากท่อเมนรอง
                // ระบบจะใช้ handleDrawingComplete เมื่อเสร็จการลาก
                // ไม่จำเป็นต้องมีท่อเมนก่อน สามารถวาดท่อเมนรองได้เลย
                return;
            }
        },
        [
            isRulerMode,
            editMode,
            handleRulerClick,
            pushToHistory,
            t,
            autoZoomToMainArea,
            plantPlacementMode,
            getNearestPointOnPlantGrid,
            history.present.irrigationZones,
            history.present.lateralPipeDrawing.isActive,
            history.present.lateralPipeDrawing.placementMode,
            history.present.lateralPipeDrawing.startPoint,
            history.present.mainArea,
            history.present.mainPipes.length,
            history.present.plants,
            history.present.pump,
            history.present.selectedPlantType,
            history.present.subMainPipes,
            history.present.useZones,
            history.present.zones,
        ]
    );

    const handleSaveDraft = useCallback(
        async (customLateralPipes?: LateralPipe[]) => {
            const existingFieldId = localStorage.getItem('currentFieldId');
            const isEditingExisting = existingFieldId && !existingFieldId.startsWith('mock-');

            const draftName = isEditingExisting
                ? localStorage.getItem('currentFieldName') ||
                `Draft - ${new Date().toLocaleString('th-TH')}`
                : `Draft - ${new Date().toLocaleString('th-TH')}`;

            // Use customLateralPipes if provided, otherwise use lateralPipesState if available, otherwise fall back to history state
            const currentLateralPipes =
                customLateralPipes ||
                (lateralPipesState.length > 0 ? lateralPipesState : history.present.lateralPipes);

            const projectData = {
                projectName: draftName,
                customerName: customerName || 'Draft Customer',
                version: '4.0.0',
                totalArea: totalArea,
                mainArea: history.present.mainArea,
                pump: history.present.pump,
                zones: history.present.zones,
                irrigationZones: history.present.irrigationZones, // Add irrigation zones
                mainPipes: history.present.mainPipes,
                subMainPipes: history.present.subMainPipes,
                lateralPipes: currentLateralPipes,
                exclusionAreas: history.present.exclusionAreas,
                plants: history.present.plants,
                useZones: history.present.useZones,
                selectedPlantType: history.present.selectedPlantType,
                branchPipeSettings: history.present.branchPipeSettings,
                lateralPipeSettings: history.present.lateralPipeSettings,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
            };

            const saveSuccess = safeLocalStorageSet(
                'horticultureIrrigationData',
                JSON.stringify(projectData)
            );

            // Also sync to the key expected by product.tsx
            if (saveSuccess) {
                syncHorticultureData(projectData);
            }
            if (!saveSuccess) {
                console.error('❌ Failed to save to horticultureIrrigationData');
                const userChoice = confirm(
                    'ไม่สามารถบันทึกข้อมูลได้เนื่องจากพื้นที่เก็บข้อมูลเต็ม\n\n' +
                    'ต้องการล้างข้อมูลเก่าออกเพื่อให้มีพื้นที่เพียงพอหรือไม่?\n\n' +
                    'คลิก "ตกลง" เพื่อล้างข้อมูลเก่า หรือ "ยกเลิก" เพื่อยกเลิกการบันทึก'
                );

                if (userChoice) {
                    // Force cleanup and try again
                    cleanupLocalStorage();
                    const retrySuccess = safeLocalStorageSet(
                        'horticultureIrrigationData',
                        JSON.stringify(projectData)
                    );

                    // Also sync to the key expected by product.tsx
                    if (retrySuccess) {
                        syncHorticultureData(projectData);
                    }

                    if (!retrySuccess) {
                        alert('ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้งหรือติดต่อผู้ดูแลระบบ');
                        return;
                    }
                } else {
                    return;
                }
            }

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
                    lateralPipes: currentLateralPipes.length,
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

            const fieldData = {
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
                plant_type_id: history.present.selectedPlantType?.id || 1,
                area_type: 'polygon',
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
                    lateralPipes: currentLateralPipes.length,
                    branchPipes: history.present.subMainPipes.reduce(
                        (total, pipe) => total + (pipe.branchPipes?.length || 0),
                        0
                    ),
                    exclusionAreas: history.present.exclusionAreas.length,
                },
                last_saved: new Date().toISOString(),
            };

            try {
                let response;

                if (isEditingExisting) {
                    let existingProjectData: any = null;
                    try {
                        const existingFieldResponse = await axios.get(
                            `/api/fields/${existingFieldId}`
                        );
                        if (
                            existingFieldResponse.data.success &&
                            existingFieldResponse.data.field
                        ) {
                            existingProjectData = existingFieldResponse.data.field.project_data;
                        }
                    } catch (error) {
                        console.warn('⚠️ Could not fetch existing field data:', error);
                    }

                    const mergedProjectData = {
                        ...(existingProjectData || {}),
                        ...projectData,
                        updatedAt: new Date().toISOString(),
                    };

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
                        plant_type_id: history.present.selectedPlantType?.id || 1,
                        area_type: 'polygon',
                    };

                    await axios.put(`/api/fields/${existingFieldId}`, basicFieldData);

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
                        project_data: mergedProjectData,
                        project_stats: {
                            totalAreaInRai: totalArea / 1600,
                            totalPlants: history.present.plants.length,
                            totalWaterNeedPerSession:
                                history.present.plants.length *
                                (history.present.selectedPlantType?.waterNeed || 50),
                            zones: history.present.zones.length,
                            mainPipes: history.present.mainPipes.length,
                            subMainPipes: history.present.subMainPipes.length,
                            lateralPipes: currentLateralPipes.length,
                            branchPipes: history.present.subMainPipes.reduce(
                                (total, pipe) => total + (pipe.branchPipes?.length || 0),
                                0
                            ),
                            exclusionAreas: history.present.exclusionAreas.length,
                        },
                        last_saved: new Date().toISOString(),
                    };

                    response = await axios.put(
                        `/api/fields/${existingFieldId}/data`,
                        jsonFieldData
                    );
                } else {
                    response = await axios.post('/api/fields', fieldData);
                }

                if (response.data.success) {
                    const fieldId = response.data.field?.id || response.data.field_id;

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
                    // ไม่ redirect ไปหน้า home ให้อยู่หน้าเดิม
                } else {
                    throw new Error('Failed to save draft');
                }
            } catch (error: any) {
                console.error('❌ Error saving draft:', error);
                console.error('Error details:', error.response?.data);
                console.error('Request data:', fieldData);
                alert(t('เกิดข้อผิดพลาดในการบันทึกร่าง กรุณาลองใหม่อีกครั้ง'));
            }
        },
        [
            history.present.mainArea,
            history.present.pump,
            history.present.zones,
            history.present.irrigationZones,
            history.present.mainPipes,
            history.present.subMainPipes,
            history.present.exclusionAreas,
            history.present.plants,
            history.present.useZones,
            history.present.selectedPlantType,
            history.present.branchPipeSettings,
            history.present.lateralPipeSettings,
            history.present.lateralPipes,
            lateralPipesState,
            customerName,
            totalArea,
            t,
        ]
    );

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
            lateralPipes: history.present.lateralPipes,
            exclusionAreas: history.present.exclusionAreas,
            plants: history.present.plants,
            useZones: history.present.useZones,
            selectedPlantType: history.present.selectedPlantType,
            availablePlants: history.present.availablePlants,
            branchPipeSettings: history.present.branchPipeSettings,
            irrigationZones: history.present.irrigationZones,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        const saveSuccess = safeLocalStorageSet(
            'horticultureIrrigationData',
            JSON.stringify(projectData)
        );

        // Also sync to the key expected by product.tsx
        if (saveSuccess) {
            syncHorticultureData(projectData);
        }
        if (!saveSuccess) {
            console.error('❌ Failed to save to horticultureIrrigationData');
            const userChoice = confirm(
                'ไม่สามารถบันทึกข้อมูลได้เนื่องจากพื้นที่เก็บข้อมูลเต็ม\n\n' +
                'ต้องการล้างข้อมูลเก่าออกเพื่อให้มีพื้นที่เพียงพอหรือไม่?\n\n' +
                'คลิก "ตกลง" เพื่อล้างข้อมูลเก่า หรือ "ยกเลิก" เพื่อยกเลิกการบันทึก'
            );

            if (userChoice) {
                // Force cleanup and try again
                cleanupLocalStorage();
                const retrySuccess = safeLocalStorageSet(
                    'horticultureIrrigationData',
                    JSON.stringify(projectData)
                );

                // Also sync to the key expected by product.tsx
                if (retrySuccess) {
                    syncHorticultureData(projectData);
                }

                if (!retrySuccess) {
                    alert('ไม่สามารถบันทึกข้อมูลได้ กรุณาลองใหม่อีกครั้งหรือติดต่อผู้ดูแลระบบ');
                    return;
                }
            } else {
                return;
            }
        }

        const params = new URLSearchParams({
            projectName,
            customerName,
            totalArea: totalArea.toString(),
        });

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

    const handleCompletePlantAreas = () => {
        const incompleteAreas = history.present.plantAreas.filter((area) => !area.isCompleted);

        if (incompleteAreas.length > 0) {
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

                completedAreas.forEach((area) => {
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
        if (history.present.plants.length > 0) {
            const plantsWithRotation = history.present.plants.filter(
                (plant) => plant.rotationAngle !== undefined && plant.rotationAngle !== null
            );

            if (plantsWithRotation.length > 0) {
                const rotationAngle = plantsWithRotation[0].rotationAngle!;
                return typeof rotationAngle === 'number' ? rotationAngle : 0;
            }
        }

        const settingsRotation = history.present.plantGenerationSettings?.rotationAngle;
        return typeof settingsRotation === 'number' ? settingsRotation : 0;
    };

    const getPlantsWithCorrectRotationAngle = (): PlantLocation[] => {
        const currentRotationAngle = getCurrentRotationAngle();

        return history.present.plants.map((plant) => ({
            ...plant,
            rotationAngle: currentRotationAngle,
        }));
    };

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

    const handleSprinklerConfigSave = (config: SprinklerFormData) => {
        setSprinklerConfig(config);
        setShowSprinklerConfigModal(false);

        const flowRate = parseFloat(config.flowRatePerMinute);
        const sprinklersPerTree = parseFloat(config.sprinklersPerTree || '1');
        const totalFlowRate = calculateTotalFlowRate(
            history.present.plants.length,
            flowRate,
            sprinklersPerTree
        );

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

    useEffect(() => {
        const savedConfig = loadSprinklerConfig();
        if (savedConfig) {
            setSprinklerConfig({
                flowRatePerMinute: savedConfig.flowRatePerMinute.toString(),
                pressureBar: savedConfig.pressureBar.toString(),
                sprinklersPerTree: (savedConfig.sprinklersPerTree || 1).toString(),
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
            const referenceArea = history.present.plantAreas[0];
            const sharedBaseline = calculateSharedBaseline(
                history.present.plantAreas,
                referenceArea.plantData
            );

            history.present.plantAreas.forEach((area) => {
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

    // Auto Lateral Pipe handlers
    const handleOpenAutoLateralPipeModal = () => {
        if (history.present.subMainPipes.length === 0) {
            alert(t('กรุณาวางท่อเมนรองก่อนสร้างท่อย่อยอัตโนมัติ'));
            return;
        }

        if (history.present.plants.length === 0) {
            alert(t('กรุณาวางต้นไม้ก่อนสร้างท่อย่อยอัตโนมัติ'));
            return;
        }

        setShowAutoLateralPipeModal(true);
    };

    const handleAutoLateralPipeGenerate = async (
        selectedZoneIds: string[],
        connectionMode: 'connect' | 'intersect'
    ) => {
        try {
            // Check if there are existing lateral pipes in selected zones
            const existingLateralPipesInZones = history.present.lateralPipes.filter((pipe) =>
                selectedZoneIds.includes(pipe.zoneId || '')
            );

            // Confirm before removing existing pipes
            if (existingLateralPipesInZones.length > 0) {
                const confirmed = window.confirm(
                    t(
                        `พบท่อย่อย ${existingLateralPipesInZones.length} เส้นในโซนที่เลือก\nต้องการลบท่อย่อยเก่าและสร้างใหม่หรือไม่?`
                    )
                );

                if (!confirmed) {
                    return; // User cancelled
                }
            }

            // Prepare zones and irrigation zones
            const zones = history.present.zones || [];
            const irrigationZones = history.present.irrigationZones || [];

            // Generate auto lateral pipes
            const result = generateAutoLateralPipes(
                zones,
                irrigationZones,
                selectedZoneIds,
                connectionMode,
                history.present.plants,
                history.present.subMainPipes
            );

            if (result.lateralPipes.length === 0) {
                if (typeof window !== 'undefined' && (window as any).showNotification) {
                    (window as any).showNotification(
                        t('ไม่สามารถสร้างท่อย่อยอัตโนมัติได้ กรุณาตรวจสอบว่ามีต้นไม้และท่อเมนรองในโซนที่เลือก'),
                        'warning'
                    );
                }
                return;
            }

            // Remove old lateral pipes in selected zones
            const remainingLateralPipes = history.present.lateralPipes.filter(
                (pipe) => !selectedZoneIds.includes(pipe.zoneId || '')
            );

            // Add new lateral pipes to history (replacing old ones in selected zones)
            pushToHistory({
                lateralPipes: [...remainingLateralPipes, ...result.lateralPipes],
            });

            // Show success notification
            const deletedCount = existingLateralPipesInZones.length;
            const notificationMessage =
                deletedCount > 0
                    ? `ลบท่อย่อยเก่า ${deletedCount} เส้น และสร้างท่อย่อยใหม่สำเร็จ: ${result.stats.totalPipes} เส้น, ${result.stats.totalLength.toFixed(1)} เมตร, ${result.stats.totalPlants} ต้นไม้`
                    : `สร้างท่อย่อยอัตโนมัติสำเร็จ: ${result.stats.totalPipes} เส้น, ${result.stats.totalLength.toFixed(1)} เมตร, ${result.stats.totalPlants} ต้นไม้`;

            if (typeof window !== 'undefined' && (window as any).showNotification) {
                (window as any).showNotification(notificationMessage, 'success');
            }

            // Log stats for debugging
            console.log('🎉 Auto Lateral Pipes Generated:', {
                deletedOldPipes: deletedCount,
                stats: result.stats,
                pipes: result.lateralPipes,
            });
        } catch (error) {
            console.error('Error generating auto lateral pipes:', error);
            if (typeof window !== 'undefined' && (window as any).showNotification) {
                (window as any).showNotification(
                    t('เกิดข้อผิดพลาดในการสร้างท่อย่อยอัตโนมัติ'),
                    'error'
                );
            }
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

    const handleTogglePlantAreaVisibility = () => {
        pushToHistory({
            layerVisibility: {
                ...history.present.layerVisibility,
                plantAreas: !history.present.layerVisibility.plantAreas,
            },
        });
    };

    const handleRegenerateIrrigationZones = () => {
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

    // เริ่มวาดโซนใหม่ด้วยมือจากโหมดแก้ไข
    const handleStartDrawNewZoneFromEdit = () => {
        // ต้องลบโซนก่อน จึงจะวาดโซนใหม่ทับ slot เดิมได้
        if (!pendingRedrawZone) {
            alert(
                t('กรุณาลบโซนที่ต้องการวาดใหม่ก่อน แล้วจึงกดวาดโซนใหม่') ||
                'กรุณาลบโซนที่ต้องการวาดใหม่ก่อน แล้วจึงกดวาดโซนใหม่'
            );
            return;
        }
        setIsDrawingManualZone(true);
        setEditMode('manualZone');
    };

    // ลบโซนที่เลือกอยู่ (รองรับทั้งโซนปกติและโซนที่วาดด้วยมือ)
    const handleDeleteSelectedZone = () => {
        if (!selectedZoneForEdit) return;

        const targetId = selectedZoneForEdit.id;
        const isManual = manualZones.some((z) => z.id === targetId);

        if (isManual) {
            const updatedManual = manualZones.filter((z) => z.id !== targetId);
            setManualZones(updatedManual);
            setSelectedZoneForEdit(null);
            setZoneControlPoints([]);
            setPendingRedrawZone({
                id: selectedZoneForEdit.id,
                name: selectedZoneForEdit.name,
                color: selectedZoneForEdit.color,
                layoutIndex: selectedZoneForEdit.layoutIndex,
            });
            // คงโหมดแก้ไขไว้ให้ผู้ใช้เลือกโซนอื่นต่อได้
            return;
        }

        // โซนจากระบบอัตโนมัติใน history
        const updatedZones = history.present.irrigationZones.filter((z) => z.id !== targetId);

        // เก็บ slot ที่ลบทิ้งสำหรับวาดใหม่ให้เหมือนเดิม
        const deletedZone = history.present.irrigationZones.find((z) => z.id === targetId);
        if (deletedZone) {
            setPendingRedrawZone({
                id: deletedZone.id,
                name: deletedZone.name,
                color: deletedZone.color,
                layoutIndex: deletedZone.layoutIndex,
            });
        }

        // อัปเดต zoneId ของพืชให้ตรงหลังลบโซน
        const updatedPlants = history.present.plants.map((plant) => {
            const stillInZone = updatedZones.find(
                (zone) =>
                    zone.coordinates.length >= 3 &&
                    isPointInPolygon(plant.position, zone.coordinates)
            );
            return { ...plant, zoneId: stillInZone ? stillInZone.id : undefined };
        });

        pushToHistory({ irrigationZones: updatedZones, plants: updatedPlants });
        setSelectedZoneForEdit(null);
        setZoneControlPoints([]);
    };

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

        zoneCoordinates.forEach((coord) => {
            controlPoints.push({ lat: coord.lat, lng: coord.lng });
        });

        return controlPoints;
    };

    const handleZoneSelect = (zone: IrrigationZone) => {
        if (!isZoneEditMode) return;

        setSelectedZoneForEdit(zone);
        const controlPoints = generateZoneControlPoints(zone.coordinates);
        setZoneControlPoints(controlPoints);
    };

    const handleManualZoneSelect = (manualZone: ManualIrrigationZone) => {
        if (!isZoneEditMode) return;

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

        if (updatedCoordinates.length < 3) {
            console.warn('⚠️ Zone has insufficient coordinates, keeping original');
            return;
        }

        const clippedCoordinates = clipPolygonToMainArea(
            updatedCoordinates,
            history.present.mainArea
        );

        let finalCoordinates: Coordinate[];

        if (clippedCoordinates.length >= 3) {
            finalCoordinates = clippedCoordinates;
        } else {
            const constrainedCoordinates = updatedCoordinates.map((coord) => {
                if (isPointInPolygon(coord, history.present.mainArea)) {
                    return coord;
                } else {
                    return findClosestPointInMainArea(coord, history.present.mainArea);
                }
            });
            finalCoordinates = constrainedCoordinates;
            console.warn('⚠️ Zone partially outside main area, using constrained coordinates');
        }

        const plantsInUpdatedZone =
            finalCoordinates.length >= 3
                ? history.present.plants.filter((plant) =>
                    isPointInPolygon(plant.position, finalCoordinates)
                )
                : [];

        const newWaterNeed = plantsInUpdatedZone.reduce(
            (sum, plant) => sum + plant.plantData.waterNeed,
            0
        );

        const isManualZone = manualZones.some((zone) => zone.id === selectedZoneForEdit.id);

        if (isManualZone) {
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

            const updatedPlants = history.present.plants.map((plant) => {
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

        if (isManualZone) {
            const updatedManualZone = manualZones.find(
                (zone) => zone.id === selectedZoneForEdit.id
            );
            if (updatedManualZone) {
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

        const newControlPoints = generateZoneControlPoints(finalCoordinates);
        setZoneControlPoints(newControlPoints);
    };

    const handleManualZoneDrawingComplete = (coordinates: Coordinate[]) => {
        const plantsInZone = history.present.plants.filter((plant) =>
            isPointInPolygon(plant.position, coordinates)
        );

        const totalWaterNeed = plantsInZone.reduce(
            (sum, plant) => sum + plant.plantData.waterNeed,
            0
        );

        // หากมีโซนที่รอวาดทับ ให้สร้างโซนใหม่ด้วย id/สี/ชื่อเดิม และใส่กลับเข้าไป
        if (pendingRedrawZone) {
            const rebuiltZone: IrrigationZone = {
                id: pendingRedrawZone.id,
                name: pendingRedrawZone.name,
                coordinates: coordinates,
                plants: plantsInZone,
                totalWaterNeed,
                color: pendingRedrawZone.color,
                layoutIndex: pendingRedrawZone.layoutIndex,
            };

            // ใส่กลับไปในรายการ โดยรักษาลำดับตาม layoutIndex
            const zonesWithout = history.present.irrigationZones.filter(
                (z) => z.id !== pendingRedrawZone.id
            );
            const merged = [...zonesWithout, rebuiltZone].sort(
                (a, b) => a.layoutIndex - b.layoutIndex
            );

            // อัปเดต zoneId ของพืช
            const updatedPlants = history.present.plants.map((plant) => {
                const belong = merged.find(
                    (zone) =>
                        zone.coordinates.length >= 3 &&
                        isPointInPolygon(plant.position, zone.coordinates)
                );
                return { ...plant, zoneId: belong ? belong.id : undefined };
            });

            pushToHistory({ irrigationZones: merged, plants: updatedPlants });
            setPendingRedrawZone(null);
            setIsDrawingManualZone(false);
            setEditMode(null);
            setSelectedZoneForEdit(null);
            setZoneControlPoints([]);
            return;
        }

        // กรณีทั่วไป (โหมดวาดโซนด้วยมือเดิม)
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

                    area: zone.area || calculateAreaFromCoordinates(zone.coordinates),
                    areaInRai:
                        zone.areaInRai || calculateAreaFromCoordinates(zone.coordinates) / 1600,
                    waterFlowRate:
                        zone.waterFlowRate ||
                        calculateWaterFlowRate(zone.plants.length, loadSprinklerConfig()),
                    bestPipeInfo: zone.bestPipeInfo || {
                        longest: Math.max(...(zone.plants.length > 0 ? [50] : [0])),
                        totalLength: zone.plants.length * 10,
                        count: Math.max(1, Math.floor(zone.plants.length / 10)),
                    },
                }));

                const updatedPlants = history.present.plants.map((plant) => {
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
            pushToHistory({ irrigationZones: [] });

            const validPlants = history.present.plants.filter((plant) => {
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

            const configWithRandomSeed = {
                ...autoZoneConfig,
                randomSeed: Date.now(),
                debugMode: true, // เปิด debug mode เพื่อดูการนับต้นไม้จริงๆ
            };

            const result = createAutomaticZones(
                validPlants,
                history.present.mainArea,
                configWithRandomSeed
            );

            setAutoZoneResult(result);

            if (result.success && result.zones.length > 0) {
                // if (validation.errors.length > 0) {
                //     console.warn('🚨 Zone validation errors:', validation.errors);
                //     // Show critical errors to user
                //     const errorMessage = `พบปัญหาสำคัญในการแบ่งโซน:\n${validation.errors.slice(0, 3).join('\n')}${validation.errors.length > 3 ? '\n...' : ''}`;
                //     if (typeof window !== 'undefined' && (window as any).showNotification) {
                //         (window as any).showNotification(errorMessage, 'error');
                //     }
                // }

                // if (validation.warnings.length > 0) {
                //     // Only show warnings if there are many of them
                //     if (validation.warnings.length > 10) {
                //         const warningMessage = `พบคำเตือนในการแบ่งโซน ${validation.warnings.length} รายการ\n\nส่วนใหญ่เป็นเรื่องต้นไม้ที่อยู่นอกขอบเขตโซนเล็กน้อย ซึ่งไม่ส่งผลต่อการทำงาน`;
                //         const userChoice = confirm(warningMessage + '\n\nต้องการดูรายละเอียดใน Console หรือไม่?');
                //         if (userChoice) {
                //             console.table(validation.warnings);
                //         }
                //     }
                // }

                const irrigationZones = result.zones.map((zone, index) => ({
                    ...zone,
                    layoutIndex: index,
                }));

                const updatedPlants = history.present.plants.map((plant) => {
                    const inExclusion = history.present.exclusionAreas.some((exclusion) =>
                        isPointInPolygon(plant.position, exclusion.coordinates)
                    );

                    if (inExclusion) {
                        return {
                            ...plant,
                            zoneId: undefined,
                        };
                    }

                    const assignedZoneId = result.debugInfo?.plantAssignments?.[plant.id];
                    if (assignedZoneId) {
                        return {
                            ...plant,
                            zoneId: assignedZoneId,
                        };
                    }
                    return plant;
                });

                // แปลง irrigationZones เป็น zones ที่มี interface ถูกต้อง
                const zones = irrigationZones.map((irrigationZone) => ({
                    id: irrigationZone.id,
                    name: irrigationZone.name,
                    coordinates: irrigationZone.coordinates,
                    plantData: history.present.selectedPlantType || DEFAULT_PLANT_TYPES()[0],
                    plantCount: irrigationZone.plants.length,
                    totalWaterNeed: irrigationZone.totalWaterNeed,
                    area: 0, // จะคำนวณใหม่ในภายหลัง
                    color: irrigationZone.color,
                }));

                pushToHistory({
                    irrigationZones,
                    zones: zones, // ใช้ zones ที่แปลงแล้ว
                    useZones: true, // เปิดใช้โซน
                    plants: updatedPlants,
                });

                const stats = result.debugInfo;
                const config = loadSprinklerConfig();
                const totalPlants = stats.totalPlants;
                const totalPlantsInSystem = history.present.plants.length;
                const plantsInExclusion = totalPlantsInSystem - totalPlants;
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
            // Store existing zone colors to preserve them (don't change colors)
            const existingZoneColors = history.present.irrigationZones.map((zone) => zone.color);

            pushToHistory({ irrigationZones: [] });

            // Generate a new random seed every time to get different zone layouts
            // Use timestamp + random number to ensure uniqueness
            // This will change the zone pattern (horizontal, vertical, diagonal, L-shape, etc.)
            // but we'll preserve the colors
            const newRandomSeed = Date.now() + Math.floor(Math.random() * 1000000);

            // Use new seed for clustering to get different patterns
            // But use original seed (or undefined) for colors to preserve color order
            const configWithNewSeed = {
                ...autoZoneConfig,
                randomSeed: newRandomSeed, // New seed for different zone patterns
            };

            const result = createAutomaticZones(
                history.present.plants,
                history.present.mainArea,
                configWithNewSeed
            );

            setAutoZoneResult(result);

            if (result.success && result.zones.length > 0) {
                // const validation = validateZones(result.zones, history.present.mainArea);

                // if (validation.errors.length > 0) {
                //     console.warn('🚨 Zone validation errors:', validation.errors);
                //     // Show critical errors to user
                //     const errorMessage = `พบปัญหาสำคัญในการแบ่งโซน:\n${validation.errors.slice(0, 3).join('\n')}${validation.errors.length > 3 ? '\n...' : ''}`;
                //     alert(errorMessage);
                // }

                // if (validation.warnings.length > 0) {
                //     console.warn('⚠️ Zone validation warnings:', validation.warnings);
                //     // Only show warnings if there are many of them
                //     if (validation.warnings.length > 10) {
                //         const warningMessage = `พบคำเตือนในการแบ่งโซน ${validation.warnings.length} รายการ\n\nส่วนใหญ่เป็นเรื่องต้นไม้ที่อยู่นอกขอบเขตโซนเล็กน้อย ซึ่งไม่ส่งผลต่อการทำงาน`;
                //         const userChoice = confirm(warningMessage + '\n\nต้องการดูรายละเอียดใน Console หรือไม่?');
                //         if (userChoice) {
                //             console.table(validation.warnings);
                //         }
                //     }
                // }

                // Preserve existing zone colors to maintain visual consistency
                // Only change the zone layout/pattern, not the colors
                const irrigationZones = result.zones.map((zone, index) => ({
                    ...zone,
                    layoutIndex: index,
                    // Preserve existing color if available, otherwise use the generated color
                    // This keeps colors the same while allowing zone patterns to change
                    color: existingZoneColors[index] || zone.color,
                }));

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

                // แปลง irrigationZones เป็น zones ที่มี interface ถูกต้อง
                const zones = irrigationZones.map((irrigationZone) => ({
                    id: irrigationZone.id,
                    name: irrigationZone.name,
                    coordinates: irrigationZone.coordinates,
                    plantData: history.present.selectedPlantType || DEFAULT_PLANT_TYPES()[0],
                    plantCount: irrigationZone.plants.length,
                    totalWaterNeed: irrigationZone.totalWaterNeed,
                    area: 0, // จะคำนวณใหม่ในภายหลัง
                    color: irrigationZone.color,
                }));

                pushToHistory({
                    irrigationZones,
                    zones: zones, // ใช้ zones ที่แปลงแล้ว
                    useZones: true, // เปิดใช้โซน
                    plants: updatedPlants,
                });

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
            selectedPlantType: DEFAULT_PLANT_TYPES()[0],
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
            lateralPipeDrawing: {
                isActive: false,
                isContinuousMode: false,
                placementMode: null,
                startPoint: null,
                snappedStartPoint: null,
                currentPoint: null,
                rawCurrentPoint: null,
                selectedPlants: [],
                totalWaterNeed: 0,
                plantCount: 0,
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
        setIsDeleteMode(false);
    };

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
            // Update lateralPipesState to ensure the deletion is visible
            setLateralPipesState(updatedLateralPipes);
        } else if (pipeType === 'branchPipe') {
            const updatedSubMainPipes = history.present.subMainPipes.map((subMain) => {
                return {
                    ...subMain,
                    branchPipes: subMain.branchPipes.filter((bp) => bp.id !== pipeId),
                };
            });
            pushToHistory({ subMainPipes: updatedSubMainPipes });
        }

        setDeletedPipeCount((prev) => prev + 1);
    };

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

    useEffect(() => {
        const timeoutId = setTimeout(() => {
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
        }, 200);

        return () => clearTimeout(timeoutId);
    }, [currentStateHash]);

    if (error) {
        return (
            <div className="min-h-screen bg-gray-900 text-white">
                <Navbar />
                <div className="flex h-screen items-center justify-center pt-20">
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
        setIsPlantMoveMode((prev) => {
            const newValue = !prev;

            if (newValue) {
                // กำลังเปิดโหมด
                setPlantMoveMode('all');
                setSelectedPlantAreaForMove(null);
                setIsPlantSelectionMode(false);
                setSelectedPlantsForMove(new Set());
                if (typeof window !== 'undefined' && (window as any).showSnapNotification) {
                    (window as any).showSnapNotification(
                        'เข้าสู่โหมดเลื่อนต้นไม้ - เลือกโหมดการเลื่อนที่ต้องการ'
                    );
                }
            } else {
                // กำลังปิดโหมด
                setSelectedPlantsForMove(new Set());
                setIsPlantSelectionMode(false);
                setPlantMoveMode('all');
                setSelectedPlantAreaForMove(null);
                if (typeof window !== 'undefined' && (window as any).showSnapNotification) {
                    (window as any).showSnapNotification('ออกจากโหมดเลื่อนต้นไม้');
                }
            }

            return newValue;
        });
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

    const findClosestSubMainPipeInSameZone = (
        clickPoint: Coordinate,
        subMainPipes: any[],
        zones: any[],
        irrigationZones: any[],
        threshold: number = 10
    ): { pipe: any; distance: number } | null => {
        if (!subMainPipes.length) return null;

        const clickedZone = findZoneAtClickPoint(clickPoint, zones, irrigationZones);

        let closestPipe: any = null;
        let minDistance = threshold;

        for (const subMainPipe of subMainPipes) {
            const pipeZone = findPipeZone(subMainPipe, zones, irrigationZones);

            const isZoneCompatible =
                !clickedZone ||
                !pipeZone ||
                clickedZone.id === pipeZone.id ||
                clickedZone.id === 'main-area' ||
                pipeZone.id === 'main-area';

            if (!isZoneCompatible) {
                continue;
            }

            const adjustedThreshold = threshold * 1.5;

            const isOnPipe = isPointOnSubMainPipe(clickPoint, subMainPipe, adjustedThreshold);

            if (isOnPipe) {
                const connectionPoint = findClosestConnectionPoint(clickPoint, subMainPipe);
                if (connectionPoint) {
                    const distance = calculateDistanceBetweenPoints(clickPoint, connectionPoint);
                    if (distance < minDistance) {
                        minDistance = distance;
                        closestPipe = subMainPipe;
                    }
                }
            }
        }

        return closestPipe ? { pipe: closestPipe, distance: minDistance } : null;
    };

    const findZoneAtClickPoint = (
        clickPoint: Coordinate,
        zones: any[],
        irrigationZones: any[]
    ): { id: string; name: string } | null => {
        if (zones && zones.length > 0) {
            for (const zone of zones) {
                if (zone.coordinates && isPointInPolygon(clickPoint, zone.coordinates)) {
                    return { id: zone.id, name: zone.name };
                }
            }
        }

        if (irrigationZones && irrigationZones.length > 0) {
            for (const zone of irrigationZones) {
                if (zone.coordinates && isPointInPolygon(clickPoint, zone.coordinates)) {
                    return { id: zone.id, name: zone.name };
                }
            }
        }

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

            if (closestPlant && minDistance <= 10) {
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

    const findPipeZone = (
        pipe: any,
        zones: any[],
        irrigationZones: any[]
    ): { id: string; name: string } | null => {
        if (!pipe.coordinates || pipe.coordinates.length === 0) return null;

        const midIndex = Math.floor(pipe.coordinates.length / 2);
        const midPoint = pipe.coordinates[midIndex];

        return findZoneAtClickPoint(midPoint, zones, irrigationZones);
    };

    const handleStartLateralPipeFromPlant = (
        clickPoint: Coordinate,
        clickedPlant: PlantLocation
    ) => {
        const placementMode = history.present.lateralPipeDrawing.placementMode;
        if (!placementMode) return;

        let startPoint: Coordinate;
        let snappedStartPoint: Coordinate;

        if (placementMode === 'over_plants') {
            startPoint = clickedPlant.position;
            snappedStartPoint = clickedPlant.position;
        } else if (placementMode === 'between_plants') {
            const nearbyPlants = history.present.plants.filter(
                (plant) =>
                    plant.id !== clickedPlant.id &&
                    calculateDistanceBetweenPoints(clickPoint, plant.position) < 25
            );

            if (nearbyPlants.length > 0) {
                // Get rotation info from plants to handle rotated plant grids
                const rotationInfo = hasRotation(history.present.plants);

                // Calculate adaptive tolerance based on plant spacing
                // Use a more generous tolerance that scales with typical plant distances
                const avgPlantDistance = nearbyPlants.length > 0
                    ? nearbyPlants.reduce((sum, p) =>
                        sum + calculateDistanceBetweenPoints(clickedPlant.position, p.position), 0
                    ) / nearbyPlants.length
                    : 5; // default 5 meters

                // Tolerance in degrees - roughly 2 meters or 10% of average spacing, whichever is larger
                const baseTolerance = Math.max(0.00002, (avgPlantDistance * 0.15) / 111320);

                // Transform function for rotation
                const transformPosition = (pos: Coordinate): Coordinate => {
                    if (rotationInfo.hasRotation) {
                        return transformToRotatedCoordinate(
                            pos,
                            rotationInfo.center,
                            rotationInfo.rotationAngle
                        );
                    }
                    return pos;
                };

                // Transform clicked plant position
                const clickedPlantTransformed = transformPosition(clickedPlant.position);

                // Find same row plants (using transformed coordinates for rotated grids)
                const sameRowPlants = nearbyPlants.filter((plant) => {
                    const plantTransformed = transformPosition(plant.position);
                    return Math.abs(plantTransformed.lat - clickedPlantTransformed.lat) < baseTolerance;
                });

                // Find same column plants (using transformed coordinates for rotated grids)
                const sameColumnPlants = nearbyPlants.filter((plant) => {
                    const plantTransformed = transformPosition(plant.position);
                    return Math.abs(plantTransformed.lng - clickedPlantTransformed.lng) < baseTolerance;
                });

                let bestCandidate: {
                    plant: PlantLocation;
                    midPoint: Coordinate;
                    distance: number;
                } | null = null;

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
                startPoint = clickPoint;
                snappedStartPoint = clickPoint;
            }
        } else {
            return;
        }

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

    const handleStartLateralPipeDrawing = () => {
        if (history.present.subMainPipes.length === 0 && history.present.plants.length === 0) {
            alert(t('กรุณาวางท่อเมนรองหรือต้นไม้ก่อนวางท่อย่อย'));
            return;
        }

        dispatchHistory({
            type: 'PUSH_STATE',
            state: {
                ...history.present,
                editMode: 'lateralPipe',
                isEditModeEnabled: true,
                lateralPipeDrawing: {
                    ...history.present.lateralPipeDrawing,
                    isActive: true,
                    placementMode: null,
                    waypoints: [],
                    currentSegmentDirection: null,
                    allSegmentPlants: [],
                    segmentPlants: [],
                    isMultiSegmentMode: false,
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
                editMode: 'lateralPipe',
                isEditModeEnabled: true,
                lateralPipeDrawing: {
                    ...history.present.lateralPipeDrawing,
                    placementMode: mode,
                    isActive: true,
                    isContinuousMode: true,
                    waypoints: [],
                    currentSegmentDirection: null,
                    allSegmentPlants: [],
                    segmentPlants: [],
                    isMultiSegmentMode: false,
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

    const handleChangePlacementMode = (mode: 'over_plants' | 'between_plants') => {
        dispatchHistory({
            type: 'PUSH_STATE',
            state: {
                ...history.present,
                lateralPipeDrawing: {
                    ...history.present.lateralPipeDrawing,
                    placementMode: mode,
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

    const handleCancelLateralPipeDrawing = () => {
        dispatchHistory({
            type: 'PUSH_STATE',
            state: {
                ...history.present,
                editMode: null,
                isEditModeEnabled: false,
                lateralPipeDrawing: {
                    ...history.present.lateralPipeDrawing,
                    isActive: false,
                    isContinuousMode: false,
                    placementMode: null,
                    startPoint: null,
                    snappedStartPoint: null,
                    currentPoint: null,
                    rawCurrentPoint: null,
                    selectedPlants: [],
                    totalWaterNeed: 0,
                    plantCount: 0,
                    waypoints: [],
                    currentSegmentDirection: null,
                    allSegmentPlants: [],
                    segmentPlants: [],
                    isMultiSegmentMode: false,
                },
            },
        });

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

        const cache = mouseMoveCacheRef.current;
        const pointDistance = cache.lastRawPoint
            ? Math.sqrt(
                Math.pow(rawCurrentPoint.lat - cache.lastRawPoint.lat, 2) +
                Math.pow(rawCurrentPoint.lng - cache.lastRawPoint.lng, 2)
            )
            : Infinity;

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
                if (
                    history.present.lateralPipeDrawing.isMultiSegmentMode &&
                    history.present.lateralPipeDrawing.waypoints.length > 0
                ) {
                    const lastWaypoint =
                        history.present.lateralPipeDrawing.waypoints[
                        history.present.lateralPipeDrawing.waypoints.length - 1
                        ];
                    const currentDirection =
                        history.present.lateralPipeDrawing.currentSegmentDirection;

                    let alignedMousePosition = effectiveCurrentPoint;
                    if (currentDirection === 'horizontal') {
                        alignedMousePosition = {
                            lat: lastWaypoint.lat,
                            lng: effectiveCurrentPoint.lng,
                        };
                    } else if (currentDirection === 'vertical') {
                        alignedMousePosition = {
                            lat: effectiveCurrentPoint.lat,
                            lng: lastWaypoint.lng,
                        };
                    }

                    const currentSegmentAligned = computeAlignedLateralFromMainPipe(
                        lastWaypoint,
                        alignedMousePosition,
                        history.present.plants,
                        history.present.lateralPipeDrawing.placementMode,
                        20,
                        history.present.lateralPipes
                    );

                    const currentSegmentPlants = currentSegmentAligned.selectedPlants || [];

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
                    const aligned = computeAlignedLateralFromMainPipe(
                        history.present.lateralPipeDrawing.snappedStartPoint,
                        effectiveCurrentPoint,
                        history.present.plants,
                        history.present.lateralPipeDrawing.placementMode,
                        20,
                        history.present.lateralPipes
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

    const updateLateralPipeState = (
        rawCurrentPoint: Coordinate,
        alignedCurrentPoint: Coordinate,
        selectedPlants: PlantLocation[]
    ) => {
        const totalWaterNeed = calculateTotalWaterNeed(selectedPlants);
        const plantCount = selectedPlants.length;

        const newHighlightedPlants = new Set(selectedPlants.map((plant) => plant.id));
        setHighlightedPlants(newHighlightedPlants);

        let updatedLateralPipeComparison = { ...history.present.lateralPipeComparison };

        let previewCoordinates: Coordinate[];
        if (
            history.present.lateralPipeDrawing.isMultiSegmentMode &&
            history.present.lateralPipeDrawing.waypoints.length > 0
        ) {
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
        const customEvent = event as any;
        if (customEvent.isRightClick && customEvent.waypointPosition) {
            handleAddLateralPipeWaypoint(customEvent.waypointPosition);
            return;
        }

        if (!history.present.lateralPipeDrawing.isActive && lateralPipeId) {
            handleCompletedLateralPipeClick(lateralPipeId);
            return;
        }

        if (
            (!history.present.lateralPipeDrawing.isActive && editMode !== 'lateralPipe') ||
            (!history.present.lateralPipeDrawing.placementMode && editMode !== 'lateralPipe') ||
            !event.latLng
        ) {
            return;
        }

        const clickPoint = {
            lat: event.latLng.lat(),
            lng: event.latLng.lng(),
        };

        const clickedSubMainPipeData = findClosestSubMainPipeInSameZone(
            clickPoint,
            history.present.subMainPipes,
            history.present.zones,
            history.present.irrigationZones,
            history.present.lateralPipeSettings.snapThreshold
        );

        if (!clickedSubMainPipeData) {
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
                        let minDistance = Infinity;

                        for (const plant of history.present.plants) {
                            const distance = calculateDistanceBetweenPoints(
                                connectionPoint,
                                plant.position
                            );
                            if (distance < minDistance) {
                                minDistance = distance;
                            }
                        }

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
                            waypoints: [],
                            currentSegmentDirection: null,
                            allSegmentPlants: [],
                            segmentPlants: [],
                            isMultiSegmentMode: false,
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

    const handleAddLateralPipeWaypoint = (waypointPosition: Coordinate) => {
        if (
            !history.present.lateralPipeDrawing.isActive ||
            !history.present.lateralPipeDrawing.startPoint ||
            !history.present.lateralPipeDrawing.placementMode
        ) {
            return;
        }

        const currentWaypoints = history.present.lateralPipeDrawing.waypoints;

        let snappedWaypointPosition = waypointPosition;
        if (history.present.lateralPipeDrawing.placementMode === 'over_plants') {
            const snapThreshold = 0.00005;
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

            if (closestPlant && closestPlant.position) {
                snappedWaypointPosition = closestPlant.position as Coordinate;
            }
        }

        const newWaypoints = [...currentWaypoints, snappedWaypointPosition];

        let newDirection: 'horizontal' | 'vertical' | 'diagonal' | null = null;

        if (currentWaypoints.length === 0) {
            const startPoint = history.present.lateralPipeDrawing.startPoint;
            const deltaLat = Math.abs(snappedWaypointPosition.lat - startPoint.lat);
            const deltaLng = Math.abs(snappedWaypointPosition.lng - startPoint.lng);

            if (deltaLat > deltaLng * 1.5) {
                newDirection = 'horizontal';
            } else if (deltaLng > deltaLat * 1.5) {
                newDirection = 'vertical';
            } else {
                newDirection = deltaLng > deltaLat ? 'vertical' : 'horizontal';
            }
        } else {
            const currentDirection = history.present.lateralPipeDrawing.currentSegmentDirection;
            if (currentDirection === 'horizontal') {
                newDirection = 'vertical';
            } else if (currentDirection === 'vertical') {
                newDirection = 'horizontal';
            } else {
                newDirection = 'horizontal';
            }
        }

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
                    selectedPlants: allSegmentPlants,
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

        let finalCoordinates: Coordinate[];
        let selectedPlants: PlantLocation[];

        if (
            history.present.lateralPipeDrawing.isMultiSegmentMode &&
            history.present.lateralPipeDrawing.waypoints.length > 0
        ) {
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

            selectedPlants = finalMultiSegmentResult.allSelectedPlants;
        } else {
            const alignedFinal = computeAlignedLateralFromMainPipe(
                snappedStartPoint,
                endPoint,
                getPlantsWithCorrectRotationAngle(),
                placementMode,
                history.present.lateralPipeSettings.snapThreshold,
                history.present.lateralPipes
            );

            finalCoordinates = [snappedStartPoint, alignedFinal.alignedEnd];
            selectedPlants = history.present.lateralPipeDrawing.selectedPlants;
        }

        if (selectedPlants.length === 0) {
            alert(t('ไม่พบต้นไม้ในเส้นทางที่เลือก'));
            return;
        }

        const snappedEnd = finalCoordinates[finalCoordinates.length - 1];

        let intersectionData = findLateralSubMainIntersection(
            snappedStartPoint,
            snappedEnd,
            history.present.subMainPipes
        );

        if (!intersectionData) {
            const closestSubMain = history.present.subMainPipes.find((sm) =>
                isPointOnSubMainPipe(
                    originalStartPoint,
                    sm,
                    history.present.lateralPipeSettings.snapThreshold
                )
            );

            if (closestSubMain) {
                const connectionPoint = findClosestConnectionPoint(
                    originalStartPoint,
                    closestSubMain
                );
                if (connectionPoint) {
                    intersectionData = {
                        intersectionPoint: connectionPoint,
                        subMainPipeId: closestSubMain.id,
                        segmentIndex: 0,
                    };
                }
            }
        }

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
            length: calculatePipeLength(finalCoordinates),
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
            connectionPoint: snappedStartPoint,
            totalWaterNeed: history.present.lateralPipeDrawing.totalWaterNeed,
            plantCount: history.present.lateralPipeDrawing.plantCount,
            zoneId: targetZoneId,
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

        const shouldContinueDrawing = history.present.lateralPipeDrawing.isContinuousMode;

        const newLateralPipes = [...history.present.lateralPipes, lateralPipe];

        dispatchHistory({
            type: 'PUSH_STATE',
            state: {
                ...history.present,
                editMode: shouldContinueDrawing ? 'lateralPipe' : null,
                isEditModeEnabled: shouldContinueDrawing,
                lateralPipes: newLateralPipes,
                firstLateralPipeWaterNeeds: updatedFirstLateralPipeWaterNeeds,
                firstLateralPipePlantCounts: updatedFirstLateralPipePlantCounts,
                lateralPipeComparison: updatedLateralPipeComparison,
                lateralPipeDrawing: {
                    ...history.present.lateralPipeDrawing,
                    isActive: shouldContinueDrawing,
                    placementMode: shouldContinueDrawing
                        ? history.present.lateralPipeDrawing.placementMode
                        : null,
                    startPoint: null,
                    snappedStartPoint: null,
                    currentPoint: null,
                    rawCurrentPoint: null,
                    selectedPlants: [],
                    totalWaterNeed: 0,
                    plantCount: 0,
                    waypoints: [],
                    currentSegmentDirection: null,
                    allSegmentPlants: [],
                    segmentPlants: [],
                    isMultiSegmentMode: false,
                },
            },
        });

        // Update lateralPipesState to ensure the new pipe is visible
        setLateralPipesState(newLateralPipes);

        if (!shouldContinueDrawing) {
            setHighlightedPlants(new Set());
        }
    };

    return (
        <div className="min-h-screen bg-gray-900 text-white">
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

                        {/* ปุ่มลบโซน/วาดโซนใหม่ */}
                        <div className="mt-3 flex gap-2">
                            <button
                                onClick={handleStartDrawNewZoneFromEdit}
                                className="flex flex-1 items-center justify-center gap-2 rounded-md bg-blue-600 px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                            >
                                📐 <span>{t('วาดโซนใหม่')}</span>
                            </button>
                            <button
                                onClick={() => {
                                    if (!selectedZoneForEdit) return;
                                    if (
                                        confirm(
                                            t('ต้องการลบโซนนี้หรือไม่?') ||
                                            'ต้องการลบโซนนี้หรือไม่?'
                                        )
                                    ) {
                                        handleDeleteSelectedZone();
                                    }
                                }}
                                disabled={!selectedZoneForEdit}
                                className={`flex flex-1 items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${selectedZoneForEdit
                                    ? 'bg-red-600 text-white hover:bg-red-700'
                                    : 'cursor-not-allowed bg-gray-300 text-gray-500'
                                    }`}
                            >
                                🗑️ <span>{t('ลบโซนนี้')}</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <header className="sticky top-0 z-50 border-b border-gray-200 bg-gray-800 shadow-sm">
                <Navbar />
                <div className="px-4 py-3 pt-20">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-6">
                            <div className="flex items-center space-x-2">
                                <FaTree className="text-xl text-green-600" />
                                <h1 className="text-xl font-bold text-white">
                                    {t('ระบบออกแบบระบบน้ำพืชสวน')}
                                </h1>
                                {isEditingExistingField && (
                                    <div className="flex items-center space-x-2">
                                        <div className="flex items-center space-x-1 rounded-lg bg-blue-600 px-2 py-1 text-xs text-white">
                                            <span>✏️</span>
                                            <span>{t('แก้ไขแปลง')}</span>
                                        </div>
                                        <div className="text-xs text-gray-300">
                                            {t('สามารถทำต่อเดิม ลบ หรือแก้ไขได้ทุกอย่าง')}
                                        </div>
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
                                className={`h-10 w-10 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${history.present.mainArea.length === 0
                                    ? 'cursor-not-allowed bg-gray-600 text-white opacity-50'
                                    : 'bg-blue-600 text-white hover:bg-blue-700'
                                    }`}
                                title={t('ซูมไปยังพื้นที่หลัก')}
                                type="button"
                                data-tour="zoom-to-main-area"
                            >
                                🎯
                            </button>

                            <button
                                onClick={() => setShow3DMap(!show3DMap)}
                                className={`h-10 w-10 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${show3DMap
                                    ? 'bg-green-600 text-white ring-2 ring-green-300 hover:bg-green-700'
                                    : 'bg-green-600 text-white hover:bg-green-700'
                                    }`}
                                title={t('แผนที่ 3D - ดูพื้นที่แบบ 3 มิติ')}
                                type="button"
                                data-tour="3d-map"
                            >
                                <FaCube className="h-4 w-4" />
                            </button>

                            <button
                                onClick={isRulerMode ? stopRulerMode : startRulerMode}
                                className={`h-10 w-10 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${isRulerMode
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
                                data-tour="distance-measurement"
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
                                onClick={() =>
                                    setShowElevationControlPanel(!showElevationControlPanel)
                                }
                                className={`h-10 w-10 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${showElevationControlPanel
                                    ? 'bg-blue-600 text-white ring-2 ring-blue-300 hover:bg-blue-700'
                                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                    }`}
                                title={t(
                                    'เครื่องมือความสูงต่ำ - แสดงความสูงต่ำด้วยสี, คลิกเพื่อดูความสูง, และโปรไฟล์ความสูง'
                                )}
                                type="button"
                                data-tour="elevation-tools"
                            >
                                <FaMountain className="h-4 w-4" />
                            </button>

                            {editMode === 'plant' && (
                                <div className="flex items-center space-x-2 rounded-lg border border-gray-600 bg-gray-800 px-2 py-1">
                                    <span className="text-xs text-gray-200">{t('โหมดวาง')}</span>
                                    <div className="inline-flex rounded-md shadow-sm" role="group">
                                        <button
                                            type="button"
                                            onClick={() => setPlantPlacementMode('free')}
                                            className={`border border-gray-600 px-2 py-1 text-xs font-medium ${plantPlacementMode === 'free'
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
                                            className={`border border-l-0 border-gray-600 px-2 py-1 text-xs font-medium ${plantPlacementMode === 'plant_grid'
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
                                className={`h-10 w-10 rounded-lg px-3 py-2 text-center text-sm font-medium transition-colors ${editMode === 'plant'
                                    ? 'bg-red-600 text-white hover:bg-red-700'
                                    : history.present.subMainPipes.length === 0 &&
                                        history.present.plants.length === 0
                                        ? 'cursor-not-allowed bg-gray-600 text-gray-400 opacity-50'
                                        : 'bg-green-600 text-white hover:bg-green-700'
                                    }`}
                                data-tour="add-plant"
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
                                                className={`border border-gray-600 px-2 py-1 text-xs font-medium ${plantMoveMode === 'all'
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
                                                className={`border border-l-0 border-gray-600 px-2 py-1 text-xs font-medium ${plantMoveMode === 'selected'
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
                                                    className={`border border-l-0 border-gray-600 px-2 py-1 text-xs font-medium ${plantMoveMode === 'area'
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
                                </div>
                            )}

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

                            {history.present.plants.length > 0 && (
                                <div className="flex items-center space-x-2">
                                    <button
                                        onClick={handleTogglePlantMoveMode}
                                        className={`h-10 w-10 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isPlantMoveMode
                                            ? 'bg-red-600 text-white ring-2 ring-red-300 hover:bg-red-700'
                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                            }`}
                                        data-tour="plant-move-mode"
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
                                className={`h-10 w-10 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${history.present.pipeConnection.isActive
                                    ? 'bg-red-600 text-white hover:bg-red-700'
                                    : 'bg-green-600 text-white hover:bg-green-700'
                                    }`}
                                data-tour="connect-lateral-pipes"
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

                            <div className="flex items-center">
                                <button
                                    onClick={handleUndo}
                                    disabled={history.past.length === 0}
                                    className={`h-10 w-10 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${history.past.length === 0
                                        ? 'cursor-not-allowed bg-gray-600 text-white opacity-50'
                                        : 'bg-blue-600 text-white hover:bg-blue-500'
                                        }`}
                                    data-tour="undo"
                                    title={t('ย้อนกลับ')}
                                >
                                    <FaUndo className="h-4 w-4" />
                                </button>

                                <button
                                    onClick={handleRedo}
                                    disabled={history.future.length === 0}
                                    className={`h-10 w-10 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${history.future.length === 0
                                        ? 'cursor-not-allowed bg-gray-600 text-white opacity-50'
                                        : 'bg-blue-600 text-white hover:bg-blue-500'
                                        }`}
                                    data-tour="redo"
                                    title={t('ไปข้างหน้า')}
                                >
                                    <FaRedo className="h-4 w-4" />
                                </button>
                            </div>

                            <button
                                onClick={() => setIsCompactMode(!isCompactMode)}
                                className={`h-10 w-10 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${isCompactMode
                                    ? 'bg-green-600 text-white hover:bg-green-500'
                                    : 'bg-blue-600 text-white hover:bg-blue-500'
                                    }`}
                                data-tour="toggle-compact-mode"
                                title={isCompactMode ? t('ขยายแผง') : t('ย่อแผง')}
                            >
                                {isCompactMode ? (
                                    <FaExpand className="h-4 w-4" />
                                ) : (
                                    <FaCompress className="h-4 w-4" />
                                )}
                            </button>

                            {/* Tour Button */}
                            <div className="relative">
                                <button
                                    onClick={handleStartTour}
                                    className="h-10 w-10 rounded-lg bg-gray-100 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-gray-300"
                                    title={t('คำแนะนำการใช้งาน')}
                                    data-tour="tour-button"
                                >
                                    <div className="flex items-center justify-center text-[20px]">❓</div>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </header>

            <div className="flex h-[calc(91vh-64px)]">
                <div
                    className={`flex flex-col border-r border-gray-200 bg-gray-800 transition-all duration-300 ${isCompactMode ? 'w-16' : 'w-80'
                        }`}
                >
                    <div className="border-b border-gray-200 bg-red-500">
                        <nav className={`${isCompactMode ? 'px-2' : 'px-4'} py-2`}>
                            <div
                                className={`grid gap-1 ${isCompactMode ? 'grid-cols-1' : 'grid-cols-3'}`}
                            >
                                {tabs.map((tab) => {
                                    const enabled = isTabEnabled(tab.id);
                                    const completed = isTabCompleted(tab.id);
                                    const isActive = activeTab === tab.id;

                                    // Determine button styles based on state
                                    let buttonClass = 'rounded-lg p-1 text-sm font-medium transition-colors ';
                                    if (!enabled) {
                                        // Disabled state - gray and not clickable
                                        buttonClass += 'bg-gray-600 text-gray-400 cursor-not-allowed opacity-50';
                                    } else if (isActive) {
                                        // Active state - blue
                                        buttonClass += 'bg-blue-600 hover:bg-blue-400 text-white shadow-md border-[6px] border-gray-900';
                                    } else if (completed) {
                                        // Completed state - green
                                        buttonClass += 'bg-green-600 text-white hover:bg-green-400';
                                    } else {
                                        // Default enabled state - white text with hover
                                        buttonClass += 'text-white bg-gray-500 hover:bg-gray-400';
                                    }

                                    return (
                                        <button
                                            key={tab.id}
                                            onClick={() => {
                                                if (enabled) {
                                                    setActiveTab(tab.id);
                                                }
                                            }}
                                            disabled={!enabled}
                                            className={buttonClass}
                                            title={isCompactMode ? tab.name : undefined}
                                            data-tour={
                                                tab.id === 'area'
                                                    ? 'main-area-tab'
                                                    : tab.id === 'plant'
                                                        ? 'plant-tab'
                                                        : tab.id === 'zone'
                                                            ? 'zone-tab'
                                                            : tab.id === 'pipe'
                                                                ? 'pipe-tab'
                                                                : tab.id === 'water'
                                                                    ? 'water-system-tab'
                                                                    : tab.id === 'summary'
                                                                        ? 'summary-tab'
                                                                        : undefined
                                            }
                                        >
                                            <div className="flex flex-col items-center">
                                                <span className="text-lg font-bold rounded-full bg-red-600 text-white px-2">{tab.number}</span>
                                                {!isCompactMode && (
                                                    <span className="mt-1 text-xs">{tab.name}</span>
                                                )}
                                            </div>
                                        </button>
                                    );
                                })}
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
                                            <h4 className="mb-3 flex items-center justify-between font-medium text-white">
                                                <span>ขั้นตอนที่ 1 : {t('พื้นที่หลัก')}</span>
                                                <button
                                                    onClick={() => {
                                                        setCurrentStepInfo(1);
                                                        setShowStepInfoModal(true);
                                                    }}
                                                    className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-sm text-white hover:bg-red-700 transition-colors"
                                                    title={t('ข้อมูลขั้นตอน')}
                                                >
                                                    ?
                                                </button>
                                            </h4>

                                            <button
                                                onClick={() =>
                                                    setEditMode(
                                                        editMode === 'mainArea' ? null : 'mainArea'
                                                    )
                                                }
                                                className={`w-full rounded-lg border px-4 py-3 font-medium transition-colors ${editMode === 'mainArea'
                                                    ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                                                    : 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                                                    }`}
                                                data-tour="draw-main-area"
                                            >
                                                {editMode === 'mainArea' ? (
                                                    <>{t('❌ หยุดวาดพื้นที่')}</>
                                                ) : (
                                                    <>✏️ {t('วาดพื้นที่หลัก')}</>
                                                )}
                                            </button>

                                            {history.present.mainArea.length > 0 && (
                                                <div className=" bg-gray-900 p-1">
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
                                                                className={`w-full rounded-lg border px-4 py-2 text-sm font-medium transition-colors ${editMode === 'plantArea'
                                                                    ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                                                                    : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
                                                                    }`}
                                                            >
                                                                {editMode === 'plantArea' ? (
                                                                    <>❌ {t('หยุดวาด')}</>
                                                                ) : (
                                                                    <>✏️ {t('วาดพื้นที่พืชเพิ่ม')}</>
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
                                                                        className={`w-full rounded-lg border px-4 py-2 text-sm font-medium ${history.present.plantAreas
                                                                            .length === 0
                                                                            ? 'cursor-not-allowed border-gray-300 bg-gray-100 text-gray-500'
                                                                            : 'border-green-300 bg-green-50 text-green-700 hover:bg-green-100'
                                                                            }`}
                                                                    >
                                                                        {history.present.plantAreas.some(
                                                                            (area) => !area.isCompleted
                                                                        )
                                                                            ? `⚠️ ${t('กรุณาเลือกพืชให้ครบ')}`
                                                                            : `✅ ${t('วาดพื้นที่เสร็จ')}`}
                                                                    </button>
                                                                )}
                                                        </div>
                                                    </div>
                                                )}

                                            {history.present.mainArea.length > 0 && (
                                                <div className="mt-4 rounded-lg border border-green-200 bg-gray-900 p-2">
                                                    <div className="space-y-2">
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
                                                                                                        handleTogglePlantAreaVisibility()
                                                                                                    }
                                                                                                    className={`rounded px-2 py-1 text-xs ${history
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

                                                        {history.present.plants.length === 0 &&
                                                            !history.present.plantSelectionMode
                                                                .isCompleted && (
                                                                <button
                                                                    onClick={handlePlantSelection}
                                                                    className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 hover:text-white"
                                                                    data-tour="start-plant-selection"
                                                                >
                                                                    {t('สร้างต้นไม้อัตโนมัติใหม่')}
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

                                                        {history.present.plantSelectionMode
                                                            .isCompleted &&
                                                            history.present.plants.length === 0 && (
                                                                <button
                                                                    onClick={handleGeneratePlants}
                                                                    className="w-full rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 hover:text-white"
                                                                    data-tour="generate-plants"
                                                                >
                                                                    🌿 {t('สร้างต้นไม้อัตโนมัติ')}
                                                                </button>
                                                            )}

                                                        {history.present.plants.length > 0 && (
                                                            <div className="space-y-2">
                                                                <button
                                                                    onClick={
                                                                        handleOpenPlantRotationControl
                                                                    }
                                                                    className="w-full rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100"
                                                                    data-tour="plant-rotation"
                                                                >
                                                                    🔄 {t('ปรับมุมเอียงต้นไม้')} (
                                                                    {getCurrentRotationAngle().toFixed(
                                                                        1
                                                                    )}
                                                                    °)
                                                                </button>
                                                            </div>
                                                        )}

                                                        {history.present.plants.length > 0 && (
                                                            <div className="space-y-2">
                                                                <button
                                                                    onClick={handlePlantSelection}
                                                                    className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 hover:text-white"
                                                                    data-tour="start-plant-selection"
                                                                >
                                                                    {t('สร้างต้นไม้ใหม่')}
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {history.present.plants.length > 0 && (
                                            <div className="rounded-lg border border-gray-200 bg-gray-900 p-4">
                                                <h4 className="mb-3 flex items-center justify-between font-medium text-white">
                                                    <span>ขั้นตอนที่ 2 : {t('พื้นที่หลีกเลี่ยง')}</span>
                                                    <button
                                                        onClick={() => {
                                                            setCurrentStepInfo(2);
                                                            setShowStepInfoModal(true);
                                                        }}
                                                        className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-sm text-white hover:bg-red-700 transition-colors"
                                                        title={t('ข้อมูลขั้นตอน')}
                                                    >
                                                        ?
                                                    </button>
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
                                                        className={`w-full rounded-lg border px-4 py-2 font-medium transition-colors ${editMode === 'exclusion'
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


                                            {history.present.plants.length > 0 && (
                                                <div className="mt-4 rounded-lg border border-purple-200 bg-gray-900 p-4">
                                                    <div>
                                                        <h5 className="font-medium text-white mb-1 flex items-center justify-between">
                                                            <span>ขั้นตอนที่ 3 : {t('แบ่งโซนให้น้ำ')}</span>
                                                            <button
                                                                onClick={() => {
                                                                    setCurrentStepInfo(3);
                                                                    setShowStepInfoModal(true);
                                                                }}
                                                                className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-sm text-white hover:bg-red-700 transition-colors"
                                                                title={t('ข้อมูลขั้นตอน')}
                                                            >
                                                                ?
                                                            </button>
                                                        </h5>
                                                        {history.present.irrigationZones.length > 0 && (
                                                            <p className="text-sm text-green-500 flex justify-end">
                                                                {t('สร้างแล้ว')}{' '}
                                                                {history.present.irrigationZones.length}{' '}
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
                                                                data-tour="auto-zone"
                                                            >
                                                                {t('แบ่งโซนอัตโนมัติ')}
                                                            </button>
                                                            <button
                                                                onClick={() =>
                                                                    setShowManualIrrigationZoneModal(
                                                                        true
                                                                    )
                                                                }
                                                                className="w-full rounded-lg border border-purple-300 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100"
                                                            >
                                                                {t('แบ่งโซนด้วยตัวเอง')}
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
                                                                                                            )}
                                                                                                            {(() => {
                                                                                                                const config =
                                                                                                                    loadSprinklerConfig();
                                                                                                                const sprinklersPerTree =
                                                                                                                    config?.sprinklersPerTree ||
                                                                                                                    1;
                                                                                                                if (
                                                                                                                    sprinklersPerTree >
                                                                                                                    1
                                                                                                                ) {
                                                                                                                    return (
                                                                                                                        <span className="ml-1 text-xs text-blue-700">
                                                                                                                            (
                                                                                                                            {(
                                                                                                                                plantSummary[
                                                                                                                                    name
                                                                                                                                ]
                                                                                                                                    .count *
                                                                                                                                sprinklersPerTree
                                                                                                                            ).toLocaleString()}{' '}
                                                                                                                            หัวฉีด)
                                                                                                                        </span>
                                                                                                                    );
                                                                                                                }
                                                                                                                return null;
                                                                                                            })()}{' '}
                                                                                                        </p>
                                                                                                        <p>
                                                                                                            {(() => {
                                                                                                                const config =
                                                                                                                    loadSprinklerConfig();
                                                                                                                return formatWaterVolumeWithFlowRate(
                                                                                                                    plantSummary[
                                                                                                                        name
                                                                                                                    ]
                                                                                                                        .totalWater *
                                                                                                                    (config?.sprinklersPerTree ||
                                                                                                                        1),
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
                                                                                    {(() => {
                                                                                        const config =
                                                                                            loadSprinklerConfig();
                                                                                        const sprinklersPerTree =
                                                                                            config?.sprinklersPerTree ||
                                                                                            1;
                                                                                        if (
                                                                                            sprinklersPerTree >
                                                                                            1
                                                                                        ) {
                                                                                            return (
                                                                                                <span className="ml-1 text-green-300">
                                                                                                    (
                                                                                                    {zone
                                                                                                        .plants
                                                                                                        .length *
                                                                                                        sprinklersPerTree}{' '}
                                                                                                    หัวฉีด)
                                                                                                </span>
                                                                                            );
                                                                                        }
                                                                                        return null;
                                                                                    })()}
                                                                                </span>
                                                                            </div>
                                                                            <div className="mt-1 flex flex-row justify-between text-xs text-gray-400">
                                                                                <span className="text-xs text-gray-400">
                                                                                    {zone.totalWaterNeed.toLocaleString()}{' '}
                                                                                    {t(
                                                                                        'ลิตร/ครั้ง'
                                                                                    )}
                                                                                </span>
                                                                                <span className="text-xs text-blue-400">
                                                                                    {(() => {
                                                                                        const sprinklerConfig =
                                                                                            loadSprinklerConfig();
                                                                                        if (
                                                                                            sprinklerConfig &&
                                                                                            typeof sprinklerConfig.flowRatePerMinute ===
                                                                                            'number'
                                                                                        ) {
                                                                                            const sprinklersPerTree =
                                                                                                sprinklerConfig.sprinklersPerTree ||
                                                                                                1;
                                                                                            const zoneFlowRate =
                                                                                                zone
                                                                                                    .plants
                                                                                                    .length *
                                                                                                sprinklerConfig.flowRatePerMinute *
                                                                                                sprinklersPerTree;
                                                                                            return (
                                                                                                <>
                                                                                                    {zoneFlowRate.toFixed(
                                                                                                        2
                                                                                                    )}{' '}
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

                                                            <div className="mt-3 space-y-2">
                                                                <button
                                                                    onClick={() => {
                                                                        setShowManualIrrigationZoneModal(
                                                                            true
                                                                        );
                                                                    }}
                                                                    className="w-full rounded-lg border border-purple-300 bg-purple-50 px-4 py-2 text-sm font-medium text-purple-700 hover:bg-purple-100"
                                                                >
                                                                    {t('แบ่งโซนด้วยตัวเอง')}
                                                                </button>
                                                                <button
                                                                    onClick={() =>
                                                                        setShowAutoZoneModal(true)
                                                                    }
                                                                    className="w-full rounded-lg border border-green-300 bg-green-50 px-4 py-2 text-sm font-medium text-green-700 hover:bg-green-100"
                                                                    data-tour="auto-zone"
                                                                >
                                                                    {t('แบ่งโซนอัตโนมัติ')}
                                                                </button>
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
                                                                        ${history.present
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
                                                                    {isZoneEditMode ? t('ออกจากการแก้ไข') : t('แก้ไขโซน')}
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
                                                                    {t('ลบโซนทั้งหมด')}
                                                                </button>
                                                            </div>
                                                        </>
                                                    )}
                                                </div>
                                            )}
                                            {actualTotalPlants > 0 && (
                                                <div className="rounded-lg border border-green-200 bg-gray-900 p-4">

                                                    <div className="space-y-1 text-sm">
                                                        <div className="flex justify-between">
                                                            <span className="text-white">
                                                                {t('จำนวนต้น')}:
                                                            </span>
                                                            <span className="font-bold text-white">
                                                                {actualTotalPlants} {t('ต้น')}
                                                                {(() => {
                                                                    const config =
                                                                        loadSprinklerConfig();
                                                                    const sprinklersPerTree =
                                                                        config?.sprinklersPerTree ||
                                                                        1;
                                                                    if (sprinklersPerTree > 1) {
                                                                        return (
                                                                            <span className="ml-2 text-sm text-white">
                                                                                (
                                                                                {(
                                                                                    actualTotalPlants *
                                                                                    sprinklersPerTree
                                                                                ).toLocaleString()}{' '}
                                                                                หัวฉีด)
                                                                            </span>
                                                                        );
                                                                    }
                                                                    return null;
                                                                })()}
                                                            </span>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span className="text-white">
                                                                {t('ต้องการน้ำ')}:
                                                            </span>
                                                            <span className="font-bold text-white">
                                                                {formatWaterVolume(
                                                                    actualTotalWaterNeed,
                                                                    t
                                                                )}
                                                            </span>
                                                        </div>

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
                                                                        sprinklerConfig.flowRatePerMinute,
                                                                        sprinklerConfig.sprinklersPerTree ||
                                                                        1
                                                                    );
                                                                return (
                                                                    <>
                                                                        <div className="mt-3 space-y-1">
                                                                            <div className="flex justify-between">
                                                                                <span className="text-white">
                                                                                    {t(
                                                                                        'อัตราการไหล'
                                                                                    )}
                                                                                    :
                                                                                </span>
                                                                                <span className="font-bold text-white">
                                                                                    {formatFlowRate(
                                                                                        totalFlowRatePerMinute
                                                                                    )}
                                                                                </span>
                                                                            </div>
                                                                            <div className="mb-2 flex justify-end border-t border-green-600 pt-2">
                                                                                <button
                                                                                    onClick={() =>
                                                                                        setShowSprinklerConfigModal(true)
                                                                                    }
                                                                                    className="rounded bg-blue-600 px-2 py-1 text-xs text-white transition-colors hover:bg-blue-500"
                                                                                    title={t('เปลี่ยนการตั้งค่าหัวฉีด')}
                                                                                    data-tour="sprinkler-config"
                                                                                >
                                                                                    <FaCog className="mr-1 inline h-3 w-3" />
                                                                                    {t('ตั้งค่าหัวฉีด')}
                                                                                </button>
                                                                            </div>
                                                                            <div className="flex justify-between">
                                                                                <span className="text-white">
                                                                                    {t('Flow หัวฉีด')}:
                                                                                </span>
                                                                                <span className="font-bold text-white">
                                                                                    {sprinklerConfig.flowRatePerMinute.toFixed(
                                                                                        1
                                                                                    )}{' '}
                                                                                    {t('ลิตร/นาที')}
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex justify-between">
                                                                                <span className="text-white">
                                                                                    {t(
                                                                                        'แรงดันหัวฉีด'
                                                                                    )}
                                                                                    :
                                                                                </span>
                                                                                <span className="font-bold text-white">
                                                                                    {formatPressure(
                                                                                        sprinklerConfig.pressureBar
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
                                        </div>
                                    </div>

                                    {/* Navigation buttons for area tab */}
                                    <div className="mt-6 space-y-2 border-t border-gray-700 pt-4">
                                        {!canGoToNextTab() && (
                                            <div className="rounded-lg border border-yellow-500 bg-yellow-900 bg-opacity-50 p-2 text-sm text-yellow-200">
                                                ⚠️ {t('กรุณาแบ่งโซนก่อนไปยังแท็บถัดไป')}
                                            </div>
                                        )}
                                        <div className="flex justify-end space-x-2">
                                            <button
                                                onClick={handleNextTab}
                                                disabled={!canGoToNextTab()}
                                                className={`rounded-lg px-6 py-2 font-medium text-white transition-colors ${canGoToNextTab()
                                                    ? 'bg-blue-600 hover:bg-blue-700'
                                                    : 'cursor-not-allowed bg-gray-500 opacity-50'
                                                    }`}
                                            >
                                                {t('ถัดไป')} →
                                            </button>
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
                                            <h4 className="mb-3 flex items-center justify-between font-medium text-white">
                                                <span>ขั้นตอนที่ 1 : {t('ปั๊มน้ำ')}</span>
                                                <button
                                                    onClick={() => {
                                                        setCurrentStepInfo(4);
                                                        setShowStepInfoModal(true);
                                                    }}
                                                    className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-sm text-white hover:bg-red-700 transition-colors"
                                                    title={t('ข้อมูลขั้นตอน')}
                                                >
                                                    ?
                                                </button>
                                            </h4>

                                            <button
                                                onClick={() =>
                                                    setEditMode(editMode === 'pump' ? null : 'pump')
                                                }
                                                className={`w-full rounded-lg border px-4 py-3 font-medium transition-colors ${editMode === 'pump'
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
                                            <div className="mb-3">
                                                <h4 className="flex items-center justify-between font-medium text-white">
                                                    <span>ขั้นตอนที่ 2 : {t('วางท่อน้ำ')}</span>
                                                    <button
                                                        onClick={() => {
                                                            setCurrentStepInfo(5);
                                                            setShowStepInfoModal(true);
                                                        }}
                                                        className="flex h-6 w-6 items-center justify-center rounded-full bg-red-600 text-sm text-white hover:bg-red-700 transition-colors"
                                                        title={t('ข้อมูลขั้นตอน')}
                                                    >
                                                        ?
                                                    </button>
                                                </h4>
                                                {/* Freehand Mode Toggle */}
                                                {(editMode === 'mainPipe' || editMode === 'subMainPipe') && (
                                                    <div className="mt-2 flex items-center justify-end space-x-2">
                                                        <span className="text-xs text-gray-400">
                                                            {t('โหมดวาดอิสระ')}
                                                        </span>
                                                        <button
                                                            onClick={() => setIsFreehandMode(!isFreehandMode)}
                                                            className={`
                                                                flex h-6 w-12 items-center rounded-full border
                                                                px-1 transition-colors duration-200
                                                                ${isFreehandMode ? 'border-green-400 bg-green-400' : 'border-gray-300 bg-gray-300'}
                                                            `}
                                                            title={
                                                                isFreehandMode
                                                                    ? t('โหมดวาดอิสระ: เปิดอยู่ - คลิกซ้ายค้างแล้วลากเพื่อวาด')
                                                                    : t('โหมดวาดอิสระ: ปิดอยู่ - คลิกเพื่อเปิดโหมดวาดอิสระ')
                                                            }
                                                            style={{ minWidth: 48 }}
                                                        >
                                                            <span
                                                                className={`
                                                                    h-5 w-5 transform rounded-full bg-white shadow duration-200
                                                                    ${isFreehandMode ? 'translate-x-[22px]' : 'translate-x-[-3px]'}
                                                                    flex items-center justify-center
                                                                `}
                                                            >
                                                                {isFreehandMode ? (
                                                                    <span className="text-[10px] text-green-500">I</span>
                                                                ) : (
                                                                    <span className="text-[10px] text-gray-400">O</span>
                                                                )}
                                                            </span>
                                                        </button>
                                                    </div>
                                                )}
                                            </div>

                                            <div className="space-y-2">
                                                <button
                                                    onClick={() => {
                                                        setEditMode(
                                                            editMode === 'mainPipe'
                                                                ? null
                                                                : 'mainPipe'
                                                        );
                                                    }}
                                                    disabled={
                                                        !history.present.pump ||
                                                        (history.present.useZones &&
                                                            history.present.zones.length === 0)
                                                    }
                                                    className={`w-full rounded-lg border px-4 py-2 font-medium transition-colors ${!history.present.pump ||
                                                        (history.present.useZones &&
                                                            history.present.zones.length === 0)
                                                        ? 'cursor-not-allowed border-gray-300 bg-gray-300 text-gray-700'
                                                        : editMode === 'mainPipe'
                                                            ? 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                                                            : 'border-red-300 bg-red-50 text-red-700 hover:bg-red-100'
                                                        }`}
                                                    data-tour="main-pipe"
                                                    title={
                                                        !history.present.pump
                                                            ? t('กรุณาวางปั๊มก่อนวางท่อเมน')
                                                            : history.present.useZones &&
                                                                history.present.zones.length === 0
                                                                ? t('กรุณาสร้างโซนก่อนวางท่อเมน')
                                                                : ''
                                                    }
                                                >
                                                    {editMode === 'mainPipe' ? (
                                                        <>❌ {t('หยุดวางท่อเมน')}</>
                                                    ) : (
                                                        <>{t('วางท่อเมน')}</>
                                                    )}
                                                </button>

                                                <button
                                                    onClick={() => {
                                                        setEditMode(
                                                            editMode === 'subMainPipe'
                                                                ? null
                                                                : 'subMainPipe'
                                                        );
                                                    }}
                                                    disabled={
                                                        !history.present.pump ||
                                                        (history.present.useZones &&
                                                            history.present.zones.length === 0) ||
                                                        (!history.present.useZones &&
                                                            history.present.mainArea.length === 0)
                                                    }
                                                    className={`w-full rounded-lg border px-4 py-2 font-medium transition-colors ${!history.present.pump ||
                                                        (history.present.useZones &&
                                                            history.present.zones.length === 0) ||
                                                        (!history.present.useZones &&
                                                            history.present.mainArea.length === 0)
                                                        ? 'cursor-not-allowed border-gray-300 bg-gray-300 text-gray-700'
                                                        : editMode === 'subMainPipe'
                                                            ? 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100'
                                                            : 'border-purple-300 bg-purple-50 text-purple-700 hover:bg-purple-100'
                                                        }`}
                                                    data-tour="submain-pipe"
                                                    title={
                                                        !history.present.pump
                                                            ? t('กรุณาวางปั๊มก่อนวางท่อเมนรอง')
                                                            : history.present.useZones &&
                                                                history.present.zones.length === 0
                                                                ? t('กรุณาสร้างโซนก่อนวางท่อเมนรอง')
                                                                : !history.present.useZones &&
                                                                    history.present.mainArea
                                                                        .length === 0
                                                                    ? t(
                                                                        'กรุณากำหนดพื้นที่หลักก่อนวางท่อเมนรอง'
                                                                    )
                                                                    : ''
                                                    }
                                                >
                                                    {editMode === 'subMainPipe' ? (
                                                        <>❌ {t('หยุดวางท่อเมนรอง')}</>
                                                    ) : (
                                                        <>{t('วางท่อเมนรอง')}</>
                                                    )}
                                                </button>

                                                <div className="space-y-2 border-t-2 border-b-2 border-gray-200 pb-2">
                                                    <div className="flex justify-center">
                                                        <span className="text-white text-sm mt-2">
                                                            {t('ท่อย่อย มี 3 วิธีให้เลือก')}
                                                        </span>
                                                    </div>

                                                    <button
                                                        onClick={handleOpenAutoLateralPipeModal}
                                                        disabled={
                                                            history.present.subMainPipes.length === 0 ||
                                                            history.present.plants.length === 0
                                                        }
                                                        className={`w-full rounded-lg border-2 px-4 py-2 font-medium transition-colors ${history.present.subMainPipes.length === 0 ||
                                                                history.present.plants.length === 0
                                                                ? 'cursor-not-allowed border-gray-300 bg-gray-300 text-gray-700'
                                                                : 'border-orange-300 bg-orange-50 text-orange-700 hover:bg-orange-100'
                                                            } h-12`}
                                                        data-tour="auto-lateral-pipe"
                                                        title={
                                                            history.present.subMainPipes.length === 0
                                                                ? t('กรุณาวางท่อเมนรองก่อนสร้างท่อย่อยอัตโนมัติ')
                                                                : history.present.plants.length === 0
                                                                    ? t('กรุณาวางต้นไม้ก่อนสร้างท่อย่อยอัตโนมัติ')
                                                                    : ''
                                                        }
                                                    >
                                                        {t('สร้างอัตโนมัติ')}
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            handleStartLateralPipeDrawing();
                                                        }}
                                                        disabled={
                                                            history.present.subMainPipes.length === 0
                                                        }
                                                        className={`w-full rounded-lg border-2 px-4 py-2 font-medium transition-colors ${history.present.subMainPipes.length === 0
                                                                ? 'cursor-not-allowed border-gray-300 bg-gray-300 text-gray-700'
                                                                : 'border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                                                            } h-12`}
                                                        data-tour="lateral-pipe"
                                                        title={
                                                            history.present.subMainPipes.length === 0
                                                                ? t('กรุณาวางท่อเมนรองก่อนวางท่อย่อย')
                                                                : ''
                                                        }
                                                    >
                                                        {t('วางเอง(เส้นตรง)')}
                                                    </button>



                                                    {/* Freehand Lateral Pipe Button */}
                                                    <button
                                                        onClick={() => {
                                                            if (isFreehandLateralPipeMode) {
                                                                setIsFreehandLateralPipeMode(false);
                                                                setEditMode(null);
                                                            } else {
                                                                setIsFreehandLateralPipeMode(true);
                                                                setEditMode('lateralPipe');
                                                            }
                                                        }}
                                                        disabled={
                                                            history.present.subMainPipes.length === 0 ||
                                                            history.present.plants.length === 0
                                                        }
                                                        className={`w-full rounded-lg border-2 px-4 py-2 font-medium transition-colors ${history.present.subMainPipes.length === 0 ||
                                                            history.present.plants.length === 0
                                                            ? 'cursor-not-allowed border-gray-300 bg-gray-300 text-gray-700'
                                                            : isFreehandLateralPipeMode
                                                                ? 'cursor-not-allowed border-red-300 bg-red-300 text-red-700'
                                                                : 'border-yellow-300 bg-yellow-50 text-yellow-700 hover:bg-yellow-100'
                                                            } h-12`}
                                                        title={
                                                            history.present.subMainPipes.length === 0
                                                                ? t('กรุณาวางท่อเมนรองก่อน')
                                                                : history.present.plants.length === 0
                                                                    ? t('กรุณาวางต้นไม้ก่อน')
                                                                    : isFreehandLateralPipeMode
                                                                        ? t(
                                                                            'คลิกเพื่อปิดโหมดวาดท่อย่อยอิสระ'
                                                                        )
                                                                        : t(
                                                                            'คลิกเพื่อเปิดโหมดวาดท่อย่อยอิสระ - คลิกซ้ายค้างแล้วลากเพื่อวาด'
                                                                        )
                                                        }
                                                    >
                                                        {isFreehandLateralPipeMode ? (
                                                            <>❌ {t('วาดเอง(เส้นโค้งอิสระ)')} </>
                                                        ) : (
                                                            <>{t('วาดเอง(เส้นโค้งอิสระ)')} </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>

                                            <div className="mt-3">
                                                <button
                                                    onClick={() => {
                                                        if (isDeleteMode) {
                                                            handleCancelDeleteMode();
                                                        } else {
                                                            setIsDeleteMode(true);
                                                            setDeletedPipeCount(0);
                                                        }
                                                    }}
                                                    disabled={
                                                        history.present.mainPipes.length === 0 &&
                                                        history.present.subMainPipes.length === 0 &&
                                                        history.present.lateralPipes.length === 0
                                                    }
                                                    className={`w-full rounded-lg border-2 px-4 py-3 text-sm font-medium transition-colors ${isDeleteMode
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

                                    {/* Navigation buttons for water tab */}
                                    <div className="mt-6 space-y-2 border-t border-gray-700 pt-4">
                                        {!canGoToNextTab() && (
                                            <div className="rounded-lg border border-yellow-500 bg-yellow-900 bg-opacity-50 p-2 text-sm text-yellow-200">
                                                ⚠️ {t('กรุณาวางท่อย่อยก่อนไปยังแท็บถัดไป')}
                                            </div>
                                        )}
                                        <div className="flex justify-between space-x-2">
                                            <button
                                                onClick={handlePreviousTab}
                                                className="rounded-lg bg-gray-600 px-6 py-2 font-medium text-white transition-colors hover:bg-gray-700"
                                            >
                                                ← {t('ย้อนกลับ')}
                                            </button>
                                            <button
                                                onClick={handleNextTab}
                                                disabled={!canGoToNextTab()}
                                                className={`rounded-lg px-6 py-2 font-medium text-white transition-colors ${canGoToNextTab()
                                                    ? 'bg-blue-600 hover:bg-blue-700'
                                                    : 'cursor-not-allowed bg-gray-500 opacity-50'
                                                    }`}
                                            >
                                                {t('ถัดไป')} →
                                            </button>
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
                                                        {(() => {
                                                            const config = loadSprinklerConfig();
                                                            const sprinklersPerTree =
                                                                config?.sprinklersPerTree || 1;
                                                            if (sprinklersPerTree > 1) {
                                                                return (
                                                                    <span className="ml-2 text-green-400">
                                                                        (
                                                                        {actualTotalPlants *
                                                                            sprinklersPerTree}{' '}
                                                                        หัวฉีด)
                                                                    </span>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
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

                                                {(() => {
                                                    const sprinklerConfig = loadSprinklerConfig();
                                                    if (sprinklerConfig && actualTotalPlants > 0) {
                                                        const sprinklersPerTree =
                                                            sprinklerConfig.sprinklersPerTree || 1;
                                                        const totalFlowRatePerMinute =
                                                            calculateTotalFlowRate(
                                                                actualTotalPlants,
                                                                sprinklerConfig.flowRatePerMinute,
                                                                sprinklersPerTree
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

                                    {/* Navigation buttons for summary tab */}
                                    <div className="mt-6 space-y-2 border-t border-gray-700 pt-4">
                                        <div className="rounded-lg border border-green-500 bg-green-900 bg-opacity-50 p-3 text-sm text-green-200">
                                            ✅ {t('เสร็จแล้ว ให้กดปุ่ม สรุปโครงการ')}
                                        </div>
                                        <div className="flex justify-start space-x-2">
                                            <button
                                                onClick={handlePreviousTab}
                                                className="rounded-lg bg-gray-600 px-6 py-2 font-medium text-white transition-colors hover:bg-gray-700"
                                            >
                                                ← {t('ย้อนกลับ')}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                    {isCompactMode ? (
                        <>
                            <button
                                onClick={() => handleSaveDraft()}
                                disabled={!canSaveDraft}
                                className={`flex items-center justify-center space-x-2 px-4 py-2 font-medium transition-colors ${canSaveDraft
                                    ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                                    : 'cursor-not-allowed bg-gray-300 text-gray-500'
                                    }`}
                                data-tour="save-draft"
                            >
                                {isCompactMode ? (
                                    <FaSave />
                                ) : (
                                    <div className="flex items-center space-x-2">
                                        <FaSave />
                                        <span>
                                            {isEditingExistingField
                                                ? t('บันทึกร่าง')
                                                : t('บันทึกร่าง')}
                                        </span>
                                    </div>
                                )}
                            </button>
                            <button
                                onClick={handleSaveProject}
                                disabled={!canSaveProject}
                                className={`flex items-center justify-center space-x-2 px-4 py-2 font-medium transition-colors ${canSaveProject
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : 'cursor-not-allowed bg-gray-300 text-gray-500'
                                    }`}
                                data-tour="save-project"
                            >
                                {isCompactMode ? (
                                    <FaSave />
                                ) : (
                                    <div className="flex items-center space-x-2">
                                        <FaSave />
                                        <span>
                                            {isEditingExistingField
                                                ? t('สรุปโครงการ')
                                                : t('สรุปโครงการ')}
                                        </span>
                                    </div>
                                )}
                            </button>
                        </>
                    ) : (
                        <div className="flex w-full space-x-1">
                            <button
                                onClick={() => handleSaveDraft()}
                                disabled={!canSaveDraft}
                                className={`flex flex-1 items-center justify-center space-x-2 px-4 py-2 font-medium transition-colors ${canSaveDraft
                                    ? 'bg-yellow-600 text-white hover:bg-yellow-700'
                                    : 'cursor-not-allowed bg-gray-300 text-gray-500'
                                    }`}
                            >
                                <div className="flex items-center space-x-2">
                                    <FaSave />
                                    <span>
                                        {isEditingExistingField ? t('บันทึกร่าง') : t('บันทึกร่าง')}
                                    </span>
                                </div>
                            </button>
                            <button
                                onClick={handleSaveProject}
                                disabled={!canSaveProject}
                                className={`flex flex-1 items-center justify-center space-x-2 px-4 py-2 font-medium transition-colors ${canSaveProject
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : 'cursor-not-allowed bg-gray-300 text-gray-500'
                                    }`}
                            >
                                {isCompactMode ? (
                                    <FaSave />
                                ) : (
                                    <div className="flex items-center space-x-2">
                                        <FaSave />
                                        <span>
                                            {isEditingExistingField
                                                ? t('สรุปโครงการ')
                                                : t('สรุปโครงการ')}
                                        </span>
                                    </div>
                                )}
                            </button>
                        </div>
                    )}
                </div>

                <div className="relative flex-1 bg-gray-900">
                    <div className="h-full w-full">
                        <HorticultureMapComponent
                            center={mapCenter}
                            zoom={mapRef.current ? mapRef.current.getZoom() || 16 : 16}
                            onMapLoad={handleMapLoad}
                            mapOptions={{
                                mapTypeId: 'hybrid', // ใช้ hybrid view เพื่อแสดงชื่อสถานที่
                                clickableIcons: true,
                                mapTypeControl: true,
                                mapTypeControlOptions: {
                                    position: 'TOP_CENTER' as any,
                                    style: 'HORIZONTAL_BAR' as any,
                                    mapTypeIds: ['roadmap', 'satellite', 'hybrid', 'terrain'],
                                },
                                // เพิ่มการตั้งค่าเพื่อแสดงชื่อสถานที่
                                styles: [
                                    {
                                        featureType: 'poi',
                                        elementType: 'labels',
                                        stylers: [{ visibility: 'on' }],
                                    },
                                    {
                                        featureType: 'administrative',
                                        elementType: 'labels',
                                        stylers: [{ visibility: 'on' }],
                                    },
                                    {
                                        featureType: 'road',
                                        elementType: 'labels',
                                        stylers: [{ visibility: 'on' }],
                                    },
                                    {
                                        featureType: 'administrative.locality',
                                        elementType: 'labels',
                                        stylers: [{ visibility: 'on' }],
                                    },
                                    {
                                        featureType: 'administrative.country',
                                        elementType: 'labels',
                                        stylers: [{ visibility: 'on' }],
                                    },
                                ],
                            }}
                        >
                            <div>
                                <EnhancedHorticultureSearchControl
                                    onPlaceSelect={handleSearch}
                                    placeholder="🔍 ค้นหาสถานที่..."
                                />
                            </div>

                            <HorticultureDrawingManager
                                map={mapRef.current || undefined}
                                editMode={
                                    history.present.lateralPipeDrawing.isActive
                                        ? 'lateralPipe'
                                        : // Disable straight-line mode for mainPipe and subMainPipe when freehand mode is active
                                        isFreehandMode &&
                                            (editMode === 'mainPipe' || editMode === 'subMainPipe')
                                            ? null
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
                                    (history.present.isEditModeEnabled ||
                                        editMode === 'manualZone') &&
                                    !(
                                        isFreehandMode &&
                                        (editMode === 'mainPipe' || editMode === 'subMainPipe')
                                    )
                                }
                                mainArea={history.present.mainArea}
                                pump={history.present.pump?.position || null}
                                mainPipes={history.present.mainPipes}
                                subMainPipes={history.present.subMainPipes}
                                // onMainPipesUpdate={(updatedMainPipes) => {
                                //     pushToHistory({ mainPipes: updatedMainPipes as any });
                                // }}
                                t={t}
                                onMainPipeClick={handleMainPipeClick}
                                onLateralPipeClick={handleLateralPipeClick}
                                onLateralPipeMouseMove={handleLateralPipeMouseMove}
                            />

                            {/* Freehand Pipe Drawing Manager */}
                            <FreehandPipeDrawingManager
                                map={mapRef.current || undefined}
                                editMode={editMode}
                                isActive={
                                    (isFreehandMode &&
                                        (editMode === 'mainPipe' || editMode === 'subMainPipe')) ||
                                    (isFreehandLateralPipeMode && editMode === 'lateralPipe')
                                }
                                onCreated={handleDrawingComplete}
                                strokeColor={
                                    editMode === 'mainPipe'
                                        ? '#FF0000'
                                        : editMode === 'subMainPipe'
                                            ? '#8B5CF6'
                                            : '#FFD700'
                                }
                                strokeWeight={
                                    editMode === 'mainPipe' ? 2 : editMode === 'subMainPipe' ? 5 : 2
                                }
                                pump={history.present.pump?.position || null}
                                mainPipes={history.present.mainPipes}
                                subMainPipes={history.present.subMainPipes}
                                plants={history.present.plants}
                                placementMode="over_plants"
                                t={t}
                            />

                            {/* Distance Measurement Overlay */}
                            <DistanceMeasurementOverlay
                                map={mapRef.current}
                                isActive={true}
                                editMode={editMode}
                            />

                            {(() => {
                                return null;
                            })()}
                            <EnhancedGoogleMapsOverlays
                                key={`overlays-${history.present.mainArea.length}-${history.present.exclusionAreas.length}-${history.present.zones.length}-${lateralPipesState.length}`}
                                map={mapRef.current}
                                data={history.present}
                                lateralPipesState={lateralPipesState}
                                currentDrawnZone={currentDrawnZone}
                                manualZones={manualZones}
                                onMapClick={handleMapClick}
                                isZoneEditMode={isZoneEditMode}
                                selectedZoneForEdit={selectedZoneForEdit}
                                zoneControlPoints={zoneControlPoints}
                                onZoneSelect={handleZoneSelect}
                                onManualZoneSelect={handleManualZoneSelect}
                                onZoneUpdate={handleUpdateZone}
                                setDraggedControlPointIndex={setDraggedControlPointIndex}
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

                        <ContinuousLateralPipePanel
                            isVisible={
                                history.present.lateralPipeDrawing.isActive &&
                                history.present.lateralPipeDrawing.isContinuousMode &&
                                !!history.present.lateralPipeDrawing.placementMode &&
                                !hasLargeModalOpen()
                            }
                            currentPlacementMode={history.present.lateralPipeDrawing.placementMode}
                            totalPipesCreated={history.present.lateralPipes.length}
                            onChangePlacementMode={handleChangePlacementMode}
                            onStopContinuousDrawing={handleCancelLateralPipeDrawing}
                            t={t}
                        />

                        <DeletePipePanel
                            isVisible={isDeleteMode}
                            onCancel={handleCancelDeleteMode}
                            deletedCount={deletedPipeCount}
                            t={t}
                        />

                        <ElevationControlPanel
                            map={mapRef.current}
                            isVisible={showElevationControlPanel}
                            onClose={() => setShowElevationControlPanel(false)}
                            t={t}
                        />

                        <Cesium3DMapPopup
                            isOpen={show3DMap}
                            onClose={() => setShow3DMap(false)}
                            center={
                                mapRef.current
                                    ? {
                                        lat: mapRef.current.getCenter()?.lat() || mapCenter[0],
                                        lng: mapRef.current.getCenter()?.lng() || mapCenter[1],
                                    }
                                    : { lat: mapCenter[0], lng: mapCenter[1] }
                            }
                            zoom={mapRef.current?.getZoom() || 15}
                            mainArea={history.present.mainArea}
                            projectData={history.present}
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
                    handleCreateCustomPlant();
                }}
                onEditPlant={(plantData: PlantData) => {
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
                    setShouldShowPlantSelectorAfterSave(true);
                    handleCreateCustomPlant();
                }}
                onEditPlant={(plantData) => {
                    setShouldShowPlantSelectorAfterSave(true);
                    handleCreateCustomPlant(plantData);
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
                selectedPlantType={history.present.selectedPlantType}
                t={t}
            />

            <AutoLateralPipeModal
                isOpen={showAutoLateralPipeModal}
                onClose={() => setShowAutoLateralPipeModal(false)}
                zones={history.present.zones || []}
                irrigationZones={history.present.irrigationZones || []}
                onGenerate={handleAutoLateralPipeGenerate}
                t={t}
            />

            <LateralPipeInfoModal
                isOpen={showLateralPipeInfoModal}
                onClose={handleLateralPipeInfoModalClose}
                lateralPipe={selectedLateralPipe}
                t={t}
            />

            <ManualIrrigationZoneModal
                isOpen={showManualIrrigationZoneModal}
                onClose={() => setShowManualIrrigationZoneModal(false)}
                numberOfZones={numberOfManualZones}
                onNumberOfZonesChange={setNumberOfManualZones}
                onStartDrawing={handleStartManualIrrigationZones}
                totalPlants={history.present.plants.length}
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

            <StepInfoModal
                isOpen={showStepInfoModal}
                onClose={() => setShowStepInfoModal(false)}
                stepNumber={currentStepInfo}
                t={t}
            />

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

            {/* Smart Onboarding Tour */}
            <SmartOnboardingTour
                isVisible={showOnboardingTour}
                onComplete={handleTourComplete}
                onSkip={handleTourSkip}
                steps={tourSteps}
                t={t}
            />
        </div>
    );
}

const EnhancedGoogleMapsOverlays: React.FC<{
    map: google.maps.Map | null;
    data: ProjectState;
    lateralPipesState: LateralPipe[];
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
    highlightedPlants?: Set<string>;
}> = ({
    map,
    data,
    lateralPipesState,
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
    highlightedPlants = new Set(),
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

        const findPipeZone = (pipe: any, zones: any[], irrigationZones: any[]): string | null => {
            // PRIORITY 1: Use explicit zoneId if available (for auto-generated pipes)
            if (pipe.zoneId) {
                return pipe.zoneId;
            }

            // PRIORITY 2: Check coordinates
            if (!pipe.coordinates || pipe.coordinates.length < 2) {
                return null;
            }

            // For pipes, use the endpoint to determine zone
            const pipeEnd = pipe.coordinates[pipe.coordinates.length - 1];

            for (const zone of irrigationZones) {
                if (isPointInPolygon(pipeEnd, zone.coordinates)) {
                    return zone.id;
                }
            }

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
                    stop: () => { },
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

            let lastRulerMoveTime = 0;
            const RULER_THROTTLE_MS = 16;

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

            let mouseMoveListener: google.maps.MapsEventListener | null = null;
            if (isRulerMode) {
                map.set('clickableIcons', false);
                map.set('gestureHandling', 'greedy');

                mouseMoveListener = map.addListener('mousemove', mouseMove);

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
                        const lat = sw.lat() + (ne.lat() - sw.lat()) * (1 - relativeY);

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

                if (!isRulerMode) {
                    map.set('clickableIcons', true);
                }
            };
        }, [map, onMapClick, editMode, isRulerMode, onRulerMouseMove, onMapDoubleClick]);

        useEffect(() => {
            if (!map || !data.lateralPipeDrawing.isActive) {
                return;
            }

            const lateralPipeMouseMove = (event: google.maps.MapMouseEvent) => {
                if (onLateralPipeMouseMove && event.latLng && !isRulerMode) {
                    onLateralPipeMouseMove(event);
                }
            };

            const lateralPipeRightClick = (event: google.maps.MapMouseEvent) => {
                if (
                    event.latLng &&
                    !isRulerMode &&
                    data.lateralPipeDrawing.isActive &&
                    data.lateralPipeDrawing.startPoint
                ) {
                    const waypointPosition = {
                        lat: event.latLng.lat(),
                        lng: event.latLng.lng(),
                    };

                    if (onLateralPipeClick) {
                        const customEvent = {
                            ...event,
                            isRightClick: true,
                            waypointPosition: waypointPosition,
                        } as any;
                        onLateralPipeClick(customEvent);
                    }
                }
            };

            let lateralMouseMoveListener: google.maps.MapsEventListener | null = null;
            let lateralRightClickListener: google.maps.MapsEventListener | null = null;
            let backupListener: google.maps.MapsEventListener | null = null;

            try {
                // Safely set map properties with error handling
                try {
                    map.set('draggable', true);
                    map.set('disableDoubleClickZoom', false);
                    map.set('clickableIcons', true);
                } catch (mapSetError) {
                    console.warn('⚠️ Failed to set map properties:', mapSetError);
                }

                // Add event listeners with error handling
                try {
                    lateralMouseMoveListener = map.addListener('mousemove', lateralPipeMouseMove);
                } catch (listenerError) {
                    console.warn('⚠️ Failed to add mousemove listener:', listenerError);
                }

                try {
                    lateralRightClickListener = map.addListener('rightclick', lateralPipeRightClick);
                } catch (listenerError) {
                    console.warn('⚠️ Failed to add rightclick listener:', listenerError);
                }

                try {
                    backupListener = google.maps.event.addListener(
                        map,
                        'mousemove',
                        lateralPipeMouseMove
                    );
                } catch (listenerError) {
                    console.warn('⚠️ Failed to add backup listener:', listenerError);
                }

                const mapDiv = map.getDiv();
                if (mapDiv) {
                    const globalMouseMove = (e: MouseEvent) => {
                        try {
                            // Check if map is still valid
                            if (!map || !map.getDiv()) {
                                return;
                            }

                            const bounds = map.getBounds();
                            if (!bounds) {
                                return;
                            }

                            const mapSize = { width: mapDiv.offsetWidth, height: mapDiv.offsetHeight };

                            if (mapSize.width > 0 && mapSize.height > 0) {
                                const rect = mapDiv.getBoundingClientRect();
                                const x = e.clientX - rect.left;
                                const y = e.clientY - rect.top;

                                const ne = bounds.getNorthEast();
                                const sw = bounds.getSouthWest();

                                if (!ne || !sw) {
                                    return;
                                }

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
                            // Silently handle Google Maps drawing library errors
                            if (error instanceof Error && error.message.includes('__gm')) {
                                // This is a known Google Maps drawing library issue, ignore it
                                return;
                            }
                            console.warn('Global fallback error:', error);
                        }
                    };

                    mapDiv.addEventListener('mousemove', globalMouseMove);

                    (mapDiv as any)._globalMouseMove = globalMouseMove;
                }
            } catch (error) {
                console.error('❌ Error setting up lateral pipe listener:', error);
            }

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
            onLateralPipeClick,
            isRulerMode,
        ]);

        // 🔧 เพิ่ม state สำหรับ trigger re-render เมื่อ zoom เปลี่ยน
        const [zoomTrigger, setZoomTrigger] = useState(0);

        // 🔧 เพิ่ม listener สำหรับ zoom_changed
        useEffect(() => {
            if (!map) return;

            const zoomListener = map.addListener('zoom_changed', () => {
                // Trigger re-render เมื่อ zoom เปลี่ยน
                setZoomTrigger((prev) => prev + 1);
            });

            return () => {
                google.maps.event.removeListener(zoomListener);
            };
        }, [map]);

        useEffect(() => {
            if (!map) return;
            clearOverlays();

            const { layerVisibility } = data;

            // Helper function to get pipe color based on zone
            const getPipeColor = (pipe: { coordinates: { lat: number; lng: number }[] }): string => {
                const zoneId = findPipeZoneImproved(
                    pipe,
                    data.zones || [],
                    data.irrigationZones || []
                );

                if (zoneId === 'main-area' || zoneId === 'unknown') {
                    // Default color for pipes outside zones
                    return '#22C55E'; // Green for main area
                }

                // ใช้ index เพื่อหาสีใหม่แทนการใช้สีเก่าที่เก็บไว้
                const zoneIndex = data.irrigationZones?.findIndex((z) => z.id === zoneId) ?? -1;
                if (zoneIndex >= 0) {
                    return getZoneColor(zoneIndex);
                }

                const zoneIndex2 = data.zones?.findIndex((z) => z.id === zoneId) ?? -1;
                if (zoneIndex2 >= 0) {
                    return getZoneColor(zoneIndex2);
                }

                // Final fallback
                return '#22C55E';
            };

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

            // Only render zones if not using irrigation zones to avoid double rendering
            if (layerVisibility.zones && !data.useZones) {
                data.zones.forEach((zone, index) => {
                    const isSelected = data.selectedItems.zones.includes(zone.id);
                    // ใช้สีใหม่ตาม index แทนสีเดิม
                    const zoneColor = getZoneColor(index);

                    const zonePolygon = new google.maps.Polygon({
                        paths: zone.coordinates.map((coord) => ({ lat: coord.lat, lng: coord.lng })),
                        fillColor: zoneColor,
                        fillOpacity: isSelected ? 0.2 : 0.08,
                        strokeColor: zoneColor,
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
                                    strokeColor: '#FF6600',
                                    strokeWeight: 1,
                                    strokeOpacity: 1.0,
                                    icons: [
                                        {
                                            icon: {
                                                path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                                                scale: 2,
                                                strokeColor: '#FF6600',
                                                fillColor: '#FF6600',
                                                fillOpacity: 1.0,
                                            },
                                            offset: '100%',
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
                manualZones.forEach((zone) => {
                    if (zone.coordinates.length > 0) {
                        const isSelectedForEdit =
                            isZoneEditMode && selectedZoneForEdit && selectedZoneForEdit.id === zone.id;
                        // ใช้สีใหม่ตาม zoneIndex แทนสีเดิม
                        const zoneColor = getZoneColor(zone.zoneIndex ?? 0);
                        const zonePolygon = new google.maps.Polygon({
                            paths: zone.coordinates.map((coord) => ({
                                lat: coord.lat,
                                lng: coord.lng,
                            })),
                            fillColor: isSelectedForEdit ? '#ff6b6b' : zoneColor,
                            fillOpacity: isSelectedForEdit ? 0.2 : 0.08,
                            strokeColor: isSelectedForEdit ? '#ff0000' : zoneColor,
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
                    if (zone && zone.coordinates && zone.coordinates.length >= 3) {
                        const isSelectedForEdit =
                            isZoneEditMode && selectedZoneForEdit && selectedZoneForEdit.id === zone.id;

                        const validCoordinates = zone.coordinates.filter(
                            (coord) =>
                                coord &&
                                typeof coord.lat === 'number' &&
                                typeof coord.lng === 'number' &&
                                !isNaN(coord.lat) &&
                                !isNaN(coord.lng)
                        );

                        if (validCoordinates.length >= 3) {
                            // ใช้สีใหม่ตาม index แทนสีเดิม
                            const zoneColor = getZoneColor(index);
                            const zonePolygon = new google.maps.Polygon({
                                paths: validCoordinates.map((coord) => ({
                                    lat: coord.lat,
                                    lng: coord.lng,
                                })),
                                fillColor: isSelectedForEdit ? '#ff6b6b' : zoneColor,
                                fillOpacity: isSelectedForEdit ? 0.2 : 0.08,
                                strokeColor: isSelectedForEdit ? '#ff0000' : zoneColor,
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

            if (isZoneEditMode && selectedZoneForEdit && zoneControlPoints.length > 0) {
                zoneControlPoints.forEach((point, index) => {
                    const controlPointMarker = new google.maps.Marker({
                        position: { lat: point.lat, lng: point.lng },
                        map: map,
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 10,
                            fillColor: '#ff0000',
                            fillOpacity: 0.9,
                            strokeColor: '#ffffff',
                            strokeWeight: 3,
                        },
                        draggable: true,
                        clickable: true,
                        optimized: false,
                        zIndex: 1000,
                        title: `จุดควบคุม ${index + 1} - ลากเพื่อปรับรูปร่างโซน`,
                        cursor: 'move',
                    });

                    controlPointMarker.addListener('mouseover', () => {
                        controlPointMarker.setIcon({
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 12,
                            fillColor: '#ff4444',
                            fillOpacity: 1,
                            strokeColor: '#ffff00',
                            strokeWeight: 3,
                        });
                    });

                    controlPointMarker.addListener('mouseout', () => {
                        controlPointMarker.setIcon({
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 10,
                            fillColor: '#ff0000',
                            fillOpacity: 0.9,
                            strokeColor: '#ffffff',
                            strokeWeight: 3,
                        });
                    });

                    controlPointMarker.addListener('dragstart', () => {
                        setDraggedControlPointIndex?.(index);
                        controlPointMarker.setIcon({
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 10,
                            fillColor: '#00ff00',
                            fillOpacity: 1,
                            strokeColor: '#ffffff',
                            strokeWeight: 3,
                        });
                    });

                    controlPointMarker.addListener('drag', () => {
                        // Drag event handler - no action needed
                    });

                    controlPointMarker.addListener('dragend', (event: google.maps.MapMouseEvent) => {
                        controlPointMarker.setIcon({
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 10,
                            fillColor: '#ff0000',
                            fillOpacity: 0.9,
                            strokeColor: '#ffffff',
                            strokeWeight: 3,
                        });

                        if (event.latLng && onZoneUpdate) {
                            const newLat = event.latLng.lat();
                            const newLng = event.latLng.lng();

                            const updatedZoneCoordinates = zoneControlPoints.map((point, i) =>
                                i === index
                                    ? { lat: newLat, lng: newLng }
                                    : { lat: point.lat, lng: point.lng }
                            );

                            onZoneUpdate(updatedZoneCoordinates);
                        }

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

                    let mainPipeStrokeWeight = 5;
                    if (isDeleteMode) {
                        mainPipeStrokeWeight = 10;
                    } else if (isSelected) {
                        mainPipeStrokeWeight = 8;
                    }

                    const pipeColor = getPipeColor(pipe);
                    const mainPipePolyline = new google.maps.Polyline({
                        path: pipe.coordinates.map((coord) => ({ lat: coord.lat, lng: coord.lng })),
                        strokeColor: isSelected ? '#FFD700' : pipeColor,
                        strokeWeight: mainPipeStrokeWeight,
                        strokeOpacity: 0.9,
                        clickable: true,
                        zIndex: isDeleteMode ? 2100 : isSelected ? 1600 : 1300,
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
                        if (event.stop) event.stop();
                        if (event.domEvent) {
                            event.domEvent.stopPropagation();
                            event.domEvent.preventDefault();
                        }

                        const domEvent = event.domEvent as MouseEvent;

                        if (
                            data.isEditModeEnabled &&
                            data.editModeSettings.selectionMode !== 'single' &&
                            domEvent?.ctrlKey
                        ) {
                            onSelectItem(pipe.id, 'pipes');
                        } else if (!data.lateralPipeDrawing.isActive) {
                            infoWindow.setPosition(event.latLng);
                            infoWindow.open(map);
                        }

                        return false;
                    });

                    mainPipePolyline.addListener('rightclick', (event: google.maps.MapMouseEvent) => {
                        if (event.stop) event.stop();
                        if (event.domEvent) {
                            event.domEvent.stopPropagation();
                            event.domEvent.preventDefault();
                        }

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

                    let previewStartPoint: Coordinate;
                    if (
                        data.lateralPipeDrawing.isMultiSegmentMode &&
                        data.lateralPipeDrawing.waypoints.length > 0
                    ) {
                        previewStartPoint =
                            data.lateralPipeDrawing.waypoints[
                            data.lateralPipeDrawing.waypoints.length - 1
                            ];
                    } else {
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

                    const mainPreviewPolyline =
                        overlaysRef.current.polylines.get('lateral-main-preview');
                    if (mainPreviewPolyline) {
                        mainPreviewPolyline.setMap(null);
                        overlaysRef.current.polylines.delete('lateral-main-preview');
                    }

                    const waypointPreviewPolyline = overlaysRef.current.polylines.get(
                        'lateral-waypoint-preview'
                    );
                    if (waypointPreviewPolyline) {
                        waypointPreviewPolyline.setMap(null);
                        overlaysRef.current.polylines.delete('lateral-waypoint-preview');
                    }

                    if (
                        data.lateralPipeDrawing.isMultiSegmentMode &&
                        data.lateralPipeDrawing.waypoints.length > 0
                    ) {
                        const completedPath: google.maps.LatLng[] = [];

                        const originalStartPoint =
                            data.lateralPipeDrawing.snappedStartPoint ||
                            data.lateralPipeDrawing.startPoint;
                        completedPath.push(
                            new google.maps.LatLng(originalStartPoint.lat, originalStartPoint.lng)
                        );

                        data.lateralPipeDrawing.waypoints.forEach((waypoint) => {
                            completedPath.push(new google.maps.LatLng(waypoint.lat, waypoint.lng));
                        });

                        const waypointPolyline = new google.maps.Polyline({
                            path: completedPath,
                            strokeColor: '#FF6B35',
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

                    if (
                        data.lateralPipeDrawing.currentPoint &&
                        data.lateralPipeDrawing.snappedStartPoint
                    ) {
                        const startPointMarker = new google.maps.Marker({
                            position: new google.maps.LatLng(
                                data.lateralPipeDrawing.snappedStartPoint.lat,
                                data.lateralPipeDrawing.snappedStartPoint.lng
                            ),
                            map: map,
                            icon: {
                                path: google.maps.SymbolPath.CIRCLE,
                                scale: 3,
                                fillColor: '#FF6B6B',
                                fillOpacity: 1.0,
                                strokeColor: '#FFFFFF',
                                strokeWeight: 2,
                            },
                            zIndex: 3600,
                            title: 'จุดเชื่อมต่อกับท่อเมนรอง - จุดเริ่มต้นท่อย่อย',
                        });
                        overlaysRef.current.markers.set(
                            `lateral-start-point-${currentTimestamp}`,
                            startPointMarker
                        );
                    }

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
                    const waypointPreviewPolyline = overlaysRef.current.polylines.get(
                        'lateral-waypoint-preview'
                    );
                    if (waypointPreviewPolyline) {
                        waypointPreviewPolyline.setMap(null);
                        overlaysRef.current.polylines.delete('lateral-waypoint-preview');
                    }
                }

                // Use lateralPipesState if available, otherwise fall back to data.lateralPipes
                const currentLateralPipes =
                    lateralPipesState.length > 0 ? lateralPipesState : data.lateralPipes;

                // รวบรวม connection points ทั้งหมดก่อนเพื่อตรวจสอบและ merge จุดที่ซ้ำกัน
                interface ConnectionPointData {
                    position: Coordinate;
                    lateralPipe: LateralPipe;
                    connectedSubMain: any;
                    lateralZone: string | null;
                    subMainZone: string | null;
                }
                const connectionPointsData: ConnectionPointData[] = [];

                currentLateralPipes.forEach((lateralPipe) => {
                    if (!data.layerVisibility.lateralPipes) return;

                    const isSelectedInConnectionMode =
                        data.pipeConnection.isActive &&
                        data.pipeConnection.selectedPoints.some(
                            (p) => p.id === lateralPipe.id && p.type === 'lateralPipe'
                        );
                    const isSelected = data.selectedItems.pipes.includes(lateralPipe.id);
                    const isHighlighted = highlightedPipes.includes(lateralPipe.id);

                    const lateralColor = getPipeColor(lateralPipe);
                    let strokeColor = lateralColor;
                    let strokeWeight = 2;
                    let strokeOpacity = 0.9;

                    if (isDeleteMode) {
                        strokeWeight = 10;
                        strokeOpacity = 1;
                    } else if (isSelectedInConnectionMode) {
                        strokeColor = '#FFD700';
                        strokeWeight = 6;
                        strokeOpacity = 1;
                    } else if (isSelected || isHighlighted) {
                        strokeColor = '#FFD700';
                        strokeWeight = 4;
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
                        zIndex: isDeleteMode ? 1900 : isSelected || isHighlighted ? 1400 : 1100,
                    });

                    lateralPolyline.setMap(map);
                    overlaysRef.current.polylines.set(lateralPipe.id, lateralPolyline);

                    // Handle connection points for both INTERSECT and CONNECT modes
                    if (data.layerVisibility.lateralPipes) {
                        // Use explicit zoneId if available (for auto-generated pipes)
                        let lateralZone: string | null = null;
                        if ((lateralPipe as any).zoneId) {
                            lateralZone = (lateralPipe as any).zoneId;
                        } else {
                            lateralZone = findPipeZone(
                                lateralPipe,
                                data.zones,
                                data.irrigationZones || manualZones
                            );
                        }

                        // Find connected sub-main pipe
                        const connectedSubMain = data.subMainPipes.find(
                            (pipe) =>
                                pipe.id === lateralPipe.intersectionData?.subMainPipeId ||
                                pipe.id === (lateralPipe as any).subMainPipeId
                        );

                        // Use explicit zoneId for sub-main pipe, or check endpoint
                        let subMainZone: string | null = null;
                        if (connectedSubMain) {
                            if ((connectedSubMain as any).zoneId) {
                                subMainZone = (connectedSubMain as any).zoneId;
                            } else {
                                // For sub-main pipe without zoneId, check ONLY the endpoint
                                const endpoint = connectedSubMain.coordinates[connectedSubMain.coordinates.length - 1];

                                if (data.irrigationZones) {
                                    for (const zone of data.irrigationZones) {
                                        if (isPointInPolygon(endpoint, zone.coordinates)) {
                                            subMainZone = zone.id;
                                            break;
                                        }
                                    }
                                }

                                if (!subMainZone && data.zones) {
                                    for (const zone of data.zones) {
                                        if (isPointInPolygon(endpoint, zone.coordinates)) {
                                            subMainZone = zone.id;
                                            break;
                                        }
                                    }
                                }
                            }
                        }

                        // Only show connection points if pipes are in the same zone
                        if (lateralZone && subMainZone && lateralZone === subMainZone && connectedSubMain) {
                            let connectionPoint: { lat: number; lng: number } | null = null;

                            // INTERSECT MODE: Use intersectionData.point
                            if (lateralPipe.intersectionData) {
                                const intersectionPoint = lateralPipe.intersectionData.point;

                                // Verify that the intersection point is actually on the subMainPipe
                                let isPointOnSubMain = false;
                                for (let i = 0; i < connectedSubMain.coordinates.length - 1; i++) {
                                    const segmentStart = connectedSubMain.coordinates[i];
                                    const segmentEnd = connectedSubMain.coordinates[i + 1];

                                    const distanceToSegment = distanceFromPointToLineSegment(
                                        intersectionPoint,
                                        segmentStart,
                                        segmentEnd
                                    );

                                    // Check if point is within 5 meters of the segment
                                    if (distanceToSegment < 5 / 111320) {
                                        isPointOnSubMain = true;
                                        break;
                                    }
                                }

                                if (isPointOnSubMain) {
                                    connectionPoint = intersectionPoint;
                                }
                            }
                            // CONNECT MODE: Use connectionPoint (first coordinate)
                            else if ((lateralPipe as any).connectionPoint) {
                                connectionPoint = (lateralPipe as any).connectionPoint;
                            }
                            // Fallback: Use first coordinate if it's on the sub-main pipe
                            else if (lateralPipe.coordinates && lateralPipe.coordinates.length > 0) {
                                const firstPoint = lateralPipe.coordinates[0];

                                // Check if first point is on sub-main pipe
                                let isOnSubMain = false;
                                for (let i = 0; i < connectedSubMain.coordinates.length - 1; i++) {
                                    const segmentStart = connectedSubMain.coordinates[i];
                                    const segmentEnd = connectedSubMain.coordinates[i + 1];

                                    const distanceToSegment = distanceFromPointToLineSegment(
                                        firstPoint,
                                        segmentStart,
                                        segmentEnd
                                    );

                                    if (distanceToSegment < 5 / 111320) {
                                        isOnSubMain = true;
                                        break;
                                    }
                                }

                                if (isOnSubMain) {
                                    connectionPoint = firstPoint;
                                }
                            }

                            // Add connection point to display
                            if (connectionPoint) {
                                connectionPointsData.push({
                                    position: connectionPoint,
                                    lateralPipe,
                                    connectedSubMain,
                                    lateralZone,
                                    subMainZone,
                                });
                            }
                        }
                    }

                    lateralPolyline.addListener('click', (event: google.maps.MapMouseEvent) => {
                        if (event.stop) event.stop();
                        if (event.domEvent) {
                            event.domEvent.stopPropagation();
                            event.domEvent.preventDefault();
                        }
                        if (data.pipeConnection.isActive && event.latLng) {
                            onPipeClickInConnectionMode(lateralPipe.id, 'lateralPipe', {
                                lat: event.latLng.lat(),
                                lng: event.latLng.lng(),
                            });
                        } else if (onLateralPipeClick) {
                            onLateralPipeClick(event, lateralPipe.id);
                        }

                        return false;
                    });

                    lateralPolyline.addListener('rightclick', (event: google.maps.MapMouseEvent) => {
                        if (event.stop) event.stop();
                        if (event.domEvent) {
                            event.domEvent.stopPropagation();
                            event.domEvent.preventDefault();
                        }

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
                                strokeColor: lateralColor,
                                strokeWeight: 2,
                                strokeOpacity: 0.8,
                                clickable: false,
                            });

                            emitterPolyline.setMap(map);
                            overlaysRef.current.polylines.set(emitterLine.id, emitterPolyline);
                        });
                    } else if (
                        data.layerVisibility.emitterLines &&
                        lateralPipe.placementMode === 'between_plants'
                    ) {
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
                                4
                            );

                            generatedEmitterLines.forEach((emitterLine) => {
                                const emitterPolyline = new google.maps.Polyline({
                                    path: emitterLine.coordinates.map((coord) => ({
                                        lat: coord.lat,
                                        lng: coord.lng,
                                    })),
                                    strokeColor: lateralColor,
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

                // ระบบรวมสำหรับตรวจสอบและ merge connection points ทั้งหมด
                // ฟังก์ชันคำนวณระยะห่างระหว่างสองจุด (เมตร)
                const calculateDistanceMeters = (point1: Coordinate, point2: Coordinate): number => {
                    const R = 6371000; // Earth's radius in meters
                    const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
                    const dLng = ((point2.lng - point1.lng) * Math.PI) / 180;
                    const lat1Rad = (point1.lat * Math.PI) / 180;
                    const lat2Rad = (point2.lat * Math.PI) / 180;

                    const a =
                        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                        Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
                    const c = 2 * Math.atan2(Math.sqrt(Math.max(0, a)), Math.sqrt(Math.max(0, 1 - a)));

                    return R * c;
                };

                // ฟังก์ชันตรวจสอบว่าจุดอยู่ใกล้กันหรือไม่ (ภายใน 3 เมตร)
                const arePointsClose = (
                    point1: Coordinate,
                    point2: Coordinate,
                    thresholdMeters: number = 3
                ): boolean => {
                    return calculateDistanceMeters(point1, point2) <= thresholdMeters;
                };

                // Interface สำหรับ connection point ที่จะ merge
                interface UnifiedConnectionPoint {
                    position: Coordinate;
                    types: string[];
                    data: any[];
                    zIndex: number;
                    color: string;
                    title: string;
                }

                // Map สำหรับเก็บ connection points ที่ merge แล้ว (key = position string)
                const mergedConnectionPointsMap = new Map<string, UnifiedConnectionPoint>();

                // กำหนด priority ของ connection types (ตัวเลขน้อยกว่า = สำคัญกว่า)
                const getConnectionPriority = (type: string): number => {
                    switch (type) {
                        case 'end-to-end': // ปลาย-ปลาย
                            return 1;
                        case 'main-to-submain': // ปลายท่อเมน → ระหว่างท่อเมนรอง
                            return 2;
                        case 'main-to-submain-mid': // ปลายท่อเมน → กลางท่อเมนรอง
                            return 3;
                        case 'submain-to-main-intersection': // จุดตัดท่อเมนรอง ↔ ท่อเมน
                            return 4;
                        case 'lateral-to-submain-intersection': // จุดตัดท่อย่อย ↔ ท่อเมนรอง
                            return 5;
                        case 'submain-to-lateral': // ท่อเมนรอง → ท่อย่อย
                            return 6;
                        case 'lateral-intersection': // จุดเชื่อมต่อท่อย่อย
                            return 7;
                        default:
                            return 99;
                    }
                };

                // ฟังก์ชันเพิ่ม connection point เข้าไปใน map (พร้อม merge ถ้าจำเป็น)
                // ให้ความสำคัญกับจุดที่ปลายท่อ main ก่อน
                const addConnectionPoint = (
                    position: Coordinate,
                    type: string,
                    data: any,
                    zIndex: number,
                    color: string,
                    title: string
                ) => {
                    const priority = getConnectionPriority(type);

                    // หาจุดที่ merge ได้ (อยู่ใกล้กันภายใน 3 เมตร)
                    let merged = false;
                    let bestMatch: { key: string; point: UnifiedConnectionPoint } | null = null;
                    let bestMatchPriority = 999;

                    for (const [key, mergedPoint] of mergedConnectionPointsMap.entries()) {
                        if (arePointsClose(mergedPoint.position, position, 3)) {
                            // หา priority ที่ดีที่สุด
                            const existingPriority = Math.min(
                                ...mergedPoint.types.map(getConnectionPriority)
                            );
                            if (existingPriority < bestMatchPriority) {
                                bestMatchPriority = existingPriority;
                                bestMatch = { key, point: mergedPoint };
                            }
                        }
                    }

                    if (bestMatch) {
                        const mergedPoint = bestMatch.point;
                        const existingPriority = Math.min(
                            ...mergedPoint.types.map(getConnectionPriority)
                        );

                        // ถ้า priority ของจุดใหม่ดีกว่า (น้อยกว่า) ให้แทนที่
                        if (priority < existingPriority) {
                            // แทนที่ด้วยจุดใหม่ที่มี priority สูงกว่า
                            mergedPoint.types = [type];
                            mergedPoint.data = [data];
                            mergedPoint.zIndex = zIndex;
                            mergedPoint.color = color;
                            mergedPoint.title = title;
                            mergedPoint.position = position; // ใช้ตำแหน่งของจุดใหม่
                        } else if (priority === existingPriority) {
                            // ถ้า priority เท่ากัน ให้ merge
                            if (!mergedPoint.types.includes(type)) {
                                mergedPoint.types.push(type);
                            }
                            if (!mergedPoint.data.find((d) => d.id === data.id)) {
                                mergedPoint.data.push(data);
                            }
                            mergedPoint.zIndex = Math.max(mergedPoint.zIndex, zIndex);
                            if (mergedPoint.data.length > 1) {
                                mergedPoint.title = `จุดเชื่อมต่อ (${mergedPoint.data.length} จุด)`;
                            }
                        }
                        // ถ้า priority ของจุดใหม่ต่ำกว่า ให้ข้าม (ไม่ merge)
                        merged = true;
                    }

                    // ถ้าไม่สามารถ merge ได้ ให้สร้างจุดใหม่
                    if (!merged) {
                        const positionKey = `${position.lat.toFixed(6)}_${position.lng.toFixed(6)}`;
                        mergedConnectionPointsMap.set(positionKey, {
                            position,
                            types: [type],
                            data: [data],
                            zIndex,
                            color,
                            title,
                        });
                    }
                };

                // เพิ่ม lateral pipe connection points
                if (connectionPointsData.length > 0 && data.layerVisibility.lateralPipes) {
                    connectionPointsData.forEach((pointData) => {
                        addConnectionPoint(
                            pointData.position,
                            'lateral-intersection',
                            {
                                id: pointData.lateralPipe.id,
                                lateralPipe: pointData.lateralPipe,
                                connectedSubMain: pointData.connectedSubMain,
                            },
                            2000,
                            '#F59E0B',
                            `จุดเชื่อมต่อท่อย่อย: ${pointData.lateralPipe.id}`
                        );
                    });
                }

                if (data.layerVisibility.pipes) {
                    // เก็บ connection pairs ที่มีอยู่แล้ว (mainPipeId-subMainPipeId)
                    // เพื่อป้องกันการสร้างจุดสีอื่นๆ ในเส้นเดียวกัน
                    const existingMainSubMainPairs = new Set<string>(); // "mainPipeId-subMainPipeId"

                    // 1. สร้างจุดสีแดง (end-to-end) ก่อน - ให้ความสำคัญสูงสุด
                    const endToEndConnections = findEndToEndConnections(
                        data.mainPipes,
                        data.subMainPipes,
                        data.zones,
                        data.irrigationZones || manualZones
                    );

                    endToEndConnections.forEach((connection) => {
                        const pairKey = `${connection.mainPipeId}-${connection.subMainPipeId}`;
                        existingMainSubMainPairs.add(pairKey);

                        addConnectionPoint(
                            connection.connectionPoint,
                            'end-to-end',
                            {
                                id: `end-to-end-${connection.mainPipeId}-${connection.subMainPipeId}`,
                                mainPipeId: connection.mainPipeId,
                                subMainPipeId: connection.subMainPipeId,
                                type: 'end-to-end',
                            },
                            2001,
                            '#DC2626',
                            `จุดเชื่อมต่อปลาย-ปลาย (ท่อเมน ↔ ท่อเมนรอง)`
                        );
                    });

                    // 2. สร้างจุดสีน้ำเงิน (main-to-submain) เฉพาะเมื่อไม่มีจุดสีแดงอยู่แล้ว
                    const mainToSubMainConnections = findMainToSubMainConnections(
                        data.mainPipes,
                        data.subMainPipes,
                        data.zones,
                        data.irrigationZones || manualZones
                    );

                    mainToSubMainConnections.forEach((connection) => {
                        const pairKey = `${connection.mainPipeId}-${connection.subMainPipeId}`;

                        // ข้ามถ้ามีจุดสีแดงอยู่แล้วในเส้นเดียวกัน
                        if (existingMainSubMainPairs.has(pairKey)) {
                            return; // ห้ามสร้างจุดสีอื่นๆ ในเส้นเดียวกัน
                        }

                        existingMainSubMainPairs.add(pairKey);

                        addConnectionPoint(
                            connection.connectionPoint,
                            'main-to-submain',
                            {
                                id: `main-submain-${connection.mainPipeId}-${connection.subMainPipeId}`,
                                mainPipeId: connection.mainPipeId,
                                subMainPipeId: connection.subMainPipeId,
                                type: 'main-to-submain',
                            },
                            2001,
                            '#3B82F6',
                            `จุดเชื่อมต่อปลายท่อเมน → ระหว่างท่อเมนรอง`
                        );
                    });

                    // 5. จุดเชื่อมท่อเมนรอง → กลางท่อเมน (submain-to-main-mid)
                    // เฉพาะเมื่อไม่มีจุดสีแดงหรือสีน้ำเงินอยู่แล้ว
                    const subMainToMainMidConnections = findMidConnections(
                        data.subMainPipes,
                        data.mainPipes,
                        20,
                        data.zones,
                        data.irrigationZones || manualZones
                    );

                    subMainToMainMidConnections.forEach((connection) => {
                        // ตรวจสอบในทิศทาง main-to-submain (sourcePipeId = submain, targetPipeId = main)
                        const pairKey = `${connection.targetPipeId}-${connection.sourcePipeId}`;

                        // ข้ามถ้ามีจุดสีแดงหรือสีน้ำเงินอยู่แล้วในเส้นเดียวกัน
                        if (existingMainSubMainPairs.has(pairKey)) {
                            return; // ห้ามสร้างจุดสีอื่นๆ ในเส้นเดียวกัน
                        }

                        addConnectionPoint(
                            connection.connectionPoint,
                            'submain-to-main-mid',
                            {
                                id: `submain-mainmid-${connection.sourcePipeId}-${connection.targetPipeId}`,
                                sourcePipeId: connection.sourcePipeId,
                                targetPipeId: connection.targetPipeId,
                                mainPipeId: connection.targetPipeId,
                                subMainPipeId: connection.sourcePipeId,
                                type: 'submain-to-main-mid',
                            },
                            2004,
                            '#8B5CF6',
                            `จุดเชื่อมท่อเมนรอง → กลางท่อเมน`
                        );
                    });

                    const subMainToLateralConnections = findSubMainToLateralStartConnections(
                        data.subMainPipes,
                        currentLateralPipes,
                        data.zones,
                        data.irrigationZones || manualZones,
                        10
                    );

                    subMainToLateralConnections.forEach((connection) => {
                        addConnectionPoint(
                            connection.connectionPoint,
                            'submain-to-lateral',
                            {
                                id: `submain-lateral-${connection.subMainPipeId}-${connection.lateralPipeId}`,
                                subMainPipeId: connection.subMainPipeId,
                                lateralPipeId: connection.lateralPipeId,
                                type: 'submain-to-lateral',
                            },
                            2002,
                            '#F59E0B',
                            `จุดเชื่อมต่อท่อเมนรอง → ท่อย่อย`
                        );
                    });

                    // 3. หาจุดเชื่อมต่อท่อเมน-ระหว่างกลางท่อเมนรอง (main-to-submain-mid) ก่อน
                    // ปลายท่อเมนเชื่อมกับจุดกลางของ segment ท่อเมนรอง
                    // เฉพาะเมื่อไม่มีจุดสีแดง (end-to-end) อยู่แล้ว
                    // แต่ถ้ามีจุดสีน้ำเงิน (main-to-submain) อยู่แล้ว ให้ข้าม
                    // ต้องเรียกก่อน findSubMainToMainIntersections เพื่อให้ existingMainSubMainPairs มีข้อมูลครบ
                    const mainToSubMainMidConnections = findMainToSubMainMidConnections(
                        data.mainPipes,
                        data.subMainPipes,
                        20,
                        data.zones,
                        data.irrigationZones || manualZones
                    );

                    mainToSubMainMidConnections.forEach((connection) => {
                        const pairKey = `${connection.mainPipeId}-${connection.subMainPipeId}`;

                        // ข้ามถ้ามีจุดสีแดง (end-to-end) หรือจุดสีน้ำเงิน (main-to-submain) อยู่แล้วในเส้นเดียวกัน
                        if (existingMainSubMainPairs.has(pairKey)) {
                            return; // ห้ามสร้างจุดสีอื่นๆ ในเส้นเดียวกัน
                        }

                        // เพิ่มเข้า existingMainSubMainPairs เพื่อป้องกันการสร้างจุดอื่นๆ ในเส้นเดียวกัน
                        existingMainSubMainPairs.add(pairKey);

                        addConnectionPoint(
                            connection.connectionPoint,
                            'main-to-submain-mid',
                            {
                                id: `main-submainmid-${connection.mainPipeId}-${connection.subMainPipeId}`,
                                mainPipeId: connection.mainPipeId,
                                subMainPipeId: connection.subMainPipeId,
                                type: 'main-to-submain-mid',
                            },
                            2001,
                            '#3B82F6',
                            `จุดเชื่อมต่อท่อเมน → กลางท่อเมนรอง`
                        );
                    });

                    // 4. จุดตัดท่อเมนรอง ↔ ท่อเมน (submain-to-main-intersection)
                    // เฉพาะเมื่อไม่มีจุดสีแดงหรือสีน้ำเงินอยู่แล้ว
                    // ต้องเรียกหลังจาก findMainToSubMainMidConnections เพื่อให้ existingMainSubMainPairs มีข้อมูลครบ
                    const subMainToMainIntersections = findSubMainToMainIntersections(
                        data.subMainPipes,
                        data.mainPipes,
                        data.zones,
                        data.irrigationZones || manualZones
                    );

                    subMainToMainIntersections.forEach((intersection) => {
                        const pairKey = `${intersection.mainPipeId}-${intersection.subMainPipeId}`;

                        // ข้ามถ้ามีจุดสีแดงหรือสีน้ำเงินอยู่แล้วในเส้นเดียวกัน
                        if (existingMainSubMainPairs.has(pairKey)) {
                            return; // ห้ามสร้างจุดสีอื่นๆ ในเส้นเดียวกัน
                        }

                        // ไม่ต้องเพิ่มเข้า existingMainSubMainPairs เพราะเป็น intersection ไม่ใช่ connection
                        addConnectionPoint(
                            intersection.intersectionPoint,
                            'submain-to-main-intersection',
                            {
                                id: `submain-main-intersection-${intersection.subMainPipeId}-${intersection.mainPipeId}`,
                                subMainPipeId: intersection.subMainPipeId,
                                mainPipeId: intersection.mainPipeId,
                                type: 'submain-to-main-intersection',
                            },
                            2003,
                            '#3B82F6',
                            `จุดตัดท่อเมนรอง ↔ ท่อเมน`
                        );
                    });

                    const lateralToSubMainIntersections = findLateralToSubMainIntersections(
                        currentLateralPipes,
                        data.subMainPipes,
                        data.zones,
                        data.irrigationZones || manualZones
                    );

                    lateralToSubMainIntersections.forEach((intersection) => {
                        addConnectionPoint(
                            intersection.intersectionPoint,
                            'lateral-to-submain-intersection',
                            {
                                id: `lateral-submain-intersection-${intersection.lateralPipeId}-${intersection.subMainPipeId}`,
                                lateralPipeId: intersection.lateralPipeId,
                                subMainPipeId: intersection.subMainPipeId,
                                type: 'lateral-to-submain-intersection',
                            },
                            2005,
                            '#10B981',
                            `จุดตัดท่อย่อย ↔ ท่อเมนรอง`
                        );
                    });

                    // กรอง connection points เพื่อให้ท่อเมน 1 เส้นเชื่อมกับท่อ submain 1 เส้นได้เพียงจุดเดียว
                    // โดยให้ความสำคัญกับจุดที่ปลายท่อ main ก่อน
                    const filteredConnectionPoints = new Map<string, UnifiedConnectionPoint>();
                    const mainPipeUsed = new Set<string>(); // mainPipeId ที่ใช้แล้ว
                    const subMainPipeUsed = new Set<string>(); // subMainPipeId ที่ใช้แล้ว

                    // เรียง connection points ตาม priority (น้อยกว่า = สำคัญกว่า)
                    const sortedPoints = Array.from(mergedConnectionPointsMap.entries()).sort(
                        (a, b) => {
                            const priorityA = Math.min(...a[1].types.map(getConnectionPriority));
                            const priorityB = Math.min(...b[1].types.map(getConnectionPriority));
                            if (priorityA !== priorityB) {
                                return priorityA - priorityB; // priority น้อยกว่า = สำคัญกว่า
                            }
                            return 0;
                        }
                    );

                    // เลือก connection points โดยให้ท่อเมน 1 เส้นเชื่อมกับท่อ submain 1 เส้นได้เพียงจุดเดียว
                    for (const [key, mergedPoint] of sortedPoints) {
                        // ตรวจสอบว่ามี mainPipeId หรือ subMainPipeId ใน data หรือไม่
                        let hasMainPipe = false;
                        let hasSubMainPipe = false;
                        let mainPipeId: string | null = null;
                        let subMainPipeId: string | null = null;

                        for (const item of mergedPoint.data) {
                            if (item.mainPipeId) {
                                hasMainPipe = true;
                                mainPipeId = item.mainPipeId;
                            }
                            if (item.subMainPipeId) {
                                hasSubMainPipe = true;
                                subMainPipeId = item.subMainPipeId;
                            }
                        }

                        // ถ้ามี mainPipeId และ subMainPipeId ให้ตรวจสอบว่ายังไม่ได้ใช้
                        if (hasMainPipe && hasSubMainPipe && mainPipeId && subMainPipeId) {
                            if (mainPipeUsed.has(mainPipeId) || subMainPipeUsed.has(subMainPipeId)) {
                                continue; // ข้ามถ้าท่อเมนหรือท่อเมนรองนี้ใช้แล้ว
                            }
                            mainPipeUsed.add(mainPipeId);
                            subMainPipeUsed.add(subMainPipeId);
                        }

                        filteredConnectionPoints.set(key, mergedPoint);
                    }

                    // สร้าง markers จาก filtered connection points
                    filteredConnectionPoints.forEach((mergedPoint, index) => {
                        const connectionMarker = new google.maps.Marker({
                            position: new google.maps.LatLng(
                                mergedPoint.position.lat,
                                mergedPoint.position.lng
                            ),
                            map: map,
                            icon: {
                                path: google.maps.SymbolPath.CIRCLE,
                                scale:
                                    mergedPoint.data.length > 1
                                        ? Math.min(5, 3 + mergedPoint.data.length)
                                        : 3,
                                fillColor: mergedPoint.color,
                                fillOpacity: 1.0,
                                strokeColor: '#FFFFFF',
                                strokeWeight: 2,
                            },
                            zIndex: mergedPoint.zIndex,
                            title: mergedPoint.title,
                        });

                        const connectionId = `connection-merged-${index}`;
                        overlaysRef.current.markers.set(connectionId, connectionMarker);

                        // สร้าง info window ที่แสดงข้อมูลทั้งหมด
                        let infoContent = `
                        <div class="p-3 min-w-[250px]">
                            <h4 class="font-bold text-gray-800 mb-2">🔗 จุดเชื่อมต่อ</h4>
                            <p class="text-sm text-gray-600 mb-2">จำนวน: ${mergedPoint.data.length} จุด</p>
                            <hr class="my-2">
                    `;

                        mergedPoint.data.forEach((item, itemIndex) => {
                            infoContent += `
                            <div class="mb-2 text-gray-800 ${itemIndex > 0 ? 'mt-2 pt-2 border-t' : ''}">
                                <p class="font-semibold text-sm">${item.type || 'connection'}</p>
                        `;
                            if (item.mainPipeId) {
                                infoContent += `<p class="text-xs"><strong>ท่อเมน:</strong> ${item.mainPipeId}</p>`;
                            }
                            if (item.subMainPipeId) {
                                infoContent += `<p class="text-xs"><strong>ท่อเมนรอง:</strong> ${item.subMainPipeId}</p>`;
                            }
                            if (item.lateralPipeId) {
                                infoContent += `<p class="text-xs"><strong>ท่อย่อย:</strong> ${item.lateralPipeId}</p>`;
                            }
                            if (item.lateralPipe) {
                                const stats = item.lateralPipe.intersectionData?.segmentStats;
                                if (stats) {
                                    infoContent += `
                                    <div class="text-xs mt-1">
                                        <p><strong>ท่อเส้นรวม:</strong> ${stats.total.length.toFixed(1)} ม.</p>
                                        <p><strong>ต้นไม้:</strong> ${stats.total.plants.length} ต้น</p>
                                        <p><strong>น้ำ:</strong> ${(stats.total.waterNeed || 0).toFixed(1)} ลิตร/นาที</p>
                                    </div>
                                `;
                                }
                            }
                            infoContent += `</div>`;
                        });

                        infoContent += `</div>`;

                        const infoWindow = new google.maps.InfoWindow({
                            content: infoContent,
                        });

                        connectionMarker.addListener('click', () => {
                            infoWindow.open(map, connectionMarker);
                        });

                        overlaysRef.current.infoWindows.set(connectionId, infoWindow);
                    });
                }

                data.subMainPipes.forEach((pipe) => {
                    const isHighlighted = highlightedPipes.includes(pipe.id);
                    const isSelected = data.selectedItems.pipes.includes(pipe.id);
                    const isSelectedInConnectionMode =
                        data.pipeConnection.isActive &&
                        data.pipeConnection.selectedPoints.some(
                            (p) => p.id === pipe.id && p.type === 'subMainPipe'
                        );

                    const subMainColor = getPipeColor(pipe);
                    let strokeColor = subMainColor;
                    let strokeWeight = 3.5;
                    let strokeOpacity = 0.9;

                    if (isDeleteMode) {
                        strokeWeight = 10;
                        strokeOpacity = 1;
                    } else if (isSelectedInConnectionMode) {
                        strokeColor = subMainColor;
                        strokeWeight = 7;
                        strokeOpacity = 1;
                    } else if (isSelected) {
                        strokeColor = '#FFD700';
                        strokeWeight = 5;
                        strokeOpacity = 1;
                    } else if (isHighlighted) {
                        strokeColor = '#FFD700';
                        strokeWeight = 4;
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
                                : 1200,
                    });

                    subMainPipePolyline.setMap(map);
                    overlaysRef.current.polylines.set(pipe.id, subMainPipePolyline);

                    subMainPipePolyline.addListener('click', (event: google.maps.MapMouseEvent) => {
                        if (event.stop) event.stop();
                        if (event.domEvent) {
                            event.domEvent.stopPropagation();
                            event.domEvent.preventDefault();
                        }

                        if (data.pipeConnection.isActive && event.latLng) {
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

                        return false;
                    });

                    subMainPipePolyline.addListener(
                        'rightclick',
                        (event: google.maps.MapMouseEvent) => {
                            if (event.stop) event.stop();
                            if (event.domEvent) {
                                event.domEvent.stopPropagation();
                                event.domEvent.preventDefault();
                            }

                            if (isDeleteMode) {
                                handleDeletePipe(pipe.id, 'subMainPipe');
                            }

                            return false;
                        }
                    );

                    pipe.branchPipes.forEach((branchPipe) => {
                        const isBranchHighlighted = highlightedPipes.includes(branchPipe.id);
                        const isBranchSelected = data.selectedItems.pipes.includes(branchPipe.id);
                        const branchColor = getPipeColor(branchPipe);

                        const branchPolyline = new google.maps.Polyline({
                            path: branchPipe.coordinates.map((coord) => ({
                                lat: coord.lat,
                                lng: coord.lng,
                            })),
                            strokeColor: isBranchSelected
                                ? '#FFD700'
                                : isBranchHighlighted
                                    ? '#FFD700'
                                    : branchColor,
                            strokeWeight: isBranchSelected ? 5 : isBranchHighlighted ? 3 : 2,
                            strokeOpacity: isBranchHighlighted || isBranchSelected ? 1 : 0.8,
                            clickable: true,
                            zIndex: isDeleteMode
                                ? 1800
                                : isBranchSelected || isBranchHighlighted
                                    ? 1350
                                    : 1000,
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
                            event.stop();
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

                        branchPolyline.addListener('rightclick', (event: google.maps.MapMouseEvent) => {
                            event.stop();
                            if (event.domEvent) {
                                event.domEvent.stopPropagation();
                                event.domEvent.preventDefault();
                            }

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
                // 🔧 คำนวณขนาดต้นไม้ตาม zoom level
                // เมื่อซูมออกไกลๆ (zoom ต่ำ) → ต้นไม้เล็กลง
                // เมื่อซูมเข้าใกล้ๆ (zoom สูง) → ต้นไม้ขนาดปกติ
                const calculatePlantSize = (zoom: number | undefined): number => {
                    if (!zoom) return 28; // default
                    if (zoom < 14) return 20; // ซูมออกมาก → เล็กมาก
                    if (zoom < 16) return 22; // ซูมออกปานกลาง → เล็ก
                    if (zoom < 18) return 24; // ซูมออกเล็กน้อย → เล็กน้อย
                    if (zoom < 20) return 28; // ขนาดปกติ
                    return 32; // ซูมเข้าใกล้ → ใหญ่ขึ้นเล็กน้อย
                };

                const currentZoom = map?.getZoom();
                const plantSize = calculatePlantSize(currentZoom);

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

                    const isHighlightedForLateralPipe = highlightedPlants.has(plant.id);

                    let plantColor = '#22C55E';
                    let plantSymbol = '🌳';
                    let circleRadius = 12;

                    if (isSelectedInConnectionMode) {
                        plantColor = '#FF6B35';
                        plantSymbol = '🔗';
                        circleRadius = 14;
                    } else if (isHighlightedForLateralPipe) {
                        plantColor = '#10B981';
                        plantSymbol = '🌳';
                        circleRadius = 16;
                    } else if (data.pipeConnection.isActive) {
                        plantColor = '#9CA3AF';
                        plantSymbol = '🌳';
                        circleRadius = 10;
                    } else if (
                        data.plantSelectionMode.type === 'multiple' &&
                        (plant as any).plantAreaColor
                    ) {
                        plantColor = (plant as any).plantAreaColor;
                        plantSymbol = '🌳';
                        circleRadius = 8;
                    }

                    let plantZIndex = 500;
                    let plantClickable = true;
                    let plantDraggable = data.isEditModeEnabled;

                    if (isDeleteMode) {
                        plantZIndex = 100;
                        plantClickable = false;
                        plantDraggable = false;
                    } else if (data.lateralPipeDrawing.isActive) {
                        plantZIndex = isHighlightedForLateralPipe ? 1200 : 300;
                    } else if (data.pipeConnection.isActive && isHighlightedForConnection) {
                        plantZIndex = 1500;
                    } else if (
                        isInPlantMoveMode ||
                        isSelectedForMove ||
                        data.plantSelectionMode.type === 'multiple'
                    ) {
                        plantZIndex = 1200;
                    }

                    // 🔧 ใช้ขนาดที่คำนวณจาก zoom level
                    const finalSize = isHighlightedForLateralPipe ? Math.max(36, plantSize + 8) : plantSize;
                    const finalAnchor = finalSize / 2;
                    const fontSize = Math.max(8, Math.floor(plantSize * 0.36)); // ปรับ font size ตามขนาด

                    const plantMarker = new google.maps.Marker({
                        position: { lat: plant.position.lat, lng: plant.position.lng },
                        map: map,
                        icon: {
                            url:
                                'data:image/svg+xml;charset=UTF-8,' +
                                encodeURIComponent(`
                            <svg width="${finalSize}" height="${finalSize}" viewBox="0 0 ${finalSize} ${finalSize}" xmlns="http://www.w3.org/2000/svg">
                                ${isConnectionStart ? `<circle cx="${finalAnchor}" cy="${finalAnchor}" r="${finalAnchor * 0.86}" fill="none" stroke="#FFD700" stroke-width="3"/>` : ''}
                                ${isSelected ? `<circle cx="${finalAnchor}" cy="${finalAnchor}" r="${finalAnchor * 0.79}" fill="none" stroke="#9333EA" stroke-width="2"/>` : ''}
                                ${isCurrentlyDragging ? `<circle cx="${finalAnchor}" cy="${finalAnchor}" r="${finalAnchor * 0.71}" fill="none" stroke="#FF6B35" stroke-width="3"/>` : ''}
                                ${isHighlightedForConnection ? `<circle cx="${finalAnchor}" cy="${finalAnchor}" r="${finalAnchor * 0.79}" fill="none" stroke="#FFD700" stroke-width="2"/>` : ''}
                                ${isInPlantMoveMode ? `<circle cx="${finalAnchor}" cy="${finalAnchor}" r="${finalAnchor * 0.93}" fill="none" stroke="#F97316" stroke-width="2" stroke-dasharray="4,2"/>` : ''}
                                ${isSelectedForMove ? `<circle cx="${finalAnchor}" cy="${finalAnchor}" r="${finalAnchor * 0.93}" fill="none" stroke="#10B981" stroke-width="3"/>` : ''}
                                ${isHighlightedForLateralPipe ? `<circle cx="${finalAnchor}" cy="${finalAnchor}" r="${finalAnchor}" fill="none" stroke="#10B981" stroke-width="3" stroke-dasharray="2,2"/>` : ''}
                            ${data.plantSelectionMode.type === 'multiple' ? `<circle cx="${finalAnchor}" cy="${finalAnchor}" r="${Math.max(finalAnchor * 0.21, circleRadius - 2)}" fill="${plantColor}" />` : ''}
                                <text x="${finalAnchor}" y="${finalAnchor}" text-anchor="middle" dominant-baseline="central" fill="white" font-size="${fontSize}" font-weight="bold">${plantSymbol}</text>
                            </svg>
                        `),
                            scaledSize: new google.maps.Size(finalSize, finalSize),
                            anchor: new google.maps.Point(finalAnchor, finalAnchor),
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
                            ${data.isEditModeEnabled
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
            connectionStartPlant?.id,
            editMode,
            handleDeletePipe,
            highlightedPipes,
            isDeleteMode,
            isZoneEditMode,
            lateralPipesState,
            onLateralPipeMouseMove,
            onManualZoneSelect,
            onPipeClickInConnectionMode,
            onPlantClickInConnectionMode,
            onZoneSelect,
            onZoneUpdate,
            selectedZoneForEdit,
            setDraggedControlPointIndex,
            tempConnectionLine,
            zoneControlPoints,
            zoomTrigger, // 🔧 เพิ่ม zoomTrigger เพื่อ trigger re-render เมื่อ zoom เปลี่ยน
        ]);

        useEffect(() => {
            return () => {
                clearOverlays();
            };
        }, [clearOverlays]);

        return null;
    };
