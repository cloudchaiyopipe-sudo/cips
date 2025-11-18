<?php
namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Illuminate\Http\Request;
use Inertia\Inertia;

class ProductAdminController extends Controller
{
    // แสดงหน้าฟอร์มสร้างสินค้า
    public function create()
    {
        return Inertia::render('free-plan/admin/productArticle');
    }

    // บันทึกสินค้าใหม่ (พร้อมรูปภาพ)
    public function store(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'required|string',
            'price' => 'required|numeric',
            'category' => 'required|in:new,promotion',
            'image_url' => 'nullable|string|max:500', // รับ URL ที่อัปโหลดแล้ว
        ]);

        $data = $request->all();
        
        // แปลง originalPrice เป็น original_price (snake_case สำหรับ database)
        if (isset($data['originalPrice'])) {
            $data['original_price'] = $data['originalPrice'];
            unset($data['originalPrice']);
        }

        // 4. สร้าง Product พร้อมข้อมูลและ URL รูปภาพ
        Product::create($data);

        return redirect()->route('free.products') // (ไปหน้า product list)
                         ->with('success', 'สินค้าถูกเพิ่มเรียบร้อยแล้ว');
    }

    // ลบสินค้า
    public function destroy(Product $product)
    {
        $product->delete();

        // ถ้ามาจากหน้า free-plan/products ให้ redirect กลับไปที่นั่น
        if (request()->header('Referer') && str_contains(request()->header('Referer'), '/free-plan/products')) {
            return redirect()->route('free.products')->with('success', 'สินค้าถูกลบเรียบร้อยแล้ว');
        }

        return redirect()->back()->with('success', 'สินค้าถูกลบเรียบร้อยแล้ว');
    }
}
