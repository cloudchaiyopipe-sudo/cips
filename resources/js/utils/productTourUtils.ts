import type { TourStep } from './onboardingTourUtils';

export type { TourStep };

export const PRODUCT_TOUR_STORAGE_KEY = 'product_onboarding_tour_completed';

export const hasCompletedProductTour = (): boolean => {
    if (typeof window === 'undefined') return false;
    const completed = localStorage.getItem(PRODUCT_TOUR_STORAGE_KEY);
    return completed === 'true';
};

export const hasSkippedProductTour = (): boolean => {
    if (typeof window === 'undefined') return false;
    const skipped = localStorage.getItem(PRODUCT_TOUR_STORAGE_KEY);
    return skipped === 'skipped';
};

export const hasDontShowAgainProductTour = (): boolean => {
    if (typeof window === 'undefined') return false;
    const dontShowAgain = localStorage.getItem(PRODUCT_TOUR_STORAGE_KEY);
    return dontShowAgain === 'dont_show_again';
};

export const shouldShowProductTour = (): boolean => {
    if (typeof window === 'undefined') return false;
    // ถ้าเคยเลือก "อย่าแสดงอีก" แล้วก็ไม่ต้องแสดง
    const status = localStorage.getItem(PRODUCT_TOUR_STORAGE_KEY);
    return status !== 'dont_show_again';
};

export const markProductTourCompleted = (): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(PRODUCT_TOUR_STORAGE_KEY, 'true');
};

export const markProductTourSkipped = (): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(PRODUCT_TOUR_STORAGE_KEY, 'skipped');
};

export const markProductTourDontShowAgain = (): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(PRODUCT_TOUR_STORAGE_KEY, 'dont_show_again');
};

export const resetProductTour = (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(PRODUCT_TOUR_STORAGE_KEY);
};

export const getProductTourSteps = (t: (key: string) => string): TourStep[] => {
    return [
        {
            id: 'welcome',
            target: 'center',
            title: t('ยินดีต้อนรับสู่ระบบคำนวณและออกแบบระบบน้ำ'),
            description: t(
                'ระบบนี้จะช่วยคุณคำนวณและออกแบบระบบน้ำให้เหมาะสมกับโครงการของคุณ ตั้งแต่การป้อนข้อมูลพื้นฐาน การเลือกอุปกรณ์ ไปจนถึงการสรุปค่าใช้จ่าย'
            ),
            position: 'center',
            highlight: false,
            nextButtonText: t('เริ่มต้น'),
        },
        {
            id: 'project_image',
            target: 'project-image',
            title: t('ขั้นตอนที่ 1: รูปแผนผังสวน'),
            description: t(
                'เริ่มต้นด้วยการเพิ่มรูปแผนผังโครงการของคุณ คุณสามารถอัปโหลดรูปภาพหรือใช้รูปที่ส่งออกจากหน้าสรุปผล'
            ),
            position: 'bottom',
            highlight: true,
        },
        {
            id: 'zone_selection',
            target: 'zone-selection',
            title: t('ขั้นตอนที่ 2: เลือกโซน'),
            description: t(
                'หากโครงการของคุณมีหลายโซน คุณสามารถเลือกโซนที่ต้องการทำงานได้ที่นี่ แต่ละโซนสามารถตั้งค่าอุปกรณ์แยกกันได้'
            ),
            position: 'top',
            highlight: true,
        },
        {
            id: 'pump_option',
            target: 'pump-option',
            title: t('ขั้นตอนที่ 3: ตัวเลือกปั๊มน้ำ'),
            description: t(
                'เลือกว่าต้องการใช้ปั๊มน้ำในระบบหรือไม่ หากไม่เลือก ระบบจะข้ามขั้นตอนการเลือกปั๊มน้ำ'
            ),
            position: 'top',
            highlight: true,
        },
        {
            id: 'tab_input',
            target: 'tab-input',
            title: t('ขั้นตอนที่ 4: ดูข้อมูลพื้นที่'),
            description: t(
                'แท็บนี้ใช้สำหรับป้อนข้อมูลพื้นฐานของโครงการ เช่น ขนาดพื้นที่ จำนวนต้นไม้/หัวฉีด ความต้องการน้ำ และข้อมูลท่อต่างๆ'
            ),
            position: 'bottom',
            highlight: true,
        },
        {
            id: 'tab_sprinkler',
            target: 'tab-sprinkler',
            title: t('ขั้นตอนที่ 5: เลือกสปริงเกอร์'),
            description: t(
                'แท็บนี้ใช้สำหรับเลือกสปริงเกอร์หรือหัวฉีดที่เหมาะสมกับโครงการ ระบบจะแนะนำสปริงเกอร์ที่เหมาะสมตามความต้องการน้ำของคุณ'
            ),
            position: 'bottom',
            highlight: true,
        },
        {
            id: 'tab_pipe',
            target: 'tab-pipe',
            title: t('ขั้นตอนที่ 6: เลือกระบบท่อ'),
            description: t(
                'แท็บนี้ใช้สำหรับเลือกท่อต่างๆ ในระบบ เช่น ท่อย่อย ท่อเมนรอง ท่อเมนหลัก และท่ออีมิเตอร์ ระบบจะคำนวณและแนะนำท่อที่เหมาะสม'
            ),
            position: 'bottom',
            highlight: true,
        },
        {
            id: 'tab_pump',
            target: 'tab-pump',
            title: t('ขั้นตอนที่ 7: เลือกปั๊มน้ำ'),
            description: t(
                'แท็บนี้ใช้สำหรับเลือกปั๊มน้ำที่เหมาะสมกับระบบ ระบบจะคำนวณความต้องการน้ำและแรงดันที่ต้องการ แล้วแนะนำปั๊มที่เหมาะสม'
            ),
            position: 'bottom',
            highlight: true,
        },
        {
            id: 'tab_cost',
            target: 'tab-cost',
            title: t('ขั้นตอนที่ 8: สรุปค่าใช้จ่าย'),
            description: t(
                'แท็บนี้แสดงสรุปค่าใช้จ่ายทั้งหมดของโครงการ รวมถึงราคาอุปกรณ์แต่ละประเภท และสามารถออกใบเสนอราคาได้ที่นี่'
            ),
            position: 'bottom',
            highlight: true,
        },
        {
            id: 'save_project',
            target: 'save-project',
            title: t('บันทึกโครงการ'),
            description: t(
                'คลิกปุ่มนี้เพื่อบันทึกโครงการของคุณ ข้อมูลจะถูกบันทึกไว้ในระบบและสามารถกลับมาแก้ไขได้ภายหลัง'
            ),
            position: 'top',
            highlight: true,
        },
        {
            id: 'edit_project',
            target: 'edit-project',
            title: t('แก้ไขโครงการ'),
            description: t(
                'คลิกปุ่มนี้เพื่อแก้ไขโครงการที่บันทึกไว้แล้ว คุณสามารถกลับไปแก้ไขข้อมูลหรืออุปกรณ์ที่เลือกไว้ได้'
            ),
            position: 'top',
            highlight: true,
        },
        {
            id: 'new_project',
            target: 'new-project',
            title: t('สร้างโครงการใหม่'),
            description: t(
                'คลิกปุ่มนี้เพื่อเริ่มสร้างโครงการใหม่ ระบบจะล้างข้อมูลทั้งหมดและให้คุณเริ่มต้นใหม่'
            ),
            position: 'top',
            highlight: true,
        },
        {
            id: 'complete',
            target: 'center',
            title: t('เสร็จสิ้นการแนะนำ'),
            description: t(
                'ตอนนี้คุณพร้อมที่จะเริ่มใช้งานระบบคำนวณและออกแบบระบบน้ำแล้ว! หากต้องการดูคำแนะนำนี้อีกครั้ง สามารถคลิกที่ไอคอนคำแนะนำในเมนู'
            ),
            position: 'center',
            highlight: false,
            nextButtonText: t('เริ่มใช้งาน'),
        },
    ];
};

