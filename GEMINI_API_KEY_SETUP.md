# การตั้งค่า GEMINI_API_KEY

## ปัญหา
ระบบ ChaiyoAI แสดงข้อความ "service_unavailable" เพราะไม่พบ GEMINI_API_KEY

## วิธีแก้ไข

### 1. รับ Gemini API Key
1. ไปที่ [Google AI Studio](https://makersuite.google.com/app/apikey)
2. สร้าง API Key ใหม่
3. คัดลอก API Key ที่ได้

### 2. ตั้งค่าในไฟล์ .env
1. เปิดไฟล์ `.env` ในโฟลเดอร์ root ของโปรเจค
2. เพิ่มบรรทัดต่อไปนี้:
   ```
   GEMINI_API_KEY=your_api_key_here
   ```
3. แทนที่ `your_api_key_here` ด้วย API Key ที่คัดลอกมา

### 3. รีสตาร์ท Web Server
```bash
# สำหรับ Laravel development server
php artisan serve

# หรือรีสตาร์ท web server ที่ใช้อยู่
```

### 4. ตรวจสอบการตั้งค่า
- ไปที่ `/api/ai/health` เพื่อตรวจสอบสถานะ
- หรือทดสอบผ่าน `/api/ai/test`

## หมายเหตุ
- **อย่า** commit API Key ลงใน Git repository
- ตรวจสอบว่า `.env` อยู่ใน `.gitignore`
- ใช้ environment variables ใน production

## Troubleshooting

### API Key ไม่ทำงาน
- ตรวจสอบว่า API Key ถูกต้อง
- ตรวจสอบว่า API Key ยังไม่หมดอายุ
- ตรวจสอบ quota ของ API Key

### ยังแสดง service_unavailable
- ตรวจสอบว่าเพิ่ม GEMINI_API_KEY ใน .env แล้ว
- ตรวจสอบว่าไม่มี space หรือ quote ใน API Key
- รีสตาร์ท web server
- ตรวจสอบ Laravel logs: `storage/logs/laravel.log`

