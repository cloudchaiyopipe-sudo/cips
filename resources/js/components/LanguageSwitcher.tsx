import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';

const LanguageSwitcher: React.FC = () => {
    const { language, setLanguage } = useLanguage();

    const toggleLanguage = () => {
        setLanguage(language === 'en' ? 'th' : 'en');
    };

    return (
        <button
            onClick={toggleLanguage}
            className="flex items-center gap-1 rounded-lg border border-gray-600 bg-gray-800 px-2 py-1 text-white transition-colors duration-200 hover:border-gray-500 hover:bg-gray-700 sm:gap-2 sm:px-3 sm:py-2"
            title={language === 'en' ? 'เปลี่ยนเป็นภาษาไทย' : 'Switch to English'}
        >
            <span className="text-xs font-medium sm:text-sm">
                {language === 'en' ? '🇺🇸 EN' : '🇹🇭 TH'}
            </span>
            <svg
                className="h-3 w-3 sm:h-4 sm:w-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
            >
                <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129"
                />
            </svg>
        </button>
    );
};

export default LanguageSwitcher;
