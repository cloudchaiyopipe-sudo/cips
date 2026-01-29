<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class SuggestionController extends Controller
{
    private const ENV_KEY = 'GOOGLE_SHEET_SUGGESTIONS_WEB_APP_URL';

    /**
     * Read Google Sheet Web App URL from .env file (project root or parent folder).
     * Used when config/env() is empty (e.g. config cached or .env in different folder).
     */
    private function readSuggestionsUrlFromEnvFile(): string
    {
        $paths = [base_path('.env'), base_path('../.env')];
        foreach ($paths as $path) {
            if (! is_file($path) || ! is_readable($path)) {
                continue;
            }
            $content = @file_get_contents($path);
            if ($content === false) {
                continue;
            }
            $key = self::ENV_KEY.'=';
            foreach (explode("\n", $content) as $line) {
                $line = trim($line);
                if ($line === '' || strpos($line, '#') === 0) {
                    continue;
                }
                if (strpos($line, $key) === 0) {
                    $value = trim(substr($line, strlen($key)));
                    $value = trim($value, '"\'');
                    return $value;
                }
            }
        }
        return '';
    }

    /**
     * Receive suggestion/feedback from frontend and forward to Google Sheet via Web App URL.
     * Payload: name, phone, email, suggestion.
     * Backend adds: datetime (ISO).
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'phone' => 'nullable|string|max:50',
            'email' => 'nullable|email|max:255',
            'suggestion' => 'required|string|max:5000',
        ]);

        // Read URL from config, env(), or by parsing .env file (supports .env in project root or parent folder)
        $webAppUrl = config('services.google_sheet_suggestions_url') ?: env('GOOGLE_SHEET_SUGGESTIONS_WEB_APP_URL', '');
        if ($webAppUrl === '' || ! is_string($webAppUrl)) {
            $webAppUrl = $this->readSuggestionsUrlFromEnvFile();
        }
        $webAppUrl = is_string($webAppUrl) ? trim($webAppUrl) : '';
        if ($webAppUrl === '') {
            Log::warning('Suggestions: GOOGLE_SHEET_SUGGESTIONS_WEB_APP_URL is not set.');
            return response()->json([
                'success' => false,
                'message' => 'การส่งคำแนะนำยังไม่ได้เปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ',
            ], 503);
        }

        $payload = [
            'datetime' => now()->timezone('Asia/Bangkok')->format('Y-m-d H:i:s'),
            'name' => $validated['name'],
            'phone' => $validated['phone'] ?? '',
            'email' => $validated['email'] ?? '',
            'suggestion' => $validated['suggestion'],
        ];

        try {
            $response = Http::timeout(15)
                ->asForm()
                ->post($webAppUrl, $payload);

            if ($response->successful()) {
                return response()->json(['success' => true]);
            }

            Log::warning('Suggestions: Google Sheet Web App returned non-OK.', [
                'status' => $response->status(),
                'body' => $response->body(),
            ]);
            return response()->json([
                'success' => false,
                'message' => 'ไม่สามารถบันทึกคำแนะนำได้ กรุณาลองใหม่',
            ], 502);
        } catch (\Exception $e) {
            Log::error('Suggestions: Failed to forward to Google Sheet.', [
                'message' => $e->getMessage(),
                'url' => $webAppUrl,
            ]);
            return response()->json([
                'success' => false,
                'message' => 'เกิดข้อผิดพลาดในการส่งคำแนะนำ กรุณาลองใหม่',
            ], 500);
        }
    }
}
