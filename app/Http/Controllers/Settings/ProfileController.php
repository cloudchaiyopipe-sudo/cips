<?php

namespace App\Http\Controllers\Settings;

use App\Http\Controllers\Controller;
use App\Http\Requests\Settings\ProfileUpdateRequest;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class ProfileController extends Controller
{
    /**
     * Show the user's profile settings page.
     */
    public function edit(Request $request): Response
    {
        return Inertia::render('settings/profile', [
            'mustVerifyEmail' => $request->user() instanceof MustVerifyEmail,
            'status' => $request->session()->get('status'),
        ]);
    }

    /**
     * Update the user's profile settings.
     */
    public function update(ProfileUpdateRequest $request): RedirectResponse
    {
        $validated = $request->validated();
        
        // Only update fields that are present in the request
        if (isset($validated['name'])) {
            $request->user()->name = $validated['name'];
        }
        
        if (isset($validated['email'])) {
            $oldEmail = $request->user()->email;
            $request->user()->email = $validated['email'];
            
            if ($oldEmail !== $validated['email']) {
                $request->user()->email_verified_at = null;
            }
        }

        $request->user()->save();

        // For Inertia requests, redirect back to preserve the current page
        // For regular requests, redirect to profile page
        if ($request->header('X-Inertia')) {
            return redirect()->back();
        }

        return redirect('/profile');
    }

    /**
     * Delete the user's account.
     */
    public function destroy(Request $request): RedirectResponse
    {
        $request->validate([
            'password' => ['required', 'current_password'],
        ]);

        $user = $request->user();

        Auth::logout();

        $user->delete();

        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect('/');
    }
}
