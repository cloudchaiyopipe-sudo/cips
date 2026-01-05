import React from 'react';
import { FaTimes } from 'react-icons/fa';

interface StepInfoModalProps {
    isOpen: boolean;
    onClose: () => void;
    stepNumber: 1 | 2 | 3 | 4 | 5;
    t: (key: string) => string;
}

const StepInfoModal: React.FC<StepInfoModalProps> = ({ isOpen, onClose, stepNumber, t }) => {
    if (!isOpen) return null;

    const getStepInfo = () => {
        switch (stepNumber) {
            case 1:
                return {
                    title: t('ขั้นตอนที่ 1 : พื้นที่หลัก'),
                    canDo: [
                        t('วาดพื้นที่หลักบนแผนที่'),
                        t('ลบพื้นที่หลักที่สร้างไว้'),
                        t('แก้ไขพื้นที่หลักโดยการลบและวาดใหม่'),
                        t('ดูพื้นที่ที่สร้างแล้วในหน่วยไร่'),
                    ],
                    mustDo: [
                        t('ต้องวาดพื้นที่หลักก่อนทำขั้นตอนอื่น'),
                        t('พื้นที่หลักต้องเป็นรูปปิด (polygon)'),
                    ],
                    optional: [
                        t('สามารถวาดพื้นที่ปลูกพืชแยกได้ (สำหรับพืชหลายชนิด)'),
                        t('สามารถสร้างต้นไม้ในพื้นที่หลักได้ทันที'),
                    ],
                    howTo: [
                        t('1. คลิกปุ่ม "วาดพื้นที่หลัก"'),
                        t('2. คลิกบนแผนที่เพื่อสร้างจุดแรกของพื้นที่'),
                        t('3. คลิกต่อเนื่องเพื่อสร้างจุดอื่นๆ ของพื้นที่'),
                        t('4. คลิกจุดแรกอีกครั้ง หรือ double-click เพื่อปิดรูป polygon'),
                        t('5. คลิกปุ่ม "หยุดวาดพื้นที่" เพื่อออกจากโหมดวาด'),
                        t('6. ระบบจะแสดงพื้นที่ที่สร้างแล้วในหน่วยไร่'),
                    ],
                };
            case 2:
                return {
                    title: t('ขั้นตอนที่ 2 : พื้นที่หลีกเลี่ยง'),
                    canDo: [
                        t('วาดพื้นที่หลีกเลี่ยงหลายพื้นที่ได้'),
                        t('เลือกประเภทพื้นที่หลีกเลี่ยง (สิ่งก่อสร้าง, ห้องควบคุม, แหล่งน้ำ, ถนน, อื่นๆ)'),
                        t('ลบพื้นที่หลีกเลี่ยงที่สร้างไว้'),
                        t('แสดง/ซ่อนเส้นวัดระยะของพื้นที่หลีกเลี่ยง'),
                        t('ปรับมุมของเส้นวัดระยะ'),
                    ],
                    mustDo: [
                        t('ต้องมีพื้นที่หลักก่อน (ขั้นตอนที่ 1)'),
                        t('ต้องมีต้นไม้ในพื้นที่หลักก่อน'),
                    ],
                    optional: [
                        t('ไม่จำเป็นต้องสร้างพื้นที่หลีกเลี่ยงหากไม่มีสิ่งกีดขวาง'),
                        t('สามารถสร้างได้หลายพื้นที่หลีกเลี่ยง'),
                        t('สามารถลบพื้นที่หลีกเลี่ยงได้ตลอดเวลา'),
                    ],
                    howTo: [
                        t('1. เลือกประเภทพื้นที่หลีกเลี่ยงจาก dropdown (สิ่งก่อสร้าง, ห้องควบคุม, แหล่งน้ำ, ถนน, อื่นๆ)'),
                        t('2. คลิกปุ่ม "วาดพื้นที่หลีกเลี่ยง"'),
                        t('3. คลิกบนแผนที่เพื่อสร้างจุดแรกของพื้นที่หลีกเลี่ยง'),
                        t('4. คลิกต่อเนื่องเพื่อสร้างจุดอื่นๆ'),
                        t('5. คลิกจุดแรกอีกครั้ง หรือ double-click เพื่อปิดรูป polygon'),
                        t('6. คลิกปุ่ม "หยุดวาด" เพื่อออกจากโหมดวาด'),
                        t('7. สามารถสร้างพื้นที่หลีกเลี่ยงได้หลายพื้นที่'),
                        t('8. คลิกปุ่มแสดง/ซ่อนเพื่อดูเส้นวัดระยะ'),
                    ],
                };
            case 3:
                return {
                    title: t('ขั้นตอนที่ 3 : แบ่งโซนให้น้ำ'),
                    canDo: [
                        t('แบ่งโซนอัตโนมัติ (ระบบจะคำนวณให้)'),
                        t('แบ่งโซนด้วยตัวเอง (วาดโซนเอง)'),
                        t('ดูข้อมูลโซนที่สร้างแล้ว'),
                        t('แก้ไขโซนที่สร้างไว้'),
                        t('ลบโซน'),
                    ],
                    mustDo: [
                        t('ต้องมีพื้นที่หลักก่อน (ขั้นตอนที่ 1)'),
                        t('ต้องมีต้นไม้ในพื้นที่หลักก่อน'),
                        t('ต้องแบ่งโซนก่อนไปยังแท็บถัดไป'),
                    ],
                    optional: [
                        t('สามารถแบ่งโซนอัตโนมัติหรือวาดเองได้'),
                        t('สามารถสร้างหลายโซนได้'),
                        t('สามารถแก้ไขหรือลบโซนได้ตลอดเวลา'),
                    ],
                    howTo: [
                        t('วิธีที่ 1: แบ่งโซนอัตโนมัติ'),
                        t('  - คลิกปุ่ม "แบ่งโซนอัตโนมัติ"'),
                        t('  - กำหนดจำนวนโซนที่ต้องการ'),
                        t('  - ระบบจะคำนวณและแบ่งโซนให้อัตโนมัติ'),
                        t('  - ตรวจสอบข้อมูลโซนที่สร้างแล้ว'),
                        t('วิธีที่ 2: แบ่งโซนด้วยตัวเอง'),
                        t('  - คลิกปุ่ม "แบ่งโซนด้วยตัวเอง"'),
                        t('  - กำหนดจำนวนโซนที่ต้องการวาด'),
                        t('  - คลิกบนแผนที่เพื่อวาดโซนแรก'),
                        t('  - คลิกต่อเนื่องเพื่อสร้างจุดของโซน'),
                        t('  - คลิกจุดแรกอีกครั้งเพื่อปิดรูป polygon'),
                        t('  - ทำซ้ำจนครบทุกโซน'),
                        t('  - ตรวจสอบข้อมูลโซนแต่ละโซน'),
                    ],
                };
            case 4:
                return {
                    title: t('ขั้นตอนที่ 1 : ปั๊มน้ำ'),
                    canDo: [
                        t('วางปั๊มน้ำบนแผนที่'),
                        t('เปลี่ยนตำแหน่งปั๊มน้ำ'),
                        t('ลบปั๊มน้ำที่วางไว้'),
                        t('ดูสถานะปั๊มน้ำ'),
                    ],
                    mustDo: [
                        t('ต้องวางปั๊มน้ำก่อนวางท่อน้ำ'),
                        t('ปั๊มน้ำต้องอยู่ในพื้นที่หลัก'),
                        t('สามารถวางปั๊มน้ำได้แค่ 1 ตัว'),
                    ],
                    optional: [
                        t('สามารถเปลี่ยนตำแหน่งปั๊มน้ำได้ตลอดเวลา'),
                        t('สามารถลบและวางใหม่ได้'),
                    ],
                    howTo: [
                        t('1. คลิกปุ่ม "วางปั๊มน้ำ"'),
                        t('2. คลิกบนแผนที่ในตำแหน่งที่ต้องการวางปั๊มน้ำ'),
                        t('3. ตรวจสอบว่าปั๊มน้ำอยู่ในพื้นที่หลัก'),
                        t('4. ระบบจะแสดงไอคอนปั๊มน้ำบนแผนที่'),
                        t('5. คลิกปุ่ม "เปลี่ยนตำแหน่งปั๊ม" เพื่อย้ายตำแหน่ง'),
                        t('6. คลิกปุ่มลบ (🗑️) เพื่อลบปั๊มน้ำ'),
                        t('7. คลิกปุ่ม "หยุดวางปั๊ม" เพื่อออกจากโหมดวาง'),
                    ],
                };
            case 5:
                return {
                    title: t('ขั้นตอนที่ 2 : วางท่อน้ำ'),
                    canDo: [
                        t('วางท่อเมน (Main Pipe)'),
                        t('วางท่อเมนรอง (Sub Main Pipe)'),
                        t('วางท่อย่อย (Lateral Pipe)'),
                        t('ลบท่อ'),
                        t('เชื่อมต่อท่ออัตโนมัติ'),
                    ],
                    mustDo: [
                        t('ต้องมีปั๊มน้ำก่อน (ขั้นตอนที่ 1)'),
                        t('ต้องวางท่อย่อยอย่างน้อย 1 เส้นก่อนไปยังแท็บถัดไป'),
                        t('ท่อเมนต้องคลิกเริ่มจากปั๊มน้ำ'),
                    ],
                    optional: [
                        t('สามารถวางท่อแบบ Freehand หรือแบบปกติได้'),
                        t('สามารถวางท่อย่อยได้หลายเส้น'),
                        t('สามารถแก้ไขหรือลบท่อได้ตลอดเวลา'),
                        t('สามารถใช้ระบบเชื่อมต่ออัตโนมัติได้'),
                    ],
                    howTo: [
                        t('วางท่อเมน (Main Pipe):'),
                        t('  1. คลิกปุ่ม "วางท่อเมน"'),
                        t('  2. คลิกบนแผนที่เพื่อสร้างจุดเริ่มต้น'),
                        t('  3. คลิกอีกครั้งเพื่อสร้างจุดสิ้นสุด'),
                        t('  4. ท่อเมนจะเชื่อมต่อกับปั๊มน้ำอัตโนมัติ'),
                        t('วางท่อเมนรอง (Sub Main Pipe):'),
                        t('  1. คลิกปุ่ม "วางท่อเมนรอง"'),
                        t('  2. คลิกบนแผนที่เพื่อสร้างจุดเริ่มต้น (ควรเชื่อมกับท่อเมน)'),
                        t('  3. คลิกอีกครั้งเพื่อสร้างจุดสิ้นสุด'),
                        t('  4. ระบบจะเชื่อมต่ออัตโนมัติหากใกล้กับท่ออื่น'),
                        t('วางท่อย่อย (Lateral Pipe):'),
                        t('  1. คลิกปุ่ม "วางท่อย่อย"'),
                        t('  2. เลือกโหมด: วางบนต้นไม้ หรือ วางระหว่างต้นไม้'),
                        t('  3. คลิกบนแผนที่เพื่อวางท่อ'),
                        t('  4. ระบบจะสร้างหัวฉีดอัตโนมัติ'),
                        t('วางท่อแบบ Freehand:'),
                        t('  1. เปิดโหมด Freehand'),
                        t('  2. กดเมาส์ค้างและลากเพื่อวาดท่อ'),
                        t('  3. ปล่อยเมาส์เพื่อสิ้นสุดการวาด'),
                    ],
                };
            default:
                return {
                    title: '',
                    canDo: [],
                    mustDo: [],
                    optional: [],
                    howTo: [],
                };
        }
    };

    const stepInfo = getStepInfo();

    return (
        <div
            className={`fixed inset-0 z-[9999] flex items-center justify-center ${isOpen ? 'block' : 'hidden'
                }`}
        >
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={onClose}></div>
            <div className="relative w-full max-w-5xl mx-4 rounded-xl bg-gray-900 shadow-2xl">
                {/* Header */}
                <div className="sticky top-0 z-10 flex items-center justify-between border-b border-gray-700 bg-gray-900 px-6 py-4 rounded-t-xl">
                    <h3 className="text-2xl font-bold text-white">{stepInfo.title}</h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-gray-800 rounded-lg"
                    >
                        <FaTimes className="h-5 w-5" />
                    </button>
                </div>

                {/* Content with scroll */}
                <div className="max-h-[75vh] overflow-y-auto px-6 py-5">
                    <div className="space-y-5">
                    {/* Grid Layout for first 3 sections */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* สิ่งที่ทำได้ */}
                        <div className="rounded-xl border-2 border-blue-500 bg-gradient-to-br from-blue-900/30 to-blue-800/20 p-5">
                            <h4 className="mb-4 flex items-center text-base font-bold text-blue-200">
                                <span className="mr-2 text-lg">✅</span>
                                {t('สิ่งที่ทำได้')}
                            </h4>
                            <ul className="space-y-2.5">
                                {stepInfo.canDo.map((item, index) => (
                                    <li key={index} className="flex items-start text-sm text-gray-100 leading-relaxed">
                                        <span className="mr-2.5 mt-1.5 text-blue-400 font-bold">•</span>
                                        <span className="flex-1">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* สิ่งที่ต้องทำ */}
                        <div className="rounded-xl border-2 border-red-500 bg-gradient-to-br from-red-900/30 to-red-800/20 p-5">
                            <h4 className="mb-4 flex items-center text-base font-bold text-red-200">
                                <span className="mr-2 text-lg">⚠️</span>
                                {t('สิ่งที่ต้องทำ')}
                            </h4>
                            <ul className="space-y-2.5">
                                {stepInfo.mustDo.map((item, index) => (
                                    <li key={index} className="flex items-start text-sm text-gray-100 leading-relaxed">
                                        <span className="mr-2.5 mt-1.5 text-red-400 font-bold">•</span>
                                        <span className="flex-1">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* สิ่งที่ทำก็ได้ไม่ทำก็ได้ */}
                        <div className="rounded-xl border-2 border-yellow-500 bg-gradient-to-br from-yellow-900/30 to-yellow-800/20 p-5">
                            <h4 className="mb-4 flex items-center text-base font-bold text-yellow-200">
                                <span className="mr-2 text-lg">ℹ️</span>
                                {t('สิ่งที่ทำก็ได้ไม่ทำก็ได้')}
                            </h4>
                            <ul className="space-y-2.5">
                                {stepInfo.optional.map((item, index) => (
                                    <li key={index} className="flex items-start text-sm text-gray-100 leading-relaxed">
                                        <span className="mr-2.5 mt-1.5 text-yellow-400 font-bold">•</span>
                                        <span className="flex-1">{item}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>

                    {/* วิธีการทำ */}
                    {stepInfo.howTo && stepInfo.howTo.length > 0 && (
                        <div className="rounded-xl border-2 border-green-500 bg-gradient-to-br from-green-900/30 to-green-800/20 p-5">
                            <h4 className="mb-4 flex items-center text-base font-bold text-green-200">
                                <span className="mr-2 text-lg">📖</span>
                                {t('วิธีการทำ')}
                            </h4>
                            <div className="space-y-2.5">
                                {stepInfo.howTo.map((item, index) => {
                                    const isSubItem = item.startsWith('  ') || item.startsWith('  -');
                                    const isSectionHeader = item.includes(':') && !isSubItem;
                                    
                                    if (isSectionHeader) {
                                        return (
                                            <div key={index} className="mt-4 mb-2 pb-2 border-b border-green-700/50">
                                                <div className="text-base font-bold text-green-200">{item}</div>
                                            </div>
                                        );
                                    } else if (isSubItem) {
                                        return (
                                            <div key={index} className="ml-6 flex items-start">
                                                <span className="mr-3 mt-1.5 text-green-400">→</span>
                                                <span className="text-sm text-gray-200 leading-relaxed flex-1">{item.trim().replace(/^-\s*/, '')}</span>
                                            </div>
                                        );
                                    } else {
                                        return (
                                            <div key={index} className="flex items-start">
                                                <span className="mr-3 mt-1.5 text-green-400 font-bold text-base">•</span>
                                                <span className="text-sm text-gray-100 leading-relaxed flex-1">{item}</span>
                                            </div>
                                        );
                                    }
                                })}
                            </div>
                        </div>
                    )}
                    </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 flex items-center justify-end border-t border-gray-700 bg-gray-900 px-6 py-4 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="rounded-lg bg-blue-600 px-8 py-2.5 font-semibold text-white hover:bg-blue-700 transition-colors shadow-lg hover:shadow-xl"
                    >
                        {t('ปิด')}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StepInfoModal;

