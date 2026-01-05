import { useState, useCallback, useRef } from 'react';
import { IrrigationZone, PlantLocation, Coordinate } from '../utils/irrigationZoneUtils';
import {
    ZoneEditState,
    ZoneControlPoint,
    createInitialZoneEditState,
    startZoneEditing,
    stopZoneEditing,
    startDragging,
    stopDragging,
    createZoneControlPoints,
    updateZoneCoordinatesOnDrag,
    updateZoneControlPoints,
    findZoneByPoint,
    findPlantsInEditedZone,
    createUpdatedZone,
    deepCopyZone,
} from '../utils/zoneEditUtils';
import { validateEditedZone, updateEditedZone } from '../utils/autoZoneUtilsExtensions';

export interface UseZoneEditorProps {
    zones: IrrigationZone[];
    allPlants: PlantLocation[];
    mainArea: Coordinate[];
    onZonesUpdate: (updatedZones: IrrigationZone[]) => void;
    onError?: (error: string) => void;
    onSuccess?: (message: string) => void;
    map?: google.maps.Map | null; // 🔧 FIX: เพิ่ม map prop เพื่อใช้ Google Maps API
    mapContainerRef?: React.RefObject<HTMLElement>; // 🔧 FIX: เพิ่ม mapContainerRef
}

export interface UseZoneEditorReturn {
    // State
    editState: ZoneEditState;
    isEditMode: boolean;
    selectedZone: IrrigationZone | null;

    // Actions
    toggleEditMode: () => void;
    exitEditMode: () => void;
    handleZoneClick: (clickPoint: Coordinate) => void;
    handleControlPointDragStart: (controlPoint: ZoneControlPoint, event: React.MouseEvent) => void;
    handleControlPointDrag: (event: React.MouseEvent | MouseEvent) => void;
    handleControlPointDragEnd: () => void;
    applyZoneChanges: () => void;
    cancelZoneChanges: () => void;
    deleteSelectedZone: () => void;

    // Helper functions
    pixelToCoordinate: (pixelX: number, pixelY: number) => Coordinate;
}

export const useZoneEditor = ({
    zones,
    allPlants,
    mainArea,
    onZonesUpdate,
    onError,
    onSuccess,
    map, // 🔧 FIX: รับ map prop
    mapContainerRef, // 🔧 FIX: รับ mapContainerRef
}: UseZoneEditorProps): UseZoneEditorReturn => {
    const [editState, setEditState] = useState<ZoneEditState>(createInitialZoneEditState());
    const [originalZone, setOriginalZone] = useState<IrrigationZone | null>(null);
    const mapBoundsRef = useRef<{
        north: number;
        south: number;
        east: number;
        west: number;
    } | null>(null);

    // คำนวณขอบเขตแผนที่จาก mainArea
    const calculateMapBounds = useCallback(() => {
        if (!mainArea || mainArea.length === 0) return null;

        const lats = mainArea.map((coord) => coord.lat);
        const lngs = mainArea.map((coord) => coord.lng);

        return {
            north: Math.max(...lats),
            south: Math.min(...lats),
            east: Math.max(...lngs),
            west: Math.min(...lngs),
        };
    }, [mainArea]);

    // 🔧 FIX: แปลงพิกัด pixel เป็น coordinate โดยใช้ Google Maps API
    const pixelToCoordinate = useCallback(
        (pixelX: number, pixelY: number): Coordinate => {
            // ใช้ Google Maps API ถ้ามี
            if (map) {
                try {
                    const projection = map.getProjection();
                    if (projection) {
                        const bounds = map.getBounds();
                        if (bounds) {
                            const ne = bounds.getNorthEast();
                            const sw = bounds.getSouthWest();
                            const scale = Math.pow(2, map.getZoom() || 10);
                            const worldCoordinate = projection.fromLatLngToPoint(
                                new google.maps.LatLng(ne.lat(), ne.lng())
                            );

                            if (!worldCoordinate) {
                                // Fall through to fallback calculation
                                throw new Error('Failed to get world coordinate');
                            }

                            // หา map container
                            const container = mapContainerRef?.current || 
                                document.querySelector('.map-container') ||
                                document.querySelector('[data-map-container]') ||
                                document.querySelector('.google-map-container') as HTMLElement;

                            const containerRect = container?.getBoundingClientRect() || {
                                width: window.innerWidth,
                                height: window.innerHeight,
                                left: 0,
                                top: 0,
                            };

                            const point = new google.maps.Point(
                                (pixelX / containerRect.width) * (ne.lng() - sw.lng()) / scale,
                                (pixelY / containerRect.height) * (ne.lat() - sw.lat()) / scale
                            );

                            const latLng = projection.fromPointToLatLng(
                                new google.maps.Point(
                                    worldCoordinate.x + point.x,
                                    worldCoordinate.y - point.y
                                )
                            );

                            if (latLng) {
                                return {
                                    lat: latLng.lat(),
                                    lng: latLng.lng(),
                                };
                            }
                        }
                    }
                } catch (error) {
                    console.warn('⚠️ Error using Google Maps projection, falling back to manual calculation:', error);
                }
            }

            // Fallback: ใช้วิธีเดิม
            const bounds = mapBoundsRef.current || calculateMapBounds();
            if (!bounds) return { lat: 0, lng: 0 };

            const container = mapContainerRef?.current || 
                document.querySelector('.map-container') ||
                document.querySelector('[data-map-container]') ||
                document.querySelector('.google-map-container') as HTMLElement;

            const containerRect = container?.getBoundingClientRect() || {
                width: window.innerWidth,
                height: window.innerHeight,
            };

            const lngRange = bounds.east - bounds.west;
            const latRange = bounds.north - bounds.south;

            if (lngRange === 0 || latRange === 0) {
                return {
                    lat: (bounds.north + bounds.south) / 2,
                    lng: (bounds.east + bounds.west) / 2,
                };
            }

            const lat = bounds.north - (pixelY / containerRect.height) * latRange;
            const lng = bounds.west + (pixelX / containerRect.width) * lngRange;

            return {
                lat: Math.max(bounds.south, Math.min(bounds.north, lat)),
                lng: Math.max(bounds.west, Math.min(bounds.east, lng)),
            };
        },
        [calculateMapBounds, map, mapContainerRef]
    );

    // ออกจากโหมดแก้ไข
    const exitEditMode = useCallback(() => {
        setEditState(stopZoneEditing());
        setOriginalZone(null);
    }, []);

    // เริ่มต้นโหมดแก้ไข
    const toggleEditMode = useCallback(() => {
        if (editState.isEditing) {
            exitEditMode();
        } else {
            setEditState((prevState) => ({
                ...prevState,
                isEditing: true,
            }));
            mapBoundsRef.current = calculateMapBounds();
            
            // 🔧 FIX: อัปเดต mapBounds จาก map ถ้ามี
            if (map) {
                const bounds = map.getBounds();
                if (bounds) {
                    mapBoundsRef.current = {
                        north: bounds.getNorthEast().lat(),
                        south: bounds.getSouthWest().lat(),
                        east: bounds.getNorthEast().lng(),
                        west: bounds.getSouthWest().lng(),
                    };
                }
            }
        }
    }, [editState.isEditing, exitEditMode, calculateMapBounds, map]);

    // จัดการการคลิกโซน
    const handleZoneClick = useCallback(
        (clickPoint: Coordinate) => {
            if (!editState.isEditing) return;

            // หาโซนที่ถูกคลิก
            const clickedZone = findZoneByPoint(clickPoint, zones);
            if (!clickedZone) {
                onError?.('ไม่พบโซนในตำแหน่งที่คลิก');
                return;
            }

            // เริ่มการแก้ไขโซนที่เลือก
            setEditState(startZoneEditing(clickedZone, editState));
            // สร้าง deep copy ของ originalZone เพื่อเก็บสำหรับการ restore
            setOriginalZone(deepCopyZone(clickedZone));

            onSuccess?.(`เริ่มแก้ไขโซน: ${clickedZone.name}`);
        },
        [editState, zones, onError, onSuccess]
    );

    // เริ่มการลากจุดควบคุม
    const handleControlPointDragStart = useCallback(
        (controlPoint: ZoneControlPoint, event: React.MouseEvent) => {
            event.preventDefault();
            event.stopPropagation();

            setEditState((prevState) => startDragging(controlPoint, prevState));
        },
        []
    );

    // การลางจุดควบคุม
    const handleControlPointDrag = useCallback(
        (event: React.MouseEvent | MouseEvent) => {
            if (
                !editState.isDragging ||
                editState.draggedPointIndex === null ||
                !editState.editingZone
            ) {
                return;
            }

            let rect: DOMRect | null = null;

            // 🔧 FIX: ใช้ mapContainerRef หรือหา map container
            if (mapContainerRef?.current) {
                rect = mapContainerRef.current.getBoundingClientRect();
            } else {
                // ลองหาจาก target element ก่อน
                if (event.target && (event.target as Element).getBoundingClientRect) {
                    rect = (event.target as Element).getBoundingClientRect();
                }

                // ถ้าไม่ได้ ลองหาจาก map container
                if (!rect) {
                    const mapContainer =
                        document.querySelector('.map-container') ||
                        document.querySelector('[data-map-container]') ||
                        document.querySelector('.google-map-container');
                    if (mapContainer) {
                        rect = mapContainer.getBoundingClientRect();
                    }
                }

                // ถ้ายังไม่ได้ ใช้ viewport
                if (!rect) {
                    rect = {
                        left: 0,
                        top: 0,
                        width: window.innerWidth,
                        height: window.innerHeight,
                    } as DOMRect;
                }
            }

            const pixelX = event.clientX - rect.left;
            const pixelY = event.clientY - rect.top;

            const newPosition = pixelToCoordinate(pixelX, pixelY);

            // อัปเดตพิกัดโซน
            const updateResult = updateZoneCoordinatesOnDrag(
                editState.editingZone,
                editState.draggedPointIndex,
                newPosition,
                mainArea
            );

            if (updateResult.isValid) {
                // อัปเดตโซนที่กำลังแก้ไข - สร้าง deep copy เพื่อหลีกเลี่ยง reference sharing
                const updatedZone: IrrigationZone = {
                    ...deepCopyZone(editState.editingZone),
                    coordinates: updateResult.updatedCoordinates.map((coord) => ({
                        lat: coord.lat,
                        lng: coord.lng,
                    })), // deep copy coordinates
                };

                // อัปเดตเฉพาะจุดควบคุมที่เกี่ยวข้องแทนการสร้างใหม่ทั้งหมด
                const updatedControlPoints = updateZoneControlPoints(
                    editState.controlPoints,
                    updateResult.updatedCoordinates,
                    editState.draggedPointIndex!
                );

                setEditState((prevState) => ({
                    ...prevState,
                    editingZone: updatedZone,
                    controlPoints: updatedControlPoints,
                }));
            } else {
                onError?.(updateResult.errorMessage || 'ไม่สามารถแก้ไขโซนได้');
            }
        },
        [
            editState.isDragging,
            editState.draggedPointIndex,
            editState.editingZone,
            editState.controlPoints,
            mainArea,
            pixelToCoordinate,
            mapContainerRef,
            onError,
        ]
    );

    // สิ้นสุดการลากจุดควบคุม
    const handleControlPointDragEnd = useCallback(() => {
        if (!editState.isDragging) return;

        setEditState((prevState) => stopDragging(prevState));
    }, [editState.isDragging]);

    // บันทึกการเปลี่ยนแปลง (ปรับปรุงให้มีความปลอดภัยมากขึ้น)
    const applyZoneChanges = useCallback(() => {
        if (!editState.editingZone) return;

        try {
            // 🔧 FIX: ตรวจสอบว่าโซนมี coordinates ที่ถูกต้องหรือไม่
            if (
                !editState.editingZone.coordinates ||
                editState.editingZone.coordinates.length < 3
            ) {
                onError?.('โซนต้องมีพิกัดอย่างน้อย 3 จุด');
                return;
            }

            // 🔧 FIX: ตรวจสอบพิกัดให้ถูกต้อง
            const validCoordinates = editState.editingZone.coordinates.filter(
                (coord) =>
                    coord &&
                    typeof coord.lat === 'number' &&
                    typeof coord.lng === 'number' &&
                    !isNaN(coord.lat) &&
                    !isNaN(coord.lng)
            );

            if (validCoordinates.length < 3) {
                onError?.('โซนมีพิกัดที่ไม่ถูกต้อง');
                return;
            }

            // 🔧 FIX: Validate โซนทับซ้อนกันและ self-intersection
            const validation = validateEditedZone(
                { ...editState.editingZone, coordinates: validCoordinates },
                zones,
                mainArea
            );

            if (!validation.isValid) {
                const errorMessages = validation.errors.slice(0, 3).join('\n');
                onError?.(`ไม่สามารถบันทึกได้:\n${errorMessages}`);
                return;
            }

            if (validation.warnings.length > 0 && validation.warnings.length <= 5) {
                // แสดง warnings แต่ยังให้บันทึกได้
                console.warn('⚠️ Zone edit warnings:', validation.warnings);
            }
            
            // หาต้นไม้ในโซนที่แก้ไขแล้ว
            const newPlants = findPlantsInEditedZone(validCoordinates, allPlants);

            // สร้างโซนที่อัปเดตแล้ว
            const updatedZone = createUpdatedZone(
                editState.editingZone,
                validCoordinates,
                newPlants
            );

            // 🔧 FIX: ตรวจสอบว่าโซนที่อัปเดตแล้วยังคงอยู่ในรายการหรือไม่
            const existingZoneIndex = zones.findIndex((zone) => zone.id === updatedZone.id);
            if (existingZoneIndex === -1) {
                onError?.('ไม่พบโซนที่ต้องการแก้ไข');
                return;
            }

            // 🔧 FIX: ใช้ updateEditedZone เพื่อ reassign ต้นไม้ทั้งหมด
            const updatedZones = updateEditedZone(zones, updatedZone, allPlants);

            onZonesUpdate(updatedZones);
            exitEditMode();
            onSuccess?.(`บันทึกการเปลี่ยนแปลงโซน: ${updatedZone.name}`);
        } catch (error) {
            console.error('❌ Error applying zone changes:', error);
            onError?.('เกิดข้อผิดพลาดในการบันทึกการเปลี่ยนแปลง');
        }
    }, [editState.editingZone, allPlants, zones, mainArea, onZonesUpdate, exitEditMode, onSuccess, onError]);

    // ยกเลิกการเปลี่ยนแปลง
    const cancelZoneChanges = useCallback(() => {
        if (originalZone) {
            // สร้าง deep copy ของ originalZone เพื่อ restore
            const restoredZone = deepCopyZone(originalZone);

            setEditState((prevState) => ({
                ...prevState,
                editingZone: restoredZone,
                controlPoints: createZoneControlPoints(restoredZone),
            }));
        }
        exitEditMode();
    }, [originalZone, exitEditMode]);

    // ลบโซนที่เลือกอยู่
    const deleteSelectedZone = useCallback(() => {
        if (!editState.editingZone) {
            onError?.('กรุณาเลือกโซนก่อนลบ');
            return;
        }

        try {
            const targetId = editState.editingZone.id;
            const zoneExists = zones.some((z) => z.id === targetId);
            if (!zoneExists) {
                onError?.('ไม่พบโซนที่ต้องการลบ');
                return;
            }

            const updatedZones = zones.filter((z) => z.id !== targetId);
            onZonesUpdate(updatedZones);
            exitEditMode();
            onSuccess?.('ลบโซนเรียบร้อย');
        } catch {
            onError?.('เกิดข้อผิดพลาดในการลบโซน');
        }
    }, [editState.editingZone, zones, onZonesUpdate, exitEditMode, onError, onSuccess]);

    return {
        // State
        editState,
        isEditMode: editState.isEditing,
        selectedZone: editState.editingZone,

        // Actions
        toggleEditMode,
        exitEditMode,
        handleZoneClick,
        handleControlPointDragStart,
        handleControlPointDrag,
        handleControlPointDragEnd,
        applyZoneChanges,
        cancelZoneChanges,
        deleteSelectedZone,

        // Helper functions
        pixelToCoordinate,
    };
};
