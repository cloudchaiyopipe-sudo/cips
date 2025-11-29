<?php
namespace App\Http\Controllers\FreePlan;

use App\Http\Controllers\Controller;
use App\Models\Product;
use Inertia\Inertia;

class ProductController extends Controller
{
    public function index()
    {
        // 4. ดึงสินค้าทั้งหมดจาก DB และแปลงข้อมูลให้ตรงกับ frontend
        $products = Product::orderBy('created_at', 'desc')->get()->map(function ($product) {
            return [
                'id' => $product->id,
                'name' => $product->name,
                'description' => $product->description,
                'price' => (float) $product->price,
                'originalPrice' => $product->original_price ? (float) $product->original_price : null,
                'image_url' => $product->image_url ?? '/images/no-image.jpg',
                'category' => $product->category,
                'discount' => $product->discount && $product->discount > 0 ? $product->discount : null,
                'isNew' => $product->category === 'new',
                'isPromotion' => $product->category === 'promotion',
            ];
        });

        // 5. ส่ง 'products' ไปเป็น Props
        return Inertia::render('free-plan/productList', [
            'products' => $products 
        ]);
    }
}
