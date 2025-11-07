/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useEffect, useRef, useState } from 'react';

interface Coordinate {
    lat: number;
    lng: number;
}

interface Cesium3DMapPopupProps {
    isOpen: boolean;
    onClose: () => void;
    center: { lat: number; lng: number };
    zoom: number;
    mainArea?: Coordinate[];
    projectData?: any;
    use3DTiles?: boolean; // เพิ่ม option สำหรับเลือกใช้ 3D tiles หรือ hybrid imagery
}

const Cesium3DMapPopup: React.FC<Cesium3DMapPopupProps> = ({
    isOpen,
    onClose,
    center,
    zoom,
    mainArea,
    projectData,
    use3DTiles = true, // เปลี่ยนเป็น true โดย default เพื่อให้เห็น terrain/elevation data (Google Photorealistic 3D Tiles มี terrain data)
}) => {
    const cesiumContainerRef = useRef<HTMLDivElement>(null);
    const viewerRef = useRef<any>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!isOpen || !cesiumContainerRef.current) return;

        // Get API key from environment
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
        if (!apiKey) {
            console.error('❌ Google Maps API Key not found');
            setError('Google Maps API Key not configured');
            setIsLoading(false);
            return;
        }

        console.log('🔑 Using API Key:', apiKey.substring(0, 15) + '...');

        const initializeCesium = async () => {
            try {
                // Set CESIUM_BASE_URL BEFORE loading Cesium (important!)
                (window as any).CESIUM_BASE_URL = 'https://cesium.com/downloads/cesiumjs/releases/1.114/Build/Cesium/';
                
                // Load Cesium from CDN like the example (same version 1.114)
                // This is simpler and avoids npm package issues
                let Cesium = (window as any).Cesium;
                
                if (!Cesium) {
                    // Load Cesium script from CDN
                    await new Promise<void>((resolve, reject) => {
                        const script = document.createElement('script');
                        script.src = 'https://cesium.com/downloads/cesiumjs/releases/1.114/Build/Cesium/Cesium.js';
                        script.onload = () => {
                            Cesium = (window as any).Cesium;
                            if (Cesium) {
                                resolve();
                            } else {
                                reject(new Error('Cesium not loaded'));
                            }
                        };
                        script.onerror = () => reject(new Error('Failed to load Cesium'));
                        document.head.appendChild(script);
                    });
                    
                    // Load CSS
                    if (!document.getElementById('cesium-css')) {
                        const link = document.createElement('link');
                        link.id = 'cesium-css';
                        link.rel = 'stylesheet';
                        link.href = 'https://cesium.com/downloads/cesiumjs/releases/1.114/Build/Cesium/Widgets/widgets.css';
                        document.head.appendChild(link);
                    }
                }
                
                console.log('✅ Cesium loaded from CDN');

                // Initialize Cesium Viewer - EXACTLY LIKE EXAMPLE
                const viewer = new Cesium.Viewer(cesiumContainerRef.current, {
                    // **EXACTLY LIKE EXAMPLE:** baseLayer: false
                    baseLayer: false,
                    // Hide unnecessary UI elements (like example)
                    geocoder: false,
                    homeButton: false,
                    sceneModePicker: false,
                    baseLayerPicker: false,
                    navigationHelpButton: false,
                    animation: false,
                    timeline: false,
                    fullscreenButton: true, // Keep this for convenience
                });
                
                viewerRef.current = viewer;
                
                console.log('✅ Viewer initialized with baseLayer: false (like example)');

                // ตั้งค่า Scene เพื่อให้เหมือน Google Earth - เพิ่ม Sky, Atmosphere, และ Lighting
                try {
                    console.log('🌅 Configuring scene for Google Earth-like appearance...');
                    
                    // เปิด Sky และ Atmosphere เพื่อให้มี sky gradient แทนพื้นหลังสีดำ
                    viewer.scene.skyAtmosphere.show = true;
                    viewer.scene.skyAtmosphere.hueShift = 0.0;
                    viewer.scene.skyAtmosphere.saturationShift = 0.0;
                    viewer.scene.skyAtmosphere.brightnessShift = 0.0;
                    
                    // เปิด Sun และ Moon เพื่อให้มี lighting ที่เหมือนจริง
                    viewer.scene.sun.show = true;
                    viewer.scene.moon.show = true;
                    
                    // ตั้งค่า Fog เพื่อให้มี depth perception เหมือน Google Earth
                    viewer.scene.fog.enabled = true;
                    viewer.scene.fog.density = 0.0001; // ลด density เพื่อให้เห็น terrain ได้ไกลและชัดเจนขึ้น
                    viewer.scene.fog.screenSpaceErrorFactor = 2.0;
                    
                    // ตั้งค่า Globe shading เพื่อให้เห็น terrain detail ชัดเจนขึ้น
                    viewer.scene.globe.shadows = Cesium.ShadowMode.RECEIVE_ONLY; // รับ shadows จาก terrain
                    viewer.scene.globe.dynamicAtmosphereLighting = true; // dynamic lighting ตามเวลา
                    viewer.scene.globe.dynamicAtmosphereLightingFromSun = true;
                    
                    // ตั้งค่า lighting quality (ใช้ SunLightSource ถ้ามี)
                    try {
                        if (Cesium.SunLightSource) {
                            viewer.scene.lightSource = new Cesium.SunLightSource({
                                intensity: 2.0, // เพิ่มความสว่างของแสง
                            });
                        }
                    } catch (lightErr) {
                        console.warn('⚠️ SunLightSource not available, using default lighting');
                    }
                    
                    console.log('✅ Scene configured with sky, atmosphere, and lighting');
                } catch (sceneErr) {
                    console.warn('⚠️ Error configuring scene:', sceneErr);
                }

                // เพิ่ม Terrain Provider เพื่อแสดงความสูงของภูมิประเทศ (ภูเขา, เนิน)
                // สำคัญ: ต้องตั้งค่า terrain provider ก่อนโหลด imagery layers
                // ใช้ ref เพื่อเก็บค่า terrainProviderSet เพื่อให้เข้าถึงได้จาก scope อื่น
                const terrainProviderInfoRef = { set: false, name: 'Unknown' };
                
                try {
                    console.log('🏔️ Loading terrain/elevation data...');
                    console.log('📍 Center location:', center.lat, center.lng);
                    
                    let terrainProviderSet = false;
                    let terrainProviderName = 'Unknown';
                    
                    // ลองใช้ Cesium World Terrain ก่อน (ต้องมี Cesium Ion access token)
                    try {
                        console.log('🔄 Attempting to load Cesium World Terrain...');
                        const worldTerrain = await Cesium.createWorldTerrain({
                            requestWaterMask: true,
                            requestVertexNormals: true,
                        });
                        viewer.terrainProvider = worldTerrain;
                        terrainProviderSet = true;
                        terrainProviderInfoRef.set = true;
                        terrainProviderInfoRef.name = 'Cesium World Terrain';
                        terrainProviderName = 'Cesium World Terrain';
                        console.log('✅ Cesium World Terrain loaded successfully');
                    } catch (worldTerrainError: any) {
                        console.warn('⚠️ Cesium World Terrain not available:', worldTerrainError?.message || worldTerrainError);
                        
                        // ลองใช้ ArcGIS Terrain (ฟรี, ไม่ต้องใช้ access token)
                        try {
                            console.log('🔄 Attempting to load ArcGIS Terrain...');
                            const arcGisTerrain = new Cesium.ArcGisMapServerTerrainProvider({
                                url: 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer',
                            });
                            viewer.terrainProvider = arcGisTerrain;
                            terrainProviderSet = true;
                            terrainProviderInfoRef.set = true;
                            terrainProviderInfoRef.name = 'ArcGIS Terrain';
                            terrainProviderName = 'ArcGIS Terrain';
                            console.log('✅ ArcGIS Terrain loaded successfully');
                        } catch (arcGisError: any) {
                            console.warn('⚠️ ArcGIS Terrain not available:', arcGisError?.message || arcGisError);
                            
                            // ลองใช้ Google Terrain (ใช้ Google Maps API)
                            try {
                                console.log('🔄 Attempting to use Google Terrain via EllipsoidTerrainProvider with high exaggeration...');
                                // ใช้ EllipsoidTerrainProvider แต่จะเพิ่ม exaggeration สูงมาก
                                viewer.terrainProvider = new Cesium.EllipsoidTerrainProvider();
                                terrainProviderSet = false; // ตั้งเป็น false เพราะไม่มี elevation data จริง
                                terrainProviderName = 'EllipsoidTerrainProvider (no elevation data)';
                                console.warn('⚠️ Using EllipsoidTerrainProvider (no real elevation data)');
                            } catch (ellipsoidError: any) {
                                console.error('❌ Failed to set any terrain provider:', ellipsoidError);
                            }
                        }
                    }
                    
                    // ตั้งค่า globe properties เพื่อให้แสดง terrain ได้ดี
                    viewer.scene.globe.enableLighting = true; // เปิด lighting เพื่อให้เห็นความสูงชัดเจนขึ้น
                    viewer.scene.globe.depthTestAgainstTerrain = true;
                    
                    // ตั้งค่า terrain exaggeration ให้เป็นธรรมชาติ (ไม่สูงเกินจริง)
                    // ค่า 1.0 = ความสูงจริง, 1.2-1.5 = เน้นความสูงเล็กน้อย
                    if (terrainProviderSet) {
                        // ถ้ามี terrain provider จริง ใช้ exaggeration ต่ำเพื่อให้ดูเป็นธรรมชาติ
                        viewer.scene.globe.terrainExaggeration = 1.0; // ใช้ 1.0 (ความสูงจริง) เพื่อให้ดูเป็นธรรมชาติ
                        console.log('🏔️ Terrain exaggeration set to 1.0 (natural height with real terrain provider)');
                    } else {
                        // ถ้าไม่มี terrain provider จริง ใช้ exaggeration ต่ำ
                        // หมายเหตุ: EllipsoidTerrainProvider ไม่มี elevation data จริง แต่ exaggeration จะทำให้เห็นความแตกต่าง
                        viewer.scene.globe.terrainExaggeration = 1.0; // ใช้ 1.0 (ความสูงจริง)
                        console.warn('⚠️ No real terrain provider, using natural exaggeration:', viewer.scene.globe.terrainExaggeration);
                        console.warn('⚠️ Note: EllipsoidTerrainProvider has no elevation data, terrain will still appear flat');
                    }
                    
                    // ตั้งค่า camera เพื่อให้เห็น terrain ได้ดีขึ้น
                    viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
                    
                    // ตั้งค่าให้ camera ติดตาม terrain
                    viewer.scene.screenSpaceCameraController.minimumCollisionTerrainHeight = 15000;
                    
                    // ลด terrain detail level เพื่อเพิ่ม performance และหลีกเลี่ยง white patches
                    viewer.scene.globe.tileCacheSize = 500; // ลด cache size เพื่อลด memory usage
                    viewer.scene.globe.maximumScreenSpaceError = 2; // เพิ่ม error tolerance เพื่อลด detail และเพิ่ม performance
                    
                    // ตั้งค่าให้ terrain render ที่ความละเอียดสูงขึ้น
                    viewer.scene.globe.baseColor = Cesium.Color.WHITE; // ตั้ง base color
                    viewer.scene.globe.showSkirts = true; // แสดง skirts เพื่อให้ terrain ดูต่อเนื่อง
                    
                    // Debug: ตรวจสอบว่า terrain provider ถูกตั้งค่าหรือไม่
                    setTimeout(() => {
                        const currentTerrain = viewer.terrainProvider;
                        const exaggeration = viewer.scene.globe.terrainExaggeration;
                        console.log('🔍 Terrain Debug Info:');
                        console.log('  - Terrain Provider:', terrainProviderName);
                        console.log('  - Terrain Provider Type:', currentTerrain?.constructor?.name || 'Unknown');
                        console.log('  - Terrain Exaggeration:', exaggeration);
                        console.log('  - Enable Lighting:', viewer.scene.globe.enableLighting);
                        console.log('  - Depth Test Against Terrain:', viewer.scene.globe.depthTestAgainstTerrain);
                        console.log('  - Maximum Screen Space Error:', viewer.scene.globe.maximumScreenSpaceError);
                    }, 1000);
                    
                    console.log('✅ Terrain provider configured');
                    console.log('  Provider:', terrainProviderName);
                    console.log('  Exaggeration:', viewer.scene.globe.terrainExaggeration);
                } catch (terrainErr: any) {
                    console.error('❌ Error setting up terrain:', terrainErr);
                    console.error('❌ Error details:', terrainErr?.message || terrainErr);
                    // ยังคงดำเนินการต่อแม้ terrain setup จะล้มเหลว
                }

                // สำคัญ: Google Photorealistic 3D Tiles มี terrain/elevation data อยู่แล้ว
                // ดังนั้นควรใช้ 3D Tiles mode เพื่อให้เห็นความสูงของภูเขา
                // แต่ถ้าไม่ใช้ 3D Tiles ต้องมี terrain provider ที่มี elevation data จริง
                
                // โหลดแผนที่ตามที่เลือก: Hybrid Imagery (มี labels ชัดเจน) หรือ 3D Tiles (มี 3D buildings + terrain)
                try {
                    if (use3DTiles) {
                        // โหมด 3D Tiles: มี 3D buildings และ terrain/elevation data จาก Google
                        console.log('🔄 Loading 3D Photorealistic Tiles mode (with terrain data)...');
                        
                        // สำคัญ: Google Photorealistic 3D Tiles มี imagery อยู่แล้วใน tiles
                        // แต่บางพื้นที่อาจไม่มี 3D Tiles coverage จึงต้องเพิ่ม base imagery layer
                        // เพื่อหลีกเลี่ยงพื้นที่สีขาว
                        
                        // ลบ imagery layers ที่มีอยู่แล้ว (ถ้ามี)
                        while (viewer.imageryLayers.length > 0) {
                            viewer.imageryLayers.remove(viewer.imageryLayers.get(0));
                        }
                        
                        // เพิ่ม Base Imagery Layer (Satellite/Hybrid) เพื่อแสดงแผนที่ในพื้นที่ที่ไม่มี 3D Tiles
                        // Layer นี้จะแสดงเป็นพื้นหลังและจะถูกบังโดย 3D Tiles ที่มี coverage
                        try {
                            console.log('🔄 Adding base imagery layer to prevent white areas...');
                            const baseImageryProvider = new Cesium.UrlTemplateImageryProvider({
                                url: `https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}`, // Hybrid (satellite + labels)
                                maximumLevel: 20,
                                minimumLevel: 0,
                                credit: 'Google Maps',
                                tilingScheme: new Cesium.WebMercatorTilingScheme(),
                            });
                            const baseLayer = viewer.imageryLayers.addImageryProvider(baseImageryProvider);
                            baseLayer.alpha = 1.0; // แสดงเต็มที่เพื่อให้เห็นในพื้นที่ที่ไม่มี 3D Tiles
                            baseLayer.brightness = 1.0;
                            baseLayer.contrast = 1.0;
                            console.log('✅ Base imagery layer added (will show in areas without 3D Tiles coverage)');
                        } catch (baseError) {
                            console.warn('⚠️ Could not add base imagery layer:', baseError);
                        }
                        
                        // เพิ่ม Labels-Only Layer เพื่อแสดงชื่อสถานที่
                        try {
                            const labelsProvider = new Cesium.UrlTemplateImageryProvider({
                                url: `https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}`,
                                maximumLevel: 20,
                                minimumLevel: 0,
                                credit: 'Google Maps Labels',
                                tilingScheme: new Cesium.WebMercatorTilingScheme(),
                            });
                            const labelsLayer = viewer.imageryLayers.addImageryProvider(labelsProvider);
                            viewer.imageryLayers.raiseToTop(labelsLayer); // วาง labels ไว้บนสุด
                            labelsLayer.alpha = 0.9; // ตั้ง alpha เป็น 0.9 เพื่อให้เห็น labels ชัดเจน
                            labelsLayer.brightness = 1.3;
                            labelsLayer.contrast = 1.2;
                            console.log('✅ Labels layer added');
                        } catch (labelError) {
                            console.warn('⚠️ Could not add labels layer (CORS issue):', labelError);
                            console.warn('⚠️ 3D Tiles will show without labels overlay');
                        }
                        
                        console.log('✅ Base imagery and labels layers added');
                        console.log('✅ Google Photorealistic 3D Tiles will overlay on top (where available)');
                        
                        // โหลด 3D Tiles - สำคัญ: 3D Tiles มี terrain/elevation data อยู่แล้ว
                        console.log('🏔️ Loading Google Photorealistic 3D Tiles (includes terrain data)...');
                        const tileset = await Cesium.createGooglePhotorealistic3DTileset(apiKey);
                        
                        // ตั้งค่า 3D Tiles เพื่อลดภาระการประมวลผลและหลีกเลี่ยง white patches
                        tileset.maximumScreenSpaceError = 16; // เพิ่มจาก default เพื่อลด detail และเพิ่ม performance
                        tileset.maximumMemoryUsage = 512; // จำกัด memory usage (MB)
                        tileset.preloadWhenHidden = false; // ไม่ preload เมื่อซ่อน
                        tileset.preloadFlightDestinations = false; // ไม่ preload flight destinations
                        tileset.preloadSiblings = false; // ไม่ preload siblings
                        
                        // ตั้งค่า error handling สำหรับ 3D Tiles (ตรวจสอบว่า readyPromise มีอยู่จริง)
                        if (tileset.readyPromise) {
                            tileset.readyPromise.then(() => {
                                console.log('✅ 3D Tiles loaded successfully');
                            }).catch((error) => {
                                console.error('❌ Error loading 3D Tiles:', error);
                                console.warn('⚠️ Base imagery layer will be shown instead');
                            });
                        } else {
                            console.log('✅ 3D Tiles added (readyPromise not available in this Cesium version)');
                        }
                        
                        viewer.scene.primitives.add(tileset);
                        
                        // ตั้งค่า terrain exaggeration ให้เป็นธรรมชาติ
                        viewer.scene.globe.terrainExaggeration = 1.0; // ใช้ 1.0 (ความสูงจริง)
                        
                        // เปิด depth test เพื่อให้วัตถุติดกับ terrain จาก 3D Tiles
                        viewer.scene.globe.depthTestAgainstTerrain = true;
                        
                        // ตั้งค่าให้ 3D Tiles แสดง terrain
                        tileset.show = true;
                        
                        // ลด detail level เพื่อเพิ่ม performance
                        viewer.scene.globe.maximumScreenSpaceError = 2; // เพิ่มจาก 0.5 เป็น 2 เพื่อลด detail
                        viewer.scene.globe.tileCacheSize = 500; // ลด cache size จาก 2000 เป็น 500
                        
                        // ลองใช้ ArcGIS Terrain อีกครั้งเพื่อให้ globe มี elevation data
                        try {
                            console.log('🔄 Attempting to add ArcGIS Terrain for globe elevation...');
                            const arcGisTerrain = new Cesium.ArcGisMapServerTerrainProvider({
                                url: 'https://elevation3d.arcgis.com/arcgis/rest/services/WorldElevation3D/Terrain3D/ImageServer',
                            });
                            viewer.terrainProvider = arcGisTerrain;
                            viewer.scene.globe.terrainExaggeration = 1.0;
                            console.log('✅ ArcGIS Terrain added for globe elevation');
                        } catch (arcGisError) {
                            console.warn('⚠️ Could not add ArcGIS Terrain:', arcGisError);
                            console.warn('⚠️ 3D Tiles should still show terrain, but globe will be flat');
                        }
                        
                        console.log('✅ 3D Tiles mode loaded with performance optimizations');
                        console.log('✅ Google Photorealistic 3D Tiles includes terrain/elevation data in tiles');
                        console.log('🏔️ Terrain exaggeration:', viewer.scene.globe.terrainExaggeration, '(1.0 = natural height)');
                        console.log('⚡ Performance: Reduced detail level to improve performance');
                    } else {
                        // โหมด Hybrid Imagery: มี labels ชัดเจน แต่ไม่มี 3D buildings
                        // หมายเหตุ: โหมดนี้ต้องมี terrain provider ที่มี elevation data จริง
                        console.log('🔄 Loading Hybrid Imagery mode (with full labels visibility)...');
                        console.log('⚠️ Warning: Hybrid mode requires real terrain provider for elevation data');
                        
                        // เพิ่ม Hybrid Imagery Layer ที่มีทั้ง satellite และ labels
                        const hybridProvider = new Cesium.UrlTemplateImageryProvider({
                            url: `https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}`,
                            maximumLevel: 20,
                            minimumLevel: 0,
                            credit: 'Google Maps',
                            tilingScheme: new Cesium.WebMercatorTilingScheme(),
                        });
                        
                        const hybridLayer = viewer.imageryLayers.addImageryProvider(hybridProvider);
                        hybridLayer.alpha = 1.0;
                        hybridLayer.brightness = 1.0;
                        hybridLayer.contrast = 1.0;
                        
                        // เพิ่ม Labels-Only Layer เพื่อให้ labels ชัดเจนยิ่งขึ้น
                        const labelsProvider = new Cesium.UrlTemplateImageryProvider({
                            url: `https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}`,
                            maximumLevel: 20,
                            minimumLevel: 0,
                            credit: 'Google Maps Labels',
                            tilingScheme: new Cesium.WebMercatorTilingScheme(),
                        });
                        
                        const labelsLayer = viewer.imageryLayers.addImageryProvider(labelsProvider);
                        viewer.imageryLayers.raiseToTop(labelsLayer);
                        labelsLayer.alpha = 1.0;
                        labelsLayer.brightness = 1.2;
                        labelsLayer.contrast = 1.1;
                        
                        // ตรวจสอบว่า terrain provider มี elevation data หรือไม่
                        if (!terrainProviderInfoRef.set) {
                            console.error('❌ CRITICAL: No terrain provider with elevation data!');
                            console.error('❌ Terrain will appear FLAT because EllipsoidTerrainProvider has no elevation data');
                            console.error('💡 Solution: Enable use3DTiles=true to use Google Photorealistic 3D Tiles (has terrain data)');
                            console.error('💡 Or: Get Cesium Ion access token for Cesium World Terrain');
                        }
                        
                        console.log('✅ Hybrid Imagery mode loaded (full labels visibility)');
                    }
                    
                    // รอสักครู่แล้วตรวจสอบ layers
                    setTimeout(() => {
                        console.log(`📊 Total imagery layers: ${viewer.imageryLayers.length}`);
                        // แก้ไข: ใช้ for loop แทน forEach เพราะ imageryLayers ไม่ใช่ array
                        for (let i = 0; i < viewer.imageryLayers.length; i++) {
                            const layer = viewer.imageryLayers.get(i);
                            if (layer) {
                                console.log(`  Layer ${i}: ${layer.imageryProvider?.credit || 'Unknown'}, alpha: ${layer.alpha}`);
                            }
                        }
                    }, 2000);
                    
                    // Fly to location with better view angle to see terrain elevation (เหมือน Google Earth)
                    // ปรับมุมมองให้เห็นภูเขาชัดเจน - มุมมองเอียงและความสูงที่เหมาะสม
                    // ลดความสูงของ camera เพื่อ zoom in มากขึ้น (default zoom)
                    const cameraHeight = 2000; // ลดจาก 5000 เป็น 2000 เพื่อ zoom in มากขึ้น
                    viewer.scene.camera.flyTo({
                        destination: Cesium.Cartesian3.fromDegrees(center.lng, center.lat, cameraHeight),
                        orientation: {
                            heading: Cesium.Math.toRadians(0.0), // หันไปทางทิศเหนือ
                            pitch: Cesium.Math.toRadians(-70.0), // มุมมองเอียง 70 องศาเพื่อเห็นความสูงของภูเขาชัดเจน
                            roll: 0.0, // ไม่เอียงซ้าย-ขวา
                        },
                        duration: 3.0, // เพิ่ม duration เพื่อให้การเคลื่อนไหว smooth
                        complete: () => {
                            // หลังจาก fly to เสร็จแล้ว ตั้งค่า camera controller เพื่อให้ navigation ดีขึ้น
                            viewer.scene.screenSpaceCameraController.enableRotate = true;
                            viewer.scene.screenSpaceCameraController.enableTranslate = true;
                            viewer.scene.screenSpaceCameraController.enableZoom = true;
                            viewer.scene.screenSpaceCameraController.enableTilt = true;
                            viewer.scene.screenSpaceCameraController.enableLook = true;
                            
                            // ตั้งค่า maximum zoom distance เพื่อให้ zoom in ได้ใกล้ขึ้น
                            viewer.scene.screenSpaceCameraController.minimumZoomDistance = 10;
                            viewer.scene.screenSpaceCameraController.maximumZoomDistance = 50000000;
                            
                            // ตั้งค่า tilt range เพื่อให้สามารถเอียงดู terrain ได้ดีขึ้น
                            viewer.scene.screenSpaceCameraController.constrainedAxis = undefined;
                            viewer.scene.screenSpaceCameraController.enableCollisionDetection = true;
                            
                            console.log('✅ Camera configured for Google Earth-like navigation');
                            console.log('🏔️ Terrain exaggeration:', viewer.scene.globe.terrainExaggeration);
                            console.log('📐 Camera height:', cameraHeight, 'meters');
                            console.log('📐 Camera pitch:', -70, 'degrees');
                        }
                    });
                    
                    console.log('✅ 3D Map initialized successfully with labels');
                    setIsLoading(false);
                } catch (err: any) {
                    console.error('❌ Error loading 3D Tiles:', err);
                    setError('Failed to load 3D tiles: ' + (err.message || err.toString()));
                    setIsLoading(false);
                }

                // Add main area polygon if provided
                if (mainArea && mainArea.length > 0) {
                    setTimeout(() => {
                        try {
                            const positions = mainArea.map(
                                (coord) => Cesium.Cartesian3.fromDegrees(coord.lng, coord.lat)
                            );
                            
                            viewer.entities.add({
                                polygon: {
                                    hierarchy: positions,
                                    material: Cesium.Color.BLUE.withAlpha(0.3),
                                    outline: true,
                                    outlineColor: Cesium.Color.BLUE,
                                    height: 0,
                                    extrudedHeight: 50,
                                },
                            });
                            console.log('✅ Main area polygon added');
                        } catch (e) {
                            console.error('Error adding main area polygon:', e);
                        }
                    }, 1000);
                }

                // Note: Camera sync with 2D map removed for simplicity
                // User can manually navigate the 3D map

            } catch (err: any) {
                console.error('❌ Error initializing Cesium:', err);
                setError(err.message || 'Failed to initialize 3D map');
                setIsLoading(false);
            }
        };

        initializeCesium();

        // Cleanup function
        return () => {
            if (viewerRef.current && !viewerRef.current.isDestroyed()) {
                viewerRef.current.destroy();
                viewerRef.current = null;
            }
        };
    }, [isOpen, center, zoom, mainArea, use3DTiles]);

    if (!isOpen) return null;

    return (
        <div className="fixed right-4 top-4 z-[10000] w-[600px] rounded-lg border border-gray-300 bg-white shadow-2xl">
            <div className="flex items-center justify-between rounded-t-lg bg-blue-600 px-4 py-2">
                <div className="flex items-center space-x-2">
                    <span className="text-lg">🌍</span>
                    <span className="text-sm font-medium text-white">แผนที่ 3D</span>
                </div>
                <button
                    onClick={onClose}
                    className="rounded p-1 text-white hover:bg-blue-700"
                    title="ปิด"
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
                            d="M6 18L18 6M6 6l12 12"
                        />
                    </svg>
                </button>
            </div>
            <div 
                id="cesium-3d-map-container"
                ref={cesiumContainerRef}
                className="relative w-full overflow-hidden"
                style={{ 
                    height: '500px',
                    minHeight: '500px',
                    width: '100%',
                    minWidth: '100%',
                    position: 'relative',
                    display: 'block',
                    backgroundColor: '#87CEEB', // เปลี่ยนจากสีดำเป็น Sky Blue เพื่อให้เหมือน Google Earth
                }}
            >
                {isLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-gray-100">
                        <div className="text-center">
                            <div className="mb-2 h-8 w-8 animate-spin rounded-full border-b-2 border-blue-600"></div>
                            <p className="text-sm text-gray-600">กำลังโหลดแผนที่ 3D...</p>
                        </div>
                    </div>
                )}
                
                <style dangerouslySetInnerHTML={{__html: `
                    #cesium-3d-map-container canvas {
                        position: absolute !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 100% !important;
                        height: 100% !important;
                        display: block !important;
                        visibility: visible !important;
                        opacity: 1 !important;
                        z-index: 1 !important;
                    }
                    #cesium-3d-map-container .cesium-widget {
                        width: 100% !important;
                        height: 100% !important;
                    }
                    #cesium-3d-map-container .cesium-widget canvas {
                        position: absolute !important;
                    }
                `}} />
                {error && (
                    <div className="absolute inset-0 z-20 flex items-center justify-center bg-gray-100">
                        <div className="text-center">
                            <p className="mb-2 text-sm text-red-600">{error}</p>
                            <button
                                onClick={() => {
                                    setError(null);
                                    setIsLoading(true);
                                }}
                                className="rounded bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-700"
                            >
                                ลองใหม่
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Cesium3DMapPopup;
