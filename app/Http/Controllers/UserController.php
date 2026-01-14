<?php

namespace App\Http\Controllers;

use App\Models\User;
use App\Models\Folder;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Log;

class UserController extends Controller
{
    /**
     * Search users by name, email, or phone
     */
    public function searchUsers(Request $request): JsonResponse
    {
        try {
            $currentUser = auth()->user();
            
            // Only super admins can search for users
            if (!$currentUser->is_super_user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized. Only super admins can search users.'
                ], 403);
            }
            
            $query = $request->input('q', '');
            
            if (strlen($query) < 2) {
                return response()->json([
                    'success' => true,
                    'users' => []
                ]);
            }
            
            $users = User::where(function($q) use ($query) {
                $q->where('name', 'LIKE', "%{$query}%")
                  ->orWhere('email', 'LIKE', "%{$query}%")
                  ->orWhere('phone', 'LIKE', "%{$query}%");
            })
            ->where('id', '!=', $currentUser->id) // Exclude current user
            ->limit(20)
            ->get(['id', 'name', 'email', 'phone']);
            
            Log::info('User search performed', [
                'query' => $query,
                'results_count' => $users->count()
            ]);
            
            return response()->json([
                'success' => true,
                'users' => $users
            ]);
        } catch (\Exception $e) {
            Log::error('Error searching users: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error searching users: ' . $e->getMessage()
            ], 500);
        }
    }
    
    /**
     * Get folders for a specific user
     */
    public function getUserFolders(Request $request, $userId): JsonResponse
    {
        try {
            $currentUser = auth()->user();
            
            // Only super admins can view other users' folders
            if (!$currentUser->is_super_user) {
                return response()->json([
                    'success' => false,
                    'message' => 'Unauthorized. Only super admins can view user folders.'
                ], 403);
            }
            
            $folders = Folder::where('user_id', $userId)
                ->orderBy('type')
                ->orderBy('name')
                ->get();
            
            Log::info('User folders retrieved', [
                'user_id' => $userId,
                'folders_count' => $folders->count()
            ]);
            
            return response()->json([
                'success' => true,
                'folders' => $folders
            ]);
        } catch (\Exception $e) {
            Log::error('Error fetching user folders: ' . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Error fetching user folders: ' . $e->getMessage()
            ], 500);
        }
    }
}
