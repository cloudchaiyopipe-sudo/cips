<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RestrictSalesAccess
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        
        // If user is not authenticated, allow through
        if (!$user) {
            return $next($request);
        }
        
        // If user is sales role, redirect to equipment-crud
        if ($user->role === 'sales') {
            $currentPath = $request->path();
            
            // Allow access to equipment-crud and profile
            if (in_array($currentPath, ['equipment-crud', 'profile', 'logout', 'home', 'fields'])) {
                return $next($request);
            }
            
            // Redirect to equipment-crud for all other paths
            return redirect('/equipment-crud');
        }
        
        return $next($request);
    }
}
