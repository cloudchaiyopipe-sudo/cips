<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class ConfirmablePasswordController extends Controller
{
    /**
     * Show the confirm password page.
     */
    public function show(): Response
    {
        return Inertia::render('auth/confirm-password');
    }

    /**
     * Confirm the user's password.
     */
    public function store(Request $request): RedirectResponse
    {
        if (! Auth::guard('web')->validate([
            'email' => $request->user()->email,
            'password' => $request->password,
        ])) {
            throw ValidationException::withMessages([
                'password' => __('auth.password'),
            ]);
        }

        $request->session()->put('auth.password_confirmed_at', time());

        $user = $request->user();
        
        // Use intended URL if available, otherwise redirect based on role
        $defaultRoute = route('home', absolute: false);
        
        if ($user->role === 'sales') {
            $defaultRoute = route('equipment-crud', absolute: false);
        } elseif ($user->isSuperUser()) {
            $defaultRoute = route('fields', absolute: false);
        } else {
            $defaultRoute = route('free-plan', absolute: false);
        }
        
        return redirect()->intended($defaultRoute);
    }
}
