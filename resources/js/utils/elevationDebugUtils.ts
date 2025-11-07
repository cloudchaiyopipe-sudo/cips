// Debug utilities for elevation features

export const logElevationDebugInfo = (): void => {
    // Debug info removed for production
};

export const testElevationService = (): boolean => {
    try {
        if (!window.google?.maps?.ElevationService) {
            return false;
        }
        
        const elevationService = new window.google.maps.ElevationService();
        return true;
    } catch (error) {
        return false;
    }
};

export const testElevationAPI = async (): Promise<boolean> => {
    try {
        if (!window.google?.maps?.ElevationService) {
            return false;
        }

        const elevationService = new window.google.maps.ElevationService();
        
        // Test with a simple location
        const testLocation = new window.google.maps.LatLng(13.7563, 100.5018); // Bangkok
        
        return new Promise((resolve) => {
            elevationService.getElevationForLocations({
                locations: [testLocation]
            }, (results, status) => {
                if (status === window.google.maps.ElevationStatus.OK && results && results.length > 0) {
                    resolve(true);
                } else {
                    resolve(false);
                }
            });
        });
    } catch (error) {
        return false;
    }
};

export const debugElevationData = (elevationData: any[]): void => {
    // Debug data removed for production
};
