<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class SalesRoleMiddleware
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        
        // If user is not authenticated, redirect to login
        if (!$user) {
            return redirect()->route('login');
        }
        
        // If user is sales role, only allow access to specific routes
        if ($user->role === 'sales') {
            $allowedRoutes = [
                'equipment-crud',
                'profile',
                'logout',
                'home', // Allow home page
            ];
            
            $currentRoute = $request->route()?->getName();
            $currentPath = $request->path();
            
            // Debug logging
            \Log::info('Sales middleware check', [
                'user_id' => $user->id,
                'user_role' => $user->role,
                'current_route' => $currentRoute,
                'current_path' => $currentPath,
                'allowed_routes' => $allowedRoutes,
                'is_allowed' => in_array($currentRoute, $allowedRoutes)
            ]);
            
            // Allow access to allowed routes
            if (in_array($currentRoute, $allowedRoutes)) {
                return $next($request);
            }
            
            // Also allow direct path access to equipment-crud
            if ($currentPath === 'equipment-crud') {
                return $next($request);
            }
            
            // For all other routes, redirect to equipment-crud
            return redirect()->route('equipment-crud');
        }
        
        return $next($request);
    }
}
