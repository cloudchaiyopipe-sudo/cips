import React, { useEffect, useRef, useState } from 'react';

// Extend Window interface to include google
declare global {
    interface Window {
        google: any;
    }
}

interface KhokNongNaMapProps {
    onLocationSelect?: (location: google.maps.LatLng) => void;
    initialCenter?: google.maps.LatLngLiteral;
    initialZoom?: number;
    height?: string;
}

const KhokNongNaMap: React.FC<KhokNongNaMapProps> = ({
    onLocationSelect,
    initialCenter = { lat: 13.7563, lng: 100.5018 }, // Bangkok center
    initialZoom = 10,
    height = '400px',
}) => {
    const mapRef = useRef<HTMLDivElement>(null);
    const [map, setMap] = useState<google.maps.Map | null>(null);
    const [marker, setMarker] = useState<google.maps.Marker | null>(null);
    const [isLoaded, setIsLoaded] = useState(false);

    const initializeMap = () => {
        if (mapRef.current) {
            const mapInstance = new google.maps.Map(mapRef.current, {
                center: initialCenter,
                zoom: initialZoom,
                mapTypeId: google.maps.MapTypeId.HYBRID,
                mapTypeControl: true,
                streetViewControl: true,
                fullscreenControl: true,
                zoomControl: true,
                scrollwheel: true, // เปิดใช้งานการซูมด้วยเมาส์ล้อ
                gestureHandling: 'auto', // เปิดใช้งานการซูมด้วยการสัมผัสบนมือถือ
                disableDoubleClickZoom: false, // เปิดใช้งานการซูมด้วยการดับเบิลคลิก
                styles: [
                    {
                        featureType: 'water',
                        elementType: 'geometry',
                        stylers: [{ color: '#4A90E2' }],
                    },
                    {
                        featureType: 'landscape',
                        elementType: 'geometry',
                        stylers: [{ color: '#8FBC8F' }],
                    },
                ],
            });

            setMap(mapInstance);

            // Add click listener for location selection
            mapInstance.addListener('click', (event: google.maps.MapMouseEvent) => {
                if (event.latLng) {
                    // Remove existing marker
                    if (marker) {
                        marker.setMap(null);
                    }

                    // Add new marker
                    const newMarker = new google.maps.Marker({
                        position: event.latLng,
                        map: mapInstance,
                        title: 'Selected Location',
                        icon: {
                            url:
                                'data:image/svg+xml;charset=UTF-8,' +
                                encodeURIComponent(`
                <svg width="32" height="32" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">
                  <circle cx="16" cy="16" r="12" fill="#4A90E2" stroke="#fff" stroke-width="2"/>
                  <circle cx="16" cy="16" r="6" fill="#fff"/>
                </svg>
              `),
                            scaledSize: new google.maps.Size(32, 32),
                        },
                    });

                    setMarker(newMarker);
                    onLocationSelect?.(event.latLng);
                }
            });

            setIsLoaded(true);
        }
    };

    useEffect(() => {
        // Load Google Maps script if not already loaded
        const loadGoogleMaps = () => {
            if (window.google && window.google.maps) {
                initializeMap();
                return;
            }

            // Check if script is already being loaded
            const existingScript = document.getElementById('__googleMapsScriptId');
            if (existingScript) {
                // Script is loading, wait for it
                const checkLoaded = setInterval(() => {
                    if (window.google && window.google.maps) {
                        clearInterval(checkLoaded);
                        initializeMap();
                    }
                }, 100);

                // Cleanup after 10 seconds
                setTimeout(() => clearInterval(checkLoaded), 10000);
                return;
            }

            // Create and load the script
            const script = document.createElement('script');
            script.id = '__googleMapsScriptId';
            script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}&libraries=places,geometry,marker,elevation`;
            script.async = true;
            script.defer = true;
            script.onload = () => {
                initializeMap();
            };
            script.onerror = () => {
                console.error('Failed to load Google Maps API');
                setIsLoaded(false);
            };
            document.head.appendChild(script);
        };

        loadGoogleMaps();
    }, [initialCenter, initialZoom, onLocationSelect]);

    return (
        <div className="relative">
            <div
                ref={mapRef}
                style={{ height }}
                className="w-full rounded-lg border border-gray-300 shadow-lg"
            />
            {!isLoaded && (
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-gray-100">
                    <div className="text-center">
                        <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
                        <p className="text-gray-600">กำลังโหลดแผนที่...</p>
                    </div>
                </div>
            )}
        </div>
    );
};

export default KhokNongNaMap;
