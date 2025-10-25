<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\ChaiyoAiChatController; // Updated controller name
use App\Http\Controllers\FarmController;
use App\Http\Controllers\HomeGardenController;
use App\Http\Controllers\Api\SprinklerController;
use App\Http\Controllers\Api\EquipmentCategoryController;
use App\Http\Controllers\Api\EquipmentController;
use App\Http\Controllers\Api\TokenController;
use App\Http\Controllers\ProfilePhotoController;

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Here is where you can register API routes for your application. These
| routes are loaded by the RouteServiceProvider and all of them will
| be assigned to the "api" middleware group. Make something great!
|
*/

// User info endpoint for API (works with web auth)
Route::middleware(['web', 'auth'])->get('/user', function (Request $request) {
    return $request->user();
});

// Test authentication endpoint
Route::middleware(['web', 'auth'])->get('/test-auth', function (Request $request) {
    return response()->json([
        'success' => true,
        'user' => $request->user(),
        'session_id' => session()->getId(),
        'auth_check' => Auth::check()
    ]);
});

// ==================================================
// 📢 ADVERTISEMENT ROUTES
// ==================================================

// Public advertisements (for free plan homepage)
Route::get('/advertisements/public', function () {
    try {
        $advertisements = \App\Models\Advertisement::where('is_active', true)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'advertisements' => $advertisements->map(function ($ad) {
                return [
                    'id' => $ad->id,
                    'title' => $ad->title,
                    'description' => $ad->description,
                    'image_url' => $ad->image_url,
                    'link_url' => $ad->link_url,
                    'is_active' => $ad->is_active,
                    'created_at' => $ad->created_at,
                ];
            })
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'Error loading advertisements: ' . $e->getMessage()
        ], 500);
    }
});

// User's advertisements (authenticated)
Route::middleware(['web', 'auth'])->group(function () {
    // Get user's advertisements
    Route::get('/advertisements', function () {
        try {
            $user = auth()->user();
            $advertisements = \App\Models\Advertisement::where('user_id', $user->id)
                ->orderBy('created_at', 'desc')
                ->get();

            return response()->json([
                'success' => true,
                'advertisements' => $advertisements
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error loading advertisements: ' . $e->getMessage()
            ], 500);
        }
    });

    // Create new advertisement
    Route::post('/advertisements', function (\Illuminate\Http\Request $request) {
        try {
            $user = auth()->user();
            
            $validated = $request->validate([
                'title' => 'required|string|max:255',
                'description' => 'required|string|max:1000',
                'link_url' => 'required|url|max:500',
                'image' => 'required|image|mimes:jpeg,png,jpg,gif|max:5120', // 5MB max
            ]);

            // Handle image upload
            if ($request->hasFile('image')) {
                $image = $request->file('image');
                $imageName = time() . '_' . $user->id . '.' . $image->getClientOriginalExtension();
                $imagePath = $image->storeAs('advertisements', $imageName, 'public');
                $imageUrl = asset('storage/' . $imagePath);
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Image is required'
                ], 400);
            }

            $advertisement = \App\Models\Advertisement::create([
                'user_id' => $user->id,
                'title' => $validated['title'],
                'description' => $validated['description'],
                'link_url' => $validated['link_url'],
                'image_url' => $imageUrl,
                'is_active' => true,
            ]);

            return response()->json([
                'success' => true,
                'message' => 'Advertisement created successfully',
                'advertisement' => $advertisement
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error creating advertisement: ' . $e->getMessage()
            ], 500);
        }
    });

    // Update advertisement
    Route::put('/advertisements/{id}', function (\Illuminate\Http\Request $request, $id) {
        try {
            $user = auth()->user();
            $advertisement = \App\Models\Advertisement::where('user_id', $user->id)
                ->findOrFail($id);

            $validated = $request->validate([
                'title' => 'sometimes|string|max:255',
                'description' => 'sometimes|string|max:1000',
                'link_url' => 'sometimes|url|max:500',
                'is_active' => 'sometimes|boolean',
                'image' => 'sometimes|image|mimes:jpeg,png,jpg,gif|max:5120',
            ]);

            // Handle image update
            if ($request->hasFile('image')) {
                // Delete old image
                if ($advertisement->image_url) {
                    $oldImagePath = str_replace(asset('storage/'), '', $advertisement->image_url);
                    \Storage::disk('public')->delete($oldImagePath);
                }

                $image = $request->file('image');
                $imageName = time() . '_' . $user->id . '.' . $image->getClientOriginalExtension();
                $imagePath = $image->storeAs('advertisements', $imageName, 'public');
                $validated['image_url'] = asset('storage/' . $imagePath);
            }

            $advertisement->update($validated);

            return response()->json([
                'success' => true,
                'message' => 'Advertisement updated successfully',
                'advertisement' => $advertisement
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error updating advertisement: ' . $e->getMessage()
            ], 500);
        }
    });

    // Delete advertisement
    Route::delete('/advertisements/{id}', function ($id) {
        try {
            $user = auth()->user();
            $advertisement = \App\Models\Advertisement::where('user_id', $user->id)
                ->findOrFail($id);

            // Delete image file
            if ($advertisement->image_url) {
                $imagePath = str_replace(asset('storage/'), '', $advertisement->image_url);
                \Storage::disk('public')->delete($imagePath);
            }

            $advertisement->delete();

            return response()->json([
                'success' => true,
                'message' => 'Advertisement deleted successfully'
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Error deleting advertisement: ' . $e->getMessage()
            ], 500);
        }
    });
});

// ==================================================
// 🤖 CHAIYO AI ROUTES (Enhanced Company Representative)
// ==================================================

// Main ChaiyoAI Chat Endpoint (consumes 2 tokens per chat)
Route::post('/ai-chat', [ChaiyoAiChatController::class, 'handleChat'])->middleware('consume.tokens:2');

// ChaiyoAI Management & Info Routes
Route::prefix('ai')->group(function () {
    Route::get('/stats', [ChaiyoAiChatController::class, 'getStats']);
    Route::get('/popular-questions', [ChaiyoAiChatController::class, 'getPopularQuestions']);
    Route::get('/health', [ChaiyoAiChatController::class, 'health']);
    Route::post('/test', [ChaiyoAiChatController::class, 'test']);
    
    // Company-specific endpoints
    Route::get('/company-info', [ChaiyoAiChatController::class, 'getCompanyInfo']);
    Route::post('/product-recommendations', [ChaiyoAiChatController::class, 'getProductRecommendations']);
});

// Legacy compatibility routes (for backward compatibility)
Route::get('/ai-training-stats', [ChaiyoAiChatController::class, 'getStats']);

// ==================================================
// 🛠️ EQUIPMENT & PRODUCT ROUTES (รวมแล้ว)
// ==================================================

// Equipment validation - วางไว้ก่อน apiResource
Route::get('/equipments/validate-product-code', [EquipmentController::class, 'validateProductCode']);
Route::get('/equipments/pump-equipments', [EquipmentController::class, 'getPumpEquipments']);
Route::get('/equipments/stats', [EquipmentController::class, 'getStats']);

// Equipment Categories
Route::apiResource('equipment-categories', EquipmentCategoryController::class);

// Equipment Management (รวม PumpAccessory + ImageUpload แล้ว)
Route::apiResource('equipments', EquipmentController::class);

// Equipment additional routes
Route::prefix('equipments')->group(function () {
    Route::post('search', [EquipmentController::class, 'search']);
    Route::get('by-category/{categoryName}', [EquipmentController::class, 'getByCategory']);
    Route::get('by-category-id/{id}', [EquipmentController::class, 'getByCategoryId']);
    Route::post('bulk-update', [EquipmentController::class, 'bulkUpdate']);
    Route::post('bulk-delete', [EquipmentController::class, 'bulkDelete']);
    
    // 🔧 Pump Accessories (รวมใน EquipmentController แล้ว)
    Route::get('pump-accessories', [EquipmentController::class, 'getPumpAccessories']);
    Route::post('pump-accessories', [EquipmentController::class, 'storePumpAccessory']);
    Route::get('pump-accessories/{pumpAccessory}', [EquipmentController::class, 'showPumpAccessory']);
    Route::put('pump-accessories/{pumpAccessory}', [EquipmentController::class, 'updatePumpAccessory']);
    Route::delete('pump-accessories/{pumpAccessory}', [EquipmentController::class, 'destroyPumpAccessory']);
    Route::get('pump/{pumpId}/accessories', [EquipmentController::class, 'getAccessoriesByPump']);
    Route::post('accessories/sort-order', [EquipmentController::class, 'updateAccessoriesSortOrder']);
    Route::post('accessories/bulk-delete', [EquipmentController::class, 'bulkDeleteAccessories']);
    Route::get('accessories/stats', [EquipmentController::class, 'getAccessoryStats']);
    
    // 📸 Image Management (รวมใน EquipmentController แล้ว)
    Route::post('upload-image', [EquipmentController::class, 'uploadImage']);
    Route::post('upload-multiple-images', [EquipmentController::class, 'uploadMultipleImages']);
    Route::delete('delete-image', [EquipmentController::class, 'deleteImage']);
    Route::get('image-info', [EquipmentController::class, 'getImageInfo']);
    Route::get('list-images', [EquipmentController::class, 'listImages']);
    Route::get('check-storage', [EquipmentController::class, 'checkStorageInfo']);
});

// ==================================================
// 📦 EQUIPMENT SETS ROUTES
// ==================================================

use App\Http\Controllers\Api\EquipmentSetController;

// Equipment Sets API Resource
Route::apiResource('equipment-sets', EquipmentSetController::class);

// Equipment Sets additional routes
Route::prefix('equipment-sets')->group(function () {
    Route::get('stats', [EquipmentSetController::class, 'stats']);
    Route::get('by-name/{name}', [EquipmentSetController::class, 'getByName']);
    Route::post('{equipmentSet}/duplicate', [EquipmentSetController::class, 'duplicate']);
    Route::patch('{equipmentSet}/toggle-status', [EquipmentSetController::class, 'toggleStatus']);
});

// ==================================================
// 📸 IMAGE MANAGEMENT ROUTES (Backward Compatibility)
// ==================================================
// เก็บ backward compatibility สำหรับ frontend ที่อาจใช้ /api/images/*
Route::prefix('images')->group(function () {
    Route::post('upload', [EquipmentController::class, 'uploadImage']);
    Route::post('upload-multiple', [EquipmentController::class, 'uploadMultipleImages']);
    Route::delete('delete', [EquipmentController::class, 'deleteImage']);
    Route::get('info', [EquipmentController::class, 'getImageInfo']);
    Route::get('/', [EquipmentController::class, 'listImages']);
    Route::get('check-storage', [EquipmentController::class, 'checkStorageInfo']);
});

// ==================================================
// 🔧 PUMP ACCESSORIES ROUTES (Backward Compatibility)
// ==================================================
// เก็บ backward compatibility สำหรับ frontend ที่อาจใช้ /api/pump-accessories
Route::prefix('pump-accessories')->group(function () {
    Route::get('/', [EquipmentController::class, 'getPumpAccessories']);
    Route::post('/', [EquipmentController::class, 'storePumpAccessory']);
    Route::get('{pumpAccessory}', [EquipmentController::class, 'showPumpAccessory']);
    Route::put('{pumpAccessory}', [EquipmentController::class, 'updatePumpAccessory']);
    Route::delete('{pumpAccessory}', [EquipmentController::class, 'destroyPumpAccessory']);
    Route::post('sort-order', [EquipmentController::class, 'updateAccessoriesSortOrder']);
    Route::post('bulk-delete', [EquipmentController::class, 'bulkDeleteAccessories']);
    Route::get('stats', [EquipmentController::class, 'getAccessoryStats']);
});

// Sprinkler specific routes
Route::get('/sprinklers-data', [SprinklerController::class, 'index']); // เปลี่ยนชื่อเพื่อไม่ conflict
Route::post('/calculate-pipe-layout', [SprinklerController::class, 'calculatePipeLayout']);

// Quick equipment access routes
Route::get('/sprinklers', fn() => app(EquipmentController::class)->getByCategory('sprinkler'));
Route::get('/pumps', fn() => app(EquipmentController::class)->getByCategory('pump'));
Route::get('/pipes', fn() => app(EquipmentController::class)->getByCategory('pipe'));

// ==================================================
// 🌱 FARM PLANNING & MANAGEMENT ROUTES
// ==================================================

// Public Farm & Planner API Routes (No authentication required)
Route::post('/generate-planting-points', [FarmController::class, 'generatePlantingPoints'])->middleware('consume.tokens:2'); // Generating planting points costs 2 tokens
Route::post('/generate-pipe-layout', [FarmController::class, 'generatePipeLayout'])->middleware('consume.tokens:5'); // Generating pipe layouts costs 5 tokens
Route::get('/plant-types', [FarmController::class, 'getPlantTypes']);
Route::post('/get-elevation', [FarmController::class, 'getElevation'])->middleware('consume.tokens:1'); // Getting elevation data costs 1 token

// Plant points management (No authentication required for now)
Route::post('/plant-points/add', [FarmController::class, 'addPlantPoint']);
Route::post('/plant-points/delete', [FarmController::class, 'deletePlantPoint']);
Route::post('/plant-points/move', [FarmController::class, 'movePlantPoint']);

// Field Management API Routes - Use web authentication (same as Inertia)
Route::middleware(['web', 'auth'])->group(function () {
    Route::get('/fields', [FarmController::class, 'getFields']);
    Route::get('/fields/{fieldId}', [FarmController::class, 'getField']);
    Route::post('/save-field', [FarmController::class, 'saveField'])->middleware('consume.tokens:3'); // Creating fields costs 3 tokens
    Route::put('/fields/{fieldId}', [FarmController::class, 'updateField'])->middleware('consume.tokens:1'); // Updating fields costs 1 token
    Route::put('/fields/{fieldId}/data', [FarmController::class, 'updateFieldData'])->middleware('consume.tokens:1');
    Route::delete('/fields/{fieldId}', [FarmController::class, 'deleteField']);

    // Field Status Management
    Route::put('/fields/{fieldId}/status', [FarmController::class, 'updateFieldStatus']);
    Route::put('/fields/{fieldId}/folder', [FarmController::class, 'updateFieldFolder']);
});

// Test route to check if routes are working
Route::get('/test', function () {
    return response()->json(['message' => 'API is working']);
});

// Test folders route with closure
Route::get('/folders-test', function () {
    return response()->json([
        'success' => true,
        'folders' => [
            [
                'id' => 'temp-finished',
                'name' => 'Finished',
                'type' => 'finished',
                'color' => '#10b981',
                'icon' => '✅',
                'parent_id' => null,
                'field_count' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'id' => 'temp-unfinished',
                'name' => 'Unfinished',
                'type' => 'unfinished',
                'color' => '#f59e0b',
                'icon' => '⏳',
                'parent_id' => null,
                'field_count' => 0,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]
    ]);
});

// ==================================================
// 🏡 HOME GARDEN ROUTES
// ==================================================

Route::prefix('home-garden')->group(function () {
    Route::post('generate-sprinkler-layout', [HomeGardenController::class, 'generateSprinklerLayout']);
    Route::post('generate-pipe-layout', [HomeGardenController::class, 'generatePipeLayout']);
});

// ==================================================
// 📸 PROFILE PHOTO ROUTES
// ==================================================

// Profile Photo Routes - Use web authentication
Route::middleware(['web', 'auth'])->group(function () {
    Route::post('/profile-photo/upload', [ProfilePhotoController::class, 'upload']);
    Route::delete('/profile-photo/delete', [ProfilePhotoController::class, 'delete']);
});

// ==================================================
// ℹ️ SYSTEM INFORMATION ROUTES
// ==================================================

// System health check
Route::get('/health', function () {
    return response()->json([
        'status' => 'healthy',
        'timestamp' => now(),
        'version' => '3.0.0',
        'type' => 'ChaiyoAI Enhanced',
        'environment' => app()->environment(),
        'services' => [
            'chaiyo_ai' => 'operational',
            'database' => 'connected',
            'storage' => 'available',
            'company_knowledge' => 'loaded'
        ],
        'ai_identity' => 'ChaiyoAI',
        'supported_companies' => [
            'chaiyo_pipe_fitting' => 'บริษัท ไชโยไปป์แอนด์ฟิตติ้ง จำกัด',
            'kanok_product' => 'บริษัท กนกส์โปรดัก จำกัด'
        ]
    ]);
});

// System information
Route::get('/info', function () {
    return response()->json([
        'app_name' => config('app.name'),
        'version' => '3.0.0',
        'api_version' => 'v3',
        'type' => 'ChaiyoAI - Enhanced Company Representative System',
        'ai_identity' => 'ChaiyoAI',
        'description' => 'Complete Waterapp + ChaiyoAI (Enhanced with Company Knowledge)',
        'features' => [
            'chaiyo_ai_chat' => true,
            'company_information' => true,
            'product_consultation' => true,
            'irrigation_expertise' => true,
            'farm_planning' => true,
            'home_garden' => true,
            'equipment_catalog' => true,
            'image_management' => true,
            'field_management' => true,
            'sprinkler_calculation' => true,
            'multilingual_support' => true,
            'context_awareness' => true,
            'knowledge_base' => false,
            'pdf_processing' => false,
            'web_scraping' => false,
        ],
        'ai_capabilities' => [
            'general_conversation' => 'สนทนาทั่วไป',
            'company_information' => 'ข้อมูลบริษัททั้ง 2 แห่ง',
            'product_consultation' => 'คำปรึกษาผลิตภัณฑ์',
            'irrigation_expertise' => 'ความเชี่ยวชาญด้านระบบน้ำ',
            'technical_support' => 'การสนับสนุนทางเทคนิค',
            'customer_service' => 'บริการลูกค้า'
        ],
        'supported_companies' => [
            'chaiyo_pipe_fitting' => [
                'name' => 'บริษัท ไชโยไปป์แอนด์ฟิตติ้ง จำกัด',
                'founded' => '2551 (17 ปี)',
                'specializes' => 'ผลิตภัณฑ์พลาสติกเพื่อการเกษตร',
                'brands' => ['RED HAND', 'CHAIYO', 'CHAMP']
            ],
            'kanok_product' => [
                'name' => 'บริษัท กนกส์โปรดัก จำกัด',
                'founded' => '2541 (27 ปี)',
                'specializes' => 'ระบบน้ำเพื่อการเกษตรและชลประทาน',
                'products' => '6,000+ รายการ',
                'brands' => ['KANOK', 'RED HAND', 'CHAIYO']
            ]
        ],
        'endpoints' => [
            'chaiyo_ai_chat' => '/api/ai-chat',
            'company_info' => '/api/ai/company-info',
            'product_recommendations' => '/api/ai/product-recommendations',
            'equipment' => '/api/equipments (รวม PumpAccessory + ImageUpload)',
            'farm_planning' => '/api/generate-pipe-layout',
            'field_management' => '/api/fields',
            'image_upload' => '/api/equipments/upload-image หรือ /api/images/upload',
            'pump_accessories' => '/api/equipments/pump-accessories หรือ /api/pump-accessories',
            'health_check' => '/api/health',
            'ai_stats' => '/api/ai/stats',
            'popular_questions' => '/api/ai/popular-questions'
        ],
        'backward_compatibility' => [
            '/api/images/* => /api/equipments/*',
            '/api/pump-accessories => /api/equipments/pump-accessories',
            'All old endpoints still work!',
            'Added new ChaiyoAI-specific endpoints'
        ],
        'contact_info' => [
            'chaiyo_phone' => '02-451-1111',
            'chaiyo_website' => 'www.chaiyopipe.co.th',
            'kanok_website' => 'www.kanokgroup.com',
            'email' => 'chaiyopipeonline@gmail.com'
        ]
    ]);
});

// ==================================================
// 🏢 COMPANY INFORMATION ROUTES
// ==================================================

// Public company information endpoints
Route::prefix('company')->group(function () {
    Route::get('/chaiyo-pipe-fitting', function () {
        return response()->json([
            'company_name' => 'บริษัท ไชโยไปป์แอนด์ฟิตติ้ง จำกัด',
            'english_name' => 'Chaiyo Pipe & Fitting Co., Ltd.',
            'registration_number' => '0105551062871',
            'founded_date' => '13 มิถุนายน 2551',
            'years_in_operation' => '17 ปี',
            'capital' => '35,000,000 บาท',
            'address' => '71/6 หมู่ที่ 1 ตำบลคอกกระบือ อำเภอเมืองสมุทรสาคร จังหวัดสมุทรสาคร 74000',
            'business_type' => 'การผลิตผลิตภัณฑ์พลาสติกเพื่อการเกษตรทุกชนิด',
            'relationship' => 'บริษัทในเครือของ บริษัท กนกส์โปรดัก จำกัด',
            'contact' => [
                'phone' => ['065-9404230', '065-9404231', '02-451-1111'],
                'website_main' => 'www.kanokgroup.com (ช่องทางหลัก)',
                'email' => 'chaiyopipeonline@gmail.com',
                'note' => 'ติดต่อผ่านบริษัทกนกส์โปรดัก เป็นช่องทางหลัก'
            ]
        ]);
    });

    Route::get('/kanok-product', function () {
        return response()->json([
            'company_name' => 'บริษัท กนกส์โปรดัก จำกัด',
            'english_name' => 'Kanok Product Co., Ltd.',
            'registration_number' => '0105549044446',
            'founded_date' => 'พ.ศ. 2541 (1998)',
            'experience' => 'มากกว่า 27 ปี',
            'managing_director' => 'คุณโผล์กฤษณ์ กนกสินปิณโย',
            'address' => '15-23 ซอยพระยามนธาตุฯ แยก 10 ถนนบางขุนเทียน แขวงคลองบางบอน เขตบางบอน กรุงเทพมหานคร 10150',
            'business_type' => 'ผู้ผลิต ส่งออก และจัดจำหน่ายระบบน้ำเพื่อการเกษตรและระบบชลประทาน',
            'products_count' => 'มากกว่า 6,000-9,000 รายการ',
            'target_revenue' => 'มากกว่า 600 ล้านบาท ต่อปี',
            'contact' => [
                'phone' => '02-451-1111',
                'websites' => ['www.kanokgroup.com', 'www.kanokproduct.com'],
                'mobile' => '098-286-0809'
            ]
        ]);
    });

    Route::get('/products', function () {
        return response()->json([
            'main_categories' => [
                'ท่อและข้อต่อ PVC' => 'ได้รับมาตรฐาน มอก. 1131-2535',
                'ท่อ PE และ HDPE' => 'สำหรับระบบน้ำการเกษตร',
                'ระบบน้ำหยด' => 'สเปรย์เทป, ดริปเทป',
                'หัวสปริงเกอร์' => 'มินิสปริงเกอร์และสปริงเกอร์',
                'วาล์วและอุปกรณ์' => 'ฟุตวาล์ว, เช็ควาล์ว, บอลวาล์ว (ทนแรงดันถึง 13.5 บาร์)',
                'อุปกรณ์ประปา' => 'ปั๊มน้ำและอะไหล่'
            ],
            'brands' => [
                'RED HAND (ตรามือแดง)' => 'แบรนด์หลักสำหรับท่อและข้อต่อ PVC',
                'CHAIYO (ไชโย)' => 'ผลิตภัณฑ์เกษตรและระบบน้ำ',
                'CHAMP (แชมป์)' => 'สายผลิตภัณฑ์เสริม',
                'KANOK' => 'ผลิตภัณฑ์จากบริษัทกนกส์โปรดัก'
            ],
            'certifications' => [
                'ISO 9001:2015',
                'มาตรฐาน มอก.',
                'Bureau Veritas Certification',
                'UV Protection Technology'
            ]
        ]);
    });

    Route::get('/contact', function () {
        return response()->json([
            'chaiyo_pipe_fitting' => [
                'phones' => ['065-9404230', '065-9404231', '089-9892211', '086-3107020', '066-1549-5974', '02-451-1111'],
                'fax' => '02-416-3011',
                'emails' => ['chaiyopipeonline@gmail.com', 'chayut@kanokproduct.com'],
                'website' => 'www.chaiyopipe.co.th',
                'line_id' => 'chayut.tee'
            ],
            'kanok_product' => [
                'phone_main' => '02-451-1111',
                'phone_product_inquiry' => 'กด 2 สำหรับสอบถามผลิตภัณฑ์',
                'extensions' => 'ต่อ 103-136, 185-187',
                'mobile' => '098-286-0809',
                'websites' => ['www.kanokgroup.com', 'www.kanokproduct.com', 'shop.kanokproduct.com']
            ],
            'social_media' => [
                'facebook_chaiyo' => 'Red hand ท่อ PVC (2,850+ ผู้ติดตาม)',
                'facebook_kanok' => 'kanokproduct (42,541+ ผู้ติดตาม)',
                'lazada' => 'lazada.co.th/shop/kanok-product'
            ]
        ]);
    });
});

// ==================================================
// 🐛 DEBUG ROUTES (Only in development)
// ==================================================

if (app()->environment('local')) {
    Route::prefix('debug')->group(function () {
        
        // Test ChaiyoAI Service
        Route::post('/chaiyo-ai-test', function (Request $request) {
            try {
                $message = $request->input('message', 'สวัสดี บริษัทไชโยมีสินค้าอะไรบ้าง');
                $service = new \App\Services\ChaiyoAiService();
                $response = $service->generateResponse($message);
                
                return response()->json([
                    'success' => true,
                    'input_message' => $message,
                    'ai_response' => $response,
                    'response_length' => strlen($response),
                    'ai_identity' => 'ChaiyoAI',
                    'service_status' => $service->getStatus()
                ]);
            } catch (Exception $e) {
                return response()->json([
                    'success' => false,
                    'error' => $e->getMessage(),
                    'input_message' => $request->input('message', 'สวัสดี'),
                    'ai_identity' => 'ChaiyoAI'
                ]);
            }
        });

        // Test company knowledge
        Route::get('/company-knowledge-test', function () {
            try {
                $service = new \App\Services\ChaiyoAiService();
                
                return response()->json([
                    'company_overview' => $service->getCompanyInfo('overview'),
                    'products' => $service->getCompanyInfo('products'),
                    'contact' => $service->getCompanyInfo('contact'),
                    'certifications' => $service->getCompanyInfo('certifications'),
                    'partnerships' => $service->getCompanyInfo('partnerships'),
                    'timeline' => $service->getCompanyInfo('timeline'),
                    'ai_identity' => 'ChaiyoAI',
                    'knowledge_loaded' => true
                ]);
            } catch (Exception $e) {
                return response()->json([
                    'error' => $e->getMessage(),
                    'ai_identity' => 'ChaiyoAI',
                    'knowledge_loaded' => false
                ], 500);
            }
        });

        // Test UTF-8 handling
        Route::post('/utf8-test', function (Request $request) {
            $input = $request->input('message', 'สวัสดี');
            
            return response()->json([
                'original' => $input,
                'original_length' => strlen($input),
                'original_mb_length' => mb_strlen($input),
                'original_hex' => bin2hex($input),
                'is_utf8_valid' => mb_check_encoding($input, 'UTF-8'),
                'json_encodable' => json_encode($input) !== false,
                'json_last_error' => json_last_error_msg(),
                'server_encoding' => mb_internal_encoding()
            ]);
        });

        // Test database connections
        Route::get('/database-test', function () {
            try {
                $equipmentCount = \DB::table('equipments')->count();
                $categoryCount = \DB::table('equipment_categories')->count();
                
                return response()->json([
                    'database_connected' => true,
                    'equipments_count' => $equipmentCount,
                    'categories_count' => $categoryCount,
                    'tables_exist' => [
                        'equipments' => \Schema::hasTable('equipments'),
                        'equipment_categories' => \Schema::hasTable('equipment_categories'),
                        'pump_accessories' => \Schema::hasTable('pump_accessories'),
                    ],
                    'ai_identity' => 'ChaiyoAI',
                    'timestamp' => now()
                ]);
            } catch (\Exception $e) {
                return response()->json([
                    'database_connected' => false,
                    'error' => $e->getMessage(),
                    'ai_identity' => 'ChaiyoAI',
                    'timestamp' => now()
                ], 500);
            }
        });

        // Test auth status (compatible with Inertia)
        Route::get('/auth-test', function () {
            try {
                $user = auth()->user();
                $guards = [];
                
                // Test different guards
                foreach (['web', 'sanctum'] as $guard) {
                    try {
                        $guardUser = auth($guard)->user();
                        $guards[$guard] = $guardUser ? [
                            'id' => $guardUser->id,
                            'name' => $guardUser->name,
                            'email' => $guardUser->email
                        ] : null;
                    } catch (\Exception $e) {
                        $guards[$guard] = null;
                    }
                }
                
                return response()->json([
                    'authenticated' => !!$user,
                    'user' => $user ? [
                        'id' => $user->id,
                        'name' => $user->name,
                        'email' => $user->email,
                        'is_super_user' => $user->is_super_user ?? false
                    ] : null,
                    'guards' => $guards,
                    'session_id' => session()->getId(),
                    'csrf_token' => csrf_token(),
                    'ai_identity' => 'ChaiyoAI',
                    'timestamp' => now()
                ]);
            } catch (\Exception $e) {
                return response()->json([
                    'error' => $e->getMessage(),
                    'ai_identity' => 'ChaiyoAI',
                    'timestamp' => now()
                ], 500);
            }
        });

        // Echo test
        Route::post('/echo', function (Request $request) {
            return response()->json([
                'echo' => $request->all(),
                'headers' => $request->headers->all(),
                'ai_identity' => 'ChaiyoAI',
                'timestamp' => now()
            ]);
        });

        // Test all endpoints availability
        Route::get('/endpoints-test', function () {
            $endpointsToTest = [
                'GET /api/equipments' => '/api/equipments',
                'GET /api/equipment-categories' => '/api/equipment-categories', 
                'GET /api/images' => '/api/images',
                'GET /api/pump-accessories' => '/api/pump-accessories',
                'GET /api/ai/health' => '/api/ai/health',
                'GET /api/ai/stats' => '/api/ai/stats',
                'GET /api/ai/company-info' => '/api/ai/company-info',
                'GET /api/company/chaiyo-pipe-fitting' => '/api/company/chaiyo-pipe-fitting',
                'GET /api/company/kanok-product' => '/api/company/kanok-product',
                'GET /api/health' => '/api/health',
                'GET /api/info' => '/api/info'
            ];

            $results = [];
            
            foreach ($endpointsToTest as $description => $endpoint) {
                try {
                    $fullUrl = url($endpoint);
                    $response = \Http::timeout(5)->get($fullUrl);
                    
                    $results[$description] = [
                        'status' => $response->status(),
                        'accessible' => $response->successful(),
                        'url' => $fullUrl
                    ];
                } catch (\Exception $e) {
                    $results[$description] = [
                        'status' => 'error',
                        'accessible' => false,
                        'error' => $e->getMessage(),
                        'url' => url($endpoint)
                    ];
                }
            }

            return response()->json([
                'endpoints_test' => $results,
                'ai_identity' => 'ChaiyoAI',
                'timestamp' => now()
            ]);
        });
    });
}

// ==================================================
// 🪙 TOKEN SYSTEM ROUTES
// ==================================================

Route::middleware(['web', 'auth'])->prefix('tokens')->group(function () {
    // Get current user's token status
    Route::get('/status', [TokenController::class, 'getTokenStatus']);
    
    
    // Consume tokens for an operation
    Route::post('/consume', [TokenController::class, 'consumeTokens']);
    
    // Check if user has enough tokens
    Route::post('/check', [TokenController::class, 'checkTokens']);
    
    // Admin routes
    Route::middleware(['web', 'auth'])->group(function () {
        // Add tokens to user account (admin only)
        Route::post('/add', [TokenController::class, 'addTokens']);
        
        // Get token usage statistics (admin only)
        Route::get('/stats', [TokenController::class, 'getTokenStats']);
    });
});

// ==================================================
// 💳 PAYMENT SYSTEM ROUTES
// ==================================================

use App\Http\Controllers\PaymentController;

// Public routes (no authentication required)
Route::get('/pricing-plans', [PaymentController::class, 'getPricingPlans']);

// User payment routes (authentication required)
Route::middleware(['web', 'auth'])->prefix('payments')->group(function () {
    // Purchase plan with tokens
    Route::post('/purchase-plan', [PaymentController::class, 'purchasePlanWithTokens']);
    
    // Buy tokens directly
    Route::post('/buy-tokens', [PaymentController::class, 'createTokenPurchaseRequest']);
    
    // Create a payment request
    Route::post('/create', [PaymentController::class, 'createPaymentRequest']);
    
    // Get user's payment history
    Route::get('/my-payments', [PaymentController::class, 'getUserPayments']);
});

// Super user payment management routes
Route::middleware(['web', 'auth'])->prefix('admin/payments')->group(function () {
    // Get all pending payments
    Route::get('/pending', [PaymentController::class, 'getPendingPayments']);
    
    // Get all payments
    Route::get('/all', [PaymentController::class, 'getAllPayments']);
    
    // Get payment statistics
    Route::get('/stats', [PaymentController::class, 'getPaymentStats']);
    
    // Approve a payment
    Route::post('/{paymentId}/approve', [PaymentController::class, 'approvePayment']);
    
    // Reject a payment
    Route::post('/{paymentId}/reject', [PaymentController::class, 'rejectPayment']);
    
    // Update a payment (edit status and notes)
    Route::put('/{paymentId}', [PaymentController::class, 'updatePayment']);
});

// ==================================================
// ⚠️ ERROR HANDLING & FALLBACK ROUTES
// ==================================================

// Catch-all route for undefined API endpoints
Route::fallback(function () {
    return response()->json([
        'error' => 'API endpoint not found',
        'message' => 'The requested API endpoint does not exist.',
        'ai_identity' => 'ChaiyoAI',
        'available_endpoints' => [
            'POST /api/ai-chat' => 'ChaiyoAI chat interface (Enhanced with Company Knowledge)',
            'GET /api/ai/company-info' => 'Get company information',
            'POST /api/ai/product-recommendations' => 'Get product recommendations',
            'GET /api/equipments' => 'Equipment catalog (รวม PumpAccessory + ImageUpload)',
            'GET /api/equipment-categories' => 'Equipment categories',
            'GET /api/fields' => 'Field management (requires auth)',
            'POST /api/generate-pipe-layout' => 'Farm pipe layout generation',
            'POST /api/home-garden/generate-pipe-layout' => 'Home garden layout',
            'POST /api/images/upload' => 'Image upload (backward compatibility)',
            'GET /api/pump-accessories' => 'Pump accessories (backward compatibility)',
            'GET /api/sprinklers' => 'Sprinkler equipment',
            'GET /api/company/chaiyo-pipe-fitting' => 'Chaiyo company information',
            'GET /api/company/kanok-product' => 'Kanok company information',
            'GET /api/health' => 'System health check',
            'GET /api/info' => 'API information',
            'POST /api/ai/test' => 'Test ChaiyoAI with custom message',
        ],
        'company_focus' => [
            'chaiyo_pipe_fitting' => 'บริษัท ไชโยไปป์แอนด์ฟิตติ้ง จำกัด',
            'kanok_product' => 'บริษัท กนกส์โปรดัก จำกัด'
        ],
        'authentication_required' => [
            '/api/fields',
            '/api/folders',
            '/api/profile-photo'
        ],
        'enhanced_features' => [
            'ChaiyoAI now represents both companies officially',
            'Comprehensive company knowledge base loaded',
            'Product consultation and recommendations',
            'Enhanced irrigation expertise',
            'Context-aware responses',
            'All old routes still work for backward compatibility'
        ],
        'contact_info' => [
            'phone' => '02-451-1111',
            'website' => 'www.chaiyopipe.co.th',
            'email' => 'chaiyopipeonline@gmail.com'
        ]
    ], 404);
});