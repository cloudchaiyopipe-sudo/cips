// 1. Import
import { useState, useEffect, useRef } from 'react';
import { getTranslations } from '../utils/language';

// Google Maps TypeScript declarations
interface MapOptions {
    zoom: number;
    center: { lat: number; lng: number };
    mapTypeId: string;
    styles?: Array<{
        featureType: string;
        elementType: string;
        stylers: Array<{ color: string }>;
    }>;
}

interface MarkerOptions {
    position: { lat: number; lng: number };
    map: unknown;
    title: string;
    icon?: {
        url: string;
        scaledSize: unknown;
        anchor: unknown;
    };
}

// 2. FreeFooter Component
function FreeFooter() {
    // State
    const [mapLoaded, setMapLoaded] = useState(false);
    const mapRef = useRef<HTMLDivElement>(null);

    // State for translations
    const [translations, setTranslations] = useState(getTranslations());

    // 3. Hooks
    // Listen for language changes
    useEffect(() => {
        const handleLanguageChange = () => {
            setTranslations(getTranslations());
        };

        // Listen for storage changes (when language is changed in other components)
        window.addEventListener('storage', handleLanguageChange);

        // Listen for custom language change event
        window.addEventListener('languageChanged', handleLanguageChange);

        // Also check on focus (when user comes back to tab)
        window.addEventListener('focus', handleLanguageChange);

        return () => {
            window.removeEventListener('storage', handleLanguageChange);
            window.removeEventListener('languageChanged', handleLanguageChange);
            window.removeEventListener('focus', handleLanguageChange);
        };
    }, []);

    useEffect(() => {
        let isMounted = true;

        // Load Google Maps script
        const loadGoogleMaps = () => {
            if (window.google && window.google.maps) {
                if (isMounted) {
                    setMapLoaded(true);
                    initializeMap();
                }
                return;
            }

            const script = document.createElement('script');
            script.src = `https://maps.googleapis.com/maps/api/js?key=${process.env.REACT_APP_GOOGLE_MAPS_API_KEY || 'YOUR_API_KEY'}&libraries=places`;
            script.async = true;
            script.defer = true;
            script.onload = () => {
                if (isMounted) {
                    setMapLoaded(true);
                    initializeMap();
                }
            };
            document.head.appendChild(script);
        };

        const initializeMap = () => {
            if (!isMounted || !mapRef.current || !window.google) return;

            // Kanok Products location coordinates
            const kanokLocation = {
                lat: 13.6567, // Bang Bon District, Bangkok - Kanok Products Co., Ltd.
                lng: 100.3956,
            };

            const mapOptions: MapOptions = {
                zoom: 19,
                center: kanokLocation,
                mapTypeId: window.google.maps.MapTypeId.SATELLITE,
                styles: [
                    {
                        featureType: 'all',
                        elementType: 'geometry.fill',
                        stylers: [{ color: '#2d3748' }],
                    },
                    {
                        featureType: 'water',
                        elementType: 'geometry',
                        stylers: [{ color: '#1e3a8a' }],
                    },
                    {
                        featureType: 'road',
                        elementType: 'geometry',
                        stylers: [{ color: '#374151' }],
                    },
                ],
            };

            const map = new window.google.maps.Map(mapRef.current, mapOptions);

            // Add marker for Kanok Products
            const markerOptions: MarkerOptions = {
                position: kanokLocation,
                map: map,
                title: 'Kanok Products Co., Ltd.',
                icon: {
                    url:
                        'data:image/svg+xml;charset=UTF-8,' +
                        encodeURIComponent(`
                        <svg width="40" height="40" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
                            <circle cx="20" cy="20" r="18" fill="#10b981" stroke="#ffffff" stroke-width="2"/>
                            <text x="20" y="26" text-anchor="middle" fill="white" font-size="16" font-weight="bold">K</text>
                        </svg>
                    `),
                    scaledSize: new window.google.maps.Size(40, 40),
                    anchor: new window.google.maps.Point(20, 20),
                },
            };

            new window.google.maps.Marker(markerOptions);
        };

        loadGoogleMaps();

        // Cleanup function
        return () => {
            isMounted = false;
        };
    }, []);

    // 4. Return TSX
    return (
        <div className="w-full bg-[#000005] px-4 pb-0 pt-6 md:px-6 md:py-8">
            <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 text-xs text-white md:gap-8 md:text-sm">
                {/* Kanok Products */}
                <div className="space-y-1 md:space-y-2">
                    <h3 className="font-bold">{translations.kanokProducts}</h3>
                    <p className="leading-relaxed text-slate-200">{translations.kanokAddress}</p>
                    <p>{translations.kanokPhone}</p>
                    <p className="text-slate-300">{translations.kanokWebsite}</p>
                </div>

                {/* Chaiyo Pipe & Fitting */}
                <div className="space-y-1 md:space-y-2">
                    <h3 className="font-bold">{translations.chaiyoPipeFitting}</h3>
                    <p className="leading-relaxed text-slate-200">{translations.chaiyoAddress}</p>
                    <p>{translations.chaiyoPhone}</p>
                    <p className="text-slate-300">{translations.chaiyoEmail}</p>
                </div>
            </div>

            {/* Map Section */}
            <div className="mx-auto mt-6 max-w-4xl overflow-hidden rounded-lg bg-slate-300 md:mt-8">
                <div className="relative">
                    <div
                        ref={mapRef}
                        className="aspect-[2/1] w-full"
                        style={{ minHeight: '200px' }}
                    />
                    {!mapLoaded && (
                        <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-slate-200 to-slate-300">
                            <div className="text-center">
                                <svg
                                    className="mx-auto h-16 w-16 text-slate-600 md:h-20 md:w-20"
                                    fill="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" />
                                </svg>
                                <p className="mt-2 text-sm text-slate-600">
                                    {translations.loadingMap}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// 3. Export
export default FreeFooter;
