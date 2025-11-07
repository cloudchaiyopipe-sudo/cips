import { defineConfig, loadEnv } from 'vite';
import laravel from 'laravel-vite-plugin';
import react from '@vitejs/plugin-react';
import path from 'path';
import cesium from 'vite-plugin-cesium';

export default defineConfig(({ command, mode }) => {
    // โหลด environment variables
    const env = loadEnv(mode, process.cwd(), '');
    
    console.log('🔧 Vite Config Debug:');
    console.log('Mode:', mode);
    console.log('Command:', command);
    console.log('Google Maps API Key:', env.VITE_GOOGLE_MAPS_API_KEY ? 'Found' : 'Missing');
    console.log('API Key Length:', env.VITE_GOOGLE_MAPS_API_KEY?.length || 0);

    return {
        plugins: [
            laravel({
                input: [
                    'resources/css/app.css',
                    'resources/js/app.tsx',
                    'resources/js/pages/mapplanner.tsx',
                    'resources/js/pages/generatetree.tsx',
                    'resources/js/pages/product.tsx',
                    'resources/js/pages/map-planner.tsx',
                    'resources/js/pages/generate-tree.tsx',
                    'resources/js/pages/home-garden-planner.tsx',
                    'resources/js/pages/home-garden-summary.tsx'
                ],
                refresh: true,
            }),
            react(),
            cesium(),
        ],
        
        // Environment variables configuration
        envPrefix: ['VITE_'],
        
        // Development server configuration
        server: {
            port: 5173,
            host: true,
            hmr: {
                host: 'localhost',
            },
            // บังคับให้โหลด environment variables ใหม่
            watch: {
                usePolling: true,
            },
        },
        
        // Build configuration
        build: {
            outDir: 'public/build',
            emptyOutDir: true,
            manifest: true,
            rollupOptions: {
                input: 'resources/js/app.tsx',
            },
            // Optimize chunks for better loading
            chunkSizeWarningLimit: 1000,
        },
        
        resolve: {
            alias: {
                '@': '/resources/js',
                'ziggy-js': path.resolve(__dirname, 'vendor/tightenco/ziggy'),
            },
        },
        
        // Define global constants - ปรับปรุงให้ใช้ environment variables ที่โหลดมา
        define: {
            // Make sure Google Maps API key is available
            'process.env.REACT_APP_GOOGLE_MAPS_API_KEY': JSON.stringify(env.VITE_GOOGLE_MAPS_API_KEY),
            'import.meta.env.VITE_GOOGLE_MAPS_API_KEY': JSON.stringify(env.VITE_GOOGLE_MAPS_API_KEY),
            // เพิ่ม fallback
            'globalThis.GOOGLE_MAPS_API_KEY': JSON.stringify(env.VITE_GOOGLE_MAPS_API_KEY),
            // Cesium base URL - vite-plugin-cesium will copy assets to public/cesium/
            'CESIUM_BASE_URL': JSON.stringify('/cesium/'),
        },
        
        // Optimization
        optimizeDeps: {
            include: [
                'react',
                'react-dom',
                '@googlemaps/react-wrapper',
                'react-leaflet',
                'leaflet',
                'html2canvas',
                'jspdf',
                'react-icons/fa',
                'leaflet-curve',
                'leaflet-image',
                'leaflet-geosearch',
                'leaflet-kml',
                'leaflet.markercluster',
                'leaflet-routing-machine',
                'lucide-react',
                'react-markdown',
                'cesium',
            ],
            exclude: [
                // Exclude Google Maps from pre-bundling to avoid issues
                'google-maps',
            ],
            // บังคับให้ rebuild dependencies เมื่อ environment variables เปลี่ยน
            force: command === 'serve',
        },
        
        // เพิ่ม environment variables ให้กับ client
        envDir: '.', // Look for .env files in root directory
    };
});