export interface TourStep {
    id: string;
    target: string;
    title: string;
    description: string;
    position: 'top' | 'bottom' | 'left' | 'right' | 'center';
    action?: {
        type: 'click' | 'wait' | 'scroll';
        selector?: string;
        delay?: number;
    };
    highlight?: boolean;
    nextButtonText?: string;
    skipButtonText?: string;
}

export const STORAGE_KEY = 'horticulture_onboarding_tour_completed';

export const hasCompletedTour = (): boolean => {
    if (typeof window === 'undefined') return false;
    const completed = localStorage.getItem(STORAGE_KEY);
    return completed === 'true';
};

export const hasSkippedTour = (): boolean => {
    if (typeof window === 'undefined') return false;
    const skipped = localStorage.getItem(STORAGE_KEY);
    return skipped === 'skipped';
};

export const shouldShowTour = (): boolean => {
    if (typeof window === 'undefined') return false;
    const status = localStorage.getItem(STORAGE_KEY);
    return !status || status === 'false';
};

export const markTourCompleted = (): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, 'true');
};

export const markTourSkipped = (): void => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, 'skipped');
};

export const resetTour = (): void => {
    if (typeof window === 'undefined') return;
    localStorage.removeItem(STORAGE_KEY);
};

export const getInitialTourSteps = (t: (key: string) => string): TourStep[] => {
    return [
        {
            id: 'welcome',
            target: 'center',
            title: 'ยินดีต้อนรับสู่ระบบออกแบบระบบน้ำพืชสวน',
            description:
                'ระบบนี้จะช่วยคุณออกแบบระบบน้ำพืชสวนแบบครบวงจร ตั้งแต่การกำหนดพื้นที่ วางแผนโซน ไปจนถึงการออกแบบท่อน้ำทั้งหมด',
            position: 'center',
            highlight: false,
            nextButtonText: 'เริ่มต้น',
        },
        {
            id: 'search_location',
            target: 'search-control',
            title: 'ขั้นตอนที่ 1: ค้นหาตำแหน่งพื้นที่',
            description:
                'เริ่มต้นด้วยการค้นหาตำแหน่งพื้นที่ของคุณในช่องค้นหานี้ คุณสามารถพิมพ์ชื่อสถานที่ หรือพิกัด GPS (เช่น 13.7563,100.5018)',
            position: 'bottom',
            highlight: true,
        },
        {
            id: 'main_area_tab',
            target: 'main-area-tab',
            title: 'แถบพื้นที่หลัก',
            description:
                'แถบนี้ใช้สำหรับกำหนดพื้นที่หลักของโครงการ คลิกเพื่อเริ่มวาดพื้นที่ของคุณบนแผนที่',
            position: 'right',
            highlight: true,
        },
        {
            id: 'draw_main_area',
            target: 'draw-main-area',
            title: 'วาดพื้นที่หลัก',
            description:
                'คลิกปุ่มนี้เพื่อเริ่มวาดพื้นที่หลักของคุณบนแผนที่ คลิกหลายจุดเพื่อสร้างรูปหลายเหลี่ยม แล้วดับเบิลคลิกเพื่อจบการวาด',
            position: 'right',
            highlight: true,
            action: {
                type: 'scroll',
            },
        },
        {
            id: 'water_system_tab',
            target: 'water-system-tab',
            title: 'แถบระบบน้ำ',
            description:
                'แถบนี้ใช้สำหรับจัดการระบบน้ำทั้งหมด ตั้งแต่ปั๊มน้ำ ท่อหลัก ท่อรอง และท่อย่อย รวมถึงการตั้งค่าหัวฉีด',
            position: 'right',
            highlight: true,
        },
        {
            id: 'summary_tab',
            target: 'summary-tab',
            title: 'แถบสรุป',
            description:
                'แถบนี้ใช้สำหรับดูสรุปข้อมูลโครงการ สถิติต่างๆ และบันทึกโครงการ เมื่อออกแบบเสร็จแล้วสามารถมาดูสรุปที่นี่',
            position: 'right',
            highlight: true,
        },
        {
            id: 'plant_tab',
            target: 'plant-tab',
            title: 'แถบพืช',
            description:
                'แถบนี้ใช้สำหรับจัดการพืชในโครงการ คุณสามารถเลือกประเภทพืช กำหนดระยะห่าง และวางตำแหน่งพืชบนแผนที่',
            position: 'right',
            highlight: true,
        },
        {
            id: 'select_plant_type',
            target: 'select-plant-type',
            title: 'เลือกประเภทพืช',
            description:
                'เลือกประเภทพืชที่คุณต้องการปลูก จากรายการที่มีให้ หรือสร้างประเภทพืชใหม่ของคุณเอง',
            position: 'right',
            highlight: true,
        },
        {
            id: 'generate_plants',
            target: 'generate-plants',
            title: 'สร้างพืชอัตโนมัติ',
            description:
                'หลังจากกำหนดพื้นที่และเลือกประเภทพืชแล้ว คลิกปุ่มนี้เพื่อสร้างพืชอัตโนมัติตามระยะห่างที่กำหนด',
            position: 'right',
            highlight: true,
        },
        {
            id: 'zone_tab',
            target: 'zone-tab',
            title: 'แถบโซน',
            description:
                'แถบนี้ใช้สำหรับจัดการโซนการให้น้ำ คุณสามารถสร้างโซนอัตโนมัติ หรือวาดโซนด้วยมือ',
            position: 'right',
            highlight: true,
        },
        {
            id: 'auto_zone',
            target: 'auto-zone',
            title: 'สร้างโซนอัตโนมัติ',
            description:
                'คลิกปุ่มนี้เพื่อสร้างโซนการให้น้ำอัตโนมัติ ระบบจะแบ่งพืชออกเป็นโซนตามจำนวนที่คุณกำหนด',
            position: 'right',
            highlight: true,
        },
        {
            id: 'main_pipe',
            target: 'main-pipe',
            title: 'วาดท่อหลัก',
            description:
                'ท่อหลักคือท่อที่เชื่อมต่อจากปั๊มน้ำไปยังโซนต่างๆ เริ่มวาดจากตำแหน่งปั๊มไปยังโซนที่ต้องการ',
            position: 'right',
            highlight: true,
        },
        {
            id: 'submain_pipe',
            target: 'submain-pipe',
            title: 'วาดท่อรอง',
            description:
                'ท่อรองคือท่อที่อยู่ในแต่ละโซน ใช้สำหรับกระจายน้ำไปยังท่อย่อย วาดท่อรองภายในโซนที่ต้องการ',
            position: 'right',
            highlight: true,
        },
        {
            id: 'lateral_pipe',
            target: 'lateral-pipe',
            title: 'วาดท่อย่อย',
            description:
                'ท่อย่อยคือท่อที่เชื่อมต่อกับท่อรองและไปยังพืช ใช้สำหรับให้น้ำกับพืชแต่ละต้น',
            position: 'right',
            highlight: true,
        },
        {
            id: 'sprinkler_config',
            target: 'sprinkler-config',
            title: 'ตั้งค่าหัวฉีด',
            description:
                'คลิกปุ่มนี้เพื่อตั้งค่าหัวฉีดน้ำ เช่น อัตราการไหล ความดัน และจำนวนหัวฉีดต่อต้น',
            position: 'right',
            highlight: true,
        },
        {
            id: 'zoom_to_main_area',
            target: 'zoom-to-main-area',
            title: 'ซูมไปยังพื้นที่หลัก',
            description:
                'คลิกปุ่มนี้เพื่อซูมแผนที่ไปยังพื้นที่หลักที่คุณวาดไว้ ทำให้เห็นภาพรวมของพื้นที่ได้ชัดเจน',
            position: 'left',
            highlight: true,
        },
        {
            id: '3d_map',
            target: '3d-map',
            title: 'แผนที่ 3 มิติ',
            description:
                'เปิดดูแผนที่ 3 มิติเพื่อเห็นภาพรวมของพื้นที่แบบ 3D เหมาะสำหรับการตรวจสอบความสูงต่ำของพื้นที่',
            position: 'left',
            highlight: true,
        },
        {
            id: 'distance_measurement',
            target: 'distance-measurement',
            title: 'ไม้บรรทัดวัดระยะ',
            description:
                'เปิดใช้งานเครื่องมือนี้เพื่อวัดระยะทางระหว่างจุดต่างๆ บนแผนที่ คลิกจุดเริ่มต้น แล้วเลื่อนเมาส์เพื่อวัดระยะ',
            position: 'left',
            highlight: true,
        },
        {
            id: 'elevation_tools',
            target: 'elevation-tools',
            title: 'เครื่องมือความสูงต่ำ',
            description:
                'ใช้เครื่องมือนี้เพื่อดูความสูงของพื้นที่ คลิกเพื่อดูความสูง ณ จุดนั้น หรือสร้างกราฟแสดงความสูงตามเส้นทาง',
            position: 'left',
            highlight: true,
        },
        {
            id: 'add_plant',
            target: 'add-plant',
            title: 'เพิ่มต้นไม้',
            description:
                'คลิกปุ่มนี้เพื่อเข้าสู่โหมดเพิ่มต้นไม้ แล้วคลิกบนแผนที่เพื่อวางต้นไม้เพิ่มเติม',
            position: 'left',
            highlight: true,
        },
        {
            id: 'plant_move_mode',
            target: 'plant-move-mode',
            title: 'เข้าสู่โหมดเลื่อนต้นไม้',
            description:
                'คลิกปุ่มนี้เพื่อเข้าสู่โหมดเลื่อนต้นไม้ ใช้ปุ่มลูกศรเพื่อเลื่อนต้นไม้ทั้งหมด หรือเฉพาะต้นไม้ที่เลือก',
            position: 'left',
            highlight: true,
        },
        {
            id: 'connect_lateral_pipes',
            target: 'connect-lateral-pipes',
            title: 'เชื่อมท่อย่อย',
            description:
                'คลิกปุ่มนี้เพื่อเข้าสู่โหมดเชื่อมท่อย่อย คลิกที่ต้นไม้หรือท่อเพื่อเชื่อมต่อท่อย่อยระหว่างกัน',
            position: 'left',
            highlight: true,
        },
        {
            id: 'undo',
            target: 'undo',
            title: 'ย้อนกลับ',
            description:
                'คลิกปุ่มนี้เพื่อย้อนกลับการกระทำล่าสุด ใช้เมื่อต้องการแก้ไขสิ่งที่ทำผิดพลาด',
            position: 'left',
            highlight: true,
        },
        {
            id: 'redo',
            target: 'redo',
            title: 'ทำซ้ำ',
            description:
                'คลิกปุ่มนี้เพื่อทำซ้ำการกระทำที่ถูกย้อนกลับไปแล้ว ใช้เมื่อต้องการกลับมาทำสิ่งที่ยกเลิกไป',
            position: 'left',
            highlight: true,
        },
        {
            id: 'toggle_compact_mode',
            target: 'toggle-compact-mode',
            title: 'ย่อ/ขยายแผง',
            description:
                'คลิกปุ่มนี้เพื่อย่อหรือขยายแผงควบคุม ทำให้มีพื้นที่ดูแผนที่มากขึ้น หรือแสดงรายละเอียดเพิ่มเติม',
            position: 'left',
            highlight: true,
        },
        {
            id: 'plant_rotation',
            target: 'plant-rotation',
            title: 'หมุนแนวพืช',
            description:
                'ใช้เครื่องมือนี้เพื่อหมุนแนวพืชให้สอดคล้องกับทิศทางของพื้นที่ หรือเพื่อการวางแผนที่ดีขึ้น',
            position: 'right',
            highlight: true,
        },
        {
            id: 'save_draft',
            target: 'save-draft',
            title: 'บันทึกร่าง',
            description:
                'บันทึกโครงการเป็นร่างเพื่อเก็บไว้ทำงานต่อภายหลัง ไม่จำเป็นต้องมีข้อมูลครบทุกอย่าง',
            position: 'right',
            highlight: true,
        },
        {
            id: 'save_project',
            target: 'save-project',
            title: 'บันทึกโครงการ',
            description:
                'บันทึกโครงการและไปดูผลลัพธ์ ระบบจะสรุปข้อมูลทั้งหมดและแสดงรายงานการออกแบบ',
            position: 'right',
            highlight: true,
        },
        {
            id: 'complete',
            target: 'center',
            title: 'เสร็จสิ้นการแนะนำ',
            description:
                'ตอนนี้คุณพร้อมที่จะเริ่มออกแบบระบบน้ำพืชสวนของคุณแล้ว! หากต้องการดูคำแนะนำนี้อีกครั้ง สามารถคลิกที่ไอคอนคำแนะนำในเมนู',
            position: 'center',
            highlight: false,
            nextButtonText: 'เริ่มใช้งาน',
        },
    ];
};

export const getAdvancedTourSteps = (t: (key: string) => string): TourStep[] => {
    return [
        {
            id: 'elevation_tools',
            target: 'elevation-tools',
            title: 'เครื่องมือวัดความสูง',
            description:
                'ใช้เครื่องมือนี้เพื่อดูความสูงของพื้นที่ และสร้างกราฟแสดงความสูงตามเส้นทางที่กำหนด',
            position: 'right',
            highlight: true,
        },
        {
            id: 'distance_measurement',
            target: 'distance-measurement',
            title: 'เครื่องมือวัดระยะทาง',
            description:
                'เปิดใช้งานเครื่องมือนี้เพื่อวัดระยะทางระหว่างจุดต่างๆ บนแผนที่ ใช้สำหรับตรวจสอบระยะห่างระหว่างพืชหรือท่อ',
            position: 'right',
            highlight: true,
        },
        {
            id: '3d_map',
            target: '3d-map',
            title: 'แผนที่ 3 มิติ',
            description:
                'เปิดดูแผนที่ 3 มิติเพื่อเห็นภาพรวมของพื้นที่แบบ 3D เหมาะสำหรับการตรวจสอบความสูงต่ำของพื้นที่',
            position: 'right',
            highlight: true,
        },
        {
            id: 'plant_rotation',
            target: 'plant-rotation',
            title: 'หมุนแนวพืช',
            description:
                'ใช้เครื่องมือนี้เพื่อหมุนแนวพืชให้สอดคล้องกับทิศทางของพื้นที่ หรือเพื่อการวางแผนที่ดีขึ้น',
            position: 'right',
            highlight: true,
        },
        {
            id: 'zone_editing',
            target: 'zone-editing',
            title: 'แก้ไขโซน',
            description:
                'หลังจากสร้างโซนแล้ว คุณสามารถแก้ไขรูปร่างของโซนได้โดยคลิกปุ่มแก้ไขโซน แล้วลากจุดต่างๆ',
            position: 'right',
            highlight: true,
        },
    ];
};
