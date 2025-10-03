import React, { useState, useEffect, useRef, useCallback } from 'react';

interface LocalCoordinate {
    lat: number;
    lng: number;
}

interface LocalPlantLocation {
    id: string;
    position: LocalCoordinate;
    plantData: {
        id: number;
        name: string;
        plantSpacing: number;
        rowSpacing: number;
        waterNeed: number;
    };
}

interface LocalLateralPipe {
    id: string;
    coordinates: LocalCoordinate[];
    length: number;
    plants: LocalPlantLocation[];
    placementMode: 'over_plants' | 'between_plants';
    totalFlowRate: number;
    connectionPoint: LocalCoordinate;
    intersectionData?: {
        subMainPipeId: string;
        point: LocalCoordinate;
        segmentIndex: number;
    };
    emitterLines?: {
        id: string;
        lateralPipeId: string;
        plantId: string;
        coordinates: LocalCoordinate[];
        length: number;
        diameter: number;
        emitterType?: string;
    }[];
}

interface LocalEmitterLine {
    id: string;
    lateralPipeId: string;
    plantId: string;
    coordinates: LocalCoordinate[];
    length: number;
    diameter: number;
    emitterType?: string;
}
import { router } from '@inertiajs/react';
import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import { useLanguage } from '../contexts/LanguageContext';
import HorticultureMapComponent from '../components/horticulture/HorticultureMapComponent';
import SprinklerConfigModal from '../components/horticulture/SprinklerConfigModal';

import {
    ProjectSummaryData,
    calculateProjectSummary,
    formatAreaInRai,
    formatDistance,
    formatWaterVolume,
    loadProjectData,
    navigateToPlanner,
    EnhancedProjectData,
    IrrigationZoneExtended,
    SprinklerConfig,
    EXCLUSION_COLORS,
    getZoneColor,
    getExclusionTypeName,
    getPolygonCenter,
} from '../utils/horticultureUtils';

import {
    findMainToSubMainConnections,
    findEndToEndConnections,
    findMidConnections,
    findSubMainToLateralStartConnections,
    findSubMainToMainIntersections,
    findLateralToSubMainIntersections,
} from '../utils/lateralPipeUtils';

import {
    getOverallStats,
    countConnectionPointsByZone,
    findBestMainPipeInZone,
    findBestSubMainPipeInZone,
    findBestBranchPipeInZone,
    findPipeZoneImproved,
} from '../utils/horticultureProjectStats';

// Helper function to calculate distance between two coordinates
const calculateDistance = (
    coord1: { lat: number; lng: number },
    coord2: { lat: number; lng: number }
): number => {
    const R = 6371000; // Earth's radius in meters
    const dLat = ((coord2.lat - coord1.lat) * Math.PI) / 180;
    const dLng = ((coord2.lng - coord1.lng) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((coord1.lat * Math.PI) / 180) *
            Math.cos((coord2.lat * Math.PI) / 180) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

// Helper function to calculate total pipe length from coordinates
const calculatePipeLength = (coordinates: { lat: number; lng: number }[]): number => {
    if (!coordinates || coordinates.length < 2) return 0;

    let totalLength = 0;
    for (let i = 1; i < coordinates.length; i++) {
        totalLength += calculateDistance(coordinates[i - 1], coordinates[i]);
    }
    return totalLength;
};

import { loadSprinklerConfig, calculateTotalFlowRate } from '../utils/sprinklerUtils';

const createAreaTextOverlay = (
    map: google.maps.Map,
    coordinates: LocalCoordinate[],
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
            this.div.style.opacity = '0.6';
            this.div.style.whiteSpace = 'wrap';
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

const GoogleMapsResultsOverlays: React.FC<{
    map: google.maps.Map | null;
    projectData: EnhancedProjectData;
    mapRotation: number;
    pipeSize: number;
    iconSize: number;
    irrigationZones: IrrigationZoneExtended[];
    lateralPipes: LocalLateralPipe[];
    t: (key: string) => string;
}> = ({ map, projectData, mapRotation, pipeSize, iconSize, irrigationZones, lateralPipes, t }) => {
    const overlaysRef = useRef<{
        polygons: Map<string, google.maps.Polygon>;
        polylines: Map<string, google.maps.Polyline>;
        markers: Map<string, google.maps.Marker>;
        overlays: Map<string, google.maps.OverlayView>;
    }>({
        polygons: new Map(),
        polylines: new Map(),
        markers: new Map(),
        overlays: new Map(),
    });

    const clearOverlays = useCallback(() => {
        overlaysRef.current.polygons.forEach((polygon) => polygon.setMap(null));
        overlaysRef.current.polylines.forEach((polyline) => polyline.setMap(null));
        overlaysRef.current.markers.forEach((marker) => marker.setMap(null));
        overlaysRef.current.overlays.forEach((overlay) => overlay.setMap(null));

        overlaysRef.current.polygons.clear();
        overlaysRef.current.polylines.clear();
        overlaysRef.current.markers.clear();
        overlaysRef.current.overlays.clear();
    }, []);

    useEffect(() => {
        if (map) {
            const mapDiv = map.getDiv();
            if (mapDiv) {
                mapDiv.style.transform = `rotate(${mapRotation}deg)`;
                mapDiv.style.transformOrigin = 'center center';
            }
        }
    }, [map, mapRotation]);

    useEffect(() => {
        if (!map || !projectData) return;
        clearOverlays();

        if (projectData.mainArea && projectData.mainArea.length > 0) {
            const mainAreaPolygon = new google.maps.Polygon({
                paths: projectData.mainArea.map((coord) => ({ lat: coord.lat, lng: coord.lng })),
                fillColor: '#22C55E',
                fillOpacity: 0.1,
                strokeColor: '#22C55E',
                strokeWeight: 3, // ใช้ขนาดเดียวกับหน้า Planner
                clickable: true,
            });
            mainAreaPolygon.setMap(map);
            overlaysRef.current.polygons.set('main-area', mainAreaPolygon);
        }

        projectData.exclusionAreas?.forEach((area) => {
            const exclusionColor =
                EXCLUSION_COLORS[area.type as keyof typeof EXCLUSION_COLORS] ||
                EXCLUSION_COLORS.other;
            const exclusionPolygon = new google.maps.Polygon({
                paths: area.coordinates.map((coord) => ({ lat: coord.lat, lng: coord.lng })),
                fillColor: exclusionColor,
                fillOpacity: 0.4,
                strokeColor: exclusionColor,
                strokeWeight: 2, // ใช้ขนาดเดียวกับหน้า Planner
                clickable: true,
            });
            exclusionPolygon.setMap(map);
            overlaysRef.current.polygons.set(area.id, exclusionPolygon);

            const exclusionLabel = createAreaTextOverlay(
                map,
                area.coordinates,
                getExclusionTypeName(area.type, t),
                exclusionColor
            );
            overlaysRef.current.overlays.set(`exclusion-label-${area.id}`, exclusionLabel);
        });

        projectData.zones?.forEach((zone, index) => {
            const zoneColor = getZoneColor(index);
            const zonePolygon = new google.maps.Polygon({
                paths: zone.coordinates.map((coord) => ({ lat: coord.lat, lng: coord.lng })),
                fillColor: zoneColor,
                fillOpacity: 0.3,
                strokeColor: zoneColor,
                strokeWeight: 2, // ใช้ขนาดเดียวกับหน้า Planner
                clickable: true,
                zIndex: 50, // ใช้ z-index เดียวกับหน้า Planner
            });
            zonePolygon.setMap(map);
            overlaysRef.current.polygons.set(zone.id, zonePolygon);

            const zoneLabel = createAreaTextOverlay(
                map,
                zone.coordinates,
                `${t('โซน')} ${index + 1}`,
                zoneColor
            );
            overlaysRef.current.overlays.set(`zone-label-${zone.id}`, zoneLabel);
        });

        if (projectData.pump) {
            const pumpMarker = new google.maps.Marker({
                position: {
                    lat: projectData.pump.position.lat,
                    lng: projectData.pump.position.lng,
                },
                map: map,
                icon: {
                    url: '/images/water-pump.png',
                    scaledSize: new google.maps.Size(32, 32), // ใช้ขนาดเดียวกับหน้า Planner
                    anchor: new google.maps.Point(16, 16),
                },
                title: 'ปั๊มน้ำ',
            });
            overlaysRef.current.markers.set('pump', pumpMarker);
        }

        projectData.mainPipes?.forEach((pipe) => {
            const mainPipePolyline = new google.maps.Polyline({
                path: pipe.coordinates.map((coord) => ({ lat: coord.lat, lng: coord.lng })),
                strokeColor: '#FF0000',
                strokeWeight: 5 * pipeSize, // ใช้ขนาดเดียวกับหน้า Planner
                strokeOpacity: 0.9,
            });
            mainPipePolyline.setMap(map);
            overlaysRef.current.polylines.set(pipe.id, mainPipePolyline);
        });

        projectData.subMainPipes?.forEach((subMainPipe) => {
            const subMainPolyline = new google.maps.Polyline({
                path: subMainPipe.coordinates.map((coord) => ({ lat: coord.lat, lng: coord.lng })),
                strokeColor: '#8B5CF6',
                strokeWeight: 2 * pipeSize, // ใช้ขนาดเดียวกับหน้า Planner
                strokeOpacity: 0.9,
            });
            subMainPolyline.setMap(map);
            overlaysRef.current.polylines.set(subMainPipe.id, subMainPolyline);

            subMainPipe.branchPipes?.forEach((branchPipe) => {
                const branchPolyline = new google.maps.Polyline({
                    path: branchPipe.coordinates.map((coord) => ({
                        lat: coord.lat,
                        lng: coord.lng,
                    })),
                    strokeColor: '#FFD700',
                    strokeWeight: 2 * pipeSize,
                    strokeOpacity: 0.8,
                });
                branchPolyline.setMap(map);
                overlaysRef.current.polylines.set(branchPipe.id, branchPolyline);
            });
        });

        // Enhanced irrigation zones display
        irrigationZones?.forEach((zone) => {
            const irrigationZonePolygon = new google.maps.Polygon({
                paths: zone.coordinates.map((coord) => ({ lat: coord.lat, lng: coord.lng })),
                fillColor: zone.color,
                fillOpacity: 0.3, // ใช้ความเข้มเดียวกับหน้า Planner
                strokeColor: zone.color,
                strokeWeight: 2, // ใช้ขนาดเดียวกับหน้า Planner
                clickable: true,
                zIndex: 50, // ใช้ z-index เดียวกับหน้า Planner
            });
            irrigationZonePolygon.setMap(map);
            overlaysRef.current.polygons.set(`irrigation-zone-${zone.id}`, irrigationZonePolygon);

            const irrigationZoneLabel = createAreaTextOverlay(
                map,
                zone.coordinates,
                `${zone.name} (${zone.plants.length} ต้น)`,
                zone.color
            );
            overlaysRef.current.overlays.set(
                `irrigation-zone-label-${zone.id}`,
                irrigationZoneLabel
            );
        });

        // Lateral pipes display
        lateralPipes?.forEach((lateralPipe) => {
            const lateralPolyline = new google.maps.Polyline({
                path: lateralPipe.coordinates.map((coord) => ({ lat: coord.lat, lng: coord.lng })),
                strokeColor: '#FFD700', // ใช้สีทองเดียวกับหน้า Planner
                strokeWeight: 2 * pipeSize,
                strokeOpacity: 0.9,
            });
            lateralPolyline.setMap(map);
            overlaysRef.current.polylines.set(`lateral-${lateralPipe.id}`, lateralPolyline);

            // 🚀 แสดงจุดเชื่อมต่อถ้ามี intersection data เหมือนหน้า Planner
            if (lateralPipe.intersectionData && lateralPipe.intersectionData.point) {
                // 🔥 เช็คโซนของท่อย่อย
                const lateralZone = findPipeZoneImproved(
                    lateralPipe,
                    projectData.zones || [],
                    irrigationZones
                );

                // 🔥 หาท่อเมนรองที่เชื่อมด้วย
                const connectedSubMain = projectData.subMainPipes?.find(
                    (pipe) => pipe.id === lateralPipe.intersectionData?.subMainPipeId
                );
                const subMainZone = connectedSubMain
                    ? findPipeZoneImproved(
                          connectedSubMain,
                          projectData.zones || [],
                          irrigationZones
                      )
                    : null;

                // 🚨 แสดงจุดเชื่อมเฉพาะเมื่ออยู่ในโซนเดียวกันเท่านั้น (เข้มงวดขึ้น)
                if (
                    lateralZone &&
                    subMainZone &&
                    lateralZone === subMainZone &&
                    lateralZone !== 'main-area'
                ) {
                    const connectionMarker = new google.maps.Marker({
                        position: new google.maps.LatLng(
                            lateralPipe.intersectionData.point.lat,
                            lateralPipe.intersectionData.point.lng
                        ),
                        map: map,
                        icon: {
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 3, // ปรับให้เท่ากับจุดเชื่อมต่ออื่นๆ
                            fillColor: '#FF6B6B',
                            fillOpacity: 1.0,
                            strokeColor: '#FFFFFF',
                            strokeWeight: 2, // ลดจาก 3 เป็น 2
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
                                    <p><strong>ท่อเส้นรวม:</strong> ${(lateralPipe.length || 0).toFixed(1)} ม.</p>
                                    <p><strong>ต้นไม้ทั้งหมด:</strong> ${lateralPipe.plants?.length || 0} ต้น</p>
                                    <p><strong>น้ำรวม:</strong> ${(lateralPipe.totalFlowRate || 0).toFixed(1)} ลิตร/นาที</p>
                                    <hr class="my-2">
                                    <p><strong>ท่อเมนรอง:</strong> ${lateralPipe.intersectionData.subMainPipeId}</p>
                                    <p><strong>ตำแหน่ง:</strong> ${lateralPipe.intersectionData.point.lat.toFixed(6)}, ${lateralPipe.intersectionData.point.lng.toFixed(6)}</p>
                                </div>
                            </div>
                        `,
                    });

                    connectionMarker.addListener('click', () => {
                        infoWindow.open(map, connectionMarker);
                    });
                }
            }

            // Display emitter lines (ท่อย่อยแยก) for this lateral pipe
            if (lateralPipe.emitterLines && lateralPipe.emitterLines.length > 0) {
                lateralPipe.emitterLines.forEach((emitterLine) => {
                    const emitterPolyline = new google.maps.Polyline({
                        path: emitterLine.coordinates.map((coord) => ({
                            lat: coord.lat,
                            lng: coord.lng,
                        })),
                        strokeColor: '#FFB347', // ใช้สีเดียวกับหน้า Planner
                        strokeWeight: 2 * pipeSize, // ใช้ขนาดเดียวกับหน้า Planner
                        strokeOpacity: 0.8, // ใช้ความชัดเดียวกับหน้า Planner
                    });
                    emitterPolyline.setMap(map);
                    overlaysRef.current.polylines.set(`emitter-${emitterLine.id}`, emitterPolyline);

                    // Add small marker at plant connection point
                    if (emitterLine.coordinates.length > 1) {
                        const plantConnectionPoint =
                            emitterLine.coordinates[emitterLine.coordinates.length - 1];
                        const emitterMarker = new google.maps.Marker({
                            position: plantConnectionPoint,
                            map: map,
                            icon: {
                                path: google.maps.SymbolPath.CIRCLE,
                                scale: 3, // ปรับให้เท่ากับจุดเชื่อมต่ออื่นๆ
                                fillColor: '#FFB347',
                                fillOpacity: 1,
                                strokeColor: '#ffffff',
                                strokeWeight: 1,
                            },
                            title: `Emitter to Plant (${emitterLine.length.toFixed(1)}m)`,
                        });
                        overlaysRef.current.markers.set(
                            `emitter-connection-${emitterLine.id}`,
                            emitterMarker
                        );
                    }
                });
            }
        });

        // 🔥 แสดงจุดเชื่อมต่อปลาย-ปลาย (End-to-End) - สีแดง
        if (projectData.mainPipes && projectData.subMainPipes) {
            const endToEndConnections = findEndToEndConnections(
                projectData.mainPipes,
                projectData.subMainPipes,
                projectData.zones,
                irrigationZones,
                15 // snapThreshold
            );

            endToEndConnections.forEach((connection, index) => {
                const connectionMarker = new google.maps.Marker({
                    position: new google.maps.LatLng(
                        connection.connectionPoint.lat,
                        connection.connectionPoint.lng
                    ),
                    map: map,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 4, // เพิ่มขนาดให้เห็นชัดขึ้น
                        fillColor: '#DC2626', // สีแดงสำหรับปลาย-ปลาย
                        fillOpacity: 1.0,
                        strokeColor: '#FFFFFF',
                        strokeWeight: 2, // เพิ่มความหนาของขอบ
                    },
                    zIndex: 2001,
                    title: `จุดเชื่อมต่อปลาย-ปลาย (ท่อเมน ↔ ท่อเมนรอง)`,
                });
                overlaysRef.current.markers.set(`end-to-end-connection-${index}`, connectionMarker);

                // เพิ่ม info window
                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div class="p-2 min-w-[200px]">
                            <h4 class="font-bold text-gray-800 mb-2">🔗 จุดเชื่อมต่อปลาย-ปลาย</h4>
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

            // 🔥 แสดงจุดเชื่อมต่อปลายท่อเมนกับระหว่างท่อเมนรอง - สีน้ำเงิน
            const mainToSubMainConnections = findMainToSubMainConnections(
                projectData.mainPipes,
                projectData.subMainPipes,
                projectData.zones,
                irrigationZones,
                15 // snapThreshold
            );

            mainToSubMainConnections.forEach((connection, index) => {
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
                    `main-submain-end-connection-${index}`,
                    connectionMarker
                );

                // เพิ่ม info window
                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div class="p-2 min-w-[200px]">
                            <h4 class="font-bold text-gray-800 mb-2">🔗 จุดเชื่อมต่อปลาย-ปลาย</h4>
                            <div class="space-y-1 text-sm">
                                <p><strong>ท่อเมน:</strong> ${connection.mainPipeId}</p>
                                <p><strong>ท่อเมนรอง:</strong> ${connection.subMainPipeId}</p>
                                <p class="text-xs text-gray-600">เชื่อมปลายท่อเมน → เริ่มท่อเมนรอง</p>
                            </div>
                        </div>
                    `,
                });

                connectionMarker.addListener('click', () => {
                    infoWindow.open(map, connectionMarker);
                });
            });
        }

        // 🔥 แสดงจุดเชื่อมต่อแบบ Mid-connections (ท่อเมนรองเชื่อมกลางท่อเมน) - แสดงทุกกรณี
        if (projectData.subMainPipes && projectData.mainPipes) {
            const midConnections = findMidConnections(
                projectData.subMainPipes,
                projectData.mainPipes,
                20, // snapThreshold
                projectData.zones,
                irrigationZones
            );

            midConnections.forEach((connection, index) => {
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
                    `submain-mainmid-connection-${index}`,
                    midConnectionMarker
                );

                // เพิ่ม info window
                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div class="p-2 min-w-[200px]">
                            <h4 class="font-bold text-gray-800 mb-2">🔗 จุดเชื่อมกลางท่อ</h4>
                            <div class="space-y-1 text-sm">
                                <p><strong>ท่อเมนรอง:</strong> ${connection.sourcePipeId}</p>
                                <p><strong>ท่อเมน:</strong> ${connection.targetPipeId}</p>
                                <p class="text-xs text-gray-600">เชื่อมกับตรงกลางท่อเมน</p>
                            </div>
                        </div>
                    `,
                });

                midConnectionMarker.addListener('click', () => {
                    infoWindow.open(map, midConnectionMarker);
                });
            });
        }

        // 🔥 แสดงจุดเชื่อมต่อระหว่างท่อเมนรองและท่อย่อย - แสดงทุกกรณี
        if (projectData.subMainPipes && lateralPipes) {
            const subMainToLateralConnections = findSubMainToLateralStartConnections(
                projectData.subMainPipes,
                lateralPipes,
                projectData.zones,
                irrigationZones,
                20 // snapThreshold
            );

            subMainToLateralConnections.forEach((connection, index) => {
                const connectionMarker = new google.maps.Marker({
                    position: new google.maps.LatLng(
                        connection.connectionPoint.lat,
                        connection.connectionPoint.lng
                    ),
                    map: map,
                    icon: {
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 3, // ลดขนาดจาก 4 เป็น 3
                        fillColor: '#F59E0B', // สีเหลืองสำหรับการเชื่อมท่อเมนรอง → ท่อย่อย
                        fillOpacity: 1.0,
                        strokeColor: '#FFFFFF',
                        strokeWeight: 1.5, // ลดความหนาของขอบ
                    },
                    zIndex: 2002,
                    title: `จุดเชื่อมต่อท่อเมนรอง → ท่อย่อย`,
                });
                overlaysRef.current.markers.set(
                    `submain-lateral-connection-${index}`,
                    connectionMarker
                );

                // เพิ่ม info window
                const infoWindow = new google.maps.InfoWindow({
                    content: `
                        <div class="p-2 min-w-[200px]">
                            <h4 class="font-bold text-gray-800 mb-2">🔗 จุดเชื่อมต่อท่อเมนรอง → ท่อย่อย</h4>
                            <div class="space-y-1 text-sm">
                                <p><strong>ท่อเมนรอง:</strong> ${connection.subMainPipeId}</p>
                                <p><strong>ท่อย่อย:</strong> ${connection.lateralPipeId}</p>
                                <p class="text-xs text-gray-600">เชื่อมท่อเมนรองกับท่อย่อย</p>
                            </div>
                        </div>
                    `,
                });

                connectionMarker.addListener('click', () => {
                    infoWindow.open(map, connectionMarker);
                });
            });
        }

        // 🔥 แสดงจุดตัดระหว่างท่อเมนรองกับท่อเมน (ท่อเมนรองลากผ่านท่อเมน) - แสดงทุกกรณี
        if (projectData.subMainPipes && projectData.mainPipes) {
            const subMainToMainIntersections = findSubMainToMainIntersections(
                projectData.subMainPipes,
                projectData.mainPipes,
                projectData.zones,
                irrigationZones
            );

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
                    `submain-main-intersection-${index}`,
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
        }

        // 🔥 เพิ่มการแสดงจุดตัดระหว่างท่อย่อยกับท่อเมนรอง (เมื่อท่อย่อยลากผ่านท่อเมนรอง)
        if (lateralPipes && projectData.subMainPipes) {
            const lateralToSubMainIntersections = findLateralToSubMainIntersections(
                lateralPipes,
                projectData.subMainPipes,
                projectData.zones,
                irrigationZones,
                20 // snapThreshold
            );

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
                    `lateral-submain-intersection-${index}`,
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
        }

        projectData.plants?.forEach((plant) => {
            // ใช้การแสดงผลต้นไม้เหมือนกับหน้า Planner
            // let plantColor = '#22C55E';
            const plantSymbol = '🌳';

            if (plant.zoneId && irrigationZones.length > 0) {
                // const zone = irrigationZones.find((z) => z.id === plant.zoneId);
                // if (zone) {
                //     plantColor = zone.color;
                // }
            }

            const plantMarker = new google.maps.Marker({
                position: { lat: plant.position.lat, lng: plant.position.lng },
                map: map,
                icon: {
                    url:
                        'data:image/svg+xml;charset=UTF-8,' +
                        encodeURIComponent(`
                        <svg width="28" height="28" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
                            <text x="14" y="14" text-anchor="middle" dominant-baseline="central" fill="white" font-size="10" font-weight="bold">${plantSymbol}</text>
                        </svg>
                    `),
                    scaledSize: new google.maps.Size(28, 28), // ใช้ขนาดเดียวกับหน้า Planner
                    anchor: new google.maps.Point(14, 14),
                },
                zIndex: 500, // ใช้ z-index เดียวกับหน้า Planner
                title: `${plant.plantData.name} (${plant.id})`,
            });
            overlaysRef.current.markers.set(plant.id, plantMarker);
        });

        const bounds = new google.maps.LatLngBounds();
        projectData.mainArea.forEach((coord) => {
            bounds.extend(new google.maps.LatLng(coord.lat, coord.lng));
        });

        map.fitBounds(bounds, { top: 50, right: 50, bottom: 50, left: 50 });
    }, [map, projectData, pipeSize, iconSize, irrigationZones, lateralPipes, clearOverlays, t]);

    useEffect(() => {
        return () => {
            clearOverlays();
        };
    }, [clearOverlays]);

    return null;
};

// 🔥 Enhanced Pipe Analysis Utilities

// ฟังก์ชันสร้าง emitterLines สำหรับ lateral pipes ที่มีอยู่แล้ว
// 🔧 แก้ไขให้สร้างเฉพาะ placementMode: 'between_plants' เท่านั้น
const generateEmitterLinesForExistingPipes = (
    lateralPipe: LocalLateralPipe
): LocalEmitterLine[] => {
    // ⚠️ สร้างเฉพาะโหมด 'between_plants' เท่านั้น
    if (
        !lateralPipe.plants ||
        lateralPipe.plants.length === 0 ||
        lateralPipe.placementMode !== 'between_plants'
    ) {
        return [];
    }

    const emitterLines: LocalEmitterLine[] = [];

    lateralPipe.plants.forEach((plant: LocalPlantLocation, index: number) => {
        // หาจุดที่ใกล้ที่สุดบนท่อย่อยสำหรับแต่ละต้นไม้
        const closestPointOnLateral = findClosestPointOnLineSegment(
            plant.position,
            lateralPipe.coordinates[0],
            lateralPipe.coordinates[lateralPipe.coordinates.length - 1]
        );

        // คำนวณระยะห่าง
        const distance =
            Math.sqrt(
                Math.pow(closestPointOnLateral.lat - plant.position.lat, 2) +
                    Math.pow(closestPointOnLateral.lng - plant.position.lng, 2)
            ) * 111320; // แปลงเป็นเมตร

        // สร้างเฉพาะกับต้นไม้ที่อยู่ใกล้ท่อย่อย (ไม่เกิน 15 เมตร)
        if (distance <= 15) {
            const emitterLine = {
                id: `emitter_${lateralPipe.id}_${index}`,
                lateralPipeId: lateralPipe.id,
                plantId: plant.id,
                coordinates: [closestPointOnLateral, plant.position],
                length: distance,
                diameter: 4,
                emitterType: 'drip',
            };

            emitterLines.push(emitterLine);
        }
    });

    return emitterLines;
};

// ฟังก์ชันหาจุดที่ใกล้ที่สุดบนเส้นตรง (คัดลอกมาจาก lateralPipeUtils.ts)
const findClosestPointOnLineSegment = (
    point: { lat: number; lng: number },
    lineStart: { lat: number; lng: number },
    lineEnd: { lat: number; lng: number }
): { lat: number; lng: number } => {
    const A = point.lat - lineStart.lat;
    const B = point.lng - lineStart.lng;
    const C = lineEnd.lat - lineStart.lat;
    const D = lineEnd.lng - lineStart.lng;

    const dot = A * C + B * D;
    const lenSq = C * C + D * D;
    let param = -1;
    if (lenSq !== 0) {
        param = dot / lenSq;
    }

    let xx, yy;
    if (param < 0) {
        xx = lineStart.lat;
        yy = lineStart.lng;
    } else if (param > 1) {
        xx = lineEnd.lat;
        yy = lineEnd.lng;
    } else {
        xx = lineStart.lat + param * C;
        yy = lineStart.lng + param * D;
    }

    return { lat: xx, lng: yy };
};

function EnhancedHorticultureResultsPageContent() {
    // const page = usePage();
    // const auth = (page.props as { auth: { user: { id: number; name: string; email: string } } }).auth;
    const { t } = useLanguage();
    const [projectData, setProjectData] = useState<EnhancedProjectData | null>(null);
    const [projectSummary, setProjectSummary] = useState<ProjectSummaryData | null>(null);
    const [loading, setLoading] = useState(true);
    const [mapLoaded, setMapLoaded] = useState(false);
    const [mapCenter, setMapCenter] = useState<[number, number]>([13.75, 100.5]);
    const [mapZoom, setMapZoom] = useState<number>(16);

    const [mapRotation, setMapRotation] = useState<number>(0);
    const [isMapLocked, setIsMapLocked] = useState<boolean>(true);
    const [pipeSize, setPipeSize] = useState<number>(1);
    const [iconSize, setIconSize] = useState<number>(1);

    const [isCreatingImage, setIsCreatingImage] = useState(false);

    // Enhanced features states
    // const [showHeadLossModal, setShowHeadLossModal] = useState(false);
    const [showSprinklerConfigModal, setShowSprinklerConfigModal] = useState(false);
    // const [selectedPipeForHeadLoss, setSelectedPipeForHeadLoss] = useState<{
    //     pipeId: string;
    //     pipeType: 'mainPipe' | 'subMainPipe' | 'branchPipe';
    //     zoneName: string;
    //     zoneId: string;
    //     length: number;
    //     pipeName?: string;
    // } | null>(null);

    // const [headLossResults, setHeadLossResults] = useState<HeadLossResult[]>([]);
    const [sprinklerConfig, setSprinklerConfig] = useState<SprinklerConfig | null>(null);
    const [irrigationZones, setIrrigationZones] = useState<IrrigationZoneExtended[]>([]);
    const [lateralPipes, setLateralPipes] = useState<LocalLateralPipe[]>([]);
    const [enhancedStats, setEnhancedStats] = useState<{
        totalAreaInRai: number;
        totalZones: number;
        totalPlants: number;
        totalWaterNeedPerSession: number;
        longestPipesCombined: number;
        sprinklerFlowRate?: {
            totalFlowRatePerMinute: number;
            totalFlowRatePerHour: number;
            formattedFlowRatePerMinute: string;
            formattedFlowRatePerHour: string;
            flowRatePerPlant: number;
            pressureBar: number;
            radiusMeters: number;
        };
    } | null>(null);
    const [collapsedZones, setCollapsedZones] = useState<Set<string>>(new Set());

    const mapRef = useRef<google.maps.Map | null>(null);
    const mapContainerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        try {
            const data = loadProjectData();
            if (data) {
                // Enhanced data loading - โหลด lateral pipes จากข้อมูลที่บันทึกไว้

                // 🔍 Debug localStorage data
                const rawProjectData = localStorage.getItem('currentHorticultureProject');
                if (rawProjectData) {
                    // const parsedData = JSON.parse(rawProjectData);
                }

                let allLateralPipes: LocalLateralPipe[] = [];

                // 1. ลองโหลด lateralPipes ที่บันทึกไว้ก่อน (วิธีใหม่)
                if (data.lateralPipes && data.lateralPipes.length > 0) {
                    allLateralPipes = data.lateralPipes.map((lateralPipe) => ({
                        id: lateralPipe.id,
                        coordinates: lateralPipe.coordinates || [],
                        length:
                            lateralPipe.length ||
                            calculatePipeLength(lateralPipe.coordinates || []),
                        plants: lateralPipe.plants || [],
                        placementMode: lateralPipe.placementMode || 'over_plants',
                        totalFlowRate:
                            lateralPipe.totalFlowRate || (lateralPipe.plants?.length || 0) * 2.5,
                        connectionPoint: lateralPipe.connectionPoint ||
                            lateralPipe.coordinates?.[0] || { lat: 0, lng: 0 },
                        emitterLines: lateralPipe.emitterLines || [], // ⚠️ เพิ่ม emitterLines ที่หายไป!
                    }));
                }

                // 2. ถ้าไม่มี lateralPipes ให้ลองหาจาก subMainPipes.branchPipes (วิธีเก่า - สำรอง)
                else if (data.subMainPipes) {
                    data.subMainPipes.forEach((subMainPipe) => {
                        if (subMainPipe.branchPipes && subMainPipe.branchPipes.length > 0) {
                            subMainPipe.branchPipes.forEach((branchPipe) => {
                                // ใช้ plants ที่อยู่ใน branchPipe.plants (ถ้ามี) หรือหาใกล้เคียง
                                let plantsForPipe = branchPipe.plants || [];

                                // ถ้าไม่มี plants ใน branchPipe ให้ลองหาจาก data.plants
                                if (
                                    plantsForPipe.length === 0 &&
                                    data.plants &&
                                    branchPipe.coordinates?.length > 0
                                ) {
                                    plantsForPipe = data.plants.filter((plant) => {
                                        return branchPipe.coordinates.some((coord) => {
                                            const distance = calculateDistance(
                                                plant.position,
                                                coord
                                            );
                                            return distance <= 15; // 15 meters radius
                                        });
                                    });
                                }

                                // สร้าง lateral pipe เสมอ ไม่ว่าจะมีพืชหรือไม่
                                if (branchPipe.coordinates && branchPipe.coordinates.length > 0) {
                                    const lateralPipe = {
                                        id: branchPipe.id,
                                        coordinates: branchPipe.coordinates,
                                        length:
                                            branchPipe.length ||
                                            calculatePipeLength(branchPipe.coordinates),
                                        plants: plantsForPipe,
                                        placementMode: 'over_plants' as const,
                                        totalFlowRate: plantsForPipe.length * 2.5,
                                        connectionPoint: branchPipe.coordinates[0],
                                    };

                                    allLateralPipes.push(lateralPipe);
                                }
                            });
                        }
                    });
                }

                const enhancedData: EnhancedProjectData = {
                    ...data,
                    irrigationZones: data.irrigationZones || [],
                    lateralPipes: allLateralPipes,
                    headLossResults: [],
                    sprinklerConfig: loadSprinklerConfig() || undefined,
                    plantRotation: 0,
                };

                setLateralPipes(allLateralPipes);

                setProjectData(enhancedData);
                const summary = calculateProjectSummary(data);
                setProjectSummary(summary);

                // Set all zones to collapsed by default
                if (data.irrigationZones && data.irrigationZones.length > 0) {
                    // Set all irrigation zones to collapsed by default
                    const allZoneIds = new Set(data.irrigationZones.map((zone) => zone.id));
                    setCollapsedZones(allZoneIds);
                } else if (summary.zoneDetails && summary.zoneDetails.length > 0) {
                    // Set all regular zones to collapsed by default
                    const allZoneIds = new Set(summary.zoneDetails.map((zone) => zone.zoneId));
                    setCollapsedZones(allZoneIds);
                }

                // Load enhanced statistics
                const overallStats = getOverallStats();
                setEnhancedStats(overallStats);

                // Load irrigation zones if available (including manual zones)
                if (data.irrigationZones && data.irrigationZones.length > 0) {
                    setIrrigationZones(data.irrigationZones);
                }

                // Load lateral pipes if available
                if (data.lateralPipes && data.lateralPipes.length > 0) {
                    // 🔧 แก้ไข: เสริม emitterLines ให้ lateral pipes ที่ยังไม่มี emitterLines
                    const enhancedLateralPipes = data.lateralPipes.map((lateral) => {
                        if (!lateral.emitterLines || lateral.emitterLines.length === 0) {
                            // สร้าง emitterLines ใหม่สำหรับ lateral pipes ที่ยังไม่มี
                            const emitterLines = generateEmitterLinesForExistingPipes(lateral);
                            return {
                                ...lateral,
                                emitterLines: emitterLines,
                            };
                        }
                        return lateral;
                    });
                    setLateralPipes(enhancedLateralPipes);
                }

                // Load sprinkler config
                const config = loadSprinklerConfig();
                if (config) {
                    setSprinklerConfig(config);
                    // Recalculate enhanced stats after loading sprinkler config
                    const updatedStats = getOverallStats();
                    setEnhancedStats(updatedStats);
                } else {
                    // No enhanced stats available
                }

                if (data.mainArea && data.mainArea.length > 0) {
                    const centerLat =
                        data.mainArea.reduce((sum, point) => sum + point.lat, 0) /
                        data.mainArea.length;
                    const centerLng =
                        data.mainArea.reduce((sum, point) => sum + point.lng, 0) /
                        data.mainArea.length;
                    setMapCenter([centerLat, centerLng]);

                    const latitudes = data.mainArea.map((p) => p.lat);
                    const longitudes = data.mainArea.map((p) => p.lng);
                    const maxLat = Math.max(...latitudes);
                    const minLat = Math.min(...latitudes);
                    const maxLng = Math.max(...longitudes);
                    const minLng = Math.min(...longitudes);
                    const latDiff = maxLat - minLat;
                    const lngDiff = maxLng - minLng;
                    const maxDiff = Math.max(latDiff, lngDiff);

                    let initialZoom;
                    if (maxDiff < 0.001) initialZoom = 20;
                    else if (maxDiff < 0.002) initialZoom = 19;
                    else if (maxDiff < 0.005) initialZoom = 18;
                    else if (maxDiff < 0.01) initialZoom = 17;
                    else if (maxDiff < 0.02) initialZoom = 16;
                    else initialZoom = 15;

                    setMapZoom(initialZoom);
                }
            } else {
                navigateToPlanner();
            }
        } catch {
            navigateToPlanner();
        }
        setLoading(false);
    }, []);

    const handleRotationChange = (newRotation: number) => {
        setMapRotation(newRotation);
    };

    const resetMapRotation = () => {
        setMapRotation(0);
    };

    const toggleMapLock = () => {
        const newLockState = !isMapLocked;
        setIsMapLocked(newLockState);
        if (mapRef.current) {
            if (newLockState) {
                // ล็อก map
                mapRef.current.setOptions({
                    draggable: false,
                    zoomControl: false,
                    scrollwheel: false,
                    disableDoubleClickZoom: true,
                });
            } else {
                // ปลดล็อก map
                mapRef.current.setOptions({
                    draggable: true,
                    zoomControl: true,
                    scrollwheel: true,
                    disableDoubleClickZoom: false,
                });
            }
        }
    };

    const handlePipeSizeChange = (newSize: number) => {
        setPipeSize(Math.max(0.5, Math.min(3, newSize)));
    };

    const handleIconSizeChange = (newSize: number) => {
        setIconSize(Math.max(0.5, Math.min(3, newSize)));
    };

    const resetSizes = () => {
        setPipeSize(1);
        setIconSize(1);
    };

    const handleNewProject = () => {
        router.visit('/horticulture/planner');
    };

    const handleEditProject = () => {
        localStorage.setItem('isEditingExistingProject', 'true');

        const existingData = localStorage.getItem('horticultureIrrigationData');
        if (!existingData && projectData) {
            localStorage.setItem('horticultureIrrigationData', JSON.stringify(projectData));
        }

        router.visit('/horticulture/planner');
    };

    const handleMapLoad = useCallback(
        (map: google.maps.Map) => {
            mapRef.current = map;
            setMapLoaded(true);

            // ตั้งค่า map options ตาม isMapLocked state เริ่มต้น
            if (isMapLocked) {
                map.setOptions({
                    draggable: false,
                    zoomControl: false,
                    scrollwheel: false,
                    disableDoubleClickZoom: true,
                });
            }
        },
        [isMapLocked]
    );

    // Enhanced feature handlers
    // const handleHeadLossCalculation = (pipeInfo: {
    //     pipeId: string;
    //     pipeType: 'mainPipe' | 'subMainPipe' | 'branchPipe';
    //     zoneName: string;
    //     zoneId: string;
    //     length: number;
    //     pipeName?: string;
    // }) => {
    //     setSelectedPipeForHeadLoss(pipeInfo);
    //     setShowHeadLossModal(true);
    // };

    // const handleHeadLossSave = (result: HeadLossResult) => {
    //     setHeadLossResults((prev) => [...prev, result]);
    //     setShowHeadLossModal(false);
    //     setSelectedPipeForHeadLoss(null);
    //     // อัพเดท localStorage
    //     const updatedData = { ...projectData, headLossResults: [...headLossResults, result] };
    //     localStorage.setItem('horticultureIrrigationData', JSON.stringify(updatedData));
    // };

    const handleSprinklerConfigSave = () => {
        const sprinklerConfig = loadSprinklerConfig();
        if (sprinklerConfig) {
            setSprinklerConfig(sprinklerConfig);
            // อัพเดท enhanced stats
            const overallStats = getOverallStats();
            setEnhancedStats(overallStats);
        }
        setShowSprinklerConfigModal(false);
    };

    const toggleZoneCollapse = (zoneId: string) => {
        setCollapsedZones((prev) => {
            const newSet = new Set(prev);
            if (newSet.has(zoneId)) {
                newSet.delete(zoneId);
            } else {
                newSet.add(zoneId);
            }
            return newSet;
        });
    };

    const handleExportMapToProduct = async () => {
        if (!mapContainerRef.current) {
            alert(t('ไม่พบแผนที่'));
            return;
        }
        setIsCreatingImage(true);
        try {
            const currentRotation = mapRotation;
            if (currentRotation !== 0) {
                setMapRotation(0);
                await new Promise((resolve) => setTimeout(resolve, 1000));
            }

            await new Promise((resolve) => setTimeout(resolve, 2000));

            const html2canvas = await import('html2canvas');
            const html2canvasLib = html2canvas.default || html2canvas;

            const canvas = await html2canvasLib(mapContainerRef.current, {
                useCORS: true,
                allowTaint: true,
                scale: 2,
                logging: false,
                backgroundColor: '#1F2937',
                width: mapContainerRef.current.offsetWidth,
                height: mapContainerRef.current.offsetHeight,
                onclone: (clonedDoc) => {
                    try {
                        const controls = clonedDoc.querySelectorAll(
                            '.leaflet-control-container, .gm-control-active'
                        );
                        controls.forEach((el) => el.remove());

                        const elements = clonedDoc.querySelectorAll('*');
                        elements.forEach((el: Element) => {
                            const htmlEl = el as HTMLElement;
                            const computedStyle = window.getComputedStyle(htmlEl);

                            const color = computedStyle.color;
                            if (color && (color.includes('oklch') || color.includes('hsl'))) {
                                htmlEl.style.color = '#FFFFFF';
                            }

                            const backgroundColor = computedStyle.backgroundColor;
                            if (
                                backgroundColor &&
                                (backgroundColor.includes('oklch') ||
                                    backgroundColor.includes('hsl'))
                            ) {
                                if (
                                    backgroundColor.includes('transparent') ||
                                    backgroundColor.includes('rgba(0,0,0,0)')
                                ) {
                                    htmlEl.style.backgroundColor = 'transparent';
                                } else {
                                    htmlEl.style.backgroundColor = '#1F2937';
                                }
                            }

                            const borderColor = computedStyle.borderColor;
                            if (
                                borderColor &&
                                (borderColor.includes('oklch') || borderColor.includes('hsl'))
                            ) {
                                htmlEl.style.borderColor = '#374151';
                            }

                            const outlineColor = computedStyle.outlineColor;
                            if (
                                outlineColor &&
                                (outlineColor.includes('oklch') || outlineColor.includes('hsl'))
                            ) {
                                htmlEl.style.outlineColor = '#374151';
                            }
                        });

                        const problematicElements = clonedDoc.querySelectorAll(
                            '[style*="oklch"], [style*="hsl"]'
                        );
                        problematicElements.forEach((el) => {
                            const htmlEl = el as HTMLElement;
                            htmlEl.style.removeProperty('color');
                            htmlEl.style.removeProperty('background-color');
                            htmlEl.style.removeProperty('border-color');
                            htmlEl.style.removeProperty('outline-color');
                        });
                    } catch {
                        // Ignore cleanup errors
                    }
                },
            });

            const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

            if (currentRotation !== 0) {
                setMapRotation(currentRotation);
            }

            if (dataUrl && dataUrl !== 'data:,' && dataUrl.length > 100) {
                localStorage.setItem('projectMapImage', dataUrl);
                localStorage.setItem('projectType', 'horticulture');

                // ส่งข้อมูลระบบหัวฉีดและโซนสำหรับ product page
                localStorage.setItem(
                    'projectDataIrrigationZones',
                    JSON.stringify(projectData?.irrigationZones)
                );

                console.log('Debug handleExportMapToProduct:', {
                    enhancedStats: enhancedStats,
                    sprinklerFlowRate: enhancedStats?.sprinklerFlowRate,
                    projectData: projectData,
                    irrigationZones: irrigationZones,
                    irrigationZonesLength: irrigationZones?.length || 0,
                    projectDataIrrigationZones: projectData?.irrigationZones,
                });

                if (enhancedStats && enhancedStats?.sprinklerFlowRate && projectData) {
                    // คำนวณ connection stats
                    const connectionStats = countConnectionPointsByZone(
                        projectData,
                        irrigationZones
                    );

                    const horticultureSystemData = {
                        // ข้อมูลระบบหัวฉีด
                        sprinklerConfig: {
                            flowRatePerPlant: enhancedStats?.sprinklerFlowRate.flowRatePerPlant,
                            pressureBar: enhancedStats?.sprinklerFlowRate.pressureBar,
                            radiusMeters: enhancedStats?.sprinklerFlowRate.radiusMeters,
                            totalFlowRatePerMinute:
                                enhancedStats?.sprinklerFlowRate.totalFlowRatePerMinute,
                        },
                        // ข้อมูลจุดเชื่อมต่อ
                        connectionStats: connectionStats,
                        // ข้อมูลโซน
                        zones:
                            irrigationZones && irrigationZones.length > 0
                                ? irrigationZones.map((zone: IrrigationZoneExtended) => {
                                      const zoneData = projectSummary?.zoneDetails?.find(
                                          (z: { zoneId: string }) => z.zoneId === zone.id
                                      );
                                      const plantCount = zone.plants ? zone.plants.length : 0;
                                      const waterNeedPerMinute = calculateTotalFlowRate(
                                          plantCount,
                                          enhancedStats?.sprinklerFlowRate?.flowRatePerPlant || 2.5
                                      );
                                      // น้ำต่อต้น = totalWaterNeed / plantCount (เหมือนใน Zone Details Section)
                                      const waterPerTree =
                                          plantCount > 0 ? zone.totalWaterNeed / plantCount : 0;

                                      // หาข้อมูลท่อที่ต้องการน้ำมากที่สุดในแต่ละโซน
                                      const bestMainPipe = findBestMainPipeInZone(
                                          zone.id,
                                          projectData,
                                          irrigationZones,
                                          sprinklerConfig
                                      );
                                      const bestSubMainPipe = findBestSubMainPipeInZone(
                                          zone.id,
                                          projectData,
                                          irrigationZones,
                                          sprinklerConfig
                                      );
                                      const bestBranchPipe = findBestBranchPipeInZone(
                                          zone.id,
                                          projectData,
                                          irrigationZones,
                                          sprinklerConfig
                                      );

                                      // คำนวณพื้นที่จาก coordinates โดยใช้ Shoelace formula (เหมือนใน UI)
                                      const calculatePolygonArea = (
                                          coords: { lat: number; lng: number }[]
                                      ): number => {
                                          if (!coords || coords.length < 3) return 0;

                                          let area = 0;
                                          for (let i = 0; i < coords.length; i++) {
                                              const j = (i + 1) % coords.length;
                                              area += coords[i].lat * coords[j].lng;
                                              area -= coords[j].lat * coords[i].lng;
                                          }
                                          area = Math.abs(area) / 2;

                                          // แปลงจากองศา² เป็นตารางเมตร (โดยประมาณ)
                                          const metersPerDegree = 111320; // ประมาณการ
                                          return area * metersPerDegree * metersPerDegree;
                                      };

                                      // ลองใช้ zone.area ก่อน ถ้าไม่มีก็คำนวณจาก coordinates
                                      const areaInSquareMeters =
                                          zone.area || calculatePolygonArea(zone.coordinates);

                                      return {
                                          id: zone.id,
                                          name: zone.name,
                                          plantCount: plantCount,
                                          totalWaterNeed: zone.totalWaterNeed || 0,
                                          waterPerTree: waterPerTree,
                                          waterNeedPerMinute: waterNeedPerMinute,
                                          area: areaInSquareMeters,
                                          color: zone.color,
                                          // ข้อมูลท่อในโซน
                                          pipes: zoneData
                                              ? {
                                                    mainPipes: {
                                                        count: zoneData.mainPipesInZone?.count || 0,
                                                        totalLength:
                                                            zoneData.mainPipesInZone?.totalLength ||
                                                            0,
                                                        longest:
                                                            zoneData.mainPipesInZone?.longest || 0,
                                                    },
                                                    subMainPipes: {
                                                        count:
                                                            zoneData.subMainPipesInZone?.count || 0,
                                                        totalLength:
                                                            zoneData.subMainPipesInZone
                                                                ?.totalLength || 0,
                                                        longest:
                                                            zoneData.subMainPipesInZone?.longest ||
                                                            0,
                                                    },
                                                    branchPipes: {
                                                        count:
                                                            zoneData.branchPipesInZone?.count || 0,
                                                        totalLength:
                                                            zoneData.branchPipesInZone
                                                                ?.totalLength || 0,
                                                        longest:
                                                            zoneData.branchPipesInZone?.longest ||
                                                            0,
                                                    },
                                                    emitterPipes: zoneData.emitterPipesInZone
                                                        ? {
                                                              count:
                                                                  zoneData.emitterPipesInZone
                                                                      .count || 0,
                                                              totalLength:
                                                                  zoneData.emitterPipesInZone
                                                                      .totalLength || 0,
                                                              longest:
                                                                  zoneData.emitterPipesInZone
                                                                      .longest || 0,
                                                          }
                                                        : null,
                                                }
                                              : null,
                                          // เพิ่มข้อมูลท่อที่ต้องการน้ำมากที่สุด
                                          bestPipes: {
                                              main: bestMainPipe,
                                              subMain: bestSubMainPipe,
                                              branch: bestBranchPipe,
                                          },
                                      };
                                  })
                                : [
                                      {
                                          id: 'main-area',
                                          name: 'พื้นที่หลัก',
                                          plantCount: projectData.plants
                                              ? projectData.plants.length
                                              : 0,
                                          totalWaterNeed: 0,
                                          waterPerTree: 0,
                                          waterNeedPerMinute: calculateTotalFlowRate(
                                              projectData.plants ? projectData.plants.length : 0,
                                              enhancedStats?.sprinklerFlowRate?.flowRatePerPlant ||
                                                  2.5
                                          ),
                                          area: projectData.totalArea || 0,
                                          color: '#22c55e',
                                          pipes: projectSummary
                                              ? {
                                                    mainPipes: {
                                                        count: projectSummary.mainPipes?.count || 0,
                                                        totalLength:
                                                            projectSummary.mainPipes?.totalLength ||
                                                            0,
                                                        longest:
                                                            projectSummary.mainPipes?.longest || 0,
                                                    },
                                                    subMainPipes: {
                                                        count:
                                                            projectSummary.subMainPipes?.count || 0,
                                                        totalLength:
                                                            projectSummary.subMainPipes
                                                                ?.totalLength || 0,
                                                        longest:
                                                            projectSummary.subMainPipes?.longest ||
                                                            0,
                                                    },
                                                    branchPipes: {
                                                        count:
                                                            projectSummary.branchPipes?.count || 0,
                                                        totalLength:
                                                            projectSummary.branchPipes
                                                                ?.totalLength || 0,
                                                        longest:
                                                            projectSummary.branchPipes?.longest ||
                                                            0,
                                                    },
                                                    emitterPipes: projectSummary.emitterPipes
                                                        ? {
                                                              count:
                                                                  projectSummary.emitterPipes
                                                                      .count || 0,
                                                              totalLength:
                                                                  projectSummary.emitterPipes
                                                                      .totalLength || 0,
                                                              longest:
                                                                  projectSummary.emitterPipes
                                                                      .longest || 0,
                                                          }
                                                        : null,
                                                }
                                              : null,
                                          // เพิ่มข้อมูลท่อที่ต้องการน้ำมากที่สุดสำหรับพื้นที่หลัก
                                          bestPipes: {
                                              main: findBestMainPipeInZone(
                                                  'main-area',
                                                  projectData,
                                                  irrigationZones,
                                                  sprinklerConfig
                                              ),
                                              subMain: findBestSubMainPipeInZone(
                                                  'main-area',
                                                  projectData,
                                                  irrigationZones,
                                                  sprinklerConfig
                                              ),
                                              branch: findBestBranchPipeInZone(
                                                  'main-area',
                                                  projectData,
                                                  irrigationZones,
                                                  sprinklerConfig
                                              ),
                                          },
                                      },
                                  ],
                        // ข้อมูลรวม
                        totalPlants:
                            irrigationZones && irrigationZones.length > 0
                                ? irrigationZones.reduce(
                                      (total, zone) =>
                                          total + (zone.plants ? zone.plants.length : 0),
                                      0
                                  )
                                : projectData.plants
                                  ? projectData.plants.length
                                  : 0,
                        isMultipleZones: !!(irrigationZones && irrigationZones.length > 0),
                    };

                    console.log(
                        '💾 Saving horticultureSystemData to localStorage:',
                        horticultureSystemData
                    );
                    localStorage.setItem(
                        'horticultureSystemData',
                        JSON.stringify(horticultureSystemData)
                    );
                } else {
                    console.warn('Missing data for horticultureSystemData:', {
                        hasEnhancedStats: !!enhancedStats,
                        hasSprinklerFlowRate: !!(enhancedStats && enhancedStats?.sprinklerFlowRate),
                        hasProjectData: !!projectData,
                    });
                }

                window.location.href = '/product';
            } else {
                throw new Error('ไม่สามารถสร้างภาพแผนที่ได้');
            }
        } catch (error) {
            console.error('❌ Error creating map image:', error);
            alert(
                '❌ เกิดข้อผิดพลาดในการสร้างภาพแผนผัง\n\nกรุณาใช้วิธี Screenshot แทน:\n\n1. กด F11 เพื่อ Fullscreen\n2. กด Print Screen หรือใช้ Snipping Tool\n3. หรือใช้ Extension "Full Page Screen Capture"'
            );
        } finally {
            setIsCreatingImage(false);
        }
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-32 w-32 animate-spin rounded-full border-b-2 border-white"></div>
                    <p className="text-xl">{t('กำลังโหลดข้อมูลโครงการ...')}</p>
                </div>
            </div>
        );
    }

    if (!projectData || !projectSummary) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-900 text-white">
                <div className="text-center">
                    <h1 className="mb-4 text-2xl font-bold">{t('ไม่พบข้อมูลโครงการ')}</h1>
                    <button
                        onClick={handleNewProject}
                        className="rounded-lg bg-blue-600 px-6 py-3 transition-colors hover:bg-blue-700"
                    >
                        {t('กลับไปสร้างโครงการใหม่')}
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white">
            <Navbar />
            <div className="p-4">
                <div className="mx-auto w-full">
                    {/* Header */}
                    <div className="mx-4 mb-4 flex justify-between text-left">
                        <div className="my-4 flex justify-start">
                            <h1 className="mb-2 text-2xl font-bold text-green-400">
                                {t('รายงานการออกแบบระบบน้ำพืชสวน')}
                            </h1>
                            <h2 className="text-xl text-gray-300">{projectData.projectName}</h2>
                        </div>
                        {/* Action Buttons */}
                        <div className="my-4 flex flex-wrap justify-end gap-2">
                            <button
                                onClick={handleNewProject}
                                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold transition-colors hover:bg-green-700"
                            >
                                ➕ {t('โครงการใหม่')}
                            </button>
                            <button
                                onClick={handleEditProject}
                                className="rounded-lg bg-orange-600 px-4 py-2 text-sm font-semibold transition-colors hover:bg-orange-700"
                            >
                                ✏️ {t('แก้ไขโครงการ')}
                            </button>
                            {projectData && projectData.plants && projectData.plants.length > 0 && (
                                <button
                                    onClick={() => setShowSprinklerConfigModal(true)}
                                    className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold transition-colors hover:bg-cyan-700"
                                >
                                    🚿 {t('ตั้งค่าหัวฉีด')}
                                </button>
                            )}
                            <button
                                onClick={handleExportMapToProduct}
                                disabled={isCreatingImage}
                                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                                {isCreatingImage ? (
                                    <>
                                        <svg
                                            className="mr-2 inline h-4 w-4 animate-spin"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            ></circle>
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                            ></path>
                                        </svg>
                                        {t('กำลังส่งออก...')}
                                    </>
                                ) : (
                                    t('คำนวณระบบน้ำ')
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                        <div className="rounded-lg bg-gray-800 p-6">
                            <div className="mb-4 flex items-center justify-between">
                                <h3 className="text-xl font-semibold">🗺️ {t('แผนผังโครงการ')}</h3>
                            </div>

                            <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
                                <div className="rounded-lg bg-gray-700 p-4">
                                    <h4 className="mb-3 text-sm font-semibold text-blue-300">
                                        🔄 {t('การหมุนแผนที่')}
                                    </h4>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <label className="w-16 text-xs text-gray-300">
                                                {t('หมุน')}:
                                            </label>
                                            <input
                                                type="range"
                                                min="0"
                                                max="360"
                                                step="1"
                                                value={mapRotation}
                                                onChange={(e) =>
                                                    handleRotationChange(parseInt(e.target.value))
                                                }
                                                className="flex-1 accent-blue-600"
                                            />
                                            <span className="w-12 text-xs text-blue-300">
                                                {mapRotation}°
                                            </span>
                                        </div>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() =>
                                                    handleRotationChange(mapRotation - 15)
                                                }
                                                className="flex-1 rounded bg-blue-600 px-2 py-1 text-xs hover:bg-blue-700"
                                            >
                                                ↺ -15°
                                            </button>
                                            <button
                                                onClick={resetMapRotation}
                                                className="flex-1 rounded bg-gray-600 px-2 py-1 text-xs hover:bg-gray-700"
                                            >
                                                🔄 {t('รีเซ็ต')}
                                            </button>
                                            <button
                                                onClick={() =>
                                                    handleRotationChange(mapRotation + 15)
                                                }
                                                className="flex-1 rounded bg-blue-600 px-2 py-1 text-xs hover:bg-blue-700"
                                            >
                                                ↻ +15°
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={isMapLocked}
                                                onChange={toggleMapLock}
                                                className="accent-purple-600"
                                            />
                                            <label className="text-xs text-gray-300">
                                                🔒 {t('ล็อกการลาก')}
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="rounded-lg bg-gray-700 p-4">
                                    <h4 className="mb-3 text-sm font-semibold text-green-300">
                                        📏 {t('ขนาดไอคอน')}
                                    </h4>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-2">
                                            <label className="w-16 text-xs text-gray-300">
                                                {t('ท่อ')}:
                                            </label>
                                            <input
                                                type="range"
                                                min="0.5"
                                                max="3"
                                                step="0.1"
                                                value={pipeSize}
                                                onChange={(e) =>
                                                    handlePipeSizeChange(parseFloat(e.target.value))
                                                }
                                                className="flex-1 accent-green-600"
                                            />
                                            <span className="w-12 text-xs text-green-300">
                                                {pipeSize.toFixed(1)}x
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <label className="w-16 text-xs text-gray-300">
                                                {t('ไอคอน')}:
                                            </label>
                                            <input
                                                type="range"
                                                min="0.5"
                                                max="3"
                                                step="0.1"
                                                value={iconSize}
                                                onChange={(e) =>
                                                    handleIconSizeChange(parseFloat(e.target.value))
                                                }
                                                className="flex-1 accent-yellow-600"
                                            />
                                            <span className="w-12 text-xs text-yellow-300">
                                                {iconSize.toFixed(1)}x
                                            </span>
                                        </div>
                                        <button
                                            onClick={resetSizes}
                                            className="w-full rounded bg-gray-600 px-3 py-1 text-xs hover:bg-gray-700"
                                        >
                                            🔄 {t('รีเซ็ตขนาด')}
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div
                                ref={mapContainerRef}
                                className="mb-4 h-[500px] w-full overflow-hidden rounded-lg border border-gray-600"
                                style={{ backgroundColor: 'rgb(31, 41, 55)' }}
                            >
                                <HorticultureMapComponent
                                    center={mapCenter}
                                    zoom={mapZoom}
                                    onMapLoad={handleMapLoad}
                                    mapOptions={{
                                        zoomControl: false,
                                        fullscreenControl: false,
                                        mapTypeControl: false,
                                        streetViewControl: false,
                                        clickableIcons: false,
                                        scrollwheel: false,
                                        disableDoubleClickZoom: false,
                                        gestureHandling: 'none',
                                    }}
                                >
                                    {mapLoaded && (
                                        <GoogleMapsResultsOverlays
                                            map={mapRef.current}
                                            projectData={projectData}
                                            mapRotation={mapRotation}
                                            pipeSize={pipeSize}
                                            iconSize={iconSize}
                                            irrigationZones={irrigationZones}
                                            lateralPipes={lateralPipes}
                                            t={t}
                                        />
                                    )}
                                </HorticultureMapComponent>
                            </div>

                            <div className="rounded-lg bg-gray-700 p-4">
                                <h4 className="mb-3 text-sm font-semibold">
                                    🎨 {t('คำอธิบายสัญลักษณ์')}
                                </h4>
                                <div className="space-y-3">
                                    {/* ท่อ */}
                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="h-1 w-4"
                                                style={{
                                                    backgroundColor: '#FF0000',
                                                    height: `${2 * pipeSize}px`,
                                                }}
                                            ></div>
                                            <span>{t('ท่อเมนหลัก')}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="h-1 w-4"
                                                style={{
                                                    backgroundColor: '#8B5CF6',
                                                    height: `${1.5 * pipeSize}px`,
                                                }}
                                            ></div>
                                            <span>{t('ท่อเมนรอง')}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="h-1 w-4"
                                                style={{
                                                    backgroundColor: '#FCD34D',
                                                    height: `${1 * pipeSize}px`,
                                                }}
                                            ></div>
                                            <span>{t('ท่อย่อย')}</span>
                                        </div>
                                        {lateralPipes.some(
                                            (pipe) =>
                                                pipe.emitterLines && pipe.emitterLines.length > 0
                                        ) && (
                                            <div className="flex items-center gap-2">
                                                <div
                                                    className="h-1 w-4"
                                                    style={{
                                                        backgroundColor: '#90EE90',
                                                        height: `${1 * pipeSize}px`,
                                                        border: '1px dashed #ffffff80',
                                                    }}
                                                ></div>
                                                <span>{t('ท่อย่อยแยก')}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <img
                                                src="/images/water-pump.png"
                                                alt={t('ปั๊มน้ำ')}
                                                style={{
                                                    width: `${18 * iconSize}px`,
                                                    height: `${18 * iconSize}px`,
                                                }}
                                            />
                                            <span>{t('ปั๊มน้ำ')}</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <div className="h-4 w-4 bg-green-500 opacity-50"></div>
                                            <span>{t('พื้นที่หลัก')}</span>
                                        </div>
                                    </div>

                                    {/* โซน */}
                                    {projectData?.zones && projectData.zones.length > 0 && (
                                        <div>
                                            <div className="mb-2 text-xs font-semibold text-gray-300">
                                                {t('โซน')}:
                                            </div>
                                            <div className="grid grid-cols-2 gap-1 text-xs">
                                                {projectData.zones.map((zone, index) => (
                                                    <div
                                                        key={zone.id}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <div
                                                            className="h-3 w-3 opacity-70"
                                                            style={{
                                                                backgroundColor:
                                                                    getZoneColor(index),
                                                            }}
                                                        ></div>
                                                        <span>
                                                            {t('โซน')} {index + 1}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* พื้นที่หลีกเลี่ยง */}
                                    {projectData?.exclusionAreas &&
                                        projectData.exclusionAreas.length > 0 && (
                                            <div>
                                                <div className="mb-2 text-xs font-semibold text-gray-300">
                                                    {t('พื้นที่หลีกเลี่ยง')}:
                                                </div>
                                                <div className="grid grid-cols-2 gap-1 text-xs">
                                                    {projectData.exclusionAreas.map((area) => {
                                                        const exclusionColor =
                                                            EXCLUSION_COLORS[
                                                                area.type as keyof typeof EXCLUSION_COLORS
                                                            ] || EXCLUSION_COLORS.other;
                                                        return (
                                                            <div
                                                                key={area.id}
                                                                className="flex items-center gap-2"
                                                            >
                                                                <div
                                                                    className="h-3 w-3 opacity-70"
                                                                    style={{
                                                                        backgroundColor:
                                                                            exclusionColor,
                                                                    }}
                                                                ></div>
                                                                <span>
                                                                    {getExclusionTypeName(
                                                                        area.type,
                                                                        t
                                                                    )}
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        )}
                                </div>
                            </div>

                            {/* สถิติจุดเชื่อมต่อ */}
                            <div className="rounded-lg bg-gray-700 p-4">
                                <h4 className="mb-3 text-sm font-semibold">
                                    🔗 {t('สถิติจุดเชื่อมต่อ')}
                                </h4>
                                <div className="space-y-3">
                                    {(() => {
                                        const connectionStats = countConnectionPointsByZone(
                                            projectData,
                                            irrigationZones
                                        );

                                        const totalStats = connectionStats.reduce(
                                            (acc, zone) => ({
                                                mainToSubMain:
                                                    acc.mainToSubMain + zone.mainToSubMain,
                                                subMainToMainMid:
                                                    acc.subMainToMainMid + zone.subMainToMainMid,
                                                subMainToLateral:
                                                    acc.subMainToLateral + zone.subMainToLateral,
                                                subMainToMainIntersection:
                                                    acc.subMainToMainIntersection +
                                                    zone.subMainToMainIntersection,
                                                lateralToSubMainIntersection:
                                                    acc.lateralToSubMainIntersection +
                                                    zone.lateralToSubMainIntersection,
                                                total: acc.total + zone.total,
                                            }),
                                            {
                                                mainToSubMain: 0,
                                                subMainToMainMid: 0,
                                                subMainToLateral: 0,
                                                subMainToMainIntersection: 0,
                                                lateralToSubMainIntersection: 0,
                                                total: 0,
                                            }
                                        );

                                        return (
                                            <>
                                                {/* สรุปรวมทั้งหมด */}
                                                <div className="rounded bg-gray-600 p-3">
                                                    <div className="mb-2 text-xs font-semibold text-yellow-300">
                                                        📊 {t('สรุปรวมทั้งหมด')}
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-2 text-xs">
                                                        <div className="flex items-center gap-2">
                                                            <div
                                                                className="h-3 w-3 rounded-full"
                                                                style={{
                                                                    backgroundColor: '#DC2626',
                                                                }}
                                                            ></div>
                                                            <span>
                                                                {t('ปลาย-ปลาย')}:{' '}
                                                                {totalStats.mainToSubMain}{' '}
                                                                {t('จุด')}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div
                                                                className="h-3 w-3 rounded-full"
                                                                style={{
                                                                    backgroundColor: '#3B82F6',
                                                                }}
                                                            ></div>
                                                            <span>
                                                                {t('ปลายเมน-ระหว่างเมนรอง')}:{' '}
                                                                {totalStats.subMainToMainMid}{' '}
                                                                {t('จุด')}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div
                                                                className="h-3 w-3 rounded-full"
                                                                style={{
                                                                    backgroundColor: '#8B5CF6',
                                                                }}
                                                            ></div>
                                                            <span>
                                                                {t('เมนรอง-กลางเมน')}:{' '}
                                                                {totalStats.subMainToLateral}{' '}
                                                                {t('จุด')}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div
                                                                className="h-3 w-3 rounded-full"
                                                                style={{
                                                                    backgroundColor: '#F59E0B',
                                                                }}
                                                            ></div>
                                                            <span>
                                                                {t('เมนรอง-ท่อย่อย')}:{' '}
                                                                {
                                                                    totalStats.subMainToMainIntersection
                                                                }{' '}
                                                                {t('จุด')}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div
                                                                className="h-3 w-3 rounded-full"
                                                                style={{
                                                                    backgroundColor: '#10B981',
                                                                }}
                                                            ></div>
                                                            <span>
                                                                {t('ตัดท่อย่อย-เมนรอง')}:{' '}
                                                                {
                                                                    totalStats.lateralToSubMainIntersection
                                                                }{' '}
                                                                {t('จุด')}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <div className="h-3 w-3 rounded-full bg-white"></div>
                                                            <span className="font-semibold text-white">
                                                                {t('รวมทั้งหมด')}:{' '}
                                                                {totalStats.total} {t('จุด')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* แยกตามโซน */}
                                                {connectionStats.length > 0 && (
                                                    <div className="space-y-2">
                                                        <div className="text-xs font-semibold text-gray-300">
                                                            {t('แยกตามโซน')}:
                                                        </div>
                                                        {connectionStats.map((zoneStats) => (
                                                            <div
                                                                key={zoneStats.zoneId}
                                                                className="rounded bg-gray-600 p-2"
                                                            >
                                                                <div className="mb-1 text-xs font-semibold text-green-300">
                                                                    {zoneStats.zoneName}
                                                                </div>
                                                                <div className="grid grid-cols-5 gap-1 text-xs">
                                                                    <div className="flex items-center gap-1">
                                                                        <div
                                                                            className="h-2 w-2 rounded-full"
                                                                            style={{
                                                                                backgroundColor:
                                                                                    '#DC2626',
                                                                            }}
                                                                        ></div>
                                                                        <span title="ปลาย-ปลาย">
                                                                            {
                                                                                zoneStats.mainToSubMain
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1">
                                                                        <div
                                                                            className="h-2 w-2 rounded-full"
                                                                            style={{
                                                                                backgroundColor:
                                                                                    '#3B82F6',
                                                                            }}
                                                                        ></div>
                                                                        <span title="ปลายเมน-ระหว่างเมนรอง">
                                                                            {
                                                                                zoneStats.subMainToMainMid
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1">
                                                                        <div
                                                                            className="h-2 w-2 rounded-full"
                                                                            style={{
                                                                                backgroundColor:
                                                                                    '#8B5CF6',
                                                                            }}
                                                                        ></div>
                                                                        <span title="เมนรอง-กลางเมน">
                                                                            {
                                                                                zoneStats.subMainToLateral
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1">
                                                                        <div
                                                                            className="h-2 w-2 rounded-full"
                                                                            style={{
                                                                                backgroundColor:
                                                                                    '#F59E0B',
                                                                            }}
                                                                        ></div>
                                                                        <span title="เมนรอง-ท่อย่อย">
                                                                            {
                                                                                zoneStats.subMainToMainIntersection
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                    <div className="flex items-center gap-1">
                                                                        <div
                                                                            className="h-2 w-2 rounded-full"
                                                                            style={{
                                                                                backgroundColor:
                                                                                    '#10B981',
                                                                            }}
                                                                        ></div>
                                                                        <span title="ตัดท่อย่อย-เมนรอง">
                                                                            {
                                                                                zoneStats.lateralToSubMainIntersection
                                                                            }
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        );
                                    })()}
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="rounded-lg bg-gray-800 p-6">
                                <h3 className="mb-4 text-xl font-semibold text-green-400">
                                    📊 {t('ข้อมูลโดยรวม')}
                                </h3>
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
                                    <div className="rounded bg-gray-700 p-3">
                                        <div className="text-gray-400">
                                            {t('พื้นที่รวมทั้งหมด')}
                                        </div>
                                        <div className="text-lg font-bold text-green-400">
                                            {formatAreaInRai(projectSummary.totalAreaInRai)}
                                        </div>
                                    </div>
                                    <div className="rounded bg-gray-700 p-3">
                                        <div className="text-gray-400">{t('จำนวนโซน')}</div>
                                        <div className="text-lg font-bold text-blue-400">
                                            {projectSummary.totalZones} โซน
                                        </div>
                                    </div>
                                    <div className="rounded bg-gray-700 p-3">
                                        <div className="text-gray-400">{t('ต้นไม้ทั้งหมด')}</div>
                                        <div className="text-lg font-bold text-yellow-400">
                                            {projectSummary.totalPlants.toLocaleString()} ต้น
                                        </div>
                                    </div>
                                    <div className="rounded bg-gray-700 p-3">
                                        <div className="text-gray-400">
                                            {t('ปริมาณน้ำต่อครั้ง')}
                                        </div>
                                        <div className="text-lg font-bold text-cyan-400">
                                            {formatWaterVolume(
                                                projectSummary.totalWaterNeedPerSession
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Enhanced Statistics */}
                                {enhancedStats && enhancedStats?.sprinklerFlowRate && (
                                    <div className="mt-6 rounded border border-blue-700/50 bg-gradient-to-r from-blue-900/30 to-cyan-900/30 p-4">
                                        <h4 className="mb-3 text-lg font-semibold text-cyan-300">
                                            🚿 {t('ข้อมูลระบบหัวฉีดของพื้นที่รวมทั้ังหมด')} (แรงดัน{' '}
                                            {enhancedStats?.sprinklerFlowRate.pressureBar} บาร์ /
                                            รัศมี {enhancedStats?.sprinklerFlowRate.radiusMeters}{' '}
                                            ม.)
                                        </h4>
                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                                            <div className="text-center">
                                                <div className="text-sm text-gray-400">
                                                    Q หัวฉีด
                                                </div>
                                                <div className="text-lg font-bold text-cyan-400">
                                                    {
                                                        enhancedStats?.sprinklerFlowRate
                                                            .flowRatePerPlant
                                                    }{' '}
                                                    L/M
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-sm text-gray-400">
                                                    Q รวม/นาที
                                                </div>
                                                <div className="text-lg font-bold text-blue-400">
                                                    {
                                                        enhancedStats?.sprinklerFlowRate
                                                            .formattedFlowRatePerMinute
                                                    }
                                                </div>
                                            </div>
                                            <div className="text-center">
                                                <div className="text-sm text-gray-400">
                                                    Q รวม/ชั่วโมง
                                                </div>
                                                <div className="text-lg font-bold text-purple-400">
                                                    {
                                                        enhancedStats?.sprinklerFlowRate
                                                            .formattedFlowRatePerHour
                                                    }
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            <div className="rounded-lg bg-gray-800 p-6">
                                <h3 className="mb-4 text-xl font-semibold text-blue-400">
                                    🔧 {t('ระบบท่อทั้งหมด')}
                                </h3>

                                {/* ท่อเมนหลัก */}
                                <div className="mb-2 rounded bg-red-700/20 p-2">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            🔴 {t('ท่อเมนหลัก')} ({projectSummary.mainPipes.count}{' '}
                                            ท่อ)
                                        </div>
                                        <div className="text-right">
                                            <span className="text-gray-400">ยาวรวม:</span>{' '}
                                            <span className="font-bold text-red-400">
                                                {formatDistance(
                                                    projectSummary.mainPipes.totalLength
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* ท่อเมนรอง */}
                                <div className="mb-2 rounded bg-purple-800/20 p-2">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            🟣 {t('ท่อเมนรอง')} ({projectSummary.subMainPipes.count}{' '}
                                            ท่อ)
                                        </div>
                                        <div className="text-right">
                                            <span className="text-gray-400">ยาวรวม:</span>{' '}
                                            <span className="font-bold text-purple-400">
                                                {formatDistance(
                                                    projectSummary.subMainPipes.totalLength
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* ท่อย่อย */}
                                <div className="mb-2 rounded bg-yellow-800/20 p-2">
                                    <div className="grid grid-cols-2 gap-4 text-sm">
                                        <div>
                                            🟡 {t('ท่อย่อย')} ({projectSummary.branchPipes.count}{' '}
                                            ท่อ)
                                        </div>
                                        <div className="text-right">
                                            <span className="text-gray-400">ยาวรวม:</span>{' '}
                                            <span className="font-bold text-yellow-400">
                                                {formatDistance(
                                                    projectSummary.branchPipes.totalLength
                                                )}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* ท่อย่อยแยก */}
                                {projectSummary.emitterPipes.count > 0 && (
                                    <div className="mb-2 rounded bg-green-800/20 p-2">
                                        <div className="grid grid-cols-2 gap-4 text-sm">
                                            <div>
                                                🟢 {t('ท่อย่อยแยก')} (
                                                {projectSummary.emitterPipes.count} ท่อ)
                                            </div>
                                            <div className="text-right">
                                                <span className="text-gray-400">ยาวรวม:</span>{' '}
                                                <span className="font-bold text-green-400">
                                                    {formatDistance(
                                                        projectSummary.emitterPipes.totalLength
                                                    )}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Zone Details Section */}
                            {(irrigationZones.length > 0 ||
                                projectSummary.zoneDetails.length > 0) && (
                                <div className="rounded-lg bg-gray-800 p-6">
                                    <h3 className="mb-4 text-xl font-semibold text-green-400">
                                        🏞️{' '}
                                        {irrigationZones.length > 0
                                            ? t('ข้อมูลโซนการให้น้ำ')
                                            : t('ข้อมูลพื้นที่หลัก')}
                                    </h3>
                                    <div className="space-y-2">
                                        {irrigationZones.length > 0
                                            ? // แสดงข้อมูลโซนทั้งหมด (รวมโซนอัตโนมัติและโซนที่วาดเอง)
                                              irrigationZones.map((zone, index) => {
                                                  const isCollapsed = collapsedZones.has(zone.id);
                                                  return (
                                                      <div
                                                          key={zone.id}
                                                          className="rounded bg-gray-700 p-4"
                                                      >
                                                          <div
                                                              className="-m-2 flex cursor-pointer items-center justify-between rounded transition-colors hover:bg-gray-600"
                                                              onClick={() =>
                                                                  toggleZoneCollapse(zone.id)
                                                              }
                                                          >
                                                              <div className="flex items-center gap-3">
                                                                  <div className="text-lg">
                                                                      {isCollapsed ? '▶️' : '🔽'}
                                                                  </div>
                                                                  <h4 className="text-lg font-semibold text-green-300">
                                                                      {zone.name}
                                                                  </h4>
                                                              </div>
                                                              <div className="flex items-center gap-2">
                                                                  <div
                                                                      className="h-4 w-4 rounded"
                                                                      style={{
                                                                          backgroundColor:
                                                                              zone.color,
                                                                      }}
                                                                  />
                                                                  <span className="text-sm text-gray-400">
                                                                      #{index + 1}
                                                                  </span>
                                                              </div>
                                                          </div>

                                                          {!isCollapsed && (
                                                              <div>
                                                                  {/* Plant Information */}
                                                                  <div className="mb-2 mt-4 rounded border border-green-700/50 bg-green-900/20 p-3">
                                                                      <h5 className="mb-2 text-sm font-semibold text-green-300">
                                                                          🌱 ข้อมูลการปลูก
                                                                      </h5>
                                                                      <div className="grid grid-cols-5 gap-3 text-sm">
                                                                          <div>
                                                                              <span className="text-gray-200">
                                                                                  พื้นที่โซน:
                                                                              </span>
                                                                              <div className="font-bold text-orange-400">
                                                                                  {(() => {
                                                                                      // คำนวณพื้นที่จาก coordinates โดยใช้ Shoelace formula
                                                                                      const calculatePolygonArea =
                                                                                          (
                                                                                              coords: {
                                                                                                  lat: number;
                                                                                                  lng: number;
                                                                                              }[]
                                                                                          ): number => {
                                                                                              if (
                                                                                                  coords.length <
                                                                                                  3
                                                                                              )
                                                                                                  return 0;

                                                                                              let area = 0;
                                                                                              for (
                                                                                                  let i = 0;
                                                                                                  i <
                                                                                                  coords.length;
                                                                                                  i++
                                                                                              ) {
                                                                                                  const j =
                                                                                                      (i +
                                                                                                          1) %
                                                                                                      coords.length;
                                                                                                  area +=
                                                                                                      coords[
                                                                                                          i
                                                                                                      ]
                                                                                                          .lat *
                                                                                                      coords[
                                                                                                          j
                                                                                                      ]
                                                                                                          .lng;
                                                                                                  area -=
                                                                                                      coords[
                                                                                                          j
                                                                                                      ]
                                                                                                          .lat *
                                                                                                      coords[
                                                                                                          i
                                                                                                      ]
                                                                                                          .lng;
                                                                                              }
                                                                                              area =
                                                                                                  Math.abs(
                                                                                                      area
                                                                                                  ) /
                                                                                                  2;

                                                                                              // แปลงจากองศา² เป็นตารางเมตร (โดยประมาณ)
                                                                                              const metersPerDegree = 111320; // ประมาณการ
                                                                                              return (
                                                                                                  area *
                                                                                                  metersPerDegree *
                                                                                                  metersPerDegree
                                                                                              );
                                                                                          };

                                                                                      // ลองใช้ zone.area ก่อน ถ้าไม่มีก็คำนวณจาก coordinates
                                                                                      const areaInSquareMeters =
                                                                                          zone.area ||
                                                                                          calculatePolygonArea(
                                                                                              zone.coordinates
                                                                                          );
                                                                                      const areaInRai =
                                                                                          areaInSquareMeters /
                                                                                          1600; // แปลงเป็นไร่

                                                                                      return areaInRai >
                                                                                          0
                                                                                          ? `${areaInRai.toFixed(2)} ไร่`
                                                                                          : 'ไม่ระบุ';
                                                                                  })()}
                                                                              </div>
                                                                          </div>
                                                                          <div>
                                                                              <span className="text-gray-200">
                                                                                  จำนวนต้นไม้:
                                                                              </span>
                                                                              <div className="font-bold text-green-400">
                                                                                  {zone.plants.length.toLocaleString()}{' '}
                                                                                  ต้น
                                                                              </div>
                                                                          </div>
                                                                          <div>
                                                                              <span className="text-gray-200">
                                                                                  ปริมาณน้ำรวม:
                                                                              </span>
                                                                              <div className="font-bold text-cyan-400">
                                                                                  {formatWaterVolume(
                                                                                      zone.totalWaterNeed
                                                                                  )}
                                                                                  /ครั้ง
                                                                              </div>
                                                                          </div>
                                                                          <div>
                                                                              <span className="text-gray-200">
                                                                                  น้ำต่อต้น:
                                                                              </span>
                                                                              <div className="font-bold text-cyan-400">
                                                                                  {zone.plants
                                                                                      .length > 0
                                                                                      ? (
                                                                                            zone.totalWaterNeed /
                                                                                            zone
                                                                                                .plants
                                                                                                .length
                                                                                        ).toFixed(0)
                                                                                      : 0}{' '}
                                                                                  ลิตร/ต้น
                                                                              </div>
                                                                          </div>
                                                                          {sprinklerConfig && (
                                                                              <div>
                                                                                  <span className="text-gray-200">
                                                                                      ความต้องการน้ำ:
                                                                                  </span>
                                                                                  <div className="font-bold text-cyan-400">
                                                                                      {calculateTotalFlowRate(
                                                                                          zone
                                                                                              .plants
                                                                                              .length,
                                                                                          sprinklerConfig.flowRatePerMinute
                                                                                      ).toLocaleString()}{' '}
                                                                                      L/min
                                                                                  </div>
                                                                              </div>
                                                                          )}
                                                                      </div>
                                                                  </div>

                                                                  {/* Pipe System Information for Auto Zones - ZONE SPECIFIC */}
                                                                  {(() => {
                                                                      // หาข้อมูลโซนที่ตรงกัน
                                                                      const zoneData =
                                                                          projectSummary?.zoneDetails?.find(
                                                                              (z) =>
                                                                                  z.zoneId ===
                                                                                  zone.id
                                                                          );

                                                                      if (!zoneData) {
                                                                          // คำนวณข้อมูลท่อโดยตรงสำหรับโซนนี้
                                                                          const lateralPipesInThisZone =
                                                                              lateralPipes?.filter(
                                                                                  (lateral) => {
                                                                                      // ตรวจสอบว่าท่อ lateral นี้มี plants ที่ส่วนใหญ่อยู่ในโซนนี้
                                                                                      const plantsInThisZone =
                                                                                          lateral.plants.filter(
                                                                                              (
                                                                                                  lateralPlant
                                                                                              ) => {
                                                                                                  return zone.plants.some(
                                                                                                      (
                                                                                                          zonePlant
                                                                                                      ) =>
                                                                                                          zonePlant.id ===
                                                                                                          lateralPlant.id
                                                                                                  );
                                                                                              }
                                                                                          );
                                                                                      return (
                                                                                          plantsInThisZone.length >
                                                                                          lateral
                                                                                              .plants
                                                                                              .length /
                                                                                              2
                                                                                      ); // majority vote
                                                                                  }
                                                                              ) || [];

                                                                          return (
                                                                              <div className="rounded border border-blue-700/50 bg-blue-900/20 p-3">
                                                                                  <h5 className="mb-2 text-sm font-semibold text-blue-300">
                                                                                      🔧
                                                                                      ระบบท่อในโซน
                                                                                      (คำนวณแบบ
                                                                                      Direct)
                                                                                  </h5>

                                                                                  {/* ท่อย่อย (Lateral Pipes) */}
                                                                                  <div className="mb-2 rounded bg-yellow-700/20 px-2 py-1">
                                                                                      <div className="grid grid-cols-2 items-center gap-2 text-xs">
                                                                                          <div className="text-left text-sm font-bold">
                                                                                              🟡
                                                                                              ท่อย่อย
                                                                                              (
                                                                                              {
                                                                                                  lateralPipesInThisZone.length
                                                                                              }{' '}
                                                                                              ท่อ)
                                                                                              (ยาวรวม:{' '}
                                                                                              {formatDistance(
                                                                                                  lateralPipesInThisZone.reduce(
                                                                                                      (
                                                                                                          sum,
                                                                                                          pipe
                                                                                                      ) =>
                                                                                                          sum +
                                                                                                          pipe.length,
                                                                                                      0
                                                                                                  )
                                                                                              )}
                                                                                              )
                                                                                          </div>
                                                                                          <div className="text-center">
                                                                                              {lateralPipesInThisZone.length >
                                                                                              0 ? (
                                                                                                  <span className="flex flex-col items-center font-semibold text-gray-100">
                                                                                                      <p>
                                                                                                          🔥
                                                                                                          ข้อมูลท่อย่อย:
                                                                                                      </p>
                                                                                                      <p>
                                                                                                          รวม{' '}
                                                                                                          {
                                                                                                              lateralPipesInThisZone.length
                                                                                                          }{' '}
                                                                                                          ท่อ
                                                                                                      </p>
                                                                                                      <p>
                                                                                                          ปลายท่อรวม:{' '}
                                                                                                          {lateralPipesInThisZone.reduce(
                                                                                                              (
                                                                                                                  sum,
                                                                                                                  pipe
                                                                                                              ) =>
                                                                                                                  sum +
                                                                                                                  pipe
                                                                                                                      .plants
                                                                                                                      .length,
                                                                                                              0
                                                                                                          )}{' '}
                                                                                                          จุด
                                                                                                      </p>
                                                                                                      <p>
                                                                                                          ใช้น้ำรวม:{' '}
                                                                                                          {lateralPipesInThisZone
                                                                                                              .reduce(
                                                                                                                  (
                                                                                                                      sum,
                                                                                                                      pipe
                                                                                                                  ) =>
                                                                                                                      sum +
                                                                                                                      pipe.totalFlowRate,
                                                                                                                  0
                                                                                                              )
                                                                                                              .toFixed(
                                                                                                                  1
                                                                                                              )}{' '}
                                                                                                          L/min
                                                                                                      </p>
                                                                                                  </span>
                                                                                              ) : (
                                                                                                  <span className="text-gray-500">
                                                                                                      ไม่พบท่อย่อยในโซน
                                                                                                  </span>
                                                                                              )}
                                                                                          </div>
                                                                                      </div>
                                                                                  </div>

                                                                                  {/* ท่อย่อยแยก (Emitter Lines) */}
                                                                                  {(() => {
                                                                                      const allEmitterLines =
                                                                                          lateralPipesInThisZone.flatMap(
                                                                                              (
                                                                                                  lateral
                                                                                              ) =>
                                                                                                  lateral.emitterLines ||
                                                                                                  []
                                                                                          );
                                                                                      return (
                                                                                          allEmitterLines.length >
                                                                                              0 && (
                                                                                              <div className="mb-2 rounded bg-green-700/20 px-2 py-1">
                                                                                                  <div className="grid grid-cols-2 items-center gap-2 text-xs">
                                                                                                      <div className="text-left text-sm font-bold">
                                                                                                          🟢
                                                                                                          ท่อย่อยแยก
                                                                                                          (
                                                                                                          {
                                                                                                              allEmitterLines.length
                                                                                                          }{' '}
                                                                                                          ท่อ)
                                                                                                      </div>
                                                                                                      <div className="text-left text-sm font-bold">
                                                                                                          ยาวรวม:{' '}
                                                                                                          {formatDistance(
                                                                                                              allEmitterLines.reduce(
                                                                                                                  (
                                                                                                                      sum,
                                                                                                                      emitter
                                                                                                                  ) =>
                                                                                                                      sum +
                                                                                                                      emitter.length,
                                                                                                                  0
                                                                                                              )
                                                                                                          )}
                                                                                                      </div>
                                                                                                  </div>
                                                                                              </div>
                                                                                          )
                                                                                      );
                                                                                  })()}

                                                                                  <div className="mt-2 text-xs text-orange-400">
                                                                                      ℹ️
                                                                                      คำนวณโดยตรงจากข้อมูลท่อย่อย
                                                                                      (Zone ID:{' '}
                                                                                      {zone.id})
                                                                                  </div>
                                                                              </div>
                                                                          );
                                                                      }

                                                                      return (
                                                                          <div className="rounded border border-blue-700/50 bg-blue-900/20 p-3">
                                                                              <h5 className="mb-2 text-sm font-semibold text-blue-300">
                                                                                  🔧 ระบบท่อในโซน
                                                                              </h5>

                                                                              {/* ท่อเมน */}
                                                                              <div className="mb-2 rounded bg-red-700/20 px-2 py-1">
                                                                                  <div className="grid grid-cols-2 items-center gap-2 text-xs">
                                                                                      <div className="text-left text-sm font-bold">
                                                                                          🔴
                                                                                          ท่อเมนหลัก
                                                                                          (
                                                                                          {zoneData
                                                                                              .mainPipesInZone
                                                                                              ?.count ||
                                                                                              0}{' '}
                                                                                          ท่อ)
                                                                                          (ยาวรวม:{' '}
                                                                                          {formatDistance(
                                                                                              zoneData
                                                                                                  .mainPipesInZone
                                                                                                  ?.totalLength ||
                                                                                                  0
                                                                                          )}
                                                                                          )
                                                                                      </div>
                                                                                      <div className="text-center">
                                                                                          {(() => {
                                                                                              const bestMain =
                                                                                                  findBestMainPipeInZone(
                                                                                                      zone.id,
                                                                                                      projectData,
                                                                                                      irrigationZones,
                                                                                                      sprinklerConfig
                                                                                                  );
                                                                                              return bestMain ? (
                                                                                                  <span className="flex flex-col items-center font-semibold text-gray-100">
                                                                                                      <p>
                                                                                                          🔥
                                                                                                          ท่อที่ต้องการน้ำมากที่สุด:{' '}
                                                                                                      </p>
                                                                                                      <p>
                                                                                                          ยาว{' '}
                                                                                                          {formatDistance(
                                                                                                              bestMain.length
                                                                                                          )}

                                                                                                          ,
                                                                                                          เชื่อม{' '}
                                                                                                          {
                                                                                                              bestMain.count
                                                                                                          }{' '}
                                                                                                          ท่อเมนรอง,
                                                                                                          ใช้น้ำ{' '}
                                                                                                          {bestMain.waterFlowRate.toFixed(
                                                                                                              1
                                                                                                          )}{' '}
                                                                                                          L/min
                                                                                                      </p>
                                                                                                  </span>
                                                                                              ) : (
                                                                                                  <span className="text-gray-500">
                                                                                                      ไม่พบท่อเมนในโซน
                                                                                                  </span>
                                                                                              );
                                                                                          })()}
                                                                                      </div>
                                                                                  </div>
                                                                              </div>

                                                                              {/* ท่อเมนรอง */}
                                                                              <div className="mb-2 rounded bg-purple-700/20 px-2 py-1">
                                                                                  <div className="grid grid-cols-2 items-center gap-2 text-xs">
                                                                                      <div className="text-left text-sm font-bold">
                                                                                          🟣
                                                                                          ท่อเมนรอง
                                                                                          (
                                                                                          {zoneData
                                                                                              .subMainPipesInZone
                                                                                              ?.count ||
                                                                                              0}{' '}
                                                                                          ท่อ)
                                                                                          (ยาวรวม:{' '}
                                                                                          {formatDistance(
                                                                                              zoneData
                                                                                                  .subMainPipesInZone
                                                                                                  ?.totalLength ||
                                                                                                  0
                                                                                          )}
                                                                                          )
                                                                                      </div>
                                                                                      <div className="text-center">
                                                                                          {(() => {
                                                                                              const bestSubMain =
                                                                                                  findBestSubMainPipeInZone(
                                                                                                      zone.id,
                                                                                                      projectData,
                                                                                                      irrigationZones,
                                                                                                      sprinklerConfig
                                                                                                  );
                                                                                              return bestSubMain ? (
                                                                                                  <span className="flex flex-col items-center font-semibold text-gray-100">
                                                                                                      <p>
                                                                                                          🔥
                                                                                                          ท่อที่ต้องการน้ำมากที่สุด:{' '}
                                                                                                      </p>
                                                                                                      <p>
                                                                                                          ยาว{' '}
                                                                                                          {formatDistance(
                                                                                                              bestSubMain.length
                                                                                                          )}

                                                                                                          ,
                                                                                                          เชื่อม{' '}
                                                                                                          {
                                                                                                              bestSubMain.count
                                                                                                          }{' '}
                                                                                                          ท่อย่อย,
                                                                                                          ใช้น้ำ{' '}
                                                                                                          {bestSubMain.waterFlowRate.toFixed(
                                                                                                              1
                                                                                                          )}{' '}
                                                                                                          L/min
                                                                                                      </p>
                                                                                                  </span>
                                                                                              ) : (
                                                                                                  <span className="text-gray-500">
                                                                                                      ไม่พบท่อเมนรองในโซน
                                                                                                  </span>
                                                                                              );
                                                                                          })()}
                                                                                      </div>
                                                                                  </div>
                                                                              </div>

                                                                              {/* ท่อย่อย */}
                                                                              <div className="mb-2 rounded bg-yellow-700/20 px-2 py-1">
                                                                                  <div className="grid grid-cols-2 items-center gap-2 text-xs">
                                                                                      <div className="text-left text-sm font-bold">
                                                                                          🟡 ท่อย่อย
                                                                                          (
                                                                                          {zoneData
                                                                                              .branchPipesInZone
                                                                                              ?.count ||
                                                                                              0}{' '}
                                                                                          ท่อ)
                                                                                          (ยาวรวม:{' '}
                                                                                          {formatDistance(
                                                                                              zoneData
                                                                                                  .branchPipesInZone
                                                                                                  ?.totalLength ||
                                                                                                  0
                                                                                          )}
                                                                                          )
                                                                                      </div>
                                                                                      <div className="text-center">
                                                                                          {(() => {
                                                                                              const bestBranch =
                                                                                                  findBestBranchPipeInZone(
                                                                                                      zone.id,
                                                                                                      projectData,
                                                                                                      irrigationZones,
                                                                                                      sprinklerConfig
                                                                                                  );
                                                                                              return bestBranch ? (
                                                                                                  <span className="flex flex-col items-center font-semibold text-gray-100">
                                                                                                      <p>
                                                                                                          🔥
                                                                                                          ท่อที่ต้องการน้ำมากที่สุด:{' '}
                                                                                                      </p>
                                                                                                      <p>
                                                                                                          ยาว{' '}
                                                                                                          {formatDistance(
                                                                                                              bestBranch.length
                                                                                                          )}

                                                                                                          ,
                                                                                                          ให้น้ำ{' '}
                                                                                                          {
                                                                                                              bestBranch.count
                                                                                                          }{' '}
                                                                                                          ต้นไม้,
                                                                                                          ใช้น้ำ{' '}
                                                                                                          {bestBranch.waterFlowRate.toFixed(
                                                                                                              1
                                                                                                          )}{' '}
                                                                                                          L/min
                                                                                                      </p>
                                                                                                  </span>
                                                                                              ) : (
                                                                                                  <span className="text-gray-500">
                                                                                                      ไม่พบท่อย่อยในโซน
                                                                                                  </span>
                                                                                              );
                                                                                          })()}
                                                                                      </div>
                                                                                  </div>
                                                                              </div>

                                                                              {/* ลบการแสดง 🔵 ท่อลาเทอรัล ออกแล้วตามที่ผู้ใช้ต้องการ */}

                                                                              {/* ท่อย่อยแยก */}
                                                                              {(zoneData
                                                                                  .emitterPipesInZone
                                                                                  ?.count || 0) >
                                                                                  0 && (
                                                                                  <div className="mb-2 rounded bg-green-700/20 px-2 py-1">
                                                                                      <div className="grid grid-cols-2 items-center gap-2 text-xs">
                                                                                          <div className="text-left text-sm font-bold">
                                                                                              🟢
                                                                                              ท่อย่อยแยก
                                                                                              (
                                                                                              {zoneData
                                                                                                  .emitterPipesInZone
                                                                                                  ?.count ||
                                                                                                  0}{' '}
                                                                                              ท่อ)
                                                                                          </div>
                                                                                          <div className="text-left text-sm font-bold">
                                                                                              ยาวรวม:{' '}
                                                                                              {formatDistance(
                                                                                                  zoneData
                                                                                                      .emitterPipesInZone
                                                                                                      ?.totalLength ||
                                                                                                      0
                                                                                              )}
                                                                                          </div>
                                                                                      </div>
                                                                                  </div>
                                                                              )}
                                                                          </div>
                                                                      );
                                                                  })()}
                                                              </div>
                                                          )}
                                                      </div>
                                                  );
                                              })
                                            : // แสดงข้อมูลโซนปกติ/พื้นที่หลัก
                                              projectSummary.zoneDetails.map((zone, index) => {
                                                  // const plantInfo = zone.plantData || null;
                                                  // const plantName = plantInfo?.name || 'ไม่ระบุ';
                                                  const waterPerPlant = zone.waterPerPlant || 0;
                                                  // const plantSpacing = plantInfo?.plantSpacing || 0;
                                                  // const rowSpacing = plantInfo?.rowSpacing || 0;
                                                  const isCollapsed = collapsedZones.has(
                                                      zone.zoneId
                                                  );

                                                  const zoneColor = projectData.useZones
                                                      ? projectData.zones.find(
                                                            (z) => z.id === zone.zoneId
                                                        )?.color
                                                      : null;

                                                  return (
                                                      <div
                                                          key={zone.zoneId}
                                                          className="rounded bg-gray-700 p-4"
                                                      >
                                                          <div
                                                              className="-m-2 flex cursor-pointer items-center justify-between rounded p-2 transition-colors hover:bg-gray-600"
                                                              onClick={() =>
                                                                  toggleZoneCollapse(zone.zoneId)
                                                              }
                                                          >
                                                              <div className="flex items-center gap-3">
                                                                  <div className="text-lg">
                                                                      {isCollapsed ? '▶️' : '🔽'}
                                                                  </div>
                                                                  <h4 className="text-lg font-semibold text-green-300">
                                                                      {zone.zoneName}
                                                                  </h4>
                                                              </div>
                                                              <div className="flex items-center gap-2">
                                                                  {zoneColor && (
                                                                      <div
                                                                          className="h-4 w-4 rounded"
                                                                          style={{
                                                                              backgroundColor:
                                                                                  zoneColor,
                                                                          }}
                                                                      />
                                                                  )}
                                                                  <span className="text-sm text-gray-400">
                                                                      #{index + 1}
                                                                  </span>
                                                              </div>
                                                          </div>

                                                          {!isCollapsed && (
                                                              <div>
                                                                  {/* Plant Information */}
                                                                  <div className="mt-4 rounded border border-green-700/50 bg-green-900/20 p-3">
                                                                      <h5 className="mb-2 text-sm font-semibold text-green-300">
                                                                          🌱 ข้อมูลการปลูก
                                                                      </h5>
                                                                      <div className="grid grid-cols-5 gap-3 text-sm">
                                                                          <div>
                                                                              <span className="text-gray-200">
                                                                                  พื้นที่โซน:
                                                                              </span>
                                                                              <div className="font-bold text-blue-400">
                                                                                  {zone.areaInRai.toFixed(
                                                                                      2
                                                                                  )}{' '}
                                                                                  ไร่
                                                                              </div>
                                                                          </div>
                                                                          <div>
                                                                              <span className="text-gray-200">
                                                                                  จำนวนต้นไม้:
                                                                              </span>
                                                                              <div className="font-bold text-green-400">
                                                                                  {zone.plantCount.toLocaleString()}{' '}
                                                                                  ต้น
                                                                              </div>
                                                                          </div>
                                                                          <div>
                                                                              <span className="text-gray-200">
                                                                                  น้ำต่อต้น:
                                                                              </span>
                                                                              <div className="font-bold text-cyan-400">
                                                                                  {waterPerPlant.toFixed(
                                                                                      0
                                                                                  )}{' '}
                                                                                  ลิตร/ต้น
                                                                              </div>
                                                                          </div>
                                                                          <div>
                                                                              <span className="text-gray-200">
                                                                                  น้ำรวมต่อครั้ง:
                                                                              </span>
                                                                              <div className="font-bold text-cyan-400">
                                                                                  {formatWaterVolume(
                                                                                      zone.waterNeedPerSession
                                                                                  )}
                                                                                  /ครั้ง
                                                                              </div>
                                                                          </div>
                                                                          <div>
                                                                              <span className="text-gray-200">
                                                                                  น้ำรวมต่อนาที:
                                                                              </span>
                                                                              <div className="font-bold text-cyan-400">
                                                                                  {zone.plantCount *
                                                                                      (enhancedStats
                                                                                          ?.sprinklerFlowRate
                                                                                          ?.flowRatePerPlant ||
                                                                                          2.5)}{' '}
                                                                                  ลิตร/นาที
                                                                              </div>
                                                                          </div>
                                                                      </div>
                                                                  </div>

                                                                  {/* Pipe System Information */}
                                                                  <div className="rounded border border-blue-700/50 bg-blue-900/20 p-3">
                                                                      <h5 className="mb-2 text-sm font-semibold text-blue-300">
                                                                          🔧 ระบบท่อในโซน
                                                                      </h5>

                                                                      {/* ท่อเมน */}
                                                                      <div className="mb-3 rounded bg-red-700/20 p-2">
                                                                          <h6 className="mb-2 text-xs font-medium text-red-300">
                                                                              🔴 ท่อเมนหลัก
                                                                          </h6>
                                                                          <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
                                                                              <div className="flex items-center gap-2">
                                                                                  <span className="text-gray-200">
                                                                                      จำนวน:
                                                                                  </span>
                                                                                  <span className="font-bold text-red-400">
                                                                                      {
                                                                                          zone
                                                                                              .mainPipesInZone
                                                                                              .count
                                                                                      }{' '}
                                                                                      ท่อ
                                                                                  </span>
                                                                              </div>
                                                                              <div className="flex items-center gap-2">
                                                                                  <span className="text-gray-200">
                                                                                      ยาวรวม:
                                                                                  </span>
                                                                                  <span className="font-bold text-red-400">
                                                                                      {formatDistance(
                                                                                          zone
                                                                                              .mainPipesInZone
                                                                                              .totalLength
                                                                                      )}
                                                                                  </span>
                                                                              </div>
                                                                              <div className="flex items-center gap-2">
                                                                                  {(() => {
                                                                                      const bestMain =
                                                                                          findBestMainPipeInZone(
                                                                                              zone.zoneId,
                                                                                              projectData,
                                                                                              irrigationZones,
                                                                                              sprinklerConfig
                                                                                          );
                                                                                      return bestMain ? (
                                                                                          <span className="text-xs font-semibold text-orange-400">
                                                                                              🔥
                                                                                              ต้องการน้ำมากที่สุด:
                                                                                              ยาว{' '}
                                                                                              {formatDistance(
                                                                                                  bestMain.length
                                                                                              )}
                                                                                              ,
                                                                                              เชื่อม{' '}
                                                                                              {
                                                                                                  bestMain.count
                                                                                              }{' '}
                                                                                              ท่อเมนรอง,{' '}
                                                                                              {bestMain.waterFlowRate.toFixed(
                                                                                                  1
                                                                                              )}{' '}
                                                                                              L/min
                                                                                          </span>
                                                                                      ) : (
                                                                                          <span className="text-xs text-gray-500">
                                                                                              ไม่พบท่อเมนในโซน
                                                                                          </span>
                                                                                      );
                                                                                  })()}
                                                                              </div>
                                                                          </div>
                                                                      </div>

                                                                      {/* ท่อเมนรอง */}
                                                                      <div className="mb-3 rounded bg-purple-700/20 p-2">
                                                                          <h6 className="mb-2 text-xs font-medium text-purple-300">
                                                                              🟣 ท่อเมนรอง
                                                                          </h6>
                                                                          <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
                                                                              <div className="flex items-center gap-2">
                                                                                  <span className="text-gray-200">
                                                                                      จำนวน:
                                                                                  </span>
                                                                                  <span className="font-bold text-purple-400">
                                                                                      {
                                                                                          zone
                                                                                              .subMainPipesInZone
                                                                                              .count
                                                                                      }{' '}
                                                                                      ท่อ
                                                                                  </span>
                                                                              </div>
                                                                              <div className="flex items-center gap-2">
                                                                                  <span className="text-gray-200">
                                                                                      ยาวรวม:
                                                                                  </span>
                                                                                  <span className="font-bold text-purple-400">
                                                                                      {formatDistance(
                                                                                          zone
                                                                                              .subMainPipesInZone
                                                                                              .totalLength
                                                                                      )}
                                                                                  </span>
                                                                              </div>
                                                                              <div className="flex items-center gap-2">
                                                                                  {(() => {
                                                                                      const bestSubMain =
                                                                                          findBestSubMainPipeInZone(
                                                                                              zone.zoneId,
                                                                                              projectData,
                                                                                              irrigationZones,
                                                                                              sprinklerConfig
                                                                                          );
                                                                                      return bestSubMain ? (
                                                                                          <span className="text-xs font-semibold text-orange-400">
                                                                                              🔥
                                                                                              ต้องการน้ำมากที่สุด:
                                                                                              ยาว{' '}
                                                                                              {formatDistance(
                                                                                                  bestSubMain.length
                                                                                              )}
                                                                                              ,
                                                                                              เชื่อม{' '}
                                                                                              {
                                                                                                  bestSubMain.count
                                                                                              }{' '}
                                                                                              ท่อย่อย,{' '}
                                                                                              {bestSubMain.waterFlowRate.toFixed(
                                                                                                  1
                                                                                              )}{' '}
                                                                                              L/min
                                                                                          </span>
                                                                                      ) : (
                                                                                          <span className="text-xs text-gray-500">
                                                                                              ไม่พบท่อเมนรองในโซน
                                                                                          </span>
                                                                                      );
                                                                                  })()}
                                                                              </div>
                                                                          </div>
                                                                      </div>

                                                                      {/* ท่อย่อย */}
                                                                      <div className="mb-3 rounded bg-yellow-700/20 p-2">
                                                                          <h6 className="mb-2 text-xs font-medium text-yellow-300">
                                                                              🟡 ท่อย่อย
                                                                          </h6>
                                                                          <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
                                                                              <div className="flex items-center gap-2">
                                                                                  <span className="text-gray-200">
                                                                                      จำนวน:
                                                                                  </span>
                                                                                  <span className="font-bold text-yellow-400">
                                                                                      {
                                                                                          zone
                                                                                              .branchPipesInZone
                                                                                              .count
                                                                                      }{' '}
                                                                                      ท่อ
                                                                                  </span>
                                                                              </div>
                                                                              <div className="flex items-center gap-2">
                                                                                  <span className="text-gray-200">
                                                                                      ยาวรวม:
                                                                                  </span>
                                                                                  <span className="font-bold text-yellow-400">
                                                                                      {formatDistance(
                                                                                          zone
                                                                                              .branchPipesInZone
                                                                                              .totalLength
                                                                                      )}
                                                                                  </span>
                                                                              </div>
                                                                              <div className="flex items-center gap-2">
                                                                                  {(() => {
                                                                                      const bestBranch =
                                                                                          findBestBranchPipeInZone(
                                                                                              zone.zoneId,
                                                                                              projectData,
                                                                                              irrigationZones,
                                                                                              sprinklerConfig
                                                                                          );
                                                                                      return bestBranch ? (
                                                                                          <span className="text-xs font-semibold text-orange-400">
                                                                                              🔥
                                                                                              ต้องการน้ำมากที่สุด:
                                                                                              ยาว{' '}
                                                                                              {formatDistance(
                                                                                                  bestBranch.length
                                                                                              )}
                                                                                              ,
                                                                                              ให้น้ำ{' '}
                                                                                              {
                                                                                                  bestBranch.count
                                                                                              }{' '}
                                                                                              ต้นไม้,{' '}
                                                                                              {bestBranch.waterFlowRate.toFixed(
                                                                                                  1
                                                                                              )}{' '}
                                                                                              L/min
                                                                                          </span>
                                                                                      ) : (
                                                                                          <span className="text-xs text-gray-500">
                                                                                              ไม่พบท่อย่อยในโซน
                                                                                          </span>
                                                                                      );
                                                                                  })()}
                                                                              </div>
                                                                          </div>
                                                                      </div>

                                                                      {/* ท่อย่อยแยก */}
                                                                      {zone.emitterPipesInZone &&
                                                                          zone.emitterPipesInZone
                                                                              .count > 0 && (
                                                                              <div className="mb-3 rounded bg-green-700/20 p-2">
                                                                                  <h6 className="mb-2 text-xs font-medium text-green-300">
                                                                                      🟢 ท่อย่อยแยก
                                                                                  </h6>
                                                                                  <div className="flex flex-wrap items-center justify-between gap-4 text-xs">
                                                                                      <div className="flex items-center gap-2">
                                                                                          <span className="text-gray-200">
                                                                                              จำนวน:
                                                                                          </span>
                                                                                          <span className="font-bold text-green-400">
                                                                                              {
                                                                                                  zone
                                                                                                      .emitterPipesInZone
                                                                                                      .count
                                                                                              }{' '}
                                                                                              ท่อ
                                                                                          </span>
                                                                                      </div>

                                                                                      <div className="flex items-center gap-2 font-bold text-green-400">
                                                                                          <div className="flex items-center gap-2">
                                                                                              <span className="text-gray-200">
                                                                                                  ยาวรวม:
                                                                                              </span>
                                                                                              <span className="font-bold text-green-400">
                                                                                                  {formatDistance(
                                                                                                      zone
                                                                                                          .emitterPipesInZone
                                                                                                          .totalLength
                                                                                                  )}
                                                                                              </span>
                                                                                          </div>
                                                                                      </div>
                                                                                  </div>
                                                                              </div>
                                                                          )}
                                                                  </div>
                                                              </div>
                                                          )}
                                                      </div>
                                                  );
                                              })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <Footer />

            {showSprinklerConfigModal && projectData && (
                <SprinklerConfigModal
                    isOpen={showSprinklerConfigModal}
                    onClose={() => setShowSprinklerConfigModal(false)}
                    onSave={handleSprinklerConfigSave}
                    plantCount={projectData.plants?.length || 0}
                    t={t}
                />
            )}
        </div>
    );
}

export default EnhancedHorticultureResultsPageContent;
