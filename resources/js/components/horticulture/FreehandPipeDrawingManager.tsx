/* eslint-disable prefer-const */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from 'react';
import { calculateDistanceBetweenPoints } from '../../utils/horticultureUtils';

interface Coordinate {
    lat: number;
    lng: number;
}

interface Pipe {
    id: string;
    coordinates: Coordinate[];
    length?: number;
    diameter?: number;
    type?: string;
}

interface FreehandPipeDrawingManagerProps {
    map?: google.maps.Map;
    editMode: string | null;
    isActive: boolean; // เปิด/ปิด freehand mode
    onCreated: (coordinates: Coordinate[], shapeType: string) => void;
    strokeColor?: string;
    strokeWeight?: number;
    pump?: Coordinate | null;
    mainPipes?: Pipe[];
    subMainPipes?: Pipe[];
    plants?: Array<{
        id: string;
        position: Coordinate;
        plantData?: any;
    }>;
    placementMode?: 'over_plants' | 'between_plants';
    t?: (key: string) => string;
}

/**
 * Smooth out the freehand path using Catmull-Rom spline for natural curves
 * Preserves all curve details and creates smooth, natural-looking paths
 */
const smoothPath = (
    coordinates: Coordinate[],
    tolerance: number = 0.3 // Very small threshold to keep almost all points
): Coordinate[] => {
    if (coordinates.length <= 2) {
        return coordinates;
    }

    // Use Catmull-Rom spline interpolation for natural curves
    // This creates smooth curves while preserving the original shape

    // First, remove only points that are extremely close (less than 0.3 meters)
    const filtered: Coordinate[] = [coordinates[0]];
    const minDistance = tolerance / 111320; // 0.3 meters in degrees

    for (let i = 1; i < coordinates.length - 1; i++) {
        const prev = filtered[filtered.length - 1];
        const current = coordinates[i];
        const distance = Math.sqrt(
            Math.pow(current.lat - prev.lat, 2) + Math.pow(current.lng - prev.lng, 2)
        );

        // Keep almost all points - only remove if extremely close
        if (distance > minDistance) {
            filtered.push(current);
        }
    }

    // Always keep the last point
    filtered.push(coordinates[coordinates.length - 1]);

    if (filtered.length <= 2) {
        return filtered;
    }

    // Use simple moving average for gentle smoothing that preserves curves
    // This approach keeps all points but smooths the transitions between them
    const smoothed: Coordinate[] = [];

    // Always keep first point
    smoothed.push(filtered[0]);

    // Smooth intermediate points with gentle averaging
    for (let i = 1; i < filtered.length - 1; i++) {
        const prev = filtered[i - 1];
        const current = filtered[i];
        const next = filtered[i + 1];

        // Gentle smoothing: weight current point more heavily to preserve user's intent
        // Only smooth slightly to reduce jaggedness without changing the shape much
        const smoothedPoint: Coordinate = {
            lat: prev.lat * 0.15 + current.lat * 0.7 + next.lat * 0.15,
            lng: prev.lng * 0.15 + current.lng * 0.7 + next.lng * 0.15,
        };

        // Check if smoothing would move point too far from original
        const distance = Math.sqrt(
            Math.pow(smoothedPoint.lat - current.lat, 2) +
                Math.pow(smoothedPoint.lng - current.lng, 2)
        );

        // Only use smoothed point if it's close to original (preserves user intent)
        // Threshold: ~11 meters (0.0001 degrees)
        if (distance < 0.0001) {
            smoothed.push(smoothedPoint);
        } else {
            // Keep original point to preserve user's drawing
            smoothed.push(current);
        }
    }

    // Always keep last point
    smoothed.push(filtered[filtered.length - 1]);

    return smoothed;
};

/**
 * Optimize path by removing only truly redundant points
 * Uses very conservative threshold to preserve all curve details
 */
const optimizePath = (coordinates: Coordinate[]): Coordinate[] => {
    if (coordinates.length <= 2) {
        return coordinates;
    }

    const optimized: Coordinate[] = [coordinates[0]];
    // Very small threshold (0.2 meters) - only remove points that are almost exactly on a straight line
    const threshold = 0.2 / 111320; // 0.2 meters in degrees

    for (let i = 1; i < coordinates.length - 1; i++) {
        const prev = optimized[optimized.length - 1];
        const current = coordinates[i];
        const next = coordinates[i + 1];

        // Calculate distance from current point to line segment between prev and next
        const dx = next.lng - prev.lng;
        const dy = next.lat - prev.lat;
        const lengthSquared = dx * dx + dy * dy;

        if (lengthSquared === 0) {
            // Points are identical, keep current
            optimized.push(current);
            continue;
        }

        const t = Math.max(
            0,
            Math.min(
                1,
                ((current.lng - prev.lng) * dx + (current.lat - prev.lat) * dy) / lengthSquared
            )
        );

        const projLng = prev.lng + t * dx;
        const projLat = prev.lat + t * dy;

        const distance = Math.sqrt(
            Math.pow(current.lat - projLat, 2) + Math.pow(current.lng - projLng, 2)
        );

        // Keep point if it's even slightly off the line - this preserves curves
        // Also check if the line segment is short - keep point if segment is short
        const segmentLength = Math.sqrt(
            Math.pow(next.lat - prev.lat, 2) + Math.pow(next.lng - prev.lng, 2)
        );

        if (distance > threshold || segmentLength < 0.001) {
            // Keep the point to preserve curve details
            optimized.push(current);
        }
    }

    optimized.push(coordinates[coordinates.length - 1]);
    return optimized;
};

const snapPointToPump = (
    point: Coordinate,
    pumpPosition: Coordinate | null,
    snapThreshold: number = 10
): Coordinate => {
    if (!pumpPosition) {
        return point;
    }

    const distance = calculateDistanceBetweenPoints(point, pumpPosition);

    if (distance <= snapThreshold) {
        return pumpPosition;
    }

    return point;
};

const FreehandPipeDrawingManager: React.FC<FreehandPipeDrawingManagerProps> = ({
    map,
    editMode,
    isActive,
    onCreated,
    strokeColor = '#FF0000',
    strokeWeight = 3,
    pump = null,
    mainPipes = [],
}) => {
    const isDrawingRef = useRef(false);
    const currentPathRef = useRef<Coordinate[]>([]);
    const tempPolylineRef = useRef<google.maps.Polyline | null>(null);
    const [isDrawing, setIsDrawing] = useState(false);

    // Cleanup function
    const cleanup = () => {
        if (tempPolylineRef.current) {
            tempPolylineRef.current.setMap(null);
            tempPolylineRef.current = null;
        }
        currentPathRef.current = [];
        isDrawingRef.current = false;
        setIsDrawing(false);
    };

    useEffect(() => {
        if (!map || !isActive) {
            cleanup();
            return;
        }

        // Activate for mainPipe, subMainPipe, and lateralPipe
        if (editMode !== 'mainPipe' && editMode !== 'subMainPipe' && editMode !== 'lateralPipe') {
            cleanup();
            return;
        }

        // Determine stroke color based on pipe type
        const pipeStrokeColor =
            editMode === 'mainPipe'
                ? '#FF0000'
                : editMode === 'subMainPipe'
                  ? '#8B5CF6'
                  : editMode === 'lateralPipe'
                    ? '#FFD700'
                    : strokeColor;

        // Get map container for direct event handling
        const mapDiv = map.getDiv();
        let isDragging = false;
        let hasStartedDrawing = false;
        let mouseDownTime = 0;
        let mouseDownPosition = { x: 0, y: 0 };
        let isMouseButtonDown = false; // Track actual mouse button state
        let lastMouseMoveTime = 0;
        let lastMouseMovePosition = { x: 0, y: 0 }; // Track last mouse position for speed calculation
        let lastPointTime = 0; // Track time when last point was added
        let ignoreNextMouseUp = false; // Flag to ignore premature mouseup
        let mouseUpTimeoutId: number | null = null; // Track delayed mouseup (use number for browser setTimeout)

        // Global mouse button state tracking to prevent false mouseup events
        let globalMouseButtonState = false; // Track if mouse button is actually down globally

        // Change cursor style when freehand mode is active
        const originalCursor = mapDiv.style.cursor;
        mapDiv.style.cursor = 'crosshair';

        const handleMouseDown = (e: MouseEvent) => {
            // Only handle left mouse button
            if (e.button !== 0) return;

            // Check if clicking on map controls
            const target = e.target as HTMLElement;
            if (
                target &&
                (target.closest('.gmnoprint') ||
                    target.closest('[role="button"]') ||
                    target.closest('.gm-control-active'))
            ) {
                return;
            }

            // Close any open info windows when starting to draw
            const infoWindows = document.querySelectorAll('.gm-style-iw');
            infoWindows.forEach((iw) => {
                const closeBtn = (iw as HTMLElement).querySelector(
                    'button[aria-label*="Close"]'
                ) as HTMLElement;
                if (closeBtn) {
                    closeBtn.click();
                }
            });

            // Check if clicking on info window - if so, just close it and return
            const isInfoWindow =
                target?.closest('.gm-style-iw') || target?.closest('.gm-style-iw-c');
            if (isInfoWindow) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
                return;
            }

            // Check if click is within map bounds
            const mapRect = mapDiv.getBoundingClientRect();
            if (
                e.clientX < mapRect.left ||
                e.clientX > mapRect.right ||
                e.clientY < mapRect.top ||
                e.clientY > mapRect.bottom
            ) {
                return;
            }

            // Convert screen coordinates to lat/lng
            const bounds = map.getBounds();
            if (!bounds) return;

            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();
            const x = e.clientX - mapRect.left;
            const y = e.clientY - mapRect.top;

            const lat = sw.lat() + (ne.lat() - sw.lat()) * (1 - y / mapRect.height);
            const lng = sw.lng() + (ne.lng() - sw.lng()) * (x / mapRect.width);

            let startPoint: Coordinate = { lat, lng };

            // If clicking near pump and in mainPipe mode, use pump position
            if (editMode === 'mainPipe' && pump) {
                const distance = calculateDistanceBetweenPoints(startPoint, pump);
                if (distance < 0.00015) {
                    // Very close to pump (about 16 meters)
                    startPoint = pump;
                }
            }

            // Snap to pump for mainPipe (final check)
            const snappedStartPoint =
                editMode === 'mainPipe' && pump
                    ? snapPointToPump(startPoint, pump, 10)
                    : startPoint;

            // Record mouse down time and position for minimum drag detection
            mouseDownTime = Date.now();
            mouseDownPosition = { x: e.clientX, y: e.clientY };
            lastMouseMovePosition = { x: e.clientX, y: e.clientY };
            lastPointTime = Date.now(); // Initialize last point time
            isMouseButtonDown = true;
            globalMouseButtonState = true; // Track global state
            ignoreNextMouseUp = false;
            lastMouseMoveTime = Date.now();

            isDrawingRef.current = true;
            hasStartedDrawing = true;
            setIsDrawing(true);
            currentPathRef.current = [snappedStartPoint];

            // Create temporary polyline for preview
            if (tempPolylineRef.current) {
                tempPolylineRef.current.setMap(null);
            }

            tempPolylineRef.current = new google.maps.Polyline({
                path: [snappedStartPoint],
                geodesic: true,
                strokeColor: pipeStrokeColor,
                strokeOpacity: 0.8,
                strokeWeight: strokeWeight,
                map: map,
                zIndex: 1000,
            });

            // Prevent default and stop propagation to prevent marker/info window clicks
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation();

            // Prevent double-click from interfering
            const preventDoubleClick = (dblClickEvent: MouseEvent) => {
                if (isDrawingRef.current) {
                    dblClickEvent.preventDefault();
                    dblClickEvent.stopPropagation();
                    dblClickEvent.stopImmediatePropagation();
                }
            };

            // Temporarily add double-click prevention
            mapDiv.addEventListener('dblclick', preventDoubleClick, true);

            // Remove it after a short delay
            setTimeout(() => {
                mapDiv.removeEventListener('dblclick', preventDoubleClick, true);
            }, 300);
        };

        const handleMouseMove = (e: MouseEvent) => {
            // Update cursor during drawing
            if (isDrawingRef.current && hasStartedDrawing) {
                mapDiv.style.cursor = 'crosshair';
            }

            if (!isDrawingRef.current || !hasStartedDrawing) return;

            // CRITICAL: Check global mouse button state first
            // If button is not down globally, don't process mousemove
            if (!globalMouseButtonState) {
                return;
            }

            // Calculate time since last point and pixel distance for speed detection
            const currentTime = Date.now();
            const timeSinceLastPoint = currentTime - lastPointTime;
            const pixelDistance = Math.sqrt(
                Math.pow(e.clientX - lastMouseMovePosition.x, 2) +
                    Math.pow(e.clientY - lastMouseMovePosition.y, 2)
            );

            // Update last mouse move position (but keep lastPointTime for next calculation)
            lastMouseMovePosition = { x: e.clientX, y: e.clientY };
            lastMouseMoveTime = currentTime;

            // Verify mouse button is still pressed during mousemove
            // Use global state as primary check, e.buttons as secondary
            if (e.buttons !== undefined) {
                if ((e.buttons & 1) === 0 && !globalMouseButtonState) {
                    // Button was released - don't update path
                    return;
                }
            }

            // Convert screen coordinates to lat/lng
            const mapRect = mapDiv.getBoundingClientRect();
            const bounds = map.getBounds();
            if (!bounds) return;

            const ne = bounds.getNorthEast();
            const sw = bounds.getSouthWest();
            const x = e.clientX - mapRect.left;
            const y = e.clientY - mapRect.top;

            const lat = sw.lat() + (ne.lat() - sw.lat()) * (1 - y / mapRect.height);
            const lng = sw.lng() + (ne.lng() - sw.lng()) * (x / mapRect.width);

            const currentPoint: Coordinate = { lat, lng };

            // Add point to path (with adaptive threshold based on movement speed)
            const lastPoint = currentPathRef.current[currentPathRef.current.length - 1];
            if (lastPoint) {
                const distance = calculateDistanceBetweenPoints(lastPoint, currentPoint);

                // Calculate movement speed (pixels per ms)
                // Use time since last point was added, not time since last mousemove
                const movementSpeedPixels =
                    timeSinceLastPoint > 0 ? pixelDistance / timeSinceLastPoint : 0;

                // Adaptive threshold: when moving fast, use smaller threshold to capture more points
                // When moving slow, use slightly larger threshold to avoid too many points
                let threshold = 0.03 / 111320; // Default: 0.03 meters (3 cm) - very small

                // If moving very fast (more than 5 pixels per ms), use even smaller threshold
                if (movementSpeedPixels > 5) {
                    threshold = 0.015 / 111320; // 0.015 meters (1.5 cm) for very fast movement
                } else if (movementSpeedPixels > 2) {
                    threshold = 0.02 / 111320; // 0.02 meters (2 cm) for fast movement
                } else if (movementSpeedPixels > 0.5) {
                    threshold = 0.03 / 111320; // 0.03 meters (3 cm) for medium movement
                } else {
                    threshold = 0.05 / 111320; // 0.05 meters (5 cm) for slow movement
                }

                if (distance < threshold) {
                    return;
                }

                // If distance is large (fast movement), interpolate intermediate points
                // This ensures smooth curves even when moving quickly
                if (distance > 0.2 / 111320) {
                    // More than 0.2 meters (about 22 meters)
                    // Calculate number of intermediate points needed (one point per 0.1 meters)
                    const numIntermediatePoints = Math.min(
                        Math.floor(distance / (0.1 / 111320)),
                        20 // Limit to 20 points max to avoid performance issues
                    );

                    if (numIntermediatePoints > 0) {
                        for (let i = 1; i <= numIntermediatePoints; i++) {
                            const t = i / (numIntermediatePoints + 1);
                            const interpolatedPoint: Coordinate = {
                                lat: lastPoint.lat + (currentPoint.lat - lastPoint.lat) * t,
                                lng: lastPoint.lng + (currentPoint.lng - lastPoint.lng) * t,
                            };
                            currentPathRef.current.push(interpolatedPoint);
                        }
                    }
                }
            }

            currentPathRef.current.push(currentPoint);
            lastPointTime = currentTime; // Update time when point was added

            // Update temporary polyline
            if (tempPolylineRef.current && currentPathRef.current.length > 0) {
                tempPolylineRef.current.setPath(currentPathRef.current);
            }
        };

        const handleMouseUp = (e: MouseEvent) => {
            // Only handle left mouse button
            if (e.button !== 0) return;

            if (!isDrawingRef.current || !hasStartedDrawing || !isMouseButtonDown) {
                return;
            }

            // CRITICAL: Multiple checks to verify mouse button is actually released
            // Check 1: e.buttons property
            if (e.buttons !== undefined && (e.buttons & 1) !== 0) {
                // Mouse button is still pressed! This is a false mouseup event
                return;
            }

            // Check 2: Use a longer delay and re-check button state multiple times
            // This prevents premature finalization from other events
            if (mouseUpTimeoutId !== null) {
                clearTimeout(mouseUpTimeoutId);
                mouseUpTimeoutId = null;
            }

            // Use global mouse button state tracking
            // Check if button is actually released by checking global state
            if (globalMouseButtonState) {
                // Button is still down globally, this might be a false mouseup
                // Wait and check again
                mouseUpTimeoutId = window.setTimeout(() => {
                    // Re-check global state
                    if (globalMouseButtonState && isDrawingRef.current) {
                        // Button is still down, ignore this mouseup
                        return;
                    }

                    // Button is actually released, proceed with finalization
                    if (isDrawingRef.current && hasStartedDrawing) {
                        const mapRect = mapDiv.getBoundingClientRect();
                        const isInBounds =
                            e.clientX >= mapRect.left &&
                            e.clientX <= mapRect.right &&
                            e.clientY >= mapRect.top &&
                            e.clientY <= mapRect.bottom;

                        if (currentPathRef.current.length >= 2) {
                            finalizeDrawing(e, isInBounds);
                        } else {
                            isDrawingRef.current = false;
                            hasStartedDrawing = false;
                            isMouseButtonDown = false;
                            setIsDrawing(false);
                            if (tempPolylineRef.current) {
                                tempPolylineRef.current.setMap(null);
                                tempPolylineRef.current = null;
                            }
                            currentPathRef.current = [];
                        }
                    }
                }, 100); // Longer delay to ensure button is really released
            } else {
                // Button is already released globally, proceed immediately
                const mapRect = mapDiv.getBoundingClientRect();
                const isInBounds =
                    e.clientX >= mapRect.left &&
                    e.clientX <= mapRect.right &&
                    e.clientY >= mapRect.top &&
                    e.clientY <= mapRect.bottom;

                if (currentPathRef.current.length >= 2) {
                    finalizeDrawing(e, isInBounds);
                } else {
                    isDrawingRef.current = false;
                    hasStartedDrawing = false;
                    isMouseButtonDown = false;
                    setIsDrawing(false);
                    if (tempPolylineRef.current) {
                        tempPolylineRef.current.setMap(null);
                        tempPolylineRef.current = null;
                    }
                    currentPathRef.current = [];
                }
            }
        };

        const finalizeDrawing = (e: MouseEvent, isInBounds: boolean) => {
            if (!isDrawingRef.current || !hasStartedDrawing) return;

            isMouseButtonDown = false;
            globalMouseButtonState = false; // Update global state

            // Check if this is a click (not a drag) - if so, don't finalize
            const mouseUpTime = Date.now();
            const timeDiff = mouseUpTime - mouseDownTime;
            const mouseMoveDistance = Math.sqrt(
                Math.pow(e.clientX - mouseDownPosition.x, 2) +
                    Math.pow(e.clientY - mouseDownPosition.y, 2)
            );

            // Very lenient check: Only ignore if it's a very quick tap (< 30ms and < 2 pixels)
            if (timeDiff < 30 && mouseMoveDistance < 2) {
                // Cancel drawing - this was just a tap
                isDrawingRef.current = false;
                hasStartedDrawing = false;
                setIsDrawing(false);
                if (tempPolylineRef.current) {
                    tempPolylineRef.current.setMap(null);
                    tempPolylineRef.current = null;
                }
                currentPathRef.current = [];
                return;
            }

            // Add final point if mouse is still on map bounds
            if (isInBounds) {
                const mapRect = mapDiv.getBoundingClientRect();
                const bounds = map.getBounds();
                if (bounds) {
                    const ne = bounds.getNorthEast();
                    const sw = bounds.getSouthWest();
                    const x = e.clientX - mapRect.left;
                    const y = e.clientY - mapRect.top;

                    const lat = sw.lat() + (ne.lat() - sw.lat()) * (1 - y / mapRect.height);
                    const lng = sw.lng() + (ne.lng() - sw.lng()) * (x / mapRect.width);
                    const finalPoint: Coordinate = { lat, lng };

                    // Only add if different from last point
                    const lastPoint = currentPathRef.current[currentPathRef.current.length - 1];
                    if (lastPoint) {
                        const distance = calculateDistanceBetweenPoints(lastPoint, finalPoint);
                        if (distance > 0.1 / 111320) {
                            currentPathRef.current.push(finalPoint);
                        }
                    } else {
                        currentPathRef.current.push(finalPoint);
                    }
                }
            }

            isDrawingRef.current = false;
            hasStartedDrawing = false;
            setIsDrawing(false);

            // Process and finalize path
            if (currentPathRef.current.length >= 2) {
                // Smooth and optimize the path
                let optimizedPath = currentPathRef.current;

                // Remove only truly duplicate points (very small threshold)
                optimizedPath = optimizedPath.filter((point, index, arr) => {
                    if (index === 0) return true;
                    const prev = arr[index - 1];
                    const distance = calculateDistanceBetweenPoints(prev, point);
                    return distance > 0.02 / 111320; // Very small threshold (0.02 meters) to keep almost all points
                });

                // Smooth the path with curve preservation
                optimizedPath = smoothPath(optimizedPath, 0.3); // Very small tolerance to preserve curves

                // Optimize the path (this will preserve curves better with lower threshold)
                optimizedPath = optimizePath(optimizedPath);

                // Ensure we have at least 2 points
                if (optimizedPath.length >= 2) {
                    // Apply snap to pump for first point if mainPipe
                    if (editMode === 'mainPipe' && pump) {
                        optimizedPath[0] = snapPointToPump(optimizedPath[0], pump, 10);
                    }

                    // Finalize the drawing
                    onCreated(optimizedPath, 'polyline');
                }
            }

            // Cleanup temporary polyline
            if (tempPolylineRef.current) {
                tempPolylineRef.current.setMap(null);
                tempPolylineRef.current = null;
            }

            currentPathRef.current = [];
        };

        // Add global mouse event listeners to track button state accurately
        const handleGlobalMouseDown = (e: MouseEvent) => {
            if (e.button === 0) {
                globalMouseButtonState = true;
            }
        };

        const handleGlobalMouseUp = (e: MouseEvent) => {
            if (e.button === 0) {
                globalMouseButtonState = false;
            }
        };

        // Add global listeners to track mouse button state
        document.addEventListener('mousedown', handleGlobalMouseDown, true);
        document.addEventListener('mouseup', handleGlobalMouseUp, true);

        // Add event listeners directly to map container (capture phase for better control)
        // Use capture phase with highest priority
        mapDiv.addEventListener('mousedown', handleMouseDown, true);
        mapDiv.addEventListener('mousemove', handleMouseMove, true);
        mapDiv.addEventListener('mouseup', handleMouseUp, true);

        // Also listen for contextmenu to prevent right-click interference
        const handleContextMenu = (e: MouseEvent) => {
            if (isDrawingRef.current) {
                e.preventDefault();
                e.stopPropagation();
                e.stopImmediatePropagation();
            }
        };
        mapDiv.addEventListener('contextmenu', handleContextMenu, true);

        // Store cleanup function
        const cleanupEventListeners = () => {
            if (mouseUpTimeoutId !== null) {
                clearTimeout(mouseUpTimeoutId);
                mouseUpTimeoutId = null;
            }
            // Remove global listeners
            document.removeEventListener('mousedown', handleGlobalMouseDown, true);
            document.removeEventListener('mouseup', handleGlobalMouseUp, true);
            // Remove map listeners
            mapDiv.removeEventListener('mousedown', handleMouseDown, true);
            mapDiv.removeEventListener('mousemove', handleMouseMove, true);
            mapDiv.removeEventListener('mouseup', handleMouseUp, true);
            mapDiv.removeEventListener('contextmenu', handleContextMenu, true);
        };

        // Also handle mouseleave to stop drawing if mouse leaves map
        const handleMouseLeave = (e: MouseEvent) => {
            if (isDrawingRef.current && hasStartedDrawing) {
                // Check minimum path length before finalizing
                if (currentPathRef.current.length >= 2) {
                    // Calculate total path length
                    let totalPathLength = 0;
                    for (let i = 1; i < currentPathRef.current.length; i++) {
                        totalPathLength += calculateDistanceBetweenPoints(
                            currentPathRef.current[i - 1],
                            currentPathRef.current[i]
                        );
                    }

                    // Minimum path length: 2 meters
                    const minPathLength = 2 / 111320;
                    if (totalPathLength >= minPathLength) {
                        let optimizedPath = currentPathRef.current;

                        optimizedPath = optimizedPath.filter((point, index, arr) => {
                            if (index === 0) return true;
                            const prev = arr[index - 1];
                            const distance = calculateDistanceBetweenPoints(prev, point);
                            return distance > 0.05 / 111320;
                        });

                        optimizedPath = smoothPath(optimizedPath, 1);
                        optimizedPath = optimizePath(optimizedPath);

                        if (optimizedPath.length >= 2) {
                            if (editMode === 'mainPipe' && pump) {
                                optimizedPath[0] = snapPointToPump(optimizedPath[0], pump, 10);
                            }
                            onCreated(optimizedPath, 'polyline');
                        }
                    }
                }

                isDrawingRef.current = false;
                hasStartedDrawing = false;
                setIsDrawing(false);

                if (tempPolylineRef.current) {
                    tempPolylineRef.current.setMap(null);
                    tempPolylineRef.current = null;
                }
                currentPathRef.current = [];
            }
        };

        mapDiv.addEventListener('mouseleave', handleMouseLeave, true);

        return () => {
            cleanupEventListeners();
            mapDiv.removeEventListener('mouseleave', handleMouseLeave, true);
            // Restore original cursor
            mapDiv.style.cursor = originalCursor;
            cleanup();
        };
    }, [map, editMode, isActive, onCreated, strokeColor, strokeWeight, pump, mainPipes]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, []);

    return null;
};

export default FreehandPipeDrawingManager;
