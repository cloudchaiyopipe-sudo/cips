import { Head } from '@inertiajs/react';
import { useState, useEffect, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import { router } from '@inertiajs/react';
import { greenhouseCrops, getCropByValue } from '../components/Greenhouse/CropData';
import {
    saveGreenhouseData,
    GreenhousePlanningData,
    calculateAllGreenhouseStats,
} from '@/utils/greenHouseData';
import Navbar from '../../components/Navbar';
import { useLanguage } from '../../contexts/LanguageContext';
import {
    calculatePlotBasedWaterRequirements,
    PlotBasedWaterSummary,
    type PlotWaterCalculation,
} from '../components/Greenhouse/WaterCalculation';

// Fittings breakdown interface (reused pattern from field-crop)
interface FittingsBreakdown {
    twoWay: number;
    threeWay: number;
    fourWay: number;
    breakdown: {
        main: { twoWay: number; threeWay: number; fourWay: number };
        submain: { twoWay: number; threeWay: number; fourWay: number };
        lateral: { twoWay: number; threeWay: number; fourWay: number };
    };
}

interface Point {
    x: number;
    y: number;
}

interface Shape {
    id: string;
    type: 'greenhouse' | 'plot' | 'walkway' | 'water-source' | 'measurement' | 'fertilizer-area';
    points: Point[];
    color: string;
    fillColor: string;
    name: string;
    measurement?: { distance: number; unit: string };
    cropType?: string;
}

interface IrrigationElement {
    id: string;
    type:
        | 'main-pipe'
        | 'sub-pipe'
        | 'pump'
        | 'solenoid-valve'
        | 'ball-valve'
        | 'sprinkler'
        | 'drip-line'
        | 'water-tank'
        | 'fertilizer-machine';
    points: Point[];
    color: string;
    width?: number;
    radius?: number;
    angle?: number;
    spacing?: number;
    capacityLiters?: number;
}

interface GreenhouseSummaryData {
    // From crop selection
    selectedCrops: string[];

    // From area input
    planningMethod: 'draw' | 'import';

    // From planner
    shapes: Shape[];
    canvasData?: string; // Base64 image of the canvas

    // From irrigation selection
    irrigationMethod: 'mini-sprinkler' | 'drip' | 'mixed';

    // From irrigation map
    irrigationElements?: IrrigationElement[];
    irrigationCanvasData?: string; // Base64 image of irrigation design

    // Flow rate settings from map
    sprinklerFlowRate?: number; // L/min per sprinkler
    dripEmitterFlowRate?: number; // L/min per drip emitter

    // Pressure settings
    sprinklerPressure?: number; // Bar for sprinklers
    dripPressure?: number; // Bar for drip emitters

    // Sprinkler settings
    sprinklerRadius?: number; // Radius in meters for sprinklers

    // Calculated data
    greenhouseArea?: number;
    plotCount?: number;
    totalPlantingArea?: number;

    // Timestamps
    createdAt?: string;
    updatedAt?: string;
}

export default function GreenhouseSummary() {
    const { t } = useLanguage();
    const [summaryData, setSummaryData] = useState<GreenhouseSummaryData | null>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);

    // Image cache for component icons
    const [componentImages, setComponentImages] = useState<{ [key: string]: HTMLImageElement }>({});

    // New state for action buttons
    const [savingToDatabase, setSavingToDatabase] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);
    const [saveError, setSaveError] = useState<string | null>(null);
    const [isCreatingNewProject, setIsCreatingNewProject] = useState(false);

    // State for collapsible sections
    const [expandedSections, setExpandedSections] = useState<{ [key: string]: boolean }>({
        pipeFlowRates: true,
        irrigationEquipment: true,
        pipeSystem: true,
        plantData: true,
    });

    // Load component images
    useEffect(() => {
        const imageConfigs = {
            pump: '/generateTree/wtpump.png',
            'solenoid-valve': '/generateTree/solv.png',
            'ball-valve': '/generateTree/ballv.png',
            'water-tank': '/generateTree/silo.png',
            'fertilizer-machine': '/generateTree/fertilizer.png',
        };

        const loadImages = async () => {
            const images: { [key: string]: HTMLImageElement } = {};

            for (const [type, src] of Object.entries(imageConfigs)) {
                try {
                    const img = new Image();
                    img.src = src;
                    await new Promise((resolve, reject) => {
                        img.onload = resolve;
                        img.onerror = reject;
                    });
                    images[type] = img;
                } catch (error) {
                    console.warn(`Failed to load image for ${type}:`, error);
                }
            }

            setComponentImages(images);
        };

        loadImages().catch(console.error);
    }, []);

    // NEW: Handle save project to database
    const handleSaveToDatabase = async () => {
        if (!summaryData) {
            alert(t('ไม่พบข้อมูลโรงเรือน กรุณาสร้างการออกแบบโรงเรือนใหม่'));
            return;
        }

        setSavingToDatabase(true);
        setSaveError(null);
        setSaveSuccess(false);

        try {
            // Convert summary data to the format expected by the backend
            const greenhouseData: GreenhousePlanningData = calculateAllGreenhouseStats({
                shapes: summaryData.shapes || [],
                irrigationElements: summaryData.irrigationElements || [],
                selectedCrops: summaryData.selectedCrops || [],
                irrigationMethod: summaryData.irrigationMethod || 'mini-sprinkler',
                planningMethod: summaryData.planningMethod || 'draw',
                createdAt: summaryData.createdAt,
                updatedAt: new Date().toISOString(),
            });

            // Check if editing existing project
            const urlParams = new URLSearchParams(window.location.search);
            let fieldId = urlParams.get('fieldId') || localStorage.getItem('editingGreenhouseId');

            if (fieldId && (fieldId === 'null' || fieldId === 'undefined' || fieldId === '')) {
                fieldId = null;
                localStorage.removeItem('editingGreenhouseId');
            }

            const requestData = {
                field_name: `${t('โรงเรือน')} - ${new Date().toLocaleDateString('th-TH')}`,
                customer_name: '',
                category: 'greenhouse',
                area_coordinates: summaryData.shapes
                    .filter((s) => s.type === 'greenhouse')
                    .map(
                        (shape) => shape.points.map((p) => ({ lat: p.y / 1000, lng: p.x / 1000 })) // Convert canvas coordinates
                    )
                    .flat(),
                plant_type_id: 1, // Default greenhouse plant type
                total_plants: summaryData.shapes.filter((s) => s.type === 'plot').length,
                total_area: greenhouseData.summary.totalGreenhouseArea,
                total_water_need:
                    greenhouseData.summary.overallProduction.waterRequirementPerIrrigation,
                area_type: 'greenhouse',
                greenhouse_data: {
                    shapes: summaryData.shapes,
                    irrigationElements: summaryData.irrigationElements,
                    selectedCrops: summaryData.selectedCrops,
                    irrigationMethod: summaryData.irrigationMethod,
                    planningMethod: summaryData.planningMethod,
                    metrics: greenhouseData,
                },
            };

            let response;
            if (fieldId && fieldId !== 'null' && fieldId !== 'undefined') {
                // Update existing project
                response = await fetch(`/api/greenhouse-fields/${fieldId}`, {
                    method: 'PUT',
                    headers: {
                        'X-CSRF-TOKEN':
                            document
                                .querySelector('meta[name="csrf-token"]')
                                ?.getAttribute('content') || '',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestData),
                });
            } else {
                // Create new project
                response = await fetch('/api/save-greenhouse-field', {
                    method: 'POST',
                    headers: {
                        'X-CSRF-TOKEN':
                            document
                                .querySelector('meta[name="csrf-token"]')
                                ?.getAttribute('content') || '',
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(requestData),
                });
            }

            const responseData = await response.json();

            if (responseData.success) {
                setSaveSuccess(true);
                localStorage.removeItem('editingGreenhouseId');

                // Show success message
                setTimeout(() => {
                    setSaveSuccess(false);
                }, 3000);
            } else {
                throw new Error(responseData.message || 'Failed to save greenhouse project');
            }
        } catch (error) {
            console.error('❌ Error saving greenhouse project:', error);
            const errorMessage =
                error instanceof Error
                    ? error.message || 'Error saving project'
                    : 'An unexpected error occurred';
            setSaveError(errorMessage);
        } finally {
            setSavingToDatabase(false);
        }
    };

    // NEW: Handle new project
    const handleNewProject = async () => {
        setIsCreatingNewProject(true);

        try {
            // Clear localStorage data
            localStorage.removeItem('greenhousePlanningData');
            localStorage.removeItem('editingGreenhouseId');

            // Capture and save map image before navigating
            await handleExportMapToProduct();

            // Navigate to crop selection page to start new project
            setTimeout(() => {
                router.visit('/greenhouse-crop');
            }, 1000);
        } catch (error) {
            console.error('Error creating new project:', error);
            // Still navigate even if image capture fails
            router.visit('/greenhouse-crop');
        } finally {
            setIsCreatingNewProject(false);
        }
    };

    // Enhanced handleCalculateEquipment function
    const handleCalculateEquipment = async () => {
        if (summaryData) {
            // Capture canvas image and save to localStorage
            if (canvasRef.current) {
                try {
                    const canvas = await html2canvas(canvasRef.current, {
                        backgroundColor: '#000000',
                        useCORS: true,
                    });
                    const image = canvas.toDataURL('image/png');

                    localStorage.setItem('projectMapImage', image);
                } catch (error) {
                    console.error('Error capturing canvas image:', error);
                    alert(t('เกิดข้อผิดพลาดในการสร้างภาพแผนผัง'));
                }
            }

            // Convert summary data to GreenhousePlanningData format
            const greenhouseData: GreenhousePlanningData = calculateAllGreenhouseStats({
                shapes: summaryData.shapes || [],
                irrigationElements: summaryData.irrigationElements || [],
                selectedCrops: summaryData.selectedCrops || [],
                irrigationMethod: summaryData.irrigationMethod || 'mini-sprinkler',
                planningMethod: summaryData.planningMethod || 'draw',
                createdAt: summaryData.createdAt,
                updatedAt: new Date().toISOString(),
            });

            // Save greenhouse data using the new format
            saveGreenhouseData(greenhouseData);

            // เก็บ plotPipeData ที่มี totalFlowRate สำหรับแต่ละแปลง
            localStorage.setItem(
                'greenhouseSystemData',
                JSON.stringify({
                    plotPipeData: plotPipeData,
                    pipeFlowData: pipeFlowData,
                    plotWaterCalculations: plotWaterCalculations,
                    updatedAt: new Date().toISOString(),
                })
            );

            // สร้าง dynamic zone mapping สำหรับการจับคู่ activeZoneId กับ plotPipeData
            const { createDynamicZoneMapping } = await import('../../utils/greenhouseZoneMapping');
            // ใช้ plotPipeData ที่เป็น array จาก summaryData
            const activeZoneIds = summaryData.shapes
                .filter((shape) => shape.type === 'plot')
                .map((shape, index) => `plot-${Date.now()}-${index}`); // สร้าง dynamic ID
            createDynamicZoneMapping(activeZoneIds, [plotPipeData]); // wrap ใน array

            // Set project type for the product page
            localStorage.setItem('projectType', 'greenhouse');

            // Navigate to product page with greenhouse mode
            router.visit('/product?mode=greenhouse');
        } else {
            alert(t('ไม่พบข้อมูลโรงเรือน กรุณาสร้างการออกแบบโรงเรือนใหม่'));
        }
    };

    // Function to export map image to product page
    const handleExportMapToProduct = async () => {
        if (canvasRef.current) {
            try {
                const canvas = await html2canvas(canvasRef.current, {
                    backgroundColor: '#000000',
                    useCORS: true,
                });
                const image = canvas.toDataURL('image/png');
                localStorage.setItem('projectMapImage', image);
                localStorage.setItem('projectType', 'greenhouse');
                return true;
            } catch (error) {
                console.error('Error capturing canvas image:', error);
                return false;
            }
        }
        return false;
    };

    const handleEditProject = () => {
        if (summaryData) {
            // Save data to localStorage before navigating back, including irrigationElements
            const dataToSave = {
                ...summaryData,
                updatedAt: new Date().toISOString(),
            };
            localStorage.setItem('greenhousePlanningData', JSON.stringify(dataToSave));

            // Create URL parameters for green-house-map
            const queryParams = new URLSearchParams();
            if (summaryData.selectedCrops && summaryData.selectedCrops.length > 0) {
                queryParams.set('crops', summaryData.selectedCrops.join(','));
            }
            if (summaryData.shapes && summaryData.shapes.length > 0) {
                queryParams.set('shapes', encodeURIComponent(JSON.stringify(summaryData.shapes)));
            }
            if (summaryData.planningMethod) {
                queryParams.set('method', summaryData.planningMethod);
            }
            if (summaryData.irrigationMethod) {
                queryParams.set('irrigation', summaryData.irrigationMethod);
            }
            // Add a flag to indicate that irrigation elements should be loaded
            queryParams.set('loadIrrigation', 'true');

            // Navigate to green-house-map with the data
            window.location.href = `/greenhouse-map?${queryParams.toString()}`;
        } else {
            // If no data, navigate to the new crop selection page
            window.location.href = '/greenhouse-crop';
        }
    };

    const handleBackNavigation = () => {
        handleEditProject(); // Use the same function
    };

    // Rest of the existing code remains the same...
    // [All other functions and useEffect hooks remain unchanged]

    useEffect(() => {
        // Get data from URL parameters
        const urlParams = new URLSearchParams(window.location.search);
        const crops = urlParams.get('crops');
        const method = urlParams.get('method');
        const shapesParam = urlParams.get('shapes');
        const irrigationParam = urlParams.get('irrigation');

        // Try to get complete data from localStorage
        const savedData = localStorage.getItem('greenhousePlanningData');

        if (savedData) {
            try {
                const parsedData = JSON.parse(savedData);

                setSummaryData(parsedData);
            } catch (error) {
                console.error('Error parsing saved data:', error);
                if (crops || shapesParam) {
                    const newData: GreenhouseSummaryData = {
                        selectedCrops: crops ? crops.split(',') : [],
                        planningMethod: (method as 'draw' | 'import') || 'draw',
                        shapes: shapesParam ? JSON.parse(decodeURIComponent(shapesParam)) : [],
                        irrigationMethod:
                            (irrigationParam as 'mini-sprinkler' | 'drip' | 'mixed') ||
                            'mini-sprinkler',
                        irrigationElements: [], // Initialize empty array for irrigation elements
                        createdAt: new Date().toISOString(),
                    };
                    setSummaryData(newData);
                }
            }
        } else if (crops || shapesParam) {
            // Create new data from URL parameters
            const newData: GreenhouseSummaryData = {
                selectedCrops: crops ? crops.split(',') : [],
                planningMethod: (method as 'draw' | 'import') || 'draw',
                shapes: shapesParam ? JSON.parse(decodeURIComponent(shapesParam)) : [],
                irrigationMethod:
                    (irrigationParam as 'mini-sprinkler' | 'drip' | 'mixed') || 'mini-sprinkler',
                irrigationElements: [], // Initialize empty array for irrigation elements
                createdAt: new Date().toISOString(),
            };
            setSummaryData(newData);
        }
    }, []);

    // Helper function to check if a point is inside a polygon (Ray casting algorithm)
    const isPointInPolygon = (point: Point, polygon: Point[]): boolean => {
        if (polygon.length < 3) return false;

        let isInside = false;
        let j = polygon.length - 1;

        for (let i = 0; i < polygon.length; i++) {
            const xi = polygon[i].x,
                yi = polygon[i].y;
            const xj = polygon[j].x,
                yj = polygon[j].y;

            if (
                yi > point.y !== yj > point.y &&
                point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi
            ) {
                isInside = !isInside;
            }
            j = i;
        }

        return isInside;
    };

    // Helper function to calculate distance between two points
    const distanceBetweenPoints = (p1: Point, p2: Point): number => {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
    };

    // Helper function to find closest point on line segment
    const closestPointOnLineSegment = (
        point: Point,
        lineStart: Point,
        lineEnd: Point
    ): { point: Point; distance: number; t: number } => {
        const A = point.x - lineStart.x;
        const B = point.y - lineStart.y;
        const C = lineEnd.x - lineStart.x;
        const D = lineEnd.y - lineStart.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;

        let t = 0;
        if (lenSq !== 0) {
            t = Math.max(0, Math.min(1, dot / lenSq));
        }

        const closestPoint = {
            x: lineStart.x + t * C,
            y: lineStart.y + t * D,
        };

        const distance = distanceBetweenPoints(point, closestPoint);

        return { point: closestPoint, distance, t };
    };

    // Helper function to calculate distance from point to line segment
    const distancePointToLineSegment = (point: Point, lineStart: Point, lineEnd: Point): number => {
        const result = closestPointOnLineSegment(point, lineStart, lineEnd);
        return result.distance;
    };

    // Helper function to calculate distance from point to polygon boundary
    const distancePointToPolygon = (point: Point, polygon: Point[]): number => {
        if (polygon.length < 3) return Infinity;

        let minDistance = Infinity;

        // Check distance to each edge of the polygon
        for (let i = 0; i < polygon.length; i++) {
            const p1 = polygon[i];
            const p2 = polygon[(i + 1) % polygon.length];

            const distance = distancePointToLineSegment(point, p1, p2);
            minDistance = Math.min(minDistance, distance);
        }

        return minDistance;
    };

    // Helper function to check if sub-pipe serves a plot (improved logic)
    const subPipeServesPlot = (subPipe: { points: Point[] }, plotPoints: Point[]): boolean => {
        // วิธีที่ 1: ตรวจสอบจุดปลายของท่อ
        const subPipeEndpointsInPlot = subPipe.points.some((point: Point) =>
            isPointInPolygon(point, plotPoints)
        );

        // วิธีที่ 2: ตรวจสอบส่วนของเส้นท่อที่อยู่ในแปลง
        let subPipeSegmentInPlot = false;
        for (let i = 0; i < subPipe.points.length - 1; i++) {
            const p1 = subPipe.points[i];
            const p2 = subPipe.points[i + 1];

            // ตรวจสอบจุดกึ่งกลางของส่วนท่อ
            const midPoint = {
                x: (p1.x + p2.x) / 2,
                y: (p1.y + p2.y) / 2,
            };

            if (isPointInPolygon(midPoint, plotPoints)) {
                subPipeSegmentInPlot = true;
                break;
            }
        }

        // วิธีที่ 3: ตรวจสอบระยะห่างจากขอบเขตแปลง (สำหรับท่อที่อยู่บนเส้นขอบ)
        let subPipeNearPlotBoundary = false;
        if (!subPipeEndpointsInPlot && !subPipeSegmentInPlot) {
            // ตรวจสอบระยะห่างจากจุดปลายของท่อไปยังขอบเขตแปลง
            for (const pipePoint of subPipe.points) {
                const distanceToBoundary = distancePointToPolygon(pipePoint, plotPoints);
                if (distanceToBoundary < 20) {
                    // ระยะห่างน้อยกว่า 20 pixels จากขอบเขต
                    subPipeNearPlotBoundary = true;
                    break;
                }
            }
        }

        // ท่อจะถือว่าให้บริการแปลงนี้หากเป็นไปตามเงื่อนไขใดเงื่อนไขหนึ่ง
        return subPipeEndpointsInPlot || subPipeSegmentInPlot || subPipeNearPlotBoundary;
    };

    // Helper function to get crop icon based on crop name using CropData
    const getCropIcon = (cropType: string): string => {
        if (cropType === 'No crop selected') {
            return '🌱';
        }

        let crop = getCropByValue(cropType);

        // หากไม่พบ ให้ค้นหาจากชื่อไทย
        if (!crop) {
            crop = greenhouseCrops.find((c) => c.name === cropType);
        }

        // หากยังไม่พบ ให้ค้นหาจากชื่ออังกฤษ
        if (!crop) {
            crop = greenhouseCrops.find((c) => c.nameEn.toLowerCase() === cropType.toLowerCase());
        }

        // หากยังไม่พบ ให้ค้นหาแบบ partial match
        if (!crop) {
            const lowerCropType = cropType.toLowerCase();
            crop = greenhouseCrops.find(
                (c) =>
                    c.name.toLowerCase().includes(lowerCropType) ||
                    c.nameEn.toLowerCase().includes(lowerCropType) ||
                    lowerCropType.includes(c.name.toLowerCase()) ||
                    lowerCropType.includes(c.nameEn.toLowerCase())
            );
        }

        return crop ? crop.icon : '🌱';
    };

    // Calculate cumulative pipe lengths for each plot (Enhanced version)
    const calculatePipeInPlots = () => {
        if (!summaryData?.shapes || !summaryData?.irrigationElements) {
            return [];
        }

        const plots = summaryData.shapes.filter((s) => s.type === 'plot');
        const elements = summaryData.irrigationElements;

        // Sort plots by position (top to bottom, then left to right)
        const sortedPlots = plots
            .map((plot, originalIndex) => ({
                ...plot,
                originalIndex,
                // Calculate plot center for sorting
                centerY: plot.points.reduce((sum, p) => sum + p.y, 0) / plot.points.length,
                centerX: plot.points.reduce((sum, p) => sum + p.x, 0) / plot.points.length,
            }))
            .sort((a, b) => {
                // Sort by Y first (top to bottom), then by X (left to right)
                const yDiff = a.centerY - b.centerY;
                if (Math.abs(yDiff) > 50) {
                    // If Y difference is significant
                    return yDiff;
                }
                return a.centerX - b.centerX; // Otherwise sort by X
            });

        return sortedPlots.map((plot, sortedIndex) => {
            const plotPipeData = {
                plotName: plot.name || `${t('แปลงปลูกที่')} ${sortedIndex + 1}`,
                plotId: `plot-${sortedIndex + 1}`, // เพิ่ม unique ID
                cropType:
                    plot.cropType ||
                    (summaryData.selectedCrops && summaryData.selectedCrops[plot.originalIndex]) ||
                    t('ยังไม่ได้เลือกพืช'),
                maxMainPipeLength: 0,
                maxSubPipeLength: 0,
                maxTotalPipeLength: 0,
                totalMainPipeLength: 0,
                totalSubPipeLength: 0,
                totalPipeLength: 0,
                hasPipes: false,
                // เพิ่มข้อมูล emitters
                sprinklerCount: 0,
                dripEmitterCount: 0,
                totalEmitters: 0,
                longestSubPipeEmitters: 0,
                // เพิ่มข้อมูลอัตราการไหล
                sprinklerFlowRate: 0,
                dripEmitterFlowRate: 0,
                totalFlowRate: 0,
            };

            // Find main pipes and sub pipes
            const mainPipes = elements.filter((e) => e.type === 'main-pipe');
            const subPipes = elements.filter((e) => e.type === 'sub-pipe');

            if (mainPipes.length === 0) return plotPipeData;

            let maxMainDistanceForThisPlot = 0;

            // For each main pipe, find sub pipes that connect to it and serve this plot
            mainPipes.forEach((mainPipe) => {
                if (mainPipe.points.length < 2) return;

                const cumulativeDistances = [0];
                let totalDistance = 0;

                for (let i = 1; i < mainPipe.points.length; i++) {
                    const segmentLength = distanceBetweenPoints(
                        mainPipe.points[i - 1],
                        mainPipe.points[i]
                    );
                    totalDistance += segmentLength;
                    cumulativeDistances.push(totalDistance);
                }

                // Find sub pipes that connect to this main pipe and serve this plot
                subPipes.forEach((subPipe) => {
                    if (subPipe.points.length < 1) return;

                    // Check if this sub pipe serves this plot (any point in plot)
                    const servesThisPlot = subPipe.points.some((point) =>
                        isPointInPolygon(point, plot.points)
                    );

                    if (!servesThisPlot) return;

                    const subPipeStart = subPipe.points[0];

                    // Find the closest connection point on the main pipe
                    let closestDistance = Infinity;
                    let connectionCumulativeDistance = 0;
                    let connectionFound = false;

                    for (let i = 0; i < mainPipe.points.length - 1; i++) {
                        const result = closestPointOnLineSegment(
                            subPipeStart,
                            mainPipe.points[i],
                            mainPipe.points[i + 1]
                        );

                        if (result.distance < closestDistance) {
                            closestDistance = result.distance;
                            // Calculate cumulative distance to this connection point
                            connectionCumulativeDistance =
                                cumulativeDistances[i] +
                                result.t *
                                    distanceBetweenPoints(
                                        mainPipe.points[i],
                                        mainPipe.points[i + 1]
                                    );
                            connectionFound = true;
                        }
                    }

                    // If connection is found within reasonable tolerance
                    if (connectionFound && closestDistance < 50) {
                        // 50 pixels tolerance
                        // Convert to meters and update distance for this plot
                        const connectionDistanceInMeters = connectionCumulativeDistance / 25;
                        maxMainDistanceForThisPlot = Math.max(
                            maxMainDistanceForThisPlot,
                            connectionDistanceInMeters
                        );
                        plotPipeData.hasPipes = true;
                    }
                });
            });

            plotPipeData.maxMainPipeLength = maxMainDistanceForThisPlot;
            plotPipeData.totalMainPipeLength = maxMainDistanceForThisPlot;

            // หาท่อทั้งหมดที่เกี่ยวข้องกับแปลง (ไม่ใช่แค่ส่วนที่อยู่ในแปลง)
            const allSubPipes = elements.filter((e) => e.type === 'sub-pipe');
            const relatedSubPipes = allSubPipes.filter((pipe) => {
                // ตรวจสอบว่าท่อนี้เกี่ยวข้องกับแปลงหรือไม่
                // โดยดูว่าท่อนี้มีส่วนใดส่วนหนึ่งที่อยู่ในแปลง หรือใกล้กับแปลง
                return (
                    subPipeServesPlot(pipe, plot.points) ||
                    pipe.points.some((point) => isPointInPolygon(point, plot.points)) ||
                    pipe.points.some((point) => {
                        // ตรวจสอบว่าจุดใดจุดหนึ่งของท่ออยู่ใกล้กับแปลง (ภายในระยะ 50 pixels)
                        const distanceToPlot = distancePointToPolygon(point, plot.points);
                        return distanceToPlot <= 50;
                    })
                );
            });

            let maxSubPipeLength = 0;
            let totalSubLengthInPlot = 0;

            // ใช้ relatedSubPipes แทน subPipes เพื่อคำนวณความยาวท่อที่เกี่ยวข้องกับแปลง
            if (relatedSubPipes.length > 0) {
                // ฟังก์ชันคำนวณความยาวของท่อทั้งหมด
                const lengthOfPolyline = (points: Point[]) => {
                    if (points.length < 2) return 0;
                    let len = 0;
                    for (let i = 0; i < points.length - 1; i++) {
                        len += distanceBetweenPoints(points[i], points[i + 1]);
                    }
                    return len;
                };

                // คำนวณความยาวจริงของท่อทั้งหมดที่เกี่ยวข้องกับแปลง
                const relatedPipeLengths: number[] = relatedSubPipes.map((sp) =>
                    lengthOfPolyline(sp.points)
                );
                const relatedPipeLengthsInMeters = relatedPipeLengths.map((length) => length / 25); // Convert pixels to meters

                // หาท่อที่ยาวที่สุด (ความยาวจริงทั้งหมด)
                maxSubPipeLength = Math.max(...relatedPipeLengthsInMeters);

                // คำนวณความยาวรวมของท่อที่เกี่ยวข้องกับแปลง
                totalSubLengthInPlot = relatedPipeLengthsInMeters.reduce(
                    (sum, length) => sum + length,
                    0
                );

                plotPipeData.hasPipes = true;
            }

            // คำนวณจำนวน emitters ในแปลงนี้
            const sprinklers = elements.filter((e) => e.type === 'sprinkler');
            const dripLines = elements.filter((e) => e.type === 'drip-line');

            // คำนวณค่า baseTolerance สำหรับการตรวจจับสปริงเกลอร์ที่อยู่ขอบแปลง
            const plotWidth =
                Math.max(...plot.points.map((p) => p.x)) - Math.min(...plot.points.map((p) => p.x));
            const plotHeight =
                Math.max(...plot.points.map((p) => p.y)) - Math.min(...plot.points.map((p) => p.y));
            const baseTolerance = Math.min(plotWidth, plotHeight) * 0.05; // 5% ของขนาดแปลง

            // นับสปริงเกอร์ในแปลงนี้
            sprinklers.forEach((sprinkler) => {
                if (sprinkler.points.length > 0) {
                    const sprinklerPoint = sprinkler.points[0]; // สปริงเกลอร์มีจุดเดียว

                    // ตรวจสอบว่าสปริงเกลอร์อยู่ในแปลงหรือไม่
                    const isInPlot = isPointInPolygon(sprinklerPoint, plot.points);

                    // ตรวจสอบว่าสปริงเกลอร์อยู่ใกล้ขอบแปลงหรือไม่ (สำหรับสปริงเกลอร์ที่อยู่ขอบ)
                    const distanceToPlot = distancePointToPolygon(sprinklerPoint, plot.points);
                    const isNearPlotEdge = distanceToPlot <= baseTolerance * 2; // อยู่ใกล้ขอบแปลง

                    // ตรวจสอบว่าสปริงเกลอร์อยู่ใกล้กับท่อย่อยในแปลงหรือไม่
                    let isNearSubPipeInPlot = false;
                    const subPipes = elements.filter((e) => e.type === 'sub-pipe');

                    if (!isInPlot && !isNearPlotEdge) {
                        // ตรวจสอบว่าท่อย่อยอยู่ในแปลงหรือไม่ (ปรับปรุงตรรกะให้ครอบคลุมมากขึ้น)
                        subPipes.forEach((subPipe) => {
                            if (subPipeServesPlot(subPipe, plot.points)) {
                                // ตรวจสอบระยะห่างจากสปริงเกลอร์ไปยังท่อย่อย
                                for (let i = 0; i < subPipe.points.length - 1; i++) {
                                    const distance = distancePointToLineSegment(
                                        sprinklerPoint,
                                        subPipe.points[i],
                                        subPipe.points[i + 1]
                                    );
                                    if (distance < 30) {
                                        // ระยะห่างน้อยกว่า 30 pixels
                                        isNearSubPipeInPlot = true;
                                        break;
                                    }
                                }
                            }
                        });
                    }

                    // นับสปริงเกลอร์ที่อยู่ในแปลง, อยู่ใกล้ขอบแปลง, หรืออยู่ใกล้กับท่อย่อยในแปลง
                    if (isInPlot || isNearPlotEdge || isNearSubPipeInPlot) {
                        plotPipeData.sprinklerCount++;
                    }
                }
            });

            // นับหัวหยดในแปลงนี้
            dripLines.forEach((dripLine) => {
                if (dripLine.points.length > 0 && dripLine.spacing) {
                    // คำนวณจำนวนหัวหยดตามความยาวท่อและระยะห่าง
                    let dripLengthInPlot = 0;

                    for (let i = 0; i < dripLine.points.length - 1; i++) {
                        const p1 = dripLine.points[i];
                        const p2 = dripLine.points[i + 1];

                        // ตรวจสอบว่าส่วนของท่อนี้อยู่ในแปลงหรือไม่
                        const midPoint = {
                            x: (p1.x + p2.x) / 2,
                            y: (p1.y + p2.y) / 2,
                        };

                        // ตรวจสอบว่าส่วนของท่อนี้อยู่ในแปลงหรืออยู่ใกล้ขอบแปลง
                        const p1InPlot = isPointInPolygon(p1, plot.points);
                        const p2InPlot = isPointInPolygon(p2, plot.points);
                        const midInPlot = isPointInPolygon(midPoint, plot.points);

                        // ตรวจสอบว่าส่วนของท่อนี้อยู่ใกล้ขอบแปลงหรือไม่
                        const p1DistanceToPlot = distancePointToPolygon(p1, plot.points);
                        const p2DistanceToPlot = distancePointToPolygon(p2, plot.points);
                        const midDistanceToPlot = distancePointToPolygon(midPoint, plot.points);
                        const p1NearPlotEdge = p1DistanceToPlot <= baseTolerance * 2;
                        const p2NearPlotEdge = p2DistanceToPlot <= baseTolerance * 2;
                        const midNearPlotEdge = midDistanceToPlot <= baseTolerance * 2;

                        if (
                            p1InPlot ||
                            p2InPlot ||
                            midInPlot ||
                            p1NearPlotEdge ||
                            p2NearPlotEdge ||
                            midNearPlotEdge
                        ) {
                            const segmentLength = distanceBetweenPoints(p1, p2) / 25; // แปลงเป็นเมตร
                            dripLengthInPlot += segmentLength;
                        }
                    }

                    // คำนวณจำนวนหัวหยด (ความยาวท่อ / ระยะห่าง + 1)
                    if (dripLengthInPlot > 0 && dripLine.spacing > 0) {
                        const emittersInThisLine =
                            Math.floor(dripLengthInPlot / dripLine.spacing) + 1;
                        plotPipeData.dripEmitterCount += emittersInThisLine;
                    }
                }
            });

            plotPipeData.totalEmitters =
                plotPipeData.sprinklerCount + plotPipeData.dripEmitterCount;

            // คำนวณจำนวนสปริงเกลอร์และจุดน้ำหยดในท่อย่อยที่ยาวที่สุดสำหรับแปลงปลูกนี้
            // ปรับลอจิกใหม่: หาท่อทั้งหมดที่เกี่ยวข้องกับแปลงก่อน แล้วจัดอันดับตามความยาวจริง

            let longestSubPipeEmitters = 0;

            if (relatedSubPipes.length > 0) {
                // คำนวณความยาวจริงของท่อทั้งหมดที่เกี่ยวข้องกับแปลง
                const relatedPipeLengths: number[] = relatedSubPipes.map((sp) => {
                    if (sp.points.length < 2) return 0;
                    let len = 0;
                    for (let i = 0; i < sp.points.length - 1; i++) {
                        len += distanceBetweenPoints(sp.points[i], sp.points[i + 1]);
                    }
                    return len;
                });

                // หาท่อที่ยาวที่สุดจากท่อทั้งหมดที่เกี่ยวข้อง
                let longestSubLengthPx = 0;
                let longestPipeIndex = -1;
                relatedPipeLengths.forEach((len, idx) => {
                    if (len > longestSubLengthPx) {
                        longestSubLengthPx = len;
                        longestPipeIndex = idx;
                    }
                });

                console.log(
                    `🏆 ${plotPipeData.plotName} - ท่อที่ยาวที่สุด: เส้นที่ ${longestPipeIndex + 1} (${longestSubLengthPx.toFixed(2)} pixels)`
                );

                // แสดงข้อมูลสปริงเกลอร์ที่เกี่ยวข้องกับแปลง
                const sprinklersInPlot = sprinklers.filter((spr) => {
                    const p = spr.points[0];
                    return p && isPointInPolygon(p, plot.points);
                }).length;

                const sprinklersNearEdge = sprinklers.filter((spr) => {
                    const p = spr.points[0];
                    if (!p) return false;
                    const distanceToPlot = distancePointToPolygon(p, plot.points);
                    return distanceToPlot <= baseTolerance * 2;
                }).length;

                console.log(
                    `🚿 ${plotPipeData.plotName} - สปริงเกลอร์ใกล้ขอบแปลง: ${sprinklersNearEdge} ตัว`
                );
                console.log(
                    `🚿 ${plotPipeData.plotName} - สปริงเกลอร์รวม: ${sprinklersInPlot + sprinklersNearEdge} ตัว`
                );

                // หาท่อที่ยาวที่สุด (หรือใกล้เคียงกัน) เพื่อนับสปริงเกลอร์
                const TOL_PX = 20;
                const tieIndices: number[] = [];
                relatedPipeLengths.forEach((len, idx) => {
                    if (Math.abs(len - longestSubLengthPx) <= TOL_PX) tieIndices.push(idx);
                });

                // นับสปริงเกลอร์และจุดน้ำหยดในท่อย่อยที่ยาวที่สุด
                // ใช้ค่า tolerance แบบ adaptive ตามตำแหน่งท่อย่อย
                tieIndices.forEach((idx) => {
                    const sp = relatedSubPipes[idx];
                    let sprCount = 0;
                    let dripCount = 0;

                    // ตรวจสอบว่าสปริงเกลอร์อยู่ในแปลงและเชื่อมต่อกับท่อย่อยนี้

                    // คำนวณค่า tolerance แบบ adaptive ตามตำแหน่งท่อย่อย
                    const subPipeCenterY =
                        sp.points.reduce((sum, p) => sum + p.y, 0) / sp.points.length;
                    const plotCenterY =
                        plot.points.reduce((sum, p) => sum + p.y, 0) / plot.points.length;
                    const plotTopY = Math.min(...plot.points.map((p) => p.y));
                    const plotBottomY = Math.max(...plot.points.map((p) => p.y));
                    const plotHeight = plotBottomY - plotTopY;

                    // คำนวณระยะห่างจากท่อย่อยไปยังจุดกึ่งกลางแปลง
                    const distanceFromCenter = Math.abs(subPipeCenterY - plotCenterY);
                    const centerRatio = distanceFromCenter / (plotHeight / 2); // อัตราส่วนระยะห่างจากจุดกึ่งกลาง

                    // ถ้าท่อย่อยอยู่ใกล้ขอบบนหรือขอบล่าง ให้เพิ่ม tolerance
                    const distanceFromTop = Math.abs(subPipeCenterY - plotTopY);
                    const distanceFromBottom = Math.abs(subPipeCenterY - plotBottomY);
                    const minDistanceFromEdge = Math.min(distanceFromTop, distanceFromBottom);

                    // คำนวณค่า tolerance แบบ adaptive โดยใช้ทั้งระยะห่างจากขอบและจากจุดกึ่งกลาง
                    let adaptiveTolerance = baseTolerance;
                    const attachTolPx = 12; // ค่า tolerance สำหรับการเชื่อมต่อ

                    // ตรวจสอบว่าท่อย่อยอยู่ใกล้ขอบบนหรือขอบล่าง
                    const isNearTop = distanceFromTop < plotHeight * 0.2;
                    const isNearBottom = distanceFromBottom < plotHeight * 0.2;

                    // ถ้าท่อย่อยอยู่ใกล้ขอบใดก็ตาม (บนหรือล่าง) ให้เพิ่ม tolerance
                    if (isNearTop || isNearBottom) {
                        adaptiveTolerance = baseTolerance * 2; // เพิ่ม tolerance เป็น 2 เท่า

                        // ถ้าอยู่ใกล้ขอบมากๆ ให้เพิ่ม tolerance มากขึ้น
                        if (minDistanceFromEdge < plotHeight * 0.1) {
                            adaptiveTolerance = baseTolerance * 3; // เพิ่ม tolerance เป็น 3 เท่า
                        }
                    }

                    // ถ้าท่อย่อยอยู่ใกล้จุดกึ่งกลางแปลง ให้ลด tolerance เพื่อความแม่นยำ
                    if (centerRatio < 0.3) {
                        // ถ้าอยู่ใกล้จุดกึ่งกลางมากกว่า 70%
                        adaptiveTolerance = Math.max(adaptiveTolerance * 0.8, attachTolPx); // ลด tolerance แต่ไม่ต่ำกว่า attachTolPx
                    }

                    // ใช้ค่า tolerance แบบ multi-level ที่ครอบคลุมมากขึ้น
                    const toleranceLevels = [
                        attachTolPx, // ค่าต่ำสุด
                        adaptiveTolerance * 0.5,
                        adaptiveTolerance,
                        adaptiveTolerance * 1.5,
                        adaptiveTolerance * 2, // ค่าสูงสุด
                        baseTolerance * 4, // ค่าสูงสุดสำรอง
                        baseTolerance * 6, // ค่าสูงสุดเพิ่มเติมสำหรับกรณีที่เจอสปริงเกลอร์ยาก
                        baseTolerance * 8, // ค่าสูงสุดสุดท้าย
                    ];
                    let bestTolerance = toleranceLevels[0];
                    let bestScore = Infinity;

                    // ลองใช้ค่า tolerance หลายระดับเพื่อหาค่าที่เหมาะสม
                    for (const tolerance of toleranceLevels) {
                        let tempSprCount = 0;

                        sprinklers.forEach((spr) => {
                            const p = spr.points[0];
                            if (!p) return;

                            // ตรวจสอบว่าสปริงเกลอร์อยู่ในแปลงหรือไม่
                            const isInPlot = isPointInPolygon(p, plot.points);

                            // ตรวจสอบว่าสปริงเกลอร์อยู่ใกล้ขอบแปลงหรือไม่ (สำหรับสปริงเกลอร์ที่อยู่ขอบ)
                            const distanceToPlot = distancePointToPolygon(p, plot.points);
                            const isNearPlotEdge = distanceToPlot <= baseTolerance * 2; // อยู่ใกล้ขอบแปลง

                            // นับสปริงเกลอร์ที่อยู่ในแปลง หรืออยู่ใกล้ขอบแปลง
                            if (isInPlot || isNearPlotEdge) {
                                // ตรวจสอบว่าสปริงเกลอร์เชื่อมต่อกับท่อย่อยนี้
                                for (let i = 1; i < sp.points.length; i++) {
                                    const res = closestPointOnLineSegment(
                                        p,
                                        sp.points[i - 1],
                                        sp.points[i]
                                    );
                                    if (res.distance <= tolerance) {
                                        tempSprCount += 1;
                                        break;
                                    }
                                }
                            }
                        });

                        // คำนวณคะแนนโดยพิจารณาจำนวนสปริงเกลอร์ที่พบและความสมเหตุสมผล
                        const expectedSprinklers = Math.max(
                            4,
                            Math.min(12, Math.floor(plotWidth / 50))
                        ); // คำนวณจำนวนที่คาดหวังตามขนาดแปลง
                        const countScore = Math.abs(tempSprCount - expectedSprinklers);

                        // ปรับปรุงระบบการให้คะแนน - ให้คะแนนดีขึ้นเมื่อเจอสปริงเกลอร์
                        let reasonablenessScore = 0;
                        if (tempSprCount === 0) {
                            reasonablenessScore = 200; // ให้คะแนนแย่มากถ้าไม่เจอเลย
                        } else if (tempSprCount < 2) {
                            reasonablenessScore = 50; // ให้คะแนนแย่ถ้าเจอน้อยเกินไป
                        }

                        // เพิ่มคะแนนพิเศษสำหรับการใช้ attachTolPx เมื่อท่อย่อยอยู่ใกล้จุดกึ่งกลาง
                        let centerBonus = 0;
                        if (tolerance === attachTolPx && centerRatio < 0.3) {
                            centerBonus = -10; // ให้คะแนนดีขึ้นเมื่อใช้ attachTolPx กับท่อย่อยที่อยู่ใกล้จุดกึ่งกลาง
                        }

                        // เพิ่มคะแนนพิเศษสำหรับ tolerance ที่ไม่สูงเกินไป
                        let toleranceBonus = 0;
                        if (tolerance <= baseTolerance * 2) {
                            toleranceBonus = -5; // ให้คะแนนดีขึ้นสำหรับ tolerance ที่สมเหตุสมผล
                        }

                        const totalScore =
                            countScore + reasonablenessScore + centerBonus + toleranceBonus;

                        // เลือกค่า tolerance ที่ให้คะแนนดีที่สุด
                        if (totalScore < bestScore) {
                            sprCount = tempSprCount;
                            bestTolerance = tolerance;
                            bestScore = totalScore;
                        }
                    }

                    if (plotPipeData.plotName.includes('2') && sprCount === 0) {
                        // ตรวจสอบสปริงเกลอร์ที่ใกล้ที่สุด (รวมสปริงเกลอร์ที่อยู่ขอบแปลง)
                        interface ClosestSprinkler {
                            id: string;
                            point: Point;
                            distance: number;
                            tolerance: number;
                            location: 'inside' | 'near_edge' | 'near_subpipe';
                        }
                        let closestSprinkler: ClosestSprinkler | null = null;
                        let minDistance = Infinity;
                        sprinklers.forEach((spr) => {
                            const p = spr.points[0];
                            if (!p) return;

                            const isInPlot = isPointInPolygon(p, plot.points);
                            const distanceToPlot = distancePointToPolygon(p, plot.points);
                            const isNearPlotEdge = distanceToPlot <= baseTolerance * 2;

                            // ตรวจสอบสปริงเกลอร์ที่อยู่ในแปลง หรืออยู่ใกล้ขอบแปลง
                            if (isInPlot || isNearPlotEdge) {
                                for (let i = 1; i < sp.points.length; i++) {
                                    const res = closestPointOnLineSegment(
                                        p,
                                        sp.points[i - 1],
                                        sp.points[i]
                                    );
                                    if (res.distance < minDistance) {
                                        minDistance = res.distance;
                                        let location: 'inside' | 'near_edge' | 'near_subpipe' =
                                            'inside';
                                        if (isInPlot) {
                                            location = 'inside';
                                        } else if (isNearPlotEdge) {
                                            location = 'near_edge';
                                        }

                                        closestSprinkler = {
                                            id: spr.id,
                                            point: p,
                                            distance: res.distance,
                                            tolerance: bestTolerance,
                                            location: location,
                                        };
                                    }
                                }
                            }
                        });

                        if (closestSprinkler) {
                            // ถ้าสปริงเกลอร์ที่ใกล้ที่สุดอยู่ไม่ไกลเกินไป ให้ลองใช้ tolerance ที่ใหญ่ขึ้น
                        }
                    }

                    // ตรวจสอบว่าจุดน้ำหยดอยู่ในแปลงและเชื่อมต่อกับท่อย่อยนี้
                    dripLines.forEach((dl) => {
                        if (dl.points.length < 2 || !dl.spacing) return;
                        let isAttached = false;

                        // ตรวจสอบว่า drip line เชื่อมต่อกับท่อย่อยนี้
                        for (let i = 1; i < dl.points.length && !isAttached; i++) {
                            for (let j = 1; j < sp.points.length; j++) {
                                const r1 = closestPointOnLineSegment(
                                    dl.points[i - 1],
                                    sp.points[j - 1],
                                    sp.points[j]
                                );
                                const r2 = closestPointOnLineSegment(
                                    dl.points[i],
                                    sp.points[j - 1],
                                    sp.points[j]
                                );
                                if (Math.min(r1.distance, r2.distance) <= attachTolPx) {
                                    isAttached = true;
                                    break;
                                }
                            }
                        }

                        if (isAttached) {
                            // คำนวณความยาวของ drip line ที่อยู่ในแปลง
                            let dripLengthInPlot = 0;
                            for (let i = 1; i < dl.points.length; i++) {
                                const segmentStart = dl.points[i - 1];
                                const segmentEnd = dl.points[i];

                                // ตรวจสอบว่า segment อยู่ในแปลงหรือไม่
                                const startInPlot = isPointInPolygon(segmentStart, plot.points);
                                const endInPlot = isPointInPolygon(segmentEnd, plot.points);

                                // ตรวจสอบว่า segment อยู่ใกล้ขอบแปลงหรือไม่ (สำหรับจุดน้ำหยดที่อยู่ขอบ)
                                const startDistanceToPlot = distancePointToPolygon(
                                    segmentStart,
                                    plot.points
                                );
                                const endDistanceToPlot = distancePointToPolygon(
                                    segmentEnd,
                                    plot.points
                                );
                                const startNearPlotEdge = startDistanceToPlot <= baseTolerance * 2; // อยู่ใกล้ขอบแปลง
                                const endNearPlotEdge = endDistanceToPlot <= baseTolerance * 2; // อยู่ใกล้ขอบแปลง

                                if (startInPlot && endInPlot) {
                                    // ทั้ง segment อยู่ในแปลง
                                    dripLengthInPlot +=
                                        distanceBetweenPoints(segmentStart, segmentEnd) / 25; // Convert to meters
                                } else if (startInPlot || endInPlot) {
                                    // ส่วนหนึ่งของ segment อยู่ในแปลง (ประมาณครึ่งหนึ่ง)
                                    dripLengthInPlot +=
                                        distanceBetweenPoints(segmentStart, segmentEnd) / 25 / 2;
                                } else if (startNearPlotEdge || endNearPlotEdge) {
                                    // segment อยู่ใกล้ขอบแปลง (ประมาณครึ่งหนึ่ง)
                                    dripLengthInPlot +=
                                        distanceBetweenPoints(segmentStart, segmentEnd) / 25 / 2;
                                }
                            }

                            // คำนวณจำนวนจุดน้ำหยดใน drip line นี้
                            if (dripLengthInPlot > 0 && dl.spacing > 0) {
                                const emittersInThisLine =
                                    Math.floor(dripLengthInPlot / dl.spacing) + 1;
                                dripCount += emittersInThisLine;
                            }
                        }
                    });

                    const totalEmittersForThisPipe = sprCount + dripCount;
                    if (totalEmittersForThisPipe > longestSubPipeEmitters) {
                        longestSubPipeEmitters = totalEmittersForThisPipe;
                    }
                });
            }

            // ใช้จำนวนสปริงเกลอร์และจุดน้ำหยดในท่อย่อยที่ยาวที่สุด
            // ถ้า longestSubPipeEmitters เป็น 0 แสดงว่าไม่มีสปริงเกลอร์ในท่อย่อยที่ยาวที่สุด
            // ให้ใช้ 0 แทนที่จะใช้ totalEmitters
            if (longestSubPipeEmitters === 0 && relatedSubPipes.length > 0) {
                plotPipeData.longestSubPipeEmitters = 0;
            } else {
                plotPipeData.longestSubPipeEmitters = longestSubPipeEmitters;
            }

            // คำนวณอัตราการไหลสำหรับแปลงปลูกนี้
            const sprinklerFlowRate = summaryData?.sprinklerFlowRate || 10; // L/min per sprinkler
            const dripEmitterFlowRate = summaryData?.dripEmitterFlowRate || 0.24; // L/min per drip emitter

            // คำนวณอัตราการไหลแยกตามประเภท
            const plotSprinklerFlowRate = plotPipeData.sprinklerCount * sprinklerFlowRate;
            const plotDripEmitterFlowRate = plotPipeData.dripEmitterCount * dripEmitterFlowRate;
            const plotTotalFlowRate = plotSprinklerFlowRate + plotDripEmitterFlowRate;

            // เพิ่มข้อมูลอัตราการไหลใน plotPipeData
            plotPipeData.sprinklerFlowRate = plotSprinklerFlowRate;
            plotPipeData.dripEmitterFlowRate = plotDripEmitterFlowRate;
            plotPipeData.totalFlowRate = plotTotalFlowRate;

            plotPipeData.maxSubPipeLength = Math.round(maxSubPipeLength * 100) / 100;
            plotPipeData.maxTotalPipeLength =
                Math.round((plotPipeData.maxMainPipeLength + maxSubPipeLength) * 100) / 100;
            plotPipeData.totalSubPipeLength = Math.round(totalSubLengthInPlot * 100) / 100;
            plotPipeData.totalPipeLength =
                Math.round((plotPipeData.totalMainPipeLength + totalSubLengthInPlot) * 100) / 100;
            plotPipeData.maxMainPipeLength = Math.round(plotPipeData.maxMainPipeLength * 100) / 100;
            plotPipeData.totalMainPipeLength =
                Math.round(plotPipeData.totalMainPipeLength * 100) / 100;

            return plotPipeData;
        });
    };

    const plotPipeData = calculatePipeInPlots();

    // Calculate pipe flow rates and connections
    const calculatePipeFlowRates = () => {
        if (!summaryData?.irrigationElements) {
            return {
                mainPipeCount: 0,
                subPipeCount: 0,
                totalEmitters: 0,
                totalFlowRate: 0,
                mainPipeFlowRate: 0,
                subPipeFlowRate: 0,
                connections: {
                    mainToSub: 0,
                    subToEmitters: 0,
                },
                longest: {
                    main: { length: 0, connections: 0, flowRate: 0 },
                    sub: { length: 0, emitters: 0, flowRate: 0 },
                },
            };
        }

        const elements = summaryData.irrigationElements;

        // Count different pipe types
        const mainPipes = elements.filter((e) => e.type === 'main-pipe');
        const subPipes = elements.filter((e) => e.type === 'sub-pipe');
        const sprinklers = elements.filter((e) => e.type === 'sprinkler');
        const dripLines = elements.filter((e) => e.type === 'drip-line');

        // Count emitters
        const totalSprinklers = sprinklers.length;
        let totalDripEmitters = 0;

        // Calculate drip emitters based on drip line length and spacing
        dripLines.forEach((dripLine) => {
            if (dripLine.points.length > 1 && dripLine.spacing) {
                let totalLength = 0;
                for (let i = 0; i < dripLine.points.length - 1; i++) {
                    const p1 = dripLine.points[i];
                    const p2 = dripLine.points[i + 1];
                    const segmentLength = distanceBetweenPoints(p1, p2) / 25; // Convert to meters
                    totalLength += segmentLength;
                }
                if (totalLength > 0 && dripLine.spacing > 0) {
                    const emittersInThisLine = Math.floor(totalLength / dripLine.spacing) + 1;
                    totalDripEmitters += emittersInThisLine;
                }
            }
        });

        const totalEmitters = totalSprinklers + totalDripEmitters;

        // Flow rate calculations - get from irrigation method selection
        // These values should come from the choose-irrigation page
        const sprinklerFlowRate = summaryData?.sprinklerFlowRate || 10; // L/min per sprinkler
        const dripEmitterFlowRate = summaryData?.dripEmitterFlowRate || 0.24; // L/min per drip emitter

        // Calculate flow rates separately for sprinklers and drip emitters
        const totalSprinklerFlowRate = totalSprinklers * sprinklerFlowRate;
        const totalDripEmitterFlowRate = totalDripEmitters * dripEmitterFlowRate;

        // Calculate sub pipe flow rate (from emitters)
        const subPipeFlowRate = totalSprinklerFlowRate + totalDripEmitterFlowRate;

        // Calculate main pipe flow rate (from sub pipes)
        let mainPipeFlowRate = 0;
        let mainToSubConnections = 0;

        if (subPipes.length > 0 && mainPipes.length > 0) {
            // Calculate flow rate per sub pipe (total emitters divided by number of sub pipes)
            const sprinklersPerSubPipe = totalSprinklers / subPipes.length;
            const dripEmittersPerSubPipe = totalDripEmitters / subPipes.length;
            const flowRatePerSubPipe =
                sprinklersPerSubPipe * sprinklerFlowRate +
                dripEmittersPerSubPipe * dripEmitterFlowRate;

            // For each main pipe, count how many sub pipes connect to it
            mainPipes.forEach((mainPipe) => {
                let subPipesConnectedToThisMain = 0;

                subPipes.forEach((subPipe) => {
                    // Check if sub pipe connects to this main pipe
                    if (subPipe.points.length > 0 && mainPipe.points.length > 0) {
                        const subStart = subPipe.points[0];
                        let isConnected = false;

                        // Check if sub pipe start point is close to any point on main pipe
                        for (let i = 0; i < mainPipe.points.length - 1; i++) {
                            const result = closestPointOnLineSegment(
                                subStart,
                                mainPipe.points[i],
                                mainPipe.points[i + 1]
                            );

                            if (result.distance < 50) {
                                // 50 pixels tolerance
                                isConnected = true;
                                break;
                            }
                        }

                        if (isConnected) {
                            subPipesConnectedToThisMain++;
                        }
                    }
                });

                if (subPipesConnectedToThisMain > 0) {
                    // Each connected sub pipe contributes its flow rate to the main pipe
                    mainPipeFlowRate += flowRatePerSubPipe * subPipesConnectedToThisMain;
                    mainToSubConnections += subPipesConnectedToThisMain;
                }
            });
        } else {
            // If no sub pipes, assume main pipes get flow directly from emitters
            mainPipeFlowRate = subPipeFlowRate;
        }

        const totalFlowRate = mainPipeFlowRate;

        // Calculate flow rate per sub pipe
        const flowRatePerSubPipe = subPipes.length > 0 ? subPipeFlowRate / subPipes.length : 0;

        // Calculate emitters per sub pipe
        const emittersPerSubPipe =
            subPipes.length > 0 ? Math.round(totalEmitters / subPipes.length) : 0;

        // Longest-line metrics
        const lengthOfPolyline = (points: Point[]) => {
            if (points.length < 2) return 0;
            let len = 0;
            for (let i = 0; i < points.length - 1; i++) {
                len += distanceBetweenPoints(points[i], points[i + 1]);
            }
            return len; // pixels
        };

        // Find longest main pipe
        let longestMainLengthPx = 0;
        let longestMainIndex = -1;
        mainPipes.forEach((mp, idx) => {
            const len = lengthOfPolyline(mp.points);
            if (len > longestMainLengthPx) {
                longestMainLengthPx = len;
                longestMainIndex = idx;
            }
        });

        // Count connections for the longest main pipe
        let longestMainConnections = 0;
        if (longestMainIndex >= 0) {
            const mp = mainPipes[longestMainIndex];
            subPipes.forEach((subPipe) => {
                if (subPipe.points.length > 0 && mp.points.length > 0) {
                    const subStart = subPipe.points[0];
                    let isConnected = false;
                    for (let i = 0; i < mp.points.length - 1; i++) {
                        const result = closestPointOnLineSegment(
                            subStart,
                            mp.points[i],
                            mp.points[i + 1]
                        );
                        if (result.distance < 50) {
                            // 50px tolerance
                            isConnected = true;
                            break;
                        }
                    }
                    if (isConnected) longestMainConnections++;
                }
            });
        }

        // Find longest sub pipe length and collect ties
        let longestSubLengthPx = 0;
        const subPipeLengths: number[] = subPipes.map((sp) => lengthOfPolyline(sp.points));
        subPipeLengths.forEach((len) => {
            if (len > longestSubLengthPx) longestSubLengthPx = len;
        });

        const TOL_PX = 20; // consider ties within 20px length
        const tieIndices: number[] = [];
        subPipeLengths.forEach((len, idx) => {
            if (Math.abs(len - longestSubLengthPx) <= TOL_PX) tieIndices.push(idx);
        });

        // Count actual emitters attached to each candidate longest sub-pipe
        const attachTolPx = 12;
        let bestEmitters = 0;
        let bestFlow = 0;

        tieIndices.forEach((idx) => {
            const sp = subPipes[idx];
            let sprCount = 0;
            let dripEmitterCount = 0;

            // Sprinklers attached to this sub-pipe
            sprinklers.forEach((spr) => {
                const p = spr.points[0];
                if (!p) return;
                for (let i = 1; i < sp.points.length; i++) {
                    const res = closestPointOnLineSegment(p, sp.points[i - 1], sp.points[i]);
                    if (res.distance <= attachTolPx) {
                        sprCount += 1;
                        break;
                    }
                }
            });

            // Drip lines attached to this sub-pipe (count emitters along those lines)
            dripLines.forEach((dl) => {
                if (dl.points.length < 2 || !dl.spacing) return;
                let isAttached = false;
                for (let i = 1; i < dl.points.length && !isAttached; i++) {
                    for (let j = 1; j < sp.points.length; j++) {
                        const r1 = closestPointOnLineSegment(
                            dl.points[i - 1],
                            sp.points[j - 1],
                            sp.points[j]
                        );
                        const r2 = closestPointOnLineSegment(
                            dl.points[i],
                            sp.points[j - 1],
                            sp.points[j]
                        );
                        if (Math.min(r1.distance, r2.distance) <= attachTolPx) {
                            isAttached = true;
                            break;
                        }
                    }
                }
                if (isAttached) {
                    let totalLengthM = 0;
                    for (let i = 1; i < dl.points.length; i++) {
                        totalLengthM += distanceBetweenPoints(dl.points[i - 1], dl.points[i]) / 25;
                    }
                    if (totalLengthM > 0 && dl.spacing > 0) {
                        const emittersInThisLine = Math.floor(totalLengthM / dl.spacing) + 1;
                        dripEmitterCount += emittersInThisLine;
                    }
                }
            });

            const flowForThis =
                sprCount * sprinklerFlowRate + dripEmitterCount * dripEmitterFlowRate;
            const emittersForThis = sprCount + dripEmitterCount;

            // ใช้จำนวนสปริงเกลอร์และจุดน้ำหยดในท่อย่อยที่ยาวที่สุดเป็นจำนวนทางออก
            // หากมีท่อย่อยหลายเส้นที่มีความยาวเท่ากัน ให้เลือกเส้นที่มี emitters มากที่สุด
            if (emittersForThis > bestEmitters) {
                bestEmitters = emittersForThis;
                bestFlow = flowForThis;
            }
        });

        // Fallback to average if no candidates evaluated (e.g., no sub pipes)
        if (tieIndices.length === 0) {
            bestEmitters = emittersPerSubPipe;
            bestFlow = flowRatePerSubPipe;
        }

        const longestMainLengthM = longestMainLengthPx / 25;
        const longestSubLengthM = longestSubLengthPx / 25;

        // คำนวณอัตราการไหลของท่อเมนที่ยาวที่สุดโดยใช้จำนวนท่อย่อยที่เชื่อมต่อ
        const longestMainFlow = flowRatePerSubPipe * longestMainConnections;

        // ใช้จำนวนสปริงเกลอร์ในท่อย่อยที่ยาวที่สุดเป็นจำนวนทางออก
        const longestSubEmitters = bestEmitters;
        const longestSubFlow = bestFlow;

        return {
            mainPipeCount: mainPipes.length,
            subPipeCount: subPipes.length,
            totalEmitters: totalEmitters,
            totalFlowRate: totalFlowRate,
            mainPipeFlowRate: mainPipeFlowRate,
            subPipeFlowRate: flowRatePerSubPipe, // Flow rate per sub pipe
            connections: {
                mainToSub: mainToSubConnections,
                subToEmitters: emittersPerSubPipe, // Emitters per sub pipe, not total
            },
            longest: {
                main: {
                    length: longestMainLengthM,
                    connections: longestMainConnections,
                    flowRate: longestMainFlow,
                },
                sub: {
                    length: longestSubLengthM,
                    emitters: longestSubEmitters,
                    flowRate: longestSubFlow,
                },
            },
        };
    };

    const pipeFlowData = calculatePipeFlowRates();

    // Calculate water requirements for each plot
    const calculateWaterRequirements = () => {
        if (!summaryData?.shapes) {
            return {
                waterSummary: null,
                plotWaterCalculations: [],
            };
        }

        const plots = summaryData.shapes.filter((s) => s.type === 'plot');

        if (plots.length === 0) {
            return {
                waterSummary: null,
                plotWaterCalculations: [],
            };
        }

        // Convert shapes to format expected by water calculation
        const shapesForWaterCalc = plots.map((plot) => ({
            id: plot.id,
            type: plot.type,
            name: plot.name,
            points: plot.points,
            cropType:
                plot.cropType ||
                (summaryData.selectedCrops && summaryData.selectedCrops[0]) ||
                'tomato',
        }));

        try {
            const waterSummary = calculatePlotBasedWaterRequirements(shapesForWaterCalc);
            return {
                waterSummary,
                plotWaterCalculations: waterSummary.plotCalculations,
            };
        } catch (error) {
            console.error('Error calculating water requirements:', error);
            return {
                waterSummary: null,
                plotWaterCalculations: [],
            };
        }
    };

    const {
        waterSummary,
        plotWaterCalculations,
    }: {
        waterSummary: PlotBasedWaterSummary | null;
        plotWaterCalculations: PlotWaterCalculation[];
    } = calculateWaterRequirements();

    // Toggle section visibility
    const toggleSection = (sectionKey: string) => {
        setExpandedSections((prev) => ({
            ...prev,
            [sectionKey]: !prev[sectionKey],
        }));
    };

    // Calculate metrics from shapes data
    const calculateMetrics = () => {
        if (!summaryData?.shapes)
            return {
                shapeTypeCount: 0,
                greenhouseArea: 0,
                plotArea: 0,
                plotCount: 0,
                waterSourceCount: 0,
                walkwayArea: 0,
            };

        const shapes = summaryData.shapes;
        const greenhouses = shapes.filter((s) => s.type === 'greenhouse');
        const plots = shapes.filter((s) => s.type === 'plot');
        const walkways = shapes.filter((s) => s.type === 'walkway');
        const waterSources = shapes.filter((s) => s.type === 'water-source');

        const shapeTypes = new Set(shapes.map((s) => s.type));
        const shapeTypeCount = shapeTypes.size;

        const calculatePolygonArea = (points: { x: number; y: number }[]) => {
            if (points.length < 3) return 0;
            let area = 0;
            for (let i = 0; i < points.length; i++) {
                const j = (i + 1) % points.length;
                area += points[i].x * points[j].y;
                area -= points[j].x * points[i].y;
            }
            return Math.abs(area / 2) / 625;
        };

        const greenhouseArea = greenhouses.reduce(
            (sum, gh) => sum + calculatePolygonArea(gh.points),
            0
        );
        const plotArea = plots.reduce((sum, plot) => sum + calculatePolygonArea(plot.points), 0);
        const walkwayArea = walkways.reduce(
            (sum, walkway) => sum + calculatePolygonArea(walkway.points),
            0
        );

        return {
            shapeTypeCount,
            greenhouseArea: Math.round(greenhouseArea * 100) / 100,
            plotArea: Math.round(plotArea * 100) / 100,
            plotCount: plots.length,
            waterSourceCount: waterSources.length,
            walkwayArea: Math.round(walkwayArea * 100) / 100,
        };
    };

    const metrics = calculateMetrics();

    // Enhanced Calculate irrigation equipment from irrigationElements
    const calculateIrrigationMetrics = () => {
        if (!summaryData?.irrigationElements || summaryData.irrigationElements.length === 0) {
            return {
                maxMainPipeLength: 0,
                maxSubPipeLength: 0,
                maxTotalPipeLength: 0,
                totalMainPipeLength: 0,
                totalSubPipeLength: 0,
                totalPipeLength: 0,
                pumps: 0,
                solenoidValves: 0,
                ballValves: 0,
                sprinklers: 0,
                dripPoints: 0,
            };
        }

        const elements = summaryData.irrigationElements;

        const calculatePipeLength = (points: Point[]) => {
            if (points.length < 2) return 0;
            let totalLength = 0;
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                const segmentLength = Math.sqrt(
                    Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
                );
                totalLength += segmentLength;
            }
            return totalLength / 25;
        };

        // Calculate drip points from drip lines
        const calculateDripPoints = (dripLine: IrrigationElement) => {
            if (dripLine.points.length < 2) return 0;

            const spacing = (dripLine.spacing || 0.3) * 20; // Convert to pixels (0.3m default spacing)
            let totalPoints = 0;

            for (let i = 0; i < dripLine.points.length - 1; i++) {
                const p1 = dripLine.points[i];
                const p2 = dripLine.points[i + 1];

                const segmentLength = Math.sqrt(
                    Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)
                );

                // Calculate number of drip points in this segment
                const pointsInSegment = Math.floor(segmentLength / spacing);
                totalPoints += pointsInSegment;
            }

            return totalPoints;
        };

        const mainPipes = elements.filter((e) => e.type === 'main-pipe');
        let maxMainPipeLength = 0;
        let totalMainPipeLength = 0;
        if (mainPipes.length > 0) {
            const mainPipeLengths = mainPipes.map((pipe) => calculatePipeLength(pipe.points));
            maxMainPipeLength = Math.max(...mainPipeLengths);
            totalMainPipeLength = mainPipeLengths.reduce((sum, length) => sum + length, 0);
        }

        const subPipes = elements.filter((e) => e.type === 'sub-pipe');
        let maxSubPipeLength = 0;
        let totalSubPipeLength = 0;
        if (subPipes.length > 0) {
            const subPipeLengths = subPipes.map((pipe) => calculatePipeLength(pipe.points));
            maxSubPipeLength = Math.max(...subPipeLengths);
            totalSubPipeLength = subPipeLengths.reduce((sum, length) => sum + length, 0);
        }

        const maxTotalPipeLength = maxMainPipeLength + maxSubPipeLength;
        const totalPipeLength = totalMainPipeLength + totalSubPipeLength;

        // Calculate total drip points
        const dripLines = elements.filter((e) => e.type === 'drip-line');
        const totalDripPoints = dripLines.reduce(
            (sum, dripLine) => sum + calculateDripPoints(dripLine),
            0
        );

        return {
            maxMainPipeLength: Math.round(maxMainPipeLength * 100) / 100,
            maxSubPipeLength: Math.round(maxSubPipeLength * 100) / 100,
            maxTotalPipeLength: Math.round(maxTotalPipeLength * 100) / 100,
            totalMainPipeLength: Math.round(totalMainPipeLength * 100) / 100,
            totalSubPipeLength: Math.round(totalSubPipeLength * 100) / 100,
            totalPipeLength: Math.round(totalPipeLength * 100) / 100,
            pumps: elements.filter((e) => e.type === 'pump').length,
            solenoidValves: elements.filter((e) => e.type === 'solenoid-valve').length,
            ballValves: elements.filter((e) => e.type === 'ball-valve').length,
            sprinklers: elements.filter((e) => e.type === 'sprinkler').length,
            dripPoints: totalDripPoints,
            waterTanks: elements.filter((e) => e.type === 'water-tank').length,
            fertilizerMachines: elements.filter((e) => e.type === 'fertilizer-machine').length,
        };
    };

    const irrigationMetrics = calculateIrrigationMetrics();

    const segmentIntersection = (a1: Point, a2: Point, b1: Point, b2: Point): Point | null => {
        const dax = a2.x - a1.x;
        const day = a2.y - a1.y;
        const dbx = b2.x - b1.x;
        const dby = b2.y - b1.y;
        const denom = dax * dby - day * dbx;
        if (denom === 0) return null;
        const s = ((a1.x - b1.x) * dby - (a1.y - b1.y) * dbx) / denom;
        const t = ((a1.x - b1.x) * day - (a1.y - b1.y) * dax) / denom;
        if (s >= 0 && s <= 1 && t >= 0 && t <= 1) {
            return { x: a1.x + s * dax, y: a1.y + s * day };
        }
        return null;
    };

    const stationAlongPolyline = (poly: Point[], p: Point): number => {
        if (poly.length < 2) return 0;
        let bestStation = 0;
        let bestDist = Number.POSITIVE_INFINITY;
        let acc = 0;
        for (let i = 1; i < poly.length; i++) {
            const a = poly[i - 1];
            const b = poly[i];
            const segLen = distanceBetweenPoints(a, b);
            const res = closestPointOnLineSegment(p, a, b);
            if (res.distance < bestDist) {
                bestDist = res.distance;
                bestStation = acc + res.t * segLen;
            }
            acc += segLen;
        }
        return bestStation;
    };

    // Removed corner-based 2-way counting for greenhouse main pipes

    const sideOfPolyline = (poly: Point[], p: Point): number => {
        // Determine side by the nearest segment cross product sign
        if (poly.length < 2) return 0;
        let bestDist = Number.POSITIVE_INFINITY;
        let side = 0;
        for (let i = 1; i < poly.length; i++) {
            const a = poly[i - 1];
            const b = poly[i];
            const res = closestPointOnLineSegment(p, a, b);
            if (res.distance < bestDist) {
                bestDist = res.distance;
                const abx = b.x - a.x;
                const aby = b.y - a.y;
                const apx = p.x - a.x;
                const apy = p.y - a.y;
                const cross = abx * apy - aby * apx;
                side = cross >= 0 ? 1 : -1;
            }
        }
        return side;
    };

    const clusterStations = (
        stations: { station: number; crossing: boolean }[],
        thresholdPx: number
    ): { hasCrossing: boolean; station: number }[] => {
        if (stations.length === 0) return [];
        stations.sort((a, b) => a.station - b.station);
        const clusters: { hasCrossing: boolean; station: number }[] = [];
        let curStart = Number.NEGATIVE_INFINITY;
        let curHasCrossing = false;
        let curStation = 0;
        for (const s of stations) {
            if (curStart === Number.NEGATIVE_INFINITY) {
                curStart = s.station;
                curHasCrossing = s.crossing;
                curStation = s.station;
                continue;
            }
            const isWithin = s.station - curStart <= thresholdPx;
            const bothTee = !s.crossing && !curHasCrossing;
            if (isWithin && bothTee) {
                continue;
            }
            clusters.push({ hasCrossing: curHasCrossing, station: curStation });
            curStart = s.station;
            curHasCrossing = s.crossing;
            curStation = s.station;
        }
        if (curStart !== Number.NEGATIVE_INFINITY) {
            clusters.push({ hasCrossing: curHasCrossing, station: curStation });
        }
        return clusters;
    };

    const calculateGreenhouseFittings = (elements: IrrigationElement[]): FittingsBreakdown => {
        const mainPipes = elements.filter((e) => e.type === 'main-pipe');
        const subPipes = elements.filter((e) => e.type === 'sub-pipe');
        const dripLines = elements.filter((e) => e.type === 'drip-line');
        const sprinklers = elements.filter((e) => e.type === 'sprinkler');

        // Main 2-way: count pipe turns/angles as 2-way fittings (excluding pump connection)
        let twoWayMain = 0;
        mainPipes.forEach((pipe) => {
            // Count turns in main pipe (each turn is a 2-way fitting)
            // Exclude the first turn from pump to main pipe
            for (let i = 2; i < pipe.points.length - 1; i++) {
                const p1 = pipe.points[i - 1];
                const p2 = pipe.points[i];
                const p3 = pipe.points[i + 1];

                // Calculate angle between segments
                const angle1 = Math.atan2(p2.y - p1.y, p2.x - p1.x);
                const angle2 = Math.atan2(p3.y - p2.y, p3.x - p2.x);
                let angleDiff = Math.abs(angle2 - angle1);

                // Normalize angle to 0-π range
                if (angleDiff > Math.PI) {
                    angleDiff = 2 * Math.PI - angleDiff;
                }

                // If angle is significantly different from 180° (straight line), it's a turn
                // We want angles that are NOT close to 180° (straight line)
                const straightLineThreshold = Math.PI * 0.1; // 18 degrees - anything within this of 180° is considered straight
                const isStraightLine =
                    angleDiff < straightLineThreshold ||
                    angleDiff > Math.PI - straightLineThreshold;

                if (!isStraightLine) {
                    twoWayMain++;
                }
            }
        });

        let threeWayMain = 0; // junctions where sub connects to main
        let twoWayMainFromEndpoint = 0; // when sub connects at main endpoint
        let twoWaySub = 0; // greenhouse: end sprinklers on submain count as 2-way
        let threeWaySub = 0;
        let fourWaySub = 0;
        // Lateral fittings are not reported in greenhouse summary

        const attachTolPx = 12; // pixels
        const clusterTolPx = 8; // pixels

        // Count main–sub junctions on main: along-run → 3-way, at endpoint → 2-way
        subPipes.forEach((sp) => {
            const spts = sp.points;
            for (const mp of mainPipes) {
                // explicit intersections
                let found = false;
                for (let i = 1; i < spts.length && !found; i++) {
                    const sa = spts[i - 1];
                    const sb = spts[i];
                    for (let j = 1; j < mp.points.length && !found; j++) {
                        const ma = mp.points[j - 1];
                        const mb = mp.points[j];
                        const ip = segmentIntersection(sa, sb, ma, mb);
                        if (ip) {
                            const nearEnd =
                                distanceBetweenPoints(ip, mp.points[0]) <= attachTolPx ||
                                distanceBetweenPoints(ip, mp.points[mp.points.length - 1]) <=
                                    attachTolPx;
                            if (nearEnd) twoWayMainFromEndpoint += 1;
                            else threeWayMain += 1;
                            found = true;
                        }
                    }
                }
                if (found) break;
                // endpoint attachment proximity
                const endA = spts[0];
                const endB = spts[spts.length - 1];
                let attaches = false;
                let nearestAttachPoint: Point | null = null;
                for (let j = 1; j < mp.points.length; j++) {
                    const resA = closestPointOnLineSegment(endA, mp.points[j - 1], mp.points[j]);
                    const resB = closestPointOnLineSegment(endB, mp.points[j - 1], mp.points[j]);
                    const candidate = resA.distance <= resB.distance ? resA : resB;
                    if (resA.distance <= attachTolPx || resB.distance <= attachTolPx) {
                        attaches = true;
                        nearestAttachPoint = candidate.point;
                        break;
                    }
                }
                if (attaches) {
                    const nearEnd = nearestAttachPoint
                        ? distanceBetweenPoints(nearestAttachPoint, mp.points[0]) <= attachTolPx ||
                          distanceBetweenPoints(
                              nearestAttachPoint,
                              mp.points[mp.points.length - 1]
                          ) <= attachTolPx
                        : true;
                    if (nearEnd) twoWayMainFromEndpoint += 1;
                    else threeWayMain += 1;
                    break;
                }

                // Fallback: classify pass-through by endpoint sides relative to main
                try {
                    const s1 = sideOfPolyline(mp.points, spts[0]);
                    const s2 = sideOfPolyline(mp.points, spts[spts.length - 1]);
                    if (s1 * s2 < 0) {
                        threeWayMain += 1;
                        break;
                    }
                } catch {
                    // ignore side classification errors
                }
            }
        });

        // Submain vs drip-lines intersections → 3-way/4-way/2-way via clustering
        subPipes.forEach((sp) => {
            const stations: { station: number; crossing: boolean }[] = [];
            const sPoly = sp.points;
            if (sPoly.length < 2) return;

            dripLines.forEach((dl) => {
                const dPoly = dl.points;
                if (dPoly.length < 2) return;
                const intersections: Point[] = [];
                for (let i = 1; i < sPoly.length; i++) {
                    for (let j = 1; j < dPoly.length; j++) {
                        const ip = segmentIntersection(
                            sPoly[i - 1],
                            sPoly[i],
                            dPoly[j - 1],
                            dPoly[j]
                        );
                        if (ip) intersections.push(ip);
                    }
                }
                // Determine crossing by endpoints on opposite sides w.r.t sub
                const s1 = sideOfPolyline(sPoly, dPoly[0]);
                const s2 = sideOfPolyline(sPoly, dPoly[dPoly.length - 1]);
                const isCrossing = intersections.length >= 2 || s1 * s2 < 0;

                if (isCrossing && intersections.length === 0) {
                    // add mid representative point when touching
                    const mid = dPoly[Math.floor(dPoly.length / 2)];
                    stations.push({ station: stationAlongPolyline(sPoly, mid), crossing: true });
                }
                intersections.forEach((p) => {
                    stations.push({
                        station: stationAlongPolyline(sPoly, p),
                        crossing: isCrossing,
                    });
                });
            });

            // Sprinklers attached to sub → treat each as a tee (3-way on sub)
            sprinklers.forEach((spr) => {
                const p = spr.points[0];
                if (!p) return;
                // consider attached if close to sub-pipe
                for (let i = 1; i < sPoly.length; i++) {
                    const res = closestPointOnLineSegment(p, sPoly[i - 1], sPoly[i]);
                    if (res.distance <= attachTolPx) {
                        stations.push({
                            station: stationAlongPolyline(sPoly, res.point),
                            crossing: false,
                        });
                        break;
                    }
                }
            });

            const clusters = clusterStations(stations, clusterTolPx);
            clusters.forEach(({ hasCrossing }, idx) => {
                const isStart = idx === 0;
                const isEnd = idx === clusters.length - 1;
                if (hasCrossing) {
                    if (isStart || isEnd) threeWaySub += 1;
                    else fourWaySub += 1;
                } else {
                    // greenhouse rule update: non-crossing branches on submain
                    if (isEnd) {
                        // Only the true end of sub-pipe (furthest from main pipe) uses 2-way fittings
                        twoWaySub += 1;
                    } else {
                        // All other sprinklers (including start) use 3-way fittings (tees)
                        threeWaySub += 1;
                    }
                }
            });
        });

        return {
            twoWay: twoWayMain + twoWayMainFromEndpoint + twoWaySub,
            threeWay: threeWayMain + threeWaySub,
            fourWay: fourWaySub,
            breakdown: {
                main: {
                    twoWay: twoWayMain + twoWayMainFromEndpoint,
                    threeWay: threeWayMain,
                    fourWay: 0,
                },
                submain: { twoWay: twoWaySub, threeWay: threeWaySub, fourWay: fourWaySub },
                lateral: { twoWay: 0, threeWay: 0, fourWay: 0 },
            },
        };
    };

    const fittings = calculateGreenhouseFittings(summaryData?.irrigationElements || []);

    // Helper function to draw component shapes (irrigation equipment)
    const drawComponentShape = useCallback(
        (
            ctx: CanvasRenderingContext2D,
            type: string,
            point: Point,
            color: string,
            scale: number = 1
        ) => {
            if (componentImages[type]) {
                const img = componentImages[type];

                let imgSize, containerSize;
                if (type === 'pump') {
                    imgSize = 18 * scale;
                    containerSize = 24 * scale;
                } else if (type === 'water-tank') {
                    imgSize = 36 * scale;
                    containerSize = 28 * scale;
                } else if (type === 'fertilizer-machine') {
                    // Match map view visual size (≈52px normal)
                    imgSize = 52 * scale;
                    containerSize = 0; // no container for fertilizer icon on summary
                } else {
                    imgSize = 12 * scale;
                    containerSize = 18 * scale;
                }

                ctx.save();

                // Draw different container shapes for different components
                if (type === 'water-tank') {
                    // Draw rectangular container for water tank
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                    ctx.strokeStyle = '#666666';
                    ctx.lineWidth = 1.5 * scale;
                    ctx.fillRect(
                        point.x - containerSize / 2,
                        point.y - containerSize / 2,
                        containerSize,
                        containerSize
                    );
                    ctx.strokeRect(
                        point.x - containerSize / 2,
                        point.y - containerSize / 2,
                        containerSize,
                        containerSize
                    );
                } else if (type !== 'fertilizer-machine') {
                    // Draw circular container for other components except fertilizer-machine
                    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
                    ctx.strokeStyle = '#666666';
                    ctx.lineWidth = 1.5 * scale;
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, containerSize / 2, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.stroke();
                }

                ctx.drawImage(img, point.x - imgSize / 2, point.y - imgSize / 2, imgSize, imgSize);

                // Draw connection points for equipments
                if (type === 'fertilizer-machine') {
                    // Match map: left-right points ~30px from center
                    const dx = 30 * scale;
                    const left = { x: point.x - dx, y: point.y };
                    const right = { x: point.x + dx, y: point.y };
                    ctx.fillStyle = '#00FF00';
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 2 * scale;
                    ctx.beginPath();
                    ctx.arc(left.x, left.y, 6 * scale, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.stroke();
                    ctx.beginPath();
                    ctx.arc(right.x, right.y, 6 * scale, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.stroke();
                } else if (type === 'water-tank' || type === 'pump') {
                    // Single center connection point
                    ctx.fillStyle = '#00FF00';
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 2 * scale;
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, 6 * scale, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.stroke();
                }
                ctx.restore();
                return;
            }

            const size = 8 * scale;
            ctx.fillStyle = color;
            ctx.strokeStyle = color;
            ctx.lineWidth = 2 * scale;

            switch (type) {
                case 'pump':
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, size, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.stroke();
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 1.5 * scale;
                    for (let i = 0; i < 4; i++) {
                        const angle = (i * Math.PI) / 2;
                        const startX = point.x + Math.cos(angle) * (size * 0.3);
                        const startY = point.y + Math.sin(angle) * (size * 0.3);
                        const endX = point.x + Math.cos(angle) * (size * 0.7);
                        const endY = point.y + Math.sin(angle) * (size * 0.7);
                        ctx.beginPath();
                        ctx.moveTo(startX, startY);
                        ctx.lineTo(endX, endY);
                        ctx.stroke();
                    }
                    break;
                case 'solenoid-valve':
                    ctx.fillRect(point.x - size / 2, point.y - size / 2, size, size);
                    ctx.strokeRect(point.x - size / 2, point.y - size / 2, size, size);
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 1 * scale;
                    for (let i = 0; i < 3; i++) {
                        const y = point.y - size / 3 + (i * size) / 3;
                        ctx.beginPath();
                        ctx.moveTo(point.x - size / 3, y);
                        ctx.lineTo(point.x + size / 3, y);
                        ctx.stroke();
                    }
                    break;
                case 'ball-valve':
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, size, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.stroke();
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 2 * scale;
                    ctx.beginPath();
                    ctx.moveTo(point.x - size * 0.7, point.y);
                    ctx.lineTo(point.x + size * 0.7, point.y);
                    ctx.stroke();
                    break;
                case 'sprinkler':
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, size * 0.5, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 1 * scale;
                    for (let i = 0; i < 8; i++) {
                        const angle = (i * Math.PI) / 4;
                        const endX = point.x + Math.cos(angle) * (size * 1.5);
                        const endY = point.y + Math.sin(angle) * (size * 1.5);
                        ctx.beginPath();
                        ctx.moveTo(point.x, point.y);
                        ctx.lineTo(endX, endY);
                        ctx.stroke();
                    }
                    break;
                case 'water-tank':
                    // Draw water tank as cylinder
                    ctx.beginPath();
                    ctx.arc(point.x, point.y, size, 0, 2 * Math.PI);
                    ctx.fill();
                    ctx.stroke();

                    // Draw water level indicator
                    ctx.strokeStyle = '#0EA5E9';
                    ctx.lineWidth = 2 * scale;
                    for (let i = 0; i < 3; i++) {
                        const y = point.y - size * 0.3 + i * size * 0.3;
                        ctx.beginPath();
                        ctx.moveTo(point.x - size * 0.6, y);
                        ctx.lineTo(point.x + size * 0.6, y);
                        ctx.stroke();
                    }
                    break;
                case 'fertilizer-machine':
                    // Draw fertilizer machine as rounded rect
                    ctx.fillRect(point.x - size, point.y - size, size * 2, size * 2);
                    ctx.strokeRect(point.x - size, point.y - size, size * 2, size * 2);

                    // Draw fertilizer symbol
                    ctx.strokeStyle = '#FFFFFF';
                    ctx.lineWidth = 1 * scale;
                    ctx.beginPath();
                    ctx.moveTo(point.x - size * 0.5, point.y - size * 0.5);
                    ctx.lineTo(point.x + size * 0.5, point.y + size * 0.5);
                    ctx.moveTo(point.x + size * 0.5, point.y - size * 0.5);
                    ctx.lineTo(point.x - size * 0.5, point.y + size * 0.5);
                    ctx.stroke();
                    break;
            }
        },
        [componentImages]
    );

    // Helper function to draw drip points
    const drawDripPoints = (
        ctx: CanvasRenderingContext2D,
        element: IrrigationElement,
        scale: number = 1
    ) => {
        if (element.points.length < 2) return;

        const spacing = (element.spacing || 0.3) * 20 * scale;

        for (let i = 0; i < element.points.length - 1; i++) {
            const p1 = element.points[i];
            const p2 = element.points[i + 1];

            const distance = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
            if (distance === 0) continue;

            const direction = { x: (p2.x - p1.x) / distance, y: (p2.y - p1.y) / distance };

            let currentDistance = spacing;
            while (currentDistance < distance) {
                const dripPoint = {
                    x: p1.x + direction.x * currentDistance,
                    y: p1.y + direction.y * currentDistance,
                };

                // Draw white border for better visibility
                ctx.fillStyle = '#FFFFFF';
                ctx.beginPath();
                ctx.arc(dripPoint.x, dripPoint.y, 2.5 * scale, 0, 2 * Math.PI);
                ctx.fill();

                // Draw main drip point
                ctx.fillStyle = '#06B6D4';
                ctx.beginPath();
                ctx.arc(dripPoint.x, dripPoint.y, 1.5 * scale, 0, 2 * Math.PI);
                ctx.fill();

                currentDistance += spacing;
            }
        }
    };

    // Draw irrigation elements on canvas
    const drawIrrigationElements = useCallback(
        (
            ctx: CanvasRenderingContext2D,
            elements: IrrigationElement[],
            scale: number = 1,
            offsetX: number = 0,
            offsetY: number = 0
        ) => {
            // Ensure correct layering: pipes below, equipments above
            const getZIndex = (type: string): number => {
                if (type === 'main-pipe' || type === 'sub-pipe' || type === 'drip-line') return 0;
                if (type === 'water-tank' || type === 'pump' || type === 'fertilizer-machine')
                    return 2;
                return 1; // sprinklers/valves, etc.
            };
            const orderedElements = [...elements].sort(
                (a, b) => getZIndex(a.type) - getZIndex(b.type)
            );

            orderedElements.forEach((element) => {
                ctx.strokeStyle = element.color;
                ctx.lineWidth = (element.width || 2) * scale;
                ctx.setLineDash([]);

                if (element.type === 'main-pipe' || element.type === 'sub-pipe') {
                    if (element.points.length >= 2) {
                        ctx.beginPath();
                        ctx.moveTo(
                            element.points[0].x * scale + offsetX,
                            element.points[0].y * scale + offsetY
                        );

                        for (let i = 1; i < element.points.length; i++) {
                            ctx.lineTo(
                                element.points[i].x * scale + offsetX,
                                element.points[i].y * scale + offsetY
                            );
                        }

                        ctx.stroke();
                    }
                } else if (element.type === 'drip-line') {
                    if (element.points.length >= 2) {
                        ctx.setLineDash([5 * scale, 3 * scale]);
                        ctx.beginPath();
                        ctx.moveTo(
                            element.points[0].x * scale + offsetX,
                            element.points[0].y * scale + offsetY
                        );

                        for (let i = 1; i < element.points.length; i++) {
                            ctx.lineTo(
                                element.points[i].x * scale + offsetX,
                                element.points[i].y * scale + offsetY
                            );
                        }

                        ctx.stroke();
                        ctx.setLineDash([]);

                        const scaledElement = {
                            ...element,
                            points: element.points.map((p) => ({
                                x: p.x * scale + offsetX,
                                y: p.y * scale + offsetY,
                            })),
                        };
                        drawDripPoints(ctx, scaledElement, scale);
                    }
                } else if (element.type === 'sprinkler') {
                    if (element.points.length >= 1) {
                        const point = {
                            x: element.points[0].x * scale + offsetX,
                            y: element.points[0].y * scale + offsetY,
                        };

                        if (element.radius) {
                            ctx.strokeStyle = element.color + '40';
                            ctx.setLineDash([3 * scale, 2 * scale]);
                            ctx.beginPath();
                            ctx.arc(point.x, point.y, element.radius * scale, 0, 2 * Math.PI);
                            ctx.stroke();
                            ctx.setLineDash([]);
                        }

                        drawComponentShape(ctx, element.type, point, element.color, scale);
                    }
                } else {
                    if (element.points.length >= 1) {
                        const point = {
                            x: element.points[0].x * scale + offsetX,
                            y: element.points[0].y * scale + offsetY,
                        };
                        drawComponentShape(ctx, element.type, point, element.color, scale);

                        // Show capacity for water tanks
                        if (
                            element.type === 'water-tank' &&
                            typeof element.capacityLiters === 'number'
                        ) {
                            ctx.fillStyle = '#FFFFFF';
                            ctx.font = `${8 * scale}px sans-serif`;
                            ctx.textAlign = 'center';
                            ctx.fillText(
                                `${element.capacityLiters}L`,
                                point.x,
                                point.y + 20 * scale
                            );
                        }
                    }
                }
            });
        },
        [drawComponentShape]
    );

    // Print function for browser print dialog - available for future use
    const handlePrint = (): void => {
        window.print();
    };

    if (typeof window !== 'undefined') {
        (window as Window & { debugHandlePrint?: () => void }).debugHandlePrint = handlePrint;
    }

    // Update canvas when data changes
    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas && summaryData) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                canvas.width = 600;
                canvas.height = 400;

                ctx.fillStyle = '#000000';
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                let minX = Infinity,
                    minY = Infinity,
                    maxX = -Infinity,
                    maxY = -Infinity;

                if (summaryData.shapes && summaryData.shapes.length > 0) {
                    summaryData.shapes.forEach((shape) => {
                        shape.points.forEach((point) => {
                            minX = Math.min(minX, point.x);
                            minY = Math.min(minY, point.y);
                            maxX = Math.max(maxX, point.x);
                            maxY = Math.max(maxY, point.y);
                        });
                    });
                }

                if (summaryData.irrigationElements && summaryData.irrigationElements.length > 0) {
                    summaryData.irrigationElements.forEach((element) => {
                        element.points.forEach((point) => {
                            minX = Math.min(minX, point.x);
                            minY = Math.min(minY, point.y);
                            maxX = Math.max(maxX, point.x);
                            maxY = Math.max(maxY, point.y);
                        });
                    });
                }

                if (minX === Infinity) {
                    minX = 0;
                    minY = 0;
                    maxX = 1200;
                    maxY = 800;
                }

                const padding = 50;
                const contentWidth = maxX - minX;
                const contentHeight = maxY - minY;

                const scaleX = (canvas.width - 2 * padding) / contentWidth;
                const scaleY = (canvas.height - 2 * padding) / contentHeight;
                const scale = Math.min(scaleX, scaleY, 1);

                const scaledWidth = contentWidth * scale;
                const scaledHeight = contentHeight * scale;
                const offsetX = (canvas.width - scaledWidth) / 2 - minX * scale;
                const offsetY = (canvas.height - scaledHeight) / 2 - minY * scale;

                if (summaryData.shapes && summaryData.shapes.length > 0) {
                    summaryData.shapes.forEach((shape) => {
                        if (shape.points.length < 2) return;

                        if (shape.type === 'measurement') {
                            if (shape.points.length >= 2) {
                                const [start, end] = shape.points;
                                ctx.strokeStyle = shape.color;
                                ctx.lineWidth = 2;
                                ctx.setLineDash([8, 4]);
                                ctx.beginPath();
                                ctx.moveTo(start.x * scale + offsetX, start.y * scale + offsetY);
                                ctx.lineTo(end.x * scale + offsetX, end.y * scale + offsetY);
                                ctx.stroke();
                                ctx.setLineDash([]);
                                if (shape.measurement) {
                                    const midX = ((start.x + end.x) / 2) * scale + offsetX;
                                    const midY = ((start.y + end.y) / 2) * scale + offsetY;
                                    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
                                    ctx.fillRect(midX - 15, midY - 10, 30, 15);
                                    ctx.fillStyle = '#FFFFFF';
                                    ctx.font = 'bold 8px Arial';
                                    ctx.textAlign = 'center';
                                    ctx.fillText(
                                        `${shape.measurement.distance}${shape.measurement.unit}`,
                                        midX,
                                        midY
                                    );
                                }
                            }
                            return;
                        }

                        if (shape.type === 'water-source') {
                            if (shape.points.length === 1) {
                                const point = shape.points[0];
                                const scaledX = point.x * scale + offsetX;
                                const scaledY = point.y * scale + offsetY;
                                ctx.fillStyle = shape.fillColor;
                                ctx.strokeStyle = shape.color;
                                ctx.lineWidth = 2;
                                ctx.beginPath();
                                ctx.arc(scaledX, scaledY, 8 * scale, 0, 2 * Math.PI);
                                ctx.fill();
                                ctx.stroke();
                                ctx.fillStyle = '#FFFFFF';
                                ctx.font = `${10 * scale}px Arial`;
                                ctx.textAlign = 'center';
                                ctx.fillText('💧', scaledX, scaledY + 3);
                            } else {
                                ctx.strokeStyle = shape.color;
                                ctx.fillStyle = shape.fillColor;
                                ctx.lineWidth = 2;
                                ctx.beginPath();
                                ctx.moveTo(
                                    shape.points[0].x * scale + offsetX,
                                    shape.points[0].y * scale + offsetY
                                );
                                for (let i = 1; i < shape.points.length; i++) {
                                    ctx.lineTo(
                                        shape.points[i].x * scale + offsetX,
                                        shape.points[i].y * scale + offsetY
                                    );
                                }
                                if (shape.points.length > 2) {
                                    ctx.closePath();
                                    ctx.fill();
                                }
                                ctx.stroke();
                            }
                            return;
                        }

                        // Skip legacy fertilizer-machine polygon/shape; this component is drawn from irrigationElements
                        if ((shape as unknown as { type?: string }).type === 'fertilizer-machine') {
                            return;
                        }

                        ctx.strokeStyle = shape.color;
                        ctx.fillStyle = shape.fillColor;
                        ctx.lineWidth = 2;
                        ctx.beginPath();
                        ctx.moveTo(
                            shape.points[0].x * scale + offsetX,
                            shape.points[0].y * scale + offsetY
                        );
                        for (let i = 1; i < shape.points.length; i++) {
                            ctx.lineTo(
                                shape.points[i].x * scale + offsetX,
                                shape.points[i].y * scale + offsetY
                            );
                        }
                        if (shape.points.length > 2) {
                            ctx.closePath();
                            ctx.fill();
                        }
                        ctx.stroke();
                    });
                }

                if (summaryData.irrigationElements && summaryData.irrigationElements.length > 0) {
                    drawIrrigationElements(
                        ctx,
                        summaryData.irrigationElements,
                        scale,
                        offsetX,
                        offsetY
                    );
                }
            }
        }
    }, [summaryData, componentImages, drawIrrigationElements]);

    if (!summaryData) {
        return (
            <div className="min-h-screen bg-gray-900 text-white">
                <Head title={t('Greenhouse Summary - Growing System Planning')} />

                {/* Add Navbar at the top - fixed position */}
                <div className="fixed left-0 right-0 top-0 z-50">
                    <Navbar />
                </div>

                {/* Add padding top to account for fixed navbar */}
                <div className="pt-16"></div>

                <div className="border-b border-gray-700 bg-gray-800">
                    <div className="mx-auto px-4 py-6">
                        <div className="mx-auto">
                            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                                <div className="flex-1">
                                    <button
                                        onClick={handleBackNavigation}
                                        className="mb-4 inline-flex cursor-pointer items-center border-none bg-transparent text-blue-400 hover:text-blue-300"
                                    >
                                        <svg
                                            className="mr-2 h-5 w-5"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M10 19l-7-7m0 0l7-7m-7 7h18"
                                            />
                                        </svg>
                                        {t('Back to Greenhouse Map')}
                                    </button>
                                    <h1 className="mb-2 text-4xl font-bold">
                                        🏠 {t('Greenhouse Summary')}
                                    </h1>
                                    <p className="mb-6 text-gray-400">
                                        {t(
                                            'Complete overview of your greenhouse system planning project'
                                        )}
                                    </p>
                                </div>

                                <div className="flex-shrink-0">
                                    <button
                                        onClick={handleCalculateEquipment}
                                        className="inline-flex transform items-center rounded-lg bg-gradient-to-r from-purple-600 to-blue-600 px-6 py-3 font-semibold text-white transition-all duration-200 hover:scale-105 hover:from-purple-700 hover:to-blue-700 hover:shadow-lg"
                                    >
                                        <svg
                                            className="mr-2 h-5 w-5"
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                        >
                                            <path
                                                strokeLinecap="round"
                                                strokeLinejoin="round"
                                                strokeWidth={2}
                                                d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 002 2z"
                                            />
                                        </svg>
                                        🧮 {t('คำนวณอุปกรณ์')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mx-auto px-4 py-6">
                    <div className="mx-auto">
                        <div className="rounded-lg bg-gray-800 p-8 text-center">
                            <div className="mb-4 text-6xl">🏠</div>
                            <h2 className="mb-4 text-2xl font-bold text-yellow-400">
                                {t('No Greenhouse Data Found')}
                            </h2>
                            <p className="mb-6 text-gray-400">
                                {t(
                                    "It looks like you haven't completed a greenhouse planning project yet, or the data has been cleared."
                                )}
                            </p>
                            <div className="space-y-4">
                                <p className="text-gray-300">{t('To view a summary, please:')}</p>
                                <ol className="mx-auto max-w-md space-y-2 text-left text-gray-300">
                                    <li className="flex items-start">
                                        <span className="mr-2 text-blue-400">1.</span>
                                        {t('Go to the Greenhouse planning page')}
                                    </li>
                                    <li className="flex items-start">
                                        <span className="mr-2 text-blue-400">2.</span>
                                        {t('Complete the greenhouse design process')}
                                    </li>
                                    <li className="flex items-start">
                                        <span className="mr-2 text-blue-400">3.</span>
                                        {t('Click the "View Summary" button that appears')}
                                    </li>
                                </ol>
                            </div>
                            <div className="mt-8">
                                <button
                                    onClick={() => (window.location.href = '/greenhouse-crop')}
                                    className="inline-flex items-center rounded-lg bg-blue-600 px-6 py-3 text-white transition-colors hover:bg-blue-700"
                                >
                                    🏠 {t('เริ่มโครงการใหม่')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-900 text-white print:bg-white print:text-black">
            <Head title={t('Greenhouse Summary - Growing System Planning')} />

            {/* Add Navbar at the top - fixed position, hidden in print */}
            <div className="fixed left-0 right-0 top-0 z-50 print:hidden">
                <Navbar />
            </div>

            {/* Add padding top to account for fixed navbar */}
            <div className="pt-16 print:pt-0"></div>

            {/* Enhanced Header Section with Action Buttons */}
            <div className="border-b border-gray-700 bg-gray-800 print:hidden print:border-gray-300 print:bg-white">
                <div className="mx-auto px-4 py-4">
                    <div className="mx-auto">
                        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div className="flex-1">
                                <button
                                    onClick={handleBackNavigation}
                                    className="mb-2 inline-flex cursor-pointer items-center border-none bg-transparent text-blue-400 hover:text-blue-300"
                                >
                                    <svg
                                        className="mr-2 h-5 w-5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M10 19l-7-7m0 0l7-7m-7 7h18"
                                        />
                                    </svg>
                                    {t('Back to Greenhouse Map')}
                                </button>

                                <h1 className="mb-1 text-3xl font-bold">
                                    🏠 {t('สรุปการวางแผนโรงเรือน')}
                                </h1>
                                <p className="mb-4 text-gray-400">
                                    {t('ภาพรวมการออกแบบโรงเรือนและระบบการให้น้ำ')}
                                </p>
                            </div>

                            {/* Enhanced Action Buttons Section */}
                            <div className="flex flex-col gap-3 sm:flex-row">
                                {/* Save Project Button */}
                                <button
                                    onClick={handleSaveToDatabase}
                                    disabled={savingToDatabase}
                                    className="inline-flex items-center rounded-lg bg-purple-600 px-6 py-3 font-semibold text-white transition-all duration-200 hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {savingToDatabase ? (
                                        <>
                                            <svg
                                                className="mr-2 h-4 w-4 animate-spin"
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
                                            {t('กำลังบันทึก...')}
                                        </>
                                    ) : (
                                        <>
                                            <svg
                                                className="mr-2 h-5 w-5"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                                                />
                                            </svg>
                                            💾 {t('บันทึกโครงการ')}
                                        </>
                                    )}
                                </button>

                                {/* New Project Button */}
                                <button
                                    onClick={handleNewProject}
                                    disabled={isCreatingNewProject}
                                    className="inline-flex items-center rounded-lg bg-green-600 px-6 py-3 font-semibold text-white transition-all duration-200 hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-50"
                                >
                                    {isCreatingNewProject ? (
                                        <>
                                            <svg
                                                className="mr-2 h-4 w-4 animate-spin"
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
                                            {t('กำลังสร้าง...')}
                                        </>
                                    ) : (
                                        <>
                                            <svg
                                                className="mr-2 h-5 w-5"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                            >
                                                <path
                                                    strokeLinecap="round"
                                                    strokeLinejoin="round"
                                                    strokeWidth={2}
                                                    d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                                                />
                                            </svg>
                                            ➕ {t('โครงการใหม่')}
                                        </>
                                    )}
                                </button>

                                {/* Calculate Equipment Button */}
                                <button
                                    onClick={handleCalculateEquipment}
                                    className="inline-flex items-center rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white transition-all duration-200 hover:bg-blue-700"
                                >
                                    <svg
                                        className="mr-2 h-5 w-5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 002 2z"
                                        />
                                    </svg>
                                    🧮 {t('คำนวณอุปกรณ์')}
                                </button>
                            </div>
                        </div>

                        {/* Status Messages */}
                        {saveSuccess && (
                            <div className="mt-4 rounded-lg bg-green-800 p-3 text-green-100">
                                ✅ {t('บันทึกโครงการสำเร็จแล้ว!')}
                            </div>
                        )}

                        {saveError && (
                            <div className="mt-4 rounded-lg bg-red-800 p-3 text-red-100">
                                ❌ {t('เกิดข้อผิดพลาด')}: {saveError}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="hidden print:mb-6 print:block">
                <h1 className="text-2xl font-bold text-black">🏠 {t('สรุปการวางแผนโรงเรือน')}</h1>
                <p className="text-gray-600">{t('ภาพรวมการออกแบบโรงเรือนและระบบการให้น้ำ')}</p>
                <hr className="my-2 border-gray-300" />
                <p className="text-sm text-gray-500">
                    {t('วันที่')}: {new Date().toLocaleDateString('th-TH')}
                </p>
            </div>

            {/* Rest of the existing content remains the same... */}
            <div className="mx-auto px-4 py-4 print:px-0 print:py-0">
                <div className="mx-auto">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 print:grid-cols-1 print:gap-4">
                        <div className="print:page-break-after-avoid space-y-4 print:space-y-4">
                            <div className="rounded-lg bg-gray-800 p-4 print:border print:border-gray-300 print:bg-white print:p-4">
                                <h2 className="mb-3 text-lg font-bold text-green-400 print:text-lg print:text-black">
                                    🏠 {t('ภาพรวมโครงการ')}
                                </h2>
                                <div className="grid grid-cols-3 gap-2 print:grid-cols-3 print:gap-3">
                                    <div className="rounded-lg bg-gray-700 p-2 text-center print:border print:border-gray-200 print:bg-gray-50 print:p-3">
                                        <div className="text-lg font-bold text-blue-400 print:text-lg print:text-black">
                                            {metrics.shapeTypeCount}
                                        </div>
                                        <div className="text-xs text-gray-400 print:text-sm print:text-gray-600">
                                            {t('ชนิดพื้นที่')}
                                        </div>
                                    </div>
                                    <div className="rounded-lg bg-gray-700 p-2 text-center print:border print:border-gray-200 print:bg-gray-50 print:p-3">
                                        <div className="text-lg font-bold text-green-400 print:text-lg print:text-black">
                                            {metrics.greenhouseArea.toFixed(1)}
                                        </div>
                                        <div className="text-xs text-gray-400 print:text-sm print:text-gray-600">
                                            {t('พื้นที่โรงเรือน (ตร.ม.)')}
                                        </div>
                                    </div>
                                    <div className="rounded-lg bg-gray-700 p-2 text-center print:border print:border-gray-200 print:bg-gray-50 print:p-3">
                                        <div className="text-lg font-bold text-purple-400 print:text-lg print:text-black">
                                            {metrics.plotArea.toFixed(1)}
                                        </div>
                                        <div className="text-xs text-gray-400 print:text-sm print:text-gray-600">
                                            {t('พื้นที่แปลงปลูก (ตร.ม.)')}
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-3 grid grid-cols-3 gap-2 print:mt-4 print:grid-cols-3 print:gap-3">
                                    <div className="rounded-lg bg-gray-700 p-2 text-center print:border print:border-gray-200 print:bg-gray-50 print:p-3">
                                        <div className="text-lg font-bold text-orange-400 print:text-lg print:text-black">
                                            {metrics.plotCount}
                                        </div>
                                        <div className="text-xs text-gray-400 print:text-sm print:text-gray-600">
                                            {t('จำนวนแปลงปลูก')}
                                        </div>
                                    </div>
                                    <div className="rounded-lg bg-gray-700 p-2 text-center print:border print:border-gray-200 print:bg-gray-50 print:p-3">
                                        <div className="text-lg font-bold text-cyan-400 print:text-lg print:text-black">
                                            {metrics.waterSourceCount}
                                        </div>
                                        <div className="text-xs text-gray-400 print:text-sm print:text-gray-600">
                                            {t('จำนวนแหล่งน้ำ')}
                                        </div>
                                    </div>
                                    <div className="rounded-lg bg-gray-700 p-2 text-center print:border print:border-gray-200 print:bg-gray-50 print:p-3">
                                        <div className="text-lg font-bold text-pink-400 print:text-lg print:text-black">
                                            {metrics.walkwayArea.toFixed(1)}
                                        </div>
                                        <div className="text-xs text-gray-400 print:text-sm print:text-gray-600">
                                            {t('พื้นที่ทางเดิน (ตร.ม.)')}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-lg bg-gray-800 p-4 print:border print:border-gray-300 print:bg-white print:p-4">
                                <h2 className="mb-3 text-lg font-bold text-blue-400 print:text-lg print:text-black">
                                    📋 {t('วิธีการวางแผน')}
                                </h2>
                                <div className="space-y-2 print:space-y-3">
                                    <div className="rounded-lg bg-gray-700 p-2 print:border print:border-gray-200 print:bg-gray-50 print:p-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-400 print:text-sm print:text-gray-600">
                                                {t('วิธีการออกแบบ')}
                                            </span>
                                            <span className="text-sm font-bold text-orange-400 print:text-sm print:text-black">
                                                {summaryData?.planningMethod === 'draw'
                                                    ? `✏️ ${t('วาดพื้นที่เอง')}`
                                                    : `📁 ${t('นำเข้าไฟล์แบบแปลน')}`}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="rounded-lg bg-gray-700 p-2 print:border print:border-gray-200 print:bg-gray-50 print:p-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-400 print:text-sm print:text-gray-600">
                                                {t('ระบบการให้น้ำ')}
                                            </span>
                                            <span className="text-sm font-bold text-cyan-400 print:text-sm print:text-black">
                                                {summaryData?.irrigationMethod === 'mini-sprinkler'
                                                    ? `💧 ${t('มินิสปริงเกลอร์')}`
                                                    : summaryData?.irrigationMethod === 'drip'
                                                      ? `💧🌱 ${t('น้ำหยด')}`
                                                      : `🔄 ${t('แบบผสม')}`}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="rounded-lg bg-gray-700 p-2 print:border print:border-gray-200 print:bg-gray-50 print:p-3">
                                        <div className="flex items-center justify-between">
                                            <span className="text-sm text-gray-400 print:text-sm print:text-gray-600">
                                                {t('วันที่สร้าง')}
                                            </span>
                                            <span className="text-sm font-bold text-purple-400 print:text-sm print:text-black">
                                                {summaryData?.createdAt
                                                    ? new Date(
                                                          summaryData.createdAt
                                                      ).toLocaleDateString('th-TH')
                                                    : t('วันนี้')}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-lg bg-gray-800 p-4 print:border print:border-gray-300 print:bg-white print:p-4">
                                <button
                                    onClick={() => toggleSection('pipeFlowRates')}
                                    className="mb-3 flex w-full items-center justify-between text-left"
                                >
                                    <h2 className="text-lg font-bold text-purple-400 print:text-lg print:text-black">
                                        💧 {t('สรุปอัตราการไหลของท่อ')}
                                    </h2>
                                    <svg
                                        className={`h-5 w-5 transform transition-transform ${
                                            expandedSections.pipeFlowRates ? 'rotate-180' : ''
                                        }`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M19 9l-7 7-7-7"
                                        />
                                    </svg>
                                </button>

                                {expandedSections.pipeFlowRates && (
                                    <div className="mb-4 space-y-3">
                                        {/* Pipe Counts */}
                                        <div className="grid grid-cols-2 gap-2 print:gap-3">
                                            <div className="rounded bg-gray-700 p-2 text-center print:border print:border-gray-200 print:bg-gray-50 print:p-3">
                                                <div className="text-sm font-bold text-blue-400 print:text-sm print:text-black">
                                                    {pipeFlowData.mainPipeCount}
                                                </div>
                                                <div className="text-xs text-gray-400 print:text-xs print:text-gray-600">
                                                    {t('จำนวนท่อเมน')}
                                                </div>
                                            </div>
                                            <div className="rounded bg-gray-700 p-2 text-center print:border print:border-gray-200 print:bg-gray-50 print:p-3">
                                                <div className="text-sm font-bold text-green-400 print:text-sm print:text-black">
                                                    {pipeFlowData.subPipeCount}
                                                </div>
                                                <div className="text-xs text-gray-400 print:text-xs print:text-gray-600">
                                                    {t('จำนวนท่อเมนย่อย')}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 gap-2 print:gap-3">
                                            <div className="rounded bg-gray-700 p-2 text-center print:border print:border-gray-200 print:bg-gray-50 print:p-3">
                                                <div className="text-sm font-bold text-purple-400 print:text-sm print:text-black">
                                                    {pipeFlowData.longest.sub.emitters}
                                                </div>
                                                <div className="text-xs text-gray-400 print:text-xs print:text-gray-600">
                                                    {t(
                                                        'จำนวนสปริงเกลอร์และจุดน้ำหยดในท่อย่อยที่ยาวที่สุด'
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Main and Sub Pipe Flow Rate and Outlet Count Table (Longest lines only) */}
                                        <div className="rounded bg-gray-700 p-3 print:border print:border-gray-200 print:bg-gray-50 print:p-3">
                                            <h4 className="mb-2 text-sm font-semibold text-cyan-400 print:text-sm print:text-black">
                                                {t(
                                                    'อัตราการไหลและจำนวนทางออกของท่อเมนและท่อเมนย่อย'
                                                )}
                                            </h4>
                                            <div className="overflow-x-auto">
                                                <table className="w-full border-collapse border border-gray-600/50 print:border-gray-300">
                                                    <thead>
                                                        <tr className="bg-gray-800/50 print:bg-gray-100">
                                                            <th className="border border-gray-600/50 px-2 py-1 text-left text-xs font-semibold text-gray-200 print:border-gray-300 print:text-gray-800">
                                                                {t('ประเภทท่อ')}
                                                            </th>
                                                            <th className="border border-gray-600/50 px-2 py-1 text-left text-xs font-semibold text-gray-200 print:border-gray-300 print:text-gray-800">
                                                                {t('อัตราการไหล')}
                                                            </th>
                                                            <th className="border border-gray-600/50 px-2 py-1 text-left text-xs font-semibold text-gray-200 print:border-gray-300 print:text-gray-800">
                                                                {t('จำนวนทางออก')}
                                                            </th>
                                                        </tr>
                                                    </thead>
                                                    <tbody className="text-gray-100 print:text-gray-700">
                                                        <tr>
                                                            <td className="border border-gray-600/50 px-2 py-1 text-xs print:border-gray-300">
                                                                {t('ท่อเมน')}
                                                            </td>
                                                            <td className="border border-gray-600/50 px-2 py-1 text-xs font-bold text-blue-400 print:border-gray-300">
                                                                {pipeFlowData.longest.main.flowRate.toFixed(
                                                                    2
                                                                )}{' '}
                                                                {t('L/min')}
                                                            </td>
                                                            <td className="border border-gray-600/50 px-2 py-1 text-xs font-bold text-blue-400 print:border-gray-300">
                                                                {
                                                                    pipeFlowData.longest.main
                                                                        .connections
                                                                }
                                                            </td>
                                                        </tr>
                                                        <tr>
                                                            <td className="border border-gray-600/50 px-2 py-1 text-xs print:border-gray-300">
                                                                {t('ท่อเมนย่อย')}
                                                            </td>
                                                            <td className="border border-gray-600/50 px-2 py-1 text-xs font-bold text-green-400 print:border-gray-300">
                                                                {pipeFlowData.longest.sub.flowRate.toFixed(
                                                                    2
                                                                )}{' '}
                                                                {t('L/min')}
                                                            </td>
                                                            <td className="border border-gray-600/50 px-2 py-1 text-xs font-bold text-green-400 print:border-gray-300">
                                                                {pipeFlowData.longest.sub.emitters}
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>

                                        {/* Flow Rate Breakdown */}
                                        <div className="rounded bg-gray-700 p-3 print:border print:border-gray-200 print:bg-gray-50 print:p-3">
                                            <h4 className="mb-2 text-sm font-semibold text-cyan-400 print:text-sm print:text-black">
                                                {t('อัตราการไหลของแต่ละระดับท่อ')}
                                            </h4>
                                            {/* Emitter Flow Rates */}
                                            <div className="mb-3 space-y-2 text-xs">
                                                {(() => {
                                                    const elements =
                                                        summaryData?.irrigationElements || [];
                                                    // const sprinklers = elements.filter((e) => e.type === 'sprinkler');
                                                    const dripLines = elements.filter(
                                                        (e) => e.type === 'drip-line'
                                                    );

                                                    let totalDripEmitters = 0;
                                                    dripLines.forEach((dripLine) => {
                                                        if (
                                                            dripLine.points.length > 1 &&
                                                            dripLine.spacing
                                                        ) {
                                                            let totalLength = 0;
                                                            for (
                                                                let i = 0;
                                                                i < dripLine.points.length - 1;
                                                                i++
                                                            ) {
                                                                const p1 = dripLine.points[i];
                                                                const p2 = dripLine.points[i + 1];
                                                                const segmentLength =
                                                                    Math.sqrt(
                                                                        Math.pow(p2.x - p1.x, 2) +
                                                                            Math.pow(p2.y - p1.y, 2)
                                                                    ) / 25;
                                                                totalLength += segmentLength;
                                                            }
                                                            if (
                                                                totalLength > 0 &&
                                                                dripLine.spacing > 0
                                                            ) {
                                                                const emittersInThisLine =
                                                                    Math.floor(
                                                                        totalLength /
                                                                            dripLine.spacing
                                                                    ) + 1;
                                                                totalDripEmitters +=
                                                                    emittersInThisLine;
                                                            }
                                                        }
                                                    });

                                                    // นับสปริงเกลอร์ทั้งหมดโดยตรงจาก irrigationElements
                                                    const totalSprinklers = elements.filter(
                                                        (e) => e.type === 'sprinkler'
                                                    ).length;
                                                    const sprinklerFlowRate =
                                                        summaryData?.sprinklerFlowRate || 10;
                                                    const dripEmitterFlowRate =
                                                        summaryData?.dripEmitterFlowRate || 0.24;
                                                    const totalSprinklerFlowRate =
                                                        totalSprinklers * sprinklerFlowRate;
                                                    const totalDripEmitterFlowRate =
                                                        totalDripEmitters * dripEmitterFlowRate;

                                                    return (
                                                        <>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-gray-300">
                                                                    {t('สปริงเกลอร์ทั้งหมด')} (
                                                                    {totalSprinklers} {t('ตัว')})
                                                                </span>
                                                                <span className="font-bold text-blue-400">
                                                                    {totalSprinklerFlowRate.toFixed(
                                                                        2
                                                                    )}{' '}
                                                                    {t('ลิตร/นาที')}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-gray-300">
                                                                    {t('หัวน้ำหยดทั้งหมด')} (
                                                                    {totalDripEmitters} {t('ตัว')})
                                                                </span>
                                                                <span className="font-bold text-cyan-400">
                                                                    {totalDripEmitterFlowRate.toFixed(
                                                                        2
                                                                    )}{' '}
                                                                    {t('ลิตร/นาที')}
                                                                </span>
                                                            </div>
                                                        </>
                                                    );
                                                })()}
                                            </div>
                                            {/* Pipe Flow Rates */}{' '}
                                            <div className="space-y-2 text-xs">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-300">
                                                        {t(
                                                            'ท่อเมนย่อย 1 เส้น (จากสปริงเกลอร์และจุดน้ำหยด)'
                                                        )}
                                                    </span>
                                                    <span className="font-bold text-green-400">
                                                        {pipeFlowData.subPipeFlowRate.toFixed(2)}{' '}
                                                        {t('ลิตร/นาที')}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-300">
                                                        {t('ท่อเมน (จากท่อเมนย่อยทั้งหมด)')}
                                                    </span>
                                                    <span className="font-bold text-blue-400">
                                                        {pipeFlowData.mainPipeFlowRate.toFixed(2)}{' '}
                                                        {t('ลิตร/นาที')}
                                                    </span>
                                                </div>
                                            </div>
                                            {/* Equipment Settings */}
                                            <div className="mt-3 border-t border-gray-600 pt-2">
                                                <h5 className="mb-1 text-xs font-semibold text-yellow-400">
                                                    {t('การตั้งค่าอุปกรณ์')}
                                                </h5>
                                                <div className="space-y-1 text-xs">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-gray-300">
                                                            {t('ระบบที่เลือก')}:
                                                        </span>
                                                        <span className="font-bold text-blue-400">
                                                            {summaryData?.irrigationMethod ===
                                                            'mini-sprinkler'
                                                                ? t('สปริงเกลอร์')
                                                                : summaryData?.irrigationMethod ===
                                                                    'drip'
                                                                  ? t('เทปน้ำหยด')
                                                                  : t('แบบผสม')}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-gray-300">
                                                            {t('อัตราการไหล')}:
                                                        </span>
                                                        <span className="font-bold text-green-400">
                                                            {summaryData?.irrigationMethod ===
                                                            'drip'
                                                                ? `${(summaryData?.dripEmitterFlowRate || 0.24).toFixed(2)} ${t('ลิตร/นาที')}`
                                                                : `${(summaryData?.sprinklerFlowRate || 10).toFixed(2)} ${t('ลิตร/นาที')}`}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-gray-300">
                                                            {t('แรงดัน')}:
                                                        </span>
                                                        <span className="font-bold text-purple-400">
                                                            {summaryData?.irrigationMethod ===
                                                            'drip'
                                                                ? `${(summaryData?.dripPressure || 1.0).toFixed(1)} ${t('บาร์')}`
                                                                : `${(summaryData?.sprinklerPressure || 2.0).toFixed(1)} ${t('บาร์')}`}
                                                        </span>
                                                    </div>
                                                    {summaryData?.irrigationMethod ===
                                                        'mini-sprinkler' && (
                                                        <div className="flex items-center justify-between">
                                                            <span className="text-gray-300">
                                                                {t('รัศมีสปริงเกลอร์')}:
                                                            </span>
                                                            <span className="font-bold text-orange-400">
                                                                {summaryData?.sprinklerRadius
                                                                    ? `${summaryData.sprinklerRadius.toFixed(1)} ${t('เมตร')}`
                                                                    : '1.5 เมตร'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Total Flow Rate */}
                                        <div className="grid grid-cols-1 gap-2 print:gap-3">
                                            <div className="rounded bg-gray-700 p-2 text-center print:border print:border-gray-200 print:bg-gray-50 print:p-3">
                                                <div className="text-sm font-bold text-cyan-400 print:text-sm print:text-black">
                                                    {pipeFlowData.totalFlowRate.toFixed(2)}{' '}
                                                    {t('ลิตร/นาที')}
                                                </div>
                                                <div className="text-xs text-gray-400 print:text-xs print:text-gray-600">
                                                    {t('อัตราการไหลรวมทั้งหมด')}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <button
                                    onClick={() => toggleSection('irrigationEquipment')}
                                    className="mb-3 flex w-full items-center justify-between text-left"
                                >
                                    <h3 className="text-lg font-bold text-purple-400 print:text-lg print:text-black">
                                        ⚙️ {t('สรุปอุปกรณ์การให้น้ำ')}
                                    </h3>
                                    <svg
                                        className={`h-5 w-5 transform transition-transform ${
                                            expandedSections.irrigationEquipment ? 'rotate-180' : ''
                                        }`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M19 9l-7 7-7-7"
                                        />
                                    </svg>
                                </button>

                                {expandedSections.irrigationEquipment && (
                                    <div className="mb-3">
                                        {/* Fittings section (2-way / 3-way / 4-way) */}
                                        <h3 className="mb-2 text-sm font-semibold text-rose-400 print:text-sm print:text-black">
                                            🔩 {t('Fittings (2-way / 3-way / 4-way)')}
                                        </h3>
                                        <div className="grid grid-cols-3 gap-1">
                                            <div className="rounded bg-gray-700 p-2 text-center print:border print:bg-gray-50">
                                                <div className="text-sm font-bold text-rose-400">
                                                    {fittings.twoWay}
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    {t('2-way')}
                                                </div>
                                            </div>
                                            <div className="rounded bg-gray-700 p-2 text-center print:border print:bg-gray-50">
                                                <div className="text-sm font-bold text-rose-400">
                                                    {fittings.threeWay}
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    {t('3-way')}
                                                </div>
                                            </div>
                                            <div className="rounded bg-gray-700 p-2 text-center print:border print:bg-gray-50">
                                                <div className="text-sm font-bold text-rose-400">
                                                    {fittings.fourWay}
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                    {t('4-way')}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-2 grid grid-cols-2 gap-1 text-xs">
                                            <div className="rounded bg-gray-700 p-2 print:border print:bg-gray-50">
                                                <div className="mb-1 font-semibold text-blue-300">
                                                    {t('Main')}
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-300">
                                                        {t('2-way')}
                                                    </span>
                                                    <span className="font-bold text-blue-300">
                                                        {fittings.breakdown.main.twoWay}
                                                    </span>
                                                </div>
                                                <div className="mt-1 flex items-center justify-between">
                                                    <span className="text-gray-300">
                                                        {t('3-way')}
                                                    </span>
                                                    <span className="font-bold text-blue-300">
                                                        {fittings.breakdown.main.threeWay}
                                                    </span>
                                                </div>
                                            </div>
                                            <div className="rounded bg-gray-700 p-2 print:border print:bg-gray-50">
                                                <div className="mb-1 font-semibold text-green-300">
                                                    {t('Submain')}
                                                </div>
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-300">
                                                        {t('2-way')}
                                                    </span>
                                                    <span className="font-bold text-green-300">
                                                        {fittings.breakdown.submain.twoWay}
                                                    </span>
                                                </div>
                                                <div className="mt-1 flex items-center justify-between">
                                                    <span className="text-gray-300">
                                                        {t('3-way')}
                                                    </span>
                                                    <span className="font-bold text-green-300">
                                                        {fittings.breakdown.submain.threeWay}
                                                    </span>
                                                </div>
                                                <div className="mt-1 flex items-center justify-between">
                                                    <span className="text-gray-300">
                                                        {t('4-way')}
                                                    </span>
                                                    <span className="font-bold text-green-300">
                                                        {fittings.breakdown.submain.fourWay}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                                {expandedSections.irrigationEquipment && (
                                    <>
                                        <h3 className="mb-2 text-sm font-semibold text-orange-400 print:text-sm print:text-black">
                                            🔵 {t('ระบบท่อ')}
                                        </h3>
                                        {/* First row: Max pipe lengths */}
                                        <div className="mb-2 grid grid-cols-3 gap-1 print:gap-2">
                                            <div className="rounded bg-gray-700 p-2 text-center print:border print:border-gray-200 print:bg-gray-50 print:p-3">
                                                <div className="text-sm font-bold text-blue-400 print:text-sm print:text-black">
                                                    {irrigationMetrics.maxMainPipeLength.toFixed(1)}{' '}
                                                    {t('เมตร')}
                                                </div>
                                                <div className="text-xs text-gray-400 print:text-xs print:text-gray-600">
                                                    {t('ท่อเมนสูงสุด')}
                                                </div>
                                            </div>
                                            <div className="rounded bg-gray-700 p-2 text-center print:border print:border-gray-200 print:bg-gray-50 print:p-3">
                                                <div className="text-sm font-bold text-green-400 print:text-sm print:text-black">
                                                    {irrigationMetrics.maxSubPipeLength.toFixed(1)}{' '}
                                                    {t('เมตร')}
                                                </div>
                                                <div className="text-xs text-gray-400 print:text-xs print:text-gray-600">
                                                    {t('ท่อย่อยสูงสุด')}
                                                </div>
                                            </div>
                                            <div className="rounded bg-gray-700 p-2 text-center print:border print:border-gray-200 print:bg-gray-50 print:p-3">
                                                <div className="text-sm font-bold text-purple-400 print:text-sm print:text-black">
                                                    {irrigationMetrics.maxTotalPipeLength.toFixed(
                                                        1
                                                    )}{' '}
                                                    {t('เมตร')}
                                                </div>
                                                <div className="text-xs text-gray-400 print:text-xs print:text-gray-600">
                                                    {t('ความยาวสูงสุดรวม')}
                                                </div>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-1 print:gap-2">
                                            <div className="rounded bg-gray-700 p-2 text-center print:border print:border-gray-200 print:bg-gray-50 print:p-3">
                                                <div className="text-sm font-bold text-cyan-400 print:text-sm print:text-black">
                                                    {irrigationMetrics.totalMainPipeLength.toFixed(
                                                        1
                                                    )}{' '}
                                                    {t('เมตร')}
                                                </div>
                                                <div className="text-xs text-gray-400 print:text-xs print:text-gray-600">
                                                    {t('ท่อเมนทั้งหมด')}
                                                </div>
                                            </div>
                                            <div className="rounded bg-gray-700 p-2 text-center print:border print:border-gray-200 print:bg-gray-50 print:p-3">
                                                <div className="text-sm font-bold text-yellow-400 print:text-sm print:text-black">
                                                    {irrigationMetrics.totalSubPipeLength.toFixed(
                                                        1
                                                    )}{' '}
                                                    {t('เมตร')}
                                                </div>
                                                <div className="text-xs text-gray-400 print:text-xs print:text-gray-600">
                                                    {t('ท่อย่อยทั้งหมด')}
                                                </div>
                                            </div>
                                            <div className="rounded bg-gray-700 p-2 text-center print:border print:border-gray-200 print:bg-gray-50 print:p-3">
                                                <div className="text-sm font-bold text-pink-400 print:text-sm print:text-black">
                                                    {irrigationMetrics.totalPipeLength.toFixed(1)}{' '}
                                                    {t('เมตร')}
                                                </div>
                                                <div className="text-xs text-gray-400 print:text-xs print:text-gray-600">
                                                    {t('ความยาวรวมทั้งหมด')}
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                                {expandedSections.irrigationEquipment && (
                                    <div className="mb-3">
                                        <h3 className="mb-2 text-sm font-semibold text-orange-400 print:text-sm print:text-black">
                                            💧 Irrigation Emitters
                                        </h3>
                                        <div className="grid grid-cols-3 gap-1 print:gap-2">
                                            <div className="rounded bg-gray-700 p-2 text-center print:border print:border-gray-200 print:bg-gray-50 print:p-3">
                                                <div className="text-sm font-bold text-blue-400 print:text-sm print:text-black">
                                                    {(() => {
                                                        const elements =
                                                            summaryData?.irrigationElements || [];
                                                        return elements.filter(
                                                            (e) => e.type === 'sprinkler'
                                                        ).length;
                                                    })()}
                                                </div>
                                                <div className="text-xs text-gray-400 print:text-xs print:text-gray-600">
                                                    Total Sprinklers
                                                </div>
                                            </div>
                                            <div className="rounded bg-gray-700 p-2 text-center print:border print:border-gray-200 print:bg-gray-50 print:p-3">
                                                <div className="text-sm font-bold text-green-400 print:text-sm print:text-black">
                                                    {(() => {
                                                        const elements =
                                                            summaryData?.irrigationElements || [];
                                                        const dripLines = elements.filter(
                                                            (e) => e.type === 'drip-line'
                                                        );
                                                        let totalDripEmitters = 0;

                                                        dripLines.forEach((dripLine) => {
                                                            if (
                                                                dripLine.points.length > 1 &&
                                                                dripLine.spacing
                                                            ) {
                                                                let totalLength = 0;
                                                                for (
                                                                    let i = 0;
                                                                    i < dripLine.points.length - 1;
                                                                    i++
                                                                ) {
                                                                    const p1 = dripLine.points[i];
                                                                    const p2 =
                                                                        dripLine.points[i + 1];
                                                                    const segmentLength =
                                                                        distanceBetweenPoints(
                                                                            p1,
                                                                            p2
                                                                        ) / 25; // Convert to meters
                                                                    totalLength += segmentLength;
                                                                }
                                                                if (
                                                                    totalLength > 0 &&
                                                                    dripLine.spacing > 0
                                                                ) {
                                                                    const emittersInThisLine =
                                                                        Math.floor(
                                                                            totalLength /
                                                                                dripLine.spacing
                                                                        ) + 1;
                                                                    totalDripEmitters +=
                                                                        emittersInThisLine;
                                                                }
                                                            }
                                                        });

                                                        return totalDripEmitters;
                                                    })()}
                                                </div>
                                                <div className="text-xs text-gray-400 print:text-xs print:text-gray-600">
                                                    Total Drip Emitters
                                                </div>
                                            </div>
                                            <div className="rounded bg-gray-700 p-2 text-center print:border print:border-gray-200 print:bg-gray-50 print:p-3">
                                                <div className="text-sm font-bold text-purple-400 print:text-sm print:text-black">
                                                    {(() => {
                                                        const elements =
                                                            summaryData?.irrigationElements || [];
                                                        const sprinklerCount = elements.filter(
                                                            (e) => e.type === 'sprinkler'
                                                        ).length;
                                                        const dripLines = elements.filter(
                                                            (e) => e.type === 'drip-line'
                                                        );
                                                        let totalDripEmitters = 0;

                                                        dripLines.forEach((dripLine) => {
                                                            if (
                                                                dripLine.points.length > 1 &&
                                                                dripLine.spacing
                                                            ) {
                                                                let totalLength = 0;
                                                                for (
                                                                    let i = 0;
                                                                    i < dripLine.points.length - 1;
                                                                    i++
                                                                ) {
                                                                    const p1 = dripLine.points[i];
                                                                    const p2 =
                                                                        dripLine.points[i + 1];
                                                                    const segmentLength =
                                                                        distanceBetweenPoints(
                                                                            p1,
                                                                            p2
                                                                        ) / 25; // Convert to meters
                                                                    totalLength += segmentLength;
                                                                }
                                                                if (
                                                                    totalLength > 0 &&
                                                                    dripLine.spacing > 0
                                                                ) {
                                                                    const emittersInThisLine =
                                                                        Math.floor(
                                                                            totalLength /
                                                                                dripLine.spacing
                                                                        ) + 1;
                                                                    totalDripEmitters +=
                                                                        emittersInThisLine;
                                                                }
                                                            }
                                                        });

                                                        return sprinklerCount + totalDripEmitters;
                                                    })()}
                                                </div>
                                                <div className="text-xs text-gray-400 print:text-xs print:text-gray-600">
                                                    Total Emitters
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {expandedSections.irrigationEquipment && (
                                    <div className="mb-3">
                                        <h3 className="mb-2 text-sm font-semibold text-red-400 print:text-sm print:text-black">
                                            🔧 {t('อุปกรณ์ควบคุม')}
                                        </h3>
                                        <div className="grid grid-cols-3 gap-1 print:gap-2">
                                            <div className="rounded bg-gray-700 p-1 text-center print:border print:border-gray-200 print:bg-gray-50 print:p-2">
                                                <div className="text-sm font-bold text-orange-400 print:text-sm print:text-black">
                                                    {irrigationMetrics.pumps}
                                                </div>
                                                <div className="text-xs text-gray-400 print:text-xs print:text-gray-600">
                                                    {t('ปั๊ม')}
                                                </div>
                                            </div>
                                            <div className="rounded bg-gray-700 p-1 text-center print:border print:border-gray-200 print:bg-gray-50 print:p-2">
                                                <div className="text-sm font-bold text-red-400 print:text-sm print:text-black">
                                                    {irrigationMetrics.solenoidValves}
                                                </div>
                                                <div className="text-xs text-gray-400 print:text-xs print:text-gray-600">
                                                    {t('โซลินอยด์วาล์ว')}
                                                </div>
                                            </div>
                                            <div className="rounded bg-gray-700 p-1 text-center print:border print:border-gray-200 print:bg-gray-50 print:p-2">
                                                <div className="text-sm font-bold text-yellow-400 print:text-sm print:text-black">
                                                    {irrigationMetrics.ballValves}
                                                </div>
                                                <div className="text-xs text-gray-400 print:text-xs print:text-gray-600">
                                                    {t('บอลวาล์ว')}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {expandedSections.irrigationEquipment && (
                                    <div className="mb-3">
                                        <h3 className="mb-2 text-sm font-semibold text-cyan-400 print:text-sm print:text-black">
                                            🗂️ {t('อุปกรณ์เก็บและให้ปุ๋ย')}
                                        </h3>
                                        <div className="grid grid-cols-2 gap-1 print:gap-2">
                                            <div className="rounded bg-gray-700 p-1 text-center print:border print:border-gray-200 print:bg-gray-50 print:p-2">
                                                <div className="text-sm font-bold text-blue-400 print:text-sm print:text-black">
                                                    {irrigationMetrics.waterTanks}
                                                </div>
                                                <div className="text-xs text-gray-400 print:text-xs print:text-gray-600">
                                                    {t('ถังเก็บน้ำ')}
                                                </div>
                                            </div>
                                            <div className="rounded bg-gray-700 p-1 text-center print:border print:border-gray-200 print:bg-gray-50 print:p-2">
                                                <div className="text-sm font-bold text-green-400 print:text-sm print:text-black">
                                                    {irrigationMetrics.fertilizerMachines}
                                                </div>
                                                <div className="text-xs text-gray-400 print:text-xs print:text-gray-600">
                                                    {t('เครื่องให้ปุ๋ย')}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Updated Management Section - removed from print */}
                            <div className="rounded-lg bg-gray-800 p-4 print:hidden">
                                <h2 className="mb-3 text-lg font-bold text-purple-400">
                                    📋 {t('การจัดการ')}
                                </h2>
                                <div className="grid grid-cols-1 gap-3">
                                    <button
                                        onClick={handleBackNavigation}
                                        className="rounded-lg bg-blue-600 px-4 py-2 text-center font-semibold text-white transition-colors hover:bg-blue-700"
                                    >
                                        🔄 {t('แก้ไขโครงการ')}
                                    </button>
                                </div>
                            </div>
                        </div>

                        <div className="print:page-break-before-always space-y-4 print:space-y-0">
                            <div className="hidden print:mb-6 print:block">
                                <h1 className="text-xl font-bold text-black">
                                    📐 {t('แบบแปลนโรงเรือนพร้อมระบบการให้น้ำ')}
                                </h1>
                                <p className="text-gray-600">
                                    {t('รายละเอียดโครงสร้างโรงเรือนและการติดตั้งอุปกรณ์')}
                                </p>
                                <hr className="my-2 border-gray-300" />
                            </div>

                            <div className="rounded-lg bg-gray-800 p-4 print:border-0 print:bg-white print:p-0">
                                <h2 className="mb-3 text-lg font-bold text-green-400 print:hidden">
                                    🏠 {t('แบบแปลนโรงเรือน (พร้อมระบบน้ำ)')}
                                </h2>
                                <div className="overflow-hidden rounded-lg bg-white print:h-96">
                                    <canvas
                                        ref={canvasRef}
                                        className="h-auto w-full border border-gray-300 object-contain print:h-full print:w-full print:border-2 print:border-gray-400"
                                        style={{ maxHeight: '500px', display: 'block' }}
                                    />
                                </div>
                                <div className="mt-2 text-center text-xs text-gray-400 print:hidden">
                                    {t(
                                        'แบบแปลนโรงเรือนพร้อมระบบการให้น้ำและอุปกรณ์ทั้งหมด (อยู่ตรงกลาง)'
                                    )}
                                </div>
                            </div>

                            {/* Rest of the existing content for plants and notes... */}
                            <div className="hidden print:mt-8 print:block">
                                <div className="border border-gray-300 bg-gray-50 p-4">
                                    <h3 className="mb-3 text-sm font-bold text-black">
                                        📝 {t('หมายเหตุการใช้งาน')}
                                    </h3>
                                    <div className="space-y-1 text-xs text-gray-700">
                                        <p>
                                            •{' '}
                                            {t(
                                                'แผนนี้แสดงตำแหน่งของโครงสร้างโรงเรือนและระบบการให้น้ำทั้งหมด'
                                            )}
                                        </p>
                                        <p>
                                            •{' '}
                                            {t(
                                                'สีน้ำเงิน: ท่อเมนและท่อย่อย | สีเขียว: พื้นที่แปลงปลูก | สีน้ำตาล: โครงสร้างโรงเรือน'
                                            )}
                                        </p>
                                        <p>
                                            •{' '}
                                            {t(
                                                'สัญลักษณ์แสดงตำแหน่งของอุปกรณ์การให้น้ำ เช่น ปั๊ม วาล์ว สปริงเกลอร์ ถังเก็บน้ำ และเครื่องให้ปุ๋ย'
                                            )}
                                        </p>
                                        <p>• {t('ขนาดและตำแหน่งอาจต้องปรับตามสภาพพื้นที่จริง')}</p>
                                        <p>
                                            • {t('ความยาวท่อทั้งหมด')}:{' '}
                                            {irrigationMetrics.totalPipeLength.toFixed(1)}{' '}
                                            {t('เมตร')}
                                        </p>
                                        <p>
                                            • {t('จำนวนอุปกรณ์')}: {irrigationMetrics.pumps}{' '}
                                            {t('ปั๊ม')}, {irrigationMetrics.waterTanks}{' '}
                                            {t('ถังเก็บน้ำ')},{' '}
                                            {irrigationMetrics.fertilizerMachines}{' '}
                                            {t('เครื่องให้ปุ๋ย')}
                                        </p>
                                    </div>
                                </div>
                            </div>

                            <div className="hidden print:mt-6 print:block">
                                <div className="border border-gray-300 bg-white p-4">
                                    <h3 className="mb-3 text-sm font-bold text-black">
                                        🌱 {t('ข้อมูลการปลูกและความต้องการน้ำ')}
                                    </h3>

                                    {waterSummary && (
                                        <div className="mb-4 border-b border-gray-200 pb-3">
                                            <h4 className="mb-2 text-sm font-bold text-black">
                                                💧 {t('สรุปความต้องการน้ำทั้งหมด')}
                                            </h4>
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className="border border-gray-200 bg-gray-50 p-2 text-center">
                                                    <div className="text-xs font-bold text-black">
                                                        {waterSummary.dailyTotal.optimal.toFixed(1)}{' '}
                                                        {t('ลิตร/วัน')}
                                                    </div>
                                                    <div className="text-xs text-gray-600">
                                                        {t('น้ำที่ต้องการต่อวัน')}
                                                    </div>
                                                </div>
                                                <div className="border border-gray-200 bg-gray-50 p-2 text-center">
                                                    <div className="text-xs font-bold text-black">
                                                        {waterSummary.weeklyTotal.optimal.toFixed(
                                                            1
                                                        )}{' '}
                                                        {t('ลิตร/สัปดาห์')}
                                                    </div>
                                                    <div className="text-xs text-gray-600">
                                                        {t('น้ำที่ต้องการต่อสัปดาห์')}
                                                    </div>
                                                </div>
                                                <div className="border border-gray-200 bg-gray-50 p-2 text-center">
                                                    <div className="text-xs font-bold text-black">
                                                        {waterSummary.monthlyTotal.optimal.toFixed(
                                                            1
                                                        )}{' '}
                                                        {t('ลิตร/เดือน')}
                                                    </div>
                                                    <div className="text-xs text-gray-600">
                                                        {t('น้ำที่ต้องการต่อเดือน')}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    <div className="space-y-3">
                                        {plotWaterCalculations.length > 0 ? (
                                            plotWaterCalculations.map((plotWater, index) => {
                                                const plotPipe =
                                                    plotPipeData[index] ||
                                                    plotPipeData.find(
                                                        (p) => p.plotName === plotWater.plotName
                                                    );
                                                return (
                                                    <div
                                                        key={index}
                                                        className="border-b border-gray-200 pb-3"
                                                    >
                                                        <div className="mb-2 flex items-center justify-between">
                                                            <span className="text-sm font-semibold text-gray-700">
                                                                {getCropIcon(plotWater.cropType)}{' '}
                                                                {plotWater.plotName}
                                                            </span>
                                                            <span className="text-xs text-gray-500">
                                                                {t('สภาพแวดล้อมควบคุม')}
                                                            </span>
                                                        </div>
                                                        <p className="mb-2 text-xs text-gray-600">
                                                            {t('พืชที่ปลูก')}: {plotWater.cropName}
                                                        </p>

                                                        {/* Water Requirements for this plot */}
                                                        <div className="mb-3 border border-gray-200 bg-gray-50 p-2">
                                                            <h5 className="mb-2 text-xs font-bold text-black">
                                                                💧 {t('ความต้องการน้ำ')}
                                                            </h5>
                                                            <div className="grid grid-cols-3 gap-1">
                                                                <div className="border border-gray-200 bg-white p-1 text-center">
                                                                    <div className="text-xs font-bold text-black">
                                                                        {plotWater.dailyWaterNeed.optimal.toFixed(
                                                                            1
                                                                        )}{' '}
                                                                        {t('ลิตร/วัน')}
                                                                    </div>
                                                                    <div className="text-xs text-gray-600">
                                                                        {t('ต่อวัน')}
                                                                    </div>
                                                                </div>
                                                                <div className="border border-gray-200 bg-white p-1 text-center">
                                                                    <div className="text-xs font-bold text-black">
                                                                        {plotWater.weeklyWaterNeed.optimal.toFixed(
                                                                            1
                                                                        )}{' '}
                                                                        {t('ลิตร/สัปดาห์')}
                                                                    </div>
                                                                    <div className="text-xs text-gray-600">
                                                                        {t('ต่อสัปดาห์')}
                                                                    </div>
                                                                </div>
                                                                <div className="border border-gray-200 bg-white p-1 text-center">
                                                                    <div className="text-xs font-bold text-black">
                                                                        {plotWater.monthlyWaterNeed.optimal.toFixed(
                                                                            1
                                                                        )}{' '}
                                                                        {t('ลิตร/เดือน')}
                                                                    </div>
                                                                    <div className="text-xs text-gray-600">
                                                                        {t('ต่อเดือน')}
                                                                    </div>
                                                                </div>
                                                                {/* Irrigation Emitters Information */}
                                                                <div className="mt-2 border-t border-gray-200 pt-2">
                                                                    <div className="mb-2 text-xs font-semibold text-gray-700">
                                                                        💧 Irrigation Emitters
                                                                    </div>
                                                                    <div className="grid grid-cols-3 gap-2">
                                                                        <div className="border border-gray-200 bg-blue-50 p-2 text-center">
                                                                            <div className="text-xs font-bold text-blue-600">
                                                                                {(() => {
                                                                                    // นับสปริงเกลอร์ในแปลงนี้โดยตรงจาก irrigationElements
                                                                                    const elements =
                                                                                        summaryData?.irrigationElements ||
                                                                                        [];
                                                                                    const sprinklers =
                                                                                        elements.filter(
                                                                                            (e) =>
                                                                                                e.type ===
                                                                                                'sprinkler'
                                                                                        );
                                                                                    const plotShape =
                                                                                        summaryData?.shapes?.find(
                                                                                            (s) =>
                                                                                                s.name ===
                                                                                                    plotWater.plotName ||
                                                                                                s.id ===
                                                                                                    plotWater.plotId
                                                                                        );

                                                                                    let sprinklerCount = 0;
                                                                                    if (
                                                                                        plotShape &&
                                                                                        plotShape.points
                                                                                    ) {
                                                                                        sprinklers.forEach(
                                                                                            (
                                                                                                sprinkler
                                                                                            ) => {
                                                                                                if (
                                                                                                    sprinkler
                                                                                                        .points
                                                                                                        .length >
                                                                                                    0
                                                                                                ) {
                                                                                                    const sprinklerPoint =
                                                                                                        sprinkler
                                                                                                            .points[0];
                                                                                                    const isInPlot =
                                                                                                        isPointInPolygon(
                                                                                                            sprinklerPoint,
                                                                                                            plotShape.points
                                                                                                        );

                                                                                                    let isNearSubPipeInPlot = false;
                                                                                                    const subPipes =
                                                                                                        elements.filter(
                                                                                                            (
                                                                                                                e
                                                                                                            ) =>
                                                                                                                e.type ===
                                                                                                                'sub-pipe'
                                                                                                        );

                                                                                                    if (
                                                                                                        !isInPlot
                                                                                                    ) {
                                                                                                        subPipes.forEach(
                                                                                                            (
                                                                                                                subPipe
                                                                                                            ) => {
                                                                                                                if (
                                                                                                                    subPipeServesPlot(
                                                                                                                        subPipe,
                                                                                                                        plotShape.points
                                                                                                                    )
                                                                                                                ) {
                                                                                                                    for (
                                                                                                                        let i = 0;
                                                                                                                        i <
                                                                                                                        subPipe
                                                                                                                            .points
                                                                                                                            .length -
                                                                                                                            1;
                                                                                                                        i++
                                                                                                                    ) {
                                                                                                                        const distance =
                                                                                                                            distancePointToLineSegment(
                                                                                                                                sprinklerPoint,
                                                                                                                                subPipe
                                                                                                                                    .points[
                                                                                                                                    i
                                                                                                                                ],
                                                                                                                                subPipe
                                                                                                                                    .points[
                                                                                                                                    i +
                                                                                                                                        1
                                                                                                                                ]
                                                                                                                            );
                                                                                                                        if (
                                                                                                                            distance <
                                                                                                                            30
                                                                                                                        ) {
                                                                                                                            isNearSubPipeInPlot = true;
                                                                                                                            break;
                                                                                                                        }
                                                                                                                    }
                                                                                                                }
                                                                                                            }
                                                                                                        );
                                                                                                    }

                                                                                                    if (
                                                                                                        isInPlot ||
                                                                                                        isNearSubPipeInPlot
                                                                                                    ) {
                                                                                                        sprinklerCount++;
                                                                                                    }
                                                                                                }
                                                                                            }
                                                                                        );
                                                                                    }

                                                                                    return sprinklerCount;
                                                                                })()}
                                                                            </div>
                                                                            <div className="text-xs text-gray-600">
                                                                                Sprinklers
                                                                            </div>
                                                                        </div>
                                                                        <div className="border border-gray-200 bg-green-50 p-2 text-center">
                                                                            <div className="text-xs font-bold text-green-600">
                                                                                {(() => {
                                                                                    // นับจุดน้ำหยดในแปลงนี้โดยตรงจาก irrigationElements
                                                                                    const elements =
                                                                                        summaryData?.irrigationElements ||
                                                                                        [];
                                                                                    const dripLines =
                                                                                        elements.filter(
                                                                                            (e) =>
                                                                                                e.type ===
                                                                                                'drip-line'
                                                                                        );
                                                                                    const plotShape =
                                                                                        summaryData?.shapes?.find(
                                                                                            (s) =>
                                                                                                s.name ===
                                                                                                    plotWater.plotName ||
                                                                                                s.id ===
                                                                                                    plotWater.plotId
                                                                                        );

                                                                                    let dripCount = 0;
                                                                                    if (
                                                                                        plotShape &&
                                                                                        plotShape.points
                                                                                    ) {
                                                                                        dripLines.forEach(
                                                                                            (
                                                                                                dripLine
                                                                                            ) => {
                                                                                                if (
                                                                                                    dripLine
                                                                                                        .points
                                                                                                        .length >
                                                                                                        0 &&
                                                                                                    dripLine.spacing
                                                                                                ) {
                                                                                                    let dripLengthInPlot = 0;

                                                                                                    for (
                                                                                                        let i = 0;
                                                                                                        i <
                                                                                                        dripLine
                                                                                                            .points
                                                                                                            .length -
                                                                                                            1;
                                                                                                        i++
                                                                                                    ) {
                                                                                                        const p1 =
                                                                                                            dripLine
                                                                                                                .points[
                                                                                                                i
                                                                                                            ];
                                                                                                        const p2 =
                                                                                                            dripLine
                                                                                                                .points[
                                                                                                                i +
                                                                                                                    1
                                                                                                            ];

                                                                                                        const midPoint =
                                                                                                            {
                                                                                                                x:
                                                                                                                    (p1.x +
                                                                                                                        p2.x) /
                                                                                                                    2,
                                                                                                                y:
                                                                                                                    (p1.y +
                                                                                                                        p2.y) /
                                                                                                                    2,
                                                                                                            };

                                                                                                        if (
                                                                                                            isPointInPolygon(
                                                                                                                p1,
                                                                                                                plotShape.points
                                                                                                            ) ||
                                                                                                            isPointInPolygon(
                                                                                                                p2,
                                                                                                                plotShape.points
                                                                                                            ) ||
                                                                                                            isPointInPolygon(
                                                                                                                midPoint,
                                                                                                                plotShape.points
                                                                                                            )
                                                                                                        ) {
                                                                                                            const segmentLength =
                                                                                                                distanceBetweenPoints(
                                                                                                                    p1,
                                                                                                                    p2
                                                                                                                ) /
                                                                                                                25;
                                                                                                            dripLengthInPlot +=
                                                                                                                segmentLength;
                                                                                                        }
                                                                                                    }

                                                                                                    if (
                                                                                                        dripLengthInPlot >
                                                                                                            0 &&
                                                                                                        dripLine.spacing >
                                                                                                            0
                                                                                                    ) {
                                                                                                        const emittersInThisLine =
                                                                                                            Math.floor(
                                                                                                                dripLengthInPlot /
                                                                                                                    dripLine.spacing
                                                                                                            ) +
                                                                                                            1;
                                                                                                        dripCount +=
                                                                                                            emittersInThisLine;
                                                                                                    }
                                                                                                }
                                                                                            }
                                                                                        );
                                                                                    }

                                                                                    return dripCount;
                                                                                })()}
                                                                            </div>
                                                                            <div className="text-xs text-gray-600">
                                                                                Drip Emitters
                                                                            </div>
                                                                        </div>
                                                                        <div className="border border-gray-200 bg-purple-50 p-2 text-center">
                                                                            <div className="text-xs font-bold text-purple-600">
                                                                                {(() => {
                                                                                    // นับอุปกรณ์ให้น้ำทั้งหมดในแปลงนี้
                                                                                    const elements =
                                                                                        summaryData?.irrigationElements ||
                                                                                        [];
                                                                                    const sprinklers =
                                                                                        elements.filter(
                                                                                            (e) =>
                                                                                                e.type ===
                                                                                                'sprinkler'
                                                                                        );
                                                                                    const dripLines =
                                                                                        elements.filter(
                                                                                            (e) =>
                                                                                                e.type ===
                                                                                                'drip-line'
                                                                                        );
                                                                                    const plotShape =
                                                                                        summaryData?.shapes?.find(
                                                                                            (s) =>
                                                                                                s.name ===
                                                                                                    plotWater.plotName ||
                                                                                                s.id ===
                                                                                                    plotWater.plotId
                                                                                        );

                                                                                    let sprinklerCount = 0;
                                                                                    let dripCount = 0;

                                                                                    if (
                                                                                        plotShape &&
                                                                                        plotShape.points
                                                                                    ) {
                                                                                        // นับสปริงเกลอร์
                                                                                        sprinklers.forEach(
                                                                                            (
                                                                                                sprinkler
                                                                                            ) => {
                                                                                                if (
                                                                                                    sprinkler
                                                                                                        .points
                                                                                                        .length >
                                                                                                    0
                                                                                                ) {
                                                                                                    const sprinklerPoint =
                                                                                                        sprinkler
                                                                                                            .points[0];
                                                                                                    const isInPlot =
                                                                                                        isPointInPolygon(
                                                                                                            sprinklerPoint,
                                                                                                            plotShape.points
                                                                                                        );

                                                                                                    let isNearSubPipeInPlot = false;
                                                                                                    const subPipes =
                                                                                                        elements.filter(
                                                                                                            (
                                                                                                                e
                                                                                                            ) =>
                                                                                                                e.type ===
                                                                                                                'sub-pipe'
                                                                                                        );

                                                                                                    if (
                                                                                                        !isInPlot
                                                                                                    ) {
                                                                                                        subPipes.forEach(
                                                                                                            (
                                                                                                                subPipe
                                                                                                            ) => {
                                                                                                                if (
                                                                                                                    subPipeServesPlot(
                                                                                                                        subPipe,
                                                                                                                        plotShape.points
                                                                                                                    )
                                                                                                                ) {
                                                                                                                    for (
                                                                                                                        let i = 0;
                                                                                                                        i <
                                                                                                                        subPipe
                                                                                                                            .points
                                                                                                                            .length -
                                                                                                                            1;
                                                                                                                        i++
                                                                                                                    ) {
                                                                                                                        const distance =
                                                                                                                            distancePointToLineSegment(
                                                                                                                                sprinklerPoint,
                                                                                                                                subPipe
                                                                                                                                    .points[
                                                                                                                                    i
                                                                                                                                ],
                                                                                                                                subPipe
                                                                                                                                    .points[
                                                                                                                                    i +
                                                                                                                                        1
                                                                                                                                ]
                                                                                                                            );
                                                                                                                        if (
                                                                                                                            distance <
                                                                                                                            30
                                                                                                                        ) {
                                                                                                                            isNearSubPipeInPlot = true;
                                                                                                                            break;
                                                                                                                        }
                                                                                                                    }
                                                                                                                }
                                                                                                            }
                                                                                                        );
                                                                                                    }

                                                                                                    if (
                                                                                                        isInPlot ||
                                                                                                        isNearSubPipeInPlot
                                                                                                    ) {
                                                                                                        sprinklerCount++;
                                                                                                    }
                                                                                                }
                                                                                            }
                                                                                        );

                                                                                        // นับจุดน้ำหยด
                                                                                        dripLines.forEach(
                                                                                            (
                                                                                                dripLine
                                                                                            ) => {
                                                                                                if (
                                                                                                    dripLine
                                                                                                        .points
                                                                                                        .length >
                                                                                                        0 &&
                                                                                                    dripLine.spacing
                                                                                                ) {
                                                                                                    let dripLengthInPlot = 0;

                                                                                                    for (
                                                                                                        let i = 0;
                                                                                                        i <
                                                                                                        dripLine
                                                                                                            .points
                                                                                                            .length -
                                                                                                            1;
                                                                                                        i++
                                                                                                    ) {
                                                                                                        const p1 =
                                                                                                            dripLine
                                                                                                                .points[
                                                                                                                i
                                                                                                            ];
                                                                                                        const p2 =
                                                                                                            dripLine
                                                                                                                .points[
                                                                                                                i +
                                                                                                                    1
                                                                                                            ];

                                                                                                        const midPoint =
                                                                                                            {
                                                                                                                x:
                                                                                                                    (p1.x +
                                                                                                                        p2.x) /
                                                                                                                    2,
                                                                                                                y:
                                                                                                                    (p1.y +
                                                                                                                        p2.y) /
                                                                                                                    2,
                                                                                                            };

                                                                                                        // ตรวจสอบว่าส่วนของท่อนี้อยู่ในแปลงหรืออยู่ใกล้ขอบแปลง
                                                                                                        const p1InPlot =
                                                                                                            isPointInPolygon(
                                                                                                                p1,
                                                                                                                plotShape.points
                                                                                                            );
                                                                                                        const p2InPlot =
                                                                                                            isPointInPolygon(
                                                                                                                p2,
                                                                                                                plotShape.points
                                                                                                            );
                                                                                                        const midInPlot =
                                                                                                            isPointInPolygon(
                                                                                                                midPoint,
                                                                                                                plotShape.points
                                                                                                            );

                                                                                                        // ตรวจสอบว่าส่วนของท่อนี้อยู่ใกล้ขอบแปลงหรือไม่
                                                                                                        const plotWidth =
                                                                                                            Math.max(
                                                                                                                ...plotShape.points.map(
                                                                                                                    (
                                                                                                                        p
                                                                                                                    ) =>
                                                                                                                        p.x
                                                                                                                )
                                                                                                            ) -
                                                                                                            Math.min(
                                                                                                                ...plotShape.points.map(
                                                                                                                    (
                                                                                                                        p
                                                                                                                    ) =>
                                                                                                                        p.x
                                                                                                                )
                                                                                                            );
                                                                                                        const plotHeight =
                                                                                                            Math.max(
                                                                                                                ...plotShape.points.map(
                                                                                                                    (
                                                                                                                        p
                                                                                                                    ) =>
                                                                                                                        p.y
                                                                                                                )
                                                                                                            ) -
                                                                                                            Math.min(
                                                                                                                ...plotShape.points.map(
                                                                                                                    (
                                                                                                                        p
                                                                                                                    ) =>
                                                                                                                        p.y
                                                                                                                )
                                                                                                            );
                                                                                                        const baseTolerance =
                                                                                                            Math.min(
                                                                                                                plotWidth,
                                                                                                                plotHeight
                                                                                                            ) *
                                                                                                            0.05; // 5% ของขนาดแปลง
                                                                                                        const p1DistanceToPlot =
                                                                                                            distancePointToPolygon(
                                                                                                                p1,
                                                                                                                plotShape.points
                                                                                                            );
                                                                                                        const p2DistanceToPlot =
                                                                                                            distancePointToPolygon(
                                                                                                                p2,
                                                                                                                plotShape.points
                                                                                                            );
                                                                                                        const midDistanceToPlot =
                                                                                                            distancePointToPolygon(
                                                                                                                midPoint,
                                                                                                                plotShape.points
                                                                                                            );
                                                                                                        const p1NearPlotEdge =
                                                                                                            p1DistanceToPlot <=
                                                                                                            baseTolerance *
                                                                                                                2;
                                                                                                        const p2NearPlotEdge =
                                                                                                            p2DistanceToPlot <=
                                                                                                            baseTolerance *
                                                                                                                2;
                                                                                                        const midNearPlotEdge =
                                                                                                            midDistanceToPlot <=
                                                                                                            baseTolerance *
                                                                                                                2;

                                                                                                        if (
                                                                                                            p1InPlot ||
                                                                                                            p2InPlot ||
                                                                                                            midInPlot ||
                                                                                                            p1NearPlotEdge ||
                                                                                                            p2NearPlotEdge ||
                                                                                                            midNearPlotEdge
                                                                                                        ) {
                                                                                                            const segmentLength =
                                                                                                                distanceBetweenPoints(
                                                                                                                    p1,
                                                                                                                    p2
                                                                                                                ) /
                                                                                                                25;
                                                                                                            dripLengthInPlot +=
                                                                                                                segmentLength;
                                                                                                        }
                                                                                                    }

                                                                                                    if (
                                                                                                        dripLengthInPlot >
                                                                                                            0 &&
                                                                                                        dripLine.spacing >
                                                                                                            0
                                                                                                    ) {
                                                                                                        const emittersInThisLine =
                                                                                                            Math.floor(
                                                                                                                dripLengthInPlot /
                                                                                                                    dripLine.spacing
                                                                                                            ) +
                                                                                                            1;
                                                                                                        dripCount +=
                                                                                                            emittersInThisLine;
                                                                                                    }
                                                                                                }
                                                                                            }
                                                                                        );
                                                                                    }

                                                                                    return (
                                                                                        sprinklerCount +
                                                                                        dripCount
                                                                                    );
                                                                                })()}
                                                                            </div>
                                                                            <div className="text-xs text-gray-600">
                                                                                Total
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Main and Sub Pipe Flow Rate and Outlet Count for This Plot */}
                                                                {plotPipe && plotPipe.hasPipes && (
                                                                    <div className="mt-2 border-t border-gray-200 pt-2">
                                                                        <div className="mb-2 text-xs font-semibold text-gray-700">
                                                                            {t(
                                                                                'อัตราการไหลและจำนวนทางออกของท่อ'
                                                                            )}
                                                                        </div>
                                                                        <div className="overflow-x-auto">
                                                                            <table className="w-full border-collapse border border-gray-300">
                                                                                <thead>
                                                                                    <tr className="bg-gray-100">
                                                                                        <th className="border border-gray-300 px-2 py-1 text-left text-xs font-semibold text-gray-800">
                                                                                            {t(
                                                                                                'ประเภทท่อ'
                                                                                            )}
                                                                                        </th>
                                                                                        <th className="border border-gray-300 px-2 py-1 text-left text-xs font-semibold text-gray-800">
                                                                                            {t(
                                                                                                'อัตราการไหล'
                                                                                            )}
                                                                                        </th>
                                                                                        <th className="border border-gray-300 px-2 py-1 text-left text-xs font-semibold text-gray-800">
                                                                                            {t(
                                                                                                'จำนวนทางออก'
                                                                                            )}
                                                                                        </th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody className="text-gray-700">
                                                                                    <tr>
                                                                                        <td className="border border-gray-300 px-2 py-1 text-xs">
                                                                                            {t(
                                                                                                'ท่อเมน'
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="border border-gray-300 px-2 py-1 text-xs font-bold text-blue-600">
                                                                                            {(() => {
                                                                                                const sprinklerFlowRate =
                                                                                                    summaryData?.sprinklerFlowRate ||
                                                                                                    10;
                                                                                                const longestSubPipeEmitters =
                                                                                                    plotPipe?.longestSubPipeEmitters ||
                                                                                                    0;

                                                                                                // คำนวณอัตราการไหลจากจำนวนทางออกในท่อย่อยที่ยาวที่สุด
                                                                                                const flowRate =
                                                                                                    longestSubPipeEmitters *
                                                                                                    sprinklerFlowRate;
                                                                                                return flowRate.toFixed(
                                                                                                    2
                                                                                                );
                                                                                            })()}{' '}
                                                                                            {t(
                                                                                                'L/min'
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="border border-gray-300 px-2 py-1 text-xs font-bold text-blue-600">
                                                                                            {(() => {
                                                                                                // คำนวณจำนวนท่อย่อยที่เชื่อมต่อกับแปลงนี้
                                                                                                const elements =
                                                                                                    summaryData?.irrigationElements ||
                                                                                                    [];
                                                                                                const subPipes =
                                                                                                    elements.filter(
                                                                                                        (
                                                                                                            e
                                                                                                        ) =>
                                                                                                            e.type ===
                                                                                                            'sub-pipe'
                                                                                                    );
                                                                                                const plotShape =
                                                                                                    summaryData?.shapes?.find(
                                                                                                        (
                                                                                                            s
                                                                                                        ) =>
                                                                                                            s.name ===
                                                                                                                plotWater.plotName ||
                                                                                                            s.id ===
                                                                                                                plotWater.plotId
                                                                                                    );

                                                                                                if (
                                                                                                    plotShape &&
                                                                                                    plotShape.points
                                                                                                ) {
                                                                                                    return subPipes.filter(
                                                                                                        (
                                                                                                            subPipe
                                                                                                        ) =>
                                                                                                            subPipeServesPlot(
                                                                                                                subPipe,
                                                                                                                plotShape.points
                                                                                                            )
                                                                                                    )
                                                                                                        .length;
                                                                                                }
                                                                                                return 0;
                                                                                            })()}
                                                                                        </td>
                                                                                    </tr>
                                                                                    <tr>
                                                                                        <td className="border border-gray-300 px-2 py-1 text-xs">
                                                                                            {t(
                                                                                                'ท่อเมนย่อย'
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="border border-gray-300 px-2 py-1 text-xs font-bold text-green-600">
                                                                                            {(() => {
                                                                                                const sprinklerFlowRate =
                                                                                                    summaryData?.sprinklerFlowRate ||
                                                                                                    10;
                                                                                                const longestSubPipeEmitters =
                                                                                                    plotPipe?.longestSubPipeEmitters ||
                                                                                                    0;

                                                                                                // คำนวณอัตราการไหลจากจำนวนทางออกในท่อย่อยที่ยาวที่สุด
                                                                                                const flowRate =
                                                                                                    longestSubPipeEmitters *
                                                                                                    sprinklerFlowRate;
                                                                                                return flowRate.toFixed(
                                                                                                    2
                                                                                                );
                                                                                            })()}{' '}
                                                                                            {t(
                                                                                                'L/min'
                                                                                            )}
                                                                                        </td>
                                                                                        <td className="border border-gray-300 px-2 py-1 text-xs font-bold text-green-600">
                                                                                            {
                                                                                                plotPipe.longestSubPipeEmitters
                                                                                            }
                                                                                        </td>
                                                                                    </tr>
                                                                                </tbody>
                                                                            </table>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div className="mt-2 grid grid-cols-2 gap-1">
                                                                <div className="border border-gray-200 bg-white p-1 text-center">
                                                                    <div className="text-xs font-bold text-black">
                                                                        {plotWater.totalPlants}{' '}
                                                                        {t('ต้น')}
                                                                    </div>
                                                                    <div className="text-xs text-gray-600">
                                                                        {t('จำนวนพืช')}
                                                                    </div>
                                                                </div>
                                                                <div className="border border-gray-200 bg-white p-1 text-center">
                                                                    <div className="text-xs font-bold text-black">
                                                                        {plotWater.waterIntensity.litersPerSquareMeter.toFixed(
                                                                            1
                                                                        )}{' '}
                                                                        {t('ลิตร/ตร.ม./วัน')}
                                                                    </div>
                                                                    <div className="text-xs text-gray-600">
                                                                        {t('ความเข้มข้นน้ำ')}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {plotPipe && plotPipe.hasPipes ? (
                                                            <div className="space-y-2">
                                                                <h5 className="mb-2 text-xs font-bold text-black">
                                                                    🔧 {t('ระบบท่อ')}
                                                                </h5>
                                                                <div className="grid grid-cols-3 gap-2">
                                                                    <div className="border border-gray-200 bg-gray-50 p-2 text-center">
                                                                        <div className="text-xs font-bold text-black">
                                                                            {plotPipe.maxMainPipeLength.toFixed(
                                                                                1
                                                                            )}{' '}
                                                                            {t('เมตร')}
                                                                        </div>
                                                                        <div className="text-xs text-gray-600">
                                                                            {t('ท่อเมนสูงสุด')}
                                                                        </div>
                                                                    </div>
                                                                    <div className="border border-gray-200 bg-gray-50 p-2 text-center">
                                                                        <div className="text-xs font-bold text-black">
                                                                            {plotPipe.maxSubPipeLength.toFixed(
                                                                                1
                                                                            )}{' '}
                                                                            {t('เมตร')}
                                                                        </div>
                                                                        <div className="text-xs text-gray-600">
                                                                            {t('ท่อย่อยสูงสุด')}
                                                                        </div>
                                                                    </div>
                                                                    <div className="border border-gray-200 bg-gray-50 p-2 text-center">
                                                                        <div className="text-xs font-bold text-black">
                                                                            {plotPipe.maxTotalPipeLength.toFixed(
                                                                                1
                                                                            )}{' '}
                                                                            {t('เมตร')}
                                                                        </div>
                                                                        <div className="text-xs text-gray-600">
                                                                            {t('ความยาวสูงสุดรวม')}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-3 gap-2">
                                                                    <div className="border border-gray-200 bg-gray-50 p-2 text-center">
                                                                        <div className="text-xs font-bold text-black">
                                                                            {plotPipe.totalMainPipeLength.toFixed(
                                                                                1
                                                                            )}{' '}
                                                                            {t('เมตร')}
                                                                        </div>
                                                                        <div className="text-xs text-gray-600">
                                                                            {t('ท่อเมนทั้งหมด')}
                                                                        </div>
                                                                    </div>
                                                                    <div className="border border-gray-200 bg-gray-50 p-2 text-center">
                                                                        <div className="text-xs font-bold text-black">
                                                                            {plotPipe.totalSubPipeLength.toFixed(
                                                                                1
                                                                            )}{' '}
                                                                            {t('เมตร')}
                                                                        </div>
                                                                        <div className="text-xs text-gray-600">
                                                                            {t('ท่อย่อยทั้งหมด')}
                                                                        </div>
                                                                    </div>
                                                                    <div className="border border-gray-200 bg-gray-50 p-2 text-center">
                                                                        <div className="text-xs font-bold text-black">
                                                                            {plotPipe.totalPipeLength.toFixed(
                                                                                1
                                                                            )}{' '}
                                                                            {t('เมตร')}
                                                                        </div>
                                                                        <div className="text-xs text-gray-600">
                                                                            {t('ความยาวรวมทั้งหมด')}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="border border-gray-200 bg-gray-50 p-2 text-center">
                                                                <span className="text-xs text-gray-600">
                                                                    {t('ไม่มีระบบท่อในแปลงนี้')}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <>
                                                {summaryData?.selectedCrops?.map((crop, index) => (
                                                    <div
                                                        key={index}
                                                        className="flex items-center justify-between border-b border-gray-200 pb-1"
                                                    >
                                                        <span className="text-sm text-gray-700">
                                                            {getCropIcon(crop)} {crop}
                                                        </span>
                                                        <span className="text-xs text-gray-500">
                                                            {t('สภาพแวดล้อมควบคุม')}
                                                        </span>
                                                    </div>
                                                )) || (
                                                    <p className="text-sm text-gray-500">
                                                        {t('ไม่มีพืชที่เลือกไว้')}
                                                    </p>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-lg bg-gray-800 p-4 print:hidden">
                                <button
                                    onClick={() => toggleSection('plantData')}
                                    className="mb-3 flex w-full items-center justify-between text-left"
                                >
                                    <h2 className="text-lg font-bold text-yellow-400">
                                        🌱{' '}
                                        {t(
                                            'ข้อมูลการปลูกและความต้องการน้ำแต่ละโรงเรือนใช้อัตราการไหลกี่ลิตรต่อนาที'
                                        )}
                                    </h2>
                                    <svg
                                        className={`h-5 w-5 transform transition-transform ${
                                            expandedSections.plantData ? 'rotate-180' : ''
                                        }`}
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                    >
                                        <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M19 9l-7 7-7-7"
                                        />
                                    </svg>
                                </button>
                                {expandedSections.plantData && (
                                    <div className="space-y-4">
                                        {/* Summary Section */}
                                        {plotWaterCalculations.length > 0 && (
                                            <div className="rounded-lg bg-gray-700 p-4">
                                                <h3 className="mb-3 text-lg font-semibold text-yellow-400">
                                                    📊 {t('สรุปข้อมูลแปลงปลูกทั้งหมด')}
                                                </h3>
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="rounded bg-gray-600 p-3 text-center">
                                                        <div className="text-2xl font-bold text-blue-400">
                                                            {plotWaterCalculations.length}
                                                        </div>
                                                        <div className="text-sm text-gray-300">
                                                            {t('จำนวนแปลงปลูก')}
                                                        </div>
                                                    </div>
                                                    <div className="rounded bg-gray-600 p-3 text-center">
                                                        <div className="text-2xl font-bold text-green-400">
                                                            {plotWaterCalculations.reduce(
                                                                (sum, plot) =>
                                                                    sum + plot.totalPlants,
                                                                0
                                                            )}
                                                        </div>
                                                        <div className="text-sm text-gray-300">
                                                            {t('จำนวนพืชทั้งหมด')}
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="mt-3 grid grid-cols-3 gap-2">
                                                    <div className="rounded bg-gray-600 p-2 text-center">
                                                        <div className="text-sm font-bold text-cyan-400">
                                                            {(() => {
                                                                // นับสปริงเกลอร์ทั้งหมดโดยตรงจาก irrigationElements
                                                                const elements =
                                                                    summaryData?.irrigationElements ||
                                                                    [];
                                                                return elements.filter(
                                                                    (e) => e.type === 'sprinkler'
                                                                ).length;
                                                            })()}
                                                        </div>
                                                        <div className="text-xs text-gray-300">
                                                            {t('สปริงเกลอร์ทั้งหมด')}
                                                        </div>
                                                    </div>
                                                    <div className="rounded bg-gray-600 p-2 text-center">
                                                        <div className="text-sm font-bold text-purple-400">
                                                            {(() => {
                                                                // นับจุดน้ำหยดทั้งหมดโดยตรงจาก irrigationElements
                                                                const elements =
                                                                    summaryData?.irrigationElements ||
                                                                    [];
                                                                const dripLines = elements.filter(
                                                                    (e) => e.type === 'drip-line'
                                                                );
                                                                let totalDripEmitters = 0;

                                                                dripLines.forEach((dripLine) => {
                                                                    if (
                                                                        dripLine.points.length >
                                                                            1 &&
                                                                        dripLine.spacing
                                                                    ) {
                                                                        let totalLength = 0;
                                                                        for (
                                                                            let i = 0;
                                                                            i <
                                                                            dripLine.points.length -
                                                                                1;
                                                                            i++
                                                                        ) {
                                                                            const p1 =
                                                                                dripLine.points[i];
                                                                            const p2 =
                                                                                dripLine.points[
                                                                                    i + 1
                                                                                ];
                                                                            const segmentLength =
                                                                                distanceBetweenPoints(
                                                                                    p1,
                                                                                    p2
                                                                                ) / 25; // Convert to meters
                                                                            totalLength +=
                                                                                segmentLength;
                                                                        }
                                                                        if (
                                                                            totalLength > 0 &&
                                                                            dripLine.spacing > 0
                                                                        ) {
                                                                            const emittersInThisLine =
                                                                                Math.floor(
                                                                                    totalLength /
                                                                                        dripLine.spacing
                                                                                ) + 1;
                                                                            totalDripEmitters +=
                                                                                emittersInThisLine;
                                                                        }
                                                                    }
                                                                });

                                                                return totalDripEmitters;
                                                            })()}
                                                        </div>
                                                        <div className="text-xs text-gray-300">
                                                            {t('จุดน้ำหยดทั้งหมด')}
                                                        </div>
                                                    </div>
                                                    <div className="rounded bg-gray-600 p-2 text-center">
                                                        <div className="text-sm font-bold text-orange-400">
                                                            {(() => {
                                                                // นับอุปกรณ์ให้น้ำทั้งหมด
                                                                const elements =
                                                                    summaryData?.irrigationElements ||
                                                                    [];
                                                                const sprinklerCount =
                                                                    elements.filter(
                                                                        (e) =>
                                                                            e.type === 'sprinkler'
                                                                    ).length;
                                                                const dripLines = elements.filter(
                                                                    (e) => e.type === 'drip-line'
                                                                );
                                                                let totalDripEmitters = 0;

                                                                dripLines.forEach((dripLine) => {
                                                                    if (
                                                                        dripLine.points.length >
                                                                            1 &&
                                                                        dripLine.spacing
                                                                    ) {
                                                                        let totalLength = 0;
                                                                        for (
                                                                            let i = 0;
                                                                            i <
                                                                            dripLine.points.length -
                                                                                1;
                                                                            i++
                                                                        ) {
                                                                            const p1 =
                                                                                dripLine.points[i];
                                                                            const p2 =
                                                                                dripLine.points[
                                                                                    i + 1
                                                                                ];
                                                                            const segmentLength =
                                                                                distanceBetweenPoints(
                                                                                    p1,
                                                                                    p2
                                                                                ) / 25; // Convert to meters
                                                                            totalLength +=
                                                                                segmentLength;
                                                                        }
                                                                        if (
                                                                            totalLength > 0 &&
                                                                            dripLine.spacing > 0
                                                                        ) {
                                                                            const emittersInThisLine =
                                                                                Math.floor(
                                                                                    totalLength /
                                                                                        dripLine.spacing
                                                                                ) + 1;
                                                                            totalDripEmitters +=
                                                                                emittersInThisLine;
                                                                        }
                                                                    }
                                                                });

                                                                return (
                                                                    sprinklerCount +
                                                                    totalDripEmitters
                                                                );
                                                            })()}
                                                        </div>
                                                        <div className="text-xs text-gray-300">
                                                            {t('อุปกรณ์ให้น้ำทั้งหมด')}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}

                                        {/* Individual Plot Details */}
                                        {plotWaterCalculations.length > 0 ? (
                                            plotWaterCalculations.map((plotWater, index) => {
                                                const plotPipe =
                                                    plotPipeData[index] ||
                                                    plotPipeData.find(
                                                        (p) => p.plotName === plotWater.plotName
                                                    );
                                                // Calculate flow rate based on number of emitters
                                                const flowRatePerUnit =
                                                    summaryData?.irrigationMethod === 'drip'
                                                        ? 0.24
                                                        : 10; // L/min per unit
                                                const totalEmitters = plotPipe?.totalEmitters || 0;

                                                // นับสปริงเกลอร์และจุดน้ำหยดโดยตรงจาก irrigationElements
                                                const elements =
                                                    summaryData?.irrigationElements || [];
                                                const sprinklers = elements.filter(
                                                    (e) => e.type === 'sprinkler'
                                                );
                                                const dripLines = elements.filter(
                                                    (e) => e.type === 'drip-line'
                                                );

                                                // หาพิกัดของแปลงปลูกจาก summaryData
                                                const plotShape = summaryData?.shapes?.find(
                                                    (s) =>
                                                        s.name === plotWater.plotName ||
                                                        s.id === plotWater.plotId
                                                );

                                                let actualSprinklerCount = 0;
                                                let actualDripCount = 0;

                                                if (plotShape && plotShape.points) {
                                                    // นับสปริงเกลอร์ในแปลงนี้
                                                    sprinklers.forEach((sprinkler) => {
                                                        if (sprinkler.points.length > 0) {
                                                            const sprinklerPoint =
                                                                sprinkler.points[0];

                                                            // ตรวจสอบว่าสปริงเกลอร์อยู่ในแปลงหรือไม่
                                                            const isInPlot = isPointInPolygon(
                                                                sprinklerPoint,
                                                                plotShape.points
                                                            );

                                                            // ตรวจสอบว่าสปริงเกลอร์อยู่ใกล้กับท่อย่อยในแปลงหรือไม่
                                                            let isNearSubPipeInPlot = false;
                                                            const subPipes = elements.filter(
                                                                (e) => e.type === 'sub-pipe'
                                                            );

                                                            if (!isInPlot) {
                                                                subPipes.forEach((subPipe) => {
                                                                    if (
                                                                        subPipeServesPlot(
                                                                            subPipe,
                                                                            plotShape.points
                                                                        )
                                                                    ) {
                                                                        for (
                                                                            let i = 0;
                                                                            i <
                                                                            subPipe.points.length -
                                                                                1;
                                                                            i++
                                                                        ) {
                                                                            const distance =
                                                                                distancePointToLineSegment(
                                                                                    sprinklerPoint,
                                                                                    subPipe.points[
                                                                                        i
                                                                                    ],
                                                                                    subPipe.points[
                                                                                        i + 1
                                                                                    ]
                                                                                );
                                                                            if (distance < 30) {
                                                                                // ระยะห่างน้อยกว่า 30 pixels
                                                                                isNearSubPipeInPlot = true;
                                                                                break;
                                                                            }
                                                                        }
                                                                    }
                                                                });
                                                            }

                                                            // นับสปริงเกลอร์ที่อยู่ในแปลงหรืออยู่ใกล้กับท่อย่อยในแปลง
                                                            if (isInPlot || isNearSubPipeInPlot) {
                                                                actualSprinklerCount++;
                                                            }
                                                        }
                                                    });

                                                    // นับหัวหยดในแปลงนี้
                                                    dripLines.forEach((dripLine) => {
                                                        if (
                                                            dripLine.points.length > 0 &&
                                                            dripLine.spacing
                                                        ) {
                                                            let dripLengthInPlot = 0;

                                                            for (
                                                                let i = 0;
                                                                i < dripLine.points.length - 1;
                                                                i++
                                                            ) {
                                                                const p1 = dripLine.points[i];
                                                                const p2 = dripLine.points[i + 1];

                                                                // ตรวจสอบว่าส่วนของท่อนี้อยู่ในแปลงหรือไม่
                                                                const midPoint = {
                                                                    x: (p1.x + p2.x) / 2,
                                                                    y: (p1.y + p2.y) / 2,
                                                                };

                                                                // ตรวจสอบว่าส่วนของท่อนี้อยู่ในแปลงหรืออยู่ใกล้ขอบแปลง
                                                                const p1InPlot = isPointInPolygon(
                                                                    p1,
                                                                    plotShape.points
                                                                );
                                                                const p2InPlot = isPointInPolygon(
                                                                    p2,
                                                                    plotShape.points
                                                                );
                                                                const midInPlot = isPointInPolygon(
                                                                    midPoint,
                                                                    plotShape.points
                                                                );

                                                                // ตรวจสอบว่าส่วนของท่อนี้อยู่ใกล้ขอบแปลงหรือไม่
                                                                const plotWidth =
                                                                    Math.max(
                                                                        ...plotShape.points.map(
                                                                            (p) => p.x
                                                                        )
                                                                    ) -
                                                                    Math.min(
                                                                        ...plotShape.points.map(
                                                                            (p) => p.x
                                                                        )
                                                                    );
                                                                const plotHeight =
                                                                    Math.max(
                                                                        ...plotShape.points.map(
                                                                            (p) => p.y
                                                                        )
                                                                    ) -
                                                                    Math.min(
                                                                        ...plotShape.points.map(
                                                                            (p) => p.y
                                                                        )
                                                                    );
                                                                const baseTolerance =
                                                                    Math.min(
                                                                        plotWidth,
                                                                        plotHeight
                                                                    ) * 0.05; // 5% ของขนาดแปลง
                                                                const p1DistanceToPlot =
                                                                    distancePointToPolygon(
                                                                        p1,
                                                                        plotShape.points
                                                                    );
                                                                const p2DistanceToPlot =
                                                                    distancePointToPolygon(
                                                                        p2,
                                                                        plotShape.points
                                                                    );
                                                                const midDistanceToPlot =
                                                                    distancePointToPolygon(
                                                                        midPoint,
                                                                        plotShape.points
                                                                    );
                                                                const p1NearPlotEdge =
                                                                    p1DistanceToPlot <=
                                                                    baseTolerance * 2;
                                                                const p2NearPlotEdge =
                                                                    p2DistanceToPlot <=
                                                                    baseTolerance * 2;
                                                                const midNearPlotEdge =
                                                                    midDistanceToPlot <=
                                                                    baseTolerance * 2;

                                                                if (
                                                                    p1InPlot ||
                                                                    p2InPlot ||
                                                                    midInPlot ||
                                                                    p1NearPlotEdge ||
                                                                    p2NearPlotEdge ||
                                                                    midNearPlotEdge
                                                                ) {
                                                                    const segmentLength =
                                                                        distanceBetweenPoints(
                                                                            p1,
                                                                            p2
                                                                        ) / 25; // แปลงเป็นเมตร
                                                                    dripLengthInPlot +=
                                                                        segmentLength;
                                                                }
                                                            }

                                                            // คำนวณจำนวนหัวหยด (ความยาวท่อ / ระยะห่าง + 1)
                                                            if (
                                                                dripLengthInPlot > 0 &&
                                                                dripLine.spacing > 0
                                                            ) {
                                                                const emittersInThisLine =
                                                                    Math.floor(
                                                                        dripLengthInPlot /
                                                                            dripLine.spacing
                                                                    ) + 1;
                                                                actualDripCount +=
                                                                    emittersInThisLine;
                                                            }
                                                        }
                                                    });
                                                }

                                                // นับจำนวนท่อย่อยในแปลงนี้
                                                let subPipeCount = 0;
                                                const subPipes = elements.filter(
                                                    (e) => e.type === 'sub-pipe'
                                                );

                                                if (plotShape && plotShape.points) {
                                                    subPipes.forEach((subPipe) => {
                                                        // ตรวจสอบว่าท่อย่อยนี้อยู่ในแปลงหรือไม่
                                                        if (
                                                            subPipeServesPlot(
                                                                subPipe,
                                                                plotShape.points
                                                            )
                                                        ) {
                                                            subPipeCount++;
                                                        }
                                                    });
                                                }

                                                // ใช้ข้อมูลอัตราการไหลจาก plotPipeData ที่คำนวณไว้แล้ว
                                                const calculatedFlowRate =
                                                    plotPipe?.totalFlowRate || 0;
                                                const totalFlowRate = calculatedFlowRate.toFixed(1);

                                                // Debug: ตรวจสอบการคำนวณอัตราการไหลในแต่ละแปลง
                                                console.log(
                                                    `🔍 ${plotWater.plotName} flow rate calculation:`,
                                                    {
                                                        plotName: plotWater.plotName,
                                                        plotIndex: index,
                                                        plotPipe: plotPipe,
                                                        totalEmitters: totalEmitters,
                                                        actualSprinklerCount: actualSprinklerCount,
                                                        actualDripCount: actualDripCount,
                                                        subPipeCount: subPipeCount,
                                                        flowRatePerUnit: flowRatePerUnit,
                                                        calculatedFlowRate: calculatedFlowRate,
                                                        totalFlowRate: totalFlowRate,
                                                        irrigationMethod:
                                                            summaryData?.irrigationMethod,
                                                        calculationMethod: 'direct_sprinkler_count',
                                                        expectedCalculation: `${actualSprinklerCount} × ${flowRatePerUnit} = ${calculatedFlowRate}`,
                                                    }
                                                );

                                                return (
                                                    <div
                                                        key={index}
                                                        className="rounded-lg border-l-4 border-blue-500 bg-gray-700 p-4"
                                                    >
                                                        <div className="mb-3 flex items-center justify-between">
                                                            <div className="flex items-center space-x-3">
                                                                <span className="text-2xl">
                                                                    {getCropIcon(
                                                                        plotWater.cropType
                                                                    )}
                                                                </span>
                                                                <div>
                                                                    <h3 className="text-lg font-semibold text-white">
                                                                        {plotWater.plotName}
                                                                    </h3>
                                                                    <p className="text-sm text-gray-400">
                                                                        {t('พืชที่ปลูก')}:{' '}
                                                                        {plotWater.cropName}
                                                                    </p>
                                                                    <p className="text-xs text-gray-500">
                                                                        {t('แปลงปลูกที่')}{' '}
                                                                        {index + 1} {t('จาก')}{' '}
                                                                        {
                                                                            plotWaterCalculations.length
                                                                        }{' '}
                                                                        {t('แปลง')}
                                                                    </p>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-sm text-gray-400">
                                                                    {t('สภาพแวดล้อมควบคุม')}
                                                                </div>
                                                                <div className="text-xs text-gray-500">
                                                                    {t('แปลงปลูก')}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Plant Information */}
                                                        <div className="mb-3 rounded bg-gray-600 p-3">
                                                            <h4 className="mb-2 text-sm font-semibold text-yellow-400">
                                                                🌱 {t('ข้อมูลการปลูก')}
                                                            </h4>
                                                            <div className="grid grid-cols-3 gap-2">
                                                                <div className="rounded bg-gray-500 p-2 text-center">
                                                                    <div className="text-sm font-bold text-green-400">
                                                                        {plotWater.totalPlants}
                                                                    </div>
                                                                    <div className="text-xs text-gray-300">
                                                                        {t('จำนวนพืช')}
                                                                    </div>
                                                                </div>
                                                                <div className="rounded bg-gray-500 p-2 text-center">
                                                                    <div className="text-sm font-bold text-blue-400">
                                                                        {plotWater.waterIntensity.litersPerSquareMeter.toFixed(
                                                                            1
                                                                        )}
                                                                    </div>
                                                                    <div className="text-xs text-gray-300">
                                                                        {t('ลิตร/ตร.ม./วัน')}
                                                                    </div>
                                                                </div>
                                                                <div className="rounded bg-gray-500 p-2 text-center">
                                                                    <div className="text-sm font-bold text-purple-400">
                                                                        {plotWater.dailyWaterNeed.optimal.toFixed(
                                                                            1
                                                                        )}
                                                                    </div>
                                                                    <div className="text-xs text-gray-300">
                                                                        {t('ลิตร/วัน')}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Flow Rate Section */}
                                                        <div className="mb-3 rounded bg-gray-600 p-3">
                                                            <h4 className="mb-3 text-sm font-semibold text-cyan-400">
                                                                💧 {t('อัตราการไหล')}
                                                            </h4>
                                                            <div className="text-center">
                                                                <div className="mb-1 text-2xl font-bold text-blue-400">
                                                                    {totalFlowRate} {t('ลิตร/นาที')}
                                                                </div>
                                                                <div className="text-xs text-gray-300">
                                                                    {t('อัตราการไหลของแปลงนี้')}
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Emitter/Sprinkler Count Section */}
                                                        <div className="mb-3 rounded bg-gray-600 p-3">
                                                            <h4 className="mb-3 text-sm font-semibold text-green-400">
                                                                🔧 {t('จำนวนอุปกรณ์ให้น้ำ')}
                                                            </h4>
                                                            <div className="grid grid-cols-2 gap-2">
                                                                {summaryData?.irrigationMethod ===
                                                                'drip' ? (
                                                                    <>
                                                                        <div className="rounded bg-gray-500 p-2 text-center">
                                                                            <div className="text-sm font-bold text-cyan-400">
                                                                                {plotPipe?.dripEmitterCount ||
                                                                                    0}
                                                                            </div>
                                                                            <div className="text-xs text-gray-300">
                                                                                {t('จุดน้ำหยด')}
                                                                            </div>
                                                                        </div>
                                                                        <div className="rounded bg-gray-500 p-2 text-center">
                                                                            <div className="text-sm font-bold text-blue-400">
                                                                                {(
                                                                                    summaryData?.dripEmitterFlowRate ||
                                                                                    0.24
                                                                                ).toFixed(2)}{' '}
                                                                                {t('ลิตร/นาที')}
                                                                            </div>
                                                                            <div className="text-xs text-gray-300">
                                                                                {t('ต่อจุด')}
                                                                            </div>
                                                                        </div>
                                                                    </>
                                                                ) : (
                                                                    <>
                                                                        <div className="rounded bg-gray-500 p-2 text-center">
                                                                            <div className="text-sm font-bold text-cyan-400">
                                                                                {plotPipe?.sprinklerCount ||
                                                                                    0}
                                                                            </div>
                                                                            <div className="text-xs text-gray-300">
                                                                                {t('สปริงเกลอร์')}
                                                                            </div>
                                                                        </div>
                                                                        <div className="rounded bg-gray-500 p-2 text-center">
                                                                            <div className="text-sm font-bold text-blue-400">
                                                                                {(
                                                                                    summaryData?.sprinklerFlowRate ||
                                                                                    10
                                                                                ).toFixed(2)}{' '}
                                                                                {t('ลิตร/นาที')}
                                                                            </div>
                                                                            <div className="text-xs text-gray-300">
                                                                                {t('ต่อตัว')}
                                                                            </div>
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Main and Sub Pipe Flow Rate and Outlet Count for This Plot */}
                                                        {plotPipe && plotPipe.hasPipes && (
                                                            <div className="mb-3 rounded bg-gray-600 p-3">
                                                                <h4 className="mb-3 text-sm font-semibold text-cyan-400">
                                                                    {t(
                                                                        'อัตราการไหลและจำนวนทางออกของท่อ'
                                                                    )}
                                                                </h4>
                                                                <div className="overflow-x-auto">
                                                                    <table className="w-full border-collapse border border-gray-500/50">
                                                                        <thead>
                                                                            <tr className="bg-gray-700/50">
                                                                                <th className="border border-gray-500/50 px-2 py-1 text-left text-xs font-semibold text-gray-200">
                                                                                    {t('ประเภทท่อ')}
                                                                                </th>
                                                                                <th className="border border-gray-500/50 px-2 py-1 text-left text-xs font-semibold text-gray-200">
                                                                                    {t(
                                                                                        'อัตราการไหล'
                                                                                    )}
                                                                                </th>
                                                                                <th className="border border-gray-500/50 px-2 py-1 text-left text-xs font-semibold text-gray-200">
                                                                                    {t(
                                                                                        'จำนวนทางออก'
                                                                                    )}
                                                                                </th>
                                                                            </tr>
                                                                        </thead>
                                                                        <tbody className="text-gray-100">
                                                                            <tr>
                                                                                <td className="border border-gray-500/50 px-2 py-1 text-xs">
                                                                                    {t('ท่อเมน')}
                                                                                </td>
                                                                                <td className="border border-gray-500/50 px-2 py-1 text-xs font-bold text-blue-400">
                                                                                    {(() => {
                                                                                        const mainFlowRate =
                                                                                            plotPipe?.totalFlowRate ||
                                                                                            0;
                                                                                        return mainFlowRate.toFixed(
                                                                                            2
                                                                                        );
                                                                                    })()}{' '}
                                                                                    {t('L/min')}
                                                                                </td>
                                                                                <td className="border border-gray-500/50 px-2 py-1 text-xs font-bold text-blue-400">
                                                                                    {(() => {
                                                                                        // คำนวณจำนวนท่อย่อยที่เชื่อมต่อกับแปลงนี้
                                                                                        const elements =
                                                                                            summaryData?.irrigationElements ||
                                                                                            [];
                                                                                        const subPipes =
                                                                                            elements.filter(
                                                                                                (
                                                                                                    e
                                                                                                ) =>
                                                                                                    e.type ===
                                                                                                    'sub-pipe'
                                                                                            );
                                                                                        const plotShape =
                                                                                            summaryData?.shapes?.find(
                                                                                                (
                                                                                                    s
                                                                                                ) =>
                                                                                                    s.name ===
                                                                                                        plotWater.plotName ||
                                                                                                    s.id ===
                                                                                                        plotWater.plotId
                                                                                            );

                                                                                        if (
                                                                                            plotShape &&
                                                                                            plotShape.points
                                                                                        ) {
                                                                                            return subPipes.filter(
                                                                                                (
                                                                                                    subPipe
                                                                                                ) =>
                                                                                                    subPipeServesPlot(
                                                                                                        subPipe,
                                                                                                        plotShape.points
                                                                                                    )
                                                                                            )
                                                                                                .length;
                                                                                        }
                                                                                        return 0;
                                                                                    })()}
                                                                                </td>
                                                                            </tr>
                                                                            <tr>
                                                                                <td className="border border-gray-500/50 px-2 py-1 text-xs">
                                                                                    {t(
                                                                                        'ท่อเมนย่อย'
                                                                                    )}
                                                                                </td>
                                                                                <td className="border border-gray-500/50 px-2 py-1 text-xs font-bold text-green-400">
                                                                                    {(() => {
                                                                                        const sprinklerFlowRate =
                                                                                            summaryData?.sprinklerFlowRate ||
                                                                                            10;
                                                                                        const longestSubPipeEmitters =
                                                                                            plotPipe?.longestSubPipeEmitters ||
                                                                                            0;

                                                                                        // คำนวณอัตราการไหลจากจำนวนทางออกในท่อย่อยที่ยาวที่สุด
                                                                                        // สมมติว่าเป็นสปริงเกลอร์ทั้งหมด (หรือปรับตาม irrigation method)
                                                                                        const flowRate =
                                                                                            longestSubPipeEmitters *
                                                                                            sprinklerFlowRate;
                                                                                        return flowRate.toFixed(
                                                                                            2
                                                                                        );
                                                                                    })()}{' '}
                                                                                    {t('L/min')}
                                                                                </td>
                                                                                <td className="border border-gray-500/50 px-2 py-1 text-xs font-bold text-green-400">
                                                                                    {
                                                                                        plotPipe.longestSubPipeEmitters
                                                                                    }
                                                                                </td>
                                                                            </tr>
                                                                        </tbody>
                                                                    </table>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {plotPipe && plotPipe.hasPipes ? (
                                                            <div className="mt-2 space-y-2">
                                                                <h4 className="mb-2 text-xs font-semibold text-orange-400">
                                                                    🔧 {t('ระบบท่อ')}
                                                                </h4>
                                                                <div className="grid grid-cols-3 gap-2">
                                                                    <div className="rounded bg-gray-600 p-2 text-center">
                                                                        <div className="text-xs font-bold text-blue-400">
                                                                            {plotPipe.maxMainPipeLength.toFixed(
                                                                                1
                                                                            )}{' '}
                                                                            {t('เมตร')}
                                                                        </div>
                                                                        <div className="text-xs text-gray-400">
                                                                            {t('ท่อเมนสูงสุด')}
                                                                        </div>
                                                                    </div>
                                                                    <div className="rounded bg-gray-600 p-2 text-center">
                                                                        <div className="text-xs font-bold text-green-400">
                                                                            {plotPipe.maxSubPipeLength.toFixed(
                                                                                1
                                                                            )}{' '}
                                                                            {t('เมตร')}
                                                                        </div>
                                                                        <div className="text-xs text-gray-400">
                                                                            {t('ท่อย่อยสูงสุด')}
                                                                        </div>
                                                                    </div>
                                                                    <div className="rounded bg-gray-600 p-2 text-center">
                                                                        <div className="text-xs font-bold text-purple-400">
                                                                            {plotPipe.maxTotalPipeLength.toFixed(
                                                                                1
                                                                            )}{' '}
                                                                            {t('เมตร')}
                                                                        </div>
                                                                        <div className="text-xs text-gray-400">
                                                                            {t('ความยาวสูงสุดรวม')}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                                <div className="grid grid-cols-3 gap-2">
                                                                    <div className="rounded bg-gray-600 p-2 text-center">
                                                                        <div className="text-xs font-bold text-cyan-400">
                                                                            {plotPipe.totalMainPipeLength.toFixed(
                                                                                1
                                                                            )}{' '}
                                                                            {t('เมตร')}
                                                                        </div>
                                                                        <div className="text-xs text-gray-400">
                                                                            {t('ท่อเมนทั้งหมด')}
                                                                        </div>
                                                                    </div>
                                                                    <div className="rounded bg-gray-600 p-2 text-center">
                                                                        <div className="text-xs font-bold text-yellow-400">
                                                                            {plotPipe.totalSubPipeLength.toFixed(
                                                                                1
                                                                            )}{' '}
                                                                            {t('เมตร')}
                                                                        </div>
                                                                        <div className="text-xs text-gray-400">
                                                                            {t('ท่อย่อยทั้งหมด')}
                                                                        </div>
                                                                    </div>
                                                                    <div className="rounded bg-gray-600 p-2 text-center">
                                                                        <div className="text-xs font-bold text-pink-400">
                                                                            {plotPipe.totalPipeLength.toFixed(
                                                                                1
                                                                            )}{' '}
                                                                            {t('เมตร')}
                                                                        </div>
                                                                        <div className="text-xs text-gray-400">
                                                                            {t('ความยาวรวมทั้งหมด')}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <div className="mt-2 rounded bg-gray-600 p-2 text-center">
                                                                <span className="text-xs text-gray-400">
                                                                    {t('ไม่มีระบบท่อในแปลงนี้')}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        ) : (
                                            <>
                                                {summaryData?.selectedCrops?.map((crop, index) => (
                                                    <div
                                                        key={index}
                                                        className="rounded-lg bg-gray-700 p-2"
                                                    >
                                                        <div className="flex items-center justify-between">
                                                            <div className="flex items-center space-x-2">
                                                                <span className="text-lg">
                                                                    {getCropIcon(crop)}
                                                                </span>
                                                                <div>
                                                                    <h3 className="text-sm font-semibold text-white">
                                                                        {crop}
                                                                    </h3>
                                                                </div>
                                                            </div>
                                                            <div className="text-right">
                                                                <div className="text-xs text-gray-400">
                                                                    {t('สภาพแวดล้อมควบคุม')}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )) || (
                                                    <div className="rounded-lg bg-gray-700 p-2 text-center">
                                                        <span className="text-sm text-gray-400">
                                                            {t('ไม่มีพืชที่เลือกไว้')}
                                                        </span>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>

                            <div className="hidden print:mt-8 print:block print:text-center">
                                <p className="text-xs text-gray-500">
                                    {t(
                                        'เอกสารนี้สร้างโดยระบบวางแผนโรงเรือนอัตโนมัติ - หน้า {num}/{total}'
                                    )
                                        .replace('{num}', '2')
                                        .replace('{total}', '2')}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="print:page-break-after-avoid hidden print:mt-8 print:block print:text-center">
                <p className="text-xs text-gray-500">
                    {t('เอกสารนี้สร้างโดยระบบวางแผนโรงเรือนอัตโนมัติ - หน้า {num}/{total}')
                        .replace('{num}', '1')
                        .replace('{total}', '2')}
                </p>
            </div>
        </div>
    );
}
