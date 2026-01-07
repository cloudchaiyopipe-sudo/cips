<?php
namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Product;
use App\Models\Equipment;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Support\Facades\DB;

class ProductAdminController extends Controller
{
    // อัปเดตราคา product "new" ให้ใช้ราคาเดิม (original_price) จาก promotion
    private function updateNewProductPrice(Product $product)
    {
        if ($product->category === 'new' && $product->equipment_id) {
            // ตรวจสอบว่ามี promotion อยู่แล้วหรือไม่
            $existingPromotion = Product::where('equipment_id', $product->equipment_id)
                ->where('category', 'promotion')
                ->where('id', '!=', $product->id)
                ->first();
            
            if ($existingPromotion && $existingPromotion->original_price) {
                // ถ้ามี promotion อยู่แล้ว ให้ใช้ original_price ของ promotion นั้น
                $product->update([
                    'price' => $existingPromotion->original_price,
                ]);
            } else {
                // ถ้าไม่มี promotion ให้ใช้ราคา equipment ปัจจุบัน
                $equipment = Equipment::find($product->equipment_id);
                if ($equipment) {
                    $product->update([
                        'price' => $equipment->price,
                    ]);
                }
            }
        }
    }

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
            'originalPrice' => 'nullable|numeric|min:0',
            'discount' => 'nullable|numeric|min:0|max:100',
            'discount_type' => 'nullable|in:percent,amount',
            'discount_amount' => 'nullable|numeric|min:0',
        ]);

        $data = $request->all();
        
        // แปลง originalPrice เป็น original_price (snake_case สำหรับ database)
        if (isset($data['originalPrice'])) {
            $data['original_price'] = $data['originalPrice'];
            unset($data['originalPrice']);
        }

        // ถ้าเป็นสินค้าโปรโมชัน ให้คำนวณราคาใหม่จาก original_price และ discount
        if ($data['category'] === 'promotion') {
            // ใช้ original_price ที่ส่งมาหรือใช้จาก product เดิม
            $originalPrice = isset($data['original_price']) && $data['original_price'] > 0 
                ? $data['original_price'] 
                : ($product->original_price ?? $product->price);
            
            // ถ้า original_price ยังไม่มี ให้ใช้ราคา equipment ปัจจุบัน
            if (!$originalPrice || $originalPrice <= 0) {
                if ($product->equipment_id) {
                    $equipment = Equipment::find($product->equipment_id);
                    if ($equipment) {
                        $originalPrice = $equipment->price;
                    }
                }
            }
            
            $finalPrice = $originalPrice;
            $discount = null;

            // คำนวณราคาจาก discount
            if (isset($data['discount_type'])) {
                if ($data['discount_type'] === 'amount' && isset($data['discount_amount']) && $data['discount_amount'] > 0) {
                    // ลดเป็นบาท
                    $discountAmount = $data['discount_amount'];
                    $finalPrice = max(0, $originalPrice - $discountAmount);
                    // คำนวณ % จากจำนวนเงินที่ลด
                    $discount = $originalPrice > 0 ? round(($discountAmount / $originalPrice) * 100, 2) : 0;
                } elseif ($data['discount_type'] === 'percent' && isset($data['discount']) && $data['discount'] > 0) {
                    // ลดเป็น %
                    $discount = $data['discount'];
                    $finalPrice = $originalPrice * (1 - $discount / 100);
                }
            } elseif (isset($data['discount']) && $data['discount'] > 0) {
                // ถ้าไม่มี discount_type แต่มี discount ให้ใช้เป็น %
                $discount = $data['discount'];
                $finalPrice = $originalPrice * (1 - $discount / 100);
            }

            $data['price'] = $finalPrice;
            $data['original_price'] = $originalPrice;
            $data['discount'] = $discount;
            
            // อัปเดตราคา equipment เป็นราคาหลังลด (ถ้ามี equipment_id)
            if ($product->equipment_id) {
                $equipment = Equipment::find($product->equipment_id);
                if ($equipment) {
                    $equipment->update(['price' => $finalPrice]);
                    // Refresh equipment เพื่อให้แน่ใจว่าข้อมูลถูกอัปเดต
                    $equipment->refresh();
                }
            }
        } elseif ($data['category'] !== 'promotion') {
            // ถ้าเปลี่ยนจากโปรโมชันเป็นอย่างอื่น ให้คืนราคา equipment กลับเป็น original_price
            if ($product->equipment_id && $product->original_price) {
                $equipment = Equipment::find($product->equipment_id);
                if ($equipment) {
                    $equipment->update(['price' => $product->original_price]);
                }
            }
            
            // ถ้าไม่ใช่โปรโมชัน ให้ลบ original_price และ discount
            $data['original_price'] = null;
            $data['discount'] = null;
        }

        // อัปเดตสินค้า
        $product->update($data);

        return redirect()->route('free.products')
                         ->with('success', 'สินค้าถูกแก้ไขเรียบร้อยแล้ว');
    }

    // ลบสินค้า
    public function destroy(Product $product)
    {
        // เมื่อลบสินค้าโปรโมชัน ให้คืนราคา equipment กลับเป็น original_price
        if ($product->category === 'promotion' && $product->equipment_id && $product->original_price) {
            $equipment = Equipment::find($product->equipment_id);
            if ($equipment) {
                // ตรวจสอบว่ามี product อื่นที่เป็น promotion สำหรับ equipment นี้หรือไม่
                $otherPromotionProduct = Product::where('equipment_id', $product->equipment_id)
                    ->where('category', 'promotion')
                    ->where('id', '!=', $product->id)
                    ->first();
                
                if ($otherPromotionProduct && $otherPromotionProduct->original_price) {
                    // ถ้ามี promotion อื่นอยู่ ให้ใช้ original_price ของ promotion นั้น
                    $equipment->update(['price' => $otherPromotionProduct->original_price]);
                } else {
                    // ถ้าไม่มี promotion อื่น ให้คืนราคา equipment กลับเป็น original_price
                    $equipment->update(['price' => $product->original_price]);
                }
            }
        }
        
        $product->delete();

        // ถ้ามาจากหน้า free-plan/products ให้ redirect กลับไปที่นั่น
        if (request()->header('Referer') && str_contains(request()->header('Referer'), '/free-plan/products')) {
            return redirect()->route('free.products')->with('success', 'สินค้าถูกลบเรียบร้อยแล้ว');
        }

        return redirect()->back()->with('success', 'สินค้าถูกลบเรียบร้อยแล้ว');
    }

    // สร้าง product จาก equipment (สำหรับสินค้าใหม่/โปรโมชัน)
    public function createFromEquipments(Request $request)
    {
        $request->validate([
            'equipment_ids' => 'required|array|min:1',
            'equipment_ids.*' => 'required|integer|exists:equipments,id',
            'category' => 'required|in:new,promotion',
            'discount' => 'nullable|numeric|min:0|max:100',
            'discount_amount' => 'nullable|numeric|min:0',
            'discount_type' => 'nullable|in:percent,amount',
            'original_price' => 'nullable|numeric|min:0',
        ]);

        try {
            DB::beginTransaction();

            $equipments = Equipment::whereIn('id', $request->equipment_ids)->get();
            $createdProducts = [];

            foreach ($equipments as $equipment) {
                // ตรวจสอบว่ามี product สำหรับ equipment นี้ใน category นี้แล้วหรือยัง
                $existingProduct = Product::where('equipment_id', $equipment->id)
                    ->where('category', $request->category)
                    ->first();

                // ตรวจสอบว่ามี promotion อยู่แล้วหรือไม่ (สำหรับทั้ง new และ promotion)
                // ถ้ามี promotion ให้ใช้ original_price ของ promotion นั้น, ถ้าไม่มี ให้ใช้ราคา equipment ปัจจุบัน
                $originalPrice = $equipment->price;
                $existingPromotion = Product::where('equipment_id', $equipment->id)
                    ->where('category', 'promotion')
                    ->where('id', '!=', $existingProduct?->id)
                    ->first();
                
                if ($existingPromotion && $existingPromotion->original_price) {
                    // ถ้ามี promotion อยู่แล้ว ให้ใช้ original_price ของ promotion นั้น
                    $originalPrice = $existingPromotion->original_price;
                } elseif ($existingProduct && $existingProduct->original_price) {
                    // ถ้ามี product นี้อยู่แล้วและมี original_price ให้ใช้ original_price นั้น
                    $originalPrice = $existingProduct->original_price;
                }
                // ถ้าไม่มี promotion อื่น ให้ใช้ราคา equipment ปัจจุบัน
                
                $finalPrice = $equipment->price;
                $discount = null;

                // คำนวณราคาและส่วนลดสำหรับสินค้าโปรโมชัน
                if ($request->category === 'promotion') {
                    if ($request->discount_type === 'amount' && $request->discount_amount) {
                        // ลดเป็นบาท
                        $discountAmount = $request->discount_amount;
                        $finalPrice = max(0, $originalPrice - $discountAmount);
                        // คำนวณ % จากจำนวนเงินที่ลด
                        $discount = $originalPrice > 0 ? round(($discountAmount / $originalPrice) * 100, 2) : 0;
                    } elseif ($request->discount_type === 'percent' && $request->discount) {
                        // ลดเป็น %
                        $discount = $request->discount;
                        $finalPrice = $originalPrice * (1 - $discount / 100);
                    }
                }

                if ($existingProduct) {
                    // สำหรับสินค้า "new" ให้ใช้ราคาเดิม (original_price) แทนราคา equipment ที่ถูกเปลี่ยนไปแล้ว
                    if ($request->category === 'new') {
                        $finalPrice = $originalPrice;
                    }
                    
                    // อัปเดต product ที่มีอยู่
                    $existingProduct->update([
                        'price' => $finalPrice,
                        'original_price' => $originalPrice,
                        'discount' => $discount,
                    ]);
                    
                    // ถ้าเป็นโปรโมชัน ให้อัปเดตราคา equipment เป็นราคาหลังลด
                    if ($request->category === 'promotion') {
                        $equipment->update(['price' => $finalPrice]);
                        // Refresh equipment เพื่อให้แน่ใจว่าข้อมูลถูกอัปเดต
                        $equipment->refresh();
                    }
                    
                    $createdProducts[] = $existingProduct;
                } else {
                    // สร้าง product ใหม่
                    // สำหรับสินค้า "new" ให้ใช้ราคาเดิม (original_price) แทนราคา equipment ที่ถูกเปลี่ยนไปแล้ว
                    if ($request->category === 'new') {
                        $finalPrice = $originalPrice;
                    }
                    
                    $product = Product::create([
                        'equipment_id' => $equipment->id,
                        'name' => $equipment->name,
                        'description' => $equipment->description ?? '',
                        'price' => $finalPrice,
                        'original_price' => $request->category === 'promotion' ? $originalPrice : null,
                        'category' => $request->category,
                        'discount' => $discount,
                        'image_url' => $equipment->image ?? null,
                        'video_url' => $equipment->video_link ?? null,
                    ]);
                    
                    // ถ้าเป็นโปรโมชัน ให้อัปเดตราคา equipment เป็นราคาหลังลด
                    if ($request->category === 'promotion') {
                        $equipment->update(['price' => $finalPrice]);
                        // Refresh equipment เพื่อให้แน่ใจว่าข้อมูลถูกอัปเดต
                        $equipment->refresh();
                    }
                    
                    $createdProducts[] = $product;
                }
            }

            DB::commit();

            return response()->json([
                'success' => true,
                'message' => 'สร้างสินค้าเรียบร้อยแล้ว',
                'products' => $createdProducts,
            ]);
        } catch (\Exception $e) {
            DB::rollBack();
            return response()->json([
                'success' => false,
                'message' => 'เกิดข้อผิดพลาด: ' . $e->getMessage(),
            ], 500);
        }
    }
}
