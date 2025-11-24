<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureUserIsAdmin
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        
        // 1. ตรวจสอบว่า Login หรือยัง
        if (!$user) {
            return redirect()->route('login');
        }
        
        // 2. ตรวจสอบว่าเป็น admin (super_user) หรือไม่
        // ใช้ isSuperUser() เพื่อตรวจสอบทั้ง is_super_user และ role === 'super_user'
        if (!$user->isSuperUser()) {
            // ถ้าไม่ใช่ admin, ส่งกลับไปหน้า free-plan
            return redirect()->route('free-plan')
                           ->with('error', 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
        }
        
        // 3. ถ้าเป็น admin ให้ผ่านไปได้ (ไม่ต้อง verify email)
        return $next($request);
    }
}
