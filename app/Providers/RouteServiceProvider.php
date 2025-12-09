<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

class RouteServiceProvider extends ServiceProvider
{
    /**
     * The path to your application's "home" route.
     *
     * Typically, users are redirected here after authentication.
     *
     * @var string
     */
    public const HOME = '/';

    /**
     * Define your route model bindings, pattern filters, and other route configuration.
     */
    public function boot(): void
    {
        RateLimiter::for('api', function (Request $request) {
            return Limit::perMinute(60)->by($request->user()?->id ?: $request->ip());
        });
        
        // Rate limiter for AI chat - prevent quota exceeded
        // Note: Gemini API rate limit is GLOBAL per API key, not per user
        // Gemini free tier has VERY LOW rate limits (around 15 requests/min globally)
        // Using 2/min to stay well below quota and account for other API calls
        RateLimiter::for('ai-chat', function (Request $request) {
            // Use a global key to limit ALL requests across all users
            // This prevents exceeding Gemini's global quota
            return Limit::perMinute(2)->by('ai-chat-global');
        });

        $this->routes(function () {
            Route::middleware('api')
                ->prefix('api')
                ->group(base_path('routes/api.php'));

            Route::middleware('web')
                ->group(base_path('routes/web.php'));
        });
    }
} 