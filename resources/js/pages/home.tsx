/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from 'react';
import { router, usePage } from '@inertiajs/react';
import { MapContainer, TileLayer, Polygon, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import axios from 'axios';
import { useLanguage } from '../contexts/LanguageContext';
import Footer from '../components/Footer';
import Navbar from '../components/Navbar';
import { refreshCsrfToken } from '../bootstrap';
import { calculatePolygonArea, clearGardenDataCache, getSprinklerColorForPreview, SPRINKLER_TYPES } from '../utils/homeGardenData';
import HorticultureMapPreview from '../components/horticulture/HorticultureMapPreview';
import QuotationDocument from './components/QuotationDocument';
import {
    FaFolder,
    FaFolderOpen,
    FaArrowLeft,
    FaPlus,
    FaTrash,
    FaEdit,
    FaGripVertical,
} from 'react-icons/fa';

// Types
type Field = {
    id: string;
    name: string;
    customerName?: string;
    userName?: string;
    category?: string;
    folderId?: string | null; // Allow null for unassigned fields
    status?: string; // Added for new system folders
    isCompleted?: boolean; // Added for new system folders
    area: Array<{ lat: number; lng: number }>;
    plantType?: {
        id: number;
        name: string;
        type: string;
        plant_spacing: number;
        row_spacing: number;
        water_needed: number;
    };
    totalPlants?: number;
    totalArea: number;
    total_water_need?: number;
    createdAt: string;
    layers?: Array<{
        type: string;
        coordinates: Array<{ lat: number; lng: number }>;
        isInitialMap?: boolean;
    }>;
    // Additional data for different field types
    garden_data?: any;
    garden_stats?: any;
    greenhouse_data?: any;
    field_crop_data?: any;
    project_data?: any;
    projectData?: any; // camelCase from backend
    project_stats?: any;
};

// New folder types
type Folder = {
    id: string;
    name: string;
    type: 'finished' | 'unfinished' | 'custom' | 'customer' | 'category';
    parent_id?: string;
    color?: string;
    icon?: string;
    createdAt: string;
    updatedAt: string;
};

type FolderWithChildren = Folder & {
    children?: FolderWithChildren[];
};

type FolderStructure = {
    folders: Folder[];
    fields: Field[];
};

// Plant category types
type PlantCategory = {
    id: string;
    name: string;
    description: string;
    icon: string;
    color: string;
    route: string;
    features: string[];
    isAvailable?: boolean; // true = พร้อมใช้งาน, false = กำลังพัฒนา
};

// Constants
const DEFAULT_CENTER: [number, number] = [13.7563, 100.5018];

// Helper function to build folder tree from flat list
const buildFolderTree = (folders: Folder[]): FolderWithChildren[] => {
    const folderMap = new Map<string, FolderWithChildren>();
    const rootFolders: FolderWithChildren[] = [];

    // Create a map of all folders
    folders.forEach((folder) => {
        folderMap.set(folder.id, { ...folder, children: [] });
    });

    // Build the tree structure
    folders.forEach((folder) => {
        const folderWithChildren = folderMap.get(folder.id)!;

        if (folder.parent_id && folderMap.has(folder.parent_id)) {
            // This is a child folder
            const parent = folderMap.get(folder.parent_id)!;
            if (!parent.children) parent.children = [];
            parent.children.push(folderWithChildren);
        } else {
            // This is a root folder
            rootFolders.push(folderWithChildren);
        }
    });

    return rootFolders;
};

const getPlantCategories = (t: (key: string) => string): PlantCategory[] => [
    {
        id: 'horticulture',
        name: t('horticulture'),
        description: t('horticulture_desc'),
        icon: '🌳',
        color: 'from-green-600 to-green-800',
        route: '/horticulture/planner',
        features: [
            t('zone_based_planning'),
            t('multiple_plant_types'),
            t('advanced_pipe_layout'),
            t('elevation_analysis'),
            t('comprehensive_stats'),
        ],
        isAvailable: true, // พร้อมใช้งาน
    },
    {
        id: 'home-garden',
        name: t('home_garden'),
        description: t('home_garden_desc'),
        icon: '🏡',
        color: 'from-blue-600 to-blue-800',
        route: '/home-garden/planner',
        features: [
            t('automated_sprinkler'),
            t('coverage_optimization'),
            t('water_flow_calc'),
            t('easy_interface'),
            t('residential_focus'),
        ],
        isAvailable: false, // กำลังพัฒนา
    },
    {
        id: 'greenhouse',
        name: t('greenhouse'),
        description: t('greenhouse_desc'),
        icon: '🌱',
        color: 'from-purple-600 to-purple-800',
        route: '/greenhouse-crop',
        features: [
            t('controlled_environment'),
            t('precision_irrigation'),
            t('climate_control'),
            t('crop_optimization'),
            t('environmental_monitoring'),
        ],
        isAvailable: false, // กำลังพัฒนา
    },
    {
        id: 'field-crop',
        name: t('field_crop'),
        description: t('field_crop_desc'),
        icon: '🌾',
        color: 'from-yellow-600 to-yellow-800',
        route: '/choose-crop',
        features: [
            t('large_scale_planning'),
            t('efficient_irrigation'),
            t('crop_rotation'),
            t('weather_integration'),
            t('yield_optimization'),
        ],
        isAvailable: false, // กำลังพัฒนา
    },
    // {
    //     id: 'khok-nong-na',
    //     name: 'โคกหนองนา',
    //     description: 'ระบบวางระบบน้ำสำหรับโคกหนองนา ตามแนวคิดเศรษฐกิจพอเพียง',
    //     icon: '🏞️',
    //     color: 'from-emerald-600 to-teal-800',
    //     route: '/khok-nong-na',
    //     features: [
    //         'การวิเคราะห์พื้นที่โคกหนองนา',
    //         'การวางแผนระบบน้ำอัตโนมัติ',
    //         'การคำนวณต้นทุนโครงการ',
    //         'การจัดการน้ำตามหลักเศรษฐกิจพอเพียง',
    //         'การติดตามและรายงานผล',
    //     ],
    // },
];

// Components
const MapBounds = ({ positions }: { positions: Array<{ lat: number; lng: number }> }) => {
    const map = useMap();

    React.useEffect(() => {
        if (positions.length > 0) {
            const bounds = positions.reduce(
                (bounds, point) => bounds.extend([point.lat, point.lng]),
                L.latLngBounds([])
            );
            map.fitBounds(bounds, { padding: [50, 50], maxZoom: 18, animate: true });
        }
    }, [positions, map]);

    return null;
};

const FieldCard = ({
    field,
    onSelect,
    onDelete,
    onStatusChange,
    onRename,
    onMove,
    onCopy,
    onShare,
    isSuperUser,
    t,
}: {
    field: Field;
    onSelect: (field: Field) => void;
    onDelete: (fieldId: string) => void;
    onStatusChange?: (fieldId: string, status: string, isCompleted: boolean) => void;
    onRename?: (field: Field) => void;
    onMove?: (field: Field) => void;
    onCopy?: (field: Field) => void;
    onShare?: (field: Field) => void;
    isSuperUser?: boolean;
    t: (key: string) => string;
}) => {
    const [showMenu, setShowMenu] = useState(false);
    
    // Close menu when clicking outside
    useEffect(() => {
        const handleClickOutside = () => {
            if (showMenu) setShowMenu(false);
        };
        
        document.addEventListener('click', handleClickOutside);
        return () => document.removeEventListener('click', handleClickOutside);
    }, [showMenu]);
    
    const getCategoryDisplay = (category: string) => {
        const categoryMap: Record<string, string> = {
            horticulture: '🌳',
            'home-garden': '🏡',
            greenhouse: '🌱',
            'field-crop': '🌾',
            // 'khok-nong-na': '🏞️',
        };
        return categoryMap[category] || '📁';
    };

    const isFinished = field.status === 'finished' || field.isCompleted;

    return (
        <div
            className="group relative overflow-hidden rounded-lg border border-gray-700 bg-gray-800 px-6 py-4 transition-all duration-200 hover:border-blue-500 hover:bg-blue-900/10"
        >


            {/* Field Content */}
            <div className="cursor-pointer" onClick={() => onSelect(field)}>
                <div className="mb-2 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        {/* <span className="text-2xl">{getCategoryDisplay(field.category || '')}</span> */}
                        <div>
                            <h3 className="font-semibold text-white">{field.name}</h3>
                        </div>
                    </div>
                    {/* Status Badge */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                if (onStatusChange) {
                                    const newStatus = isFinished ? 'unfinished' : 'finished';
                                    const newIsCompleted = !isFinished;
                                    onStatusChange(field.id, newStatus, newIsCompleted);
                                }
                            }}
                            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${isFinished
                                    ? 'bg-green-600 text-white hover:bg-green-700'
                                    : 'bg-yellow-600 text-white hover:bg-yellow-700'
                                }`}
                            title={isFinished ? t('mark_as_unfinished') : t('mark_as_finished')}
                        >
                            {isFinished ? '✅' : '⏳'}
                        </button>
                        
                        {/* Three Dots Menu */}
                        <div className="relative">
                            <button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setShowMenu(!showMenu);
                                }}
                                className="rounded p-1 text-gray-400 transition-colors hover:bg-gray-700 hover:text-white"
                                title="เพิ่มเติม"
                            >
                                <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/>
                                </svg>
                            </button>
                            
                            {/* Dropdown Menu */}
                            {showMenu && (
                                <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-lg border border-gray-700 bg-gray-800 py-1 shadow-lg">
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowMenu(false);
                                            onRename?.(field);
                                        }}
                                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                        </svg>
                                        {t('rename_project')}
                                    </button>
                                    
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowMenu(false);
                                            onMove?.(field);
                                        }}
                                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                        </svg>
                                        {t('move_project')}
                                    </button>
                                    
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowMenu(false);
                                            onCopy?.(field);
                                        }}
                                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                                        </svg>
                                        {t('copy_project')}
                                    </button>
                                    
                                    {isSuperUser && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setShowMenu(false);
                                                onShare?.(field);
                                            }}
                                            className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
                                        >
                                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-2.684m0 2.684l6.632 3.316m-6.632-6l6.632-3.316m0 0a3 3 0 105.367-2.684 3 3 0 00-5.367 2.684zm0 9.316a3 3 0 105.368 2.684 3 3 0 00-5.368-2.684z" />
                                            </svg>
                                            {t('share_to_user')}
                                        </button>
                                    )}
                                    
                                    <hr className="my-1 border-gray-700" />
                                    
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setShowMenu(false);
                                            onDelete(field.id);
                                        }}
                                        className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-red-400 transition-colors hover:bg-red-900/20 hover:text-red-300"
                                    >
                                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                        </svg>
                                        {t('delete_project')}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="space-y-2 text-sm text-gray-300">
                    {field.category === 'home-garden' ? (
                        // Home Garden specific display
                        <>
                            {/* รูปแผนผังสวนบ้าน: รูปอัพโหลด / SVG จากโซน / placeholder */}
                            {(() => {
                                const gd = field.garden_data;
                                if (!gd) return null;
                                const parsed = typeof gd === 'string' ? (() => { try { return JSON.parse(gd); } catch { return null; } })() : gd;
                                if (!parsed) return null;
                                // โหมดอัพโหลดแผน: แสดงรูปแปลน + ท่อ/หัวฉีด/แหล่งน้ำ ทับบนรูป (พิกัดตามภาพ)
                                if (parsed.designMode === 'image' && parsed.imageData?.url) {
                                    const imgW = parsed.imageData.width ?? 800;
                                    const imgH = parsed.imageData.height ?? 600;
                                    const pipesImg = parsed.pipes || [];
                                    const waterSourcesImg = parsed.waterSources || [];
                                    const rawSprinklersImg = parsed.sprinklers || [];
                                    const sprinklersImg = rawSprinklersImg.map((sp: any) => {
                                        const t = sp?.type;
                                        const typeId = typeof t === 'string' ? t : t?.id;
                                        const preset = typeId ? SPRINKLER_TYPES.find((st: any) => st.id === typeId) : null;
                                        return {
                                            ...sp,
                                            type: {
                                                id: typeId ?? t?.id,
                                                radius: t?.radius ?? preset?.radius ?? 4,
                                                pressure: t?.pressure ?? preset?.pressure ?? 2,
                                                flowRate: t?.flowRate ?? preset?.flowRate ?? 18,
                                                color: t?.color,
                                            },
                                        };
                                    });
                                    const toPt = (p: any) => (p?.x != null && p?.y != null) ? { x: p.x, y: p.y } : null;
                                    const dataScaleImg = parsed.imageData?.scale ?? 20;
                                    return (
                                        <div className="mb-3 relative overflow-hidden rounded-lg border border-gray-600" style={{ height: '180px' }}>
                                            <img
                                                src={parsed.imageData.url}
                                                alt="แผนผังสวน"
                                                className="absolute inset-0 h-full w-full object-cover object-center"
                                            />
                                            <svg
                                                className="absolute inset-0 h-full w-full"
                                                viewBox={`0 0 ${imgW} ${imgH}`}
                                                preserveAspectRatio="xMidYMid meet"
                                            >
                                                {/* รัศมีหัวฉีด (โปร่งใส) */}
                                                {sprinklersImg.map((sp: any, idx: number) => {
                                                    const pt = toPt(sp?.canvasPosition || sp?.position);
                                                    if (!pt) return null;
                                                    const rM = (sp.type?.radius != null && sp.type.radius > 0) ? sp.type.radius : 4;
                                                    const rPx = rM * dataScaleImg;
                                                    if (rPx < 2) return null;
                                                    const col = getSprinklerColorForPreview(sp, sprinklersImg);
                                                    const hexToRgba = (hex: string, a: number) => {
                                                        if (!hex?.startsWith('#')) return `rgba(51,204,255,${a})`;
                                                        const h = hex.replace('#', '');
                                                        const r = parseInt(h.slice(0, 2), 16);
                                                        const g = parseInt(h.slice(2, 4), 16);
                                                        const b = parseInt(h.slice(4, 6), 16);
                                                        return `rgba(${r},${g},${b},${a})`;
                                                    };
                                                    return <circle key={`im-sp-r-${idx}`} cx={pt.x} cy={pt.y} r={rPx} fill={hexToRgba(col, 0.15)} stroke={col} strokeWidth={1} />;
                                                })}
                                                {/* ท่อ */}
                                                {pipesImg.map((pipe: any, idx: number) => {
                                                    const a = toPt(pipe.canvasStart || pipe.start);
                                                    const b = toPt(pipe.canvasEnd || pipe.end);
                                                    if (!a || !b) return null;
                                                    return <line key={`im-pipe-${idx}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#8B5CF6" strokeWidth={Math.max(2, imgW / 200)} strokeLinecap="round" />;
                                                })}
                                                {/* แหล่งน้ำ */}
                                                {waterSourcesImg.map((ws: any, idx: number) => {
                                                    const pt = toPt(ws?.canvasPosition || ws?.position);
                                                    if (!pt) return null;
                                                    return (
                                                        <g key={`im-ws-${idx}`}>
                                                            <circle cx={pt.x} cy={pt.y} r={Math.max(8, imgW / 80)} fill="#1F2937" stroke="#3B82F6" strokeWidth={1.5} />
                                                            <circle cx={pt.x} cy={pt.y} r={Math.max(3, imgW / 200)} fill="#3B82F6" />
                                                        </g>
                                                    );
                                                })}
                                                {/* จุดหัวฉีด */}
                                                {sprinklersImg.map((sp: any, idx: number) => {
                                                    const pt = toPt(sp?.canvasPosition || sp?.position);
                                                    if (!pt) return null;
                                                    const col = getSprinklerColorForPreview(sp, sprinklersImg);
                                                    return <circle key={`im-sp-${idx}`} cx={pt.x} cy={pt.y} r={Math.max(3, imgW / 150)} fill={col} stroke="#FFF" strokeWidth={1} />;
                                                })}
                                            </svg>
                                        </div>
                                    );
                                }
                                // โหมดวาดเอง/แผนที่: วาด SVG จากโซน + ท่อ + แหล่งน้ำ + หัวฉีด (สีและสัดส่วนให้ตรงกับหน้าแผน)
                                const zones = parsed.gardenZones || [];
                                const pipes = parsed.pipes || [];
                                const waterSources = parsed.waterSources || [];
                                const rawSprinklers = parsed.sprinklers || [];
                                const sprinklers = rawSprinklers.map((sp: any) => {
                                    const t = sp?.type;
                                    const typeId = typeof t === 'string' ? t : t?.id;
                                    const preset = typeId ? SPRINKLER_TYPES.find((st: any) => st.id === typeId) : null;
                                    return {
                                        ...sp,
                                        type: {
                                            id: typeId ?? t?.id,
                                            nameEN: t?.nameEN ?? preset?.nameEN,
                                            nameTH: t?.nameTH ?? preset?.nameTH,
                                            radius: t?.radius ?? preset?.radius ?? 4,
                                            pressure: t?.pressure ?? preset?.pressure ?? 2,
                                            flowRate: t?.flowRate ?? preset?.flowRate ?? 18,
                                            color: t?.color,
                                            suitableFor: t?.suitableFor ?? preset?.suitableFor ?? [],
                                            icon: t?.icon ?? preset?.icon,
                                        },
                                    };
                                });
                                const isCanvasSpace = parsed.designMode === 'canvas' || parsed.designMode === 'image';
                                const toPoint = (p: any) => (p?.x != null && p?.y != null) ? { x: p.x, y: p.y } : (p?.lat != null && p?.lng != null) ? { x: p.lng, y: p.lat } : null;
                                const pipePoint = (pipe: any, which: 'start' | 'end') => {
                                    if (isCanvasSpace && (pipe.canvasStart || pipe.canvasEnd)) {
                                        const pt = which === 'start' ? (pipe.canvasStart || pipe.start) : (pipe.canvasEnd || pipe.end);
                                        return toPoint(pt);
                                    }
                                    return toPoint(which === 'start' ? pipe.start : pipe.end);
                                };
                                const nodePoint = (obj: any) => {
                                    if (isCanvasSpace && (obj?.canvasPosition != null)) return toPoint(obj.canvasPosition);
                                    return toPoint(obj?.position || obj?.canvasPosition);
                                };
                                const collectXY = (out: { x: number; y: number }[], ...items: any[]) => {
                                    items.forEach((it: any) => {
                                        if (it?.x != null && it?.y != null) { out.push({ x: it.x, y: it.y }); return; }
                                        if (it?.lat != null && it?.lng != null) { out.push({ x: it.lng, y: it.lat }); return; }
                                        if (it?.position) { const t = toPoint(it.position); if (t) out.push(t); }
                                        if (it?.canvasPosition) { const t = toPoint(it.canvasPosition); if (t) out.push(t); }
                                        if (it?.start) { const t = toPoint(it.start); if (t) out.push(t); }
                                        if (it?.canvasStart) { const t = toPoint(it.canvasStart); if (t) out.push(t); }
                                        if (it?.end) { const t = toPoint(it.end); if (t) out.push(t); }
                                        if (it?.canvasEnd) { const t = toPoint(it.canvasEnd); if (t) out.push(t); }
                                    });
                                };
                                const allPts: { x: number; y: number }[] = [];
                                zones.forEach((z: any) => (z.canvasCoordinates || z.coordinates || []).forEach((p: any) => { const t = toPoint(p); if (t) allPts.push(t); }));
                                pipes.forEach((p: any) => {
                                    const a = pipePoint(p, 'start');
                                    const b = pipePoint(p, 'end');
                                    if (a) allPts.push(a);
                                    if (b) allPts.push(b);
                                });
                                waterSources.forEach((s: any) => { const t = nodePoint(s); if (t) allPts.push(t); });
                                sprinklers.forEach((s: any) => { const t = nodePoint(s); if (t) allPts.push(t); });
                                const coordsList = zones
                                    .filter((z: any) => (z.canvasCoordinates && z.canvasCoordinates.length >= 3) || (z.coordinates && z.coordinates.length >= 3))
                                    .map((z: any) => ({ zone: z, points: (z.canvasCoordinates || z.coordinates) as Array<{ x: number; y: number } | { lat: number; lng: number }> }));
                                const hasAny = coordsList.length > 0 || pipes.length > 0 || waterSources.length > 0 || sprinklers.length > 0;
                                if (hasAny && (allPts.length >= 2 || coordsList.length > 0)) {
                                    const xs = allPts.length ? allPts.map(p => p.x) : [0, 1];
                                    const ys = allPts.length ? allPts.map(p => p.y) : [0, 1];
                                    const minX = Math.min(...xs);
                                    const maxX = Math.max(...xs);
                                    const minY = Math.min(...ys);
                                    const maxY = Math.max(...ys);
                                    const pad = 12;
                                    const w = Math.max(maxX - minX, 1) + pad * 2;
                                    const h = Math.max(maxY - minY, 1) + pad * 2;
                                    const scale = Math.min(260 / w, 180 / h, 2);
                                    const viewW = w * scale;
                                    const viewH = h * scale;
                                    const toSvg = (p: any) => {
                                        const x = p.x != null ? (p.x - minX + pad) * scale : (p.lng - minX + pad) * scale;
                                        const y = p.y != null ? (p.y - minY + pad) * scale : (p.lat - minY + pad) * scale;
                                        return { x, y };
                                    };
                                    // สีโซนให้ตรงกับ ZONE_TYPES ใน homeGardenData (สนามหญ้า/ดอกไม้/ต้นไม้/ห้าม)
                                    const zoneColors: Record<string, string> = { grass: '#22C55E', flowers: '#F472B6', trees: '#16A34A', forbidden: '#EF4444' };
                                    // สีท่อ/หัวฉีด/แหล่งน้ำให้ตรงกับหน้าแผน: ท่อม่วง หัวฉีดจุดขาว แหล่งน้ำโทนเข้ม+น้ำเงิน
                                    const PIPE_STROKE = '#8B5CF6';
                                    const WS_FILL = '#1F2937';
                                    const WS_STROKE = '#3B82F6';
                                    const dataScale = (parsed.canvasData?.scale ?? parsed.imageData?.scale) || 20;
                                    const hexToRgba = (hex: string, alpha: number) => {
                                        if (!hex || !hex.startsWith('#')) return `rgba(51,204,255,${alpha})`;
                                        const h = hex.replace('#', '');
                                        const r = parseInt(h.slice(0, 2), 16);
                                        const g = parseInt(h.slice(2, 4), 16);
                                        const b = parseInt(h.slice(4, 6), 16);
                                        return `rgba(${r},${g},${b},${alpha})`;
                                    };
                                    const sprinklerColor = (sp: any) => getSprinklerColorForPreview(sp, sprinklers);
                                    return (
                                        <div className="mb-3 overflow-hidden rounded-lg border border-gray-600 bg-gray-800" style={{ height: '180px' }}>
                                            <svg width="100%" height="180" viewBox={`0 0 ${viewW} ${viewH}`} preserveAspectRatio="xMidYMid meet" className="block">
                                                <defs>
                                                    {coordsList.map(({ zone, points }) => {
                                                        const pts = points.map((p: any) => toSvg(p)).map(({ x, y }) => `${x},${y}`).join(' ');
                                                        return <clipPath key={`cp-${zone.id}`} id={`clip-zone-${zone.id}`}><polygon points={pts} /></clipPath>;
                                                    })}
                                                </defs>
                                                {/* โซน */}
                                                {coordsList.map(({ zone, points }, idx) => {
                                                    const pts = points.map((p: any) => toSvg(p)).map(({ x, y }) => `${x},${y}`).join(' ');
                                                    const fill = zoneColors[zone.type] || '#22C55E';
                                                    return <polygon key={`z-${zone.id || idx}`} points={pts} fill={fill} fillOpacity={0.4} stroke={fill} strokeWidth={1} />;
                                                })}
                                                {/* ท่อ - สีม่วงเหมือนหน้าแผน */}
                                                {pipes.map((pipe: any, idx: number) => {
                                                    const a = pipePoint(pipe, 'start');
                                                    const b = pipePoint(pipe, 'end');
                                                    if (!a || !b) return null;
                                                    const sa = toSvg(a);
                                                    const sb = toSvg(b);
                                                    return <line key={`pipe-${idx}`} x1={sa.x} y1={sa.y} x2={sb.x} y2={sb.y} stroke={PIPE_STROKE} strokeWidth={2.5} strokeLinecap="round" />;
                                                })}
                                                {/* รัศมีขอบเขตหัวฉีด - ตัดภายในโซน และใช้สีตามที่บันทึก (logic เดียวกับ planner/summary) */}
                                                {sprinklers.map((sp: any, idx: number) => {
                                                    const p = nodePoint(sp);
                                                    if (!p) return null;
                                                    const s = toSvg(p);
                                                    const radiusM = (sp.type?.radius != null && sp.type.radius > 0) ? sp.type.radius : 4;
                                                    const rSvg = radiusM * dataScale * scale;
                                                    if (rSvg < 1) return null;
                                                    const color = sprinklerColor(sp);
                                                    const circleEl = <circle cx={s.x} cy={s.y} r={rSvg} fill={hexToRgba(color, 0.12)} stroke={color} strokeWidth={1} />;
                                                    const zoneId = sp.zoneId;
                                                    const hasZoneClip = zoneId && coordsList.some((c: any) => c.zone.id === zoneId);
                                                    if (hasZoneClip) {
                                                        return <g key={`sp-r-${idx}`} clipPath={`url(#clip-zone-${zoneId})`}>{circleEl}</g>;
                                                    }
                                                    return <g key={`sp-r-${idx}`}>{circleEl}</g>;
                                                })}
                                                {/* แหล่งน้ำ - โทนเข้ม+น้ำเงินเหมือนปั๊ม/ก๊อก */}
                                                {waterSources.map((ws: any, idx: number) => {
                                                    const p = nodePoint(ws);
                                                    if (!p) return null;
                                                    const s = toSvg(p);
                                                    return (
                                                        <g key={`ws-${idx}`}>
                                                            <circle cx={s.x} cy={s.y} r={7} fill={WS_FILL} stroke={WS_STROKE} strokeWidth={1.5} />
                                                            <circle cx={s.x} cy={s.y} r={2.5} fill={WS_STROKE} />
                                                        </g>
                                                    );
                                                })}
                                                {/* หัวฉีด - สีตามที่บันทึก (ใช้ getManualSprinklerColor เหมือน planner/summary) */}
                                                {sprinklers.map((sp: any, idx: number) => {
                                                    const p = nodePoint(sp);
                                                    if (!p) return null;
                                                    const s = toSvg(p);
                                                    const fillColor = sprinklerColor(sp);
                                                    return <circle key={`sp-${idx}`} cx={s.x} cy={s.y} r={4} fill={fillColor} stroke="#FFFFFF" strokeWidth={1} />;
                                                })}
                                            </svg>
                                        </div>
                                    );
                                }
                                return (
                                    <div className="mb-3 flex h-[180px] items-center justify-center rounded-lg border border-gray-600 bg-gray-700/50">
                                        <span className="text-gray-400">🏡 {parsed.designMode === 'canvas' ? t('draw_yourself') : parsed.designMode === 'map' ? t('using_map') : '—'}</span>
                                    </div>
                                );
                            })()}
                            {/* ความต้องการ - อัตราการไหลรวมจากหัวฉีด */}
                            <div className="flex justify-between">
                                <span>{t('ความต้องการ') || 'ความต้องการ'}:</span>
                                <span className="text-white">
                                    {(() => {
                                        const gd = field.garden_data;
                                        const data = typeof gd === 'string' ? (() => { try { return JSON.parse(gd); } catch { return null; } })() : gd;
                                        const sprinklersList = data?.sprinklers || [];
                                        const totalFlow = sprinklersList.reduce((sum: number, s: any) => sum + (s?.type?.flowRate ?? 0), 0);
                                        if (totalFlow > 0) return `${Math.round(totalFlow)} ลิตร/นาที`;
                                        return '—';
                                    })()}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>{t('area_label')}:</span>
                                <span className="text-white">
                                    {(() => {
                                        // Try multiple sources for area data
                                        const areaFromStats =
                                            field.garden_stats?.summary?.totalArea;
                                        const areaFromData = field.garden_data?.gardenZones?.reduce(
                                            (total, zone) => {
                                                if (
                                                    zone.coordinates &&
                                                    zone.coordinates.length >= 3
                                                ) {
                                                    // Use proper area calculation
                                                    const coords =
                                                        zone.canvasCoordinates || zone.coordinates;
                                                    const scale =
                                                        field.garden_data?.designMode ===
                                                            'canvas' ||
                                                            field.garden_data?.designMode === 'image'
                                                            ? field.garden_data?.canvasData
                                                                ?.scale ||
                                                            field.garden_data?.imageData?.scale ||
                                                            20
                                                            : undefined;
                                                    return (
                                                        total + calculatePolygonArea(coords, scale)
                                                    );
                                                }
                                                return total;
                                            },
                                            0
                                        );

                                        if (areaFromStats) {
                                            return `${typeof areaFromStats === 'number' ? areaFromStats.toFixed(2) : parseFloat(areaFromStats || 0).toFixed(2)} ตร.ม.`;
                                        } else if (areaFromData) {
                                            return `${areaFromData.toFixed(2)} ตร.ม.`;
                                        } else if (field.totalArea) {
                                            const areaInSqM =
                                                typeof field.totalArea === 'number'
                                                    ? field.totalArea * 1600
                                                    : parseFloat(field.totalArea || 0) * 1600;
                                            return `${areaInSqM.toFixed(2)} ตร.ม.`;
                                        } else {
                                            return 'N/A';
                                        }
                                    })()}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>{t('design_mode')}:</span>
                                <span className="text-white">
                                    {field.garden_data?.designMode === 'image'
                                        ? t('using_plan')
                                        : field.garden_data?.designMode === 'canvas'
                                            ? t('draw_yourself')
                                            : field.garden_data?.designMode === 'map'
                                                ? t('using_map')
                                                : 'N/A'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>{t('number_of_zones')}:</span>
                                <span className="text-white">
                                    {(() => {
                                        const zonesFromStats =
                                            field.garden_stats?.summary?.totalZones;
                                        const zonesFromData =
                                            field.garden_data?.gardenZones?.length;

                                        if (zonesFromStats) {
                                            return zonesFromStats;
                                        } else if (zonesFromData) {
                                            return zonesFromData;
                                        } else {
                                            return 'N/A';
                                        }
                                    })()}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>{t('sprinklers')}:</span>
                                <span className="text-white">
                                    {(() => {
                                        const sprinklersFromStats =
                                            field.garden_stats?.summary?.totalSprinklers;
                                        const sprinklersFromData =
                                            field.garden_data?.sprinklers?.length;

                                        if (sprinklersFromStats) {
                                            return sprinklersFromStats;
                                        } else if (sprinklersFromData) {
                                            return sprinklersFromData;
                                        } else {
                                            return 'N/A';
                                        }
                                    })()}
                                </span>
                            </div>
                        </>
                    ) : field.category === 'greenhouse' ? (
                        // Greenhouse specific display
                        <>
                            <div className="flex justify-between">
                                <span>{t('greenhouse_area')}:</span>
                                <span className="text-white">
                                    {(() => {
                                        const areaFromStats =
                                            field.greenhouse_data?.summary?.totalGreenhouseArea;
                                        const areaFromData = field.greenhouse_data?.rawData?.shapes
                                            ?.filter((s) => s.type === 'greenhouse')
                                            .reduce((total, shape) => {
                                                return total + 100; // Rough estimate per greenhouse
                                            }, 0);

                                        if (areaFromStats) {
                                            return `${typeof areaFromStats === 'number' ? areaFromStats.toFixed(2) : parseFloat(areaFromStats || 0).toFixed(2)} ตร.ม.`;
                                        } else if (areaFromData) {
                                            return `${areaFromData.toFixed(2)} ตร.ม.`;
                                        } else if (field.totalArea) {
                                            const areaInSqM =
                                                typeof field.totalArea === 'number'
                                                    ? field.totalArea * 1600
                                                    : parseFloat(field.totalArea || 0) * 1600;
                                            return `${areaInSqM.toFixed(2)} ตร.ม.`;
                                        } else {
                                            return 'N/A';
                                        }
                                    })()}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>{t('number_of_plots')}:</span>
                                <span className="text-white">
                                    {(() => {
                                        const plotsFromData =
                                            field.greenhouse_data?.rawData?.shapes?.filter(
                                                (s) => s.type === 'plot'
                                            ).length;

                                        if (plotsFromData) {
                                            return plotsFromData;
                                        } else if (field.totalPlants) {
                                            return field.totalPlants;
                                        } else {
                                            return 'N/A';
                                        }
                                    })()}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>{t('crops_planted')}:</span>
                                <span className="text-white">
                                    {(() => {
                                        const cropsFromData = field.greenhouse_data?.selectedCrops;

                                        if (cropsFromData && cropsFromData.length > 0) {
                                            return cropsFromData.join(', ');
                                        } else {
                                            return 'N/A';
                                        }
                                    })()}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>{t('irrigation_system')}:</span>
                                <span className="text-white">
                                    {(() => {
                                        const irrigationFromData =
                                            field.greenhouse_data?.irrigationMethod;

                                        if (irrigationFromData) {
                                            return irrigationFromData === 'mini-sprinkler'
                                                ? 'มินิสปริงเกลอร์'
                                                : irrigationFromData === 'drip'
                                                    ? 'น้ำหยด'
                                                    : irrigationFromData === 'mixed'
                                                        ? 'ผสม'
                                                        : 'N/A';
                                        } else {
                                            return 'N/A';
                                        }
                                    })()}
                                </span>
                            </div>
                        </>
                    ) : (
                        // Default display for horticulture and other categories
                        <>
                            {/* Map Preview for horticulture */}
                            {field.category === 'horticulture' && (() => {
                                const data = (field as any).projectData || field.project_data;

                                if (!data) return null;

                                let parsedData = data;
                                // Parse if it's a string
                                if (typeof data === 'string') {
                                    try {
                                        parsedData = JSON.parse(data);
                                    } catch (e) {
                                        console.error('Error parsing project_data:', e);
                                        return null;
                                    }
                                }

                                // ✅ ถ้ามี projectImage ที่บันทึกไว้ → แสดงรูปภาพนั้น (รูปที่บันทึกจาก Results)
                                if (parsedData?.projectImage && parsedData.projectImage.startsWith('data:image/')) {
                                    return (
                                        <div className="mb-3">
                                            <img
                                                src={parsedData.projectImage}
                                                alt="แผนผังโครงการ"
                                                className="w-full rounded-lg border border-gray-600 object-cover"
                                                style={{ height: '180px' }}
                                            />
                                        </div>
                                    );
                                }

                                // ถ้าไม่มี projectImage → ใช้ HorticultureMapPreview (วาดแผนที่)
                                // Check if mainArea exists and has data
                                if (!parsedData?.mainArea || parsedData.mainArea.length === 0) {
                                    return null;
                                }

                                return (
                                    <div className="mb-3">
                                        <HorticultureMapPreview
                                            fieldId={field.id}
                                            projectData={parsedData}
                                            height="180px"
                                        />
                                    </div>
                                );
                            })()}

                            <div className="flex justify-between">
                                <span>{t('plant_name')}:</span>
                                <span className="text-white">
                                    {(() => {
                                        // Priority 1: Use plant name from projectData.selectedPlantType (for custom plants)
                                        // Check both projectData (from backend) and project_data (for compatibility)
                                        const projectData = (field as any).projectData || field.project_data;
                                        if (projectData?.selectedPlantType?.name) {
                                            return projectData.selectedPlantType.name;
                                        }
                                        // Priority 2: Use plant name from plantType relation
                                        return field.plantType?.name || 'N/A';
                                    })()}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>{t('area_label')}:</span>
                                <span className="text-white">
                                    {field.totalArea != null
                                        ? typeof field.totalArea === 'number'
                                            ? field.totalArea.toFixed(2)
                                            : (parseFloat(field.totalArea) || 0).toFixed(2)
                                        : 'N/A'}{' '}
                                    {t('rai')}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>{t('quantity')}:</span>
                                <span className="text-white">
                                    {field.totalPlants != null ? field.totalPlants : 'N/A'} {t('plants_unit')}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>{t('water_need')}:</span>
                                <span className="text-white">
                                    {field.total_water_need != null
                                        ? typeof field.total_water_need === 'number'
                                            ? field.total_water_need.toFixed(2)
                                            : (parseFloat(field.total_water_need) || 0).toFixed(2)
                                        : 'N/A'}{' '}
                                    {t('liters_per_session')}
                                </span>
                            </div>
                            {/* แสดงราคาสำหรับโครงการที่เสร็จแล้ว (Finished) */}
                            {isFinished && (() => {
                                const projectStats = (field as any).projectStats || field.project_stats;
                                if (!projectStats) return null;
                                const stats = typeof projectStats === 'string'
                                    ? JSON.parse(projectStats)
                                    : projectStats;
                                // ซ่อนไม่ต้องแสดงถ้าไม่มีหรือเป็น null/undefined หรือไม่ใช่ตัวเลข หรือเป็น NaN หรือต่ำกว่า 1 สตางค์
                                const costNumber = Number(stats.totalCost);
                                if (
                                    stats.totalCost == null ||
                                    isNaN(costNumber) ||
                                    costNumber < 0.01
                                )
                                    return null;
                                return (
                                    <div className="mt-2 flex justify-between border-t border-gray-600 pt-2">
                                        <span className="font-semibold text-yellow-400">💰 {t('total_cost')}:</span>
                                        <span className="font-bold text-yellow-300">
                                            {costNumber.toLocaleString('th-TH', {
                                                minimumFractionDigits: 2,
                                                maximumFractionDigits: 2
                                            }) + ' ' + t('baht')}
                                        </span>
                                    </div>
                                );
                            })()}
                        </>
                    )}
                </div>

                <div className="mt-4 text-xs text-gray-400">
                    <span>{t('last_saved')}: {new Date(field.createdAt).toLocaleDateString()}</span>
                </div>
            </div>
        </div>
    );
};

const CategoryCard = ({
    category,
    onSelect,
    t,
}: {
    category: PlantCategory;
    onSelect: (category: PlantCategory) => void;
    t: (key: string) => string;
}) => {
    const isAvailable = category.isAvailable !== false; // Default to true if not specified
    
    return (
        <div
            className={`bg-gradient-to-br ${category.color} transform rounded-xl p-6 transition-all duration-300 ${
                isAvailable 
                    ? 'cursor-pointer hover:scale-105 hover:shadow-2xl' 
                    : 'cursor-not-allowed opacity-60'
            }`}
            onClick={() => {
                if (isAvailable) {
                    onSelect(category);
                }
            }}
        >
            <div className="mb-4 flex items-center">
                <div className="mr-4 text-4xl">{category.icon}</div>
                <div className="min-w-0 flex-1">
                    <h3 className="break-words text-xl font-bold text-white">{category.name}</h3>
                    <p className="break-words text-sm text-white/80">{category.description}</p>
                </div>
            </div>

            <div className="space-y-2">
                {category.features.map((feature, index) => (
                    <div key={index} className="flex items-center text-sm text-white/90">
                        <svg
                            className="mr-2 h-4 w-4 text-white/70"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M5 13l4 4L19 7"
                            />
                        </svg>
                        {feature}
                    </div>
                ))}
            </div>

            <div className="mt-6 flex items-center justify-between">
                {isAvailable ? (
                    <>
                        <span className="text-sm text-white/80">{t('click_start_planning')}</span>
                        <svg
                            className="h-5 w-5 text-white/80"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M9 5l7 7-7 7"
                            />
                        </svg>
                    </>
                ) : (
                    <div className="flex w-full items-center justify-center gap-2 rounded-lg bg-yellow-500/20 px-4 py-2">
                        <span className="text-sm font-semibold text-yellow-300">
                            🔧 {t('under_development')}
                        </span>
                    </div>
                )}
            </div>
        </div>
    );
};

const CategorySelectionModal = ({
    isOpen,
    onClose,
    onSelectCategory,
    plantCategories,
    t,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSelectCategory: (category: PlantCategory) => void;
    plantCategories: PlantCategory[];
    t: (key: string) => string;
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="relative z-[10000] max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-gray-900 p-8">
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h2 className="mb-2 text-3xl font-bold text-white">
                            {t('choose_irrigation_category')}
                        </h2>
                        <p className="text-gray-400">{t('select_irrigation_type')}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 transition-colors hover:text-white"
                    >
                        <svg
                            className="h-8 w-8"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>

                <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
                    {plantCategories.map((category) => (
                        <CategoryCard
                            key={category.id}
                            category={category}
                            onSelect={onSelectCategory}
                            t={t}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
};

// New folder management components
const FolderCard = ({
    folder,
    fieldCount,
    onSelect,
    onEdit,
    onDelete,
    isSelected,
    t,
}: {
    folder: Folder;
    fieldCount: number;
    onSelect: (folder: Folder) => void;
    onEdit: (folder: Folder) => void;
    onDelete: (folder: Folder) => void;
    isSelected: boolean;
    t: (key: string) => string;
}) => {
    const getFolderIcon = () => {
        if (folder.icon) return folder.icon;
        switch (folder.type) {
            case 'customer':
                return '👤';
            case 'category':
                return '📁';
            case 'custom':
                return '📂';
            default:
                return '📁';
        }
    };

    const getFolderColor = () => {
        if (folder.color) return folder.color;
        switch (folder.type) {
            case 'customer':
                return 'border-blue-500 bg-blue-900/10';
            case 'category':
                return 'border-green-500 bg-green-900/10';
            case 'custom':
                return 'border-purple-500 bg-purple-900/10';
            default:
                return 'border-gray-500 bg-gray-900/10';
        }
    };

    return (
        <div
            className={`cursor-pointer rounded-lg border p-4 transition-all hover:scale-105 ${isSelected ? 'ring-2 ring-blue-400' : ''
                } ${getFolderColor()}`}
            onClick={() => onSelect(folder)}
        >
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <span className="text-2xl">{getFolderIcon()}</span>
                    <div>
                        <h3 className="font-semibold text-white">{folder.name}</h3>
                        <p className="text-sm text-gray-400">
                            {fieldCount} {t('fields')}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onEdit(folder);
                        }}
                        className="rounded p-1 text-gray-400 hover:bg-gray-700 hover:text-white"
                        title={t('edit_folder')}
                    >
                        <FaEdit className="h-4 w-4" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(folder);
                        }}
                        className="rounded p-1 text-red-400 hover:bg-red-900/20 hover:text-red-300"
                        title={t('delete_folder')}
                    >
                        <FaTrash className="h-4 w-4" />
                    </button>
                </div>
            </div>
        </div>
    );
};

// Rename Project Modal
const RenameProjectModal = ({
    isOpen,
    onClose,
    onRename,
    currentName,
    t,
}: {
    isOpen: boolean;
    onClose: () => void;
    onRename: (newName: string) => void;
    currentName: string;
    t: (key: string) => string;
}) => {
    const [newName, setNewName] = useState(currentName);
    
    useEffect(() => {
        if (isOpen) {
            setNewName(currentName);
        }
    }, [isOpen, currentName]);
    
    const handleSubmit = () => {
        if (newName.trim()) {
            onRename(newName.trim());
            onClose();
        }
    };
    
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="relative z-[10000] w-full max-w-md rounded-lg bg-gray-800 p-6">
                {/* Header */}
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-white">{t('rename_project')}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                {/* Input */}
                <div className="mb-6">
                    <label className="mb-2 block text-sm font-medium text-gray-300">
                        {t('project_name')}
                    </label>
                    <input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                handleSubmit();
                            }
                        }}
                        className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                        placeholder={t('enter_new_project_name')}
                        autoFocus
                    />
                </div>
                
                {/* Actions */}
                <div className="flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="rounded bg-gray-700 px-4 py-2 text-white transition-colors hover:bg-gray-600"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={!newName.trim()}
                        className="rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        {t('save')}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Share To User Modal
const ShareToUserModal = ({
    isOpen,
    onClose,
    onSelectUser,
    t,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSelectUser: (user: any) => void;
    t: (key: string) => string;
}) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [users, setUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    
    // Search users
    useEffect(() => {
        if (!isOpen || searchQuery.length < 2) {
            setUsers([]);
            return;
        }
        
        const searchUsers = async () => {
            setLoading(true);
            try {
                const response = await axios.get(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
                setUsers(response.data.users || []);
            } catch (error) {
                console.error('Error searching users:', error);
                setUsers([]);
            } finally {
                setLoading(false);
            }
        };
        
        const debounce = setTimeout(searchUsers, 300);
        return () => clearTimeout(debounce);
    }, [searchQuery, isOpen]);
    
    const handleClose = () => {
        onClose();
        setSearchQuery('');
        setUsers([]);
    };
    
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="relative z-[10000] max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg bg-gray-800 p-6">
                {/* Header */}
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-white">{t('share_to_user')}</h2>
                    <button onClick={handleClose} className="text-gray-400 hover:text-white">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                {/* Search Box */}
                <div className="mb-4">
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full rounded-lg border border-gray-600 bg-gray-700 px-4 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                        placeholder={t('search_by_name_email_phone')}
                        autoFocus
                    />
                </div>
                
                {/* User List */}
                <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 p-4">
                    {loading ? (
                        <div className="py-8 text-center text-gray-400">
                            <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                            {t('loading')}...
                        </div>
                    ) : searchQuery.length < 2 ? (
                        <p className="py-8 text-center text-gray-400">{t('search_by_name_email_phone')}</p>
                    ) : users.length === 0 ? (
                        <p className="py-8 text-center text-gray-400">{t('no_users_found')}</p>
                    ) : (
                        <div className="space-y-2">
                            {users.map((user) => (
                                <button
                                    key={user.id}
                                    onClick={() => {
                                        onSelectUser(user);
                                        // Don't close the modal here, it will be closed when FolderSelectionModal closes
                                    }}
                                    className="flex w-full items-center gap-3 rounded-lg border border-gray-700 bg-gray-800 p-3 text-left transition-colors hover:border-blue-500 hover:bg-blue-900/10"
                                >
                                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-white">
                                        {user.name?.charAt(0).toUpperCase() || '?'}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-white">{user.name}</h3>
                                        <p className="text-sm text-gray-400">{user.email}</p>
                                        {user.phone && <p className="text-xs text-gray-500">{user.phone}</p>}
                                    </div>
                                    <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                
                {/* Close Button */}
                <div className="mt-6 flex justify-end">
                    <button
                        onClick={handleClose}
                        className="rounded bg-gray-700 px-4 py-2 text-white transition-colors hover:bg-gray-600"
                    >
                        {t('cancel')}
                    </button>
                </div>
            </div>
        </div>
    );
};

// Folder Selection Modal for Move/Copy
const FolderSelectionModal = ({
    isOpen,
    onClose,
    onSelect,
    action,
    currentFolderId,
    folders,
    showAllFolders = false,
    t,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (folderId: string | null) => void;
    action: 'move' | 'copy' | 'share';
    currentFolderId?: string | null;
    folders: Folder[];
    showAllFolders?: boolean;
    t: (key: string) => string;
}) => {
    const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
    const [folderHistory, setFolderHistory] = useState<Folder[]>([]);
    
    const handleFolderClick = (folder: Folder) => {
        // If showAllFolders is true, don't navigate into folders (flat list mode)
        if (showAllFolders) {
            return;
        }
        
        // Prevent adding duplicate folders to history
        if (folderHistory.some(f => f.id === folder.id)) {
            // If folder already in history, navigate to that point instead
            const existingIndex = folderHistory.findIndex(f => f.id === folder.id);
            const newHistory = folderHistory.slice(0, existingIndex + 1);
            setFolderHistory(newHistory);
            setSelectedFolder(folder);
            return;
        }
        
        setFolderHistory([...folderHistory, folder]);
        setSelectedFolder(folder);
    };
    
    const handleGoBack = () => {
        if (folderHistory.length > 0) {
            const newHistory = [...folderHistory];
            newHistory.pop();
            const parentFolder = newHistory.length > 0 ? newHistory[newHistory.length - 1] : null;
            setSelectedFolder(parentFolder);
            setFolderHistory(newHistory);
        }
    };
    
    const handleSelectHere = (folderToSelect?: Folder | null) => {
        // Use folderToSelect if provided, otherwise use selectedFolder
        const folder = folderToSelect || selectedFolder;
        
        onSelect(folder?.id || null);
        onClose();
        setSelectedFolder(null);
        setFolderHistory([]);
    };
    
    // Get current level folders
    const getCurrentFolders = () => {
        let result;
        
        if (showAllFolders) {
            // Show all folders when share mode (flat list, no hierarchy)
            // Always show all folders regardless of selectedFolder
            result = folders;
        } else {
            // Normal mode: show hierarchical folders
            if (!selectedFolder) {
                result = folders.filter(f => !f.parent_id);
            } else {
                result = folders.filter(f => f.parent_id === selectedFolder.id);
            }
        }
        
        // Remove duplicates by id to prevent React key warnings
        const uniqueFolders = result.filter((folder, index, self) => 
            index === self.findIndex(f => f.id === folder.id)
        );
        
        return uniqueFolders;
    };
    
    // Close handler
    const handleClose = () => {
        onClose();
        setSelectedFolder(null);
        setFolderHistory([]);
    };
    
    if (!isOpen) return null;
    
    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="relative z-[10000] max-h-[90vh] w-full max-w-3xl overflow-hidden rounded-lg bg-gray-800 p-6">
                {/* Header */}
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-white">
                        {action === 'move' ? t('move_project') : action === 'share' ? t('share_to_user') : t('copy_project')}
                    </h2>
                    <button onClick={handleClose} className="text-gray-400 hover:text-white">
                        <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </div>
                
                {/* Breadcrumb Navigation - Only show in normal mode */}
                {!showAllFolders && (
                    <div className="mb-4 flex items-center gap-2 text-sm text-gray-400">
                        <button
                            onClick={() => {
                                setSelectedFolder(null);
                                setFolderHistory([]);
                            }}
                            className="hover:text-white"
                        >
                            {t('all_folders')}
                        </button>
                        {folderHistory.map((folder, index) => (
                            <React.Fragment key={`breadcrumb-${folder.id}-${index}`}>
                                <span>/</span>
                                <button
                                    onClick={() => {
                                        const newHistory = folderHistory.slice(0, index + 1);
                                        setFolderHistory(newHistory);
                                        setSelectedFolder(folder);
                                    }}
                                    className="hover:text-white"
                                >
                                    {folder.name}
                                </button>
                            </React.Fragment>
                        ))}
                    </div>
                )}
                
                {/* Folder List */}
                <div className="max-h-[50vh] overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 p-4">
                    {getCurrentFolders().length === 0 ? (
                        <p className="py-8 text-center text-gray-400">{t('no_folders_yet')}</p>
                    ) : (
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                            {getCurrentFolders().map((folder, index) => (
                                <button
                                    key={`folder-${folder.id}-${index}`}
                                    onClick={() => {
                                        if (showAllFolders) {
                                            // In flat list mode, single click selects the folder
                                            // Pass folder directly to handleSelectHere to avoid async state issue
                                            handleSelectHere(folder);
                                        } else {
                                            // Allow navigation into folders even if it's the current folder
                                            // This allows moving projects from main folder to subfolders
                                            handleFolderClick(folder);
                                        }
                                    }}
                                    onDoubleClick={() => {
                                        if (!showAllFolders && folder.id !== currentFolderId) {
                                            // Pass folder directly to handleSelectHere to avoid async state issue
                                            handleSelectHere(folder);
                                        }
                                    }}
                                    className={`flex items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                                        folder.id === currentFolderId
                                            ? 'border-gray-600 bg-gray-800 opacity-70 cursor-pointer'
                                            : showAllFolders
                                            ? 'border-gray-700 bg-gray-800 hover:border-blue-500 hover:bg-blue-900/10 cursor-pointer'
                                            : 'border-gray-700 bg-gray-800 hover:border-blue-500 hover:bg-blue-900/10 cursor-pointer'
                                    }`}
                                >
                                    <span className="text-2xl">
                                        {folder.icon || (folder.type === 'customer' ? '👤' : folder.type === 'category' ? '📁' : '📂')}
                                    </span>
                                    <div className="flex-1">
                                        <h3 className="font-semibold text-white">
                                            {folder.name}
                                            {folder.id === currentFolderId && (
                                                <span className="ml-2 text-xs text-yellow-400">(โฟลเดอร์ปัจจุบัน)</span>
                                            )}
                                        </h3>
                                        <p className="text-xs text-gray-400">
                                            {showAllFolders && folder.parent_id ? (
                                                <>
                                                    {t('parent_folder')}: {folders.find(f => f.id === folder.parent_id)?.name || 'N/A'}
                                                </>
                                            ) : (
                                                <>
                                                    {folders.filter(f => f.parent_id === folder.id).length} {t('sub_folders')}
                                                    {folder.id === currentFolderId && folders.filter(f => f.parent_id === folder.id).length > 0 && (
                                                        <span className="ml-1 text-blue-400"> - คลิกเพื่อดูโฟลเดอร์ย่อย</span>
                                                    )}
                                                </>
                                            )}
                                        </p>
                                    </div>
                                    {!showAllFolders && (
                                        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                        </svg>
                                    )}
                                    {showAllFolders && (
                                        <svg className="h-5 w-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
                
                {/* Actions */}
                <div className="mt-6 flex items-center justify-between gap-3">
                    {!showAllFolders && folderHistory.length > 0 && (
                        <button
                            onClick={handleGoBack}
                            className="flex items-center gap-2 rounded bg-gray-700 px-4 py-2 text-white transition-colors hover:bg-gray-600"
                        >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                            </svg>
                            {t('back')}
                        </button>
                    )}
                    <div className="flex-1" />
                    <button
                        onClick={handleClose}
                        className="rounded bg-gray-700 px-4 py-2 text-white transition-colors hover:bg-gray-600"
                    >
                        {t('cancel')}
                    </button>
                    <button
                        onClick={() => {
                            // Prevent selecting the current folder (where the project already is)
                            if (selectedFolder?.id === currentFolderId) {
                                return;
                            }
                            handleSelectHere();
                        }}
                        disabled={selectedFolder?.id === currentFolderId}
                        className={`rounded px-4 py-2 text-white transition-colors ${
                            selectedFolder?.id === currentFolderId
                                ? 'cursor-not-allowed bg-gray-600 opacity-50'
                                : 'bg-blue-600 hover:bg-blue-700'
                        }`}
                    >
                        {action === 'move' ? t('move_here') : t('copy_here')}
                    </button>
                </div>
            </div>
        </div>
    );
};

const CreateFolderModal = ({
    isOpen,
    onClose,
    onCreate,
    parentFolder,
    t,
}: {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (folder: Omit<Folder, 'id' | 'createdAt' | 'updatedAt'>) => void;
    parentFolder?: Folder | null;
    t: (key: string) => string;
}) => {
    const [folderName, setFolderName] = useState('');
    const [folderType, setFolderType] = useState<'custom'>('custom');
    const [folderColor, setFolderColor] = useState('#6366f1');
    const [folderIcon, setFolderIcon] = useState('📁');

    const colors = [
        { name: 'Blue', value: '#3b82f6' },
        { name: 'Green', value: '#10b981' },
        { name: 'Purple', value: '#8b5cf6' },
        { name: 'Red', value: '#ef4444' },
        { name: 'Yellow', value: '#f59e0b' },
        { name: 'Pink', value: '#ec4899' },
    ];

    const icons = ['📁', '📂', '🗂️', '📋', '📝', '📌', '🏷️', '⭐', '💡', '🎯'];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!folderName.trim()) return;

        onCreate({
            name: folderName.trim(),
            type: folderType,
            parent_id: parentFolder?.id,
            color: folderColor,
            icon: folderIcon,
        });

        setFolderName('');
        setFolderColor('#6366f1');
        setFolderIcon('📁');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
            <div className="relative z-[10000] mx-4 w-full max-w-md rounded-lg bg-gray-800 p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-white">
                        {parentFolder
                            ? `${t('create_sub_folder')} "${parentFolder.name}"`
                            : t('create_folder')}
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <svg
                            className="h-6 w-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="mb-2 block text-sm font-medium text-gray-300">
                            {t('folder_name')}
                        </label>
                        <input
                            type="text"
                            value={folderName}
                            onChange={(e) => setFolderName(e.target.value)}
                            className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                            placeholder={t('enter_folder_name')}
                            autoFocus
                        />
                    </div>
                    <div className="mb-4">
                        <label className="mb-2 block text-sm font-medium text-gray-300">
                            {t('folder_icon')}
                        </label>
                        <div className="grid grid-cols-5 gap-2">
                            {icons.map((icon) => (
                                <button
                                    key={icon}
                                    type="button"
                                    onClick={() => setFolderIcon(icon)}
                                    className={`rounded p-2 text-xl ${folderIcon === icon
                                            ? 'bg-blue-600'
                                            : 'bg-gray-700 hover:bg-gray-600'
                                        }`}
                                >
                                    {icon}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded px-4 py-2 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={!folderName.trim()}
                            className="rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                        >
                            {t('create')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const EditFolderModal = ({
    isOpen,
    onClose,
    onSave,
    folder,
    t,
}: {
    isOpen: boolean;
    onClose: () => void;
    onSave: (folderId: string, updates: Partial<Folder>) => void;
    folder: Folder | null;
    t: (key: string) => string;
}) => {
    const [folderName, setFolderName] = useState('');
    const [folderColor, setFolderColor] = useState('#6366f1');
    const [folderIcon, setFolderIcon] = useState('📁');

    const colors = [
        { name: 'Blue', value: '#3b82f6' },
        { name: 'Green', value: '#10b981' },
        { name: 'Purple', value: '#8b5cf6' },
        { name: 'Red', value: '#ef4444' },
        { name: 'Yellow', value: '#f59e0b' },
        { name: 'Pink', value: '#ec4899' },
    ];

    const icons = ['📁', '📂', '🗂️', '📋', '📝', '📌', '🏷️', '⭐', '💡', '🎯'];

    useEffect(() => {
        if (folder) {
            setFolderName(folder.name);
            setFolderColor(folder.color || '#6366f1');
            setFolderIcon(folder.icon || '📁');
        }
    }, [folder]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!folder || !folderName.trim()) return;

        onSave(folder.id, {
            name: folderName.trim(),
            color: folderColor,
            icon: folderIcon,
            updatedAt: new Date().toISOString(),
        });

        onClose();
    };

    if (!isOpen || !folder) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
            <div className="relative z-[10000] mx-4 w-full max-w-md rounded-lg bg-gray-800 p-6">
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-xl font-semibold text-white">{t('edit_folder')}</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <svg
                            className="h-6 w-6"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                        >
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M6 18L18 6M6 6l12 12"
                            />
                        </svg>
                    </button>
                </div>
                <form onSubmit={handleSubmit}>
                    <div className="mb-4">
                        <label className="mb-2 block text-sm font-medium text-gray-300">
                            {t('folder_name')}
                        </label>
                        <input
                            type="text"
                            value={folderName}
                            onChange={(e) => setFolderName(e.target.value)}
                            className="w-full rounded-lg border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                            placeholder={t('enter_folder_name')}
                        />
                    </div>
                    <div className="mb-4">
                        <label className="mb-2 block text-sm font-medium text-gray-300">
                            {t('folder_icon')}
                        </label>
                        <div className="grid grid-cols-5 gap-2">
                            {icons.map((icon) => (
                                <button
                                    key={icon}
                                    type="button"
                                    onClick={() => setFolderIcon(icon)}
                                    className={`rounded p-2 text-xl ${folderIcon === icon
                                            ? 'bg-blue-600'
                                            : 'bg-gray-700 hover:bg-gray-600'
                                        }`}
                                >
                                    {icon}
                                </button>
                            ))}
                        </div>
                    </div>
                    
                    <div className="flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="rounded px-4 py-2 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
                        >
                            {t('cancel')}
                        </button>
                        <button
                            type="submit"
                            disabled={!folderName.trim()}
                            className="rounded bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                        >
                            {t('save')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default function Home() {
    // Add safety check for language context
    let t: (key: string) => string;
    try {
        const languageContext = useLanguage();
        t = languageContext.t;
    } catch (error) {
        // Fallback function if context is not available
        t = (key: string) => key;
    }

    // Always call usePage hook at the top level
    const page = usePage();

    let auth: any = null;
    try {
        auth = (page.props as any).auth;
    } catch (error) {
        // Silently handle the error - this is expected during initial render
        // The context will be available after the component mounts
    }

    const [fields, setFields] = useState<Field[]>([]);
    const [folders, setFolders] = useState<Folder[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [fieldToDelete, setFieldToDelete] = useState<Field | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [selectedFolder, setSelectedFolder] = useState<Folder | null>(null);
    const [folderHistory, setFolderHistory] = useState<Folder[]>([]);
    const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
    const [showEditFolderModal, setShowEditFolderModal] = useState(false);
    const [folderToEdit, setFolderToEdit] = useState<Folder | null>(null);
    const [showFinishedProjectModal, setShowFinishedProjectModal] = useState(false);
    const [selectedFinishedProject, setSelectedFinishedProject] = useState<Field | null>(null);
    const [showQuotationModal, setShowQuotationModal] = useState(false);
    const [folderToDelete, setFolderToDelete] = useState<Folder | null>(null);
    const [showFolderDeleteConfirm, setShowFolderDeleteConfirm] = useState(false);
    const [parentFolderForModal, setParentFolderForModal] = useState<Folder | null>(null);
    
    // New states for move/copy/share/rename functionality
    const [showRenameModal, setShowRenameModal] = useState(false);
    const [fieldToRename, setFieldToRename] = useState<Field | null>(null);
    const [showFolderSelectionModal, setShowFolderSelectionModal] = useState(false);
    const [folderSelectionAction, setFolderSelectionAction] = useState<'move' | 'copy'>('move');
    const [fieldToMoveOrCopy, setFieldToMoveOrCopy] = useState<Field | null>(null);
    const [showShareModal, setShowShareModal] = useState(false);
    const [fieldToShare, setFieldToShare] = useState<Field | null>(null);
    const [selectedUserForShare, setSelectedUserForShare] = useState<any>(null);
    const [userFoldersForShare, setUserFoldersForShare] = useState<Folder[]>([]);
    const [showUserFolderSelectionModal, setShowUserFolderSelectionModal] = useState(false);

    const plantCategories = getPlantCategories(t);

    // Robust navigation function to handle router initialization issues
    const navigateToRoute = (route: string) => {
        try {
            // Check if router is available and has the visit method
            if (router && typeof router.visit === 'function') {
                router.visit(route);
            } else {
                window.location.href = route;
            }
        } catch (error) {
            console.error('Navigation error, falling back to window.location:', error);
            window.location.href = route;
        }
    };

    // Initialize default folders if none exist
    useEffect(() => {
        // System folders are created in the backend, so we don't need to initialize them here
        // The backend will create them when the user first accesses the folders
    }, [folders.length, t]);

    // Group fields by folder
    const getFieldsByFolder = (folderId: string) => {
        return fields.filter((field) => String(field.folderId) === String(folderId));
    };

    // Get all folders including system folders
    const getAllFolders = () => {
        // Only return root folders (folders without parent_id)
        const rootFolders = folders.filter((folder) => !folder.parent_id);
        return rootFolders;
    };

    // Get fields for current view
    const getCurrentFields = () => {
        if (!selectedFolder) return fields;

        // Check by folder type instead of name for better reliability
        if (selectedFolder.type === 'finished') {
            return fields.filter(
                (field) =>
                    (field.status === 'finished' || field.isCompleted) &&
                    String(field.folderId) === String(selectedFolder.id)
            );
        }
        if (selectedFolder.type === 'unfinished') {
            // Show fields that are unfinished AND are assigned to this specific folder (not unassigned ones)
            return fields.filter(
                (field) =>
                    field.status !== 'finished' &&
                    !field.isCompleted &&
                    String(field.folderId) === String(selectedFolder.id)
            );
        }

        return getFieldsByFolder(selectedFolder.id);
    };

    // Get field count for a specific folder
    const getFieldCountForFolder = (folder: Folder) => {
        // Check by folder type instead of name for better reliability
        if (folder.type === 'finished') {
            const count = fields.filter(
                (field) =>
                    (field.status === 'finished' || field.isCompleted) &&
                    String(field.folderId) === String(folder.id)
            ).length;
            
            return count;
        }
        if (folder.type === 'unfinished') {
            // Count fields that are unfinished AND are assigned to this specific folder (not unassigned ones)
            const count = fields.filter(
                (field) =>
                    field.status !== 'finished' &&
                    !field.isCompleted &&
                    String(field.folderId) === String(folder.id)
            ).length;
            
            return count;
        }

        return getFieldsByFolder(folder.id).length;
    };

    useEffect(() => {
        // Load saved fields and folders from database
        const fetchData = async () => {
            try {
                const [fieldsResponse, foldersResponse] = await Promise.all([
                    axios.get('/fields-api'), // Updated to use new endpoint
                    axios.get('/folders-api'), // Updated to use new route path
                ]);

                if (fieldsResponse.data.fields) {
                    const allFields = fieldsResponse.data.fields.map((f: any) => ({
                        id: f.id,
                        name: f.name,
                        folderId: f.folderId,
                        folderIdType: typeof f.folderId,
                        status: f.status,
                        isCompleted: f.isCompleted,
                    }));
                    
                    const unfinishedFields = fieldsResponse.data.fields.filter((f: any) => 
                        f.status !== 'finished' && !f.isCompleted
                    ).map((f: any) => ({
                        id: f.id,
                        name: f.name,
                        folderId: f.folderId,
                        folderIdType: typeof f.folderId,
                    }));
                    
                    setFields(fieldsResponse.data.fields);
                }
                
                if (foldersResponse.data.folders) {
                    setFolders(foldersResponse.data.folders);

                    // Commented out automatic mock field creation to avoid issues
                    // if (fieldsResponse.data.fields.length === 0) {
                    //     createMockField();
                    // }
                } else {
                    console.warn('⚠️ No folders in response:', foldersResponse.data);
                }
            } catch (error: any) {
                console.error('❌ Error fetching data:', error);
                console.error('Error details:', error.response?.data);
            } finally {
                setLoading(false);
            }
        };

        fetchData();

        // Clear navigation history on mount
        setSelectedFolder(null);
        setFolderHistory([]);
    }, []);

    const handleAddField = () => {
        setShowCategoryModal(true);
    };

    const createMockField = () => {
        // Find the "Unfinished" folder by type instead of name
        const unfinishedFolder = folders.find((f) => f.type === 'unfinished');
        const folderId = unfinishedFolder ? unfinishedFolder.id : undefined;

        const mockField: Field = {
            id: `mock-${Date.now()}`,
            name: 'Test Field',
            customerName: 'Test Customer',
            category: 'horticulture',
            status: 'unfinished',
            isCompleted: false,
            folderId: folderId, // Assign to "Unfinished" folder
            area: [
                { lat: 13.7563, lng: 100.5018 },
                { lat: 13.7564, lng: 100.5019 },
                { lat: 13.7565, lng: 100.502 },
                { lat: 13.7563, lng: 100.5018 },
            ],
            plantType: {
                id: 1,
                name: 'Tomato',
                type: 'vegetable',
                plant_spacing: 0.5,
                row_spacing: 1.0,
                water_needed: 2.5,
            },
            totalPlants: 100,
            totalArea: 50.0,
            total_water_need: 125.0,
            createdAt: new Date().toISOString(),
            layers: [],
        };

        // Add to fields state
        setFields((prev) => [...prev, mockField]);
    };

    const handleCategorySelect = (category: PlantCategory) => {
        setShowCategoryModal(false);
        // Clear any saved data when starting a new project
        localStorage.removeItem('horticultureIrrigationData');
        localStorage.removeItem('editingFieldId'); // Clear editing field ID for new projects
        localStorage.removeItem('currentFieldId'); // Clear current field ID for new projects
        localStorage.removeItem('currentFieldName'); // Clear current field name for new projects

        // Add a small delay to ensure router is fully initialized
        setTimeout(() => {
            navigateToRoute(category.route);
        }, 100);
    };

    const handleFieldSelect = (field: Field) => {
        try {
            // Validate field data before navigation
            if (!field.area || field.area.length < 3) {
                alert(t('invalid_area_data'));
                return;
            }

            if (!field.plantType) {
                alert(t('invalid_plant_data'));
                return;
            }

            // Store field ID in localStorage for later use in product page
            localStorage.setItem('currentFieldId', field.id);
            localStorage.setItem('currentFieldName', field.name);

            // Check if field is finished - if so, show modal with 3 options
            if (field.status === 'finished' || field.isCompleted) {
                setSelectedFinishedProject(field);
                setShowFinishedProjectModal(true);
                return;
            }

            // Route to appropriate planner based on field category
            switch (field.category) {
                case 'home-garden': {
                    // ล้างแคชก่อน แล้วโหลดข้อมูลโครงการนี้ลง localStorage เพื่อให้ planner แสดงตามที่บันทึกไว้
                    clearGardenDataCache();
                    if (field.garden_data) {
                        const gardenData = typeof field.garden_data === 'string' ? (() => { try { return JSON.parse(field.garden_data); } catch { return null; } })() : field.garden_data;
                        if (gardenData) localStorage.setItem('gardenPlannerData', JSON.stringify(gardenData));
                    }
                    navigateToRoute('/home-garden/planner');
                    break;
                }

                case 'field-crop':
                    navigateToRoute('/field-crop');
                    break;

                // case 'khok-nong-na':
                //     navigateToRoute('/khok-nong-na');
                //     break;

                case 'greenhouse': {
                    // Extract crop and method from saved greenhouse data
                    const greenhouseData = field.greenhouse_data;
                    const crops = greenhouseData?.selectedCrops || [];
                    const method = greenhouseData?.planningMethod || 'draw';
                    const lastSavedPage = greenhouseData?.lastSavedPage || 'planner';

                    // Build query parameters
                    const queryParams = new URLSearchParams();
                    if (crops.length > 0) {
                        queryParams.set('crops', crops.join(','));
                    }
                    if (method) {
                        queryParams.set('method', method);
                    }

                    // Navigate to the appropriate page based on where the draft was last saved
                    if (lastSavedPage === 'irrigation-selection') {
                        // If saved from irrigation selection page, go to choose-irrigation
                        if (greenhouseData?.shapes) {
                            queryParams.set(
                                'shapes',
                                encodeURIComponent(JSON.stringify(greenhouseData.shapes))
                            );
                        }
                        navigateToRoute(`/choose-irrigation?${queryParams.toString()}`);
                    } else if (lastSavedPage === 'irrigation-design') {
                        // If saved from irrigation design page, go to greenhouse-map
                        if (greenhouseData?.shapes) {
                            queryParams.set(
                                'shapes',
                                encodeURIComponent(JSON.stringify(greenhouseData.shapes))
                            );
                        }
                        if (greenhouseData?.irrigationMethod) {
                            queryParams.set('irrigation', greenhouseData.irrigationMethod);
                        }
                        navigateToRoute(`/greenhouse-map?${queryParams.toString()}`);
                    } else {
                        // Default: go to greenhouse planner
                        navigateToRoute(`/greenhouse-planner?${queryParams.toString()}`);
                    }
                    break;
                }

                case 'horticulture':
                default: {
                    // Store field name in localStorage before navigation
                    localStorage.setItem('currentFieldId', field.id);
                    localStorage.setItem('currentFieldName', field.name);

                    // Prepare the data in the same format as map-planner for horticulture
                    const params = new URLSearchParams({
                        area: JSON.stringify(field.area),
                        areaType: '',
                        plantType: JSON.stringify(field.plantType),
                        layers: JSON.stringify(field.layers || []),
                        editFieldId: field.id, // Use editFieldId to match planner expectations
                    });
                    navigateToRoute(`/horticulture/planner?${params.toString()}`);
                    break;
                }
            }
        } catch (error) {
            console.error('Error preparing field data for navigation:', error);
            alert(t('error_opening_field'));
        }
    };

    const handleFieldDelete = (fieldId: string) => {
        const field = fields.find((f) => f.id === fieldId);
        if (field) {
            setFieldToDelete(field);
            setShowDeleteConfirm(true);
        }
    };

    const handleFieldStatusChange = async (
        fieldId: string,
        status: string,
        isCompleted: boolean
    ) => {
        try {
            // Convert ID to string and check if this is a mock field (ID starts with 'mock-')
            const fieldIdStr = String(fieldId);
            if (fieldIdStr.startsWith('mock-')) {
                // For mock fields, just update frontend state
                setFields((prev) =>
                    prev.map((f) => (f.id === fieldId ? { ...f, status, isCompleted } : f))
                );
            } else {
                // For real fields, make API call to update database
                const response = await axios.put(`/api/fields/${fieldId}/status`, {
                    status,
                    is_completed: isCompleted,
                });

                if (response.data.success) {
                    setFields((prev) =>
                        prev.map((f) => (f.id === fieldId ? { ...f, status, isCompleted } : f))
                    );
                }
            }
        } catch (error) {
            console.error('Error updating field status:', error);
            alert(t('error_updating_status'));
        }
    };

    const confirmDelete = async () => {
        if (!fieldToDelete) return;

        setDeleting(true);
        try {
            // Convert ID to string and check if this is a mock field (ID starts with 'mock-')
            const fieldId = String(fieldToDelete.id);
            if (fieldId.startsWith('mock-')) {
                // For mock fields, just remove from frontend state
                setFields((prev) => prev.filter((f) => f.id !== fieldToDelete.id));
                setShowDeleteConfirm(false);
                setFieldToDelete(null);
            } else {
                // For real fields, make API call to delete from database
                const response = await axios.delete(`/api/fields/${fieldToDelete.id}`);

                if (response.data.success) {
                    // Remove the field from the list
                    setFields((prev) => prev.filter((f) => f.id !== fieldToDelete.id));
                    setShowDeleteConfirm(false);
                    setFieldToDelete(null);
                } else {
                    console.error('Backend returned success: false');
                    alert(t('error_deleting_field'));
                }
            }
        } catch (error: any) {
            console.error('Error deleting field:', error);
            console.error('Error response:', error.response?.data);
            console.error('Error status:', error.response?.status);

            // Check if it's a CSRF token error
            if (error.response?.status === 419) {
                try {
                    await refreshCsrfToken();
                    // Retry the delete request
                    const retryResponse = await axios.delete(`/api/fields/${fieldToDelete.id}`);
                    if (retryResponse.data.success) {
                        setFields((prev) => prev.filter((f) => f.id !== fieldToDelete.id));
                        setShowDeleteConfirm(false);
                        setFieldToDelete(null);
                        return;
                    }
                } catch (retryError: any) {
                    console.error('Retry failed:', retryError);
                }
            }

            // Check if the field was actually deleted despite the error
            if (error.response?.status === 200 || error.response?.status === 204) {
                setFields((prev) => prev.filter((f) => f.id !== fieldToDelete.id));
                setShowDeleteConfirm(false);
                setFieldToDelete(null);
            } else {
                alert(t('error_deleting_field'));
            }
        } finally {
            setDeleting(false);
        }
    };

    const cancelDelete = () => {
        setShowDeleteConfirm(false);
        setFieldToDelete(null);
    };

    // Folder management functions
    const handleCreateFolder = async (
        folderData: Omit<Folder, 'id' | 'createdAt' | 'updatedAt'>
    ) => {
        try {
            const response = await axios.post('/folders-api', folderData);
            if (response.data.success) {
                // Use the folder returned from the API with the real database ID
                setFolders((prev) => [...prev, response.data.folder]);
            }
        } catch (error) {
            console.error('Error creating folder:', error);
            alert(t('error_creating_folder'));
        }
    };

    const handleCreateSubFolder = (parentFolder: Folder) => {
        setParentFolderForModal(parentFolder);
        setShowCreateFolderModal(true);
    };

    const handleEditFolder = (folder: Folder) => {
        setFolderToEdit(folder);
        setShowEditFolderModal(true);
    };

    const handleSaveFolder = async (folderId: string, updates: Partial<Folder>) => {
        try {
            const response = await axios.put(`/api/folders/${folderId}`, updates);
            if (response.data.success) {
                setFolders((prev) =>
                    prev.map((f) => (f.id === folderId ? { ...f, ...updates } : f))
                );
                setShowEditFolderModal(false);
                setFolderToEdit(null);
            }
        } catch (error) {
            console.error('Error updating folder:', error);
            alert(t('error_updating_folder'));
        }
    };

    const handleDeleteFolder = (folder: Folder) => {
        setFolderToDelete(folder);
        setShowFolderDeleteConfirm(true);
    };

    const confirmFolderDelete = async () => {
        if (!folderToDelete) return;

        try {
            const response = await axios.post(`/folders-api/${folderToDelete.id}/delete`);

            if (response.data.success) {
                // Move fields to uncategorized folder
                setFields((prev) =>
                    prev.map((f) =>
                        f.folderId === folderToDelete.id ? { ...f, folderId: 'uncategorized' } : f
                    )
                );

                // Remove folder and all its sub-folders
                setFolders((prev) =>
                    prev.filter(
                        (f) => f.id !== folderToDelete.id && f.parent_id !== folderToDelete.id
                    )
                );
                setShowFolderDeleteConfirm(false);
                setFolderToDelete(null);

                // If we were viewing the deleted folder, go back to all
                if (selectedFolder?.id === folderToDelete.id) {
                    setSelectedFolder(null);
                }
            }
        } catch (error: any) {
            console.error('Error deleting folder:', error);
            console.error('Error details:', error.response?.data);
            alert(t('error_deleting_folder'));
        }
    };

    const cancelFolderDelete = () => {
        setShowFolderDeleteConfirm(false);
        setFolderToDelete(null);
    };


    const handleFolderSelect = (folder: Folder) => {
        setSelectedFolder(folder);
        setFolderHistory((prev) => [...prev, folder]);
    };

    const handleGoBack = () => {
        if (folderHistory.length > 0) {
            const newHistory = [...folderHistory];
            newHistory.pop(); // Remove current folder
            const parentFolder = newHistory.length > 0 ? newHistory[newHistory.length - 1] : null;
            setSelectedFolder(parentFolder);
            setFolderHistory(newHistory);
        } else {
            setSelectedFolder(null);
            setFolderHistory([]);
        }
    };

    const handleGoHome = () => {
        setSelectedFolder(null);
        setFolderHistory([]);
    };
    
    // Handler for rename project
    const handleRenameProject = (field: Field) => {
        setFieldToRename(field);
        setShowRenameModal(true);
    };
    
    // Handler for submitting rename
    const handleSubmitRename = async (newName: string) => {
        if (!fieldToRename) return;
        
        try {
            const response = await axios.put(`/api/fields/${fieldToRename.id}/name`, {
                name: newName,
            });
            
            if (response.data.success) {
                setFields(prev => prev.map(f => 
                    f.id === fieldToRename.id ? { ...f, name: newName } : f
                ));
                alert(t('rename_project_success'));
            }
        } catch (error: any) {
            console.error('Error renaming project:', error);
            alert(`Error renaming project: ${error.response?.data?.message || error.message}`);
        } finally {
            setShowRenameModal(false);
            setFieldToRename(null);
        }
    };
    
    // Handler for move project
    const handleMoveProject = (field: Field) => {
        setFieldToMoveOrCopy(field);
        setFolderSelectionAction('move');
        setShowFolderSelectionModal(true);
    };
    
    // Handler for copy project
    const handleCopyProject = (field: Field) => {
        setFieldToMoveOrCopy(field);
        setFolderSelectionAction('copy');
        setShowFolderSelectionModal(true);
    };
    
    // Handler for share project
    const handleShareProject = (field: Field) => {
        setFieldToShare(field);
        setShowShareModal(true);
    };

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-900">
                <div className="text-xl text-white">{t('loading')}</div>
            </div>
        );
    }

    return (
        <div className="flex min-h-screen flex-col bg-gray-900">
            <Navbar />
            <div className="flex-1 min-h-screen pt-20">
                <div className="p-6">
                    <div className="mx-auto max-w-7xl">
                        {/* Main Content Header */}
                        <div className="mb-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h1 className="text-3xl font-bold text-white">
                                        {t('water_management_system')}
                                    </h1>
                                    <p className="mt-2 text-gray-400">
                                        {t('manage_irrigation_fields')}
                                    </p>
                                </div>
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => setShowCreateFolderModal(true)}
                                        className="flex items-center gap-2 rounded-lg bg-green-600 px-4 py-3 font-semibold text-white transition-colors duration-200 hover:bg-green-700"
                                    >
                                        <FaPlus className="h-4 w-4" />
                                        {t('create_folder')}
                                    </button>

                                    <button
                                        onClick={handleAddField}
                                        className="flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-colors duration-200 hover:bg-blue-700"
                                    >
                                        <svg
                                            className="h-5 w-5"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M12 4v16m8-8H4"
                                            />
                                        </svg>
                                        {t('add_field')}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Folder Navigation */}
                        <div className="mb-4">
                            {selectedFolder && (
                                <div className="flex items-center gap-2 justify-between w-full">
                                    <div className="flex items-center gap-2">
                                        <button
                                            className="flex items-center gap-2 text-blue-400 hover:underline"
                                            onClick={handleGoBack}
                                        >
                                            <FaArrowLeft />
                                            {folderHistory.length > 0 ? t('back') : t('all_folders')}
                                        </button>
                                        {/* Breadcrumb */}
                                        {folderHistory.length > 0 && (
                                            <div className="flex items-center gap-2 text-gray-400">
                                                <span>/</span>
                                                {folderHistory.map((folder, index) => (
                                                    <div
                                                        key={folder.id}
                                                        className="flex items-center gap-2"
                                                    >
                                                        <button
                                                            className="hover:text-white hover:underline"
                                                            onClick={() => {
                                                                const newHistory = folderHistory.slice(
                                                                    0,
                                                                    index + 1
                                                                );
                                                                setFolderHistory(newHistory);
                                                                setSelectedFolder(folder);
                                                            }}
                                                        >
                                                            {folder.name}
                                                        </button>
                                                        {index < folderHistory.length - 1 && (
                                                            <span>/</span>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    {/* Create Sub-folder Button */}
                                    <div className="flex-shrink-0">
                                        <button
                                            onClick={() => handleCreateSubFolder(selectedFolder)}
                                            className="flex items-center gap-2 rounded-lg bg-yellow-600 px-4 py-2 font-semibold text-white transition-colors duration-200 hover:bg-yellow-700"
                                        >
                                            <FaPlus className="h-4 w-4" />
                                            {t('create_sub_folder')}
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Content */}
                        {!selectedFolder ? (
                            // Show all folders and category folders
                            <div>
                                {/* System Folders */}
                                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                                    {getAllFolders().map((folder) => (
                                        <FolderCard
                                            key={folder.id}
                                            folder={folder}
                                            fieldCount={getFieldCountForFolder(folder)}
                                            onSelect={handleFolderSelect}
                                            onEdit={
                                                folder.type === 'category'
                                                    ? () => { }
                                                    : handleEditFolder
                                            }
                                            onDelete={
                                                folder.type === 'category'
                                                    ? () => { }
                                                    : handleDeleteFolder
                                            }
                                            isSelected={false}
                                            t={t}
                                        />
                                    ))}
                                </div>

                                {/* Unassigned Fields Section */}
                                {(() => {
                                    const unassignedFields = fields.filter(
                                        (field) => !field.folderId
                                    );
                                    return unassignedFields.length > 0 ? (
                                        <div className="mt-8">
                                            <h3 className="mb-4 text-lg font-semibold text-white">
                                                {t('unassigned_fields')} ({unassignedFields.length})
                                            </h3>
                                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                                                {unassignedFields.map((field) => (
                                                    <FieldCard
                                                        key={field.id}
                                                        field={field}
                                                        onSelect={handleFieldSelect}
                                                        onDelete={handleFieldDelete}
                                                        onStatusChange={handleFieldStatusChange}
                                                        onRename={handleRenameProject}
                                                        onMove={handleMoveProject}
                                                        onCopy={handleCopyProject}
                                                        onShare={handleShareProject}
                                                        isSuperUser={auth?.user?.is_super_user}
                                                        t={t}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ) : null;
                                })()}
                            </div>
                        ) : (
                            // Show fields and sub-folders in selected folder
                            <div>
                                {/* Sub-folders Section */}
                                {(() => {
                                    const subFolders = folders.filter(
                                        (f) => f.parent_id === selectedFolder.id
                                    );

                                    return subFolders.length > 0 ? (
                                        <div className="mb-8">
                                            <h3 className="mb-4 text-lg font-semibold text-white">
                                                {t('sub_folders')}
                                            </h3>
                                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                                                {subFolders.map((subFolder) => (
                                                    <FolderCard
                                                        key={subFolder.id}
                                                        folder={subFolder}
                                                        fieldCount={getFieldCountForFolder(
                                                            subFolder
                                                        )}
                                                        onSelect={handleFolderSelect}
                                                        onEdit={handleEditFolder}
                                                        onDelete={handleDeleteFolder}
                                                        isSelected={false}
                                                        t={t}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ) : null;
                                })()}

                                {/* Category Sections */}
                                {(() => {
                                    const categorySections = plantCategories.map((category) => {
                                        const categoryFields = fields.filter((field) => {
                                            // Check if field is in this folder
                                            const isInFolder = field.folderId === selectedFolder.id;

                                            // Check if field matches this category
                                            const matchesCategory = field.category === category.id;

                                            const isLegacyHorticulture =
                                                !field.category && category.id === 'horticulture';

                                            return (
                                                isInFolder &&
                                                (matchesCategory || isLegacyHorticulture)
                                            );
                                        });
                                        return { category, fields: categoryFields };
                                    });

                                    const hasAnyCategoryFields = categorySections.some(
                                        (section) => section.fields.length > 0
                                    );

                                    return hasAnyCategoryFields ? (
                                        <div className="mb-8">
                                            <div className="space-y-6">
                                                {categorySections.map(({ category, fields }) => {
                                                    if (fields.length === 0) return null;

                                                    return (
                                                        <div
                                                            key={category.id}
                                                            className="rounded-lg border border-gray-700 bg-gray-800 p-4"
                                                        >
                                                            <div className="mb-4 flex items-center justify-between">
                                                                <div className="flex items-center gap-3">
                                                                    <span className="text-2xl">
                                                                        {category.icon}
                                                                    </span>
                                                                    <h4 className="text-lg font-semibold text-white">
                                                                        {category.name} (
                                                                        {fields.length})
                                                                    </h4>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                                                                {fields.map((field) => (
                                                                    <FieldCard
                                                                        key={field.id}
                                                                        field={field}
                                                                        onSelect={handleFieldSelect}
                                                                        onDelete={handleFieldDelete}
                                                                        onStatusChange={
                                                                            handleFieldStatusChange
                                                                        }
                                                                        onRename={handleRenameProject}
                                                                        onMove={handleMoveProject}
                                                                        onCopy={handleCopyProject}
                                                                        onShare={handleShareProject}
                                                                        isSuperUser={auth?.user?.is_super_user}
                                                                        t={t}
                                                                    />
                                                                ))}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    ) : null;
                                })()}

                                {/* Uncategorized Fields Section */}
                                {(() => {
                                    const uncategorizedFields = getCurrentFields().filter(
                                        (field) => {
                                            // Check if field has a category
                                            const hasCategory =
                                                field.category && field.category !== '';
                                            // Check if field is not in any category section
                                            const isInCategorySection = plantCategories.some(
                                                (category) => {
                                                    const matchesCategory =
                                                        field.category === category.id;
                                                    const isLegacyHorticulture =
                                                        !field.category &&
                                                        category.id === 'horticulture';
                                                    return matchesCategory || isLegacyHorticulture;
                                                }
                                            );

                                            return !hasCategory && !isInCategorySection;
                                        }
                                    );

                                    return uncategorizedFields.length > 0 ? (
                                        <div className="mb-8">
                                            <h3 className="mb-4 text-lg font-semibold text-white">
                                                {t('uncategorized_fields')} ({uncategorizedFields.length})
                                            </h3>
                                            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                                                {uncategorizedFields.map((field) => (
                                                    <FieldCard
                                                        key={field.id}
                                                        field={field}
                                                        onSelect={handleFieldSelect}
                                                        onDelete={handleFieldDelete}
                                                        onStatusChange={handleFieldStatusChange}
                                                        onRename={handleRenameProject}
                                                        onMove={handleMoveProject}
                                                        onCopy={handleCopyProject}
                                                        onShare={handleShareProject}
                                                        isSuperUser={auth?.user?.is_super_user}
                                                        t={t}
                                                    />
                                                ))}
                                            </div>
                                        </div>
                                    ) : null;
                                })()}

                                
                            </div>
                        )}
                    </div>
                </div>
            </div>
            <Footer />

            {/* Modals */}
            <CategorySelectionModal
                isOpen={showCategoryModal}
                onClose={() => setShowCategoryModal(false)}
                onSelectCategory={handleCategorySelect}
                plantCategories={plantCategories}
                t={t}
            />
            
            {/* Rename Project Modal */}
            <RenameProjectModal
                isOpen={showRenameModal}
                onClose={() => {
                    setShowRenameModal(false);
                    setFieldToRename(null);
                }}
                onRename={handleSubmitRename}
                currentName={fieldToRename?.name || ''}
                t={t}
            />
            
            {/* Folder Selection Modal for Move/Copy */}
            <FolderSelectionModal
                isOpen={showFolderSelectionModal}
                onClose={() => {
                    setShowFolderSelectionModal(false);
                    setFieldToMoveOrCopy(null);
                }}
                onSelect={async (folderId) => {
                    if (!fieldToMoveOrCopy) return;
                    
                    try {
                        if (folderSelectionAction === 'move') {
                            // Move project (using existing updateFieldFolder endpoint)
                            const response = await axios.put(`/api/fields/${fieldToMoveOrCopy.id}/folder`, {
                                folder_id: folderId ? parseInt(folderId) : null,
                            });
                            
                            if (response.data.success) {
                                // Ensure folderId is string or null to match Field type
                                const updatedFolderId = folderId ? String(folderId) : null;
                                setFields(prev => prev.map(f => 
                                    f.id === fieldToMoveOrCopy.id ? { ...f, folderId: updatedFolderId } : f
                                ));
                                alert(t('move_project_success'));
                                setShowFolderSelectionModal(false);
                                setFieldToMoveOrCopy(null);
                            }
                        } else {
                            // Copy project
                            const response = await axios.post(`/api/fields/${fieldToMoveOrCopy.id}/copy`, {
                                folder_id: folderId ? parseInt(folderId) : null,
                            });
                            
                            if (response.data.success && response.data.field) {
                                // Backend sends field with folder_id (snake_case) or folderId (camelCase)
                                // Convert to string or null to match Field type
                                const rawFolderId = response.data.field.folder_id ?? response.data.field.folderId;
                                const copiedField = {
                                    ...response.data.field,
                                    id: String(response.data.field.id), // Ensure id is string
                                    folderId: rawFolderId ? String(rawFolderId) : null
                                };
                                setFields(prev => [...prev, copiedField]);
                                alert(t('copy_project_success'));
                                setShowFolderSelectionModal(false);
                                setFieldToMoveOrCopy(null);
                            }
                        }
                    } catch (error: any) {
                        console.error(`Error ${folderSelectionAction} project:`, error);
                        alert(`Error ${folderSelectionAction} project: ${error.response?.data?.message || error.message}`);
                    }
                }}
                action={folderSelectionAction}
                currentFolderId={fieldToMoveOrCopy?.folderId}
                folders={folders}
                t={t}
            />
            
            {/* Share To User Modal */}
            <ShareToUserModal
                isOpen={showShareModal && !showUserFolderSelectionModal}
                onClose={() => {
                    setShowShareModal(false);
                    // Reset all share-related states when closing ShareToUserModal
                    setFieldToShare(null);
                    setSelectedUserForShare(null);
                    setUserFoldersForShare([]);
                }}
                onSelectUser={async (user) => {
                    setSelectedUserForShare(user);
                    // Fetch user's folders
                    try {
                        const response = await axios.get(`/api/users/${user.id}/folders`);
                        setUserFoldersForShare(response.data.folders || []);
                        setShowUserFolderSelectionModal(true);
                    } catch (error) {
                        console.error('Error fetching user folders:', error);
                        alert('Error fetching user folders');
                    }
                }}
                t={t}
            />
            
            {/* User Folder Selection Modal for Share */}
            {selectedUserForShare && (
                <FolderSelectionModal
                    isOpen={showUserFolderSelectionModal}
                    onClose={() => {
                        setShowUserFolderSelectionModal(false);
                        setSelectedUserForShare(null);
                        setUserFoldersForShare([]);
                        // Reset fieldToShare and close ShareToUserModal when closing the folder selection modal
                        setFieldToShare(null);
                        setShowShareModal(false);
                    }}
                    onSelect={async (folderId) => {
                        if (!fieldToShare || !selectedUserForShare) {
                            alert('Error: Missing required data. Please try again.');
                            return;
                        }
                        
                        try {
                            // Share project to user
                            const response = await axios.post(`/api/fields/${fieldToShare.id}/share`, {
                                user_id: selectedUserForShare.id,
                                folder_id: folderId ? parseInt(folderId) : null,
                            });
                            
                            if (response.data.success) {
                                // Show detailed success message
                                const message = `สำเร็จแล้ว✅ \nโครงการ "${fieldToShare.name}" ถูกแชร์ไปยัง "${selectedUserForShare.name}" \n` +
                                    `ผู้ใช้ที่รับแชร์จะเห็นโครงการนี้เมื่อ refresh หน้า`;
                                alert(message);
                            } else {
                                console.error('❌ [DEBUG] Share failed:', response.data);
                                alert(`Error sharing project: ${response.data.message || 'Unknown error'}`);
                            }
                        } catch (error: any) {
                            console.error('❌ [DEBUG] Error sharing project:', error);
                            console.error('❌ [DEBUG] Error response:', error.response?.data);
                            console.error('❌ [DEBUG] Error status:', error.response?.status);
                            alert(`Error sharing project: ${error.response?.data?.message || error.message}`);
                        } finally {
                            // Close modals and reset states
                            setShowUserFolderSelectionModal(false);
                            setSelectedUserForShare(null);
                            setUserFoldersForShare([]);
                            setFieldToShare(null);
                            setShowShareModal(false);
                        }
                    }}
                    action="share"
                    folders={userFoldersForShare}
                    showAllFolders={true}
                    t={t}
                />
            )}

            <CreateFolderModal
                isOpen={showCreateFolderModal}
                onClose={() => {
                    setShowCreateFolderModal(false);
                    setParentFolderForModal(null);
                }}
                onCreate={handleCreateFolder}
                parentFolder={parentFolderForModal}
                t={t}
            />

            <EditFolderModal
                isOpen={showEditFolderModal}
                onClose={() => {
                    setShowEditFolderModal(false);
                    setFolderToEdit(null);
                }}
                onSave={handleSaveFolder}
                folder={folderToEdit}
                t={t}
            />

            {/* Delete Field Confirmation Dialog */}
            {showDeleteConfirm && fieldToDelete && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
                    <div className="relative z-[10000] mx-4 w-full max-w-md rounded-lg bg-gray-800 p-6">
                        <div className="mb-4 flex items-center">
                            <div className="flex-shrink-0">
                                <svg
                                    className="h-6 w-6 text-red-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                                    />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-lg font-medium text-white">
                                    {t('delete_field')}
                                </h3>
                            </div>
                        </div>
                        <div className="mb-6">
                            <p className="text-gray-300">
                                {t('delete_confirm')}{' '}
                                <span className="font-semibold text-white">
                                    "{fieldToDelete.name}"
                                </span>
                                ?
                            </p>
                            <p className="mt-2 text-sm text-gray-400">{t('delete_warning')}</p>
                        </div>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={cancelDelete}
                                disabled={deleting}
                                className="rounded px-4 py-2 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white disabled:opacity-50"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={confirmDelete}
                                disabled={deleting}
                                className="flex items-center rounded bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700 disabled:opacity-50"
                            >
                                {deleting ? (
                                    <>
                                        <svg
                                            className="-ml-1 mr-2 h-4 w-4 animate-spin text-white"
                                            xmlns="http://www.w3.org/2000/svg"
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
                                        {t('deleting')}
                                    </>
                                ) : (
                                    t('delete_field')
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Folder Confirmation Dialog */}
            {showFolderDeleteConfirm && folderToDelete && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50">
                    <div className="relative z-[10000] mx-4 w-full max-w-md rounded-lg bg-gray-800 p-6">
                        <div className="mb-4 flex items-center">
                            <div className="flex-shrink-0">
                                <svg
                                    className="h-6 w-6 text-red-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                                    />
                                </svg>
                            </div>
                            <div className="ml-3">
                                <h3 className="text-lg font-medium text-white">
                                    {t('delete_folder')}
                                </h3>
                            </div>
                        </div>
                        <div className="mb-6">
                            <p className="text-gray-300">
                                {t('delete_folder_confirm')}{' '}
                                <span className="font-semibold text-white">
                                    "{folderToDelete.name}"
                                </span>
                                ?
                            </p>
                            <p className="mt-2 text-sm text-gray-400">
                                {t('delete_folder_warning')}
                            </p>
                        </div>
                        <div className="flex justify-end space-x-3">
                            <button
                                onClick={cancelFolderDelete}
                                className="rounded px-4 py-2 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
                            >
                                {t('cancel')}
                            </button>
                            <button
                                onClick={confirmFolderDelete}
                                className="flex items-center rounded bg-red-600 px-4 py-2 text-white transition-colors hover:bg-red-700"
                            >
                                {t('delete_folder')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Finished Project Modal - 3 Options */}
            {showFinishedProjectModal && selectedFinishedProject && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-75">
                    <div className="relative mx-4 w-full max-w-lg rounded-lg bg-gray-800 p-6 shadow-xl">
                        <button
                            onClick={() => {
                                setShowFinishedProjectModal(false);
                                setSelectedFinishedProject(null);
                            }}
                            className="absolute right-4 top-4 text-3xl text-gray-400 hover:text-white"
                        >
                            ×
                        </button>

                        <h2 className="mb-2 text-2xl font-bold text-yellow-400">
                            📁 {selectedFinishedProject.name}
                        </h2>
                        <p className="mb-6 text-sm text-gray-400">
                            {t('select_action')}
                        </p>

                        <div className="space-y-3">
                            {/* Option 1: Open in Planner */}
                            <button
                                onClick={() => {
                                    setShowFinishedProjectModal(false);
                                    localStorage.setItem('currentFieldId', selectedFinishedProject.id);
                                    localStorage.setItem('currentFieldName', selectedFinishedProject.name);

                                    // ✅ ตั้ง flag เพื่อให้ Planner โหลดข้อมูลจาก localStorage
                                    localStorage.setItem('isEditingExistingProject', 'true'); // แก้ key ให้ตรงกับ HorticulturePlannerPage

                                    // โหลด project_data เพื่อให้ planner แสดงพื้นที่ที่วาดไว้
                                    const projectData = (selectedFinishedProject as any).projectData || selectedFinishedProject.project_data;
                                    if (projectData) {
                                        const data = typeof projectData === 'string' ? JSON.parse(projectData) : projectData;

                                        // ✅ บันทึกลง horticultureIrrigationData (key หลักที่ HorticulturePlannerPage ใช้)
                                        localStorage.setItem('horticultureIrrigationData', JSON.stringify(data));

                                        // ✅ บันทึกข้อมูลเพิ่มเติมสำหรับ planner (สำหรับ backward compatibility)
                                        localStorage.setItem('horticultureProjectData', JSON.stringify(data));
                                        if (data.mainArea) localStorage.setItem('horticultureMainArea', JSON.stringify(data.mainArea));
                                        if (data.plants) localStorage.setItem('horticulturePlants', JSON.stringify(data.plants));
                                        if (data.irrigationZones) localStorage.setItem('horticultureIrrigationZones', JSON.stringify(data.irrigationZones));
                                        if (data.zones) localStorage.setItem('horticultureZones', JSON.stringify(data.zones));
                                        if (data.exclusionAreas) localStorage.setItem('horticultureExclusionAreas', JSON.stringify(data.exclusionAreas));
                                        if (data.mainPipes) localStorage.setItem('horticultureMainPipes', JSON.stringify(data.mainPipes));
                                        if (data.subMainPipes) localStorage.setItem('horticultureSubMainPipes', JSON.stringify(data.subMainPipes));
                                        if (data.lateralPipes) localStorage.setItem('horticultureLateralPipes', JSON.stringify(data.lateralPipes));
                                        if (data.pump) localStorage.setItem('horticulturePump', JSON.stringify(data.pump));
                                        if (data.selectedPlantType) localStorage.setItem('selectedPlantType', JSON.stringify(data.selectedPlantType));
                                    }

                                    // โหลด project_stats (ถ้ามี)
                                    const projectStats = (selectedFinishedProject as any).projectStats || selectedFinishedProject.project_stats;
                                    if (projectStats) {
                                        const stats = typeof projectStats === 'string' ? JSON.parse(projectStats) : projectStats;
                                        // ✅ ใช้ key ที่ถูกต้องสำหรับ horticulture
                                        if (stats.zoneInputs) localStorage.setItem('horticultureZoneInputs', JSON.stringify(stats.zoneInputs));
                                        if (stats.zoneSprinklers) localStorage.setItem('horticultureZoneSprinklers', JSON.stringify(stats.zoneSprinklers));
                                    }

                                    // ✅ โหลด gardenData สำหรับ home-garden (ล้างแคชก่อน แล้วเซ็ตข้อมูลโครงการนี้ เพื่อให้ planner แสดงตามที่บันทึกไว้)
                                    if (selectedFinishedProject.category === 'home-garden') {
                                        clearGardenDataCache();
                                        if (selectedFinishedProject.garden_data) {
                                            const gardenData = typeof selectedFinishedProject.garden_data === 'string'
                                                ? JSON.parse(selectedFinishedProject.garden_data)
                                                : selectedFinishedProject.garden_data;
                                            localStorage.setItem('gardenPlannerData', JSON.stringify(gardenData));
                                        }
                                        if (selectedFinishedProject.garden_stats) {
                                            const gardenStats = typeof selectedFinishedProject.garden_stats === 'string'
                                                ? JSON.parse(selectedFinishedProject.garden_stats)
                                                : selectedFinishedProject.garden_stats;
                                            localStorage.setItem('gardenStatistics', JSON.stringify(gardenStats));
                                        }
                                    }

                                    // ✅ โหลด fieldCropData สำหรับ field-crop mode
                                    if (selectedFinishedProject.category === 'field-crop' && selectedFinishedProject.field_crop_data) {
                                        const fieldCropData = typeof selectedFinishedProject.field_crop_data === 'string'
                                            ? JSON.parse(selectedFinishedProject.field_crop_data)
                                            : selectedFinishedProject.field_crop_data;
                                        localStorage.setItem('fieldCropData', JSON.stringify(fieldCropData));
                                    }

                                    // ✅ โหลด greenhouseData สำหรับ greenhouse mode
                                    if (selectedFinishedProject.category === 'greenhouse' && selectedFinishedProject.greenhouse_data) {
                                        const greenhouseData = typeof selectedFinishedProject.greenhouse_data === 'string'
                                            ? JSON.parse(selectedFinishedProject.greenhouse_data)
                                            : selectedFinishedProject.greenhouse_data;
                                        localStorage.setItem('greenhouseData', JSON.stringify(greenhouseData));
                                    }

                                    // ✅ แก้ไข route ให้ถูกต้อง
                                    const plannerModeMap: { [key: string]: string } = {
                                        horticulture: '/horticulture/planner',
                                        'home-garden': '/home-garden/planner',
                                        'field-crop': '/field-crop/planner',
                                        greenhouse: '/greenhouse/planner',
                                    };
                                    const plannerRoute = plannerModeMap[selectedFinishedProject.category || 'horticulture'] || '/horticulture/planner';
                                    navigateToRoute(plannerRoute);
                                }}
                                className="w-full rounded-lg bg-green-600 px-6 py-4 text-left text-white transition-colors hover:bg-green-700"
                            >
                                <div className="flex items-center">
                                    <span className="mr-3 text-2xl">🗺️</span>
                                    <div>
                                        <p className="font-semibold">{t('open_in_planner')}</p>
                                        <p className="text-sm text-green-200">{t('edit_map_and_layout')}</p>
                                    </div>
                                </div>
                            </button>

                            {/* Option 2: Open in Product Page */}
                            <button
                                onClick={() => {
                                    setShowFinishedProjectModal(false);
                                    localStorage.setItem('currentFieldId', selectedFinishedProject.id);
                                    localStorage.setItem('currentFieldName', selectedFinishedProject.name);

                                    // ✅ โหลด project_data เพื่อใช้ในหน้า product (สำหรับการบันทึก)
                                    const projectData = (selectedFinishedProject as any).projectData || selectedFinishedProject.project_data;
                                    if (projectData) {
                                        const data = typeof projectData === 'string' ? JSON.parse(projectData) : projectData;
                                        localStorage.setItem('horticultureProjectData', JSON.stringify(data));
                                    }

                                    // โหลดข้อมูลจาก project_stats เพื่อใช้ในหน้า product
                                    const projectStats = (selectedFinishedProject as any).projectStats || selectedFinishedProject.project_stats;
                                    if (projectStats) {
                                        const stats = typeof projectStats === 'string' ? JSON.parse(projectStats) : projectStats;
                                        // บันทึกข้อมูลที่จำเป็นลง localStorage
                                        if (stats.zoneInputs) localStorage.setItem('zoneInputs', JSON.stringify(stats.zoneInputs));
                                        if (stats.zoneSprinklers) localStorage.setItem('zoneSprinklers', JSON.stringify(stats.zoneSprinklers));
                                        if (stats.selectedPipes) localStorage.setItem('selectedPipes', JSON.stringify(stats.selectedPipes));
                                        if (stats.selectedPump) localStorage.setItem('selectedPump', JSON.stringify(stats.selectedPump));
                                        if (stats.sprinklerEquipmentSets) localStorage.setItem('sprinklerEquipmentSets', JSON.stringify(stats.sprinklerEquipmentSets));
                                        if (stats.connectionEquipments) localStorage.setItem('connectionEquipments', JSON.stringify(stats.connectionEquipments));
                                        if (stats.results) localStorage.setItem('calculationResults', JSON.stringify(stats.results));
                                    }

                                    const productModeMap: { [key: string]: string } = {
                                        horticulture: '',
                                        'home-garden': '?mode=garden',
                                        'field-crop': '?mode=field-crop',
                                        greenhouse: '?mode=greenhouse',
                                    };
                                    const modeParam = productModeMap[selectedFinishedProject.category || 'horticulture'] || '';
                                    navigateToRoute(`/product${modeParam}`);
                                }}
                                className="w-full rounded-lg bg-blue-600 px-6 py-4 text-left text-white transition-colors hover:bg-blue-700"
                            >
                                <div className="flex items-center">
                                    <span className="mr-3 text-2xl">🛠️</span>
                                    <div>
                                        <p className="font-semibold">{t('open_in_product')}</p>
                                        <p className="text-sm text-blue-200">{t('edit_equipment_and_costs')}</p>
                                    </div>
                                </div>
                            </button>

                            {/* Option 3: View Quotation */}
                            <button
                                onClick={() => {
                                    setShowFinishedProjectModal(false);
                                    setSelectedFinishedProject(selectedFinishedProject);
                                    setShowQuotationModal(true);
                                }}
                                className="w-full rounded-lg bg-purple-600 px-6 py-4 text-left text-white transition-colors hover:bg-purple-700"
                            >
                                <div className="flex items-center">
                                    <span className="mr-3 text-2xl">📋</span>
                                    <div>
                                        <p className="font-semibold">{t('view_quotation')}</p>
                                        <p className="text-sm text-purple-200">{t('view_and_print_quotation')}</p>
                                    </div>
                                </div>
                            </button>
                        </div>

                        <button
                            onClick={() => {
                                setShowFinishedProjectModal(false);
                                setSelectedFinishedProject(null);
                            }}
                            className="mt-6 w-full rounded-lg bg-gray-600 px-6 py-2 text-white transition-colors hover:bg-gray-700"
                        >
                            {t('cancel')}
                        </button>
                    </div>
                </div>
            )}

            {/* Quotation Modal (For Option 3) */}
            {showQuotationModal && selectedFinishedProject && (() => {
                // เตรียมข้อมูลสำหรับ QuotationDocument
                const projectStats = (selectedFinishedProject as any).projectStats || selectedFinishedProject.project_stats;
                const stats = typeof projectStats === 'string' ? JSON.parse(projectStats) : projectStats;

                const projectData = (selectedFinishedProject as any).projectData || selectedFinishedProject.project_data;
                const parsedProjectData = typeof projectData === 'string' ? JSON.parse(projectData) : projectData;

                return (
                    <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black bg-opacity-90">
                        <div className="relative mx-4 h-[90vh] w-full max-w-5xl overflow-auto rounded-lg bg-white p-6">
                            <button
                                onClick={() => {
                                    setShowQuotationModal(false);
                                    setSelectedFinishedProject(null);
                                }}
                                className="absolute right-4 top-4 z-10 rounded-full bg-red-600 p-2 text-white hover:bg-red-700"
                            >
                                ×
                            </button>

                            {/* แสดง QuotationDocument */}
                            {stats && stats.results ? (() => {
                                return (
                                    <QuotationDocument
                                        show={true}
                                        results={stats.results}
                                        zoneSprinklers={stats.zoneSprinklers || {}}
                                        selectedPipes={stats.selectedPipes || {}}
                                        selectedSprinkler={Object.values(stats.zoneSprinklers || {})[0] || null}
                                        selectedPump={stats.selectedPump}
                                        selectedBranchPipe={(stats.selectedPipes && Object.values(stats.selectedPipes)[0] as any)?.branch || null}
                                        selectedSecondaryPipe={(stats.selectedPipes && Object.values(stats.selectedPipes)[0] as any)?.secondary || null}
                                        selectedMainPipe={(stats.selectedPipes && Object.values(stats.selectedPipes)[0] as any)?.main || null}
                                        selectedEmitterPipe={(stats.selectedPipes && Object.values(stats.selectedPipes)[0] as any)?.emitter || null}
                                        projectData={parsedProjectData}
                                        gardenData={selectedFinishedProject.garden_data}
                                        gardenStats={selectedFinishedProject.garden_stats}
                                        fieldCropData={selectedFinishedProject.field_crop_data}
                                        greenhouseData={selectedFinishedProject.greenhouse_data}
                                        zoneInputs={stats.zoneInputs || {}}
                                        quotationData={{
                                            yourReference: '',
                                            quotationDate: new Date().toLocaleString('th-TH'),
                                            salesperson: '',
                                            paymentTerms: '0',
                                        }}
                                        quotationDataCustomer={{
                                            name: selectedFinishedProject.customerName || '',
                                            projectName: selectedFinishedProject.name,
                                            address: '',
                                            phone: '',
                                        }}
                                        projectMode={selectedFinishedProject.category as any}
                                        sprinklerEquipmentSets={stats.sprinklerEquipmentSets || {}}
                                        connectionEquipments={stats.connectionEquipments || {}}
                                        projectImage={parsedProjectData?.projectImage || null}
                                        showPump={true}
                                        onClose={() => {
                                            setShowQuotationModal(false);
                                            setSelectedFinishedProject(null);
                                        }}
                                    />
                                );
                            })() : (
                                <div className="text-center text-gray-800">
                                    <h2 className="mb-4 text-2xl font-bold">📋 {t('quotation_title')}</h2>
                                    <p className="mb-4">{t('project_label')}: {selectedFinishedProject.name}</p>
                                    <p className="text-red-600">
                                        {t('no_quotation_data')}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                );
            })()}
        </div>
    );
}
