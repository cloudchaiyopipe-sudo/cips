// FreeContact Page - Contact / ติดต่อ (content from former FreeFooter)
import { Head } from '@inertiajs/react';
import { useState, useEffect } from 'react';
import FreeNav from './components/freeNav';
import FootNav from './components/footNav';
import { getTranslations } from './utils/language';
import { motion } from 'framer-motion';

const LINE_ICON_PATH = 'M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63h2.386c.346 0 .627.285.627.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.63-.63.346 0 .628.285.628.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314';

function FreeContact() {
    const [translations, setTranslations] = useState(getTranslations());
    const [contactQrInstallError, setContactQrInstallError] = useState(false);

    useEffect(() => {
        const handleLanguageChange = () => setTranslations(getTranslations());
        window.addEventListener('storage', handleLanguageChange);
        window.addEventListener('languageChanged', handleLanguageChange);
        window.addEventListener('focus', handleLanguageChange);
        return () => {
            window.removeEventListener('storage', handleLanguageChange);
            window.removeEventListener('languageChanged', handleLanguageChange);
            window.removeEventListener('focus', handleLanguageChange);
        };
    }, []);

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 },
    };

    return (
        <>
            <Head title={translations.navContact || 'Contact'} />
            <div className="min-h-screen bg-gradient-to-b from-slate-900 via-slate-900 to-slate-950">
                <FreeNav />
                <main className="pb-24 pt-4 md:pb-12 md:pt-28">
                    <div className="relative mx-auto max-w-7xl md:px-6">
                        <motion.div
                            initial="hidden"
                            animate="visible"
                            transition={{ staggerChildren: 0.1 }}
                            className="relative"
                        >
                            {/* ข้อมูลจาก popup ติดต่อ: แสดงตรงบนหน้า */}
                            <motion.div variants={itemVariants} className="mb-8 md:mb-12">
                                <h2 className="pl-4 mb-1 text-xl font-bold text-white sm:mb-2 sm:text-2xl md:text-3xl">
                                    {translations.navContact}
                                </h2>
                                <p className="pl-4 mb-6 text-sm text-slate-400">
                                    {translations.contactModalWaterTeamDesc}
                                </p>
                                <div className="mx-auto max-w-lg">
                                    <div className="border border-slate-700 bg-slate-800/50 p-4 sm:p-5 md:p-6">
                                        <h3 className="mb-2 text-lg font-semibold text-white">
                                            {translations.contactModalWaterTeam}
                                        </h3>
                                        <p className="mb-4 text-sm text-slate-400">
                                            {translations.contactModalWaterTeamDesc}
                                        </p>
                                        <div className="flex flex-col items-center gap-4">
                                            <div className="flex flex-col items-center">
                                                <span className="mb-2 text-xs text-slate-500">{translations.contactModalScanQR}</span>
                                                <div className="flex h-32 w-32 items-center justify-center overflow-hidden rounded-lg border-2 border-slate-600 bg-white p-1">
                                                    {!contactQrInstallError ? (
                                                        <img
                                                            src="/images/water.jpg"
                                                            alt="Line QR - ติดตั้งระบบน้ำ"
                                                            className="h-full w-full object-contain"
                                                            onError={() => setContactQrInstallError(true)}
                                                        />
                                                    ) : (
                                                        <div className="flex h-full w-full items-center justify-center bg-slate-100 p-2 text-center text-xs text-slate-500">
                                                            QR Code
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="w-full text-center">
                                                <p className="mb-1 text-xs text-slate-500">{translations.contactModalLineId}</p>
                                                <p className="mb-2 font-mono text-sm font-medium text-green-400">-</p>
                                                <a
                                                    href="https://line.me/ti/p/~"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-2 rounded-lg bg-[#06C755] px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-[#05b04c]"
                                                >
                                                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                                                        <path d={LINE_ICON_PATH} />
                                                    </svg>
                                                    {translations.contactModalOpenLine}
                                                </a>
                                            </div>
                                            <div className="w-full border-t border-slate-700 pt-4 text-center">
                                                <p className="mb-1 text-xs text-slate-500">{translations.contactModalPhone}</p>
                                                <a href="tel:02-451-1111" className="text-base font-medium text-white hover:text-teal-400">
                                                    02-451-1111 ต่อ 188
                                                </a>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>

                            <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-12">
                                {/* Information Section */}
                                <div className="flex flex-col gap-8">
                                    {/* Kanok Products */}
                                    <motion.div
                                        variants={itemVariants}
                                        className="border border-white/5 bg-slate-900/50 p-6 backdrop-blur-sm transition-colors hover:border-white/10"
                                    >
                                        <div className="mb-3 flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-blue-500" />
                                            <h3 className="font-bold text-slate-100 md:text-lg">
                                                {translations.kanokProducts}
                                            </h3>
                                        </div>
                                        <div className="space-y-2 text-sm text-slate-400">
                                            <p className="leading-relaxed">{translations.kanokAddress}</p>
                                            <div className="flex items-center gap-2 text-slate-300">
                                                <svg
                                                    className="h-4 w-4 text-blue-500"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                                    />
                                                </svg>
                                                <span>{translations.kanokPhone}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-blue-400/80 hover:text-blue-400">
                                                <svg
                                                    className="h-4 w-4"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"
                                                    />
                                                </svg>
                                                <a
                                                    href={`https://${translations.kanokWebsite}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                >
                                                    {translations.kanokWebsite}
                                                </a>
                                            </div>
                                        </div>
                                    </motion.div>

                                    {/* Chaiyo Pipe & Fitting */}
                                    <motion.div
                                        variants={itemVariants}
                                        className="border border-white/5 bg-slate-900/50 p-6 backdrop-blur-sm transition-colors hover:border-white/10"
                                    >
                                        <div className="mb-3 flex items-center gap-2">
                                            <div className="h-2 w-2 rounded-full bg-green-500" />
                                            <h3 className="font-bold text-slate-100 md:text-lg">
                                                {translations.chaiyoPipeFitting}
                                            </h3>
                                        </div>
                                        <div className="space-y-2 text-sm text-slate-400">
                                            <p className="leading-relaxed">{translations.chaiyoAddress}</p>
                                            <div className="flex items-center gap-2 text-slate-300">
                                                <svg
                                                    className="h-4 w-4 text-green-500"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                                                    />
                                                </svg>
                                                <span>{translations.chaiyoPhone}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-slate-300">
                                                <svg
                                                    className="h-4 w-4 text-green-500"
                                                    fill="none"
                                                    stroke="currentColor"
                                                    viewBox="0 0 24 24"
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        strokeWidth={2}
                                                        d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                                                    />
                                                </svg>
                                                <span>{translations.chaiyoEmail}</span>
                                            </div>
                                        </div>
                                    </motion.div>
                                </div>

                                {/* Map Section */}
                                <motion.div variants={itemVariants} className="h-full min-h-[300px]">
                                    <div className="h-full overflow-hidden border border-white/10 bg-slate-800">
                                        <div className="h-full">
                                            <iframe
                                                src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d966.7642280441407!2d100.42009950900939!3d13.665848348465142!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x30e2bd69ca5b596f%3A0x9343e7f0feddd541!2z4Lia4LiI4LiBLiDguIHguJnguIHguYLguJvguKPguJTguLHguIHguKrguYwgKOC4quC4s-C4meC4seC4geC4h-C4suC4meC5g-C4q-C4jeC5iCkgS0FOT0sgUFJPRFVDVCBDTy4sIExURC4!5e1!3m2!1sen!2sth!4v1753790987668!5m2!1sen!2sth"
                                                width="100%"
                                                height="100%"
                                                style={{ border: 0, minHeight: '350px' }}
                                                loading="lazy"
                                                referrerPolicy="no-referrer-when-downgrade"
                                                className="rounded"
                                                title="Kanok Products Map"
                                            ></iframe>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>
                        </motion.div>
                    </div>
                </main>
                <FootNav />
            </div>
        </>
    );
}

export default FreeContact;
