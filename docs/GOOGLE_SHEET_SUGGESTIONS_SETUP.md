# การตั้งค่า Google Sheet สำหรับรับคำแนะนำ (Suggestions)

ฟีเจอร์ **คำแนะนำ** ใน Navbar จะส่งข้อมูลจากผู้ใช้ไปยัง Google Sheet ผ่าน **Google Apps Script Web App**  
คุณต้องสร้าง Sheet, เขียนสคริปต์ และ Deploy เป็น Web App จากนั้นใส่ URL ใน `.env` ของโปรเจกต์

---

## สิ่งที่ต้องทำ

### 1. สร้าง Google Sheet

1. ไปที่ [Google Sheets](https://sheets.google.com) แล้วสร้าง Spreadsheet ใหม่ (เช่นชื่อ "CIPS คำแนะนำ")
2. ใน Sheet แรก (เช่น "Sheet1") ใส่หัวคอลัมน์ในแถวที่ 1 ดังนี้:

   | A | B | C | D | E |
   |---|---|---|---|---|
   | **วันที่เวลา** | **ชื่อ** | **เบอร์โทร** | **อีเมล** | **คำแนะนำ** |

   - **คอลัมน์ A** = วันที่เวลา (ส่งมาจากระบบ)
   - **คอลัมน์ B** = ชื่อผู้ใช้
   - **คอลัมน์ C** = เบอร์โทร
   - **คอลัมน์ D** = อีเมล
   - **คอลัมน์ E** = คำแนะนำ

3. (ถ้าต้องการ) ปรับความกว้างคอลัมน์หรือจัดรูปแบบตามต้องการ

---

### 2. สร้าง Google Apps Script และ Deploy เป็น Web App

1. ในไฟล์ Google Sheet ที่สร้างไว้: เมนู **ส่วนขยาย (Extensions)** → **Apps Script**
2. จะเปิดแท็บใหม่เป็นโปรเจกต์ Apps Script ลบโค้ดเดิมใน `Code.gs` ออก แล้ววางโค้ดด้านล่างแทน

```javascript
/**
 * รับ POST จาก Laravel (ฟอร์มคำแนะนำ) แล้วเขียนลงแถวใหม่ใน Sheet แรก
 * ค่าที่ส่งมา: datetime, name, phone, email, suggestion
 */
function doPost(e) {
  try {
    var params = e.parameter; // Laravel ส่งเป็น application/x-www-form-urlencoded
    var datetime = params.datetime || '';
    var name = params.name || '';
    var phone = params.phone || '';
    var email = params.email || '';
    var suggestion = params.suggestion || '';

    var sheet = SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
    sheet.appendRow([datetime, name, phone, email, suggestion]);

    return ContentService
      .createTextOutput(JSON.stringify({ success: true }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
```

3. บันทึกโปรเจกต์ (Ctrl+S หรือไอคอนบันทึก) และตั้งชื่อโปรเจกต์ (เช่น "CIPS Suggestions")
4. **Deploy เป็น Web App**
   - คลิก **Deploy** → **New deployment**
   - เลือกประเภท **Web app**
   - ตั้งค่า:
     - **Description**: เช่น "รับคำแนะนำจาก CIPS"
     - **Execute as**: **Me** (บัญชีของคุณ)
     - **Who has access**: **Anyone** (เพื่อให้ Laravel ส่ง POST ได้จากเซิร์ฟเวอร์)
   - คลิก **Deploy**
   - อนุญาตสิทธิ์ (Authorize) เมื่อถูกถาม เลือกบัญชี Google ของคุณ แล้วกด **Allow**
   - หลังจาก Deploy เสร็จ จะได้ **Web app URL** (ลงท้ายด้วย `/exec`)  
     **คัดลอก URL นี้ไว้** — จะใช้ใส่ใน `.env`

---

### 3. ตั้งค่าในโปรเจกต์ Laravel

1. เปิดไฟล์ `.env` ที่โฟลเดอร์โปรเจกต์ (cips)
2. เพิ่มบรรทัดนี้ (แทนที่ URL ด้วย Web app URL ที่คัดลอกไว้):

```env
GOOGLE_SHEET_SUGGESTIONS_WEB_APP_URL=https://script.google.com/macros/s/AKfycbx8zOWqWHS4pLFr3P-4ou77CWkuNroScjz7Gall5HqgN8_wPV3ePqAMt0W84rwHYDnVNg/exec
```

3. บันทึก `.env` แล้วรันใหม่หรือ reload config (เช่น `php artisan config:clear`)

---

## สรุปการทำงาน

- ผู้ใช้กดปุ่ม **คำแนะนำ** ใน Navbar → เปิด popup กรอก ชื่อ, เบอร์โทร, อีเมล, คำแนะนำ
- กด **ส่งคำแนะนำ** → ฟรอนต์ส่ง POST ไปที่ `/api/suggestions`
- Laravel รับข้อมูล แล้วส่งต่อไปยัง **Google Apps Script Web App URL** (แบบ form: datetime, name, phone, email, suggestion)
- Apps Script รับใน `doPost(e)` จาก `e.parameter` แล้ว `appendRow` ลง Sheet แรก
- ใน Sheet จะเห็นแถวใหม่เรียงตาม: วันที่เวลา | ชื่อ | เบอร์โทร | อีเมล | คำแนะนำ

---

## หมายเหตุ

- ถ้าไม่ใส่ `GOOGLE_SHEET_SUGGESTIONS_WEB_APP_URL` ใน `.env` การกดส่งคำแนะนำจะได้ข้อความประมาณว่า "การส่งคำแนะนำยังไม่ได้เปิดใช้งาน"
- Web App ต้องตั้ง **Who has access** เป็น **Anyone** ถึงจะรับ request จากเซิร์ฟเวอร์ Laravel ได้
- ถ้าแก้โค้ด Apps Script ต้อง **Deploy** ใหม่โดยเลือก **Manage deployments** → แก้ไข deployment เดิม → **Version** = New version → **Deploy** (URL เดิมจะยังใช้ได้)
