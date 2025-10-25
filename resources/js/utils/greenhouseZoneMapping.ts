/**
 * Utility functions for mapping greenhouse zones to plot data
 * This provides flexible zone-to-plot mapping that can handle:
 * - Dynamic zone IDs
 * - Variable number of zones
 * - Zone reordering
 */

export interface ZoneMapping {
    zoneId: string;
    plotIndex: number;
    plotId: string;
}

/**
 * Create a flexible mapping between active zones and plot data
 * @param activeZoneId - The current active zone ID
 * @param plotPipeData - Array of plot pipe data
 * @returns The matching plot data or null
 */
export function findMatchingPlotData(activeZoneId: string, plotPipeData: unknown[]): unknown | null {
    if (!plotPipeData || plotPipeData.length === 0) {
        return null;
    }

    // Strategy 1: Direct plotId match
    const directMatch = plotPipeData.find((plot: unknown) => (plot as { plotId: string }).plotId === activeZoneId);
    if (directMatch) {
        return directMatch;
    }

    // Strategy 2: Pattern-based matching
    const patternMatch = plotPipeData.find((plot: unknown) => {
        // Extract numeric parts from IDs for comparison
        const activeZoneNumber = extractNumericPart(activeZoneId);
        const plotIdNumber = extractNumericPart((plot as { plotId: string }).plotId);
        
        
        // If both have numeric parts, compare them
        if (activeZoneNumber !== null && plotIdNumber !== null) {
            return activeZoneNumber === plotIdNumber;
        }
        
        // Fallback to index-based matching
        return false;
    });
    
    if (patternMatch) {
        return patternMatch;
    }

    // Strategy 3: Index-based fallback (for backward compatibility)
    const zoneIndex = getZoneIndexFromId(activeZoneId);
    const indexMatch = plotPipeData.find((plot: unknown, index: number) => {
        return zoneIndex === index;
    });
    
    if (indexMatch) {
        return indexMatch;
    }
    
    return null;
}

/**
 * Extract numeric part from zone/plot ID
 * @param id - Zone or plot ID
 * @returns Numeric part or null
 */
function extractNumericPart(id: string): number | null {
    const match = id.match(/(\d+)/);
    return match ? parseInt(match[1], 10) : null;
}

/**
 * Get zone index from zone ID (fallback method)
 * @param zoneId - Zone ID
 * @param plotPipeData - Array of plot pipe data for reference
 * @returns Zone index
 */
function getZoneIndexFromId(zoneId: string): number {
    // Strategy 1: Try to get mapping from localStorage (most flexible)
    try {
        const zoneMappingKey = 'greenhouseZoneMapping';
        const storedMapping = localStorage.getItem(zoneMappingKey);
        
        if (storedMapping) {
            const mapping = JSON.parse(storedMapping);
            
            if (mapping[zoneId] !== undefined) {
                return mapping[zoneId];
            }
        }
    } catch (error) {
        console.warn('Error accessing stored zone mapping:', error);
    }
    
    // Strategy 3: Fallback to hardcoded mapping (for backward compatibility)
    // This is the least flexible but ensures current functionality works
    // Note: This should rarely be used now that we have dynamic mapping
    const fallbackMapping: { [key: string]: number } = {
        'plot-1761106826076': 0,
        'plot-1761106839142': 1,
        'plot-1761117638337': 2  // เพิ่มโซนที่ 3
    };
    
    if (fallbackMapping[zoneId] !== undefined) {
        return fallbackMapping[zoneId];
    }
    
    // Strategy 4: Default to first zone if no mapping found
    return 0;
}

/**
 * Create zone mapping for debugging
 * @param activeZoneId - Current active zone ID
 * @param plotPipeData - Array of plot pipe data
 * @returns Mapping information
 */
export function createZoneMapping(activeZoneId: string, plotPipeData: unknown[]): ZoneMapping[] {
    return plotPipeData.map((plot: unknown, index: number) => ({
        zoneId: activeZoneId,
        plotIndex: index,
        plotId: (plot as { plotId: string }).plotId
    }));
}

/**
 * Create and store dynamic zone mapping
 * This function should be called when zones are created or modified
 * @param activeZoneIds - Array of current active zone IDs
 * @param plotPipeData - Array of plot pipe data
 */
export function createDynamicZoneMapping(activeZoneIds: string[], plotPipeData: unknown[]): void {
    try {
        const mapping: { [key: string]: number } = {};
        
        // Create mapping based on order
        activeZoneIds.forEach((zoneId, index) => {
            if (index < plotPipeData.length) {
                mapping[zoneId] = index;
            }
        });
        
        // Store in localStorage
        localStorage.setItem('greenhouseZoneMapping', JSON.stringify(mapping));
    } catch (error) {
        console.error('Error creating dynamic zone mapping:', error);
    }
}

/**
 * Clear stored zone mapping
 */
export function clearZoneMapping(): void {
    try {
        localStorage.removeItem('greenhouseZoneMapping');
    } catch (error) {
        console.error('Error clearing zone mapping:', error);
    }
}
