// Standardized types for field-crop pages
export type Coordinate = { lat: number; lng: number };

export interface PlantPoint {
    id: string;
    lat: number;
    lng: number;
    cropType: string;
    isValid: boolean;
}

export interface Obstacle {
    id: string;
    type: 'water_source' | 'building' | 'rock' | 'other';
    coordinates: Coordinate[];
    name?: string;
}

export interface Zone {
    id: string;
    name: string;
    coordinates: Coordinate[];
    color: string;
    cropType?: string;
    waterRequirement?: number;
    plantCount?: number;
    waterStatus?: 'normal' | 'warning' | 'error';
    waterMessage?: string;
}

export interface IrrigationPositions {
    sprinklers: Coordinate[];
    pivots: Coordinate[];
    dripTapes: Coordinate[];
    waterJets: Coordinate[];
}

export interface IrrigationSettings {
    sprinkler_system?: { 
        coverageRadius?: number; 
        overlap?: number;
        flow?: number;
        pressure?: number;
        [key: string]: unknown 
    };
    pivot?: { 
        coverageRadius?: number; 
        overlap?: number;
        flow?: number;
        pressure?: number;
        [key: string]: unknown 
    };
    drip_tape?: { 
        emitterSpacing?: number;
        placement?: string;
        side?: string;
        flow?: number;
        pressure?: number;
        [key: string]: unknown 
    };
    water_jet_tape?: { 
        emitterSpacing?: number;
        placement?: string;
        side?: string;
        flow?: number;
        pressure?: number;
        [key: string]: unknown 
    };
    [key: string]: unknown;
}

export type PipeType = 'main' | 'submain' | 'lateral';
export type CurveType = 'straight' | 'bezier' | 'spline';

export interface Pipe {
    id: string;
    type: PipeType;
    coordinates: Coordinate[];
    curveType?: CurveType;
    controlPoints?: Coordinate[]; // For Bezier curves
    tension?: number; // For Spline curves (0-1)
    diameter?: number;
    length?: number;
    fromZone?: string;
    toZone?: string;
    // สำหรับท่อตรงที่โค้งมุม: เก็บสถานะต่อมุม (รองรับข้อมูลเรขาคณิตเพื่อปรับซ้ำ)
    roundedCorners?: {
        cornerIndex: number;
        handle?: Coordinate;
        A?: Coordinate;
        B?: Coordinate;
        C?: Coordinate;
        r?: number;
    }[];
}

export interface FieldData {
    selectedCrops: string[];
    mainArea: Coordinate[];
    zones: Zone[];
    obstacles: Obstacle[];
    plantPoints: PlantPoint[];
    pipes: Pipe[];
    areaRai: number | null;
    perimeterMeters: number | null;
    rotationAngle?: number;
    rowSpacing: Record<string, number>;
    plantSpacing: Record<string, number>;
    selectedIrrigationType: string;
    irrigationCounts: Record<string, number>;
    totalWaterRequirement: number;
    irrigationSettings: IrrigationSettings;
    irrigationPositions: IrrigationPositions;
    mapCenter: { lat: number; lng: number };
    mapZoom: number;
    realPlantCount?: number;
}

// Standardized props interface for all field-crop pages
export interface FieldCropPageProps {
    crops?: string;
    currentStep?: number;
    completedSteps?: string;
    mainArea?: string;
    obstacles?: string;
    plantPoints?: string;
    areaRai?: string;
    perimeterMeters?: string;
    rotationAngle?: string;
    rowSpacing?: string;
    plantSpacing?: string;
    selectedIrrigationType?: string;
    irrigationCounts?: string;
    totalWaterRequirement?: string;
    irrigationSettings?: string;
    irrigationPositions?: string;
    zones?: string;
    pipes?: string;
    mapCenter?: string;
    mapZoom?: string;
}

// Standardized styling constants
export const FIELD_STYLING = {
    MAIN_AREA: {
        fillColor: '#86EFAC',
        fillOpacity: 0.3,
        strokeColor: '#22C55E',
        strokeWeight: 2,
        strokeOpacity: 1,
        zIndex: 1000
    },
    OBSTACLES: {
        water_source: { fill: '#3B82F6', stroke: '#1D4ED8' },
        building: { fill: '#6B7280', stroke: '#374151' },
        rock: { fill: '#8B5CF6', stroke: '#5B21B6' },
        other: { fill: '#6B7280', stroke: '#374151' },
        default: { fill: '#6B7280', stroke: '#374151' },
        fillOpacity: 0.4,
        strokeWeight: 2,
        strokeOpacity: 1,
        zIndex: 1600
    },
    ZONES: {
        fillOpacity: 0.5,
        strokeWeight: 2,
        strokeOpacity: 0.9,
        zIndex: 1500
    },
    IRRIGATION: {
        sprinklers: { fill: '#EF4444', stroke: '#DC2626' },
        pivots: { fill: '#F59E0B', stroke: '#D97706' },
        dripTapes: { fill: '#10B981', stroke: '#059669' },
        waterJets: { fill: '#8B5CF6', stroke: '#7C3AED' },
        fillOpacity: 0.8,
        strokeWeight: 2,
        strokeOpacity: 1,
        zIndex: 1700
    }
} as const;

// Default values
export const DEFAULT_IRRIGATION_COUNTS = {
    sprinkler_system: 0,
    pivot: 0,
    drip_tape: 0,
    water_jet_tape: 0
};

export const DEFAULT_IRRIGATION_POSITIONS: IrrigationPositions = {
    sprinklers: [],
    pivots: [],
    dripTapes: [],
    waterJets: []
};

export const MAP_CONFIG = {
    DEFAULT_CENTER: { lat: 13.7563, lng: 100.5018 },
    DEFAULT_ZOOM: 16
};
