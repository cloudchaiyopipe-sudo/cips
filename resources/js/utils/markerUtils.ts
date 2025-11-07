/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Utility functions for Google Maps markers
 * Provides compatibility between deprecated Marker and new AdvancedMarkerElement
 */

export interface MarkerOptions {
    position?: google.maps.LatLngLiteral;
    map?: google.maps.Map;
    title?: string;
    draggable?: boolean;
    visible?: boolean;
    zIndex?: number;
    clickable?: boolean;
    content?: string | HTMLElement;
    icon?: string | google.maps.Icon | google.maps.Symbol;
    label?: string | google.maps.MarkerLabel;
}

/**
 * Creates a marker using the appropriate API (AdvancedMarkerElement or Marker)
 * @param options Marker options
 * @returns Marker instance
 */
export function createMarker(options: MarkerOptions): any {
    if (!window.google?.maps) {
        throw new Error('Google Maps API not loaded');
    }

    // Check if AdvancedMarkerElement is available
    if (window.google.maps.marker?.AdvancedMarkerElement) {
        return new window.google.maps.marker.AdvancedMarkerElement({
            position: options.position,
            map: options.map,
            title: options.title,
            content: options.content || createDefaultMarkerContent(options),
        });
    } else {
        // Fallback to deprecated Marker
        console.warn(
            'Using deprecated google.maps.Marker. Consider updating to AdvancedMarkerElement.'
        );
        return new window.google.maps.Marker({
            position: options.position,
            map: options.map,
            title: options.title,
            draggable: options.draggable,
            visible: options.visible,
            zIndex: options.zIndex,
            clickable: options.clickable,
            icon: options.icon,
            label: options.label,
        });
    }
}

/**
 * Creates default marker content for AdvancedMarkerElement
 */
function createDefaultMarkerContent(options: MarkerOptions): HTMLElement {
    const content = document.createElement('div');
    content.style.cssText = `
        width: 20px;
        height: 20px;
        background-color: #4285f4;
        border: 2px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
    `;

    if (options.title) {
        content.title = options.title;
    }

    return content;
}

/**
 * Sets marker position
 */
export function setMarkerPosition(marker: any, position: google.maps.LatLngLiteral): void {
    if (marker.setPosition) {
        marker.setPosition(position);
    } else if (marker.position) {
        marker.position = position;
    }
}

/**
 * Sets marker map
 */
export function setMarkerMap(marker: any, map: google.maps.Map | null): void {
    if (marker.setMap) {
        marker.setMap(map);
    } else if (marker.map !== undefined) {
        marker.map = map;
    }
}

/**
 * Sets marker visibility
 */
export function setMarkerVisible(marker: any, visible: boolean): void {
    if (marker.setVisible) {
        marker.setVisible(visible);
    } else if (marker.visible !== undefined) {
        marker.visible = visible;
    }
}

/**
 * Removes marker from map
 */
export function removeMarker(marker: any): void {
    if (marker.setMap) {
        marker.setMap(null);
    } else if (marker.map !== undefined) {
        marker.map = null;
    }
}

/**
 * Adds click listener to marker
 */
export function addMarkerClickListener(
    marker: any,
    callback: (event: any) => void
): google.maps.MapsEventListener | null {
    if (marker.addListener) {
        return marker.addListener('click', callback);
    }
    return null;
}

/**
 * Gets marker position
 */
export function getMarkerPosition(marker: any): google.maps.LatLngLiteral | null {
    if (marker.getPosition) {
        const position = marker.getPosition();
        return position ? { lat: position.lat(), lng: position.lng() } : null;
    } else if (marker.position) {
        return marker.position;
    }
    return null;
}
