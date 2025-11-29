# Mailtrap Setup Guide

## ปัญหาที่พบ
อีเมลไม่เข้า inbox ของ mailtrap

## การตรวจสอบ

### 1. ตรวจสอบ .env file
ตรวจสอบว่ามีการตั้งค่าดังนี้:
```
MAIL_MAILER=smtp
MAIL_HOST=sandbox.smtp.mailtrap.io
MAIL_PORT=2525
MAIL_USERNAME=your_username
MAIL_PASSWORD=your_password
MAIL_ENCRYPTION=tls
MAIL_FROM_ADDRESS="hello@example.com"
MAIL_FROM_NAME="${APP_NAME}"
```

### 2. Clear config cache
```bash
php artisan config:clear
php artisan config:cache
```

### 3. ตรวจสอบ Mailtrap Credentials
1. เข้าไปที่ https://mailtrap.io
2. ไปที่ Inboxes > Sandbox
3. ตรวจสอบว่า Username และ Password ถูกต้อง
4. ตรวจสอบว่า Port เป็น 2525 (ไม่ใช่ 587 หรือ 465)

### 4. ตรวจสอบ Mailtrap Inbox
- ตรวจสอบว่าเลือก Inbox ที่ถูกต้อง (Sandbox)
- ตรวจสอบ Spam folder
- ตรวจสอบว่า Inbox ไม่เต็ม

### 5. ทดสอบการส่งอีเมล
ลองกดปุ่ม "Send Verification Email" อีกครั้งและตรวจสอบ:
- Laravel logs: `storage/logs/laravel.log`
- Mailtrap inbox

### 6. ตรวจสอบ Mailtrap Version
Mailtrap มี 2 versions:
- **Sandbox (Classic)**: ใช้ port 2525, encryption: tls
- **Sandbox (New)**: ใช้ port 587, encryption: tls หรือ port 465, encryption: ssl

### 7. Alternative: ใช้ Mailtrap API
ถ้ายังไม่ได้ผล ลองใช้ Mailtrap API แทน SMTP

## การแก้ไขที่แนะนำ

### Option 1: ตรวจสอบ Encryption
ลองเปลี่ยน `MAIL_ENCRYPTION` เป็น:
- `tls` (สำหรับ port 2525 หรือ 587)
- `ssl` (สำหรับ port 465)
- หรือลบออก (สำหรับ port 2525 บางกรณี)

### Option 2: ตรวจสอบ Credentials
1. ไปที่ Mailtrap Dashboard
2. คัดลอก Username และ Password ใหม่
3. อัปเดตใน .env file
4. Run `php artisan config:clear`

### Option 3: ใช้ Mailtrap Testing
สร้าง route test เพื่อทดสอบ:
```php
Route::get('/test-email', function() {
    try {
        Mail::raw('Test email', function($message) {
            $message->to('test@example.com')
                    ->subject('Test Email');
        });
        return 'Email sent successfully';
    } catch (\Exception $e) {
        return 'Error: ' . $e->getMessage();
    }
});
```

## Debugging
ตรวจสอบ logs:
```bash
tail -f storage/logs/laravel.log
```

หรือใน Windows:
```powershell
Get-Content storage/logs/laravel.log -Tail 50 -Wait
```

