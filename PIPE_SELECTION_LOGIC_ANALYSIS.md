# การวิเคราะห์หลักการแสดงรายการท่อและเลือกท่ออัตโนมัติ

## 📋 สรุปหลักการ

### 1. การแสดงรายการท่อใน Dropdown (`SearchableDropdown`)

#### หลักการทั่วไป (ใช้เหมือนกันทุก projectMode)

**1.1 การ Filter ท่อใน `PipeSelector.tsx` (บรรทัด 528-556):**

```typescript
// Filter ท่อตามประเภท (PE/PVC)
filteredPipes = pipes.filter(pipe => 
    pipe.pipeType === selectedPipeType
);

// Filter ท่อ branch/emitter ให้มีขนาด ≤ 32mm
if (pipeType === 'branch' || pipeType === 'emitter') {
    filteredPipes = filteredPipes.filter(pipe => 
        pipe.sizeMM <= 32
    );
}

// Filter ท่อตามแรงดัน (ต้อง ≥ sprinklerPressure.pressureBar)
if (sprinklerPressure) {
    filteredPipes = filteredPipes.filter(pipe => 
        pipe.pn >= sprinklerPressure.pressureBar
    );
}
```

**1.2 การสร้าง `pipeOptions` สำหรับ Dropdown (บรรทัด 914-1045):**

```typescript
pipeOptions = availablePipes
    .filter(pipe => {
        // ตรวจสอบ Hierarchy Compliance
        // - main > secondary > branch > emitter
        return validateHierarchy(pipe);
    })
    .map(pipe => {
        // คำนวณ Head Loss สำหรับแต่ละท่อ
        const calc = calculateNewHeadLoss(
            currentZoneBestPipe,
            selectedPipeType,
            pressureClass,
            `${pipe.sizeMM}mm`
        );
        
        const headLoss = calc?.headLoss || 0;
        const targetHeadLoss = getTargetHeadLoss(pipeType, head20Percent);
        const diffFromTarget = Math.abs(headLoss - targetHeadLoss);
        
        // แท็กสถานะตาม diffFromTarget
        return {
            value: pipe.id,
            label: `${isHierarchyCompliant ? '✅' : '⛔'} ${pipe.name}...`,
            headLoss: headLoss,
            isHierarchyCompliant: isHierarchyCompliant,
            isRecommended: isHierarchyCompliant && diffFromTarget <= 0.5,  // ⭐
            isGoodChoice: isHierarchyCompliant && diffFromTarget <= 1.0,    // ✅
            isUsable: isHierarchyCompliant,                                 // ⚡
            diffFromTarget: diffFromTarget
        };
    })
    .sort((a, b) => {
        // Sort: Hierarchy Compliance ก่อน → แล้วตาม diffFromTarget
        if (a.isHierarchyCompliant !== b.isHierarchyCompliant) {
            return a.isHierarchyCompliant ? -1 : 1;
        }
        return a.diffFromTarget - b.diffFromTarget;
    });
```

**1.3 Target Head Loss ตาม Pipe Type:**

```typescript
function getTargetHeadLoss(pipeType: string, head20Percent: number): number {
    switch (pipeType) {
        case 'main':      return head20Percent;        // 100% ของ 20%
        case 'secondary': return head20Percent * 0.6;  // 60% ของ 20%
        case 'branch':
        case 'emitter':   return head20Percent * 0.4;  // 40% ของ 20%
    }
}
```

---

### 2. การเลือกท่ออัตโนมัติเมื่อเข้าหน้ามาครั้งแรก

#### หลักการทั่วไป

**2.1 เงื่อนไขการเลือกอัตโนมัติ (บรรทัด 624-635):**

```typescript
useEffect(() => {
    if (
        availablePipes.length > 0 &&
        currentZoneBestPipe &&           // ต้องมีข้อมูลท่อที่ต้องการน้ำมากที่สุด
        sprinklerPressure &&            // ต้องมีข้อมูลแรงดันหัวฉีด
        !isManuallySelected &&          // ต้องไม่เคยเลือกด้วยตนเอง
        !wasManuallySelectedInThisZone && // ต้องไม่เคยเลือกด้วยตนเองในโซนนี้
        activeZoneId                    // ต้องมี activeZoneId
    ) {
        // ทำการเลือกอัตโนมัติ
    }
}, [availablePipes, currentZoneBestPipe, sprinklerPressure, ...]);
```

**2.2 กระบวนการเลือกอัตโนมัติ (บรรทัด 762-798):**

```typescript
// Step 1: Filter ท่อตาม Hierarchy
const hierarchyFilteredPipes = getFilteredPipesByHierarchy(availablePipes);

// Step 2: Validate Cross-Component Hierarchy
const validateCrossComponentHierarchy = (candidatePipe) => {
    // ตรวจสอบว่าไม่ violate hierarchy
    // เช่น: main > secondary > branch > emitter
};

// Step 3: เลือกท่อที่ดีที่สุดด้วย selectBestPipeByHeadLoss
const bestPipe = selectBestPipeByHeadLoss(
    hierarchyFilteredPipes,
    pipeType,
    currentZoneBestPipe,      // ข้อมูลท่อที่ต้องการน้ำมากที่สุด
    selectedPipeType,         // PE หรือ PVC
    selectedPipeSizes,        // ขนาดท่อที่เลือกแล้วในประเภทอื่น
    sprinklerPressure.head20PercentM
);

// Step 4: Validate และเลือก
if (bestPipe && validateCrossComponentHierarchy(bestPipe)) {
    onPipeChange(bestPipe);
} else {
    // หาท่อสำรองที่ผ่าน hierarchy validation
    const alternativePipes = hierarchyFilteredPipes.filter(validateCrossComponentHierarchy);
    const alternativeBest = selectBestPipeByHeadLoss(...);
    onPipeChange(alternativeBest);
}
```

**2.3 ฟังก์ชัน `selectBestPipeByHeadLoss` (horticulturePipeCalculations.ts):**

```typescript
export function selectBestPipeByHeadLoss(
    availablePipes: any[],
    pipeType: string,
    bestPipeInfo: BestPipeInfo,      // ข้อมูลท่อที่ต้องการน้ำมากที่สุด
    selectedPipeType: string,          // PE หรือ PVC
    selectedPipeSizes: SelectedPipeSizes,
    head20Percent: number
): any | null {
    // 1. Filter ท่อที่ผ่าน Hierarchy Validation
    const validPipes = availablePipes.filter(pipe => 
        validatePipeSizeHierarchy(pipeType, pipe.sizeMM, selectedPipeSizes)
    );
    
    // 2. กำหนด Target Head Loss ตามประเภทท่อ
    let targetHeadLossValue: number;
    switch (pipeType) {
        case 'main':      targetHeadLossValue = head20Percent;        // 100%
        case 'secondary': targetHeadLossValue = head20Percent * 0.6;  // 60%
        case 'branch':
        case 'emitter':   targetHeadLossValue = head20Percent * 0.4;  // 40%
    }
    
    // 3. คำนวณ Head Loss สำหรับทุกท่อ
    const candidates = validPipes.map(pipe => {
        const calculation = calculateNewHeadLoss(
            bestPipeInfo,      // ใช้ข้อมูลท่อที่ต้องการน้ำมากที่สุด
            selectedPipeType,
            pressureClass,
            `${pipe.sizeMM}mm`
        );
        return {
            pipe,
            headLoss: calculation.headLoss,
            calculation
        };
    });
    
    // 4. เลือกท่อที่ Head Loss ใกล้เคียง Target มากที่สุด
    //    - สำหรับ main: ต้อง ≤ target (Max Limit Mode)
    //    - สำหรับอื่น: เลือกที่ใกล้เคียง target มากที่สุด
    const minDiff = Math.min(
        ...candidates.map(c => Math.abs(c.headLoss - targetHeadLossValue))
    );
    const bestCandidates = candidates.filter(
        c => Math.abs(c.headLoss - targetHeadLossValue) === minDiff
    );
    
    // 5. Sort: ราคาต่ำสุดก่อน → แล้วตามขนาด
    bestCandidates.sort((a, b) => {
        if (a.pipe.price !== b.pipe.price) {
            return a.pipe.price - b.pipe.price;
        }
        return a.pipe.sizeMM - b.pipe.sizeMM;
    });
    
    return bestCandidates[0]?.pipe || null;
}
```

---

## 🎯 หลักการตามแต่ละ ProjectMode

### 1. Horticulture Mode

**ข้อมูลที่ใช้ (`currentZoneBestPipe`):**

```typescript
// จาก horticultureSystemData.zones[activeZoneId].bestPipes
const currentZone = horticultureSystemData.zones?.find(
    zone => zone.id === activeZoneId
);

switch (pipeType) {
    case 'branch':   return currentZone.bestPipes.branch;
    case 'secondary': return currentZone.bestPipes.subMain;
    case 'main':     return currentZone.bestPipes.main;
    case 'emitter':  // ใช้ข้อมูลจาก lateralPipes
        return {
            id: 'emitter-pipe',
            length: longestEmitterLength,  // จาก lateralPipes
            count: 1,
            waterFlowRate: sprinklerConfig.flowRatePerPlant
        };
}
```

**แรงดันหัวฉีด (`sprinklerPressure`):**

```typescript
// จาก horticultureSystemData.sprinklerConfig.pressureBar
const pressureBar = horticultureSystemData.sprinklerConfig.pressureBar;
const pressureInfo = {
    pressureBar: pressureBar,
    headM: pressureBar * 10,
    head20PercentM: pressureBar * 10 * 0.2
};
```

---

### 2. Garden Mode

**ข้อมูลที่ใช้ (`currentZoneBestPipe`):**

```typescript
// จาก gardenSystemData.zones[activeZoneId].bestPipes
const currentZone = gardenSystemData.zones?.find(
    zone => zone.id === activeZoneId
);

switch (pipeType) {
    case 'branch':   return currentZone.bestPipes.branch;
    case 'secondary': return currentZone.bestPipes.subMain;
    case 'main':     return currentZone.bestPipes.main;
    case 'emitter':  // ใช้ข้อมูลจาก sprinklerConfig
        return {
            id: 'emitter-pipe',
            length: 10,
            count: 1,
            waterFlowRate: gardenSystemData.sprinklerConfig.flowRatePerPlant
        };
}
```

**แรงดันหัวฉีด (`sprinklerPressure`):**

```typescript
// จาก gardenSystemData.sprinklerConfig.pressureBar
const pressureBar = gardenSystemData.sprinklerConfig.pressureBar;
// หรือ fallback เป็น 2.5 bar
```

---

### 3. Greenhouse Mode

**ข้อมูลที่ใช้ (`currentZoneBestPipe`):**

```typescript
// 1. ลองดึงจาก localStorage (greenhouseSystemData)
const greenhouseSystemDataStr = localStorage.getItem('greenhouseSystemData');
const systemData = JSON.parse(greenhouseSystemDataStr);
const plotPipeData = systemData.plotPipeData || [];
const pipeFlowData = systemData.pipeFlowData || {};

const currentPlotPipeData = plotPipeData.find(
    plot => plot.plotId === activeZoneId
);

switch (pipeType) {
    case 'branch': {
        const branchLength = pipeFlowData.longest?.sub?.length || 
                            currentPlotPipeData.maxSubPipeLength || 30;
        const branchEmitters = pipeFlowData.longest?.sub?.emitters || 
                               currentPlotPipeData.longestSubPipeEmitters || 1;
        const sprinklerFlowRate = 8; // L/min per sprinkler
        const branchFlowRate = branchEmitters * sprinklerFlowRate;
        
        return {
            id: `branch-pipe-${activeZoneId}`,
            length: branchLength,
            count: branchEmitters,
            waterFlowRate: branchFlowRate
        };
    }
    case 'main': {
        const mainLength = pipeFlowData.longest?.main?.length || 
                          currentPlotPipeData.maxMainPipeLength || 100;
        const mainConnections = pipeFlowData.longest?.main?.connections || 1;
        const mainFlowRate = currentPlotPipeData.totalFlowRate || 0;
        
        return {
            id: `main-pipe-${activeZoneId}`,
            length: mainLength,
            count: mainConnections,
            waterFlowRate: mainFlowRate
        };
    }
}

// 2. Fallback: ใช้จาก greenhouseSystemData.summary.plotStats
const currentPlot = greenhouseSystemData.summary.plotStats.find(
    plot => plot.plotId === activeZoneId
);
```

**แรงดันหัวฉีด (`sprinklerPressure`):**

```typescript
// กำหนดตาม irrigationMethod
let pressureBar = 2.0;
if (irrigationMethod === 'drip') {
    pressureBar = 1.5;
} else if (irrigationMethod === 'mini-sprinkler') {
    pressureBar = 2.0;
} else if (irrigationMethod === 'mixed') {
    pressureBar = 2.2;
}

// หรือจาก rawData.irrigationElements
const sprinklerElements = greenhouseSystemData.rawData?.irrigationElements
    .filter(el => el.type === 'sprinkler');
if (sprinklerElements.length > 0 && sprinklerElements[0].pressureBar) {
    pressureBar = sprinklerElements[0].pressureBar;
}
```

---

### 4. Field-Crop Mode

**ข้อมูลที่ใช้ (`currentZoneBestPipe`):**

```typescript
// จาก fieldCropData (getEnhancedFieldCropData())
const fcData = fieldCropData || getEnhancedFieldCropData();

const createFieldCropPipeInfo = (type: string, length: number, flowRate: number) => ({
    id: `${type}-pipe-field-crop`,
    length: length,
    count: 1,
    waterFlowRate: flowRate,
    details: { type: type }
});

switch (pipeType) {
    case 'branch':
        return createFieldCropPipeInfo(
            'branch',
            fcData.pipes?.stats?.lateral?.longest || 50,
            (fcData.summary?.totalWaterRequirementPerDay || 0) / 
            Math.max(fcData.summary?.totalPlantingPoints || 1, 1) / 60
        );
    case 'secondary':
        return createFieldCropPipeInfo(
            'secondary',
            fcData.pipes?.stats?.submain?.longest || 100,
            (fcData.summary?.totalWaterRequirementPerDay || 0) / 60
        );
    case 'main':
        return createFieldCropPipeInfo(
            'main',
            fcData.pipes?.stats?.main?.longest || 200,
            (fcData.summary?.totalWaterRequirementPerDay || 0) / 60
        );
    case 'emitter':
        return createFieldCropPipeInfo(
            'emitter',
            fcData.pipes?.stats?.lateral?.averageLength || 20,
            0.24
        );
}
```

**แรงดันหัวฉีด (`sprinklerPressure`):**

```typescript
// กำหนดตาม irrigationByType
let pressureBar = 2.5;
if (irrigationByType.dripTape > 0) {
    pressureBar = 1.0;
} else if (irrigationByType.pivot > 0) {
    pressureBar = 3.0;
} else if (irrigationByType.waterJetTape > 0) {
    pressureBar = 1.5;
}
```

---

## 📊 สรุปหลักการ

### การแสดงรายการท่อใน Dropdown

1. **Filter ตามประเภทท่อ**: PE หรือ PVC
2. **Filter ตามขนาด**: branch/emitter ≤ 32mm
3. **Filter ตามแรงดัน**: pn ≥ sprinklerPressure.pressureBar
4. **Filter ตาม Hierarchy**: main > secondary > branch > emitter
5. **คำนวณ Head Loss**: สำหรับทุกท่อ
6. **แท็กสถานะ**: 
   - ⭐ Recommended: diffFromTarget ≤ 0.5
   - ✅ Good Choice: diffFromTarget ≤ 1.0
   - ⚡ Usable: ผ่าน hierarchy validation
7. **Sort**: Hierarchy Compliance → diffFromTarget

### การเลือกท่ออัตโนมัติ

1. **ตรวจสอบเงื่อนไข**: 
   - มี availablePipes
   - มี currentZoneBestPipe (แตกต่างตาม projectMode)
   - มี sprinklerPressure (แตกต่างตาม projectMode)
   - ไม่เคยเลือกด้วยตนเอง

2. **Filter ท่อ**: ตาม Hierarchy Validation

3. **คำนวณ Head Loss**: สำหรับทุกท่อที่ผ่าน filter

4. **เลือกท่อที่ดีที่สุด**:
   - Head Loss ใกล้เคียง Target มากที่สุด
   - ราคาต่ำสุด (ถ้า Head Loss เท่ากัน)
   - ขนาดเล็กสุด (ถ้าราคาเท่ากัน)

5. **Validate Hierarchy**: ตรวจสอบว่าไม่ violate hierarchy

6. **เลือกท่อสำรอง**: ถ้าท่อที่เลือกไม่ผ่าน hierarchy validation

### ความแตกต่างระหว่าง ProjectMode

| ProjectMode   | ข้อมูล currentZoneBestPipe | ข้อมูล sprinklerPressure |
|---------------|---------------------------|------------------------|
| **horticulture** | `horticultureSystemData.zones[id].bestPipes` | `sprinklerConfig.pressureBar` |
| **garden** | `gardenSystemData.zones[id].bestPipes` | `sprinklerConfig.pressureBar` |
| **greenhouse** | `localStorage.greenhouseSystemData.plotPipeData` | ตาม `irrigationMethod` (1.5-2.2 bar) |
| **field-crop** | สร้างจาก `fieldCropData.pipes.stats` | ตาม `irrigationByType` (1.0-3.0 bar) |

---

## 🔍 จุดสำคัญ

1. **ทุก projectMode ใช้หลักการเดียวกัน** ในการแสดงรายการและเลือกท่อ
2. **ความแตกต่างอยู่ที่แหล่งข้อมูล**: แต่ละ mode ใช้แหล่งข้อมูลที่แตกต่างกันสำหรับ `currentZoneBestPipe` และ `sprinklerPressure`
3. **Hierarchy Validation**: สำคัญมาก ต้องตรวจสอบทุกครั้ง
4. **Target Head Loss**: แตกต่างตามประเภทท่อ (main: 100%, secondary: 60%, branch/emitter: 40%)
5. **การเลือกอัตโนมัติ**: ใช้ Head Loss เป็นหลัก แล้วพิจารณาราคาและขนาดตามลำดับ

