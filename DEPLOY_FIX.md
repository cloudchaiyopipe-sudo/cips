# คำสั่งสำหรับแก้ปัญหา 500 Error บน Cloud Server

## ปัญหา
- หน้า `/free-plan/news` และ `/free-plan/products` เกิด 500 Internal Server Error บน cloud
- ทำงานได้ปกติบน local

## สาเหตุ
- โฟลเดอร์ `Freeplan` ถูกเปลี่ยนชื่อเป็น `FreePlan` แล้ว
- แต่ autoload cache บน server ยังไม่ถูก regenerate

## วิธีแก้ไข

### 1. SSH เข้าไปที่ cloud server

### 2. ตรวจสอบว่าโฟลเดอร์ถูกต้อง
```bash
ls -la app/Http/Controllers/ | grep -i freeplan
```
ควรเห็น `FreePlan` (ตัว P ตัวใหญ่) ไม่ใช่ `Freeplan`

### 3. ลบโฟลเดอร์เก่าถ้ามี (ถ้ายังมี Freeplan อยู่)
```bash
# ตรวจสอบก่อนว่ามีโฟลเดอร์เก่าหรือไม่
ls -la app/Http/Controllers/Freeplan 2>/dev/null && echo "Found old folder" || echo "No old folder"

# ถ้ามี ให้ลบ
rm -rf app/Http/Controllers/Freeplan
```

### 4. Regenerate Autoload และ Clear Cache
```bash
cd /path/to/your/project

# Regenerate Composer autoload
composer dump-autoload

# Clear Laravel caches
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear

# Optimize (optional but recommended for production)
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### 5. ตรวจสอบว่า class ถูก load ได้
```bash
php artisan tinker
```
แล้วรัน:
```php
class_exists('App\Http\Controllers\FreePlan\NewsController');
class_exists('App\Http\Controllers\FreePlan\ProductController');
```
ควรได้ `true` ทั้งสอง

### 6. ตรวจสอบ error logs
```bash
tail -f storage/logs/laravel.log
```
หรือ
```bash
tail -n 100 storage/logs/laravel.log
```

### 7. ตรวจสอบ permissions
```bash
chmod -R 755 app/Http/Controllers/FreePlan
chown -R www-data:www-data app/Http/Controllers/FreePlan
```

## ถ้ายังไม่ได้ผล

### ตรวจสอบว่า routes ถูกต้อง
```bash
php artisan route:list | grep free-plan
```

### ตรวจสอบว่า namespace ถูกต้อง
```bash
grep -r "namespace App\\Http\\Controllers\\FreePlan" app/Http/Controllers/FreePlan/
```

### ตรวจสอบว่า use statements ใน routes/web.php ถูกต้อง
```bash
grep -i "FreePlan" routes/web.php
```

## หมายเหตุ
- หลังจากแก้ไขแล้ว ควร restart web server (nginx/apache) และ PHP-FPM
- ถ้าใช้ queue workers ควร restart ด้วย

