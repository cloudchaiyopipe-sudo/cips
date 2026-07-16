/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Google's Drawing Library (google.maps.drawing.DrawingManager) was deprecated in
 * August 2025 and removed entirely from the Maps JavaScript API in v3.65 (mid-2026).
 * See https://developers.google.com/maps/deprecations
 *
 * This module re-implements the small subset of the DrawingManager API that this
 * codebase relies on, backed by Terra Draw (the Google-endorsed replacement) so the
 * rest of the app (event names, option shapes, getters/setters) does not need to change.
 */
import {
    TerraDraw,
    TerraDrawPolygonMode,
    TerraDrawRectangleMode,
    TerraDrawCircleMode,
    TerraDrawLineStringMode,
    TerraDrawSelectMode,
    type GeoJSONStoreFeatures,
} from 'terra-draw';
import { TerraDrawGoogleMapsAdapter } from 'terra-draw-google-maps-adapter';

export const OverlayType = {
    POLYGON: 'polygon',
    RECTANGLE: 'rectangle',
    CIRCLE: 'circle',
    POLYLINE: 'polyline',
} as const;

export type OverlayTypeValue = (typeof OverlayType)[keyof typeof OverlayType];

const TERRA_MODE_BY_OVERLAY: Record<OverlayTypeValue, string> = {
    polygon: 'polygon',
    rectangle: 'rectangle',
    circle: 'circle',
    polyline: 'linestring',
};

const OVERLAY_BY_TERRA_MODE: Record<string, OverlayTypeValue> = {
    polygon: OverlayType.POLYGON,
    rectangle: OverlayType.RECTANGLE,
    circle: OverlayType.CIRCLE,
    linestring: OverlayType.POLYLINE,
};

const COMPLETE_EVENT_BY_OVERLAY: Record<OverlayTypeValue, string> = {
    polygon: 'polygoncomplete',
    rectangle: 'rectanglecomplete',
    circle: 'circlecomplete',
    polyline: 'polylinecomplete',
};

export interface ShapeStyleOptions {
    fillColor?: string;
    fillOpacity?: number;
    strokeColor?: string;
    strokeOpacity?: number;
    strokeWeight?: number;
    clickable?: boolean;
    editable?: boolean;
    draggable?: boolean;
    zIndex?: number;
    [key: string]: unknown;
}

export interface TerraDrawingManagerOptions {
    map?: google.maps.Map | null;
    drawingMode?: OverlayTypeValue | null;
    drawingControl?: boolean;
    drawingControlOptions?: {
        position?: google.maps.ControlPosition;
        drawingModes?: OverlayTypeValue[];
    };
    polygonOptions?: ShapeStyleOptions;
    rectangleOptions?: ShapeStyleOptions;
    circleOptions?: ShapeStyleOptions;
    polylineOptions?: ShapeStyleOptions;
}

type CompleteHandler = (shape: any) => void;
type ManagerEventName =
    | 'polygoncomplete'
    | 'rectanglecomplete'
    | 'circlecomplete'
    | 'polylinecomplete'
    | 'mousemove';

interface SharedDrawContext {
    draw: TerraDraw;
    ready: Promise<void>;
    refCount: number;
    activeManager: TerraDrawingManager | null;
}

const sharedContexts = new WeakMap<google.maps.Map, SharedDrawContext>();

function haversineMeters(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const R = 6371000;
    const dLat = ((b.lat - a.lat) * Math.PI) / 180;
    const dLng = ((b.lng - a.lng) * Math.PI) / 180;
    const s =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(s), Math.sqrt(1 - s));
}

function polygonStylesFrom(options?: ShapeStyleOptions): any {
    return {
        fillColor: options?.fillColor ?? '#4ECDC4',
        fillOpacity: options?.fillOpacity ?? 0.3,
        outlineColor: options?.strokeColor ?? options?.fillColor ?? '#4ECDC4',
        outlineOpacity: options?.strokeOpacity ?? 1,
        outlineWidth: options?.strokeWeight ?? 2,
    };
}

function lineStylesFrom(options?: ShapeStyleOptions): any {
    return {
        lineStringColor: options?.strokeColor ?? '#4ECDC4',
        lineStringOpacity: options?.strokeOpacity ?? 0.9,
        lineStringWidth: options?.strokeWeight ?? 3,
    };
}

function ensureMapHasId(map: google.maps.Map): void {
    const div = map.getDiv();
    if (!div.id) {
        div.id = `terra-draw-map-${Math.random().toString(36).slice(2)}`;
    }
}

function geoJsonRingToPath(ring: number[][]): google.maps.LatLngLiteral[] {
    const path = ring.map(([lng, lat]) => ({ lat, lng }));
    if (path.length > 1) {
        const first = path[0];
        const last = path[path.length - 1];
        if (first.lat === last.lat && first.lng === last.lng) {
            path.pop();
        }
    }
    return path;
}

function buildGoogleShape(
    overlayType: OverlayTypeValue,
    feature: GeoJSONStoreFeatures,
    styleOptions?: ShapeStyleOptions
): google.maps.Polygon | google.maps.Rectangle | google.maps.Circle | google.maps.Polyline | null {
    const geometry: any = (feature as any).geometry;
    const extra = { ...styleOptions };
    delete (extra as any).map;

    if (overlayType === OverlayType.POLYLINE) {
        if (geometry?.type !== 'LineString') return null;
        const path = geometry.coordinates.map(([lng, lat]: [number, number]) => ({ lat, lng }));
        return new google.maps.Polyline({ path, ...(extra as google.maps.PolylineOptions) });
    }

    if (geometry?.type !== 'Polygon') return null;
    const path = geoJsonRingToPath(geometry.coordinates[0]);
    if (path.length < 3) return null;

    if (overlayType === OverlayType.RECTANGLE) {
        let north = -Infinity;
        let south = Infinity;
        let east = -Infinity;
        let west = Infinity;
        path.forEach((p) => {
            north = Math.max(north, p.lat);
            south = Math.min(south, p.lat);
            east = Math.max(east, p.lng);
            west = Math.min(west, p.lng);
        });
        return new google.maps.Rectangle({
            bounds: { north, south, east, west },
            ...(extra as google.maps.RectangleOptions),
        });
    }

    if (overlayType === OverlayType.CIRCLE) {
        const center = {
            lat: path.reduce((sum, p) => sum + p.lat, 0) / path.length,
            lng: path.reduce((sum, p) => sum + p.lng, 0) / path.length,
        };
        const radius = path.reduce((sum, p) => sum + haversineMeters(center, p), 0) / path.length;
        return new google.maps.Circle({
            center,
            radius,
            ...(extra as google.maps.CircleOptions),
        });
    }

    return new google.maps.Polygon({ paths: path, ...(extra as google.maps.PolygonOptions) });
}

function getSharedContext(map: google.maps.Map): SharedDrawContext {
    const existing = sharedContexts.get(map);
    if (existing) return existing;

    ensureMapHasId(map);

    const adapter = new TerraDrawGoogleMapsAdapter({
        map,
        lib: google.maps,
        coordinatePrecision: 9,
    });

    const draw = new TerraDraw({
        adapter,
        modes: [
            new TerraDrawPolygonMode({ styles: polygonStylesFrom() }),
            new TerraDrawRectangleMode({ styles: polygonStylesFrom(), drawInteraction: 'click-drag' }),
            new TerraDrawCircleMode({ styles: polygonStylesFrom(), drawInteraction: 'click-drag' }),
            new TerraDrawLineStringMode({ styles: lineStylesFrom() }),
            new TerraDrawSelectMode({
                flags: {
                    polygon: {
                        feature: {
                            draggable: true,
                            coordinates: { midpoints: true, draggable: true, deletable: true },
                        },
                    },
                    rectangle: {
                        feature: { draggable: true, coordinates: { draggable: true } },
                    },
                    circle: {
                        feature: { draggable: true, coordinates: { draggable: true } },
                    },
                    linestring: {
                        feature: {
                            draggable: true,
                            coordinates: { midpoints: true, draggable: true, deletable: true },
                        },
                    },
                },
            }),
        ],
    });

    const ready = new Promise<void>((resolve) => {
        draw.on('ready', () => resolve());
    });

    const ctx: SharedDrawContext = { draw, ready, refCount: 0, activeManager: null };

    draw.on('finish', (id, context) => {
        if (context.action !== 'draw') return;
        const overlayType = OVERLAY_BY_TERRA_MODE[context.mode];

        try {
            draw.setMode('select');
        } catch {
            // ignore, Terra Draw may not be fully ready
        }

        const feature = draw.getSnapshotFeature(id);
        try {
            draw.removeFeatures([id]);
        } catch {
            // ignore
        }

        if (!overlayType || !feature) return;
        ctx.activeManager?.handleFinish(overlayType, feature);
    });

    ready.then(() => {
        try {
            draw.setMode('select');
        } catch {
            // ignore
        }
    });

    draw.start();
    sharedContexts.set(map, ctx);
    return ctx;
}

function releaseSharedContext(map: google.maps.Map, manager: TerraDrawingManager) {
    const ctx = sharedContexts.get(map);
    if (!ctx) return;
    if (ctx.activeManager === manager) {
        ctx.activeManager = null;
    }
    ctx.refCount -= 1;
    if (ctx.refCount <= 0) {
        try {
            ctx.draw.stop();
        } catch {
            // ignore
        }
        sharedContexts.delete(map);
    }
}

/**
 * Drop-in replacement for `google.maps.drawing.DrawingManager`, implemented on top of
 * Terra Draw. Supports the same constructor shape, `setMap`/`setOptions`/`get`/
 * `setDrawingMode`/`getDrawingMode`/`addListener` surface used across this app.
 */
export class TerraDrawingManager {
    private options: TerraDrawingManagerOptions;
    private map: google.maps.Map | null = null;
    private mode: OverlayTypeValue | null = null;
    private listeners: Partial<Record<ManagerEventName, CompleteHandler[]>> = {};
    private controlDiv: HTMLElement | null = null;
    private controlPosition: google.maps.ControlPosition | null = null;
    private controlButtons: Partial<Record<OverlayTypeValue, HTMLButtonElement>> | null = null;

    constructor(options: TerraDrawingManagerOptions = {}) {
        this.options = { ...options };
        this.mode = options.drawingMode ?? null;
        if (options.map) {
            this.setMap(options.map);
        }
    }

    private get ctx(): SharedDrawContext | null {
        return this.map ? sharedContexts.get(this.map) ?? null : null;
    }

    setMap(map: google.maps.Map | null): void {
        if (this.map === map) return;

        if (this.map) {
            this.removeControl();
            releaseSharedContext(this.map, this);
        }

        this.map = map;

        if (map) {
            const ctx = getSharedContext(map);
            ctx.refCount += 1;
            this.applyStylesToModes();
            this.renderControlIfNeeded();
            if (this.mode) {
                this.activateMode(this.mode);
            }
        }
    }

    setOptions(options: Partial<TerraDrawingManagerOptions>): void {
        this.options = { ...this.options, ...options };
        this.applyStylesToModes();
        this.renderControlIfNeeded();
        if (options.drawingMode !== undefined) {
            this.setDrawingMode(options.drawingMode);
        }
    }

    get(key: keyof TerraDrawingManagerOptions): any {
        return this.options[key];
    }

    setDrawingMode(mode: OverlayTypeValue | null): void {
        this.mode = mode;
        this.updateControlActiveState();
        if (!this.map) return;
        if (mode) {
            this.activateMode(mode);
        } else {
            this.deactivateMode();
        }
    }

    getDrawingMode(): OverlayTypeValue | null {
        return this.mode;
    }

    addListener(eventName: ManagerEventName, handler: CompleteHandler): google.maps.MapsEventListener {
        if (eventName === 'mousemove') {
            if (!this.map) {
                return { remove: () => {} };
            }
            // Terra Draw does not expose a public mousemove event; the native map
            // mousemove event is a reasonable stand-in for the previous behaviour.
            return this.map.addListener('mousemove', handler);
        }

        if (!this.listeners[eventName]) {
            this.listeners[eventName] = [];
        }
        this.listeners[eventName]!.push(handler);

        return {
            remove: () => {
                const arr = this.listeners[eventName];
                if (!arr) return;
                const idx = arr.indexOf(handler);
                if (idx >= 0) arr.splice(idx, 1);
            },
        };
    }

    /** @internal invoked by the shared Terra Draw 'finish' listener */
    handleFinish(overlayType: OverlayTypeValue, feature: GeoJSONStoreFeatures): void {
        const styleOptionsKey =
            overlayType === OverlayType.POLYGON
                ? 'polygonOptions'
                : overlayType === OverlayType.RECTANGLE
                  ? 'rectangleOptions'
                  : overlayType === OverlayType.CIRCLE
                    ? 'circleOptions'
                    : 'polylineOptions';

        const shape = buildGoogleShape(overlayType, feature, this.options[styleOptionsKey]);
        if (!shape) return;

        this.mode = null;
        this.updateControlActiveState();

        const handlers = this.listeners[COMPLETE_EVENT_BY_OVERLAY[overlayType] as ManagerEventName];
        if (handlers) {
            handlers.slice().forEach((handler) => handler(shape));
        }
    }

    private applyStylesToModes(): void {
        const ctx = this.ctx;
        if (!ctx) return;
        ctx.ready.then(() => {
            if (this.ctx !== ctx) return;
            try {
                ctx.draw.updateModeOptions<typeof TerraDrawPolygonMode>('polygon', {
                    styles: polygonStylesFrom(this.options.polygonOptions),
                });
                ctx.draw.updateModeOptions<typeof TerraDrawRectangleMode>('rectangle', {
                    styles: polygonStylesFrom(this.options.rectangleOptions),
                });
                ctx.draw.updateModeOptions<typeof TerraDrawCircleMode>('circle', {
                    styles: polygonStylesFrom(this.options.circleOptions),
                });
                ctx.draw.updateModeOptions<typeof TerraDrawLineStringMode>('linestring', {
                    styles: lineStylesFrom(this.options.polylineOptions),
                });
            } catch {
                // Terra Draw modes not ready yet; defaults will be used
            }
        });
    }

    private activateMode(overlayType: OverlayTypeValue): void {
        const ctx = this.ctx;
        if (!ctx) return;
        ctx.activeManager = this;
        ctx.ready.then(() => {
            if (this.ctx !== ctx || this.mode !== overlayType) return;
            try {
                ctx.draw.setMode(TERRA_MODE_BY_OVERLAY[overlayType]);
            } catch {
                // ignore
            }
        });
    }

    private deactivateMode(): void {
        const ctx = this.ctx;
        if (!ctx || ctx.activeManager !== this) return;
        ctx.ready.then(() => {
            if (this.ctx !== ctx) return;
            try {
                ctx.draw.setMode('select');
            } catch {
                // ignore
            }
        });
    }

    private renderControlIfNeeded(): void {
        if (!this.map) return;

        if (!this.options.drawingControl) {
            this.removeControl();
            return;
        }

        const modes = this.options.drawingControlOptions?.drawingModes ?? [];
        const position = this.options.drawingControlOptions?.position ?? google.maps.ControlPosition.TOP_CENTER;

        this.removeControl();

        const icons: Record<OverlayTypeValue, string> = {
            polygon:
                '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"><path d="M12 3 L21 9.5 L17.5 20 L6.5 20 L3 9.5 Z"/></svg>',
            rectangle:
                '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3.5" y="6" width="17" height="12" rx="1"/></svg>',
            circle:
                '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="8.5"/></svg>',
            polyline:
                '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 18 L9 8 L14 14 L21 5"/></svg>',
        };

        const container = document.createElement('div');
        container.className = 'm-2 flex gap-1 rounded-lg bg-white p-1 shadow-lg';

        const buttons: Partial<Record<OverlayTypeValue, HTMLButtonElement>> = {};

        modes.forEach((overlayType) => {
            const button = document.createElement('button');
            button.type = 'button';
            button.title = overlayType;
            button.className =
                'flex h-9 w-9 items-center justify-center rounded-md text-gray-600 transition-colors hover:bg-gray-100';
            button.innerHTML = icons[overlayType] ?? '';
            button.addEventListener('click', (event) => {
                event.preventDefault();
                event.stopPropagation();
                this.setDrawingMode(this.mode === overlayType ? null : overlayType);
            });
            buttons[overlayType] = button;
            container.appendChild(button);
        });

        this.controlButtons = buttons;
        this.controlDiv = container;
        this.controlPosition = position;
        this.map.controls[position].push(container);
        this.updateControlActiveState();
    }

    private updateControlActiveState(): void {
        if (!this.controlButtons) return;
        Object.entries(this.controlButtons).forEach(([overlayType, button]) => {
            if (!button) return;
            if (this.mode === overlayType) {
                button.classList.add('bg-blue-100', 'text-blue-600');
            } else {
                button.classList.remove('bg-blue-100', 'text-blue-600');
            }
        });
    }

    private removeControl(): void {
        if (!this.map || !this.controlDiv || this.controlPosition === null) return;
        const controls = this.map.controls[this.controlPosition];
        for (let i = 0; i < controls.getLength(); i++) {
            if (controls.getAt(i) === this.controlDiv) {
                controls.removeAt(i);
                break;
            }
        }
        this.controlDiv = null;
        this.controlPosition = null;
        this.controlButtons = null;
    }
}
