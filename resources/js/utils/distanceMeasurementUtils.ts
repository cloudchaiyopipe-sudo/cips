/**
 * Utility functions for accurate distance measurement in drawing system
 */

export interface Coordinate {
    lat: number;
    lng: number;
}

/**
 * Calculate accurate distance between two coordinates using Haversine formula
 */
export const calculateDistance = (point1: Coordinate, point2: Coordinate): number => {
    // Validate input coordinates
    if (!point1 || !point2 || 
        typeof point1.lat !== 'number' || typeof point1.lng !== 'number' ||
        typeof point2.lat !== 'number' || typeof point2.lng !== 'number' ||
        isNaN(point1.lat) || isNaN(point1.lng) || isNaN(point2.lat) || isNaN(point2.lng)) {
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
            lngDiff 
        });
        return 0;
    }

    // Use Google Maps geometry library for accurate distance calculation if available
    if (window.google?.maps?.geometry?.spherical && 
        typeof window.google.maps.geometry.spherical.computeDistanceBetween === 'function') {
        try {
            const latLng1 = new google.maps.LatLng(point1.lat, point1.lng);
            const latLng2 = new google.maps.LatLng(point2.lat, point2.lng);
            const distance = google.maps.geometry.spherical.computeDistanceBetween(latLng1, latLng2);
            return Math.max(0, distance); // Ensure non-negative distance
        } catch (error) {
            console.warn('Error using Google Maps geometry library:', error);
        }
    }
    
    // Fallback to Haversine formula
    const R = 6371000; // Earth's radius in meters
    const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
    const dLng = ((point2.lng - point1.lng) * Math.PI) / 180;
    const lat1Rad = (point1.lat * Math.PI) / 180;
    const lat2Rad = (point2.lat * Math.PI) / 180;

    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1Rad) * Math.cos(lat2Rad) * 
              Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(Math.max(0, a)), Math.sqrt(Math.max(0, 1 - a)));
    const distance = R * c;
    
    return Math.max(0, distance); // Ensure non-negative distance
};

/**
 * Convert screen coordinates to map coordinates accurately
 */
export const screenToMapCoordinates = (
    screenX: number,
    screenY: number,
    mapRect: DOMRect,
    mapBounds: google.maps.LatLngBounds
): Coordinate => {
    const ne = mapBounds.getNorthEast();
    const sw = mapBounds.getSouthWest();
    
    // Calculate relative position (0-1)
    const relativeX = screenX / mapRect.width;
    const relativeY = screenY / mapRect.height;
    
    // Convert to lat/lng coordinates
    const lng = sw.lng() + (ne.lng() - sw.lng()) * relativeX;
    const lat = sw.lat() + (ne.lat() - sw.lat()) * (1 - relativeY);
    
    return { lat, lng };
};

/**
 * Format distance for display
 */
export const formatDistance = (meters: number): string => {
    if (meters < 1000) {
        return `${meters.toFixed(1)} ม.`;
    } else {
        return `${(meters / 1000).toFixed(2)} กม.`;
    }
};

/**
 * Validate coordinate is within reasonable bounds
 */
export const isValidCoordinate = (coord: Coordinate): boolean => {
    return coord &&
           typeof coord.lat === 'number' &&
           typeof coord.lng === 'number' &&
           !isNaN(coord.lat) &&
           !isNaN(coord.lng) &&
           isFinite(coord.lat) &&
           isFinite(coord.lng) &&
           coord.lat >= -90 && coord.lat <= 90 &&
           coord.lng >= -180 && coord.lng <= 180;
};

/**
 * Check if two coordinates are the same (within tolerance)
 */
export const areCoordinatesEqual = (
    coord1: Coordinate, 
    coord2: Coordinate, 
    tolerance: number = 0.000001
): boolean => {
    if (!isValidCoordinate(coord1) || !isValidCoordinate(coord2)) {
        return false;
    }
    
    const latDiff = Math.abs(coord1.lat - coord2.lat);
    const lngDiff = Math.abs(coord1.lng - coord2.lng);
    
    return latDiff < tolerance && lngDiff < tolerance;
};

/**
 * Calculate total distance for multiple coordinates (polyline)
 */
export const calculatePolylineDistance = (coordinates: Coordinate[]): number => {
    if (!coordinates || coordinates.length < 2) {
        return 0;
    }
    
    let totalDistance = 0;
    for (let i = 0; i < coordinates.length - 1; i++) {
        const segmentDistance = calculateDistance(coordinates[i], coordinates[i + 1]);
        if (isFinite(segmentDistance) && segmentDistance >= 0) {
            totalDistance += segmentDistance;
        }
    }
    
    return totalDistance;
};

/**
 * Get drawing mode text for display
 */
export const getDrawingModeText = (mode: string | null, t: (key: string) => string): string => {
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
        case 'lateralPipe':
            return t('วาดท่อย่อย') || 'วาดท่อย่อย';
        default:
            return t('วาด') || 'วาด';
    }
};

/**
 * Check if mode is for polygon drawing
 */
export const isPolygonMode = (mode: string | null): boolean => {
    return mode === 'mainArea' || mode === 'zone' || mode === 'exclusion' || 
           mode === 'plantArea' || mode === 'manualZone';
};

/**
 * Check if mode is for polyline drawing
 */
export const isPolylineMode = (mode: string | null): boolean => {
    return mode === 'mainPipe' || mode === 'subMainPipe' || mode === 'lateralPipe';
};

/**
 * Throttle function for performance optimization
 */
export const throttle = <T extends (...args: any[]) => any>(
    func: T,
    delay: number
): ((...args: Parameters<T>) => void) => {
    let timeoutId: NodeJS.Timeout | null = null;
    let lastExecTime = 0;
    
    return (...args: Parameters<T>) => {
        const currentTime = Date.now();
        
        if (currentTime - lastExecTime > delay) {
            func(...args);
            lastExecTime = currentTime;
        } else {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            timeoutId = setTimeout(() => {
                func(...args);
                lastExecTime = Date.now();
            }, delay - (currentTime - lastExecTime));
        }
    };
};
