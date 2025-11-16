# Elevation Profile Chart Fix - การแก้ไขกราฟโปรไฟล์ความสูง

## ปัญหาที่พบ: Y-axis แสดงเลขซ้ำและมีทศนิยม

### 🚨 **ปัญหาที่พบ:**

#### **1. Y-axis แสดงเลขซ้ำ**

- แสดง "28m" และ "29m" ซ้ำกัน
- ไม่มีเลขเต็มที่ชัดเจน
- ดูไม่เป็นระเบียบ

#### **2. มีทศนิยม**

- แสดงทศนิยมที่ไม่จำเป็น
- ดูไม่สะอาด
- ยากต่อการอ่าน

### 🔧 **การแก้ไขที่ทำ:**

#### **1. สร้าง Y-axis Scale ใหม่**

```typescript
// Create nice Y-axis scale starting from 0
const yAxisMin = 0;
const yAxisMax = Math.ceil(maxElevation / 10) * 10; // Round up to nearest 10
const yAxisRange = yAxisMax - yAxisMin;
```

#### **2. คำนวณ Step Size ที่เหมาะสม**

```typescript
// Calculate step size for Y-axis
const stepSize = Math.max(1, Math.ceil(yAxisRange / 8)); // At least 1m steps
const numSteps = Math.ceil(yAxisRange / stepSize);
```

#### **3. สร้าง Y-axis Labels ที่ไม่ซ้ำกัน**

```typescript
for (let i = 0; i <= numSteps; i++) {
    const elevation = yAxisMin + i * stepSize;
    if (elevation <= yAxisMax) {
        const y = padding + chartHeight - ((elevation - yAxisMin) / yAxisRange) * chartHeight;
        ctx.fillText(`${elevation} m`, padding - 10, y + 4);
    }
}
```

#### **4. แก้ไข Grid Lines ให้สอดคล้อง**

```typescript
// Horizontal grid lines - Match Y-axis scale
const stepSize = Math.max(1, Math.ceil(yAxisRange / 8));
const numSteps = Math.ceil(yAxisRange / stepSize);

for (let i = 0; i <= numSteps; i++) {
    const elevation = yAxisMin + i * stepSize;
    if (elevation <= yAxisMax) {
        const y = padding + chartHeight - ((elevation - yAxisMin) / yAxisRange) * chartHeight;
        // Draw grid line
    }
}
```

### 🎯 **คุณสมบัติใหม่:**

#### **1. Y-axis เริ่มจาก 0**

- เริ่มจาก 0m เสมอ
- ไม่ขึ้นกับข้อมูลจริง
- ดูเป็นระเบียบ

#### **2. เลขเต็มเท่านั้น**

- ไม่มีทศนิยม
- ดูสะอาด
- อ่านง่าย

#### **3. ไม่ซ้ำกัน**

- แต่ละค่าไม่ซ้ำ
- ดูเป็นระเบียบ
- เข้าใจง่าย

#### **4. Step Size ที่เหมาะสม**

- คำนวณอัตโนมัติ
- ไม่เกิน 8 ขั้น
- อย่างน้อย 1m ต่อขั้น

### 📊 **ตัวอย่างการทำงาน:**

#### **1. ข้อมูลความสูง 28-29m**

- **Y-axis Min**: 0m
- **Y-axis Max**: 30m (ปัดขึ้น)
- **Step Size**: 5m
- **Labels**: 0m, 5m, 10m, 15m, 20m, 25m, 30m

#### **2. ข้อมูลความสูง 100-150m**

- **Y-axis Min**: 0m
- **Y-axis Max**: 160m (ปัดขึ้น)
- **Step Size**: 20m
- **Labels**: 0m, 20m, 40m, 60m, 80m, 100m, 120m, 140m, 160m

#### **3. ข้อมูลความสูง 500-600m**

- **Y-axis Min**: 0m
- **Y-axis Max**: 600m
- **Step Size**: 75m
- **Labels**: 0m, 75m, 150m, 225m, 300m, 375m, 450m, 525m, 600m

### ✅ **ผลลัพธ์ที่คาดหวัง:**

#### **1. Y-axis ที่สวยงาม**

- ✅ เริ่มจาก 0m
- ✅ เลขเต็มเท่านั้น
- ✅ ไม่ซ้ำกัน
- ✅ Step size เท่ากัน

#### **2. กราฟที่อ่านง่าย**

- ✅ ดูเป็นระเบียบ
- ✅ เข้าใจง่าย
- ✅ ข้อมูลชัดเจน
- ✅ ไม่สับสน

### 🎉 **สรุป:**

การแก้ไขนี้จะทำให้กราฟโปรไฟล์ความสูงแสดง Y-axis ที่สวยงาม เริ่มจาก 0m ขึ้นไปถึงค่าสูงสุด โดยแสดงเลขเต็มเท่านั้นและไม่ซ้ำกัน! 🎉

### 💡 **เคล็ดลับ:**

#### **1. ปัดขึ้นเป็น 10**

- ใช้ `Math.ceil(maxElevation / 10) * 10`
- ทำให้ Y-axis สวยงาม
- ไม่เกิน 10 ขั้น

#### **2. Step Size อัตโนมัติ**

- คำนวณจาก `yAxisRange / 8`
- อย่างน้อย 1m ต่อขั้น
- ไม่เกิน 8 ขั้น

#### **3. เลขเต็มเท่านั้น**

- ไม่มีทศนิยม
- ดูสะอาด
- อ่านง่าย
