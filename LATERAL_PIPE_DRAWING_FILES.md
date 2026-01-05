# ไฟล์ที่เกี่ยวข้องกับการสร้างท่อย่อยทั้ง 3 แบบ

## 📋 สรุปภาพรวม

### 1. วางท่อย่อย (Manual) - `handleStartLateralPipeDrawing()`
### 2. Auto ท่อย่อย (Auto) - `handleStartAutoLateralPipeDrawing()`
### 3. วาดท่อย่อยอิสระ (Freehand) - `isFreehandLateralPipeMode`

---

## 1️⃣ วางท่อย่อย (Manual) - `handleStartLateralPipeDrawing()`

### ไฟล์หลัก:
- **`HorticulturePlannerPage.tsx`** - ไฟล์หลักที่จัดการการทำงานทั้งหมด
  - `handleStartLateralPipeDrawing()` (line 12782) - เริ่มต้นโหมดวาดท่อย่อย
  - `handleLateralPipeClick()` (line 13127) - จัดการการคลิกบนแผนที่
  - `handleLateralPipeMouseMove()` (line 12895) - จัดการการเคลื่อนไหวเมาส์
  - `updateLateralPipeState()` (line 13025) - อัปเดตสถานะการวาด
  - `handleFinishLateralPipeDrawing()` (line 13414) - เสร็จสิ้นการวาดท่อ
  - `handleLateralPipeModeSelect()` (line 12815) - เลือกโหมดการวาง (over_plants/between_plants)
  - `handleChangePlacementMode()` (line 12844) - เปลี่ยนโหมดการวาง
  - `handleCancelLateralPipeDrawing()` (line 12864) - ยกเลิกการวาด

### ไฟล์ Component:
- **`LateralPipeModeSelector.tsx`** - Component สำหรับเลือกโหมดการวางท่อ (over_plants/between_plants)
- **`LateralPipeInfoPanel.tsx`** - แสดงข้อมูลท่อย่อย
- **`ContinuousLateralPipePanel.tsx`** - Panel สำหรับโหมดต่อเนื่อง

### ไฟล์ Utility:
- **`lateralPipeUtils.ts`** - ฟังก์ชัน utility หลัก:
  - `findPlantsInLateralPath()` - หาต้นไม้ในเส้นทางท่อ
  - `computeAlignedLateralFromMainPipe()` - คำนวณตำแหน่งท่อให้ตรงกับต้นไม้
  - `computeMultiSegmentAlignment()` - คำนวณท่อหลาย segment
  - `findLateralSubMainIntersection()` - หาจุดตัดกับท่อ Sub Main
  - `isPointOnSubMainPipe()` - ตรวจสอบว่าจุดอยู่บนท่อ Sub Main หรือไม่
  - `findClosestConnectionPoint()` - หาจุดเชื่อมต่อที่ใกล้ที่สุด
  - `findLineIntersection()` - หาจุดตัดของเส้นสองเส้น
  - `calculatePipeLength()` - คำนวณความยาวท่อ
  - `generateEmitterLines()` - สร้างเส้น emitter
  - `generateEmitterLinesForBetweenPlantsMode()` - สร้าง emitter สำหรับโหมด between_plants
  - `generateEmitterLinesForMultiSegment()` - สร้าง emitter สำหรับท่อหลาย segment

- **`connectionPointUtils.ts`** - จัดการจุดเชื่อมต่อ:
  - ใช้ฟังก์ชันจาก `lateralPipeUtils.ts`

- **`horticultureUtils.ts`** - ฟังก์ชัน utility ทั่วไป:
  - `calculateDistanceBetweenPoints()` - คำนวณระยะทางระหว่างจุด
  - `calculateDistance()` - คำนวณระยะทาง

- **`markerUtils.ts`** - จัดการ marker บนแผนที่

### ไฟล์ Map Component:
- **`HorticultureMapComponent.tsx`** - Component แผนที่หลัก
  - แสดงท่อย่อยบนแผนที่
  - จัดการการคลิกและการเคลื่อนไหวเมาส์

### Flow การทำงาน:
1. ผู้ใช้คลิกปุ่ม "วางท่อย่อย" → `handleStartLateralPipeDrawing()`
2. เปิด Modal เลือกโหมด → `LateralPipeModeSelector`
3. ผู้ใช้คลิกบนท่อ Sub Main → `handleLateralPipeClick()`
4. หาจุดเชื่อมต่อ → `findClosestConnectionPoint()`
5. ผู้ใช้เคลื่อนเมาส์ → `handleLateralPipeMouseMove()` → `updateLateralPipeState()`
6. หาต้นไม้ในเส้นทาง → `findPlantsInLateralPath()`
7. คำนวณตำแหน่งท่อ → `computeAlignedLateralFromMainPipe()`
8. ผู้ใช้คลิกจุดสิ้นสุด → `handleFinishLateralPipeDrawing()`
9. หาจุดตัดกับ Sub Main → `findLateralSubMainIntersection()`
10. สร้างท่อและ emitter → `generateEmitterLines()`
11. บันทึกท่อลง state

---

## 2️⃣ Auto ท่อย่อย (Auto) - `handleStartAutoLateralPipeDrawing()`

### ไฟล์หลัก:
- **`HorticulturePlannerPage.tsx`** - ไฟล์หลักที่จัดการการทำงานทั้งหมด
  - `handleStartAutoLateralPipeDrawing()` (line 12116) - เริ่มต้นโหมด Auto
  - `handleAutoLateralPipeModeSelect()` (line 12135) - เลือกโหมด Auto (through_submain/from_submain)
  - `handleCancelAutoLateralPipe()` (line 12778) - ยกเลิก

### ไฟล์ Component:
- **`AutoLateralPipeModal.tsx`** - Modal สำหรับเลือกโหมด Auto และเลือกโซน
  - แสดงตัวเลือกโหมด: `through_submain` หรือ `from_submain`
  - แสดงตัวเลือกโซน: ทุกโซน หรือเลือกโซนเฉพาะ

### ไฟล์ Utility:
- **`autoLateralPipeUtils.ts`** - ไฟล์หลักสำหรับสร้างท่อ Auto:
  - `generateAutoLateralPipes()` (line 1850) - ฟังก์ชันหลักที่สร้างท่อ Auto
  - `generateThroughSubMainPipes()` (line 265) - สร้างท่อแบบผ่าน Sub Main
  - `generateFromSubMainPipes()` (line 1230) - สร้างท่อแบบเริ่มจาก Sub Main
  - `generateSimpleLateralPipes()` (line 1006) - สร้างท่อแบบง่าย (fallback)
  - `createPerpendicularLateralPipe()` (line 827) - สร้างท่อตั้งฉาก
  - `validateAutoLateralPipes()` (line 1942) - ตรวจสอบความถูกต้องของท่อ
  - `groupPlantsPerpendicularToSubMain()` - จัดกลุ่มต้นไม้ตั้งฉากกับ Sub Main
  - `calculateSubMainDirection()` - คำนวณทิศทางของ Sub Main

- **`lateralPipeUtils.ts`** - ใช้ฟังก์ชัน:
  - `findLateralSubMainIntersection()` - หาจุดตัด
  - `findClosestConnectionPoint()` - หาจุดเชื่อมต่อ
  - `projectPointOntoPolyline()` - Project จุดลงบนเส้น

- **`autoZoneUtils.ts`** - จัดการโซนอัตโนมัติ:
  - อาจใช้ในการตรวจสอบโซน

- **`autoZoneUtilsExtensions.ts`** - Extension สำหรับ auto zone

- **`zoneEditUtils.ts`** - จัดการการแก้ไขโซน

- **`horticultureUtils.ts`** - ฟังก์ชัน utility ทั่วไป:
  - `calculateDistanceBetweenPoints()` - คำนวณระยะทาง
  - `isPointInPolygon()` - ตรวจสอบว่าจุดอยู่ใน polygon หรือไม่

### Flow การทำงาน:
1. ผู้ใช้คลิกปุ่ม "Auto ท่อย่อย" → `handleStartAutoLateralPipeDrawing()`
2. เปิด Modal → `AutoLateralPipeModal`
3. ผู้ใช้เลือกโหมดและโซน → `handleAutoLateralPipeModeSelect()`
4. เรียก `generateAutoLateralPipes()` จาก `autoLateralPipeUtils.ts`
5. ตามโหมดที่เลือก:
   - `through_submain` → `generateThroughSubMainPipes()`
   - `from_submain` → `generateFromSubMainPipes()`
6. สำหรับแต่ละโซน:
   - จัดกลุ่มต้นไม้ → `groupPlantsPerpendicularToSubMain()`
   - สร้างท่อตั้งฉาก → `createPerpendicularLateralPipe()`
   - หาจุดเชื่อมต่อกับ Sub Main → `findLateralSubMainIntersection()`
7. ตรวจสอบความถูกต้อง → `validateAutoLateralPipes()`
8. แปลงผลลัพธ์เป็น `LateralPipe` format
9. บันทึกท่อทั้งหมดลง state

---

## 3️⃣ วาดท่อย่อยอิสระ (Freehand) - `isFreehandLateralPipeMode`

### ไฟล์หลัก:
- **`HorticulturePlannerPage.tsx`** - ไฟล์หลักที่จัดการการทำงานทั้งหมด
  - `isFreehandLateralPipeMode` state (line 5779) - สถานะโหมด Freehand
  - `handleFreehandLateralPipeComplete()` (line 8900) - จัดการเมื่อวาดเสร็จ
  - `handleDrawingComplete()` (line 9227) - จัดการการวาดเสร็จ (ใช้ร่วมกับ freehand)
  - Button handler (line 15909) - จัดการการคลิกปุ่ม Freehand

### ไฟล์ Component:
- **`FreehandPipeDrawingManager.tsx`** - Component หลักสำหรับวาด Freehand:
  - จัดการ mouse events (mousedown, mousemove, mouseup)
  - สร้าง polyline ชั่วคราวขณะวาด
  - Smooth path ด้วย Catmull-Rom spline
  - Snap ไปยัง pump (สำหรับ mainPipe)
  - เรียก `onCreated()` เมื่อวาดเสร็จ
  - รองรับ `mainPipe`, `subMainPipe`, และ `lateralPipe`

- **`DrawingDistanceOverlay.tsx`** - แสดงระยะทางขณะวาด (อาจใช้)

### ไฟล์ Utility:
- **`lateralPipeUtils.ts`** - ใช้ฟังก์ชัน:
  - `findPlantsInLateralPath()` - หาต้นไม้ในเส้นทาง (ใช้ใน `handleFreehandLateralPipeComplete()`)
  - `findLateralSubMainIntersection()` - หาจุดตัดกับ Sub Main
  - `isPointOnSubMainPipe()` - ตรวจสอบว่าจุดอยู่บน Sub Main หรือไม่
  - `findClosestConnectionPoint()` - หาจุดเชื่อมต่อ

- **`horticultureUtils.ts`** - ฟังก์ชัน utility:
  - `calculateDistanceBetweenPoints()` - คำนวณระยะทางระหว่างจุด
  - `distanceFromPointToLineSegment()` - คำนวณระยะทางจากจุดไปยังเส้น

- **`markerUtils.ts`** - จัดการ marker

### Flow การทำงาน:
1. ผู้ใช้คลิกปุ่ม "วาดท่อย่อยอิสระ" → ตั้ง `isFreehandLateralPipeMode = true`
2. เปิด `FreehandPipeDrawingManager` ด้วย `editMode = 'lateralPipe'`
3. ผู้ใช้คลิกซ้ายค้างและลาก → `FreehandPipeDrawingManager` จัดการ:
   - `handleMouseDown()` - เริ่มวาด
   - `handleMouseMove()` - อัปเดตเส้นขณะลาก
   - `handleMouseUp()` - เสร็จสิ้นการวาด
4. Smooth path → `smoothPath()` ด้วย Catmull-Rom spline
5. เรียก `onCreated()` → `handleDrawingComplete()` → `handleFreehandLateralPipeComplete()`
6. หาต้นไม้ในเส้นทาง:
   - สำหรับแต่ละ segment → `findPlantsInLateralPath()`
   - ตรวจสอบต้นไม้ที่ใกล้เส้น (within 20 meters)
7. หาจุดตัดกับ Sub Main → `findLateralSubMainIntersection()`
8. สร้างท่อ `LateralPipe`:
   - ใช้ `placementMode = 'over_plants'` (default)
   - คำนวณ `totalWaterNeed` และ `plantCount`
   - สร้าง `emitterLines` ถ้าเปิด auto-generate
9. บันทึกท่อลง state

---

## 📁 ไฟล์ที่ใช้ร่วมกันทั้ง 3 แบบ

### Core Files:
- **`HorticulturePlannerPage.tsx`** - ไฟล์หลักที่จัดการทุกอย่าง
- **`HorticultureMapComponent.tsx`** - Component แผนที่
- **`HorticultureResultsPage.tsx`** - หน้าแสดงผลลัพธ์ (อาจใช้)

### Utility Files:
- **`lateralPipeUtils.ts`** - ใช้ทั้ง 3 แบบ
- **`horticultureUtils.ts`** - ใช้ทั้ง 3 แบบ
- **`markerUtils.ts`** - ใช้ทั้ง 3 แบบ
- **`connectionPointUtils.ts`** - ใช้ทั้ง 3 แบบ
- **`horticultureProjectStats.ts`** - คำนวณสถิติ (อาจใช้)

### Type Definitions:
- `LateralPipe` interface
- `Coordinate` interface
- `PlantLocation` interface
- `SubMainPipe` interface
- `IrrigationZone` interface

---

## 🔄 ความแตกต่างระหว่าง 3 แบบ

| คุณสมบัติ | Manual | Auto | Freehand |
|---------|--------|------|----------|
| **การควบคุม** | คลิกจุดเริ่ม-สิ้นสุด | อัตโนมัติทั้งหมด | ลากด้วยเมาส์ |
| **การจัดตำแหน่ง** | จัดตำแหน่งอัตโนมัติตามต้นไม้ | จัดตำแหน่งอัตโนมัติ | ตามที่วาด |
| **จำนวนท่อ** | 1 ท่อต่อครั้ง | หลายท่อพร้อมกัน | 1 ท่อต่อครั้ง |
| **การหาต้นไม้** | `findPlantsInLateralPath()` | `groupPlantsPerpendicularToSubMain()` | `findPlantsInLateralPath()` + distance check |
| **การสร้าง Emitter** | ตาม `placementMode` | ตาม `placementMode` | Default `over_plants` |
| **ไฟล์หลัก** | `HorticulturePlannerPage.tsx` | `autoLateralPipeUtils.ts` | `FreehandPipeDrawingManager.tsx` |

---

## 📝 สรุป

### ไฟล์ที่เกี่ยวข้องมากที่สุด:
1. **`HorticulturePlannerPage.tsx`** - จัดการทุกอย่าง
2. **`lateralPipeUtils.ts`** - Utility หลักสำหรับท่อย่อย
3. **`autoLateralPipeUtils.ts`** - สำหรับ Auto mode เท่านั้น
4. **`FreehandPipeDrawingManager.tsx`** - สำหรับ Freehand mode เท่านั้น

### ไฟล์ Component:
- `LateralPipeModeSelector.tsx` - Manual mode
- `AutoLateralPipeModal.tsx` - Auto mode
- `FreehandPipeDrawingManager.tsx` - Freehand mode
- `LateralPipeInfoPanel.tsx` - แสดงข้อมูล
- `ContinuousLateralPipePanel.tsx` - โหมดต่อเนื่อง

### ไฟล์ Utility:
- `lateralPipeUtils.ts` - ใช้ทั้ง 3 แบบ
- `autoLateralPipeUtils.ts` - Auto เท่านั้น
- `horticultureUtils.ts` - ใช้ทั้ง 3 แบบ
- `connectionPointUtils.ts` - ใช้ทั้ง 3 แบบ
- `markerUtils.ts` - ใช้ทั้ง 3 แบบ
- `zoneEditUtils.ts` - อาจใช้
- `autoZoneUtils.ts` - อาจใช้

