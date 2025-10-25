/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Wrapper, Status } from '@googlemaps/react-wrapper';

interface HorticultureMapComponentProps {
    center: [number, number];
    zoom: number;
    onMapLoad?: (map: google.maps.Map) => void;
    children?: React.ReactNode;
    mapOptions?: Partial<google.maps.MapOptions>;
}

const getGoogleMapsConfig = () => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';

    return {
        apiKey,
        libraries: ['drawing', 'geometry', 'places', 'marker', 'elevation'],
        defaultMapOptions: {
            mapTypeId: 'hybrid', // เปลี่ยนจาก 'satellite' เป็น 'hybrid' เพื่อแสดงชื่อสถานที่
            disableDefaultUI: false,
            zoomControl: true,
            streetViewControl: true,
            fullscreenControl: true,
            mapTypeControl: true,
            mapTypeControlOptions: {
                position: 'TOP_CENTER' as any,
                style: 'HORIZONTAL_BAR' as any,
                mapTypeIds: ['roadmap', 'satellite', 'hybrid', 'terrain'],
            },
            gestureHandling: 'greedy' as const,
            clickableIcons: true,
            scrollwheel: true,
            disableDoubleClickZoom: true,
            // เพิ่มการตั้งค่าเพื่อแสดงชื่อสถานที่
            styles: [
                {
                    featureType: 'poi',
                    elementType: 'labels',
                    stylers: [{ visibility: 'on' }]
                },
                {
                    featureType: 'administrative',
                    elementType: 'labels',
                    stylers: [{ visibility: 'on' }]
                },
                {
                    featureType: 'road',
                    elementType: 'labels',
                    stylers: [{ visibility: 'on' }]
                },
                {
                    featureType: 'transit',
                    elementType: 'labels',
                    stylers: [{ visibility: 'on' }]
                },
                {
                    featureType: 'water',
                    elementType: 'labels',
                    stylers: [{ visibility: 'on' }]
                }
            ]
        },
    };
};

const MapLoadingComponent: React.FC = () => (
    <div className="flex h-full w-full items-center justify-center bg-gray-900">
        <div className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-500"></div>
            <p className="text-white">กำลังโหลด Google Maps...</p>
        </div>
    </div>
);

const MapErrorComponent: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => {
    const config = getGoogleMapsConfig();

    return (
        <div className="flex h-full w-full items-center justify-center bg-gray-900">
            <div className="max-w-md rounded-lg bg-red-900 p-6 text-center text-white">
                <div className="mb-4 text-4xl">❌</div>
                <h3 className="mb-2 text-lg font-bold">ไม่สามารถโหลด Google Maps ได้</h3>
                <p className="mb-4 text-sm text-gray-300">
                    {!config.apiKey
                        ? 'ไม่พบ Google Maps API Key'
                        : 'เกิดข้อผิดพลาดในการเชื่อมต่อ Google Maps'}
                </p>
                {onRetry && (
                    <button
                        onClick={onRetry}
                        className="w-full rounded bg-red-600 px-4 py-2 transition-colors hover:bg-red-700"
                    >
                        ลองใหม่
                    </button>
                )}
            </div>
        </div>
    );
};

const MapComponent: React.FC<{
    center: google.maps.LatLngLiteral;
    zoom: number;
    onLoad?: (map: google.maps.Map) => void;
    children?: React.ReactNode;
    mapOptions?: Partial<google.maps.MapOptions>;
}> = ({ center, zoom, onLoad, children, mapOptions }) => {
    const validCenter = useMemo(() => 
        center &&
        typeof center.lat === 'number' &&
        typeof center.lng === 'number' &&
        !isNaN(center.lat) &&
        !isNaN(center.lng) &&
        isFinite(center.lat) &&
        isFinite(center.lng)
            ? center
            : { lat: 13.7563, lng: 100.5018 },
        [center]
    );

    const validZoom = useMemo(() => 
        typeof zoom === 'number' && !isNaN(zoom) && isFinite(zoom) ? zoom : 16,
        [zoom]
    );
    const ref = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<google.maps.Map>();
    const [isMapInitialized, setIsMapInitialized] = useState(false);

    useEffect(() => {
        if (ref.current && !map && window.google?.maps) {
            try {
                const config = getGoogleMapsConfig();

                const mergedOptions = {
                    ...config.defaultMapOptions,
                    ...mapOptions,
                };
                const newMap = new window.google.maps.Map(ref.current, {
                    center: validCenter,
                    zoom: validZoom,
                    ...mergedOptions,
                });

                newMap.setOptions({
                    minZoom: null,
                    maxZoom: null,
                    restriction: null,
                    zoomControl: true,
                    scrollwheel: true,
                    gestureHandling: 'greedy',
                    // เพิ่มการตั้งค่าเพื่อแสดงชื่อสถานที่
                    clickableIcons: true,
                    mapTypeControl: true,
                    mapTypeControlOptions: {
                        position: google.maps.ControlPosition.TOP_CENTER,
                        style: google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
                        mapTypeIds: [
                            google.maps.MapTypeId.ROADMAP,
                            google.maps.MapTypeId.SATELLITE,
                            google.maps.MapTypeId.HYBRID,
                            google.maps.MapTypeId.TERRAIN
                        ]
                    },
                    // เพิ่มการตั้งค่าเพื่อแสดงชื่อสถานที่
                    styles: [
                        {
                            featureType: 'poi',
                            elementType: 'labels',
                            stylers: [{ visibility: 'on' }]
                        },
                        {
                            featureType: 'administrative',
                            elementType: 'labels',
                            stylers: [{ visibility: 'on' }]
                        },
                        {
                            featureType: 'road',
                            elementType: 'labels',
                            stylers: [{ visibility: 'on' }]
                        },
                        {
                            featureType: 'transit',
                            elementType: 'labels',
                            stylers: [{ visibility: 'on' }]
                        },
                        {
                            featureType: 'water',
                            elementType: 'labels',
                            stylers: [{ visibility: 'on' }]
                        }
                    ]
                });

                let isZooming = false;
                const customZoomHandler = (e: WheelEvent) => {
                    if (isZooming) return;
                    isZooming = true;

                    e.preventDefault();
                    e.stopPropagation();

                    const currentZoom = newMap.getZoom() || 10;
                    const delta = e.deltaY > 0 ? -0.5 : 0.5;
                    const newZoom = currentZoom + delta;

                    if (newZoom >= 1 && newZoom <= 50) {
                        newMap.setZoom(newZoom);

                        if (newZoom > 25) {
                            const center = newMap.getCenter();
                            if (center) {
                                setTimeout(() => {
                                    newMap.panTo(center);
                                }, 10);
                            }
                        }
                    }

                    setTimeout(() => {
                        isZooming = false;
                    }, 50);
                };

                const mapContainer = ref.current;
                mapContainer.addEventListener('wheel', customZoomHandler, {
                    passive: false,
                    capture: true,
                });

                newMap.addListener('zoom_changed', () => {
                    const currentZoom = newMap.getZoom();
                    if (currentZoom && currentZoom > 25) {
                        newMap.setOptions({
                            minZoom: null,
                            maxZoom: null,
                        });
                    }
                    
                    // ตั้งค่าให้แสดงชื่อสถานที่เมื่อ zoom เปลี่ยน
                    if (currentZoom && currentZoom >= 10) {
                        newMap.setOptions({
                            clickableIcons: true,
                            mapTypeControl: true,
                        });
                    }
                });

                // เพิ่มการตั้งค่าเพื่อแสดงชื่อสถานที่เมื่อโหลดแผนที่เสร็จ
                newMap.addListener('idle', () => {
                    // ตั้งค่าให้แสดงชื่อสถานที่ต่างๆ
                    newMap.setOptions({
                        clickableIcons: true,
                        mapTypeControl: true
                    });
                });

                setMap(newMap);
                setIsMapInitialized(true);
                onLoad?.(newMap);
            } catch (error) {
                console.error('Error creating Google Map:', error);
            }
        }
    }, [ref, map, validCenter, validZoom, onLoad, mapOptions]);

    useEffect(() => {
        if (map && !isMapInitialized) {
            map.setCenter(validCenter);
        }
    }, [map, validCenter, isMapInitialized]);

    return (
        <>
            <div ref={ref} style={{ width: '100%', height: '100%' }} />

            {React.Children.map(children as React.ReactNode, (child) => {
                if (React.isValidElement(child)) {
                    return React.cloneElement(child, { map } as any);
                }
            })}
        </>
    );
};

const renderMap = (status: Status): React.ReactElement => {
    switch (status) {
        case Status.LOADING:
            return <MapLoadingComponent />;
        case Status.FAILURE:
            return <MapErrorComponent onRetry={() => window.location.reload()} />;
        case Status.SUCCESS:
            return <div style={{ width: '100%', height: '100%' }} />;
        default:
            return <MapLoadingComponent />;
    }
};

const HorticultureMapComponent: React.FC<HorticultureMapComponentProps> = ({
    center,
    zoom,
    onMapLoad,
    children,
    mapOptions,
}) => {
    const config = getGoogleMapsConfig();

    if (!config.apiKey) {
        return <MapErrorComponent onRetry={() => window.location.reload()} />;
    }

    const validCenter =
        center &&
        Array.isArray(center) &&
        center.length === 2 &&
        typeof center[0] === 'number' &&
        typeof center[1] === 'number' &&
        !isNaN(center[0]) &&
        !isNaN(center[1]) &&
        isFinite(center[0]) &&
        isFinite(center[1])
            ? { lat: center[0], lng: center[1] }
            : { lat: 13.7563, lng: 100.5018 };

    const validZoom = typeof zoom === 'number' && !isNaN(zoom) && isFinite(zoom) ? zoom : 16;

    return (
        <Wrapper
            apiKey={config.apiKey}
            render={renderMap}
            libraries={config.libraries as any}
            version="weekly"
        >
            <MapComponent
                center={validCenter}
                zoom={validZoom}
                onLoad={onMapLoad}
                mapOptions={mapOptions}
            >
                {children}
            </MapComponent>
        </Wrapper>
    );
};

export default HorticultureMapComponent;
