ขั้นตอนการ Deploy
# 1. บนเครื่องของคุณ ต้อง Push ขึ้น Github ก่อน
git add .
git commit -m "อธิบายสั้น ๆ ว่าแก้ไขอะไรไปบ้าง"
git push origin main

# 2. บน Server ที่เมนู VM Instance กดปุ่ม SSH แล้วทำตามนี้
cd /var/www/chaiyopipeandfitting.com
git reset --hard HEAD
git pull origin main
composer install --no-dev --optimize-autoloader
npm install
npm run build
sudo mv public/build/.vite/manifest.json public/build/manifest.json
// รันคำสั่ง Laravel กรณีที่มีการแก้ไขโครงสร้างฐานข้อมูล
php artisan migrate --force
php artisan optimize:clear
