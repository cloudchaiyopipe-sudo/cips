import React, { useState, useEffect, useRef } from 'react';

// Extend Window interface to include google
declare global {
    interface Window {
        google: any;
    }
}

interface SearchResult {
    place_id: string;
    formatted_address: string;
    name: string;
    geometry: {
        location: {
            lat: number;
            lng: number;
        };
    };
}

interface KhokNongNaSearchProps {
    onLocationSelect: (location: google.maps.LatLng, address: string) => void;
    placeholder?: string;
}

const KhokNongNaSearch: React.FC<KhokNongNaSearchProps> = ({
    onLocationSelect,
    placeholder = 'ค้นหาตำแหน่งสำหรับโคกหนองนา...',
}) => {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

    useEffect(() => {
        // Initialize Google Places Autocomplete
        const initializeAutocomplete = () => {
            if (window.google && window.google.maps && window.google.maps.places) {
                const input = document.getElementById('khok-nong-na-search') as HTMLInputElement;
                if (input && !autocompleteRef.current) {
                    autocompleteRef.current = new google.maps.places.Autocomplete(input, {
                        types: ['geocode', 'establishment'],
                        componentRestrictions: { country: 'th' }, // Restrict to Thailand
                        fields: ['place_id', 'formatted_address', 'name', 'geometry'],
                    });

                    autocompleteRef.current.addListener('place_changed', () => {
                        const place = autocompleteRef.current?.getPlace();
                        if (place && place.geometry && place.geometry.location) {
                            const location = place.geometry.location;
                            const address = place.formatted_address || place.name || '';
                            onLocationSelect(location, address);
                            setQuery(address);
                            setShowResults(false);
                        }
                    });
                }
            }
        };

        // Load Google Maps script if not already loaded
        const loadGoogleMaps = () => {
            if (window.google && window.google.maps && window.google.maps.places) {
                initializeAutocomplete();
                return;
            }

            // Check if script is already being loaded
            const existingScript = document.getElementById('__googleMapsScriptId');
            if (existingScript) {
                // Script is loading, wait for it
                const checkLoaded = setInterval(() => {
                    if (window.google && window.google.maps && window.google.maps.places) {
                        clearInterval(checkLoaded);
                        initializeAutocomplete();
                    }
                }, 100);

                // Cleanup after 10 seconds
                setTimeout(() => clearInterval(checkLoaded), 10000);
                return;
            }

            // Create and load the script
            const script = document.createElement('script');
            script.id = '__googleMapsScriptId';
            script.src = `https://maps.googleapis.com/maps/api/js?key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''}&libraries=places,drawing,geometry,marker,elevation`;
            script.async = true;
            script.defer = true;
            script.onload = () => {
                initializeAutocomplete();
            };
            script.onerror = () => {
                console.error('Failed to load Google Maps API');
            };
            document.head.appendChild(script);
        };

        loadGoogleMaps();
    }, [onLocationSelect]);

    // Handle click outside to close results
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        setQuery(value);

        if (value.length > 2) {
            setShowResults(true);
        } else {
            setShowResults(false);
            setResults([]);
        }
    };

    const handleResultClick = (result: SearchResult) => {
        const location = new google.maps.LatLng(
            result.geometry.location.lat,
            result.geometry.location.lng
        );
        onLocationSelect(location, result.formatted_address);
        setQuery(result.formatted_address);
        setShowResults(false);
    };

    return (
        <div ref={searchRef} className="relative w-full">
            <div className="relative">
                <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                    <svg
                        className="h-5 w-5 text-gray-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                        />
                    </svg>
                </div>
                <input
                    id="khok-nong-na-search"
                    type="text"
                    value={query}
                    onChange={handleInputChange}
                    placeholder={placeholder}
                    className="block w-full rounded-lg border border-gray-300 bg-white py-3 pl-10 pr-3 text-sm leading-5 placeholder-gray-500 focus:border-blue-500 focus:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {isLoading && (
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3">
                        <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-blue-600"></div>
                    </div>
                )}
            </div>

            {/* Search Results Dropdown */}
            {showResults && results.length > 0 && (
                <div className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
                    {results.map((result) => (
                        <div
                            key={result.place_id}
                            onClick={() => handleResultClick(result)}
                            className="relative cursor-pointer select-none py-2 pl-3 pr-9 hover:bg-blue-50 hover:text-blue-900"
                        >
                            <div className="flex items-center">
                                <div className="flex-shrink-0">
                                    <svg
                                        className="h-5 w-5 text-gray-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                                        />
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                                        />
                                    </svg>
                                </div>
                                <div className="ml-3 flex-1">
                                    <div className="truncate font-medium text-gray-900">
                                        {result.name || 'ตำแหน่งที่เลือก'}
                                    </div>
                                    <div className="truncate text-sm text-gray-500">
                                        {result.formatted_address}
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* No Results */}
            {showResults && query.length > 2 && results.length === 0 && !isLoading && (
                <div className="absolute z-10 mt-1 w-full rounded-md bg-white px-3 py-2 text-sm text-gray-500 shadow-lg">
                    ไม่พบตำแหน่งที่ค้นหา
                </div>
            )}
        </div>
    );
};

export default KhokNongNaSearch;
