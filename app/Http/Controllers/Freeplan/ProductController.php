<?php
namespace App\Http\Controllers\FreePlan;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Equipment;
use Inertia\Inertia;
use Illuminate\Http\Request;

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
                'video_url' => $product->video_url ?? null,
                'category' => $product->category,
                'discount' => $product->discount && $product->discount > 0 ? $product->discount : null,
                'isNew' => $product->category === 'new',
                'isPromotion' => $product->category === 'promotion',
                'isRecommended' => $product->category === 'recommended',
            ];
        });

        // 5. ส่ง 'products' ไปเป็น Props
        return Inertia::render('free-plan/productList', [
            'products' => $products 
        ]);
    }

    // หน้า FreeProductDetail.tsx - รองรับทั้ง Product และ Equipment (Sprinkler)
    public function show(Request $request, $id)
    {
        // Try to find as Product first
        $product = Product::find($id);
        
        if ($product) {
            // Found as Product, return as is
            return Inertia::render('free-plan/freeProductDetail', [
                'product' => [
                    'id' => $product->id,
                    'name' => $product->name,
                    'description' => $product->description,
                    'price' => (float) $product->price,
                    'originalPrice' => $product->original_price ? (float) $product->original_price : null,
                    'image_url' => $product->image_url ?? null,
                    'video_url' => $product->video_url ?? null,
                    'category' => $product->category,
                    'discount' => $product->discount && $product->discount > 0 ? $product->discount : null,
                    'created_at' => $product->created_at?->toDateTimeString(),
                    'updated_at' => $product->updated_at?->toDateTimeString(),
                ]
            ]);
        }
        
        // If not found as Product, try to find as Equipment (for sprinklers)
        $equipment = Equipment::with(['category', 'attributeValues.attribute'])->find($id);
        
        if ($equipment) {
            // Use toCalculationFormat() to get all equipment data including attributes
            // This method automatically includes all attribute values like waterVolumeLitersPerMinute, radiusMeters, pressureBar
            $equipmentData = $equipment->toCalculationFormat();
            
            // Get all attributes for display
            // Try formatted_attributes first, then attributes_raw, then extract from equipmentData
            $attributesRaw = null;
            if (isset($equipmentData['formatted_attributes']) && is_array($equipmentData['formatted_attributes'])) {
                $attributesRaw = $equipmentData['formatted_attributes'];
            } elseif (isset($equipmentData['attributes_raw']) && is_array($equipmentData['attributes_raw'])) {
                $attributesRaw = $equipmentData['attributes_raw'];
            } else {
                // Extract attributes from equipmentData (skip basic fields)
                $skipFields = ['id', 'category_id', 'categoryId', 'product_code', 'productCode', 'name', 'brand', 'image', 'video_link', 'price', 'stock', 'description', 'is_active', 'category', 'attributes', 'formatted_attributes', 'attributes_raw', 'pumpAccessories', 'pumpAccessory', 'created_at', 'updated_at'];
                $attributesRaw = [];
                foreach ($equipmentData as $key => $value) {
                    if (!in_array($key, $skipFields) && $value !== null && $value !== '') {
                        $attributesRaw[$key] = $value;
                    }
                }
            }
            
            // Transform to Product format for frontend
            // Map equipment data structure to match what freeProductDetail.tsx expects
            return Inertia::render('free-plan/freeProductDetail', [
                'product' => [
                    'id' => $equipmentData['id'],
                    'name' => $equipmentData['name'] ?? '',
                    'description' => $equipmentData['description'] ?? '',
                    'price' => (float) ($equipmentData['price'] ?? 0),
                    'image_url' => $equipmentData['image'] ?? null, // Already uses image_url accessor
                    'video_url' => $equipmentData['video_link'] ?? null,
                    'category' => 'recommended',
                    'product_code' => $equipmentData['product_code'] ?? $equipmentData['productCode'] ?? null,
                    'brand' => $equipmentData['brand'] ?? null,
                    // These come from getAttributesArray() via toCalculationFormat()
                    'waterVolumeLitersPerMinute' => $equipmentData['waterVolumeLitersPerMinute'] ?? null,
                    'radiusMeters' => $equipmentData['radiusMeters'] ?? null,
                    'pressureBar' => $equipmentData['pressureBar'] ?? null,
                    // Send all attributes for display
                    'attributes_raw' => $attributesRaw,
                    'stock' => $equipmentData['stock'] ?? null,
                    'created_at' => $equipment->created_at?->toDateTimeString(),
                    'updated_at' => $equipment->updated_at?->toDateTimeString(),
                ]
            ]);
        }
        
        // Not found as both Product and Equipment
        abort(404, 'Product or Equipment not found');
    }
}
