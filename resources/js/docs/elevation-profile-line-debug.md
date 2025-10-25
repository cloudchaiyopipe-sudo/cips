# Elevation Profile Line Debug - การแก้ไขปัญหาเส้นตรง

## ปัญหาที่พบ: เส้นตรงไม่แสดงบนแผนที่

### 🚨 **ปัญหาที่พบ:**

#### **1. Console Logs แสดงว่าเส้นถูกสร้างแล้ว**
```
Created permanent line between start and end points
```

#### **2. แต่ไม่เห็นเส้นบนแผนที่**
- เส้นไม่ปรากฏบน Google Maps
- ไม่มี visual feedback

### 🔧 **การแก้ไขที่ทำ:**

#### **1. เพิ่มการตรวจสอบ Map**
```typescript
const createLineBetweenPoints = (start: google.maps.LatLng, end: google.maps.LatLng) => {
    if (!map) {
        console.error('Map is null, cannot create line');
        return;
    }
    // ... rest of the code
};
```

#### **2. เพิ่มการ Debug Logs**
```typescript
console.log('Creating line between points:', start.lat(), start.lng(), 'to', end.lat(), end.lng());
console.log('Polyline created:', polylineRef.current);
console.log('Polyline map:', polylineRef.current.getMap());
```

#### **3. เพิ่มการตรวจสอบ Polyline**
```typescript
// Remove existing line if any
if (polylineRef.current) {
    polylineRef.current.setMap(null);
    polylineRef.current = null;
}
```

#### **4. เพิ่ม Delay ในการสร้างโปรไฟล์**
```typescript
// Create elevation profile after a short delay to ensure line is visible
setTimeout(() => {
    createElevationProfile(startPointRef.current, event.latLng);
}, 100);
```

### 🔍 **การตรวจสอบเพิ่มเติม:**

#### **1. ตรวจสอบ Map Instance**
- ตรวจสอบว่า `map` ไม่เป็น null
- ตรวจสอบว่า `map` พร้อมใช้งาน

#### **2. ตรวจสอบ Polyline Creation**
- ตรวจสอบว่า `polylineRef.current` ถูกสร้าง
- ตรวจสอบว่า `polylineRef.current.getMap()` ไม่เป็น null

#### **3. ตรวจสอบ Timing**
- ตรวจสอบว่าเส้นถูกสร้างก่อนโปรไฟล์
- ตรวจสอบว่าเส้นไม่ถูกลบโดย cleanup

### 📊 **การทดสอบ:**

#### **1. ขั้นตอนการทดสอบ**
1. **เปิดเครื่องมือ**: คลิกปุ่ม 🏔️
2. **เลือกโปรไฟล์**: คลิก "โปรไฟล์ความสูง"
3. **เริ่มวาด**: คลิก "เริ่มวาดเส้นทาง"
4. **คลิกจุดเริ่ม**: คลิกบนแผนที่
5. **คลิกจุดจบ**: คลิกบนแผนที่อีกครั้ง
6. **ตรวจสอบ Console**: ดู logs
7. **ตรวจสอบแผนที่**: ควรเห็นเส้นส้ม

#### **2. Console Logs ที่คาดหวัง**
```
Creating line between points: 12.611016144820248 102.04692356107662 to 12.609535300651864 102.04773539609693
Created permanent line between start and end points
Polyline created: [Polyline object]
Polyline map: [Map object]
```

#### **3. ผลลัพธ์ที่คาดหวัง**
- ✅ **Marker สีเขียว**: จุดเริ่มต้น
- ✅ **Marker สีแดง**: จุดสิ้นสุด
- ✅ **เส้นส้ม**: ระหว่าง 2 จุด
- ✅ **กราฟโปรไฟล์**: แสดงความสูง

### 🎯 **การแก้ไขเพิ่มเติม:**

#### **1. หากยังไม่เห็นเส้น**
- ตรวจสอบว่า `map` พร้อมใช้งาน
- ตรวจสอบว่า `polylineRef.current` ไม่เป็น null
- ตรวจสอบว่า `polylineRef.current.getMap()` ไม่เป็น null

#### **2. หากเส้นหายไป**
- ตรวจสอบว่า `cleanup()` ไม่ถูกเรียก
- ตรวจสอบว่า `setIsDrawing(false)` ไม่ลบเส้น
- ตรวจสอบว่า `createElevationProfile` ไม่ลบเส้น

### ✅ **การแก้ไขที่คาดหวัง:**

หลังจากแก้ไขแล้ว ระบบควรแสดง:
- ✅ **เส้นตรงสีส้ม** ระหว่างจุดเริ่มและจุดจบ
- ✅ **Marker สีเขียว** ที่จุดเริ่มต้น
- ✅ **Marker สีแดง** ที่จุดสิ้นสุด
- ✅ **กราฟโปรไฟล์** แสดงความสูง

### 🎉 **สรุป:**

การแก้ไขนี้จะทำให้เส้นตรงแสดงบนแผนที่ได้ชัดเจน และผู้ใช้จะเห็นเส้นทางที่เลือกได้ทันที! 🎉
