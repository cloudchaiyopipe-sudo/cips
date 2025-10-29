import React from 'react';
import { IrrigationZone } from '../../utils/irrigationZoneUtils';

interface ZoneEditButtonProps {
    zones: IrrigationZone[];
    isEditMode: boolean;
    onToggleEditMode: () => void;
    onExitEditMode: () => void;
    disabled?: boolean;
    className?: string;
}

const ZoneEditButton: React.FC<ZoneEditButtonProps> = ({
    zones,
    isEditMode,
    onToggleEditMode,
    onExitEditMode,
    disabled = false,
    className = '',
}) => {
    const hasZones = zones && zones.length > 0;

    const handleClick = () => {
        if (isEditMode) {
            onExitEditMode();
        } else {
            onToggleEditMode();
        }
    };

    if (!hasZones) {
        return null;
    }

    return (
        <div className={`flex items-center gap-2 ${className}`}>
            <button
                onClick={handleClick}
                disabled={disabled}
                className={`
                    flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium
                    transition-all duration-200 ease-in-out
                    ${
                        isEditMode
                            ? 'border-orange-500 bg-orange-500 text-white shadow-md hover:bg-orange-600'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                    }
                    ${
                        disabled
                            ? 'cursor-not-allowed opacity-50'
                            : 'hover:shadow-sm active:scale-95'
                    }
                `}
                title={isEditMode ? 'ออกจากโหมดแก้ไขโซน' : 'แก้ไขโซนอัตโนมัติ'}
            >
                <span className="text-lg">{isEditMode ? '🔧' : '✏️'}</span>
                <span>{isEditMode ? 'ออกจากโหมดแก้ไข' : 'แก้ไขโซน'}</span>
            </button>

            {isEditMode && (
                <div className="flex items-center gap-2 rounded-md border border-orange-200 bg-orange-50 px-3 py-1 text-sm text-orange-600">
                    <span className="animate-pulse">🎯</span>
                    <span>คลิกที่โซนที่ต้องการแก้ไข</span>
                </div>
            )}
        </div>
    );
};

export default ZoneEditButton;
