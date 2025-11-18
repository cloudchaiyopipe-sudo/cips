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
        
        // 2. ตรวจสอบ "คอลัมน์ role" โดยตรง (ตรงกับ Migration)
        if ($user->role !== 'super_user') {
            // ถ้าไม่ใช่ 'super_user', ส่งกลับบ้าน
            return redirect()->route('home') // หรือ redirect()->back()
                           ->with('error', 'คุณไม่มีสิทธิ์เข้าถึงหน้านี้');
        }
        
        // 3. ถ้าเป็น 'super_user' ให้ผ่านไปได้
        return $next($request);
    }
}
