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
            'category' => 'required|in:new,promotion,recommended',
            'image_url' => 'nullable|string|max:500', // รับ URL ที่อัปโหลดแล้ว
            'video_url' => 'nullable|string|max:500', // Video URL for recommended products
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

    // แสดงหน้าฟอร์มแก้ไขสินค้า
    public function edit(Product $product)
    {
        return Inertia::render('free-plan/admin/productArticle', [
            'product' => [
                'id' => $product->id,
                'name' => $product->name,
                'description' => $product->description,
                'price' => (float) $product->price,
                'originalPrice' => $product->original_price ? (float) $product->original_price : null,
                'category' => $product->category,
                'discount' => $product->discount && $product->discount > 0 ? $product->discount : null,
                'image_url' => $product->image_url ?? '',
                'video_url' => $product->video_url ?? '',
            ]
        ]);
    }

    // อัปเดตสินค้า
    public function update(Request $request, Product $product)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'required|string',
            'price' => 'required|numeric',
            'category' => 'required|in:new,promotion,recommended',
            'image_url' => 'nullable|string|max:500',
            'video_url' => 'nullable|string|max:500',
        ]);

        $data = $request->all();
        
        // แปลง originalPrice เป็น original_price (snake_case สำหรับ database)
        if (isset($data['originalPrice'])) {
            $data['original_price'] = $data['originalPrice'];
            unset($data['originalPrice']);
        }

        // อัปเดตสินค้า
        $product->update($data);

        return redirect()->route('free.products')
                         ->with('success', 'สินค้าถูกแก้ไขเรียบร้อยแล้ว');
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
