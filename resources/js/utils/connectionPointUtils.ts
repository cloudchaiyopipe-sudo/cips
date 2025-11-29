/* eslint-disable @typescript-eslint/no-explicit-any */
import { Coordinate } from './horticultureUtils';
import {
    findMainToSubMainConnections,
    findMidConnections,
    findSubMainToMainIntersections,
} from './lateralPipeUtils';

export interface ConnectionPoint {
    id: string;
    type: 'main-to-submain' | 'submain-to-main-mid' | 'submain-to-main-intersection';
    position: Coordinate;
    mainPipeId?: string;
    subMainPipeId?: string;
    color: string;
    title: string;
    zIndex: number;
}

export interface ConnectionPointConfig {
    mainToSubMain: {
        color: string;
        title: string;
        zIndex: number;
    };
    subMainToMainMid: {
        color: string;
        title: string;
        zIndex: number;
    };
    subMainToMainIntersection: {
        color: string;
        title: string;
        zIndex: number;
    };
}

export const CONNECTION_POINT_CONFIG: ConnectionPointConfig = {
    mainToSubMain: {
        color: '#DC2626',
        title: 'จุดเชื่อมต่อท่อเมน → ท่อเมนรอง',
        zIndex: 2001,
    },
    subMainToMainMid: {
        color: '#8B5CF6',
        title: 'จุดเชื่อมท่อเมนรอง → กลางท่อเมน',
        zIndex: 2004,
    },
    subMainToMainIntersection: {
        color: '#3B82F6',
        title: 'จุดตัดท่อเมนรอง ↔ ท่อเมน',
        zIndex: 2003,
    },
};

export const createMainToSubMainConnectionPoints = (
    mainPipes: any[],
    subMainPipes: any[],
    zones?: any[],
    irrigationZones?: any[]
): ConnectionPoint[] => {
    const connectionPoints: ConnectionPoint[] = [];

    const connections = findMainToSubMainConnections(
        mainPipes,
        subMainPipes,
        zones,
        irrigationZones
    );

    connections.forEach((connection) => {
        connectionPoints.push({
            id: `main-submain-${connection.mainPipeId}-${connection.subMainPipeId}`,
            type: 'main-to-submain',
            position: connection.connectionPoint,
            mainPipeId: connection.mainPipeId,
            subMainPipeId: connection.subMainPipeId,
            color: CONNECTION_POINT_CONFIG.mainToSubMain.color,
            title: CONNECTION_POINT_CONFIG.mainToSubMain.title,
            zIndex: CONNECTION_POINT_CONFIG.mainToSubMain.zIndex,
        });
    });

    return connectionPoints;
};

export const createSubMainToMainMidConnectionPoints = (
    subMainPipes: any[],
    mainPipes: any[],
    zones?: any[],
    irrigationZones?: any[],
    snapThreshold: number = 15
): ConnectionPoint[] => {
    // ข้อกำหนด 2: ในโซนเดียวท่อเมนรองต้องเชื่อมกับท่อเมนเพียงจุดเดียวเท่านั้น คือจุดของปลายท่อเมน
    // ดังนั้นไม่ควรสร้าง connection points สำหรับ submain-to-main-mid
    // เพราะห้ามการเชื่อมต่อที่จุดกลาง
    return [];
};

export const createSubMainToMainIntersectionPoints = (
    subMainPipes: any[],
    mainPipes: any[],
    zones?: any[],
    irrigationZones?: any[]
): ConnectionPoint[] => {
    const connectionPoints: ConnectionPoint[] = [];

    const intersections = findSubMainToMainIntersections(
        subMainPipes,
        mainPipes,
        zones,
        irrigationZones
    );

    intersections.forEach((intersection) => {
        connectionPoints.push({
            id: `submain-main-intersection-${intersection.subMainPipeId}-${intersection.mainPipeId}`,
            type: 'submain-to-main-intersection',
            position: intersection.intersectionPoint,
            mainPipeId: intersection.mainPipeId,
            subMainPipeId: intersection.subMainPipeId,
            color: CONNECTION_POINT_CONFIG.subMainToMainIntersection.color,
            title: CONNECTION_POINT_CONFIG.subMainToMainIntersection.title,
            zIndex: CONNECTION_POINT_CONFIG.subMainToMainIntersection.zIndex,
        });
    });

    return connectionPoints;
};

// ฟังก์ชันคำนวณระยะห่างระหว่างสองจุด (ใช้ Haversine formula สำหรับความแม่นยำ)
const calculateDistanceBetweenPoints = (point1: Coordinate, point2: Coordinate): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((point2.lat - point1.lat) * Math.PI) / 180;
    const dLng = ((point2.lng - point1.lng) * Math.PI) / 180;
    const lat1Rad = (point1.lat * Math.PI) / 180;
    const lat2Rad = (point2.lat * Math.PI) / 180;

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1Rad) * Math.cos(lat2Rad) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(Math.max(0, a)), Math.sqrt(Math.max(0, 1 - a)));

    return R * c; // Distance in meters
};

// ฟังก์ชันช่วยตรวจสอบว่าจุดสองจุดอยู่ใกล้กันมากพอที่จะรวมกันหรือไม่
const areConnectionPointsClose = (
    point1: Coordinate,
    point2: Coordinate,
    thresholdMeters: number = 3 // 3 meters threshold
): boolean => {
    const distance = calculateDistanceBetweenPoints(point1, point2);
    return distance <= thresholdMeters;
};

// ฟังก์ชันตรวจสอบว่าจุดเชื่อมต่อซ้ำกันหรือไม่ (ปรับปรุงให้ครอบคลุมมากขึ้น)
const isDuplicateConnectionPoint = (
    newPoint: ConnectionPoint,
    existingPoints: ConnectionPoint[]
): boolean => {
    for (const existing of existingPoints) {
        // ตรวจสอบว่าจุดอยู่ใกล้กันมาก (ภายใน 3 เมตร)
        if (areConnectionPointsClose(existing.position, newPoint.position, 3)) {
            // กรณีที่ 1: เป็นจุดเชื่อมต่อเดียวกัน (มี pipe ID เดียวกัน) ถือว่าซ้ำแน่นอน
            if (
                existing.type === newPoint.type &&
                existing.mainPipeId === newPoint.mainPipeId &&
                existing.subMainPipeId === newPoint.subMainPipeId
            ) {
                return true;
            }

            // กรณีที่ 2: เป็นจุดเดียวกัน (ตำแหน่งใกล้กันมาก - ภายใน 1 เมตร) แม้จะเป็น type ต่างกัน
            // ถือว่าเป็นจุดเดียวกัน ควร merge
            if (areConnectionPointsClose(existing.position, newPoint.position, 1)) {
                return true;
            }

            // กรณีที่ 3: เป็น type เดียวกัน และมี pipe ID บางตัวเหมือนกัน (อาจเป็นจุดเดียวกัน)
            if (
                existing.type === newPoint.type &&
                ((existing.mainPipeId === newPoint.mainPipeId &&
                    existing.mainPipeId !== undefined) ||
                    (existing.subMainPipeId === newPoint.subMainPipeId &&
                        existing.subMainPipeId !== undefined))
            ) {
                return true;
            }
        }
    }
    return false;
};

// ฟังก์ชันหาจุดเชื่อมต่อที่ใกล้ที่สุดเพื่อ merge (ถ้าจำเป็น)
const findNearbyConnectionPointForMerge = (
    newPoint: ConnectionPoint,
    existingPoints: ConnectionPoint[]
): ConnectionPoint | null => {
    for (const existing of existingPoints) {
        // ถ้าจุดอยู่ใกล้กันมาก (ภายใน 1 เมตร) และเป็น type เดียวกัน
        if (
            existing.type === newPoint.type &&
            areConnectionPointsClose(existing.position, newPoint.position, 1)
        ) {
            return existing;
        }
    }
    return null;
};

export const createAllConnectionPoints = (
    mainPipes: any[],
    subMainPipes: any[],
    zones?: any[],
    irrigationZones?: any[],
    snapThreshold: number = 15
): ConnectionPoint[] => {
    const allConnectionPoints: ConnectionPoint[] = [];

    // ตรวจสอบว่ามีข้อมูลท่อหรือไม่
    if (!mainPipes || !subMainPipes || mainPipes.length === 0 || subMainPipes.length === 0) {
        return allConnectionPoints;
    }

    // สร้างจุดเชื่อมต่อแต่ละประเภท
    const mainToSubMainPoints = createMainToSubMainConnectionPoints(
        mainPipes,
        subMainPipes,
        zones,
        irrigationZones
    );
    const subMainToMainMidPoints = createSubMainToMainMidConnectionPoints(
        subMainPipes,
        mainPipes,
        zones,
        irrigationZones,
        snapThreshold
    );
    const subMainToMainIntersectionPoints = createSubMainToMainIntersectionPoints(
        subMainPipes,
        mainPipes,
        zones,
        irrigationZones
    );

    // ฟังก์ชันเพิ่มจุดเชื่อมต่อโดยตรวจสอบว่าซ้ำกันหรือไม่
    const addPointIfNotDuplicate = (point: ConnectionPoint) => {
        // ตรวจสอบว่าจุดมีข้อมูลครบถ้วนหรือไม่
        if (!point.position || !point.type) {
            console.warn('Invalid connection point:', point);
            return;
        }

        // ตรวจสอบว่าจุดซ้ำกันหรือไม่
        if (isDuplicateConnectionPoint(point, allConnectionPoints)) {
            // ถ้าซ้ำ ให้ตรวจสอบว่าควร merge หรือไม่
            const nearbyPoint = findNearbyConnectionPointForMerge(point, allConnectionPoints);
            if (nearbyPoint) {
                // ถ้ามีจุดใกล้เคียงที่ควร merge แต่ไม่ merge ในตอนนี้
                // เพียงแค่ข้ามจุดนี้ไป (ไม่เพิ่ม)
                return;
            }
            // ถ้าไม่ควร merge แต่ซ้ำ ให้ข้ามไป
            return;
        }

        // เพิ่มจุดใหม่
        allConnectionPoints.push(point);
    };

    // เพิ่มจุดเชื่อมต่อตามลำดับความสำคัญ
    // 1. Main to SubMain (สำคัญที่สุด)
    mainToSubMainPoints.forEach(addPointIfNotDuplicate);

    // 2. SubMain to Main Intersection
    subMainToMainIntersectionPoints.forEach(addPointIfNotDuplicate);

    // 3. SubMain to Main Mid (ถ้ามี)
    subMainToMainMidPoints.forEach(addPointIfNotDuplicate);

    // ตรวจสอบและลบจุดที่ซ้ำกันซ้ำอีกครั้ง (เพื่อความแน่ใจ)
    const finalPoints: ConnectionPoint[] = [];
    const seenPositions = new Map<string, ConnectionPoint>();

    for (const point of allConnectionPoints) {
        const positionKey = `${point.position.lat.toFixed(6)}_${point.position.lng.toFixed(6)}`;
        const existingPoint = seenPositions.get(positionKey);

        if (existingPoint) {
            // ถ้ามีจุดอยู่ที่ตำแหน่งเดียวกัน ให้ตรวจสอบว่าควรเก็บจุดไหน
            // เก็บจุดที่มี type สำคัญกว่า (main-to-submain > submain-to-main-intersection > submain-to-main-mid)
            const typePriority: Record<string, number> = {
                'main-to-submain': 3,
                'submain-to-main-intersection': 2,
                'submain-to-main-mid': 1,
            };

            const existingPriority = typePriority[existingPoint.type] || 0;
            const newPriority = typePriority[point.type] || 0;

            if (newPriority > existingPriority) {
                // แทนที่จุดเดิมด้วยจุดใหม่ที่มีความสำคัญมากกว่า
                const index = finalPoints.findIndex((p) => p.id === existingPoint.id);
                if (index !== -1) {
                    finalPoints[index] = point;
                    seenPositions.set(positionKey, point);
                }
            }
            // ถ้า priority ไม่มากกว่า ให้ข้ามจุดนี้ไป
        } else {
            // เพิ่มจุดใหม่
            finalPoints.push(point);
            seenPositions.set(positionKey, point);
        }
    }

    return finalPoints;
};

export const createConnectionPointMarker = (
    connectionPoint: ConnectionPoint,
    map: google.maps.Map
): google.maps.Marker => {
    return new google.maps.Marker({
        position: new google.maps.LatLng(
            connectionPoint.position.lat,
            connectionPoint.position.lng
        ),
        map: map,
        icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 4,
            fillColor: connectionPoint.color,
            fillOpacity: 1.0,
            strokeColor: '#FFFFFF',
            strokeWeight: 2,
        },
        zIndex: connectionPoint.zIndex,
        title: connectionPoint.title,
    });
};

export const createConnectionPointInfoWindow = (
    connectionPoint: ConnectionPoint
): google.maps.InfoWindow => {
    let content = `
        <div class="p-2 min-w-[200px]">
            <h4 class="font-bold text-gray-800 mb-2">🔗 ${connectionPoint.title}</h4>
            <div class="space-y-1 text-sm">
    `;

    if (connectionPoint.mainPipeId) {
        content += `<p><strong>ท่อเมน:</strong> ${connectionPoint.mainPipeId}</p>`;
    }

    if (connectionPoint.subMainPipeId) {
        content += `<p><strong>ท่อเมนรอง:</strong> ${connectionPoint.subMainPipeId}</p>`;
    }

    content += `
            </div>
        </div>
    `;

    return new google.maps.InfoWindow({
        content: content,
    });
};

export const displayConnectionPointsOnMap = (
    connectionPoints: ConnectionPoint[],
    map: google.maps.Map,
    overlaysRef: React.MutableRefObject<{
        markers: Map<string, google.maps.Marker>;
        polylines: Map<string, google.maps.Polyline>;
        infoWindows: Map<string, google.maps.InfoWindow>;
    }>
): void => {
    // ลบ marker เก่าทั้งหมดก่อนสร้างใหม่
    overlaysRef.current.markers.forEach((marker) => {
        marker.setMap(null);
    });
    overlaysRef.current.markers.clear();

    overlaysRef.current.infoWindows.forEach((infoWindow) => {
        infoWindow.close();
    });
    overlaysRef.current.infoWindows.clear();

    // สร้าง marker ใหม่
    connectionPoints.forEach((connectionPoint) => {
        // ตรวจสอบว่ามี marker อยู่แล้วหรือไม่ (ป้องกันการสร้างซ้ำ)
        if (overlaysRef.current.markers.has(connectionPoint.id)) {
            return;
        }

        const marker = createConnectionPointMarker(connectionPoint, map);
        const infoWindow = createConnectionPointInfoWindow(connectionPoint);

        marker.addListener('click', () => {
            infoWindow.open(map, marker);
        });

        overlaysRef.current.markers.set(connectionPoint.id, marker);
        overlaysRef.current.infoWindows.set(connectionPoint.id, infoWindow);
    });
};

export const clearConnectionPointsFromMap = (
    overlaysRef: React.MutableRefObject<{
        markers: Map<string, google.maps.Marker>;
        polylines: Map<string, google.maps.Polyline>;
        infoWindows: Map<string, google.maps.InfoWindow>;
    }>
): void => {
    overlaysRef.current.markers.forEach((marker) => {
        marker.setMap(null);
    });
    overlaysRef.current.markers.clear();

    overlaysRef.current.infoWindows.forEach((infoWindow) => {
        infoWindow.close();
    });
    overlaysRef.current.infoWindows.clear();
};

export const countConnectionPointsByType = (
    connectionPoints: ConnectionPoint[]
): {
    mainToSubMain: number;
    subMainToMainMid: number;
    subMainToMainIntersection: number;
    total: number;
} => {
    const counts = {
        mainToSubMain: 0,
        subMainToMainMid: 0,
        subMainToMainIntersection: 0,
        total: 0,
    };

    connectionPoints.forEach((point) => {
        switch (point.type) {
            case 'main-to-submain':
                counts.mainToSubMain++;
                break;
            case 'submain-to-main-mid':
                counts.subMainToMainMid++;
                break;
            case 'submain-to-main-intersection':
                counts.subMainToMainIntersection++;
                break;
        }
    });

    counts.total =
        counts.mainToSubMain + counts.subMainToMainMid + counts.subMainToMainIntersection;

    return counts;
};
