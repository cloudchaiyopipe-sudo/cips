<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\EquipmentCategory;
use App\Models\EquipmentAttribute;
use App\Models\Equipment;
use App\Models\EquipmentAttributeValue;
use App\Models\PumpAccessory;

class EquipmentSeeder extends Seeder
{
    public function run()
    {
        // สร้าง Categories
        $sprinklerCategory = EquipmentCategory::firstOrCreate(
            ['name' => 'sprinkler'],
            [
                'display_name' => 'สปริงเกอร์/หัวฉีดน้ำ',
                'description' => 'หัวสปริงเกอร์สำหรับรดน้ำ',
                'icon' => '💧'
            ]
        );

        $pumpCategory = EquipmentCategory::firstOrCreate(
            ['name' => 'pump'],
            [
                'display_name' => 'ปั๊มน้ำ',
                'description' => 'ปั๊มน้ำสำหรับระบบชลประทาน',
                'icon' => '🔧'
            ]
        );

        $pipeCategory = EquipmentCategory::firstOrCreate(
            ['name' => 'pipe'],
            [
                'display_name' => 'ท่อ',
                'description' => 'ท่อสำหรับส่งน้ำ',
                'icon' => '🚰'
            ]
        );

        $pumpEquipmentCategory = EquipmentCategory::firstOrCreate(
            ['name' => 'pump_equipment'],
            [
                'display_name' => 'อุปกรณ์ปั๊ม',
                'description' => 'อุปกรณ์เสริมสำหรับปั๊มน้ำ',
                'icon' => '⚙️'
            ]
        );

        $agriculturalFittingsCategory = EquipmentCategory::firstOrCreate(
            ['name' => 'agricultural_fittings'],
            [
                'display_name' => 'ข้อต่อเกษตร',
                'description' => 'ข้อต่อและอุปกรณ์สำหรับระบบชลประทาน',
                'icon' => '🔗'
            ]
        );

        $pvcFittingsCategory = EquipmentCategory::firstOrCreate(
            ['name' => 'pvc_fittings'],
            [
                'display_name' => 'ข้อต่อ PVC',
                'description' => 'ข้อต่อ PVC สำหรับระบบท่อน้ำ',
                'icon' => '🔧'
            ]
        );

        // สร้าง Attributes สำหรับ Sprinkler
        $this->createSprinklerAttributes($sprinklerCategory);
        
        // สร้าง Attributes สำหรับ Pump
        $this->createPumpAttributes($pumpCategory);
        
        // สร้าง Attributes สำหรับ Pipe
        $this->createPipeAttributes($pipeCategory);

        // สร้าง Attributes สำหรับ Agricultural Fittings
        $this->createAgriculturalFittingsAttributes($agriculturalFittingsCategory);

        // สร้าง Attributes สำหรับ PVC Fittings
        $this->createPvcFittingsAttributes($pvcFittingsCategory);

        // สร้างข้อมูลสินค้า
        $this->createSprinklerData($sprinklerCategory);
        $this->createPumpData($pumpCategory);
        $this->createPipeData($pipeCategory);
        $this->createPumpEquipmentData($pumpEquipmentCategory);
        $this->createAgriculturalFittingsData($agriculturalFittingsCategory);
        $this->createPvcFittingsData($pvcFittingsCategory);

        echo "Equipment seeding completed successfully!\n";
    }

    private function createSprinklerAttributes($sprinklerCategory)
    {
        $sprinklerAttrs = [
            [
                'attribute_name' => 'size_mm',
                'display_name' => 'ขนาด',
                'data_type' => 'number',
                'unit' => 'มม.',
                'is_required' => false,
                'sort_order' => 1
            ],
            [
                'attribute_name' => 'size_inch',
                'display_name' => 'ขนาด',
                'data_type' => 'number',
                'unit' => 'นิ้ว',
                'is_required' => false,
                'sort_order' => 2
            ],
            [
                'attribute_name' => 'waterVolumeLitersPerMinute',
                'display_name' => 'อัตราการไหล',
                'data_type' => 'array',
                'unit' => 'ลิตร/นาที',
                'is_required' => false,
                'sort_order' => 3
            ],
            [
                'attribute_name' => 'radiusMeters',
                'display_name' => 'รัศมีการกระจาย',
                'data_type' => 'array',
                'unit' => 'เมตร',
                'is_required' => false,
                'sort_order' => 4
            ],
            [
                'attribute_name' => 'pressureBar',
                'display_name' => 'แรงดัน',
                'data_type' => 'array',
                'unit' => 'บาร์',
                'is_required' => false,
                'sort_order' => 5
            ]
        ];
        
        foreach ($sprinklerAttrs as $attr) {
            EquipmentAttribute::firstOrCreate(
                [
                    'category_id' => $sprinklerCategory->id,
                    'attribute_name' => $attr['attribute_name']
                ],
                array_merge($attr, ['category_id' => $sprinklerCategory->id])
            );
        }
    }

    private function createPumpAttributes($pumpCategory)
    {
        $pumpAttrs = [
            [
                'attribute_name' => 'powerHP',
                'display_name' => 'กำลัง',
                'data_type' => 'number',
                'unit' => 'HP',
                'is_required' => false,
                'sort_order' => 0
            ],
            [
                'attribute_name' => 'powerKW',
                'display_name' => 'กำลัง',
                'data_type' => 'number',
                'unit' => 'kW',
                'is_required' => false,
                'sort_order' => 1
            ],
            [
                'attribute_name' => 'phase',
                'display_name' => 'ระบบไฟฟ้า',
                'data_type' => 'number',
                'unit' => 'เฟส',
                'is_required' => false,
                'sort_order' => 2
            ],
            [
                'attribute_name' => 'inlet_size_inch',
                'display_name' => 'ขนาดท่อเข้า',
                'data_type' => 'number',
                'unit' => 'นิ้ว',
                'is_required' => false,
                'sort_order' => 3
            ],
            [
                'attribute_name' => 'outlet_size_inch',
                'display_name' => 'ขนาดท่อออก',
                'data_type' => 'number',
                'unit' => 'นิ้ว',
                'is_required' => false,
                'sort_order' => 4
            ],
            [
                'attribute_name' => 'flow_rate_lpm',
                'display_name' => 'อัตราการไหล',
                'data_type' => 'array',
                'unit' => 'LPM',
                'is_required' => false,
                'sort_order' => 5
            ],
            [
                'attribute_name' => 'head_m',
                'display_name' => 'ความสูงยก',
                'data_type' => 'array',
                'unit' => 'เมตร',
                'is_required' => false,
                'sort_order' => 6
            ],
            [
                'attribute_name' => 'max_head_m',
                'display_name' => 'ความสูงยกสูงสุด',
                'data_type' => 'number',
                'unit' => 'เมตร',
                'is_required' => false,
                'sort_order' => 7
            ],
            [
                'attribute_name' => 'max_flow_rate_lpm',
                'display_name' => 'อัตราการไหลสูงสุด',
                'data_type' => 'number',
                'unit' => 'LPM',
                'is_required' => false,
                'sort_order' => 8
            ],
            [
                'attribute_name' => 'suction_depth_m',
                'display_name' => 'ความลึกดูด',
                'data_type' => 'number',
                'unit' => 'เมตร',
                'is_required' => false,
                'sort_order' => 9
            ],
            [
                'attribute_name' => 'dimensions_cm',
                'display_name' => 'ขนาด',
                'data_type' => 'string',
                'unit' => 'ซม.',
                'is_required' => false,
                'sort_order' => 10
            ],
            [
                'attribute_name' => 'weight_kg',
                'display_name' => 'น้ำหนัก',
                'data_type' => 'number',
                'unit' => 'กก.',
                'is_required' => false,
                'sort_order' => 11
            ]
        ];

        foreach ($pumpAttrs as $attr) {
            EquipmentAttribute::firstOrCreate(
                [
                    'category_id' => $pumpCategory->id,
                    'attribute_name' => $attr['attribute_name']
                ],
                array_merge($attr, ['category_id' => $pumpCategory->id])
            );
        }
    }

    private function createPipeAttributes($pipeCategory)
    {
        $pipeAttrs = [
            [
                'attribute_name' => 'pipeType',
                'display_name' => 'ประเภทท่อ',
                'data_type' => 'string',
                'unit' => '',
                'is_required' => false,
                'sort_order' => 0
            ],
            [
                'attribute_name' => 'pn',
                'display_name' => 'ทนแรงดัน',
                'data_type' => 'number',
                'unit' => 'PN',
                'is_required' => false,
                'sort_order' => 1
            ],
            [
                'attribute_name' => 'sizeMM',
                'display_name' => 'ขนาด',
                'data_type' => 'number',
                'unit' => 'มม.',
                'is_required' => false,
                'sort_order' => 2
            ],
            [
                'attribute_name' => 'sizeInch',
                'display_name' => 'ขนาด',
                'data_type' => 'string',
                'unit' => 'นิ้ว',
                'is_required' => false,
                'sort_order' => 3
            ],
            [
                'attribute_name' => 'lengthM',
                'display_name' => 'ความยาวต่อหน่วย',
                'data_type' => 'number',
                'unit' => 'เมตร',
                'is_required' => false,
                'sort_order' => 4
            ]
        ];

        foreach ($pipeAttrs as $attr) {
            EquipmentAttribute::firstOrCreate(
                [
                    'category_id' => $pipeCategory->id,
                    'attribute_name' => $attr['attribute_name']
                ],
                array_merge($attr, ['category_id' => $pipeCategory->id])
            );
        }
    }

    private function createAgriculturalFittingsAttributes($agriculturalFittingsCategory)
    {
        $agriculturalFittingsAttrs = [
            [
                'attribute_name' => 'size_mm',
                'display_name' => 'ขนาด',
                'data_type' => 'number',
                'unit' => 'มม.',
                'is_required' => false,
                'sort_order' => 1
            ],
            [
                'attribute_name' => 'size_inch',
                'display_name' => 'ขนาด',
                'data_type' => 'string',
                'unit' => 'นิ้ว',
                'is_required' => false,
                'sort_order' => 2
            ],
            [
                'attribute_name' => 'main_pipe_inch',
                'display_name' => 'ท่อหลัก',
                'data_type' => 'string',
                'unit' => 'นิ้ว',
                'is_required' => false,
                'sort_order' => 3
            ],
            [
                'attribute_name' => 'branch_pipe_mm',
                'display_name' => 'ท่อแยก',
                'data_type' => 'number',
                'unit' => 'มม.',
                'is_required' => false,
                'sort_order' => 4
            ]
        ];

        foreach ($agriculturalFittingsAttrs as $attr) {
            EquipmentAttribute::firstOrCreate(
                [
                    'category_id' => $agriculturalFittingsCategory->id,
                    'attribute_name' => $attr['attribute_name']
                ],
                array_merge($attr, ['category_id' => $agriculturalFittingsCategory->id])
            );
        }
    }

    private function createPvcFittingsAttributes($pvcFittingsCategory)
    {
        $pvcFittingsAttrs = [
            [
                'attribute_name' => 'size_inch',
                'display_name' => 'ขนาด',
                'data_type' => 'string',
                'unit' => 'นิ้ว',
                'is_required' => false,
                'sort_order' => 1
            ],
            [
                'attribute_name' => 'size_mm',
                'display_name' => 'ขนาด',
                'data_type' => 'number',
                'unit' => 'มม.',
                'is_required' => false,
                'sort_order' => 2
            ],
            [
                'attribute_name' => 'main_pipe_inch',
                'display_name' => 'ท่อหลัก',
                'data_type' => 'string',
                'unit' => 'นิ้ว',
                'is_required' => false,
                'sort_order' => 3
            ],
            [
                'attribute_name' => 'branch_pipe_inch',
                'display_name' => 'ท่อแยก',
                'data_type' => 'string',
                'unit' => 'นิ้ว',
                'is_required' => false,
                'sort_order' => 4
            ],
            [
                'attribute_name' => 'branch_pipe_mm',
                'display_name' => 'ท่อแยก',
                'data_type' => 'number',
                'unit' => 'มม.',
                'is_required' => false,
                'sort_order' => 5
            ],
            [
                'attribute_name' => 'is_featured',
                'display_name' => 'สินค้าแนะนำ',
                'data_type' => 'boolean',
                'unit' => '',
                'is_required' => false,
                'sort_order' => 6
            ]
        ];

        foreach ($pvcFittingsAttrs as $attr) {
            EquipmentAttribute::firstOrCreate(
                [
                    'category_id' => $pvcFittingsCategory->id,
                    'attribute_name' => $attr['attribute_name']
                ],
                array_merge($attr, ['category_id' => $pvcFittingsCategory->id])
            );
        }
    }

    private function createSprinklerData($category)
    {
        $data = [
            // ข้อมูลเดิม 4 รายการ
            [
                'product_code' => 'SP-ROT-001',
                'name' => 'สปริงเกอร์แบบหมุน 360° ขนาด 1"',
                'brand' => 'Aqua-Tech',
                'image' => '',
                'price' => 280.00,
                'stock' => 50,
                'description' => 'สปริงเกอร์แบบหมุนรอบ 360 องศา เหมาะสำหรับพื้นที่ขนาดกลาง',
                'attributes' => [
                    'size_mm' => 25,
                    'size_inch' => 1,
                    'waterVolumeLitersPerMinute' => [3.33, 20],
                    'radiusMeters' => [8, 15],
                    'pressureBar' => [1.5, 4]
                ]
            ],
            [
                'product_code' => '1-ECO-100',
                'name' => 'มินิสปริงเกอร์ 1/2"',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 1.00,
                'stock' => 1000,
                'description' => 'มินิสปริงเกอร์ขนาดเล็ก เหมาะสำหรับแปลงผัก',
                'attributes' => [
                    'size_mm' => 20,
                    'size_inch' => 0.5,
                    'waterVolumeLitersPerMinute' => [1, 2],
                    'radiusMeters' => [0.5, 1.5],
                    'pressureBar' => [0.5, 2]
                ]
            ],
            [
                'product_code' => '300',
                'name' => 'สปริงเกอร์ ใบหมุน2ชั้น เกลียวใน 3/4x1/2"',
                'brand' => 'ไชโย',
                'image' => 'https://f.btwcdn.com/store-50036/product/8d4c61e4-6cde-b0bc-09ed-624fd55b4468.png',
                'price' => 9.00,
                'stock' => 200,
                'description' => 'สปริงเกอร์ใบหมุน 2 ชั้น กระจายน้ำสม่ำเสมอ',
                'attributes' => [
                    'size_mm' => 32,
                    'size_inch' => 1,
                    'waterVolumeLitersPerMinute' => [1.67, 15],
                    'radiusMeters' => [4, 5],
                    'pressureBar' => [0.5, 3]
                ]
            ],
            [
                'product_code' => '1-ECO-150',
                'name' => 'มินิสปริงเกอร์ 3/4"',
                'brand' => 'แชมป์',
                'image' => '',
                'price' => 2.00,
                'stock' => 500,
                'description' => 'มินิสปริงเกอร์ขนาดกลาง เหมาะสำหรับสวนผลไม้',
                'attributes' => [
                    'size_mm' => 25,
                    'size_inch' => 0.75,
                    'waterVolumeLitersPerMinute' => [2, 4],
                    'radiusMeters' => [0.5, 1.5],
                    'pressureBar' => [0.5, 2]
                ]
            ],
            // เพิ่มข้อมูลใหม่ 11 รายการ
            [
                'product_code' => 'SP-ROT-002',
                'name' => 'สปริงเกอร์แบบหมุน 180° ขนาด 2"',
                'brand' => 'Aqua-Tech',
                'image' => '',
                'price' => 450.00,
                'stock' => 30,
                'description' => 'สปริงเกอร์แบบหมุนครึ่งวง เหมาะสำหรับพื้นที่ขนาดใหญ่',
                'attributes' => [
                    'size_mm' => 50,
                    'size_inch' => 2,
                    'waterVolumeLitersPerMinute' => [10, 40],
                    'radiusMeters' => [15, 25],
                    'pressureBar' => [2, 6]
                ]
            ],
            [
                'product_code' => 'SP-IMP-001',
                'name' => 'สปริงเกอร์อิมแพ็ค 1.5"',
                'brand' => 'Rain-Bird',
                'image' => '',
                'price' => 380.00,
                'stock' => 25,
                'description' => 'สปริงเกอร์แบบอิมแพ็ค ทนทาน มอเตอร์หมุนแรง',
                'attributes' => [
                    'size_mm' => 40,
                    'size_inch' => 1.5,
                    'waterVolumeLitersPerMinute' => [8, 35],
                    'radiusMeters' => [12, 20],
                    'pressureBar' => [1.8, 5]
                ]
            ],
            [
                'product_code' => 'SP-MICRO-001',
                'name' => 'ไมโครสปริงเกอร์ 5mm',
                'brand' => 'Netafim',
                'image' => '',
                'price' => 12.00,
                'stock' => 800,
                'description' => 'ไมโครสปริงเกอร์ประหยัดน้ำ เหมาะสำหรับเรือนกระจก',
                'attributes' => [
                    'size_mm' => 5,
                    'size_inch' => 0.2,
                    'waterVolumeLitersPerMinute' => [0.5, 1.5],
                    'radiusMeters' => [0.3, 0.8],
                    'pressureBar' => [0.3, 1.5]
                ]
            ],
            [
                'product_code' => 'SP-GUN-001',
                'name' => 'สปริงเกอร์ปืนยิงไกล 3"',
                'brand' => 'Nelson',
                'image' => '',
                'price' => 1250.00,
                'stock' => 8,
                'description' => 'สปริงเกอร์แบบปืนยิงไกล สำหรับพื้นที่กว้างใหญ่',
                'attributes' => [
                    'size_mm' => 75,
                    'size_inch' => 3,
                    'waterVolumeLitersPerMinute' => [30, 80],
                    'radiusMeters' => [25, 45],
                    'pressureBar' => [3, 8]
                ]
            ],
            [
                'product_code' => 'SP-POP-001',
                'name' => 'สปริงเกอร์ป็อปอัพ 4"',
                'brand' => 'Hunter',
                'image' => '',
                'price' => 850.00,
                'stock' => 15,
                'description' => 'สปริงเกอร์แบบป็อปอัพ หดเก็บได้ เหมาะสำหรับสนามกอล์ฟ',
                'attributes' => [
                    'size_mm' => 100,
                    'size_inch' => 4,
                    'waterVolumeLitersPerMinute' => [20, 60],
                    'radiusMeters' => [18, 30],
                    'pressureBar' => [2.5, 6]
                ]
            ],
            [
                'product_code' => 'SP-GEAR-001',
                'name' => 'สปริงเกอร์เกียร์ดอฟ 6"',
                'brand' => 'Toro',
                'image' => '',
                'price' => 1800.00,
                'stock' => 5,
                'description' => 'สปริงเกอร์แบบเกียร์ดอฟ ทนทาน เหมาะสำหรับงานหนัก',
                'attributes' => [
                    'size_mm' => 150,
                    'size_inch' => 6,
                    'waterVolumeLitersPerMinute' => [50, 120],
                    'radiusMeters' => [30, 50],
                    'pressureBar' => [4, 10]
                ]
            ],
            [
                'product_code' => 'SP-MIST-001',
                'name' => 'สปริงเกอร์มิสเตอร์ 1/4"',
                'brand' => 'Fogco',
                'image' => '',
                'price' => 65.00,
                'stock' => 300,
                'description' => 'สปริงเกอร์แบบมิสต์ สำหรับระบบพ่นหมอก',
                'attributes' => [
                    'size_mm' => 6,
                    'size_inch' => 0.25,
                    'waterVolumeLitersPerMinute' => [0.2, 0.8],
                    'radiusMeters' => [0.2, 0.5],
                    'pressureBar' => [5, 15]
                ]
            ],
            [
                'product_code' => 'SP-BOOM-001',
                'name' => 'สปริงเกอร์บูม 8"',
                'brand' => 'Valley',
                'image' => '',
                'price' => 3200.00,
                'stock' => 3,
                'description' => 'สปริงเกอร์แบบบูม สำหรับระบบชลประทานขนาดใหญ่',
                'attributes' => [
                    'size_mm' => 200,
                    'size_inch' => 8,
                    'waterVolumeLitersPerMinute' => [100, 200],
                    'radiusMeters' => [40, 60],
                    'pressureBar' => [5, 12]
                ]
            ],
            [
                'product_code' => 'SP-DRIP-001',
                'name' => 'สปริงเกอร์ดริป 8mm',
                'brand' => 'Jain',
                'image' => '',
                'price' => 8.50,
                'stock' => 600,
                'description' => 'สปริงเกอร์แบบดริป ประหยัดน้ำสุดๆ',
                'attributes' => [
                    'size_mm' => 8,
                    'size_inch' => 0.3,
                    'waterVolumeLitersPerMinute' => [0.8, 2.5],
                    'radiusMeters' => [0.4, 1],
                    'pressureBar' => [0.5, 2]
                ]
            ],
            [
                'product_code' => 'SP-WOBBLER-001',
                'name' => 'สปริงเกอร์วอบเบลอร์ 1/2"',
                'brand' => 'Senninger',
                'image' => '',
                'price' => 35.00,
                'stock' => 400,
                'description' => 'สปริงเกอร์แบบสั่น กระจายน้ำสม่ำเสมอ',
                'attributes' => [
                    'size_mm' => 12,
                    'size_inch' => 0.5,
                    'waterVolumeLitersPerMinute' => [1.5, 5],
                    'radiusMeters' => [1, 3],
                    'pressureBar' => [0.8, 3]
                ]
            ],
            [
                'product_code' => 'SP-MULTI-001',
                'name' => 'สปริงเกอร์หลายหัว 2.5"',
                'brand' => 'Komet',
                'image' => '',
                'price' => 980.00,
                'stock' => 12,
                'description' => 'สปริงเกอร์หลายหัวฉีด ปรับทิศทางได้',
                'attributes' => [
                    'size_mm' => 65,
                    'size_inch' => 2.5,
                    'waterVolumeLitersPerMinute' => [25, 70],
                    'radiusMeters' => [20, 35],
                    'pressureBar' => [2.8, 7]
                ]
            ]
        ];

        foreach ($data as $item) {
            $this->createEquipmentWithAttributes($category, $item);
        }
    }

    private function createPumpData($category)
    {
        $pumpData = [
            // ข้อมูลเดิม 3 รายการ
            [
                'product_code' => '1-CPM130',
                'name' => 'ปั๊มน้ำ CPM130',
                'brand' => 'ไชโย',
                'image' => 'https://f.btwcdn.com/store-50036/product/42f86283-ba80-6f71-0a37-624e6dd42c83.png',
                'price' => 1820.00,
                'stock' => 15,
                'description' => 'ปั๊มน้ำหอยโข่ง 0.5 HP เหมาะสำหรับงานทั่วไป',
                'attributes' => [
                    'powerHP' => 0.5,
                    'powerKW' => 0.37,
                    'phase' => 1,
                    'inlet_size_inch' => 1,
                    'outlet_size_inch' => 1,
                    'flow_rate_lpm' => [20, 90],
                    'head_m' => [25, 15],
                    'max_head_m' => 25,
                    'max_flow_rate_lpm' => 90,
                    'suction_depth_m' => 9,
                    'dimensions_cm' => '18 x 30 x 22',
                    'weight_kg' => 12.5
                ]
            ],
            [
                'product_code' => '1-CPM075',
                'name' => 'ปั๊มน้ำ CPM075',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 1250.00,
                'stock' => 20,
                'description' => 'ปั๊มน้ำหอยโข่ง 0.25 HP ประหยัดไฟ',
                'attributes' => [
                    'powerHP' => 0.25,
                    'powerKW' => 0.18,
                    'phase' => 1,
                    'inlet_size_inch' => 0.75,
                    'outlet_size_inch' => 0.75,
                    'flow_rate_lpm' => [10, 45],
                    'head_m' => [18, 8],
                    'max_head_m' => 18,
                    'max_flow_rate_lpm' => 45,
                    'suction_depth_m' => 8,
                    'dimensions_cm' => '15 x 25 x 18',
                    'weight_kg' => 8.5
                ]
            ],
            [
                'product_code' => 'MIT-SSP-255S',
                'name' => 'ปั๊มจุ่ม Mitsubishi SSP-255S',
                'brand' => 'Mitsubishi',
                'image' => '',
                'price' => 2800.00,
                'stock' => 8,
                'description' => 'ปั๊มจุ่มคุณภาพสูง เหมาะสำหรับบ่อน้ำลึก',
                'attributes' => [
                    'powerHP' => 0.33,
                    'powerKW' => 0.255,
                    'phase' => 1,
                    'inlet_size_inch' => null,
                    'outlet_size_inch' => 1.25,
                    'flow_rate_lpm' => [20, 100],
                    'head_m' => [8, 2],
                    'max_head_m' => 9.5,
                    'max_flow_rate_lpm' => 110,
                    'suction_depth_m' => null,
                    'dimensions_cm' => '16 x 16 x 32',
                    'weight_kg' => 5.5
                ]
            ],
            // เพิ่มข้อมูลใหม่ 12 รายการ
            [
                'product_code' => '1-CPM200',
                'name' => 'ปั๊มน้ำ CPM200',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 2850.00,
                'stock' => 12,
                'description' => 'ปั๊มน้ำหอยโข่ง 1 HP แรงสูง ทนทาน',
                'attributes' => [
                    'powerHP' => 1,
                    'powerKW' => 0.75,
                    'phase' => 1,
                    'inlet_size_inch' => 1.25,
                    'outlet_size_inch' => 1,
                    'flow_rate_lpm' => [30, 120],
                    'head_m' => [35, 20],
                    'max_head_m' => 35,
                    'max_flow_rate_lpm' => 120,
                    'suction_depth_m' => 9,
                    'dimensions_cm' => '20 x 35 x 25',
                    'weight_kg' => 18.2
                ]
            ],
            [
                'product_code' => 'GRUNDFOS-JP5',
                'name' => 'ปั๊มเจ็ท Grundfos JP-5',
                'brand' => 'Grundfos',
                'image' => '',
                'price' => 4200.00,
                'stock' => 6,
                'description' => 'ปั๊มเจ็ทคุณภาพยุโรป ประสิทธิภาพสูง',
                'attributes' => [
                    'powerHP' => 0.75,
                    'powerKW' => 0.55,
                    'phase' => 1,
                    'inlet_size_inch' => 1,
                    'outlet_size_inch' => 1,
                    'flow_rate_lpm' => [25, 95],
                    'head_m' => [40, 25],
                    'max_head_m' => 42,
                    'max_flow_rate_lpm' => 100,
                    'suction_depth_m' => 25,
                    'dimensions_cm' => '22 x 40 x 28',
                    'weight_kg' => 15.8
                ]
            ],
            [
                'product_code' => 'PEDROLLO-PKM60',
                'name' => 'ปั๊มหอยโข่ง Pedrollo PKm60',
                'brand' => 'Pedrollo',
                'image' => '',
                'price' => 3150.00,
                'stock' => 10,
                'description' => 'ปั๊มหอยโข่งอิตาลี คุณภาพระดับมืออาชีพ',
                'attributes' => [
                    'powerHP' => 0.6,
                    'powerKW' => 0.45,
                    'phase' => 1,
                    'inlet_size_inch' => 1,
                    'outlet_size_inch' => 1,
                    'flow_rate_lpm' => [22, 85],
                    'head_m' => [30, 18],
                    'max_head_m' => 32,
                    'max_flow_rate_lpm' => 88,
                    'suction_depth_m' => 8,
                    'dimensions_cm' => '19 x 32 x 24',
                    'weight_kg' => 14.2
                ]
            ],
            [
                'product_code' => 'HITACHI-DT-P300GX',
                'name' => 'ปั๊มจุ่ม Hitachi DT-P300GX',
                'brand' => 'Hitachi',
                'image' => '',
                'price' => 5800.00,
                'stock' => 4,
                'description' => 'ปั๊มจุ่มญี่ปุ่น ระบบอัตโนมัติ มอเตอร์ทนทาน',
                'attributes' => [
                    'powerHP' => 0.4,
                    'powerKW' => 0.3,
                    'phase' => 1,
                    'inlet_size_inch' => null,
                    'outlet_size_inch' => 1,
                    'flow_rate_lpm' => [15, 80],
                    'head_m' => [12, 3],
                    'max_head_m' => 13,
                    'max_flow_rate_lpm' => 85,
                    'suction_depth_m' => null,
                    'dimensions_cm' => '14 x 14 x 28',
                    'weight_kg' => 4.8
                ]
            ],
            [
                'product_code' => 'STANLEY-SXUP1100XBE',
                'name' => 'ปั๊มน้ำบ้าน Stanley 1100W',
                'brand' => 'Stanley',
                'image' => '',
                'price' => 2650.00,
                'stock' => 18,
                'description' => 'ปั๊มน้ำบ้าน ระบบแรงดันคงที่ อัตโนมัติ',
                'attributes' => [
                    'powerHP' => 1.5,
                    'powerKW' => 1.1,
                    'phase' => 1,
                    'inlet_size_inch' => 1,
                    'outlet_size_inch' => 1,
                    'flow_rate_lpm' => [35, 150],
                    'head_m' => [45, 25],
                    'max_head_m' => 48,
                    'max_flow_rate_lpm' => 155,
                    'suction_depth_m' => 9,
                    'dimensions_cm' => '25 x 42 x 30',
                    'weight_kg' => 22.5
                ]
            ],
            [
                'product_code' => 'LEO-XKJ800I',
                'name' => 'ปั๊มเจ็ท Leo XKJ-800I',
                'brand' => 'Leo',
                'image' => '',
                'price' => 1950.00,
                'stock' => 14,
                'description' => 'ปั๊มเจ็ทไต้หวัน พร้อมเจ็ทฟิตติ้ง ราคาประหยัด',
                'attributes' => [
                    'powerHP' => 0.8,
                    'powerKW' => 0.6,
                    'phase' => 1,
                    'inlet_size_inch' => 1,
                    'outlet_size_inch' => 1,
                    'flow_rate_lpm' => [28, 105],
                    'head_m' => [38, 22],
                    'max_head_m' => 40,
                    'max_flow_rate_lpm' => 110,
                    'suction_depth_m' => 20,
                    'dimensions_cm' => '23 x 38 x 26',
                    'weight_kg' => 16.5
                ]
            ],
            [
                'product_code' => 'FRANKLIN-3HP-380V',
                'name' => 'ปั๊มจุ่ม Franklin 3HP 380V',
                'brand' => 'Franklin',
                'image' => '',
                'price' => 15800.00,
                'stock' => 2,
                'description' => 'ปั๊มจุ่มอเมริกัน 3 เฟส สำหรับงานหนัก บ่อลึก',
                'attributes' => [
                    'powerHP' => 3,
                    'powerKW' => 2.2,
                    'phase' => 3,
                    'inlet_size_inch' => null,
                    'outlet_size_inch' => 2,
                    'flow_rate_lpm' => [80, 300],
                    'head_m' => [60, 20],
                    'max_head_m' => 65,
                    'max_flow_rate_lpm' => 320,
                    'suction_depth_m' => null,
                    'dimensions_cm' => '18 x 18 x 65',
                    'weight_kg' => 28.5
                ]
            ],
            [
                'product_code' => 'MITSUBISHI-EP-315R',
                'name' => 'ปั๊มหอยโข่ง Mitsubishi EP-315R',
                'brand' => 'Mitsubishi',
                'image' => '',
                'price' => 8200.00,
                'stock' => 3,
                'description' => 'ปั๊มหอยโข่งญี่ปุ่น มอเตอร์ประสิทธิภาพสูง',
                'attributes' => [
                    'powerHP' => 2,
                    'powerKW' => 1.5,
                    'phase' => 1,
                    'inlet_size_inch' => 1.5,
                    'outlet_size_inch' => 1.25,
                    'flow_rate_lpm' => [50, 180],
                    'head_m' => [50, 30],
                    'max_head_m' => 55,
                    'max_flow_rate_lpm' => 190,
                    'suction_depth_m' => 9,
                    'dimensions_cm' => '28 x 45 x 32',
                    'weight_kg' => 32.8
                ]
            ],
            [
                'product_code' => 'DAVEY-XF191',
                'name' => 'ปั๊มอัตโนมัติ Davey XF191',
                'brand' => 'Davey',
                'image' => '',
                'price' => 6500.00,
                'stock' => 7,
                'description' => 'ปั๊มอัตโนมัติออสเตรเลีย ระบบ VSD ประหยัดไฟ',
                'attributes' => [
                    'powerHP' => 1.25,
                    'powerKW' => 0.9,
                    'phase' => 1,
                    'inlet_size_inch' => 1,
                    'outlet_size_inch' => 1,
                    'flow_rate_lpm' => [40, 140],
                    'head_m' => [42, 28],
                    'max_head_m' => 45,
                    'max_flow_rate_lpm' => 145,
                    'suction_depth_m' => 9,
                    'dimensions_cm' => '26 x 38 x 28',
                    'weight_kg' => 19.5
                ]
            ],
            [
                'product_code' => 'EBARA-JEM120',
                'name' => 'ปั๊มเจ็ท Ebara JEM120',
                'brand' => 'Ebara',
                'image' => '',
                'price' => 7200.00,
                'stock' => 5,
                'description' => 'ปั๊มเจ็ทญี่ปุ่น สแตนเลสทั้งตัว ป้องกันสนิม',
                'attributes' => [
                    'powerHP' => 1.2,
                    'powerKW' => 0.9,
                    'phase' => 1,
                    'inlet_size_inch' => 1.25,
                    'outlet_size_inch' => 1,
                    'flow_rate_lpm' => [42, 125],
                    'head_m' => [45, 28],
                    'max_head_m' => 48,
                    'max_flow_rate_lpm' => 130,
                    'suction_depth_m' => 30,
                    'dimensions_cm' => '24 x 40 x 28',
                    'weight_kg' => 21.2
                ]
            ],
            [
                'product_code' => 'HAYWARD-BOOSTER-1HP',
                'name' => 'ปั๊มเพิ่มแรงดัน Hayward 1HP',
                'brand' => 'Hayward',
                'image' => '',
                'price' => 4850.00,
                'stock' => 9,
                'description' => 'ปั๊มเพิ่มแรงดันสำหรับระบบ RO และ สระว่ายน้ำ',
                'attributes' => [
                    'powerHP' => 1,
                    'powerKW' => 0.75,
                    'phase' => 1,
                    'inlet_size_inch' => 1.5,
                    'outlet_size_inch' => 1.5,
                    'flow_rate_lpm' => [60, 200],
                    'head_m' => [25, 15],
                    'max_head_m' => 28,
                    'max_flow_rate_lpm' => 210,
                    'suction_depth_m' => 8,
                    'dimensions_cm' => '30 x 25 x 20',
                    'weight_kg' => 16.8
                ]
            ]
        ];

        foreach ($pumpData as $data) {
            $this->createEquipmentWithAttributes($category, $data);
        }
    }

    private function createPipeData($category)
    {
        $pipeData = [
            // ข้อมูลเดิม 3 รายการ
            [
                'product_code' => '398-20-5PE100(PN16)',
                'name' => 'ท่อ HDPE PE100 PN16 ขนาด 20mm',
                'brand' => 'ไชโย',
                'image' => 'https://f.btwcdn.com/store-50036/product/7f312be9-9371-ddbd-aaff-640bf17172a6.jpg',
                'price' => 850.00,
                'stock' => 5,
                'description' => 'ท่อ HDPE คุณภาพสูง ทนทาน ใช้กับระบบแรงดันสูง',
                'attributes' => [
                    'pipeType' => 'PE',
                    'pn' => 16,
                    'sizeMM' => 20,
                    'sizeInch' => null,
                    'lengthM' => 50
                ]
            ],
            [
                'product_code' => '398-25-1PE100(PN16)',
                'name' => 'ท่อ HDPE PE100 PN16 ขนาด 25mm',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 2500.00,
                'stock' => 3,
                'description' => 'ท่อ HDPE PE100 ขนาด 25mm ความยาว 100 เมตร',
                'attributes' => [
                    'pipeType' => 'PE',
                    'pn' => 16,
                    'sizeMM' => 25,
                    'sizeInch' => null,
                    'lengthM' => 100
                ]
            ],
            [
                'product_code' => 'PVC-SCG-1-8.5',
                'name' => 'ท่อ PVC สีฟ้า SCG 1" ชั้น 8.5',
                'brand' => 'SCG',
                'image' => '',
                'price' => 80.00,
                'stock' => 100,
                'description' => 'ท่อ PVC สีฟ้า SCG คุณภาพดี ความยาว 4 เมตร',
                'attributes' => [
                    'pipeType' => 'PVC',
                    'pn' => 8.5,
                    'sizeMM' => 25,
                    'sizeInch' => '1"',
                    'lengthM' => 4
                ]
            ],
            // เพิ่มข้อมูลใหม่ 12 รายการ
            [
                'product_code' => '398-32-1PE100(PN16)',
                'name' => 'ท่อ HDPE PE100 PN16 ขนาด 32mm',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 3200.00,
                'stock' => 4,
                'description' => 'ท่อ HDPE PE100 ขนาด 32mm ความยาว 100 เมตร ทนแรงดัน',
                'attributes' => [
                    'pipeType' => 'PE',
                    'pn' => 16,
                    'sizeMM' => 32,
                    'sizeInch' => null,
                    'lengthM' => 100
                ]
            ],
            [
                'product_code' => 'PVC-SCG-1.5-13.5',
                'name' => 'ท่อ PVC สีฟ้า SCG 1.5" ชั้น 13.5',
                'brand' => 'SCG',
                'image' => '',
                'price' => 150.00,
                'stock' => 60,
                'description' => 'ท่อ PVC สีฟ้า SCG 1.5 นิ้ว ทนแรงดันสูง',
                'attributes' => [
                    'pipeType' => 'PVC',
                    'pn' => 13.5,
                    'sizeMM' => 40,
                    'sizeInch' => '1.5"',
                    'lengthM' => 4
                ]
            ],
            [
                'product_code' => 'PPR-THAI-PIPE-20MM',
                'name' => 'ท่อ PPR ไทยไปป์ 20mm PN20',
                'brand' => 'Thai Pipe',
                'image' => '',
                'price' => 65.00,
                'stock' => 120,
                'description' => 'ท่อ PPR สีเขียว ทนความร้อน เหมาะสำหรับน้ำร้อน',
                'attributes' => [
                    'pipeType' => 'PVC',
                    'pn' => 20,
                    'sizeMM' => 20,
                    'sizeInch' => null,
                    'lengthM' => 4
                ]
            ],
            [
                'product_code' => 'PPR-THAI-PIPE-25MM',
                'name' => 'ท่อ PPR ไทยไปป์ 25mm PN20',
                'brand' => 'Thai Pipe',
                'image' => '',
                'price' => 95.00,
                'stock' => 80,
                'description' => 'ท่อ PPR สีเขียว 25mm ทนความร้อนสูง',
                'attributes' => [
                    'pipeType' => 'PVC',
                    'pn' => 20,
                    'sizeMM' => 25,
                    'sizeInch' => null,
                    'lengthM' => 4
                ]
            ],
            [
                'product_code' => 'LDPE-16MM-PN4',
                'name' => 'ท่อ LDPE 16mm PN4 สีดำ',
                'brand' => 'Netafim',
                'image' => '',
                'price' => 1200.00,
                'stock' => 8,
                'description' => 'ท่อ LDPE สำหรับระบบดริป ทนรังสี UV',
                'attributes' => [
                    'pipeType' => 'PE',
                    'pn' => 4,
                    'sizeMM' => 16,
                    'sizeInch' => null,
                    'lengthM' => 100
                ]
            ],
            [
                'product_code' => 'PVC-SCG-2-13.5',
                'name' => 'ท่อ PVC สีฟ้า SCG 2" ชั้น 13.5',
                'brand' => 'SCG',
                'image' => '',
                'price' => 220.00,
                'stock' => 45,
                'description' => 'ท่อ PVC สีฟ้า SCG 2 นิ้ว สำหรับระบบแรงดันสูง',
                'attributes' => [
                    'pipeType' => 'PVC',
                    'pn' => 13.5,
                    'sizeMM' => 50,
                    'sizeInch' => '2"',
                    'lengthM' => 4
                ]
            ],
            [
                'product_code' => '398-50-1PE100(PN16)',
                'name' => 'ท่อ HDPE PE100 PN16 ขนาด 50mm',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 6800.00,
                'stock' => 2,
                'description' => 'ท่อ HDPE PE100 ขนาด 50mm ระบบแรงดันสูง',
                'attributes' => [
                    'pipeType' => 'PE',
                    'pn' => 16,
                    'sizeMM' => 50,
                    'sizeInch' => null,
                    'lengthM' => 100
                ]
            ],
            [
                'product_code' => 'GALVANIZED-STEEL-1INCH',
                'name' => 'ท่อเหล็กชุบสังกะสี 1"',
                'brand' => 'Panasonic',
                'image' => '',
                'price' => 180.00,
                'stock' => 40,
                'description' => 'ท่อเหล็กชุบสังกะสี 1 นิ้ว ทนทาน ป้องกันสนิม',
                'attributes' => [
                    'pipeType' => 'PVC`',
                    'pn' => 16,
                    'sizeMM' => 25,
                    'sizeInch' => '1"',
                    'lengthM' => 6
                ]
            ],
            [
                'product_code' => 'PPR-THAI-PIPE-32MM',
                'name' => 'ท่อ PPR ไทยไปป์ 32mm PN20',
                'brand' => 'Thai Pipe',
                'image' => '',
                'price' => 145.00,
                'stock' => 55,
                'description' => 'ท่อ PPR สีเขียว 32mm ระบบน้ำร้อน-เย็น',
                'attributes' => [
                    'pipeType' => 'PVC',
                    'pn' => 20,
                    'sizeMM' => 32,
                    'sizeInch' => null,
                    'lengthM' => 4
                ]
            ],
            [
                'product_code' => 'COPPER-TUBE-22MM',
                'name' => 'ท่อทองแดง 22mm Type L',
                'brand' => 'KWG',
                'image' => '',
                'price' => 420.00,
                'stock' => 25,
                'description' => 'ท่อทองแดงคุณภาพสูง ทนกรดและด่าง',
                'attributes' => [
                    'pipeType' => 'PVC',
                    'pn' => 25,
                    'sizeMM' => 22,
                    'sizeInch' => null,
                    'lengthM' => 3
                ]
            ],
            [
                'product_code' => 'PEX-16MM-PN10',
                'name' => 'ท่อ PEX 16mm PN10 สีแดง',
                'brand' => 'Rehau',
                'image' => '',
                'price' => 85.00,
                'stock' => 150,
                'description' => 'ท่อ PEX สำหรับระบบน้ำร้อน ยืดหยุ่นสูง',
                'attributes' => [
                    'pipeType' => 'PE',
                    'pn' => 10,
                    'sizeMM' => 16,
                    'sizeInch' => null,
                    'lengthM' => 50
                ]
            ],
            [
                'product_code' => 'PVC-SCG-3-8.5',
                'name' => 'ท่อ PVC สีฟ้า SCG 3" ชั้น 8.5',
                'brand' => 'SCG',
                'image' => '',
                'price' => 380.00,
                'stock' => 20,
                'description' => 'ท่อ PVC สีฟ้า SCG 3 นิ้ว สำหรับระบบขนาดใหญ่',
                'attributes' => [
                    'pipeType' => 'PVC',
                    'pn' => 8.5,
                    'sizeMM' => 75,
                    'sizeInch' => '3"',
                    'lengthM' => 4
                ]
            ],
            [
                'product_code' => 'MULTILAYER-20MM-PN16',
                'name' => 'ท่อ Multilayer 20mm PN16',
                'brand' => 'Uponor',
                'image' => '',
                'price' => 125.00,
                'stock' => 90,
                'description' => 'ท่อหลายชั้น PEX-AL-PEX ทนทาน ไม่ขยายตัว',
                'attributes' => [
                    'pipeType' => 'PE',
                    'pn' => 16,
                    'sizeMM' => 20,
                    'sizeInch' => null,
                    'lengthM' => 50
                ]
            ]
        ];

        foreach ($pipeData as $data) {
            $this->createEquipmentWithAttributes($category, $data);
        }
    }

    private function createPumpEquipmentData($category)
    {
        $data = [
            [
                'product_code' => 'FV-001',
                'name' => 'Foot Valve 1"',
                'brand' => 'Standard',
                'image' => '',
                'price' => 150.00,
                'stock' => 50,
                'description' => 'วาล์วเท้าขนาด 1 นิ้ว วัสดุ PVC ป้องกันน้ำไหลกลับ'
            ],
            [
                'product_code' => 'CV-001',
                'name' => 'Check Valve 1"',
                'brand' => 'Standard',
                'image' => '',
                'price' => 200.00,
                'stock' => 40,
                'description' => 'วาล์วกันกลับขนาด 1 นิ้ว วัสดุทองเหลือง ทนทานสูง'
            ],
            [
                'product_code' => 'PG-001',
                'name' => 'Pressure Gauge 2"',
                'brand' => 'Standard',
                'image' => '',
                'price' => 100.00,
                'stock' => 30,
                'description' => 'เกจวัดแรงดัน 2 นิ้ว ช่วง 0-10 บาร์ มาตรฐานสากล'
            ],
            [
                'product_code' => 'PS-001',
                'name' => 'Pressure Switch',
                'brand' => 'Standard',
                'image' => '',
                'price' => 350.00,
                'stock' => 25,
                'description' => 'สวิตช์ควบคุมแรงดัน ปิด-เปิดอัตโนมัติ ปรับระดับแรงดันได้'
            ],
            [
                'product_code' => 'CM-001',
                'name' => 'Control Box',
                'brand' => 'Standard',
                'image' => '',
                'price' => 800.00,
                'stock' => 15,
                'description' => 'กล่องควบคุมปั๊มน้ำพร้อมรีเลย์ และระบบป้องกัน'
            ],
            [
                'product_code' => 'FT-001',
                'name' => 'Float Switch',
                'brand' => 'Standard',
                'image' => '',
                'price' => 250.00,
                'stock' => 35,
                'description' => 'สวิตช์ลูกลอย สำหรับควบคุมระดับน้ำอัตโนมัติ'
            ],
            [
                'product_code' => 'PR-001',
                'name' => 'Pressure Reducing Valve 1"',
                'brand' => 'Standard',
                'image' => '',
                'price' => 450.00,
                'stock' => 20,
                'description' => 'วาล์วลดแรงดัน 1 นิ้ว ปรับแรงดันเอาท์พุทได้'
            ],
            [
                'product_code' => 'ST-001',
                'name' => 'Suction Strainer 1"',
                'brand' => 'Standard',
                'image' => '',
                'price' => 120.00,
                'stock' => 45,
                'description' => 'ตะแกรงกรองขนาด 1 นิ้ว กรองสิ่งสกปรกในน้ำ'
            ],
            [
                'product_code' => 'CS-001',
                'name' => 'Cable Submersible 3x1.5',
                'brand' => 'Standard',
                'image' => '',
                'price' => 85.00,
                'stock' => 100,
                'description' => 'สายไฟปั๊มจุ่ม 3 เส้น 1.5 ตรมม. ทนน้ำ ยาว 1 เมตร'
            ],
            [
                'product_code' => 'JF-001',
                'name' => 'Jet Fitting 1"',
                'brand' => 'Standard',
                'image' => '',
                'price' => 180.00,
                'stock' => 30,
                'description' => 'อุปกรณ์เจ็ท 1 นิ้ว สำหรับปั๊มแบบเจ็ท เพิ่มประสิทธิภาพ'
            ],
            [
                'product_code' => 'TK-001',
                'name' => 'Tank Tee 1"',
                'brand' => 'Standard',
                'image' => '',
                'price' => 95.00,
                'stock' => 60,
                'description' => 'ข้อต่อแท้งค์ 1 นิ้ว สำหรับต่อถังเก็บน้ำ'
            ],
            [
                'product_code' => 'VB-001',
                'name' => 'Vibration Pad',
                'brand' => 'Standard',
                'image' => '',
                'price' => 75.00,
                'stock' => 40,
                'description' => 'แผ่นรองปั๊ม ลดการสั่นสะเทือน ยาง EPDM คุณภาพสูง'
            ],
            [
                'product_code' => 'TC-001',
                'name' => 'Thermal Cutout',
                'brand' => 'Standard',
                'image' => '',
                'price' => 320.00,
                'stock' => 25,
                'description' => 'อุปกรณ์ป้องกันความร้อนเกิน ตัดไฟอัตโนมัติเมื่อร้อนเกิน'
            ]
        ];

        foreach ($data as $item) {
            // สร้างโดยไม่มี attributes
            Equipment::firstOrCreate(
                ['product_code' => $item['product_code']],
                [
                    'category_id' => $category->id,
                    'name' => $item['name'],
                    'brand' => $item['brand'],
                    'image' => $item['image'],
                    'price' => $item['price'],
                    'stock' => $item['stock'],
                    'description' => $item['description'],
                    'is_active' => true
                ]
            );
        }
    }

    private function createAgriculturalFittingsData($category)
    {
        $data = [
            // ตารางที่ 1: ข้อต่อเกษตร (รหัส 358-xx)
            [
                'product_code' => '358-55',
                'name' => 'ข้อต่อเกษตร 358-55',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 37.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร ท่อหลัก 1" ท่อแยก 20 มม.',
                'attributes' => [
                    'main_pipe_inch' => '1"',
                    'branch_pipe_mm' => 20
                ]
            ],
            [
                'product_code' => '358-56',
                'name' => 'ข้อต่อเกษตร 358-56',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 45.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร ท่อหลัก 1" ท่อแยก 25 มม.',
                'attributes' => [
                    'main_pipe_inch' => '1"',
                    'branch_pipe_mm' => 25
                ]
            ],
            [
                'product_code' => '358-58',
                'name' => 'ข้อต่อเกษตร 358-58',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 55.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร ท่อหลัก 1 1/2" ท่อแยก 20 มม.',
                'attributes' => [
                    'main_pipe_inch' => '1 1/2"',
                    'branch_pipe_mm' => 20
                ]
            ],
            [
                'product_code' => '358-59',
                'name' => 'ข้อต่อเกษตร 358-59',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 60.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร ท่อหลัก 1 1/2" ท่อแยก 25 มม.',
                'attributes' => [
                    'main_pipe_inch' => '1 1/2"',
                    'branch_pipe_mm' => 25
                ]
            ],
            [
                'product_code' => '358-60',
                'name' => 'ข้อต่อเกษตร 358-60',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 75.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร ท่อหลัก 1 1/2" ท่อแยก 32 มม.',
                'attributes' => [
                    'main_pipe_inch' => '1 1/2"',
                    'branch_pipe_mm' => 32
                ]
            ],
            [
                'product_code' => '358-62',
                'name' => 'ข้อต่อเกษตร 358-62',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 65.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร ท่อหลัก 2" ท่อแยก 20 มม.',
                'attributes' => [
                    'main_pipe_inch' => '2"',
                    'branch_pipe_mm' => 20
                ]
            ],
            [
                'product_code' => '358-63',
                'name' => 'ข้อต่อเกษตร 358-63',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 70.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร ท่อหลัก 2" ท่อแยก 25 มม.',
                'attributes' => [
                    'main_pipe_inch' => '2"',
                    'branch_pipe_mm' => 25
                ]
            ],
            [
                'product_code' => '358-64',
                'name' => 'ข้อต่อเกษตร 358-64',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 85.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร ท่อหลัก 2" ท่อแยก 32 มม.',
                'attributes' => [
                    'main_pipe_inch' => '2"',
                    'branch_pipe_mm' => 32
                ]
            ],

            // ตารางที่ 2: ข้อต่อเกษตร (รหัส 356-xxRH)
            [
                'product_code' => '356-10RH',
                'name' => 'ข้อต่อเกษตร 356-10RH',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 86.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร ขนาด 20 มม.',
                'attributes' => [
                    'size_mm' => 20
                ]
            ],
            [
                'product_code' => '356-11RH',
                'name' => 'ข้อต่อเกษตร 356-11RH',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 110.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร ขนาด 25 มม.',
                'attributes' => [
                    'size_mm' => 25
                ]
            ],
            [
                'product_code' => '356-12RH',
                'name' => 'ข้อต่อเกษตร 356-12RH',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 130.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร ขนาด 32 มม.',
                'attributes' => [
                    'size_mm' => 32
                ]
            ],
            [
                'product_code' => '356-13RH',
                'name' => 'ข้อต่อเกษตร 356-13RH',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 255.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร ขนาด 40 มม.',
                'attributes' => [
                    'size_mm' => 40
                ]
            ],
            [
                'product_code' => '356-14RH',
                'name' => 'ข้อต่อเกษตร 356-14RH',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 405.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร ขนาด 50 มม.',
                'attributes' => [
                    'size_mm' => 50
                ]
            ],
            [
                'product_code' => '356-15RH',
                'name' => 'ข้อต่อเกษตร 356-15RH',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 640.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร ขนาด 63 มม.',
                'attributes' => [
                    'size_mm' => 63
                ]
            ],
            [
                'product_code' => '356-16RH',
                'name' => 'ข้อต่อเกษตร 356-16RH',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 825.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร ขนาด 75 มม.',
                'attributes' => [
                    'size_mm' => 75
                ]
            ],
            [
                'product_code' => '356-17RH',
                'name' => 'ข้อต่อเกษตร 356-17RH',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 1380.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร ขนาด 90 มม.',
                'attributes' => [
                    'size_mm' => 90
                ]
            ],
            [
                'product_code' => '356-18RH',
                'name' => 'ข้อต่อเกษตร 356-18RH',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 2130.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร ขนาด 110 มม.',
                'attributes' => [
                    'size_mm' => 110
                ]
            ],

            // ตารางที่ 3: ข้อต่อเกษตร (รหัส 356-6x)
            [
                'product_code' => '356-60',
                'name' => 'ข้อต่อเกษตร 356-60',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 45.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร 1/2" x 20 มม.',
                'attributes' => [
                    'size_inch' => '1/2"',
                    'size_mm' => 20
                ]
            ],
            [
                'product_code' => '356-61',
                'name' => 'ข้อต่อเกษตร 356-61',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 59.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร 3/4" x 25 มม.',
                'attributes' => [
                    'size_inch' => '3/4"',
                    'size_mm' => 25
                ]
            ],
            [
                'product_code' => '356-62',
                'name' => 'ข้อต่อเกษตร 356-62',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 86.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร 1" x 32 มม.',
                'attributes' => [
                    'size_inch' => '1"',
                    'size_mm' => 32
                ]
            ],
            [
                'product_code' => '356-63',
                'name' => 'ข้อต่อเกษตร 356-63',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 140.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร 1 1/4" x 40 มม.',
                'attributes' => [
                    'size_inch' => '1 1/4"',
                    'size_mm' => 40
                ]
            ],
            [
                'product_code' => '356-64',
                'name' => 'ข้อต่อเกษตร 356-64',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 177.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร 1 1/2" x 50 มม.',
                'attributes' => [
                    'size_inch' => '1 1/2"',
                    'size_mm' => 50
                ]
            ],
            [
                'product_code' => '356-65',
                'name' => 'ข้อต่อเกษตร 356-65',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 252.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร 2" x 63 มม.',
                'attributes' => [
                    'size_inch' => '2"',
                    'size_mm' => 63
                ]
            ],
            [
                'product_code' => '356-66',
                'name' => 'ข้อต่อเกษตร 356-66',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 578.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร 2 1/2" x 75 มม.',
                'attributes' => [
                    'size_inch' => '2 1/2"',
                    'size_mm' => 75
                ]
            ],
            [
                'product_code' => '356-67',
                'name' => 'ข้อต่อเกษตร 356-67',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 856.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร 3" x 90 มม.',
                'attributes' => [
                    'size_inch' => '3"',
                    'size_mm' => 90
                ]
            ],
            [
                'product_code' => '356-68',
                'name' => 'ข้อต่อเกษตร 356-68',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 1391.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร 4" x 110 มม.',
                'attributes' => [
                    'size_inch' => '4"',
                    'size_mm' => 110
                ]
            ],

            // ตารางที่ 4: ข้อต่อเกษตร (รหัส 356-xxRH)
            [
                'product_code' => '356-49RH',
                'name' => 'ข้อต่อเกษตร 356-49RH',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 110.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร ขนาด 1/2"',
                'attributes' => [
                    'size_inch' => '1/2"'
                ]
            ],
            [
                'product_code' => '356-50RH',
                'name' => 'ข้อต่อเกษตร 356-50RH',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 170.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร ขนาด 3/4"',
                'attributes' => [
                    'size_inch' => '3/4"'
                ]
            ],
            [
                'product_code' => '356-51RH',
                'name' => 'ข้อต่อเกษตร 356-51RH',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 235.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร ขนาด 1"',
                'attributes' => [
                    'size_inch' => '1"'
                ]
            ],
            [
                'product_code' => '356-52RH',
                'name' => 'ข้อต่อเกษตร 356-52RH',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 340.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร ขนาด 1 1/4"',
                'attributes' => [
                    'size_inch' => '1 1/4"'
                ]
            ],
            [
                'product_code' => '356-53RH',
                'name' => 'ข้อต่อเกษตร 356-53RH',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 450.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร ขนาด 1 1/2"',
                'attributes' => [
                    'size_inch' => '1 1/2"'
                ]
            ],
            [
                'product_code' => '356-54RH',
                'name' => 'ข้อต่อเกษตร 356-54RH',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 715.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร ขนาด 2"',
                'attributes' => [
                    'size_inch' => '2"'
                ]
            ],
            [
                'product_code' => '356-55RH',
                'name' => 'ข้อต่อเกษตร 356-55RH',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 865.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร ขนาด 2 1/2"',
                'attributes' => [
                    'size_inch' => '2 1/2"'
                ]
            ],
            [
                'product_code' => '356-56RH',
                'name' => 'ข้อต่อเกษตร 356-56RH',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 2245.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร ขนาด 3"',
                'attributes' => [
                    'size_inch' => '3"'
                ]
            ],
            [
                'product_code' => '356-57RH',
                'name' => 'ข้อต่อเกษตร 356-57RH',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 3400.00,
                'stock' => 100,
                'description' => 'ข้อต่อเกษตร ขนาด 4"',
                'attributes' => [
                    'size_inch' => '4"'
                ]
            ]
        ];

        foreach ($data as $item) {
            $this->createEquipmentWithAttributes($category, $item);
        }
    }

    private function createPvcFittingsData($category)
    {
        $data = [
            // ตารางที่ 1: ข้อต่อ PVC (รหัส 359-4x)
            [
                'product_code' => '359-40',
                'name' => 'ข้อต่อ PVC 359-40',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 50.00,
                'stock' => 100,
                'description' => 'ข้อต่อ PVC ท่อหลัก 1 1/2" ท่อแยก 1/2"',
                'attributes' => [
                    'main_pipe_inch' => '1 1/2"',
                    'branch_pipe_inch' => '1/2"'
                ]
            ],
            [
                'product_code' => '359-41',
                'name' => 'ข้อต่อ PVC 359-41',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 50.00,
                'stock' => 100,
                'description' => 'ข้อต่อ PVC ท่อหลัก 1 1/2" ท่อแยก 3/4"',
                'attributes' => [
                    'main_pipe_inch' => '1 1/2"',
                    'branch_pipe_inch' => '3/4"'
                ]
            ],
            [
                'product_code' => '359-42',
                'name' => 'ข้อต่อ PVC 359-42',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 50.00,
                'stock' => 100,
                'description' => 'ข้อต่อ PVC ท่อหลัก 1 1/2" ท่อแยก 1"',
                'attributes' => [
                    'main_pipe_inch' => '1 1/2"',
                    'branch_pipe_inch' => '1"'
                ]
            ],
            [
                'product_code' => '359-43',
                'name' => 'ข้อต่อ PVC 359-43',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 60.00,
                'stock' => 100,
                'description' => 'ข้อต่อ PVC ท่อหลัก 2" ท่อแยก 1/2"',
                'attributes' => [
                    'main_pipe_inch' => '2"',
                    'branch_pipe_inch' => '1/2"',
                    'is_featured' => true
                ]
            ],
            [
                'product_code' => '359-44',
                'name' => 'ข้อต่อ PVC 359-44',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 60.00,
                'stock' => 100,
                'description' => 'ข้อต่อ PVC ท่อหลัก 2" ท่อแยก 3/4"',
                'attributes' => [
                    'main_pipe_inch' => '2"',
                    'branch_pipe_inch' => '3/4"',
                    'is_featured' => true
                ]
            ],
            [
                'product_code' => '359-45',
                'name' => 'ข้อต่อ PVC 359-45',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 60.00,
                'stock' => 100,
                'description' => 'ข้อต่อ PVC ท่อหลัก 2" ท่อแยก 1"',
                'attributes' => [
                    'main_pipe_inch' => '2"',
                    'branch_pipe_inch' => '1"',
                    'is_featured' => true
                ]
            ],

            // ตารางที่ 2: ข้อต่อ PVC (รหัส 5000x-RH)
            [
                'product_code' => '50001-RH',
                'name' => 'ข้อต่อ PVC 50001-RH',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 25.00,
                'stock' => 100,
                'description' => 'ข้อต่อ PVC ขนาด 1/2"',
                'attributes' => [
                    'size_inch' => '1/2"',
                    'is_featured' => true
                ]
            ],
            [
                'product_code' => '50002-RH',
                'name' => 'ข้อต่อ PVC 50002-RH',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 35.00,
                'stock' => 100,
                'description' => 'ข้อต่อ PVC ขนาด 3/4"',
                'attributes' => [
                    'size_inch' => '3/4"'
                ]
            ],
            [
                'product_code' => '50003-RH',
                'name' => 'ข้อต่อ PVC 50003-RH',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 50.00,
                'stock' => 100,
                'description' => 'ข้อต่อ PVC ขนาด 1"',
                'attributes' => [
                    'size_inch' => '1"',
                    'is_featured' => true
                ]
            ],
            [
                'product_code' => '50004-RH',
                'name' => 'ข้อต่อ PVC 50004-RH',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 120.00,
                'stock' => 100,
                'description' => 'ข้อต่อ PVC ขนาด 1 1/2"',
                'attributes' => [
                    'size_inch' => '1 1/2"'
                ]
            ],
            [
                'product_code' => '50005-RH',
                'name' => 'ข้อต่อ PVC 50005-RH',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 150.00,
                'stock' => 100,
                'description' => 'ข้อต่อ PVC ขนาด 2"',
                'attributes' => [
                    'size_inch' => '2"',
                    'is_featured' => true
                ]
            ],
            [
                'product_code' => '50008-RH',
                'name' => 'ข้อต่อ PVC 50008-RH',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 350.00,
                'stock' => 100,
                'description' => 'ข้อต่อ PVC ขนาด 2 1/2"',
                'attributes' => [
                    'size_inch' => '2 1/2"'
                ]
            ],
            [
                'product_code' => '50006-RH',
                'name' => 'ข้อต่อ PVC 50006-RH',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 400.00,
                'stock' => 100,
                'description' => 'ข้อต่อ PVC ขนาด 3"',
                'attributes' => [
                    'size_inch' => '3"'
                ]
            ],
            [
                'product_code' => '50007-RH',
                'name' => 'ข้อต่อ PVC 50007-RH',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 750.00,
                'stock' => 100,
                'description' => 'ข้อต่อ PVC ขนาด 4"',
                'attributes' => [
                    'size_inch' => '4"'
                ]
            ],
            [
                'product_code' => '50010-RH',
                'name' => 'ข้อต่อ PVC 50010-RH',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 3500.00,
                'stock' => 100,
                'description' => 'ข้อต่อ PVC ขนาด 6"',
                'attributes' => [
                    'size_inch' => '6"'
                ]
            ],

            // ตารางที่ 3: ข้อต่อ PVC (รหัส 359-6x)
            [
                'product_code' => '359-60',
                'name' => 'ข้อต่อ PVC 359-60',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 40.00,
                'stock' => 100,
                'description' => 'ข้อต่อ PVC 1 1/2" x 16 มม.',
                'attributes' => [
                    'main_pipe_inch' => '1 1/2"',
                    'branch_pipe_mm' => 16
                ]
            ],
            [
                'product_code' => '359-61',
                'name' => 'ข้อต่อ PVC 359-61',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 40.00,
                'stock' => 100,
                'description' => 'ข้อต่อ PVC 1 1/2" x 20 มม.',
                'attributes' => [
                    'main_pipe_inch' => '1 1/2"',
                    'branch_pipe_mm' => 20,
                    'is_featured' => true
                ]
            ],
            [
                'product_code' => '359-62',
                'name' => 'ข้อต่อ PVC 359-62',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 40.00,
                'stock' => 100,
                'description' => 'ข้อต่อ PVC 1 1/2" x 25 มม.',
                'attributes' => [
                    'main_pipe_inch' => '1 1/2"',
                    'branch_pipe_mm' => 25
                ]
            ],
            [
                'product_code' => '359-63',
                'name' => 'ข้อต่อ PVC 359-63',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 45.00,
                'stock' => 100,
                'description' => 'ข้อต่อ PVC 2" x 16 มม.',
                'attributes' => [
                    'main_pipe_inch' => '2"',
                    'branch_pipe_mm' => 16
                ]
            ],
            [
                'product_code' => '359-64',
                'name' => 'ข้อต่อ PVC 359-64',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 45.00,
                'stock' => 100,
                'description' => 'ข้อต่อ PVC 2" x 20 มม.',
                'attributes' => [
                    'main_pipe_inch' => '2"',
                    'branch_pipe_mm' => 20,
                    'is_featured' => true
                ]
            ],
            [
                'product_code' => '359-65',
                'name' => 'ข้อต่อ PVC 359-65',
                'brand' => 'ไชโย',
                'image' => '',
                'price' => 45.00,
                'stock' => 100,
                'description' => 'ข้อต่อ PVC 2" x 25 มม.',
                'attributes' => [
                    'main_pipe_inch' => '2"',
                    'branch_pipe_mm' => 25,
                    'is_featured' => true
                ]
            ]
        ];

        foreach ($data as $item) {
            $this->createEquipmentWithAttributes($category, $item);
        }
    }

    private function createEquipmentWithAttributes($category, $data)
    {
        $equipment = Equipment::firstOrCreate(
            ['product_code' => $data['product_code']],
            [
                'category_id' => $category->id,
                'name' => $data['name'],
                'brand' => $data['brand'],
                'image' => $data['image'],
                'price' => $data['price'],
                'stock' => $data['stock'] ?? null,
                'description' => $data['description'] ?? null,
                'is_active' => true
            ]
        );

        // สร้าง attributes เฉพาะกรณีที่มีและไม่ใช่ pump_equipment
        if (isset($data['attributes']) && $category->name !== 'pump_equipment') {
            $this->createAttributeValues($equipment, $category, $data['attributes']);
        }
    }

    private function createAttributeValues($equipment, $category, $attributes)
    {
        foreach ($attributes as $attributeName => $value) {
            $attribute = EquipmentAttribute::where('category_id', $category->id)
                ->where('attribute_name', $attributeName)->first();
            
            if ($attribute && $value !== null) {
                EquipmentAttributeValue::firstOrCreate(
                    [
                        'equipment_id' => $equipment->id,
                        'attribute_id' => $attribute->id
                    ],
                    [
                        'value' => json_encode($value)
                    ]
                );
            }
        }
    }
}