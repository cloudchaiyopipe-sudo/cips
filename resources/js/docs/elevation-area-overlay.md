# Elevation Area Overlay - แสดงพื้นที่สี

## การเปลี่ยนแปลง

**จาก**: จุดสีแยกกัน (discrete markers)
**เป็น**: พื้นที่สีต่อเนื่อง (continuous area overlay)

## การทำงาน

### 1. Canvas-based Area Overlay
```typescript
class ElevationAreaOverlay extends google.maps.OverlayView {
    private drawElevationAreas() {
        // สร้าง grid 20x20 pixels
        const gridSize = 20;
        
        // วาดพื้นที่สีตามความสูง
        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                const elevation = elevationGrid[y][x];
                const color = this.getElevationColor(normalizedElevation);
                ctx.fillStyle = color;
                ctx.fillRect(x * gridSize, y * gridSize, gridSize, gridSize);
            }
        }
    }
}
```

### 2. Color Mapping
```typescript
private getElevationColor(normalizedElevation: number): string {
    if (normalizedElevation < 0.2) {
        return 'rgba(0, 0, 255, 0.4)'; // Blue - ต่ำ (พื้นที่ราบ)
    } else if (normalizedElevation < 0.4) {
        return 'rgba(0, 255, 0, 0.4)'; // Green - ปานกลาง
    } else if (normalizedElevation < 0.6) {
        return 'rgba(255, 255, 0, 0.4)'; // Yellow - สูงปานกลาง
    } else if (normalizedElevation < 0.8) {
        return 'rgba(255, 165, 0, 0.4)'; // Orange - สูง
    } else {
        return 'rgba(255, 0, 0, 0.4)'; // Red - สูงมาก (ภูเขา)
    }
}
```

### 3. Grid-based Interpolation
- สร้าง grid 20x20 pixels
- หาจุดข้อมูลความสูงที่ใกล้ที่สุด
- สร้างสีต่อเนื่องตามความสูง

## สีแสดงความสูง

- 🔵 **น้ำเงิน**: ต่ำ (พื้นที่ราบ)
- 🟢 **เขียว**: ปานกลาง
- 🟡 **เหลือง**: สูงปานกลาง
- 🟠 **ส้ม**: สูง
- 🔴 **แดง**: สูงมาก (ภูเขา)

## ข้อดี

- ✅ แสดงเป็นพื้นที่สีต่อเนื่อง
- ✅ เห็นความแตกต่างระหว่างพื้นที่ราบและภูเขา
- ✅ ใช้ Canvas สำหรับประสิทธิภาพดี
- ✅ มี opacity 0.6 เพื่อไม่บังแผนที่
- ✅ แสดง legend ที่ชัดเจน

## การทดสอบ

1. เปิดเครื่องมือ elevation
2. เลือก "แสดงความสูงต่ำด้วยสี"
3. คลิกปุ่ม "โหลดข้อมูลความสูง"
4. ตรวจสอบว่ามีพื้นที่สีปรากฏบนแผนที่
5. ดูความแตกต่างระหว่างพื้นที่ราบและภูเขา

## ผลลัพธ์ที่คาดหวัง

- พื้นที่สีต่อเนื่องแทนจุดแยกกัน
- สีน้ำเงินสำหรับพื้นที่ราบ
- สีแดงสำหรับภูเขา
- การไล่สีที่สวยงาม
