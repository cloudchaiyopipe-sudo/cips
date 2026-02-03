<?php
// routes\web.php
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\ProfileController;
use App\Http\Controllers\ProfilePhotoController;
use App\Http\Controllers\SuperUserController;
use App\Http\Controllers\FarmController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\Admin\ArticleAdminController;
use App\Http\Controllers\FreePlan\NewsController;
use App\Http\Controllers\Admin\ProductAdminController;
use App\Http\Controllers\FreePlan\ProductController;
use App\Http\Controllers\PaymentController;
use Illuminate\Foundation\Auth\EmailVerificationRequest;
use Illuminate\Http\Request;
use Illuminate\Auth\Events\Verified;

/*
|--------------------------------------------------------------------------
| Web Routes
|--------------------------------------------------------------------------
|
| Here is where you can register web routes for your application. These
| routes are loaded by the RouteServiceProvider within a group which
| contains the "web" middleware group. Now create something great!
|
*/

// Landing page - accessible without authentication
Route::get('/landing', function () {
    return Inertia::render('landing');
})->name('landing');

Route::get('/', function () {
    // If user is authenticated, show new-home, otherwise show landing
    if (auth()->check()) {
        return Inertia::render('new-home');
    }
    return Inertia::render('landing');
})->name('home');

// New-home route - requires authentication, redirects to login if not authenticated
Route::get('/new-home', function () {
    return Inertia::render('new-home');
})->middleware(['auth'])->name('new-home');

// Route for home.tsx (field management page)
// Accessible via "Try Advanced For Free" button in new-home
Route::get('/fields', function () {
    $user = auth()->user();
    
    // If user is sales, redirect to equipment-crud
    if ($user && $user->role === 'sales') {
        return redirect()->route('equipment-crud');
    }
    
    return Inertia::render('home');
})->middleware(['auth'])->name('fields');

// Test route without authentication
Route::get('/test', function () {
    return response()->json(['message' => 'Test route working']);
})->name('test');

Route::get('/profile', [ProfileController::class, 'show'])->middleware(['auth'])->name('profile');

// Equipment CRUD Route - Accessible by sales users
Route::get('equipment-crud', function () {
    return Inertia::render('equipment-crud');
})->middleware(['auth'])->name('equipment-crud');

// Test route to check if web routes are working
Route::get('/test-web', function () {
    return response()->json(['message' => 'Web route is working']);
});

// CSRF token route
Route::get('/csrf-token', function () {
    return response()->json(['token' => csrf_token()]);
})->middleware('web');

// Test authentication route
Route::get('/test-auth', function () {
    $user = auth()->user();
    if ($user) {
        return response()->json([
            'success' => true,
            'user' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'is_super_user' => $user->isSuperUser(),
            ],
            'session_id' => session()->getId(),
        ]);
    } else {
        return response()->json([
            'success' => false,
            'message' => 'Not authenticated',
            'session_id' => session()->getId(),
        ]);
    }
});

// Folder Management Routes - Added to web routes to avoid API middleware issues
Route::get('/folders-api', function () {
    try {
        $user = auth()->user();
        
        // Debug logging
        \Log::info('Folders API called', [
            'user' => $user ? $user->id : 'null',
            'session_id' => session()->getId(),
            'headers' => request()->headers->all()
        ]);
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Authentication required',
                'debug' => [
                    'session_id' => session()->getId(),
                    'has_user' => auth()->check()
                ]
            ], 401);
        }

        // Fetch real folders from database
        $folders = \App\Models\Folder::where('user_id', $user->id)
            ->orderBy('name')
            ->get();

        // Create default system folders if they don't exist
        $systemFolders = [
            ['name' => 'Finished', 'type' => 'finished', 'color' => '#10b981', 'icon' => '✅'],
            ['name' => 'Unfinished', 'type' => 'unfinished', 'color' => '#f59e0b', 'icon' => '⏳'],
        ];

        foreach ($systemFolders as $systemFolder) {
            $exists = $folders->where('name', $systemFolder['name'])->first();
            if (!$exists) {
                \App\Models\Folder::create(array_merge($systemFolder, [
                    'user_id' => $user->id,
                ]));
            }
        }

        // Refresh the folders list
        $folders = \App\Models\Folder::where('user_id', $user->id)
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'folders' => $folders->map(function ($folder) {
                // Calculate total field count including sub-folders recursively
                $calculateTotalFieldCount = function($folder) use (&$calculateTotalFieldCount) {
                    $directCount = $folder->fields()->count();
                    
                    // Get all sub-folders recursively
                    $subFolders = \App\Models\Folder::where('parent_id', $folder->id)->get();
                    $subFolderCount = 0;
                    
                    foreach ($subFolders as $subFolder) {
                        $subFolderCount += $calculateTotalFieldCount($subFolder);
                    }
                    
                    $totalCount = $directCount + $subFolderCount;
                    
                    // Debug logging
                    \Log::info("Folder: {$folder->name}, Direct: {$directCount}, Sub-folders: {$subFolderCount}, Total: {$totalCount}");
                    
                    return $totalCount;
                };
                
                $totalFieldCount = $calculateTotalFieldCount($folder);
                
                return [
                    'id' => $folder->id,
                    'name' => $folder->name,
                    'type' => $folder->type,
                    'color' => $folder->color ?? '#6366f1',
                    'icon' => $folder->icon ?? '📁',
                    'parent_id' => $folder->parent_id,
                    'field_count' => $totalFieldCount,
                    'created_at' => $folder->created_at,
                    'updated_at' => $folder->updated_at,
                ];
            })
        ]);

    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'Error fetching folders: ' . $e->getMessage()
        ], 500);
    }
});

Route::post('/folders-api', function (\Illuminate\Http\Request $request) {
    try {
        $user = auth()->user();
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Authentication required'
            ], 401);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'type' => 'required|in:finished,unfinished,custom,customer,category',
            'parent_id' => 'nullable|exists:folders,id',
            'color' => 'nullable|string|max:7',
            'icon' => 'nullable|string|max:10',
        ]);

        $folder = \App\Models\Folder::create(array_merge($validated, [
            'user_id' => $user->id,
        ]));

        return response()->json([
            'success' => true,
            'folder' => [
                'id' => $folder->id,
                'name' => $folder->name,
                'type' => $folder->type,
                'color' => $folder->color ?? '#6366f1',
                'icon' => $folder->icon ?? '📁',
                'parent_id' => $folder->parent_id,
                'field_count' => 0,
                'created_at' => $folder->created_at,
                'updated_at' => $folder->updated_at,
            ]
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'Error creating folder: ' . $e->getMessage()
        ], 500);
    }
});

// Delete folder route
Route::delete('/folders-api/{folderId}', function ($folderId) {
    try {
        $user = auth()->user();
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Authentication required'
            ], 401);
        }

        // Check if folderId is numeric
        if (!is_numeric($folderId)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid folder ID'
            ], 400);
        }

        $folder = \App\Models\Folder::where('user_id', $user->id)
            ->findOrFail($folderId);

        // Check if it's a system folder (cannot be deleted)
        if ($folder->isSystemFolder()) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete system folders'
            ], 400);
        }

        // Check if folder has fields
        if ($folder->fields()->count() > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete folder that contains fields'
            ], 400);
        }

        $folder->delete();

        return response()->json([
            'success' => true,
            'message' => 'Folder deleted successfully'
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'Error deleting folder: ' . $e->getMessage()
        ], 500);
    }
});

// Alternative delete folder route using POST (for CSRF compatibility)
Route::post('/folders-api/{folderId}/delete', function ($folderId) {
    try {
        $user = auth()->user();
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Authentication required'
            ], 401);
        }

        // Check if folderId is numeric
        if (!is_numeric($folderId)) {
            return response()->json([
                'success' => false,
                'message' => 'Invalid folder ID'
            ], 400);
        }

        $folder = \App\Models\Folder::where('user_id', $user->id)
            ->findOrFail($folderId);

        // Check if it's a system folder (cannot be deleted)
        if ($folder->isSystemFolder()) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete system folders'
            ], 400);
        }

        // Check if folder has fields
        if ($folder->fields()->count() > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete folder that contains fields'
            ], 400);
        }

        $folder->delete();

        return response()->json([
            'success' => true,
            'message' => 'Folder deleted successfully'
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'Error deleting folder: ' . $e->getMessage()
        ], 500);
    }
});

// Fields API Routes - Added to web routes to avoid FarmController issues
Route::get('/fields-api', function () {
    try {
        $user = auth()->user();
        
        if (!$user) {
            return response()->json([
                'success' => false,
                'message' => 'Authentication required'
            ], 401);
        }

        // Allow super admin to view other users' fields
        $targetUserId = request()->input('user_id');
        $userId = ($user->is_super_user && $targetUserId) ? $targetUserId : $user->id;

        // Fetch real fields from database with limit to avoid memory issues
        $fields = \App\Models\Field::where('user_id', $userId)
            ->with('plantType')
            ->orderBy('id', 'desc') // Use ID instead of created_at for better performance
            ->limit(100) // Add limit to prevent memory issues
            ->get();
        
        \Log::info('Fields API called', [
            'user_id' => $user->id,
            'fields_count' => $fields->count(),
            'field_ids' => $fields->pluck('id')->toArray(),
            'field_names' => $fields->pluck('name')->toArray(),
        ]);

        return response()->json([
            'success' => true,
            'fields' => $fields->map(function ($field) {
                // Extract real calculated values from JSON fields
                $projectStats = is_string($field->project_stats) ? json_decode($field->project_stats, true) : $field->project_stats;
                $projectData = is_string($field->project_data) ? json_decode($field->project_data, true) : $field->project_data;
                
                // Get real calculated values - Priority: field columns > project_stats > project_data
                $realArea = 0;
                $realWaterNeed = 0;
                $realPlants = 0;
                
                // Priority 1: Use values from field columns (most reliable)
                if ($field->total_area && $field->total_area > 0) {
                    // If total_area is less than 100, it's likely already in ไร่
                    // If it's greater than 100, it might be in square meters
                    if ($field->total_area < 100) {
                        $realArea = $field->total_area; // Already in ไร่
                    } else {
                        $realArea = $field->total_area / 1600; // Convert from square meters to ไร่
                    }
                }
                
                if ($field->total_water_need && $field->total_water_need > 0) {
                    $realWaterNeed = $field->total_water_need;
                }
                
                if ($field->total_plants && $field->total_plants > 0) {
                    $realPlants = $field->total_plants;
                }
                
                // Priority 2: Use project_stats if field columns are 0 or missing
                if (($realArea == 0 || $realWaterNeed == 0 || $realPlants == 0) && $projectStats) {
                    // Use the real calculated values from project_stats
                    if ($realArea == 0) {
                    $realArea = $projectStats['totalAreaInRai'] ?? $projectStats['totalArea'] ?? 0;
                    }
                    if ($realWaterNeed == 0) {
                    $realWaterNeed = $projectStats['totalWaterNeedPerSession'] ?? $projectStats['totalWaterNeed'] ?? 0;
                    }
                    if ($realPlants == 0) {
                    $realPlants = $projectStats['totalPlants'] ?? 0;
                    }
                    
                    // Check if data is in results object
                    if (isset($projectStats['results'])) {
                        $results = $projectStats['results'];
                        if ($realArea == 0 && isset($results['totalArea'])) {
                            $realArea = $results['totalArea'];
                        }
                        if ($realWaterNeed == 0 && isset($results['totalWaterRequiredLPM'])) {
                            $realWaterNeed = $results['totalWaterRequiredLPM'];
                        }
                        if ($realPlants == 0 && isset($results['totalSprinklers'])) {
                            $realPlants = $results['totalSprinklers'];
                        }
                    }
                }
                
                // Priority 3: Fallback to project_data if still 0
                if (($realArea == 0 || $realWaterNeed == 0 || $realPlants == 0) && $projectData) {
                    if ($realPlants == 0 && isset($projectData['plants']) && is_array($projectData['plants'])) {
                        $realPlants = count($projectData['plants']);
                    }
                    
                    if ($realArea == 0) {
                        // Try to get from totalArea first
                        if (isset($projectData['totalArea']) && $projectData['totalArea'] > 0) {
                        $realArea = $projectData['totalArea'];
                // Convert area to ไร่ if it's in square meters
                if ($realArea > 1000) { // If it's likely in square meters
                    $realArea = $realArea / 1600; // Convert to ไร่ (1 ไร่ = 1600 ตร.ม.)
                }
                        } 
                        // If totalArea is 0 or missing, calculate from mainArea coordinates
                        elseif (isset($projectData['mainArea']) && is_array($projectData['mainArea']) && count($projectData['mainArea']) >= 3) {
                            // Calculate area from mainArea coordinates using shoelace formula
                            $coordinates = $projectData['mainArea'];
                            $area = 0;
                            for ($i = 0; $i < count($coordinates); $i++) {
                                $j = ($i + 1) % count($coordinates);
                                $area += $coordinates[$i]['lat'] * $coordinates[$j]['lng'];
                                $area -= $coordinates[$j]['lat'] * $coordinates[$i]['lng'];
                            }
                            $area = abs($area) / 2;
                            
                            // Convert to square meters
                            $avgLat = array_sum(array_column($coordinates, 'lat')) / count($coordinates);
                            $latFactor = 111000;
                            $lngFactor = 111000 * cos(deg2rad($avgLat));
                            
                            $realArea = ($area * $latFactor * $lngFactor) / 1600; // Convert to ไร่
                        }
                }
                
                    // Calculate water need from plants if still 0
                    if ($realWaterNeed == 0 && isset($projectData['plants']) && is_array($projectData['plants'])) {
                        $realWaterNeed = array_sum(array_map(function($plant) {
                            return $plant['plantData']['waterNeed'] ?? 0;
                        }, $projectData['plants']));
                }
                
                    // Or use irrigationZones if available
                    if ($realWaterNeed == 0 && isset($projectData['irrigationZones']) && is_array($projectData['irrigationZones'])) {
                        $realWaterNeed = array_sum(array_map(function($zone) {
                            return $zone['totalWaterNeed'] ?? 0;
                        }, $projectData['irrigationZones']));
                    }
                }
                
                // Final conversion: Convert area to ไร่ if it's in square meters (if not already converted)
                if ($realArea > 1000) { // If it's likely in square meters
                    $realArea = $realArea / 1600; // Convert to ไร่ (1 ไร่ = 1600 ตร.ม.)
                }
                
                return [
                    'id' => $field->id,
                    'name' => $field->name,
                    'customerName' => $field->customer_name,
                    'userName' => $field->user_name,
                    'category' => $field->category,
                    'folderId' => $field->folder_id,
                    'status' => $field->status,
                    'isCompleted' => $field->is_completed,
                    'area' => is_string($field->area_coordinates) ? json_decode($field->area_coordinates, true) ?? [] : ($field->area_coordinates ?? []),
                    'plantType' => (function() use ($field, $projectData) {
                        // Priority 1: Use plant type from project_data.selectedPlantType (for custom plants)
                        if ($projectData && isset($projectData['selectedPlantType']) && isset($projectData['selectedPlantType']['name'])) {
                            return [
                                'id' => $projectData['selectedPlantType']['id'] ?? ($field->plantType->id ?? null),
                                'name' => $projectData['selectedPlantType']['name'],
                                'type' => $projectData['selectedPlantType']['type'] ?? ($field->plantType->type ?? 'horticulture'),
                                'plant_spacing' => $projectData['selectedPlantType']['plantSpacing'] ?? ($field->plantType->plant_spacing ?? 0),
                                'row_spacing' => $projectData['selectedPlantType']['rowSpacing'] ?? ($field->plantType->row_spacing ?? 0),
                                'water_needed' => $projectData['selectedPlantType']['waterNeed'] ?? ($field->plantType->water_needed ?? 0),
                            ];
                        }
                        // Priority 2: Use plant type from database relation
                        if ($field->plantType) {
                            return [
                        'id' => $field->plantType->id,
                        'name' => $field->plantType->name,
                        'type' => $field->plantType->type,
                        'plant_spacing' => $field->plantType->plant_spacing,
                        'row_spacing' => $field->plantType->row_spacing,
                        'water_needed' => $field->plantType->water_needed,
                            ];
                        }
                        return null;
                    })(),
                    'totalPlants' => $realPlants, // Use real calculated value
                    'totalArea' => $realArea, // Use real calculated value
                    'total_water_need' => $realWaterNeed, // Use real calculated value
                    'createdAt' => $field->created_at,
                    'layers' => $field->layers ? (is_string($field->layers) ? json_decode($field->layers, true) : $field->layers) : [],
                    'zoneInputs' => $field->zone_inputs,
                    'selectedPipes' => $field->selected_pipes,
                    'selectedPump' => $field->selected_pump,
                    'zoneSprinklers' => $field->zone_sprinklers,
                    'zoneOperationMode' => $field->zone_operation_mode,
                    'zoneOperationGroups' => $field->zone_operation_groups,
                    'projectData' => $projectData, // Send decoded projectData
                    'project_data' => $projectData, // Also send as project_data for compatibility
                    'projectStats' => $projectStats, // Send decoded projectStats
                    'project_stats' => $projectStats, // Also send as project_stats for compatibility
                    'effectiveEquipment' => $field->effective_equipment,
                    'zoneCalculationData' => $field->zone_calculation_data,
                    // Additional data for different field types
                    'garden_data' => $field->garden_data,
                    'garden_stats' => $field->garden_stats,
                    'greenhouse_data' => $field->greenhouse_data,
                    'field_crop_data' => $field->field_crop_data,
                ];
            })
        ]);

    } catch (\Exception $e) {
        return response()->json([
            'success' => false,
            'message' => 'Error fetching fields: ' . $e->getMessage()
        ], 500);
    }
});

Route::middleware(['auth'])->group(function () {
    // Route::get('dashboard', function () {
    //     return Inertia::render('dashboard');
    // })->name('dashboard');

    // Horticulture Irrigation System Routes (ระบบชลประทานสวนผลไม้)
    Route::prefix('horticulture')->name('horticulture.')->group(function () {
        Route::get('planner', function () {
            return Inertia::render('HorticulturePlannerPage');
        })->name('planner');
        
        Route::get('results', function () {
            return Inertia::render('HorticultureResultsPage');
        })->name('results');
    });

    // Home Garden Irrigation System Routes (ระบบชลประทานบ้านสวน)
    Route::prefix('home-garden')->name('home-garden.')->group(function () {
        Route::get('planner', function () {
            return Inertia::render('home-garden-planner');
        })->name('planner');
        
        Route::get('summary', function () {
            return Inertia::render('home-garden-summary');
        })->name('summary');
    });

    // Legacy routes for backward compatibility
    Route::get('horticulture-planner', function () {
        return redirect()->route('horticulture.planner');
    });
    Route::get('horticulture-results', function () {
        return redirect()->route('horticulture.results');
    });
    Route::get('home-garden-planner', function () {
        return redirect()->route('home-garden.planner');
    });
    Route::get('home-garden-summary', function () {
        return redirect()->route('home-garden.summary');
    });

    // Greenhouse Irrigation System Routes
    Route::prefix('greenhouse')->name('greenhouse.')->group(function () {
        Route::get('planner', function () {
            return Inertia::render('greenhouse-planner');
        })->name('planner');
        
        Route::get('results', function () {
            return Inertia::render('greenhouse-results');
        })->name('results');
    });

    // Field Crop Irrigation System Routes
    Route::prefix('field-crop')->name('field-crop.')->group(function () {
        Route::get('planner', function () {
            return Inertia::render('field-crop-planner');
        })->name('planner');
        
        Route::get('results', function () {
            return Inertia::render('field-crop-results');
        })->name('results');
    });

    // Khok Nong Na Irrigation System Routes
    Route::prefix('khok-nong-na')->name('khok-nong-na.')->group(function () {
        Route::get('/', function () {
            return Inertia::render('KhokNongNaPage');
        })->name('index');
        
        Route::get('planner', function () {
            return Inertia::render('KhokNongNaPage');
        })->name('planner');
        
        Route::get('results', function () {
            return Inertia::render('KhokNongNaPage');
        })->name('results');
    });

    // Equipment & Product Page Routes
    Route::get('product', function () {
        return Inertia::render('product');
    })->name('product');
    
    // Field Crop Management Route
    Route::get('field-crop', function () {
        $cropType = request()->query('crop_type');
        $crops = request()->query('crops');
        $irrigation = request()->query('irrigation');
        return Inertia::render('field-crop', [
            'cropType' => $cropType,
            'crops' => $crops,
            'irrigation' => $irrigation
        ]);
    })->name('field-crop');

    // Khok Nong Na Management Route
    Route::get('khok-nong-na', function () {
        return Inertia::render('KhokNongNaPage');
    })->name('khok-nong-na');

    // Field Map Route
    Route::get('field-map', function () {
        $crops = request()->query('crops');
        $irrigation = request()->query('irrigation');
        return Inertia::render('field-map', [
            'crops' => $crops,
            'irrigation' => $irrigation
        ]);
    })->name('field-map');

    // Field Crop Step Routes
    Route::get('choose-crop', function () {
        $cropType = request()->query('crop_type');
        $crops = request()->query('crops');
        return Inertia::render('field-crop/choose-crop', [
            'cropType' => $cropType,
            'crops' => $crops,
        ]);
    })->name('choose-crop');

    Route::get('step1-field-area', function () {
        return Inertia::render('field-crop/initial-area', [
            'crops' => request()->query('crops'),
            'currentStep' => request()->query('currentStep'),
            'completedSteps' => request()->query('completedSteps'),
        ]);
    })->name('initial-area');

    Route::get('step2-irrigation-system', function () {
        return Inertia::render('field-crop/irrigation-generate', [
            'crops' => request()->query('crops'),
            'currentStep' => request()->query('currentStep'),
            'completedSteps' => request()->query('completedSteps'),
        ]);
    })->name('irrigation-generate');

    Route::get('step3-zones-obstacles', function () {
        return Inertia::render('field-crop/zone-obstacle', [
            'crops' => request()->query('crops'),
            'currentStep' => request()->query('currentStep'),
            'completedSteps' => request()->query('completedSteps'),
        ]);
    })->name('zone-obstacle');

    Route::get('step4-pipe-system', function () {
        return Inertia::render('field-crop/pipe-generate', [
            'crops' => request()->query('crops'),
            'currentStep' => request()->query('currentStep'),
            'completedSteps' => request()->query('completedSteps'),
        ]);
    })->name('pipe-generate');

    // Greenhouse Crop Route
    Route::get('greenhouse-crop', function () {
        $cropType = request()->query('crop_type');
        $crops = request()->query('crops');
        return Inertia::render('green-house/green-house-crop', [
            'cropType' => $cropType,
            'crops' => $crops
        ]);
    })->name('greenhouse-crop');

     // Area Input Method Route - Sales users cannot access
     Route::get('area-input-method', function () {
        $crops = request()->query('crops');
        return Inertia::render('green-house/area-input', [
            'crops' => $crops
        ]);
    })->name('area-input-method');

    // Greenhouse Planner Route - Sales users cannot access
    Route::get('greenhouse-planner', function () {
        $crops = request()->query('crops');
        $method = request()->query('method');
        return Inertia::render('green-house/green-house-planner', [
            'crops' => $crops,
            'method' => $method
        ]);
    })->name('greenhouse-planner');

    // Greenhouse Map Route - Sales users cannot access
    Route::get('choose-irrigation', function () {
        $crops = request()->query('crops');
        return Inertia::render('green-house/choose-irrigation', [
            'crops' => $crops
        ]);
    })->name('choose-irrigation');

    // Greenhouse Import Route - Sales users cannot access
    Route::get('greenhouse-import', function () {
        $crops = request()->query('crops');
        $method = request()->query('method');
        return Inertia::render('green-house/greenhouse-import', [
            'crops' => $crops,
            'method' => $method
        ]);
    })->name('greenhouse-import');

    // Greenhouse Map Route - Sales users cannot access
    Route::get('greenhouse-map', function () {
        $crops = request()->query('crops');
        $shapes = request()->query('shapes');
        $method = request()->query('method');
        $irrigation = request()->query('irrigation');
        
        return Inertia::render('green-house/green-house-map', [
            'crops' => $crops,
            'shapes' => $shapes,
            'method' => $method,
            'irrigation' => $irrigation
        ]);
    })->name('greenhouse-map');

    // Greenhouse Summary Route - Sales users cannot access
    Route::get('green-house-summary', function () {
        $crops = request()->query('crops');
        $shapes = request()->query('shapes');
        $method = request()->query('method');
        $irrigation = request()->query('irrigation');
        
        return Inertia::render('green-house/green-house-summary', [
            'crops' => $crops,
            'shapes' => $shapes,
            'method' => $method,
            'irrigation' => $irrigation
        ]);
    })->name('green-house-summary');

    // Field Crop Summary Route - Sales users cannot access
    Route::get('field-crop-summary', function () {
        return Inertia::render('field-crop/field-crop-summary', [
            'crops' => request()->query('crops'),
            'currentStep' => request()->query('currentStep'),
            'completedSteps' => request()->query('completedSteps'),
        ]);
    })->name('field-crop-summary');
    
    // Field Crop Summary Route with POST data - Sales users cannot access
    Route::post('field-crop-summary', function () {
        return Inertia::render('field-crop/field-crop-summary', [
            'summary' => request()->input('summary'),
            'mainField' => request()->input('mainField'),
            'fieldAreaSize' => request()->input('fieldAreaSize'),
            'selectedCrops' => request()->input('selectedCrops'),
            'zones' => request()->input('zones'),
            'zoneAssignments' => request()->input('zoneAssignments'),
            'pipes' => request()->input('pipes'),
            'obstacles' => request()->input('obstacles'),
            'equipment' => request()->input('equipment'),
            'equipmentIcons' => request()->input('equipment'), // Alias for backward compatibility
            'irrigationPoints' => request()->input('irrigationPoints'),
            'irrigationLines' => request()->input('irrigationLines'),
            'irrigationAssignments' => request()->input('irrigationAssignments'),
            'irrigationSettings' => request()->input('irrigationSettings'),
            'rowSpacing' => request()->input('rowSpacing'),
            'plantSpacing' => request()->input('plantSpacing'),
            'mapCenter' => request()->input('mapCenter'),
            'mapZoom' => request()->input('mapZoom'),
            'mapType' => request()->input('mapType'),
        ]);
    })->name('field-crop-summary.post');

    // Farm-related API calls that might be using web sessions - Sales users cannot access
    Route::get('/api/plant-types', [FarmController::class, 'getPlantTypes']);
    Route::post('/api/get-elevation', [FarmController::class, 'getElevation']);
    Route::post('/api/plant-points/add', [FarmController::class, 'addPlantPoint'])->name('plant-points.add');
    Route::post('/api/plant-points/delete', [FarmController::class, 'deletePlantPoint'])->name('plant-points.delete');
    Route::post('/api/plant-points/move', [FarmController::class, 'movePlantPoint'])->name('plant-points.move');

    // Field Management Routes - Sales users cannot access
    Route::post('/api/save-field', [FarmController::class, 'saveField'])->name('save-field');
    Route::post('/api/fields', [FarmController::class, 'createField'])->name('create-field');
    Route::get('/api/fields', [FarmController::class, 'getFields'])->name('get-fields');
    Route::get('/api/fields/{fieldId}', [FarmController::class, 'getField'])->name('get-field');
    Route::put('/api/fields/{fieldId}', [FarmController::class, 'updateField'])->name('update-field');
    Route::delete('/api/fields/{fieldId}', [FarmController::class, 'deleteField'])->name('delete-field');
    // Alternative delete route using POST with _method=DELETE for better CSRF compatibility
    Route::post('/api/fields/{fieldId}', [FarmController::class, 'deleteField'])->name('delete-field-post');
    
    // Folder Management Routes - Sales users cannot access
    Route::get('/api/folders', [FarmController::class, 'getFolders'])->name('get-folders');
    Route::post('/api/folders', [FarmController::class, 'createFolder'])->name('create-folder');
    Route::put('/api/folders/{folderId}', [FarmController::class, 'updateFolder'])->name('update-folder');
    Route::delete('/api/folders/{folderId}', [FarmController::class, 'deleteFolder'])->name('delete-folder');
    
    // Field Status Management - Sales users cannot access
    Route::put('/api/fields/{fieldId}/status', [FarmController::class, 'updateFieldStatus'])->name('update-field-status');
    Route::put('/api/fields/{fieldId}/data', [FarmController::class, 'updateFieldData'])->name('update-field-data');
    Route::put('/api/fields/{fieldId}/folder', [FarmController::class, 'updateFieldFolder'])->name('update-field-folder');
    
    // Field Move/Copy/Share/Rename Management - Sales users cannot access
    Route::put('/api/fields/{fieldId}/name', [FarmController::class, 'renameField'])->name('rename-field');
    Route::post('/api/fields/{fieldId}/copy', [FarmController::class, 'copyToFolder'])->name('copy-field');
    Route::post('/api/fields/{fieldId}/share', [FarmController::class, 'shareToUser'])->name('share-field');
    
    // User Management Routes - Sales users cannot access (Super admin only)
    Route::get('/api/users/search', [UserController::class, 'searchUsers'])->name('search-users');
    Route::get('/api/users/{userId}/folders', [UserController::class, 'getUserFolders'])->name('get-user-folders');
    
    // Field Image Management - Sales users cannot access
    Route::put('/api/fields/{fieldId}/image', [FarmController::class, 'updateFieldImage'])->name('update-field-image');
    Route::get('/api/fields/{fieldId}/image', [FarmController::class, 'getFieldImage'])->name('get-field-image');
    
    // Profile Photo Routes - Sales users can access
    Route::post('/api/profile-photo/upload', [ProfilePhotoController::class, 'upload'])->name('profile-photo.upload');
    Route::delete('/api/profile-photo/delete', [ProfilePhotoController::class, 'delete'])->name('profile-photo.delete');
  
    // Super User Routes
    Route::prefix('super')->name('super.')->group(function () {
        Route::get('/dashboard', function () {
            return Inertia::render('SuperUserDashboard');
        })->name('dashboard');
        Route::get('/users', [SuperUserController::class, 'getUsers'])->name('users');
        Route::post('/users', [SuperUserController::class, 'createUser'])->name('create-user');
        Route::put('/users/{userId}', [SuperUserController::class, 'updateUser'])->name('update-user');
        Route::delete('/users/{userId}', [SuperUserController::class, 'deleteUser'])->name('delete-user');
        Route::get('/users/{userId}', [SuperUserController::class, 'getUserDetails'])->name('user-details');
        Route::get('/fields', [SuperUserController::class, 'getFields'])->name('fields');
        Route::delete('/fields/{fieldId}', [SuperUserController::class, 'deleteField'])->name('delete-field');
        Route::get('/folders', [SuperUserController::class, 'getFolders'])->name('folders');
        Route::post('/folders', [SuperUserController::class, 'createFolderForUser'])->name('create-folder');
        Route::delete('/folders/{folderId}', [SuperUserController::class, 'deleteFolder'])->name('delete-folder');
    });
});

// Admin Routes - ไม่ต้อง verify email (ย้ายออกมาจาก middleware verified)
// Admin สามารถเข้าถึงได้แม้ยังไม่ได้ verify email
Route::middleware(['auth', 'admin'])->prefix('admin')->name('admin.')->group(function () {
    // GET /admin/articles (แสดงรายการ)
    // GET /admin/articles/create (แสดงฟอร์มสร้าง)
    // POST /admin/articles (บันทึกของใหม่)
    // GET /admin/articles/{article}/edit (แสดงฟอร์มแก้ไข)
    // PUT /admin/articles/{article} (อัปเดตของเดิม)
    Route::resource('articles', ArticleAdminController::class);

    // เพิ่ม Route สำหรับ Products
    Route::resource('products', ProductAdminController::class);
    Route::post('products/create-from-equipments', [ProductAdminController::class, 'createFromEquipments'])->name('products.create-from-equipments');
});

// Free Plan Routes - ไม่ต้อง verify email (ย้ายออกมาจาก middleware verified)
Route::middleware(['auth'])->group(function () {
    // Free Plan Product Route - Sales users cannot access
    Route::get('/free-plan/products', [ProductController::class, 'index'])->name('free.products');
    Route::get('/free-plan/products/{id}', [ProductController::class, 'show'])->name('free.product.show')->where('id', '[0-9]+');
    Route::get('/api/promotions', [ProductController::class, 'getPromotions'])->name('api.promotions');
});

// Public API routes (no auth required)
Route::get('/api/landing-products', [ProductController::class, 'getLandingProducts'])->name('api.landing-products');

Route::middleware(['auth'])->group(function () {

    // Free Plan Routes - Sales users cannot access
    Route::get('/free-plan', function () {
        return Inertia::render('free-plan/freeHome');
    })->name('free-plan');

    // Free Plan News Route - Sales users cannot access
    Route::get('/free-plan/news', [NewsController::class, 'index'])->name('free.news');
    Route::get('/free-plan/articles/{article}', [NewsController::class, 'show'])->name('free.article.show');

    Route::get('/free-plan/choose-crop', function () {
        return Inertia::render('free-plan/chooseCrop');
    })->name('free-plan.choose-crop');

    // Free Plan Map Route - Sales users cannot access
    Route::get('/free-plan/map', function () {
        return Inertia::render('free-plan/freeMap');
    })->name('free-plan.map');

    // Free Plan Summary Route - Sales users cannot access
    Route::get('/free-plan/summary', function () {
        return Inertia::render('free-plan/freeSummary');
    })->name('free-plan.summary');

    // Free Plan Product Route - Sales users cannot access
    Route::get('/free-plan/product', function () {
        return Inertia::render('free-plan/freeProduct');
    })->name('free-plan.product');

    // Free Plan Checkout Route - Sales users cannot access
    Route::get('/free-plan/checkout', function () {
        return Inertia::render('free-plan/freeCheckout');
    })->name('free-plan.checkout');


    // Free Plan Contact Route (ติดต่อ) - content from former footer
    Route::get('/free-plan/contact', function () {
        return Inertia::render('free-plan/freeContact');
    })->name('free-plan.contact');

    // Free Plan Account/Profile Route - Sales users cannot access (no nav menu, used by email verification etc.)
    Route::get('/free-plan/account', function (Request $request) {
        return Inertia::render('free-plan/acCount', [
            'verified' => session('verified'),
            'status' => session('status'),
        ]);
    })->name('free-plan.account');
    
    // Route สำหรับส่งอีเมลยืนยัน (เมื่อกดปุ่ม)
    Route::post('/email/verification-notification', function (Request $request) {
        try {
            $user = $request->user();
            
            // Force mail configuration to be loaded before sending email
            // This ensures the mail service provider uses the correct SMTP settings
            config('mail.default');
            config('mail.mailers.smtp');
            
            $user->sendEmailVerificationNotification();
            
            return back()->with('status', 'verification-link-sent');
        } catch (\Exception $e) {
            \Log::error('Error sending verification email', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return back()->with('error', 'Failed to send verification email. Please try again.');
        }
    })->middleware(['auth', 'throttle:6,1'])->name('verification.send');

    // Route สำหรับยืนยันอีเมล (เมื่อคลิกลิงก์ในอีเมล)
    Route::get('/verify-email/{id}/{hash}', function (EmailVerificationRequest $request) {
        $user = $request->user();
        
        if ($user->hasVerifiedEmail()) {
            return redirect()->route('free-plan.account')->with('verified', true);
        }

        if ($user->markEmailAsVerified()) {
            event(new \Illuminate\Auth\Events\Verified($user));
        }

        return redirect()->route('free-plan.account')->with('verified', true);
    })->middleware(['auth', 'signed', 'throttle:6,1'])->name('verification.verify');

    // Free Plan Upgrade Pro Route - Sales users cannot access
    Route::get('/free-plan/upgradePro', function () {
        return Inertia::render('free-plan/upgradePro');
    })->name('free-plan.upgradePro');

    // Free Plan Payment QR Code Route
    Route::get('/free-plan/payment-qr', function () {
        return Inertia::render('free-plan/components/paymentQR');
    })->name('free-plan.payment-qr');

    // Free Plan Advertisement Management Route - Sales users cannot access
    Route::get('/free-plan/ads', function () {
        return Inertia::render('free-plan/components/ads');
    })->name('free-plan.ads');
});

// Serve storage files (fallback if symbolic link doesn't work)
Route::get('/storage/{path}', function ($path) {
    $filePath = storage_path('app/public/' . $path);
    
    if (!file_exists($filePath)) {
        abort(404);
    }
    
    return response()->file($filePath);
})->where('path', '.*')->name('storage.serve');

// Payment routes
Route::middleware(['auth'])->group(function () {
    Route::post('/payment/qr', [PaymentController::class, 'generateQr'])->name('payment.qr');
    Route::get('/payment/status/{chargeId}', [PaymentController::class, 'checkStatus']);
});

// Auth routes are handled in routes/auth.php
// Removed Auth::routes() to avoid laravel/ui dependency

// Include other route files
require __DIR__.'/auth.php';
require __DIR__.'/settings.php';
// Note: The 'api.php' file is typically loaded by the RouteServiceProvider, not here.
// If your project requires it here, you can uncomment the line below.
// require __DIR__.'/api.php';
