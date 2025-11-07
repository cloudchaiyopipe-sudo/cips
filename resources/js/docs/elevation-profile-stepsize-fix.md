# Elevation Profile stepSize Fix - การแก้ไขข้อผิดพลาด stepSize

## ปัญหาที่พบ: stepSize ถูกประกาศซ้ำ

### 🚨 **ข้อผิดพลาดที่พบ:**

#### **1. Compilation Error**
```
[plugin:vite:react-babel] Identifier 'stepSize' has already been declared. (457:14)
```

#### **2. Internal Server Error**
```
GET http://localhost:5174/resources/js/components/horticulture/ElevationProfile.tsx?t=1761357305698 net::ERR_ABORTED 500 (Internal Server Error)
```

#### **3. Module Import Error**
```
Uncaught (in promise) TypeError: Failed to fetch dynamically imported module
```

### 🔧 **การแก้ไขที่ทำ:**

#### **1. ย้ายการคำนวณ stepSize ไปไว้ที่ต้นฟังก์ชัน**
```typescript
// Create nice Y-axis scale starting from 0
const yAxisMin = 0;
const yAxisMax = Math.ceil(maxElevation / 10) * 10; // Round up to nearest 10
const yAxisRange = yAxisMax - yAxisMin;

// Calculate step size for Y-axis (used in multiple places)
const stepSize = Math.max(1, Math.ceil(yAxisRange / 8)); // At least 1m steps
const numSteps = Math.ceil(yAxisRange / stepSize);
```

#### **2. ลบการประกาศ stepSize ซ้ำในส่วน grid lines**
```typescript
// Horizontal grid lines - Match Y-axis scale
for (let i = 0; i <= numSteps; i++) {
    const elevation = yAxisMin + i * stepSize;
    if (elevation <= yAxisMax) {
        const y = padding + chartHeight - ((elevation - yAxisMin) / yAxisRange) * chartHeight;
        // Draw grid line
    }
}
```

#### **3. ลบการประกาศ stepSize ซ้ำในส่วน Y-axis labels**
```typescript
// Y-axis labels (elevation) - Create nice scale with whole numbers
ctx.textAlign = 'right';

for (let i = 0; i <= numSteps; i++) {
    const elevation = yAxisMin + i * stepSize;
    if (elevation <= yAxisMax) {
        const y = padding + chartHeight - ((elevation - yAxisMin) / yAxisRange) * chartHeight;
        ctx.fillText(`${elevation} m`, padding - 10, y + 4);
    }
}
```

### 🎯 **สาเหตุของปัญหา:**

#### **1. Variable Redeclaration**
- `stepSize` ถูกประกาศใน 3 ที่
- ใช้ `const` ทำให้ไม่สามารถ redeclare ได้
- JavaScript/TypeScript ไม่อนุญาต

#### **2. Scope Issues**
- ตัวแปรใน scope เดียวกัน
- ไม่สามารถใช้ชื่อเดียวกันได้
- ต้องใช้ชื่ออื่นหรือย้ายไป scope อื่น

#### **3. Code Duplication**
- คำนวณ `stepSize` ซ้ำกัน
- ไม่มีประสิทธิภาพ
- ยากต่อการบำรุงรักษา

### 📊 **การแก้ไขที่ทำ:**

#### **1. Single Declaration**
- ประกาศ `stepSize` ครั้งเดียว
- ใช้ในทุกที่ที่ต้องการ
- ไม่มี redeclaration

#### **2. Proper Scope**
- ประกาศใน scope ที่เหมาะสม
- เข้าถึงได้จากทุกที่ที่ต้องการ
- ไม่มี scope conflicts

#### **3. Code Reuse**
- ใช้ตัวแปรเดียวกัน
- ไม่คำนวณซ้ำ
- มีประสิทธิภาพ

### ✅ **ผลลัพธ์ที่คาดหวัง:**

#### **1. ไม่มี Compilation Error**
- ✅ ไม่มี redeclaration error
- ✅ Compile สำเร็จ
- ✅ ไม่มี syntax error

#### **2. ไม่มี Internal Server Error**
- ✅ Module load สำเร็จ
- ✅ ไม่มี 500 error
- ✅ ไม่มี fetch error

#### **3. ระบบทำงานปกติ**
- ✅ กราฟแสดงได้
- ✅ Y-axis ทำงานได้
- ✅ ไม่มี runtime error

### 🎉 **สรุป:**

การแก้ไขนี้จะทำให้ระบบทำงานได้ปกติโดยไม่มี compilation error และ internal server error! 🎉

### 💡 **เคล็ดลับ:**

#### **1. หลีกเลี่ยง Variable Redeclaration**
- ประกาศตัวแปรครั้งเดียว
- ใช้ในทุกที่ที่ต้องการ
- ตรวจสอบ scope

#### **2. Code Organization**
- จัดระเบียบโค้ด
- หลีกเลี่ยง duplication
- ใช้ตัวแปรร่วมกัน

#### **3. Error Prevention**
- ตรวจสอบ linting errors
- ตรวจสอบ compilation
- ตรวจสอบ runtime
