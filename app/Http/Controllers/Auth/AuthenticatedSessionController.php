<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    /**
     * Show the login page.
     */
    public function create(Request $request): Response
    {
        return Inertia::render('auth/login', [
            'canResetPassword' => Route::has('password.request'),
            'status' => $request->session()->get('status'),
        ]);
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): RedirectResponse
    {
        $request->authenticate();

        $request->session()->regenerate();

        $user = $request->user();
        
        // Clear any intended URL to prevent redirect to account page
        $request->session()->forget('url.intended');
        
        // Redirect based on user role
        if ($user->role === 'sales') {
            return redirect()->route('equipment-crud');
        }
        
        // All users (including super users) redirect to new-home
        // From new-home, users can click "Mobile Mode" to go to free plan
        // or "Continue to App" to go to fields page
        return redirect()->route('home');
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        // For Inertia requests, return a proper response with the new CSRF token
        if ($request->header('X-Inertia')) {
            return redirect()->route('login')->with('csrf_token', csrf_token());
        }

        return redirect()->route('login');
    }
}
