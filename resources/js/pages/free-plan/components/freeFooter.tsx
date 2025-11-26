// 1. Import
import { useState, useEffect } from 'react';
import { getTranslations } from '../utils/language';

// 2. FreeFooter Component
function FreeFooter() {
    // State for translations
    const [translations, setTranslations] = useState(getTranslations());

    // 3. Hooks
    // Listen for language changes
    useEffect(() => {
        const handleLanguageChange = () => {
            setTranslations(getTranslations());
        };

        // Listen for storage changes (when language is changed in other components)
        window.addEventListener('storage', handleLanguageChange);

        // Listen for custom language change event
        window.addEventListener('languageChanged', handleLanguageChange);

        // Also check on focus (when user comes back to tab)
        window.addEventListener('focus', handleLanguageChange);

        return () => {
            window.removeEventListener('storage', handleLanguageChange);
            window.removeEventListener('languageChanged', handleLanguageChange);
            window.removeEventListener('focus', handleLanguageChange);
        };
    }, []);

    // 4. Return TSX
    return (
        <div className="w-full bg-[#000005] px-4 pb-0 pt-6 md:px-6 md:py-8">
            <div className="mx-auto grid max-w-4xl grid-cols-2 gap-4 text-xs text-white md:gap-8 md:text-sm">
                {/* Kanok Products */}
                <div className="space-y-1 md:space-y-2">
                    <h3 className="font-bold">{translations.kanokProducts}</h3>
                    <p className="leading-relaxed text-slate-200">{translations.kanokAddress}</p>
                    <p>{translations.kanokPhone}</p>
                    <p className="text-slate-300">{translations.kanokWebsite}</p>
                </div>

                {/* Chaiyo Pipe & Fitting */}
                <div className="space-y-1 md:space-y-2">
                    <h3 className="font-bold">{translations.chaiyoPipeFitting}</h3>
                    <p className="leading-relaxed text-slate-200">{translations.chaiyoAddress}</p>
                    <p>{translations.chaiyoPhone}</p>
                    <p className="text-slate-300">{translations.chaiyoEmail}</p>
                </div>
            </div>

            {/* Map Section */}
            <div className="mx-auto mt-6 max-w-4xl overflow-hidden rounded-lg bg-slate-300 md:mt-8">
                <div className="h-80">
                    <iframe
                        src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d966.7642280441407!2d100.42009950900939!3d13.665848348465142!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x30e2bd69ca5b596f%3A0x9343e7f0feddd541!2z4Lia4LiI4LiBLiDguIHguJnguIHguYLguJvguKPguJTguLHguIHguKrguYwgKOC4quC4s-C4meC4seC4geC4h-C4suC4meC5g-C4q-C4jeC5iCkgS0FOT0sgUFJPRFVDVCBDTy4sIExURC4!5e1!3m2!1sen!2sth!4v1753790987668!5m2!1sen!2sth"
                        width="100%"
                        height="100%"
                        style={{ border: 0 }}
                        loading="lazy"
                        referrerPolicy="no-referrer-when-downgrade"
                        className="rounded"
                    ></iframe>
                </div>
            </div>
        </div>
    );
}

// 3. Export
export default FreeFooter;
