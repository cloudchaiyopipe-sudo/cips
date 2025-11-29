// 1. Import
import { useState, useEffect } from 'react';
import { getTranslations } from '../utils/language';
import { motion } from 'framer-motion';

// 2. FreeFooter Component
function FreeFooter() {
    // State for translations
    const [translations, setTranslations] = useState(getTranslations());

    // 3. Hooks
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

    // Animation variants
    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    // 4. Return TSX
    return (
        <footer className="relative w-full border-t border-white/5 bg-slate-950 pb-0 pt-12 md:pb-12 md:pt-16">
            {/* Background Glow Effect */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
                 <div className="absolute -left-[10%] bottom-0 h-[300px] w-[300px] rounded-full bg-blue-500/5 blur-[100px]" />
                 <div className="absolute -right-[10%] bottom-0 h-[300px] w-[300px] rounded-full bg-green-500/5 blur-[100px]" />
            </div>

            <motion.div 
                initial="hidden"
                whileInView="visible"
                viewport={{ once: true }}
                transition={{ staggerChildren: 0.1 }}
                className="relative mx-auto max-w-7xl px-4 md:px-6"
            >
                <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:gap-12">
                    {/* Information Section */}
                    <div className="flex flex-col gap-8">
                        {/* Kanok Products */}
                        <motion.div 
                            variants={itemVariants}
                            className="rounded-2xl border border-white/5 bg-slate-900/50 p-6 backdrop-blur-sm transition-colors hover:border-white/10"
                        >
                            <div className="mb-3 flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-blue-500" />
                                <h3 className="font-bold text-slate-100 md:text-lg">{translations.kanokProducts}</h3>
                            </div>
                            <div className="space-y-2 text-sm text-slate-400">
                                <p className="leading-relaxed">{translations.kanokAddress}</p>
                                <div className="flex items-center gap-2 text-slate-300">
                                    <svg className="h-4 w-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                    <span>{translations.kanokPhone}</span>
                                </div>
                                <div className="flex items-center gap-2 text-blue-400/80 hover:text-blue-400">
                                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" /></svg>
                                    <a href={`https://${translations.kanokWebsite}`} target="_blank" rel="noreferrer">{translations.kanokWebsite}</a>
                                </div>
                            </div>
                        </motion.div>

                        {/* Chaiyo Pipe & Fitting */}
                        <motion.div 
                            variants={itemVariants}
                            className="rounded-2xl border border-white/5 bg-slate-900/50 p-6 backdrop-blur-sm transition-colors hover:border-white/10"
                        >
                             <div className="mb-3 flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-green-500" />
                                <h3 className="font-bold text-slate-100 md:text-lg">{translations.chaiyoPipeFitting}</h3>
                            </div>
                            <div className="space-y-2 text-sm text-slate-400">
                                <p className="leading-relaxed">{translations.chaiyoAddress}</p>
                                <div className="flex items-center gap-2 text-slate-300">
                                    <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                                    <span>{translations.chaiyoPhone}</span>
                                </div>
                                <div className="flex items-center gap-2 text-slate-300">
                                    <svg className="h-4 w-4 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                                    <span>{translations.chaiyoEmail}</span>
                                </div>
                            </div>
                        </motion.div>
                    </div>

                    {/* Map Section */}
                    <motion.div 
                        variants={itemVariants}
                        className="h-full min-h-[300px]"
                    >
                        <div className="h-full overflow-hidden rounded-2xl border border-white/10 bg-slate-800">
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

                <motion.div 
                    variants={itemVariants}
                    className="mt-12 text-center text-xs text-slate-500"
                >
                    &copy; {new Date().getFullYear()} Chaiyo Irrigation Planning System. All rights reserved.
                </motion.div>
            </motion.div>
        </footer>
    );
}

// 3. Export
export default FreeFooter;
