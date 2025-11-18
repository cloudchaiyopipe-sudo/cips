// 1. Import
import { useState, useEffect } from 'react';
import { Head, router } from '@inertiajs/react';
import QRCodeSVG from 'react-qr-code';
import FreeNav from './components/freeNav';
import { getTranslations } from './utils/language';

// 2. Component
function FreeCheckout() {
    // LINE Official Account ID
    const LINE_ID = '@fang.nitipoom';
    const LINE_FRIEND_URL = `https://line.me/R/ti/p/${LINE_ID}`;

    const [translations, setTranslations] = useState(getTranslations());
    const [sprinklerSpecs, setSprinklerSpecs] = useState<{
        flowRatePerMin: number;
        waterPressure: number;
        radius: number;
        totalLPM: number;
    } | null>(null);
    const [calculatedSprinklerSpecs, setCalculatedSprinklerSpecs] = useState<{
        flowRatePerMin: number;
        waterPressure: number;
        radius: number;
        totalLPM: number;
    } | null>(null);
    const [sprinklerMode, setSprinklerMode] = useState<'preset' | 'calculated'>('preset');
    const [pipeRecommendations, setPipeRecommendations] = useState<{
        main: { sizeMM: number; sizeInch: string; reason: string };
        subMain: { sizeMM: number; sizeInch: string; reason: string };
        lateral: { sizeMM: number; sizeInch: string; reason: string };
    } | null>(null);
    const [pipeTypeRecommendations, setPipeTypeRecommendations] = useState<{
        main?: {
            pe?: { sizeMM: number; sizeInch: string; pressureLoss?: number };
            pvc?: { sizeMM: number; sizeInch: string; pressureLoss?: number };
        };
        subMain?: {
            pe?: { sizeMM: number; sizeInch: string; pressureLoss?: number };
            pvc?: { sizeMM: number; sizeInch: string; pressureLoss?: number };
        };
        lateral?: {
            pe?: { sizeMM: number; sizeInch: string; pressureLoss?: number };
            pvc?: { sizeMM: number; sizeInch: string; pressureLoss?: number };
        };
    } | null>(null);
    const [pumpRecommendations, setPumpRecommendations] = useState<{
        flowRate: number;
        head: number;
        power: number;
        reason: string;
        specifications: string;
    } | null>(null);

    // Listen for language changes
    useEffect(() => {
        const handleLanguageChange = () => {
            setTranslations(getTranslations());
        };

        window.addEventListener('storage', handleLanguageChange);
        window.addEventListener('languageChanged', handleLanguageChange);
        window.addEventListener('focus', handleLanguageChange);

        return () => {
            window.removeEventListener('storage', handleLanguageChange);
            window.removeEventListener('languageChanged', handleLanguageChange);
            window.removeEventListener('focus', handleLanguageChange);
        };
    }, []);

    // Load data from localStorage
    useEffect(() => {
        const savedFlowRateConfig = localStorage.getItem('flowRateConfig');
        const savedSprinklerMode = localStorage.getItem('sprinklerMode');

        // Load flow rate config
        let flowRateConfig = {
            flowRatePerMin: 2.5,
            waterPressure: 2.0,
            radius: 4.0,
        };
        if (savedFlowRateConfig) {
            try {
                const config = JSON.parse(savedFlowRateConfig);
                flowRateConfig = {
                    flowRatePerMin: config.flowRatePerMin || 2.5,
                    waterPressure: config.waterPressure || 2.0,
                    radius: config.radius || 4.0,
                };
            } catch (error) {
                console.error('Error loading flow rate config:', error);
            }
        }

        // Set sprinkler specs
        setSprinklerSpecs({
            flowRatePerMin: flowRateConfig.flowRatePerMin,
            waterPressure: flowRateConfig.waterPressure,
            radius: flowRateConfig.radius,
            totalLPM: 0,
        });

        // Load sprinkler mode
        if (savedSprinklerMode) {
            setSprinklerMode(savedSprinklerMode as 'preset' | 'calculated');
        }

        // Load calculated sprinkler specs if available
        const savedCalculatedSpecs = localStorage.getItem('calculatedSprinklerSpecs');
        if (savedCalculatedSpecs) {
            try {
                const specs = JSON.parse(savedCalculatedSpecs);
                setCalculatedSprinklerSpecs(specs);
            } catch (error) {
                console.error('Error loading calculated specs:', error);
            }
        }

        // Load pipe recommendations
        const savedPipeRecs = localStorage.getItem('pipeRecommendations');
        if (savedPipeRecs) {
            try {
                const recs = JSON.parse(savedPipeRecs);
                setPipeRecommendations(recs);
            } catch (error) {
                console.error('Error loading pipe recommendations:', error);
            }
        }

        // Load pipe type recommendations
        const savedPipeTypeRecs = localStorage.getItem('pipeTypeRecommendations');
        if (savedPipeTypeRecs) {
            try {
                const recs = JSON.parse(savedPipeTypeRecs);
                setPipeTypeRecommendations(recs);
            } catch (error) {
                console.error('Error loading pipe type recommendations:', error);
            }
        }

        // Load pump recommendations
        const savedPumpRecs = localStorage.getItem('pumpRecommendations');
        if (savedPumpRecs) {
            try {
                const recs = JSON.parse(savedPumpRecs);
                setPumpRecommendations(recs);
            } catch (error) {
                console.error('Error loading pump recommendations:', error);
            }
        }
    }, []);

    const handleBack = () => {
        router.visit('/free-plan/product');
    };

    const currentSpecs = sprinklerMode === 'preset' ? sprinklerSpecs : calculatedSprinklerSpecs;

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-700 via-slate-600 to-slate-700">
            <Head title={translations.checkout || 'Checkout'} />

            {/* Navbar */}
            <FreeNav />

            {/* Main Content */}
            <div className="mx-auto max-w-6xl px-4 py-6 md:px-6 md:py-8">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-white">
                        {translations.checkoutModalTitle || 'Equipment Specifications Summary'}
                    </h1>
                    <p className="mt-2 text-slate-300">
                        {translations.checkoutModalMessage || 'Please review the equipment specifications below and contact us via LINE for further assistance.'}
                    </p>
                </div>

                {/* Equipment Specifications Table */}
                <div className="mb-8 overflow-hidden rounded-lg border border-slate-600 bg-slate-800/50 shadow-lg">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-700/50">
                                <tr>
                                    <th className="px-4 py-4 text-center text-sm font-semibold text-white w-24">
                                        {translations.image || 'Image'}
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                                        {translations.equipment || 'Equipment'}
                                    </th>
                                    <th className="px-6 py-4 text-left text-sm font-semibold text-white">
                                        {translations.specifications || 'Specifications'}
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {/* Sprinkler */}
                                <tr className="bg-emerald-900/20 hover:bg-emerald-900/30">
                                    <td className="px-4 py-4 text-center">
                                        <div className="flex items-center justify-center">
                                            <img
                                                src="/freePlanImg/sprinkler.png"
                                                alt="Sprinkler"
                                                className="h-16 w-16 rounded-lg object-contain"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-emerald-300">
                                        {translations.sprinklerSelector || 'Sprinkler'}
                                    </td>
                                    <td className="px-6 py-4 text-slate-200">
                                        {currentSpecs ? (
                                            <div className="space-y-1">
                                                <div>
                                                    <span className="text-slate-400">
                                                        {translations.flowRateProduct || 'Flow Rate'}:{' '}
                                                    </span>
                                                    <span className="font-semibold text-emerald-400">
                                                        {currentSpecs.flowRatePerMin.toFixed(2)} LPM
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400">
                                                        {translations.pressureProduct || 'Pressure'}:{' '}
                                                    </span>
                                                    <span className="font-semibold text-emerald-400">
                                                        {currentSpecs.waterPressure} Bar
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400">
                                                        {translations.radiusProduct || 'Radius'}:{' '}
                                                    </span>
                                                    <span className="font-semibold text-emerald-400">
                                                        {currentSpecs.radius} m
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400">Loading...</span>
                                        )}
                                    </td>
                                </tr>

                                {/* Main Pipe */}
                                <tr className="bg-rose-900/20 hover:bg-rose-900/30">
                                    <td className="px-4 py-4 text-center">
                                        <div className="flex items-center justify-center">
                                            <img
                                                src="/freePlanImg/pvc-pipes.png"
                                                alt="Main Pipe"
                                                className="h-16 w-16 rounded-lg object-contain"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-rose-300">
                                        {translations.mainPipeSelection || 'Main Pipe'}
                                    </td>
                                    <td className="px-6 py-4 text-slate-200">
                                        {pipeRecommendations?.main ? (
                                            <div>
                                                <span className="text-slate-400">
                                                    {translations.recommendedSize || 'Recommended Size'}:{' '}
                                                </span>
                                                <span className="font-semibold text-rose-400">
                                                    {(() => {
                                                        const pe = pipeTypeRecommendations?.main?.pe;
                                                        const pvc = pipeTypeRecommendations?.main?.pvc;
                                                        const parts: string[] = [];
                                                        if (pvc) {
                                                            parts.push(`PVC: ${pvc.sizeInch}`);
                                                        }
                                                        if (pe) {
                                                            parts.push(`PE: ${pe.sizeMM.toFixed(2)}mm`);
                                                        }
                                                        return parts.length > 0 ? parts.join(', ') : `${pipeRecommendations.main.sizeMM.toFixed(2)}mm (${pipeRecommendations.main.sizeInch})`;
                                                    })()}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400">Loading...</span>
                                        )}
                                    </td>
                                </tr>

                                {/* SubMain Pipe */}
                                <tr className="bg-violet-900/20 hover:bg-violet-900/30">
                                    <td className="px-4 py-4 text-center">
                                        <div className="flex items-center justify-center">
                                            <img
                                                src="/freePlanImg/pvc-pipes.png"
                                                alt="SubMain Pipe"
                                                className="h-16 w-16 rounded-lg object-contain"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-violet-300">
                                        {translations.subMainPipeSelection || 'SubMain Pipe'}
                                    </td>
                                    <td className="px-6 py-4 text-slate-200">
                                        {pipeRecommendations?.subMain ? (
                                            <div>
                                                <span className="text-slate-400">
                                                    {translations.recommendedSize || 'Recommended Size'}:{' '}
                                                </span>
                                                <span className="font-semibold text-violet-400">
                                                    {(() => {
                                                        const pe = pipeTypeRecommendations?.subMain?.pe;
                                                        const pvc = pipeTypeRecommendations?.subMain?.pvc;
                                                        const parts: string[] = [];
                                                        if (pvc) {
                                                            parts.push(`PVC: ${pvc.sizeInch}`);
                                                        }
                                                        if (pe) {
                                                            parts.push(`PE: ${pe.sizeMM.toFixed(2)}mm`);
                                                        }
                                                        return parts.length > 0 ? parts.join(', ') : `${pipeRecommendations.subMain.sizeMM.toFixed(2)}mm (${pipeRecommendations.subMain.sizeInch})`;
                                                    })()}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400">Loading...</span>
                                        )}
                                    </td>
                                </tr>

                                {/* Lateral Pipe */}
                                <tr className="bg-amber-900/20 hover:bg-amber-900/30">
                                    <td className="px-4 py-4 text-center">
                                        <div className="flex items-center justify-center">
                                            <img
                                                src="/freePlanImg/pvc-pipes.png"
                                                alt="Lateral Pipe"
                                                className="h-16 w-16 rounded-lg object-contain"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-amber-300">
                                        {translations.lateralPipeSelection || 'Lateral Pipe'}
                                    </td>
                                    <td className="px-6 py-4 text-slate-200">
                                        {pipeRecommendations?.lateral ? (
                                            <div>
                                                <span className="text-slate-400">
                                                    {translations.recommendedSize || 'Recommended Size'}:{' '}
                                                </span>
                                                <span className="font-semibold text-amber-400">
                                                    {(() => {
                                                        const pe = pipeTypeRecommendations?.lateral?.pe;
                                                        const pvc = pipeTypeRecommendations?.lateral?.pvc;
                                                        const parts: string[] = [];
                                                        if (pvc) {
                                                            parts.push(`PVC: ${pvc.sizeInch}`);
                                                        }
                                                        if (pe) {
                                                            parts.push(`PE: ${pe.sizeMM.toFixed(2)}mm`);
                                                        }
                                                        return parts.length > 0 ? parts.join(', ') : `${pipeRecommendations.lateral.sizeMM.toFixed(2)}mm (${pipeRecommendations.lateral.sizeInch})`;
                                                    })()}
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400">Loading...</span>
                                        )}
                                    </td>
                                </tr>

                                {/* Pump */}
                                <tr className="bg-sky-900/20 hover:bg-sky-900/30">
                                    <td className="px-4 py-4 text-center">
                                        <div className="flex items-center justify-center">
                                            <img
                                                src="/images/water-pump.png"
                                                alt="Pump"
                                                className="h-16 w-16 rounded-lg object-contain"
                                            />
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 font-medium text-sky-300">
                                        {translations.pumpSelection || 'Pump'}
                                    </td>
                                    <td className="px-6 py-4 text-slate-200">
                                        {pumpRecommendations ? (
                                            <div className="space-y-1">
                                                <div>
                                                    <span className="text-slate-400">
                                                        {translations.flowRateProduct || 'Flow Rate'}:{' '}
                                                    </span>
                                                    <span className="font-semibold text-sky-400">
                                                        {pumpRecommendations.flowRate} LPM
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400">
                                                        {translations.headProduct || 'Head'}:{' '}
                                                    </span>
                                                    <span className="font-semibold text-sky-400">
                                                        {pumpRecommendations.head} m
                                                    </span>
                                                </div>
                                                <div>
                                                    <span className="text-slate-400">
                                                        {translations.powerProduct || 'Power'}:{' '}
                                                    </span>
                                                    <span className="font-semibold text-sky-400">
                                                        {pumpRecommendations.power} HP
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <span className="text-slate-400">Loading...</span>
                                        )}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* LINE QR Code Section */}
                <div className="rounded-lg border border-green-600/50 bg-green-900/20 p-6">
                    <div className="mb-4 text-center">
                        <h3 className="mb-2 text-xl font-semibold text-green-400">
                            {translations.addFriendOnLine || 'Add Friend on LINE'}
                        </h3>
                        <p className="text-sm text-green-300">
                            {translations.scanQRCodeToContact || 'Scan the QR code below to contact us for more information and assistance.'}
                        </p>
                    </div>
                    <div className="flex justify-center">
                        <div className="rounded-lg bg-white p-4 shadow-lg">
                            <QRCodeSVG
                                value={LINE_FRIEND_URL}
                                size={250}
                                level="M"
                                style={{
                                    height: 'auto',
                                    maxWidth: '100%',
                                    width: '100%',
                                }}
                                viewBox="0 0 250 250"
                            />
                        </div>
                    </div>
                    <p className="mt-4 text-center text-sm text-green-300">
                        {translations.orAddFriendAtLineId || 'Or add friend at LINE ID'}{' '}
                        <span className="font-semibold text-green-400">{LINE_ID}</span>
                    </p>
                </div>

                {/* Back Button */}
                <div className="mt-6 flex justify-center">
                    <button
                        onClick={handleBack}
                        className="rounded-lg bg-slate-600 px-8 py-3 font-medium text-white transition-colors hover:bg-slate-500"
                    >
                        {translations.back || 'Back'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// 3. Export
export default FreeCheckout;

