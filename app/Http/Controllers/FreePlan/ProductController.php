<?php
namespace App\Http\Controllers\FreePlan;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Equipment;
use Inertia\Inertia;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Exception;

class ProductController extends Controller
{
    public function index()
    {
        try {
            // 4. ดึงสินค้าทั้งหมดจาก DB และแปลงข้อมูลให้ตรงกับ frontend
            $products = Product::orderBy('created_at', 'desc')->get()->map(function ($product) {
            // สำหรับสินค้าที่มี equipment_id ให้ตรวจสอบว่ามี promotion อยู่แล้วหรือไม่
            // ถ้ามี ให้ใช้ราคา equipment ที่ถูกอัปเดต (ราคาหลังลด) และแสดง original_price เป็นราคาเดิม
            $displayPrice = (float) $product->price;
            $originalPrice = $product->original_price ? (float) $product->original_price : null;
            $discount = $product->discount && $product->discount > 0 ? $product->discount : null;
            
            $productCode = null;
            if ($product->equipment_id) {
                $equipment = Equipment::find($product->equipment_id);
                if ($equipment) {
                    // ดึง product_code จาก equipment
                    $productCode = $equipment->product_code ?? null;
                    
                    // ตรวจสอบว่ามี promotion อยู่แล้วหรือไม่
                    $existingPromotion = Product::where('equipment_id', $product->equipment_id)
                        ->where('category', 'promotion')
                        ->where('id', '!=', $product->id)
                        ->first();
                    
                    if ($existingPromotion && $existingPromotion->original_price) {
                        // ถ้ามี promotion อยู่แล้ว:
                        // - ใช้ราคา equipment ที่ถูกอัปเดต (ราคาหลังลด) เป็นราคาแสดง
                        // - ใช้ original_price ของ promotion เป็นราคาเดิม
                        $displayPrice = (float) $equipment->price; // ราคาหลังลด
                        $originalPrice = (float) $existingPromotion->original_price; // ราคาเดิม
                        $discount = $existingPromotion->discount && $existingPromotion->discount > 0 
                            ? $existingPromotion->discount 
                            : null;
                    } else {
                        // ถ้าไม่มี promotion ให้ใช้ราคา equipment ปัจจุบัน
                        $displayPrice = (float) $equipment->price;
                    }
                }
            }
            
            return [
                'id' => $product->id,
                'name' => $product->name,
                'description' => $product->description,
                'price' => $displayPrice,
                'originalPrice' => $originalPrice,
                'image_url' => $product->image_url ?? '/images/no-image.jpg',
                'video_url' => $product->video_url ?? null,
                'category' => $product->category,
                'discount' => $discount,
                'equipment_id' => $product->equipment_id,
                'product_code' => $productCode,
                'isNew' => $product->category === 'new',
                'isPromotion' => $product->category === 'promotion',
                'isRecommended' => $product->category === 'recommended',
            ];
            });

            // 5. ส่ง 'products' ไปเป็น Props
            return Inertia::render('free-plan/productList', [
                'products' => $products 
            ]);
        } catch (Exception $e) {
            Log::error('ProductController::index error', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);
            
            // Return empty products on error instead of crashing
            return Inertia::render('free-plan/productList', [
                'products' => []
            ]);
        }
    }

    // หน้า FreeProductDetail.tsx - รองรับทั้ง Product และ Equipment (Sprinkler)
    public function show(Request $request, $id)
    {
        // Try to find as Product first
        $product = Product::find($id);
        
        if ($product) {
            // สำหรับสินค้าที่มี equipment_id ให้ตรวจสอบว่ามี promotion อยู่แล้วหรือไม่
            // ถ้ามี ให้ใช้ราคา equipment ที่ถูกอัปเดต (ราคาหลังลด) และแสดง original_price เป็นราคาเดิม
            $displayPrice = (float) $product->price;
            $originalPrice = $product->original_price ? (float) $product->original_price : null;
            $discount = $product->discount && $product->discount > 0 ? $product->discount : null;
            $equipmentData = null;
            $attributesRaw = null;
            
            if ($product->equipment_id) {
                $equipment = Equipment::with(['category', 'attributeValues.attribute'])->find($product->equipment_id);
                if ($equipment) {
                    // ใช้ toCalculationFormat() เพื่อดึงข้อมูล equipment รวมถึง attributes
                    $equipmentData = $equipment->toCalculationFormat();
                    
                    // ตรวจสอบว่ามี promotion อยู่แล้วหรือไม่
                    $existingPromotion = Product::where('equipment_id', $product->equipment_id)
                        ->where('category', 'promotion')
                        ->where('id', '!=', $product->id)
                        ->first();
                    
                    if ($existingPromotion && $existingPromotion->original_price) {
                        // ถ้ามี promotion อยู่แล้ว:
                        // - ใช้ราคา equipment ที่ถูกอัปเดต (ราคาหลังลด) เป็นราคาแสดง
                        // - ใช้ original_price ของ promotion เป็นราคาเดิม
                        $displayPrice = (float) $equipment->price; // ราคาหลังลด
                        $originalPrice = (float) $existingPromotion->original_price; // ราคาเดิม
                        $discount = $existingPromotion->discount && $existingPromotion->discount > 0 
                            ? $existingPromotion->discount 
                            : null;
                    } else {
                        // ถ้าไม่มี promotion ให้ใช้ราคา equipment ปัจจุบัน
                        $displayPrice = (float) $equipment->price;
                    }
                    
                    // Get all attributes for display
                    // Try formatted_attributes first, then attributes_raw, then extract from equipmentData
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
                }
            }
            
            // Found as Product, return with equipment attributes if available
            $productData = [
                'id' => $product->id,
                'name' => $product->name,
                'description' => $product->description,
                'price' => $displayPrice,
                'originalPrice' => $originalPrice,
                'image_url' => $product->image_url ?? null,
                'video_url' => $product->video_url ?? null,
                'category' => $product->category,
                'discount' => $discount,
                'created_at' => $product->created_at?->toDateTimeString(),
                'updated_at' => $product->updated_at?->toDateTimeString(),
            ];
            
            // Add equipment-related fields if equipment exists
            if ($equipmentData) {
                $productData['product_code'] = $equipmentData['product_code'] ?? $equipmentData['productCode'] ?? null;
                $productData['brand'] = $equipmentData['brand'] ?? null;
                $productData['waterVolumeLitersPerMinute'] = $equipmentData['waterVolumeLitersPerMinute'] ?? null;
                $productData['radiusMeters'] = $equipmentData['radiusMeters'] ?? null;
                $productData['pressureBar'] = $equipmentData['pressureBar'] ?? null;
                $productData['attributes_raw'] = $attributesRaw;
                $productData['stock'] = $equipmentData['stock'] ?? null;
            }
            
            return Inertia::render('free-plan/freeProductDetail', [
                'product' => $productData
            ]);
        }
        
        // If not found as Product, try to find as Equipment (for sprinklers)
        $equipment = Equipment::with(['category', 'attributeValues.attribute'])->find($id);
        
        if ($equipment) {
            // Use toCalculationFormat() to get all equipment data including attributes
            // This method automatically includes all attribute values like waterVolumeLitersPerMinute, radiusMeters, pressureBar
            $equipmentData = $equipment->toCalculationFormat();
            
            // ตรวจสอบว่ามี promotion อยู่แล้วหรือไม่
            $displayPrice = (float) ($equipmentData['price'] ?? 0);
            $originalPrice = null;
            $discount = null;
            
            $existingPromotion = Product::where('equipment_id', $equipment->id)
                ->where('category', 'promotion')
                ->first();
            
            if ($existingPromotion && $existingPromotion->original_price) {
                // ถ้ามี promotion อยู่แล้ว:
                // - ใช้ราคา equipment ที่ถูกอัปเดต (ราคาหลังลด) เป็นราคาแสดง
                // - ใช้ original_price ของ promotion เป็นราคาเดิม
                $displayPrice = (float) $equipment->price; // ราคาหลังลด
                $originalPrice = (float) $existingPromotion->original_price; // ราคาเดิม
                $discount = $existingPromotion->discount && $existingPromotion->discount > 0 
                    ? $existingPromotion->discount 
                    : null;
            }
            
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
                    'price' => $displayPrice,
                    'originalPrice' => $originalPrice,
                    'image_url' => $equipmentData['image'] ?? null, // Already uses image_url accessor
                    'video_url' => $equipmentData['video_link'] ?? null,
                    'category' => 'recommended',
                    'discount' => $discount,
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
    
    // API endpoint สำหรับ fetch promotions
    public function getPromotions()
    {
        $products = Product::where('category', 'promotion')
            ->whereNotNull('equipment_id')
            ->whereNotNull('original_price')
            ->get(['id', 'equipment_id', 'original_price']);
        
        $promotions = $products->map(function ($product) {
            return [
                'equipment_id' => $product->equipment_id,
                'originalPrice' => (float) $product->original_price,
            ];
        });
        
        return response()->json(['promotions' => $promotions]);
    }

    // API endpoint สำหรับ landing page - ดึงสินค้าใหม่, โปรโมชั่น, และแนะนำ (ไม่ต้อง auth)
    public function getLandingProducts()
    {
        try {
            $products = Product::whereIn('category', ['new', 'promotion', 'recommended'])
                ->orderBy('created_at', 'desc')
                ->limit(10)
                ->get()
                ->map(function ($product) {
                    $displayPrice = (float) $product->price;
                    $originalPrice = $product->original_price ? (float) $product->original_price : null;
                    $discount = $product->discount && $product->discount > 0 ? $product->discount : null;

                    if ($product->equipment_id) {
                        $equipment = Equipment::find($product->equipment_id);
                        if ($equipment) {
                            $existingPromotion = Product::where('equipment_id', $product->equipment_id)
                                ->where('category', 'promotion')
                                ->where('id', '!=', $product->id)
                                ->first();

                            if ($existingPromotion && $existingPromotion->original_price) {
                                $displayPrice = (float) $equipment->price;
                                $originalPrice = (float) $existingPromotion->original_price;
                                $discount = $existingPromotion->discount && $existingPromotion->discount > 0 
                                    ? $existingPromotion->discount 
                                    : null;
                            } else {
                                $displayPrice = (float) $equipment->price;
                            }
                        }
                    }

                    return [
                        'id' => $product->id,
                        'name' => $product->name,
                        'description' => $product->description,
                        'price' => $displayPrice,
                        'originalPrice' => $originalPrice,
                        'image_url' => $product->image_url ?? '/images/no-image.jpg',
                        'video_url' => $product->video_url ?? null,
                        'category' => $product->category,
                        'discount' => $discount,
                        'equipment_id' => $product->equipment_id,
                        'isNew' => $product->category === 'new',
                        'isPromotion' => $product->category === 'promotion',
                        'isRecommended' => $product->category === 'recommended',
                    ];
                });

            return response()->json(['products' => $products]);
        } catch (Exception $e) {
            Log::error('ProductController::getLandingProducts error', [
                'message' => $e->getMessage(),
            ]);
            
            return response()->json(['products' => []], 500);
        }
    }
}
