/* eslint-disable @typescript-eslint/no-explicit-any */
import {
    HorticultureProjectData,
    ProjectSummaryData,
    ZoneSummaryData,
    calculateProjectSummary,
    loadProjectData,
    formatAreaInRai,
    formatDistance,
    formatWaterVolume,
    EnhancedProjectData,
    BestPipeInfo,
    isCoordinateInZone,
    calculateWaterFlowRate,
    isPointInPolygon,
    calculateDistanceBetweenPoints,
} from './horticultureUtils';
import {
    loadSprinklerConfig,
    calculateTotalFlowRate,
    formatFlowRate,
    formatFlowRatePerHour,
} from './sprinklerUtils';
import {
    findMainToSubMainConnections,
    findEndToEndConnections,
    findMidConnections,
    findSubMainToLateralStartConnections,
    findLateralSubMainIntersection,
    findClosestConnectionPoint,
    findLineIntersection,
    findSubMainToMainIntersections,
    findLateralToSubMainIntersections,
} from './lateralPipeUtils';

interface SprinklerFlowRateInfo {
    totalFlowRatePerMinute: number;
    totalFlowRatePerHour: number;
    formattedFlowRatePerMinute: string;
    formattedFlowRatePerHour: string;
    flowRatePerPlant: number;
    pressureBar: number;
}

/**
 * ดึงข้อมูลสถิติโครงการจาก localStorage
 * @returns ProjectSummaryData หรือ null ถ้าไม่มีข้อมูล
 */
export const getProjectStats = (): ProjectSummaryData | null => {
    try {
        const projectData = loadProjectData();
        if (!projectData) {
            return null;
        }

        const summary = calculateProjectSummary(projectData);
        return summary;
    } catch (error) {
        console.error('Error getting project stats:', error);
        return null;
    }
};

/**
 * ดึงข้อมูลสถิติจากข้อมูลโครงการที่ส่งเข้ามา
 * @param projectData ข้อมูลโครงการ
 * @returns ProjectSummaryData
 */
export const getProjectStatsFromData = (
    projectData: HorticultureProjectData
): ProjectSummaryData => {
    return calculateProjectSummary(projectData);
};

/**
 * ดึงข้อมูลโดยรวมของโครงการพร้อมข้อมูลหัวฉีด
 * @returns ข้อมูลโดยรวม หรือ null ถ้าไม่มีข้อมูล
 */
export const getOverallStats = (): {
    totalAreaInRai: number;
    totalZones: number;
    totalPlants: number;
    totalWaterNeedPerSession: number;
    longestPipesCombined: number;
    sprinklerFlowRate?: SprinklerFlowRateInfo;
} | null => {
    const stats = getProjectStats();
    if (!stats) return null;

    // ดึงข้อมูลหัวฉีด
    const sprinklerConfig = loadSprinklerConfig();
    let sprinklerFlowRate: SprinklerFlowRateInfo | undefined = undefined;

    if (sprinklerConfig && stats.totalPlants > 0) {
        const totalFlowRatePerMinute = calculateTotalFlowRate(
            stats.totalPlants,
            sprinklerConfig.flowRatePerMinute
        );
        const totalFlowRatePerHour = totalFlowRatePerMinute * 60;

        sprinklerFlowRate = {
            totalFlowRatePerMinute,
            totalFlowRatePerHour,
            formattedFlowRatePerMinute: formatFlowRate(totalFlowRatePerMinute),
            formattedFlowRatePerHour: formatFlowRatePerHour(totalFlowRatePerHour),
            flowRatePerPlant: sprinklerConfig.flowRatePerMinute,
            pressureBar: sprinklerConfig.pressureBar,
        };
    }

    return {
        totalAreaInRai: stats.totalAreaInRai,
        totalZones: stats.totalZones,
        totalPlants: stats.totalPlants,
        totalWaterNeedPerSession: stats.totalWaterNeedPerSession,
        longestPipesCombined: stats.longestPipesCombined,
        sprinklerFlowRate,
    };
};

/**
 * ดึงข้อมูลระบบท่อ
 * @returns ข้อมูลระบบท่อ หรือ null ถ้าไม่มีข้อมูล
 */
export const getPipeStats = (): {
    mainPipes: { longest: number; totalLength: number };
    subMainPipes: { longest: number; totalLength: number };
    branchPipes: { longest: number; totalLength: number };
    longestPipesCombined: number;
} | null => {
    const stats = getProjectStats();
    if (!stats) return null;

    return {
        mainPipes: stats.mainPipes,
        subMainPipes: stats.subMainPipes,
        branchPipes: stats.branchPipes,
        longestPipesCombined: stats.longestPipesCombined,
    };
};

/**
 * ดึงข้อมูลแยกโซน
 * @returns อาร์เรย์ข้อมูลโซน หรือ array ว่างถ้าไม่มีข้อมูล
 */
export const getZoneStats = (): ZoneSummaryData[] => {
    const stats = getProjectStats();
    if (!stats) return [];

    return stats.zoneDetails;
};

/**
 * ดึงข้อมูลโซนเฉพาะโซน
 * @param zoneId ID ของโซนที่ต้องการ
 * @returns ข้อมูลโซน หรือ null ถ้าไม่พบ
 */
export const getZoneStatsById = (zoneId: string): ZoneSummaryData | null => {
    const zones = getZoneStats();
    return zones.find((zone) => zone.zoneId === zoneId) || null;
};

/**
 * ดึงข้อมูลท่อย่อยที่ยาวที่สุดในแต่ละโซน พร้อมจำนวนต้นไม้
 * @returns ข้อมูลท่อย่อยที่ยาวที่สุดในแต่ละโซน หรือ null ถ้าไม่มีข้อมูล
 */
export const getLongestBranchPipeStats = ():
    | {
          zoneId: string;
          zoneName: string;
          longestBranchPipe: {
              id: string;
              length: number;
              plantCount: number;
              plantNames: string[];
          };
      }[]
    | null => {
    try {
        const projectData = loadProjectData();
        if (!projectData) {
            return null;
        }

        const stats: {
            zoneId: string;
            zoneName: string;
            longestBranchPipe: {
                id: string;
                length: number;
                plantCount: number;
                plantNames: string[];
            };
        }[] = [];

        const allBranchPipes =
            projectData.subMainPipes?.flatMap((subMain) => subMain.branchPipes || []) || [];

        if (allBranchPipes.length > 0) {
            const longestBranchPipe = allBranchPipes.reduce((longest, current) =>
                current.length > longest.length ? current : longest
            );

            const plantCount = longestBranchPipe.plants?.length || 0;
            const plantNames = longestBranchPipe.plants?.map((plant) => plant.plantData.name) || [];

            stats.push({
                zoneId: 'main-area',
                zoneName: 'พื้นที่หลัก',
                longestBranchPipe: {
                    id: longestBranchPipe.id,
                    length: longestBranchPipe.length,
                    plantCount,
                    plantNames,
                },
            });
        }

        return stats;
    } catch (error) {
        console.error('Error getting longest branch pipe stats:', error);
        return null;
    }
};

/**
 * ดึงข้อมูลจำนวนท่อย่อยที่ออกจากท่อเมนรองในแต่ละโซน
 * @returns ข้อมูลจำนวนท่อย่อยที่ออกจากท่อเมนรองในแต่ละโซน หรือ null ถ้าไม่มีข้อมูล
 */
export const getSubMainPipeBranchCount = ():
    | {
          zoneId: string;
          zoneName: string;
          subMainPipes: {
              id: string;
              length: number;
              branchCount: number;
              totalBranchLength: number;
          }[];
      }[]
    | null => {
    try {
        const projectData = loadProjectData();
        if (!projectData) {
            return null;
        }

        const stats: {
            zoneId: string;
            zoneName: string;
            subMainPipes: {
                id: string;
                length: number;
                branchCount: number;
                totalBranchLength: number;
            }[];
        }[] = [];

        const allSubMainPipes = projectData.subMainPipes || [];

        const subMainPipesData = allSubMainPipes.map((subMain) => {
            let branchCount = subMain.branchPipes?.length || 0;
            let totalBranchLength =
                subMain.branchPipes?.reduce((sum, branch) => sum + branch.length, 0) || 0;

            if (projectData.lateralPipes) {
                const lateralConnections = findSubMainToLateralStartConnections(
                    [subMain],
                    projectData.lateralPipes,
                    projectData.zones || [],
                    projectData.irrigationZones || [],
                    100
                );

                branchCount += lateralConnections.length;
                for (const lateralConnection of lateralConnections) {
                    const lateral = projectData.lateralPipes.find(
                        (lp) => lp.id === lateralConnection.lateralPipeId
                    );
                    if (lateral && lateral.length) {
                        totalBranchLength += lateral.length;
                    }
                }
            }

            return {
                id: subMain.id,
                length: subMain.length,
                branchCount,
                totalBranchLength,
            };
        });

        if (subMainPipesData.length > 0) {
            stats.push({
                zoneId: 'main-area',
                zoneName: 'พื้นที่หลัก',
                subMainPipes: subMainPipesData,
            });
        }

        return stats;
    } catch (error) {
        console.error('Error getting sub main pipe branch count:', error);
        return null;
    }
};

/**
 * ดึงข้อมูลสถิติท่อย่อยแบบละเอียด
 * @returns ข้อมูลสถิติท่อย่อยแบบละเอียด หรือ null ถ้าไม่มีข้อมูล
 */
export const getDetailedBranchPipeStats = ():
    | {
          zoneId: string;
          zoneName: string;
          longestBranchPipe: {
              id: string;
              length: number;
              plantCount: number;
              plantNames: string[];
          };
          subMainPipes: {
              id: string;
              length: number;
              branchCount: number;
              totalBranchLength: number;
          }[];
      }[]
    | null => {
    try {
        const longestBranchStats = getLongestBranchPipeStats();
        const subMainBranchCount = getSubMainPipeBranchCount();

        if (!longestBranchStats || !subMainBranchCount) {
            return null;
        }

        const detailedStats = longestBranchStats.map((longestStat) => {
            const subMainData = subMainBranchCount.find(
                (subMain) => subMain.zoneId === longestStat.zoneId
            );

            return {
                zoneId: longestStat.zoneId,
                zoneName: longestStat.zoneName,
                longestBranchPipe: longestStat.longestBranchPipe,
                subMainPipes: subMainData?.subMainPipes || [],
            };
        });

        return detailedStats;
    } catch (error) {
        console.error('Error getting detailed branch pipe stats:', error);
        return null;
    }
};

/**
 * Export branch pipe stats as JSON string
 * @returns JSON string of branch pipe stats or null if no data
 */
export const exportBranchPipeStatsAsJSON = (): string | null => {
    const stats = getDetailedBranchPipeStats();
    if (!stats) return null;

    const exportData = {
        branchPipeStats: stats,
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
    };

    return JSON.stringify(exportData, null, 2);
};

/**
 * Export branch pipe stats as CSV string
 * @returns CSV string of branch pipe stats or null if no data
 */
export const exportBranchPipeStatsAsCSV = (): string | null => {
    const stats = getDetailedBranchPipeStats();
    if (!stats) return null;

    let csv =
        'Zone ID,Zone Name,Longest Branch Pipe ID,Longest Branch Pipe Length (m),Plant Count in Longest Branch,Plant Names in Longest Branch,Sub-Main Pipe ID,Sub-Main Pipe Length (m),Branch Count from Sub-Main,Total Branch Length from Sub-Main (m)\n';

    stats.forEach((zone) => {
        if (zone.subMainPipes.length > 0) {
            zone.subMainPipes.forEach((subMain) => {
                csv += `"${zone.zoneId}","${zone.zoneName}","${zone.longestBranchPipe.id}",${zone.longestBranchPipe.length.toFixed(2)},${zone.longestBranchPipe.plantCount},"${zone.longestBranchPipe.plantNames.join(', ')}","${subMain.id}",${subMain.length.toFixed(2)},${subMain.branchCount},${subMain.totalBranchLength.toFixed(2)}\n`;
            });
        } else {
            csv += `"${zone.zoneId}","${zone.zoneName}","${zone.longestBranchPipe.id}",${zone.longestBranchPipe.length.toFixed(2)},${zone.longestBranchPipe.plantCount},"${zone.longestBranchPipe.plantNames.join(', ')}","","","",""\n`;
        }
    });

    return csv;
};

/**
 * Download branch pipe stats as JSON file
 * @param filename name of the file (without extension)
 */
export const downloadBranchPipeStatsAsJSON = (filename: string = 'branch-pipe-stats'): void => {
    const jsonData = exportBranchPipeStatsAsJSON();
    if (!jsonData) {
        return;
    }

    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

/**
 * Download branch pipe stats as CSV file
 * @param filename name of the file (without extension)
 */
export const downloadBranchPipeStatsAsCSV = (filename: string = 'branch-pipe-stats'): void => {
    const csvData = exportBranchPipeStatsAsCSV();
    if (!csvData) {
        return;
    }

    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

/**
 * Get formatted branch pipe stats
 * @returns Formatted string of branch pipe stats or null if no data
 */
export const getFormattedBranchPipeStats = (): string | null => {
    const stats = getDetailedBranchPipeStats();
    if (!stats) return null;

    let formatted = `🔧 รายงานสถิติท่อย่อยแบบละเอียด\n\n`;

    stats.forEach((zone, index) => {
        formatted += `🏞️ ${index + 1}. ${zone.zoneName}:\n`;
        formatted += `  📏 ท่อย่อยที่ยาวที่สุด:\n`;
        formatted += `    • ID: ${zone.longestBranchPipe.id}\n`;
        formatted += `    • ความยาว: ${formatDistance(zone.longestBranchPipe.length)}\n`;
        formatted += `    • จำนวนต้นไม้: ${zone.longestBranchPipe.plantCount} ต้น\n`;
        formatted += `    • ชนิดพืช: ${zone.longestBranchPipe.plantNames.join(', ') || 'ไม่ระบุ'}\n\n`;

        if (zone.subMainPipes.length > 0) {
            formatted += `  🔗 ท่อเมนรองในโซน:\n`;
            zone.subMainPipes.forEach((subMain, subIndex) => {
                formatted += `    ${subIndex + 1}. ท่อ ${subMain.id}:\n`;
                formatted += `       • ความยาว: ${formatDistance(subMain.length)}\n`;
                formatted += `       • จำนวนท่อย่อย: ${subMain.branchCount} เส้น\n`;
                formatted += `       • ความยาวท่อย่อยรวม: ${formatDistance(subMain.totalBranchLength)}\n`;
            });
        } else {
            formatted += `  ⚠️ ไม่มีท่อเมนรองในโซนนี้\n`;
        }
        formatted += `\n`;
    });

    formatted += `📅 สร้างรายงาน: ${new Date().toLocaleDateString('th-TH')}`;

    return formatted;
};

/**
 * Export stats as JSON string
 * @returns JSON string of stats or null if no data
 */
export const exportStatsAsJSON = (): string | null => {
    const stats = getProjectStats();
    if (!stats) return null;

    const exportData = {
        summary: stats,
        exportedAt: new Date().toISOString(),
        version: '1.0.0',
    };

    return JSON.stringify(exportData, null, 2);
};

/**
 * Export stats as CSV string
 * @returns CSV string of stats or null if no data
 */
export const exportStatsAsCSV = (): string | null => {
    const stats = getProjectStats();
    if (!stats) return null;

    let csv =
        'Zone Name,Area (Rai),Plant Count,Water Need (L),Main Pipe Longest (m),Main Pipe Total (m),Sub-Main Pipe Longest (m),Sub-Main Pipe Total (m),Branch Pipe Longest (m),Branch Pipe Total (m)\n';

    stats.zoneDetails.forEach((zone) => {
        csv += `"${zone.zoneName}",${zone.areaInRai.toFixed(2)},${zone.plantCount},${zone.waterNeedPerSession.toFixed(2)},${zone.mainPipesInZone.longest.toFixed(2)},${zone.mainPipesInZone.totalLength.toFixed(2)},${zone.subMainPipesInZone.longest.toFixed(2)},${zone.subMainPipesInZone.totalLength.toFixed(2)},${zone.branchPipesInZone.longest.toFixed(2)},${zone.branchPipesInZone.totalLength.toFixed(2)}\n`;
    });

    return csv;
};

/**
 * Create map image from HTML element
 * @param mapElement HTML element of the map
 * @param options options for creating the image
 * @returns Promise<string | null> Data URL of the image or null if failed
 */
export const createMapImage = async (
    mapElement: HTMLElement,
    options: {
        quality?: number;
        scale?: number;
        backgroundColor?: string;
        filename?: string;
    } = {}
): Promise<string | null> => {
    if (!mapElement) {
        console.error('❌ ไม่พบ map element');
        return null;
    }

    const { quality = 0.9, scale = 2, backgroundColor = '#1F2937' } = options;

    try {
        await new Promise((resolve) => setTimeout(resolve, 2000));
        const html2canvas = await import('html2canvas');
        const html2canvasLib = html2canvas.default || html2canvas;
        const canvas = await html2canvasLib(mapElement, {
            useCORS: true,
            allowTaint: false,
            scale: scale,
            logging: false,
            backgroundColor: backgroundColor,
            width: mapElement.offsetWidth,
            height: mapElement.offsetHeight,
            onclone: (clonedDoc) => {
                try {
                    const controls = clonedDoc.querySelectorAll('.leaflet-control-container');
                    controls.forEach((el) => el.remove());

                    const elements = clonedDoc.querySelectorAll('*');
                    elements.forEach((el: Element) => {
                        const htmlEl = el as HTMLElement;
                        if (htmlEl.style.color?.includes('oklch')) {
                            htmlEl.style.color = 'rgb(255, 255, 255)';
                        }
                        if (htmlEl.style.backgroundColor?.includes('oklch')) {
                            htmlEl.style.backgroundColor = 'transparent';
                        }
                    });
                } catch (error) {
                    console.warn('⚠️ คำเตือนใน onclone:', error);
                }
            },
        });

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        return dataUrl;
    } catch (error) {
        console.error('❌ เกิดข้อผิดพลาดในการสร้างภาพ:', error);

        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            if (ctx) {
                canvas.width = mapElement.offsetWidth || 800;
                canvas.height = mapElement.offsetHeight || 600;

                ctx.fillStyle = backgroundColor;
                ctx.fillRect(0, 0, canvas.width, canvas.height);

                ctx.fillStyle = '#FFFFFF';
                ctx.font = '24px Arial';
                ctx.textAlign = 'center';
                ctx.fillText('แผนผังระบบน้ำสวนผลไม้', canvas.width / 2, canvas.height / 2 - 40);
                ctx.fillText('(ไม่สามารถสร้างภาพแผนที่ได้)', canvas.width / 2, canvas.height / 2);
                ctx.fillText('กรุณาใช้ screenshot แทน', canvas.width / 2, canvas.height / 2 + 40);

                return canvas.toDataURL('image/jpeg', 0.8);
            }
        } catch (fallbackError) {
            console.error('❌ การสร้างภาพ fallback ล้มเหลว:', fallbackError);
        }

        return null;
    }
};

/**
 * Download image
 * @param dataUrl Data URL of the image
 * @param filename name of the file (including extension)
 */
export const downloadImage = (
    dataUrl: string,
    filename: string = 'horticulture-layout.jpg'
): void => {
    try {
        const link = document.createElement('a');
        link.download = filename;
        link.href = dataUrl;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } catch (error) {
        console.error('❌ เกิดข้อผิดพลาดในการดาวน์โหลดภาพ:', error);
        try {
            window.open(dataUrl);
        } catch (fallbackError) {
            console.error('❌ การดาวน์โหลด fallback ล้มเหลว:', fallbackError);
        }
    }
};

/**
 * สร้างและดาวน์โหลดภาพแผนที่
 * @param mapElement HTML element ของแผนที่
 * @param options ตัวเลือกการสร้างและดาวน์โหลด
 * @returns Promise<boolean> สำเร็จหรือไม่
 */
export const createAndDownloadMapImage = async (
    mapElement: HTMLElement,
    options: {
        quality?: number;
        scale?: number;
        backgroundColor?: string;
        filename?: string;
    } = {}
): Promise<boolean> => {
    try {
        const projectData = loadProjectData();
        const defaultFilename = projectData?.projectName
            ? `${projectData.projectName.replace(/[^a-zA-Z0-9ก-ฮ]/g, '-')}-layout.jpg`
            : 'horticulture-layout.jpg';

        const finalOptions = {
            filename: defaultFilename,
            ...options,
        };

        const imageUrl = await createMapImage(mapElement, finalOptions);

        if (imageUrl) {
            downloadImage(imageUrl, finalOptions.filename);
            return true;
        }

        return false;
    } catch (error) {
        console.error('❌ เกิดข้อผิดพลาดในการสร้างและดาวน์โหลดภาพ:', error);
        return false;
    }
};

/**
 * สร้างภาพ PDF จากข้อมูลสถิติ (ต้องติดตั้ง jsPDF)
 * @param includeMap รวมภาพแผนที่หรือไม่
 * @param mapElement HTML element ของแผนที่ (ถ้า includeMap = true)
 * @returns Promise<boolean> สำเร็จหรือไม่
 */
export const createPDFReport = async (
    includeMap: boolean = false,
    mapElement?: HTMLElement
): Promise<boolean> => {
    try {
        const stats = getProjectStats();
        if (!stats) {
            console.error('❌ ไม่พบข้อมูลสถิติ');
            return false;
        }

        const jsPDFModule = await import('jspdf');
        const jsPDF = jsPDFModule.default;

        const doc = new jsPDF('p', 'mm', 'a4');

        let yPosition = 20;

        doc.setFontSize(20);
        doc.text('รายงานโครงการระบบน้ำสวนผลไม้', 105, yPosition, { align: 'center' });
        yPosition += 15;

        doc.setFontSize(16);
        doc.text('ข้อมูลโดยรวม', 20, yPosition);
        yPosition += 10;

        doc.setFontSize(12);
        doc.text(`พื้นที่รวม: ${formatAreaInRai(stats.totalAreaInRai)}`, 20, yPosition);
        yPosition += 7;
        doc.text(`จำนวนโซน: ${stats.totalZones} โซน`, 20, yPosition);
        yPosition += 7;
        doc.text(`จำนวนต้นไม้: ${stats.totalPlants.toLocaleString()} ต้น`, 20, yPosition);
        yPosition += 7;
        doc.text(
            `ปริมาณน้ำต่อครั้ง: ${formatWaterVolume(stats.totalWaterNeedPerSession)}`,
            20,
            yPosition
        );
        yPosition += 15;

        doc.setFontSize(16);
        doc.text('ระบบท่อ', 20, yPosition);
        yPosition += 10;

        doc.setFontSize(12);
        doc.text(`ท่อเมนยาวที่สุด: ${formatDistance(stats.mainPipes.longest)}`, 20, yPosition);
        yPosition += 7;
        doc.text(`ท่อเมนยาวรวม: ${formatDistance(stats.mainPipes.totalLength)}`, 20, yPosition);
        yPosition += 7;
        doc.text(
            `ท่อเมนรองยาวที่สุด: ${formatDistance(stats.subMainPipes.longest)}`,
            20,
            yPosition
        );
        yPosition += 7;
        doc.text(
            `ท่อเมนรองยาวรวม: ${formatDistance(stats.subMainPipes.totalLength)}`,
            20,
            yPosition
        );
        yPosition += 7;
        doc.text(`ท่อย่อยยาวที่สุด: ${formatDistance(stats.branchPipes.longest)}`, 20, yPosition);
        yPosition += 7;
        doc.text(`ท่อย่อยยาวรวม: ${formatDistance(stats.branchPipes.totalLength)}`, 20, yPosition);
        yPosition += 7;
        doc.text(
            `ท่อที่ยาวที่สุดรวมกัน: ${formatDistance(stats.longestPipesCombined)}`,
            20,
            yPosition
        );
        yPosition += 15;

        if (stats.zoneDetails.length > 1) {
            doc.setFontSize(16);
            doc.text('รายละเอียดแต่ละโซน', 20, yPosition);
            yPosition += 10;

            doc.setFontSize(12);
            stats.zoneDetails.forEach((zone, index) => {
                if (yPosition > 250) {
                    doc.addPage();
                    yPosition = 20;
                }

                doc.text(`${index + 1}. ${zone.zoneName}`, 20, yPosition);
                yPosition += 7;
                doc.text(`   พื้นที่: ${formatAreaInRai(zone.areaInRai)}`, 25, yPosition);
                yPosition += 5;
                doc.text(`   ต้นไม้: ${zone.plantCount.toLocaleString()} ต้น`, 25, yPosition);
                yPosition += 5;
                doc.text(
                    `   น้ำต่อครั้ง: ${formatWaterVolume(zone.waterNeedPerSession)}`,
                    25,
                    yPosition
                );
                yPosition += 8;
            });
        }

        if (includeMap && mapElement) {
            const mapImage = await createMapImage(mapElement, { scale: 1, quality: 0.8 });
            if (mapImage) {
                doc.addPage();
                doc.setFontSize(16);
                doc.text('แผนผังโครงการ', 105, 20, { align: 'center' });

                const imgWidth = 170;
                const imgHeight = 120;
                doc.addImage(mapImage, 'JPEG', 20, 30, imgWidth, imgHeight);
            }
        }

        const projectData = loadProjectData();
        const filename = projectData?.projectName
            ? `${projectData.projectName.replace(/[^a-zA-Z0-9ก-ฮ]/g, '-')}-report.pdf`
            : 'horticulture-report.pdf';

        doc.save(filename);
        return true;
    } catch (error) {
        console.error('❌ เกิดข้อผิดพลาดในการสร้าง PDF:', error);
        return false;
    }
};

/**
 * Download stats as JSON file
 * @param filename name of the file (without extension)
 */
export const downloadStatsAsJSON = (filename: string = 'horticulture-stats'): void => {
    const jsonData = exportStatsAsJSON();
    if (!jsonData) {
        console.error('ไม่มีข้อมูลสถิติให้ดาวน์โหลด');
        return;
    }

    const blob = new Blob([jsonData], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.json`;
    a.click();
    URL.revokeObjectURL(url);
};

/**
 * Download stats as CSV file
 * @param filename name of the file (without extension)
 */
export const downloadStatsAsCSV = (filename: string = 'horticulture-stats'): void => {
    const csvData = exportStatsAsCSV();
    if (!csvData) {
        console.error('ไม่มีข้อมูลสถิติให้ดาวน์โหลด');
        return;
    }

    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
};

/**
 * Get formatted stats พร้อมข้อมูลหัวฉีด
 * @returns Formatted string of stats or null if no data
 */
export const getFormattedStats = (): string | null => {
    const stats = getProjectStats();
    if (!stats) return null;

    const overallStats = getOverallStats();

    let formatted = `📊 รายงานสถิติโครงการระบบน้ำสวนผลไม้\n\n`;

    formatted += `📐 ข้อมูลโดยรวม:\n`;
    formatted += `  • พื้นที่รวม: ${formatAreaInRai(stats.totalAreaInRai)}\n`;
    formatted += `  • จำนวนโซน: ${stats.totalZones} โซน\n`;
    formatted += `  • จำนวนต้นไม้: ${stats.totalPlants.toLocaleString()} ต้น\n`;
    formatted += `  • ปริมาณน้ำต่อครั้ง: ${formatWaterVolume(stats.totalWaterNeedPerSession)}\n`;

    if (overallStats?.sprinklerFlowRate) {
        formatted += `\n🚿 ข้อมูลหัวฉีด:\n`;
        formatted += `  • อัตราการไหลต่อต้น: ${overallStats.sprinklerFlowRate.flowRatePerPlant.toFixed(2)} ลิตร/นาที\n`;
        formatted += `  • Q รวมต่อนาที: ${overallStats.sprinklerFlowRate.formattedFlowRatePerMinute}\n`;
        formatted += `  • Q รวมต่อชั่วโมง: ${overallStats.sprinklerFlowRate.formattedFlowRatePerHour}\n`;
        formatted += `  • แรงดันน้ำ: ${overallStats.sprinklerFlowRate.pressureBar.toFixed(1)} บาร์\n`;
    }
    formatted += `\n`;

    formatted += `🔧 ระบบท่อ:\n`;
    formatted += `  • ท่อเมนยาวที่สุด: ${formatDistance(stats.mainPipes.longest)}\n`;
    formatted += `  • ท่อเมนยาวรวม: ${formatDistance(stats.mainPipes.totalLength)}\n`;
    formatted += `  • ท่อเมนรองยาวที่สุด: ${formatDistance(stats.subMainPipes.longest)}\n`;
    formatted += `  • ท่อเมนรองยาวรวม: ${formatDistance(stats.subMainPipes.totalLength)}\n`;
    formatted += `  • ท่อย่อยยาวที่สุด: ${formatDistance(stats.branchPipes.longest)}\n`;
    formatted += `  • ท่อย่อยยาวรวม: ${formatDistance(stats.branchPipes.totalLength)}\n`;
    formatted += `  • ท่อที่ยาวที่สุดรวมกัน: ${formatDistance(stats.longestPipesCombined)}\n\n`;

    if (stats.zoneDetails.length > 1) {
        formatted += `🏞️ รายละเอียดแต่ละโซน:\n`;
        stats.zoneDetails.forEach((zone, index) => {
            formatted += `  ${index + 1}. ${zone.zoneName}:\n`;
            formatted += `     • พื้นที่: ${formatAreaInRai(zone.areaInRai)}\n`;
            formatted += `     • ต้นไม้: ${zone.plantCount.toLocaleString()} ต้น\n`;
            formatted += `     • น้ำต่อครั้ง: ${formatWaterVolume(zone.waterNeedPerSession)}\n`;
            formatted += `     • ท่อเมนยาวที่สุด: ${formatDistance(zone.mainPipesInZone.longest)}\n`;
            formatted += `     • ท่อเมนรองยาวที่สุด: ${formatDistance(zone.subMainPipesInZone.longest)}\n`;
            formatted += `     • ท่อย่อยยาวที่สุด: ${formatDistance(zone.branchPipesInZone.longest)}\n`;
        });
    }

    formatted += `\n📅 สร้างรายงาน: ${new Date().toLocaleDateString('th-TH')}`;

    return formatted;
};

/**
 * Debug stats
 */
export const debugProjectStats = (): void => {
    console.group('🔍 Debug Project Statistics');

    const stats = getProjectStats();
    if (!stats) {
        console.groupEnd();
        return;
    }

    console.groupEnd();
};

if (typeof window !== 'undefined') {
    (window as unknown as { horticultureStats: unknown }).horticultureStats = {
        getProjectStats,
        getOverallStats,
        getPipeStats,
        getZoneStats,
        getZoneStatsById,
        exportStatsAsJSON,
        exportStatsAsCSV,
        downloadStatsAsJSON,
        downloadStatsAsCSV,
        getFormattedStats,
        debugProjectStats,
        createMapImage,
        downloadImage,
        createAndDownloadMapImage,
        createPDFReport,
        getLongestBranchPipeStats,
        getSubMainPipeBranchCount,
        getDetailedBranchPipeStats,
        exportBranchPipeStatsAsJSON,
        exportBranchPipeStatsAsCSV,
        downloadBranchPipeStatsAsJSON,
        downloadBranchPipeStatsAsCSV,
        getFormattedBranchPipeStats,
    };
}

export default {
    getProjectStats,
    getProjectStatsFromData,
    getOverallStats,
    getPipeStats,
    getZoneStats,
    getZoneStatsById,
    exportStatsAsJSON,
    exportStatsAsCSV,
    downloadStatsAsJSON,
    downloadStatsAsCSV,
    getFormattedStats,
    debugProjectStats,
    createMapImage,
    downloadImage,
    createAndDownloadMapImage,
    createPDFReport,
    getLongestBranchPipeStats,
    getSubMainPipeBranchCount,
    getDetailedBranchPipeStats,
    exportBranchPipeStatsAsJSON,
    exportBranchPipeStatsAsCSV,
    downloadBranchPipeStatsAsJSON,
    downloadBranchPipeStatsAsCSV,
    getFormattedBranchPipeStats,
};

/**
 * Find which zone a pipe belongs to based on its end point
 * ท่อเริ่มวาดที่โซนไหนไม่สำคัญ แต่ถ้าวาดจบที่โซนไหน ให้ถือว่าเป็นท่อของโซนนั้น
 */
export const findPipeZoneImproved = (
    pipe: { coordinates: { lat: number; lng: number }[] },
    zones: { id: string; coordinates: { lat: number; lng: number }[] }[],
    irrigationZones: { id: string; coordinates: { lat: number; lng: number }[] }[]
): string => {
    if (!pipe?.coordinates || pipe.coordinates.length === 0) return 'unknown';

    const endPoint = pipe.coordinates[pipe.coordinates.length - 1];

    if (irrigationZones) {
        for (const zone of irrigationZones) {
            if (zone.coordinates && isCoordinateInZone(endPoint, zone)) {
                return zone.id;
            }
        }
    }

    if (zones) {
        for (const zone of zones) {
            if (zone.coordinates && isCoordinateInZone(endPoint, zone)) {
                return zone.id;
            }
        }
    }

    return 'main-area';
};

/**
 * Find which zone a pipe belongs to for connection counting (same logic as map display)
 * ใช้ฟังก์ชันเดียวกับที่ใช้ในแผนที่เพื่อให้การนับตรงกัน
 */
export const findPipeZoneForConnection = (
    pipe: { coordinates: { lat: number; lng: number }[] },
    zones: { id: string; coordinates: { lat: number; lng: number }[] }[],
    irrigationZones: { id: string; coordinates: { lat: number; lng: number }[] }[]
): string | null => {
    if (!pipe?.coordinates || pipe.coordinates.length === 0) {
        return null;
    }

    const endPoint = pipe.coordinates[pipe.coordinates.length - 1];

    if (irrigationZones && irrigationZones.length > 0) {
        for (const zone of irrigationZones) {
            if (
                zone.coordinates &&
                zone.coordinates.length >= 3 &&
                isPointInPolygon(endPoint, zone.coordinates)
            ) {
                return zone.id;
            }
        }
    }

    if (zones && zones.length > 0) {
        for (const zone of zones) {
            if (
                zone.coordinates &&
                zone.coordinates.length >= 3 &&
                isPointInPolygon(endPoint, zone.coordinates)
            ) {
                return zone.id;
            }
        }
    }

    return null;
};

/**
 * Find which zone a pipe ends in
 */
export const findPipeEndZone = (
    pipe: { coordinates: { lat: number; lng: number }[] },
    zones: { id: string; coordinates: { lat: number; lng: number }[] }[],
    irrigationZones: { id: string; coordinates: { lat: number; lng: number }[] }[]
): string => {
    if (!pipe.coordinates || pipe.coordinates.length === 0) return 'unknown';

    const endPoint = pipe.coordinates[pipe.coordinates.length - 1];

    for (const zone of irrigationZones) {
        if (isCoordinateInZone(endPoint, zone)) {
            return zone.id;
        }
    }

    for (const zone of zones) {
        if (isCoordinateInZone(endPoint, zone)) {
            return zone.id;
        }
    }

    return 'main-area';
};

/**
 * Find the best branch pipe in a zone (most plants and longest)
 */
export const findBestBranchPipeInZone = (
    zoneId: string,
    projectData: EnhancedProjectData,
    irrigationZones: any[],
    sprinklerConfig: any
): BestPipeInfo | null => {
    const allBranchPipes: any[] = [];

    // Collect branch pipes from subMainPipes
    projectData.subMainPipes?.forEach((subMain) => {
        if (subMain.branchPipes) {
            subMain.branchPipes.forEach((branch) => {
                const branchZoneId = findPipeZoneImproved(
                    branch,
                    projectData.zones || [],
                    irrigationZones
                );
                if (branchZoneId === zoneId) {
                    allBranchPipes.push(branch);
                }
            });
        }
    });

    if (projectData.lateralPipes) {
        projectData.lateralPipes.forEach((lateral) => {
            const lateralZoneId = findPipeZoneImproved(
                lateral,
                projectData.zones || [],
                irrigationZones
            );
            if (lateralZoneId === zoneId) {
                allBranchPipes.push({
                    id: lateral.id,
                    coordinates: lateral.coordinates,
                    length: lateral.length,
                    plants: lateral.plants,
                });
            }
        });
    }

    if (allBranchPipes.length === 0) return null;

    let bestPipe = allBranchPipes[0];
    let maxPlantCount = bestPipe.plants?.length || 0;
    let maxLength = bestPipe.length || 0;

    for (const pipe of allBranchPipes) {
        const plantCount = pipe.plants?.length || 0;
        const length = pipe.length || 0;

        if (plantCount > maxPlantCount || (plantCount === maxPlantCount && length > maxLength)) {
            bestPipe = pipe;
            maxPlantCount = plantCount;
            maxLength = length;
        }
    }

    const plantCount = bestPipe.plants?.length || 0;
    const sprinklersPerTree = sprinklerConfig?.sprinklersPerTree || 1;
    const totalSprinklers = plantCount * sprinklersPerTree;
    
    return {
        id: bestPipe.id,
        length: bestPipe.length || 0,
        count: plantCount,
        sprinklerCount: totalSprinklers, // จำนวนหัวฉีดทั้งหมด
        waterFlowRate: calculateWaterFlowRate(plantCount, sprinklerConfig),
        details: bestPipe,
    };
};

/**
 * Find the best sub main pipe in a zone (most connected branches and longest)
 */
export const findBestSubMainPipeInZone = (
    zoneId: string,
    projectData: EnhancedProjectData,
    irrigationZones: any[],
    sprinklerConfig: any
): BestPipeInfo | null => {
    if (!projectData.subMainPipes) return null;

    const zoneSubMains = projectData.subMainPipes.filter((subMain) => {
        const subMainZoneId = findPipeZoneImproved(
            subMain,
            projectData.zones || [],
            irrigationZones
        );
        return (
            subMainZoneId === zoneId || (zoneId === 'main-area' && subMainZoneId === 'main-area')
        );
    });

    if (zoneSubMains.length === 0) return null;

    const subMainsWithRealBranchCount = zoneSubMains.map((subMain) => {
        let realBranchCount = 0;
        let totalWaterFlow = 0;

        if (subMain.branchPipes && subMain.branchPipes.length > 0) {
            realBranchCount += subMain.branchPipes.length;

            for (const branch of subMain.branchPipes) {
                const plantCount = branch.plants?.length || 0;
                const waterFlow = calculateWaterFlowRate(plantCount, sprinklerConfig);
                totalWaterFlow += waterFlow;
            }
        }

        if (projectData.lateralPipes) {
            const connectedLaterals: any[] = [];

            for (const lateral of projectData.lateralPipes) {
                if (!lateral.coordinates || lateral.coordinates.length < 2) continue;

                const lateralZoneId = findPipeZoneImproved(
                    lateral,
                    projectData.zones || [],
                    irrigationZones
                );
                const subMainZoneId = findPipeZoneImproved(
                    subMain,
                    projectData.zones || [],
                    irrigationZones
                );

                if (lateralZoneId === subMainZoneId) {
                    if (
                        lateral.intersectionData &&
                        lateral.intersectionData.subMainPipeId === subMain.id
                    ) {
                        connectedLaterals.push(lateral);
                        continue;
                    }

                    const lateralStart = lateral.coordinates[0];
                    const closestPoint = findClosestConnectionPoint(lateralStart, subMain);

                    if (closestPoint) {
                        const distance = calculateDistanceBetweenPoints(lateralStart, closestPoint);

                        if (distance <= 50) {
                            let isClosestToThisSubMain = true;

                            for (const otherSubMain of zoneSubMains) {
                                if (otherSubMain.id === subMain.id) continue;

                                const otherClosestPoint = findClosestConnectionPoint(
                                    lateralStart,
                                    otherSubMain
                                );
                                if (otherClosestPoint) {
                                    const otherDistance = calculateDistanceBetweenPoints(
                                        lateralStart,
                                        otherClosestPoint
                                    );
                                    if (otherDistance < distance) {
                                        isClosestToThisSubMain = false;
                                        break;
                                    }
                                }
                            }

                            if (isClosestToThisSubMain) {
                                connectedLaterals.push(lateral);
                            }
                        }
                    }

                    for (let i = 0; i < lateral.coordinates.length - 1; i++) {
                        const lateralStart = lateral.coordinates[i];
                        const lateralEnd = lateral.coordinates[i + 1];

                        for (let j = 0; j < subMain.coordinates.length - 1; j++) {
                            const subMainStart = subMain.coordinates[j];
                            const subMainEnd = subMain.coordinates[j + 1];

                            const intersection = findLineIntersection(
                                lateralStart,
                                lateralEnd,
                                subMainStart,
                                subMainEnd
                            );

                            if (intersection) {
                                const alreadyCounted = connectedLaterals.some(
                                    (l) => l.id === lateral.id
                                );
                                if (!alreadyCounted) {
                                    connectedLaterals.push(lateral);
                                }
                                break;
                            }
                        }
                        if (connectedLaterals.some((l) => l.id === lateral.id)) break;
                    }
                }
            }

            for (const lateral of connectedLaterals) {
                realBranchCount++;
                const plantCount = lateral.plants?.length || 0;
                const waterFlow = calculateWaterFlowRate(plantCount, sprinklerConfig);
                totalWaterFlow += waterFlow;
            }
        }

        return {
            subMain,
            realBranchCount,
            totalWaterFlow,
            length: subMain.length || 0,
        };
    });

    let best = subMainsWithRealBranchCount[0];

    for (const candidate of subMainsWithRealBranchCount) {
        if (
            candidate.totalWaterFlow > best.totalWaterFlow ||
            (candidate.totalWaterFlow === best.totalWaterFlow &&
                candidate.realBranchCount > best.realBranchCount)
        ) {
            best = candidate;
        }
    }

    return {
        id: best.subMain.id,
        length: best.length,
        count: best.realBranchCount,
        waterFlowRate: best.totalWaterFlow,
        details: best.subMain,
    };
};

/**
 * Find the best main pipe in a zone (most connected sub mains and longest)
 */
export const findBestMainPipeInZone = (
    zoneId: string,
    projectData: EnhancedProjectData,
    irrigationZones: any[],
    sprinklerConfig: any
): BestPipeInfo | null => {
    if (!projectData.mainPipes || !projectData.subMainPipes) return null;

    const zoneMainPipes = projectData.mainPipes.filter((mainPipe) => {
        const mainZoneId = findPipeZoneImproved(mainPipe, projectData.zones || [], irrigationZones);
        const isInZone = mainZoneId === zoneId;

        return isInZone;
    });

    if (zoneMainPipes.length === 0) return null;

    const mainPipesWithRealSubMainCount = zoneMainPipes.map((mainPipe) => {
        const connectedSubMains: any[] = [];
        const connectedSubMainIds = new Set<string>();

        const endToEndConnections = findEndToEndConnections(
            [mainPipe],
            projectData.subMainPipes,
            projectData.zones || [],
            irrigationZones || []
        );

        for (const connection of endToEndConnections) {
            const connectedSubMain = projectData.subMainPipes.find(
                (sm) => sm.id === connection.subMainPipeId
            );
            if (connectedSubMain && !connectedSubMainIds.has(connectedSubMain.id)) {
                const subMainZoneId = findPipeZoneImproved(
                    connectedSubMain,
                    projectData.zones || [],
                    irrigationZones
                );
                if (subMainZoneId === zoneId) {
                    connectedSubMains.push(connectedSubMain);
                    connectedSubMainIds.add(connectedSubMain.id);
                } else {
                    continue;
                }
            }
        }

        const midConnections = findMidConnections(
            projectData.subMainPipes,
            [mainPipe],
            100,
            projectData.zones || [],
            irrigationZones || []
        );

        for (const connection of midConnections) {
            const connectedSubMain = projectData.subMainPipes.find(
                (sm) => sm.id === connection.sourcePipeId
            );
            if (connectedSubMain && !connectedSubMainIds.has(connectedSubMain.id)) {
                const subMainZoneId = findPipeZoneImproved(
                    connectedSubMain,
                    projectData.zones || [],
                    irrigationZones
                );

                if (subMainZoneId === zoneId) {
                    connectedSubMains.push(connectedSubMain);
                    connectedSubMainIds.add(connectedSubMain.id);
                    continue;
                } else {
                    continue;
                }
            }
        }

        let totalWaterFlow = 0;

        for (const subMain of connectedSubMains) {
            let subMainWaterFlow = 0;

            if (subMain.branchPipes) {
                for (const branch of subMain.branchPipes) {
                    const plantCount = branch.plants?.length || 0;
                    subMainWaterFlow += calculateWaterFlowRate(plantCount, sprinklerConfig);
                }
            }

            if (projectData.lateralPipes) {
                const lateralConnections = findSubMainToLateralStartConnections(
                    [subMain],
                    projectData.lateralPipes,
                    projectData.zones || [],
                    irrigationZones || [],
                    20
                );

                for (const lateralConnection of lateralConnections) {
                    const lateral = projectData.lateralPipes.find(
                        (lp) => lp.id === lateralConnection.lateralPipeId
                    );
                    if (lateral) {
                        const plantCount = lateral.plants?.length || 0;
                        const waterFlow = calculateWaterFlowRate(plantCount, sprinklerConfig);
                        subMainWaterFlow += waterFlow;
                    }
                }

                for (const lateral of projectData.lateralPipes) {
                    if (
                        lateral.intersectionData &&
                        lateral.intersectionData.subMainPipeId === subMain.id
                    ) {
                        const alreadyCounted = lateralConnections.some(
                            (conn) => conn.lateralPipeId === lateral.id
                        );

                        if (!alreadyCounted) {
                            const plantCount = lateral.plants?.length || 0;
                            const waterFlow = calculateWaterFlowRate(plantCount, sprinklerConfig);
                            subMainWaterFlow += waterFlow;
                        }
                    }
                }

                for (const lateral of projectData.lateralPipes) {
                    const alreadyCountedInIntersection =
                        lateral.intersectionData &&
                        lateral.intersectionData.subMainPipeId === subMain.id;
                    const alreadyCountedInConnections = lateralConnections.some(
                        (conn) => conn.lateralPipeId === lateral.id
                    );

                    if (
                        !alreadyCountedInIntersection &&
                        !alreadyCountedInConnections &&
                        lateral.coordinates &&
                        lateral.coordinates.length >= 2
                    ) {
                        const intersection = findLateralSubMainIntersection(
                            lateral.coordinates[0],
                            lateral.coordinates[lateral.coordinates.length - 1],
                            [subMain]
                        );

                        if (intersection && intersection.subMainPipeId === subMain.id) {
                            const plantCount = lateral.plants?.length || 0;
                            const waterFlow = calculateWaterFlowRate(plantCount, sprinklerConfig);
                            subMainWaterFlow += waterFlow;
                        }
                    }
                }
            }

            totalWaterFlow += subMainWaterFlow;
        }

        const realOutletCount = connectedSubMains.length;
        return {
            mainPipe,
            realSubMainCount: realOutletCount,
            totalWaterFlow,
            length: mainPipe.length || 0,
        };
    });

    let best = mainPipesWithRealSubMainCount[0];
    for (const candidate of mainPipesWithRealSubMainCount) {
        if (
            candidate.realSubMainCount > best.realSubMainCount ||
            (candidate.realSubMainCount === best.realSubMainCount && candidate.length > best.length)
        ) {
            best = candidate;
        }
    }

    return {
        id: best.mainPipe.id,
        length: best.length,
        count: best.realSubMainCount,
        waterFlowRate: best.totalWaterFlow,
        details: best.mainPipe,
    };
};

/**
 * Find connections between main pipes and sub main pipes in results
 */
export interface ConnectionPointStats {
    zoneId: string;
    zoneName: string;
    mainToSubMain: number; // จุดเชื่อมปลาย-ปลาย (สีแดง)
    subMainToMainMid: number; // จุดเชื่อมปลายเมน-ระหว่างเมนรอง (สีน้ำเงิน)
    subMainToLateral: number; // จุดเชื่อมเมนรอง-กลางเมน (สีม่วง)
    subMainToMainIntersection: number; // จุดเชื่อมเมนรอง-ท่อย่อย (สีเหลือง)
    lateralToSubMainIntersection: number; // จุดตัดท่อย่อย-เมนรอง (สีเขียว)
    total: number;
}

export const countConnectionPointsByZone = (
    projectData: EnhancedProjectData,
    irrigationZones: any[]
): ConnectionPointStats[] => {
    const stats: ConnectionPointStats[] = [];

    if (!projectData.mainPipes || !projectData.subMainPipes || !projectData.lateralPipes) {
        return stats;
    }

    for (const zone of irrigationZones) {
        const zoneStats: ConnectionPointStats = {
            zoneId: zone.id,
            zoneName: zone.name,
            mainToSubMain: 0,
            subMainToMainMid: 0,
            subMainToLateral: 0,
            subMainToMainIntersection: 0,
            lateralToSubMainIntersection: 0,
            total: 0,
        };

        const countedConnections = new Set<string>();
        const globalConnectionKeys = new Set<string>();

        const endToEndConnections = findEndToEndConnections(
            projectData.mainPipes,
            projectData.subMainPipes,
            projectData.zones || [],
            irrigationZones
        );

        const mainToSubMainConnections = findMainToSubMainConnections(
            projectData.mainPipes,
            projectData.subMainPipes,
            projectData.zones || [],
            irrigationZones
        );

        for (const connection of endToEndConnections) {
            const mainPipe = projectData.mainPipes.find((mp) => mp.id === connection.mainPipeId);
            const subMainPipe = projectData.subMainPipes.find(
                (smp) => smp.id === connection.subMainPipeId
            );

            if (mainPipe && subMainPipe) {
                const mainZoneId = findPipeZoneForConnection(
                    mainPipe,
                    projectData.zones || [],
                    irrigationZones
                );
                const subMainZoneId = findPipeZoneForConnection(
                    subMainPipe,
                    projectData.zones || [],
                    irrigationZones
                );

                if (mainZoneId === zone.id && subMainZoneId === zone.id) {
                    const connectionKey = `end-to-end-${connection.mainPipeId}-${connection.subMainPipeId}`;
                    const globalKey = `global-end-to-end-${connection.mainPipeId}-${connection.subMainPipeId}`;
                    if (
                        !countedConnections.has(connectionKey) &&
                        !globalConnectionKeys.has(globalKey)
                    ) {
                        zoneStats.mainToSubMain++;
                        countedConnections.add(connectionKey);
                        globalConnectionKeys.add(globalKey);
                    }
                }
            }
        }

        for (const connection of mainToSubMainConnections) {
            const mainPipe = projectData.mainPipes.find((mp) => mp.id === connection.mainPipeId);
            const subMainPipe = projectData.subMainPipes.find(
                (smp) => smp.id === connection.subMainPipeId
            );

            if (mainPipe && subMainPipe) {
                const mainZoneId = findPipeZoneForConnection(
                    mainPipe,
                    projectData.zones || [],
                    irrigationZones
                );
                const subMainZoneId = findPipeZoneForConnection(
                    subMainPipe,
                    projectData.zones || [],
                    irrigationZones
                );

                if (mainZoneId === zone.id && subMainZoneId === zone.id) {
                    const connectionKey = `main-submain-${connection.mainPipeId}-${connection.subMainPipeId}`;
                    const globalKey = `global-main-submain-${connection.mainPipeId}-${connection.subMainPipeId}`;
                    if (
                        !countedConnections.has(connectionKey) &&
                        !globalConnectionKeys.has(globalKey)
                    ) {
                        zoneStats.subMainToMainMid++;
                        countedConnections.add(connectionKey);
                        globalConnectionKeys.add(globalKey);
                    }
                }
            }
        }

        const midConnections = findMidConnections(
            projectData.subMainPipes,
            projectData.mainPipes,
            15,
            projectData.zones || [],
            irrigationZones
        );

        for (const connection of midConnections) {
            const subMainPipe = projectData.subMainPipes.find(
                (smp) => smp.id === connection.sourcePipeId
            );
            const mainPipe = projectData.mainPipes.find((mp) => mp.id === connection.targetPipeId);

            if (subMainPipe && mainPipe) {
                const subMainZoneId = findPipeZoneForConnection(
                    subMainPipe,
                    projectData.zones || [],
                    irrigationZones
                );
                const mainZoneId = findPipeZoneForConnection(
                    mainPipe,
                    projectData.zones || [],
                    irrigationZones
                );

                if (subMainZoneId === zone.id && mainZoneId === zone.id) {
                    const connectionKey = `mid-connection-${connection.sourcePipeId}-${connection.targetPipeId}`;
                    const globalKey = `global-mid-connection-${connection.sourcePipeId}-${connection.targetPipeId}`;
                    if (
                        !countedConnections.has(connectionKey) &&
                        !globalConnectionKeys.has(globalKey)
                    ) {
                        zoneStats.subMainToLateral++;
                        countedConnections.add(connectionKey);
                        globalConnectionKeys.add(globalKey);
                    }
                }
            }
        }

        const subMainToLateralConnections = findSubMainToLateralStartConnections(
            projectData.subMainPipes,
            projectData.lateralPipes,
            projectData.zones || [],
            irrigationZones,
            20
        );

        for (const connection of subMainToLateralConnections) {
            const subMainPipe = projectData.subMainPipes.find(
                (smp) => smp.id === connection.subMainPipeId
            );
            const lateralPipe = projectData.lateralPipes.find(
                (lp) => lp.id === connection.lateralPipeId
            );

            if (subMainPipe && lateralPipe) {
                const subMainZoneId = findPipeZoneForConnection(
                    subMainPipe,
                    projectData.zones || [],
                    irrigationZones
                );
                const lateralZoneId = findPipeZoneForConnection(
                    lateralPipe,
                    projectData.zones || [],
                    irrigationZones
                );

                if (subMainZoneId === zone.id && lateralZoneId === zone.id) {
                    const connectionKey = `submain-lateral-start-${connection.subMainPipeId}-${connection.lateralPipeId}`;
                    const globalKey = `global-submain-lateral-start-${connection.subMainPipeId}-${connection.lateralPipeId}`;
                    if (
                        !countedConnections.has(connectionKey) &&
                        !globalConnectionKeys.has(globalKey)
                    ) {
                        zoneStats.subMainToMainIntersection++;
                        countedConnections.add(connectionKey);
                        globalConnectionKeys.add(globalKey);
                    }
                }
            }
        }

        const subMainToMainIntersections = findSubMainToMainIntersections(
            projectData.subMainPipes,
            projectData.mainPipes,
            projectData.zones || [],
            irrigationZones
        );

        for (const intersection of subMainToMainIntersections) {
            const subMainPipe = projectData.subMainPipes.find(
                (smp) => smp.id === intersection.subMainPipeId
            );
            const mainPipe = projectData.mainPipes.find((mp) => mp.id === intersection.mainPipeId);

            if (subMainPipe && mainPipe) {
                const subMainZoneId = findPipeZoneForConnection(
                    subMainPipe,
                    projectData.zones || [],
                    irrigationZones
                );
                const mainZoneId = findPipeZoneForConnection(
                    mainPipe,
                    projectData.zones || [],
                    irrigationZones
                );

                if (subMainZoneId === zone.id && mainZoneId === zone.id) {
                    const intersectionKey = `submain-main-intersection-${intersection.subMainPipeId}-${intersection.mainPipeId}`;
                    const globalKey = `global-submain-main-intersection-${intersection.subMainPipeId}-${intersection.mainPipeId}`;
                    if (
                        !countedConnections.has(intersectionKey) &&
                        !globalConnectionKeys.has(globalKey)
                    ) {
                        zoneStats.subMainToMainIntersection++;
                        countedConnections.add(intersectionKey);
                        globalConnectionKeys.add(globalKey);
                    }
                }
            }
        }

        const lateralToSubMainIntersections = findLateralToSubMainIntersections(
            projectData.lateralPipes,
            projectData.subMainPipes,
            projectData.zones || [],
            irrigationZones
        );

        for (const intersection of lateralToSubMainIntersections) {
            const lateralPipe = projectData.lateralPipes.find(
                (lp) => lp.id === intersection.lateralPipeId
            );
            const subMainPipe = projectData.subMainPipes.find(
                (smp) => smp.id === intersection.subMainPipeId
            );

            if (lateralPipe && subMainPipe) {
                const lateralZoneId = findPipeZoneForConnection(
                    lateralPipe,
                    projectData.zones || [],
                    irrigationZones
                );
                const subMainZoneId = findPipeZoneForConnection(
                    subMainPipe,
                    projectData.zones || [],
                    irrigationZones
                );

                if (lateralZoneId === zone.id && subMainZoneId === zone.id) {
                    const intersectionKey = `lateral-submain-intersection-${intersection.lateralPipeId}-${intersection.subMainPipeId}`;
                    const globalKey = `global-lateral-submain-intersection-${intersection.lateralPipeId}-${intersection.subMainPipeId}`;

                    if (
                        !countedConnections.has(intersectionKey) &&
                        !globalConnectionKeys.has(globalKey)
                    ) {
                        zoneStats.lateralToSubMainIntersection++;
                        countedConnections.add(intersectionKey);
                        globalConnectionKeys.add(globalKey);
                    }
                }
            }
        }

        const originalSubMainToMainIntersection = zoneStats.subMainToMainIntersection;
        zoneStats.subMainToMainIntersection = Math.max(
            0,
            originalSubMainToMainIntersection - zoneStats.lateralToSubMainIntersection
        );

        zoneStats.total =
            zoneStats.mainToSubMain +
            zoneStats.subMainToMainMid +
            zoneStats.subMainToLateral +
            zoneStats.subMainToMainIntersection +
            zoneStats.lateralToSubMainIntersection;

        stats.push(zoneStats);
    }

    return stats;
};

export const findMainToSubMainConnectionsInResults = (
    mainPipes: any[],
    subMainPipes: any[],
    zones: any[],
    irrigationZones: any[],
    snapThreshold: number = 20
): { mainId: string; subMainId: string; distance: number }[] => {
    const connections: { mainId: string; subMainId: string; distance: number }[] = [];

    if (!mainPipes || !subMainPipes) return connections;

    const findPipeZone = (pipe: any): string | null => {
        if (!pipe.coordinates || pipe.coordinates.length === 0) return null;

        const endPoint = pipe.coordinates[pipe.coordinates.length - 1];

        if (irrigationZones) {
            for (const zone of irrigationZones) {
                if (isPointInPolygon(endPoint, zone.coordinates)) {
                    return zone.id;
                }
            }
        }

        if (zones) {
            for (const zone of zones) {
                if (isPointInPolygon(endPoint, zone.coordinates)) {
                    return zone.id;
                }
            }
        }

        return null;
    };

    for (const mainPipe of mainPipes) {
        if (!mainPipe.coordinates || mainPipe.coordinates.length === 0) continue;

        const mainEnd = mainPipe.coordinates[mainPipe.coordinates.length - 1];
        const mainZone = findPipeZone(mainPipe);

        for (const subMain of subMainPipes) {
            if (!subMain.coordinates || subMain.coordinates.length === 0) continue;

            const subMainStart = subMain.coordinates[0];
            const subMainZone = findPipeZone(subMain);

            if (mainZone && subMainZone && mainZone !== subMainZone) {
                const isMultiZoneMainPipe = checkMainPipePassesThroughMultipleZones(
                    mainPipe,
                    zones,
                    irrigationZones
                );

                const connectionDistance = calculateDistanceBetweenPoints(mainEnd, subMainStart);
                const isCloseConnection = connectionDistance <= snapThreshold;

                if (!isMultiZoneMainPipe && !isCloseConnection) {
                    continue;
                }
            }

            const distance = calculateDistanceBetweenPoints(mainEnd, subMainStart);

            if (distance <= snapThreshold) {
                connections.push({
                    mainId: mainPipe.id,
                    subMainId: subMain.id,
                    distance,
                });
            }
        }
    }

    return connections;
};

const checkMainPipePassesThroughMultipleZones = (
    mainPipe: any,
    zones?: any[],
    irrigationZones?: any[]
): boolean => {
    if (!mainPipe.coordinates || mainPipe.coordinates.length < 2) return false;

    const zonesFound = new Set<string>();

    for (const point of mainPipe.coordinates) {
        if (irrigationZones) {
            for (const zone of irrigationZones) {
                if (isPointInPolygon(point, zone.coordinates)) {
                    zonesFound.add(zone.id);
                }
            }
        }

        if (zones) {
            for (const zone of zones) {
                if (isPointInPolygon(point, zone.coordinates)) {
                    zonesFound.add(zone.id);
                }
            }
        }
    }

    return zonesFound.size > 1;
};
