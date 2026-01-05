/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { router } from '@inertiajs/react';

interface UpgradeTierModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentTier: string;
    onUpgrade: (tier: string, months: number) => void;
}

const UpgradeTierModal: React.FC<UpgradeTierModalProps> = ({
    isOpen,
    onClose,
    currentTier,
    onUpgrade,
}) => {
    const [selectedTier, setSelectedTier] = useState<string>('');
    const [selectedMonths, setSelectedMonths] = useState<number>(1);

    if (!isOpen) return null;

    const tiers = [
        {
            id: 'free',
            name: 'Free',
            price: 'Free',
            monthlyTokens: 'xxx',
            features: [
                '100 โทเค็นต่อเดือน',
                'การวางแผนการชลประทานพื้นฐาน',
                'การสนับสนุนมาตรฐาน',
                'ฟีเจอร์ AI จำกัด',
            ],
            color: 'gray',
            popular: false,
        },
        {
            id: 'pro',
            name: 'Pro',
            price: 'xxx',
            monthlyTokens: 'xxx',
            features: [
                '500 โทเค็นต่อเดือน',
                'การวางแผนการชลประทานขั้นสูง',
                'การสนับสนุนแบบพิเศษ',
                'ฟีเจอร์ AI แบบเต็มรูปแบบ',
                'ความสามารถในการส่งออก',
                'การวิเคราะห์ขั้นสูง',
            ],
            color: 'blue',
            popular: true,
        },
        {
            id: 'advanced',
            name: 'Advanced',
            price: 'xxx',
            monthlyTokens: 'xxx',
            features: [
                '1000 โทเค็นต่อเดือน',
                'การวางแผนการชลประทานระดับพรีเมียม',
                'การสนับสนุนแบบพิเศษ 24/7',
                'ฟีเจอร์ AI ทั้งหมด',
                'การส่งออกไม่จำกัด',
                'การวิเคราะห์ขั้นสูง',
                'การเชื่อมต่อแบบกำหนดเอง',
                'การเข้าถึง API',
            ],
            color: 'purple',
            popular: false,
        },
    ];

    const getTierColor = (color: string) => {
        switch (color) {
            case 'blue':
                return {
                    border: 'border-blue-500',
                    bg: 'bg-blue-600',
                    hover: 'hover:bg-blue-700',
                    text: 'text-blue-400',
                };
            case 'purple':
                return {
                    border: 'border-purple-500',
                    bg: 'bg-purple-600',
                    hover: 'hover:bg-purple-700',
                    text: 'text-purple-400',
                };
            default:
                return {
                    border: 'border-gray-500',
                    bg: 'bg-gray-600',
                    hover: 'hover:bg-gray-700',
                    text: 'text-gray-400',
                };
        }
    };

    const handleUpgrade = () => {
        if (selectedTier && selectedTier !== 'free') {
            onUpgrade(selectedTier, selectedMonths);
            onClose();
        }
    };

    const getTotalPrice = (tier: any) => {
        if (tier.id === 'free') return 0;
        return tier.price;
    };

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black bg-opacity-50 p-4">
            <div className="relative z-[10000] max-h-[90vh] w-full max-w-6xl overflow-y-auto rounded-2xl bg-gray-900 p-8">
                {/* Header */}
                <div className="mb-8 flex items-center justify-between">
                    <div>
                        <h2 className="mb-2 text-3xl font-bold text-white">อัปเกรดแผนของคุณ</h2>
                        <p className="text-gray-400">
                            เลือกแผนที่เหมาะกับความต้องการการชลประทานของคุณ
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="text-gray-400 transition-colors hover:text-white"
                    >
                        <svg
                            className="h-8 w-8"
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

                {/* Current Tier Info */}
                <div className="mb-8 rounded-lg border border-gray-700 bg-gray-800 p-6">
                    <h3 className="mb-2 text-lg font-semibold text-white">แผนปัจจุบัน</h3>
                    <div className="flex items-center gap-3">
                        <span className="text-2xl">🆓</span>
                        <div>
                            <div className="text-xl font-bold text-white">
                                {tiers.find((t) => t.id === currentTier)?.name || 'Free'}
                            </div>
                            <div className="text-sm text-gray-400">
                                {tiers.find((t) => t.id === currentTier)?.monthlyTokens || 100}{' '}
                                โทเค็นต่อเดือน
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tier Selection */}
                <div className="mb-8">
                    <h3 className="mb-4 text-xl font-semibold text-white">เลือกแผนของคุณ</h3>
                    <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                        {tiers.map((tier) => {
                            const colors = getTierColor(tier.color);
                            const isSelected = selectedTier === tier.id;
                            const isCurrentTier = currentTier === tier.id;

                            return (
                                <div
                                    key={tier.id}
                                    className={`relative flex flex-col h-full cursor-pointer rounded-lg border-2 p-6 transition-all ${
                                        isSelected
                                            ? `${colors.border} bg-gray-800`
                                            : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                                    } ${isCurrentTier ? 'opacity-50' : ''}`}
                                    onClick={() => !isCurrentTier && setSelectedTier(tier.id)}
                                >
                                    {tier.popular && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 transform">
                                            <span className="whitespace-nowrap rounded-full bg-green-500 px-2 py-1 text-xs font-medium text-white">
                                                ยอดนิยม
                                            </span>
                                        </div>
                                    )}

                                    {isCurrentTier && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 transform">
                                            <span className="whitespace-nowrap rounded-full bg-blue-500 px-2 py-1 text-xs font-medium text-white">
                                                แผนปัจจุบัน
                                            </span>
                                        </div>
                                    )}

                                    <div className="flex-1 flex flex-col justify-start text-center">
                                        <div className="mb-4">
                                            <div className="text-3xl font-bold text-white">
                                                {tier.name}
                                            </div>
                                            <div className="text-sm text-gray-400">
                                                {tier.monthlyTokens} โทเค็น/เดือน
                                            </div>
                                        </div>

                                        <div className="mb-6">
                                            <div className="text-2xl font-bold text-white">
                                                ฿{tier.price}
                                            </div>
                                            <div className="text-sm text-gray-400">ต่อเดือน</div>
                                        </div>

                                        <div className="space-y-2 text-left">
                                            {tier.features.map((feature, index) => (
                                                <div
                                                    key={index}
                                                    className="flex items-center gap-2 text-sm text-gray-300"
                                                >
                                                    <svg
                                                        className="h-4 w-4 flex-shrink-0 text-green-400"
                                                        fill="none"
                                                        stroke="currentColor"
                                                        viewBox="0 0 24 24"
                                                    >
                                                        <path
                                                            strokeLinecap="round"
                                                            strokeLinejoin="round"
                                                            strokeWidth={2}
                                                            d="M5 13l4 4L19 7"
                                                        />
                                                    </svg>
                                                    {feature}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <div className="mt-6">
                                        {isCurrentTier ? (
                                            <button
                                                disabled
                                                className="w-full cursor-not-allowed rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-gray-400"
                                                style={{ marginTop: "auto" }}
                                            >
                                                แผนปัจจุบัน
                                            </button>
                                        ) : (
                                            tier.name === 'free' ? (
                                                <button
                                                    disabled
                                                    className="w-full cursor-not-allowed rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-gray-400"
                                                    style={{ marginTop: "auto" }}
                                                >
                                                    แผนฟรี
                                                </button>
                                            ) : tier.name === 'Pro' ? (
                                                <button
                                                    disabled
                                                    className="w-full cursor-not-allowed rounded-lg bg-gray-600 px-4 py-2 text-sm font-medium text-gray-400"
                                                    style={{ marginTop: "auto" }}
                                                >
                                                    ยังไม่เปิดให้ใช้งาน
                                                </button>
                                            ) : tier.name === 'Advanced' ? (
                                                <button
                                                    onClick={() => {
                                                        router.visit('/fields');
                                                        onClose();
                                                    }}
                                                    className={`w-full rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
                                                        isSelected
                                                            ? `${colors.bg} ${colors.hover}`
                                                            : 'bg-gray-600 hover:bg-gray-700'
                                                    }`}
                                                    style={{ marginTop: "auto" }}
                                                >
                                                    ทดลองใช้ฟรี
                                                </button>
                                            ) : (
                                                <button
                                                    onClick={() => setSelectedTier(tier.id)}
                                                    className={`w-full rounded-lg px-4 py-2 text-sm font-medium text-white transition-colors ${
                                                        isSelected
                                                            ? `${colors.bg} ${colors.hover}`
                                                            : 'bg-gray-600 hover:bg-gray-700'
                                                    }`}
                                                    style={{ marginTop: "auto" }}
                                                >
                                                    {isSelected ? 'เลือกแล้ว' : 'เลือกแผน'}
                                                </button>
                                            )
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Billing Period */}
                {selectedTier && selectedTier !== 'free' && (
                    <div className="mb-8">
                        <h3 className="mb-4 text-xl font-semibold text-white">ระยะเวลาการเรียกเก็บเงิน</h3>
                        <div className="flex gap-4">
                            {[1, 3, 6, 12].map((months) => {
                                const tier = tiers.find((t) => t.id === selectedTier);
                                const totalPrice = getTotalPrice(tier!);

                                return (
                                    <button
                                        key={months}
                                        onClick={() => setSelectedMonths(months)}
                                        className={`rounded-lg border-2 p-4 text-center transition-all ${
                                            selectedMonths === months
                                                ? 'border-blue-500 bg-blue-900/20'
                                                : 'border-gray-700 bg-gray-800 hover:border-gray-600'
                                        }`}
                                    >
                                        <div className="text-lg font-bold text-white">
                                            {months} {months === 1 ? 'เดือน' : 'เดือน'}
                                        </div>
                                        <div className="text-sm text-gray-400">฿{totalPrice}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Price Summary */}
                {selectedTier && selectedTier !== 'free' && (
                    <div className="mb-8 rounded-lg border border-gray-700 bg-gray-800 p-6">
                        <h3 className="mb-4 text-xl font-semibold text-white">สรุปคำสั่งซื้อ</h3>
                        <div className="space-y-2">
                            <div className="flex justify-between text-gray-300">
                                <span>
                                    แผน {tiers.find((t) => t.id === selectedTier)?.name} (
                                    {selectedMonths} {selectedMonths === 1 ? 'เดือน' : 'เดือน'})
                                </span>
                                <span>
                                    ฿
                                    {getTotalPrice(
                                        tiers.find((t) => t.id === selectedTier)!,
                                    )}
                                </span>
                            </div>
                            <div className="border-t border-gray-700 pt-2">
                                <div className="flex justify-between text-lg font-bold text-white">
                                    <span>รวม</span>
                                    <span>
                                        ฿
                                        {getTotalPrice(tiers.find((t) => t.id === selectedTier)!)}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-4">
                    <button
                        onClick={onClose}
                        className="rounded-lg border border-gray-600 px-6 py-3 text-gray-300 transition-colors hover:bg-gray-700 hover:text-white"
                    >
                        ยกเลิก
                    </button>
                    {selectedTier && selectedTier !== 'free' && (
                        <button
                            disabled={true}
                            onClick={handleUpgrade}
                            className="rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white opacity-50 cursor-not-allowed transition-colors"
                        >
                            อัปเกรดเป็น {tiers.find((t) => t.id === selectedTier)?.name}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

export default UpgradeTierModal;
