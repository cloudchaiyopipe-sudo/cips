# Elevation Polygon Overlay - แสดงพื้นที่สีด้วย Polygon

## การเปลี่ยนแปลง

**จาก**: Canvas overlay ที่ไม่ทำงาน
**เป็น**: Google Maps Polygon overlay

## การทำงาน

### 1. Polygon-based Area Overlay

```typescript
// สร้าง grid 5x5 polygons
const gridSize = 5; // 5x5 grid
const latRange = 0.01; // ~1km range
const lngRange = 0.01; // ~1km range

for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
        // หาจุดข้อมูลความสูงที่ใกล้ที่สุด
        const closestPoint = findClosestElevationPoint(lat, lng);

        // สร้าง polygon
        const polygon = new google.maps.Polygon({
            paths: [...],
            fillColor: color,
            fillOpacity: 0.6,
            strokeColor: color,
            strokeOpacity: 0.8,
            strokeWeight: 1,
            map: map,
            zIndex: 1000
        });
    }
}
```

### 2. Color Mapping

```typescript
const getElevationColorForPolygon = (normalizedElevation: number): string => {
    if (normalizedElevation < 0.2) {
        return '#0000FF'; // Blue - ต่ำ (พื้นที่ราบ)
    } else if (normalizedElevation < 0.4) {
        return '#00FF00'; // Green - ปานกลาง
    } else if (normalizedElevation < 0.6) {
        return '#FFFF00'; // Yellow - สูงปานกลาง
    } else if (normalizedElevation < 0.8) {
        return '#FFA500'; // Orange - สูง
    } else {
        return '#FF0000'; // Red - สูงมาก (ภูเขา)
    }
};
```

### 3. Grid-based Interpolation

- สร้าง grid 5×5 polygons
- หาจุดข้อมูลความสูงที่ใกล้ที่สุด
- สร้างสีตามความสูง

## ข้อดี

- ✅ ใช้ Google Maps Polygon ที่เสถียร
- ✅ แสดงเป็นพื้นที่สีต่อเนื่อง
- ✅ เห็นความแตกต่างระหว่างพื้นที่ราบและภูเขา
- ✅ มี fillOpacity และ strokeOpacity
- ✅ zIndex 1000 เพื่อแสดงบนสุด

## สีแสดงความสูง

- 🔵 **น้ำเงิน**: ต่ำ (พื้นที่ราบ)
- 🟢 **เขียว**: ปานกลาง
- 🟡 **เหลือง**: สูงปานกลาง
- 🟠 **ส้ม**: สูง
- 🔴 **แดง**: สูงมาก (ภูเขา)

## การทดสอบ

1. เปิดเครื่องมือ elevation
2. เลือก "แสดงความสูงต่ำด้วยสี"
3. คลิกปุ่ม "โหลดข้อมูลความสูง"
4. ตรวจสอบว่ามีพื้นที่สีปรากฏบนแผนที่
5. ดูความแตกต่างระหว่างพื้นที่ราบและภูเขา

## ผลลัพธ์ที่คาดหวัง

- พื้นที่สีต่อเนื่อง 5×5 = 25 polygons
- สีน้ำเงินสำหรับพื้นที่ราบ
- สีแดงสำหรับภูเขา
- การไล่สีที่สวยงาม
- แสดงบนแผนที่อย่างชัดเจน
