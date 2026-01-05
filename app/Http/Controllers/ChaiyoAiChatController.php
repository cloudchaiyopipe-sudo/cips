<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use App\Services\ChaiyoAiService;
use Exception;

class ChaiyoAiChatController extends Controller
{
    private $chaiyoAiService;

    public function __construct()
    {
        try {
            $this->chaiyoAiService = new ChaiyoAiService();
        } catch (Exception $e) {
            $apiKey = config('services.gemini.api_key') ?: env('GEMINI_API_KEY');
            Log::error('Failed to initialize ChaiyoAiService', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'api_key_exists' => !empty($apiKey),
                'api_key_preview' => !empty($apiKey) ? substr($apiKey, 0, 10) . '...' : 'Not set',
                'config_key_exists' => !empty(config('services.gemini.api_key')),
                'env_key_exists' => !empty(env('GEMINI_API_KEY'))
            ]);
            $this->chaiyoAiService = null;
        }
    }

    /**
     * Handle incoming chat messages from the frontend
     */
    public function handleChat(Request $request)
    {
        try {
            // Check if service is available
            if (!$this->chaiyoAiService) {
                return $this->jsonResponse([
                    'reply' => $this->getServiceUnavailableResponse(),
                    'success' => true,
                    'error' => 'service_unavailable'
                ]);
            }

            $userMessage = $this->extractUserMessage($request);

            Log::info('ChaiyoAI Chat Request', [
                'user_message' => $userMessage,
                'message_length' => mb_strlen($userMessage),
                'ip' => $request->ip(),
                'user_agent' => $request->header('User-Agent', 'Unknown')
            ]);

            // Handle empty message - throw exception
            if (empty(trim($userMessage))) {
                throw new Exception('Empty message provided');
            }

            // Get AI response from ChaiyoAI
            $reply = $this->chaiyoAiService->generateResponse($userMessage);

            Log::info('ChaiyoAI Chat Success', [
                'user_message_length' => mb_strlen($userMessage),
                'ai_response_length' => mb_strlen($reply),
                'processing_time' => microtime(true) - $_SERVER['REQUEST_TIME_FLOAT'] ?? 0,
                'contains_company_info' => $this->containsCompanyInfo($reply)
            ]);

            return $this->jsonResponse([
                'reply' => $reply,
                'success' => true,
                'user_message' => $this->cleanString($userMessage),
                'timestamp' => now()->toISOString(),
                'message_type' => 'ai_response',
                'ai_identity' => 'ChaiyoAI',
                'service_info' => [
                    'powered_by' => 'Gemini Pro',
                    'model' => 'gemini-1.5-pro'
                ]
            ]);

        } catch (Exception $e) {
            $errorMessage = $e->getMessage();
            $isRateLimit = strpos($errorMessage, '429') !== false || 
                          strpos($errorMessage, 'Rate Limit') !== false || 
                          strpos($errorMessage, 'Quota exceeded') !== false;
            
            Log::error('ChaiyoAI Chat Error', [
                'error' => $errorMessage,
                'is_rate_limit' => $isRateLimit,
                'trace' => $e->getTraceAsString(),
                'user_message' => $userMessage ?? 'N/A'
            ]);
            
            return $this->jsonResponse([
                'reply' => $this->getErrorResponse($userMessage ?? '', $isRateLimit),
                'success' => true, // Keep success true for UX
                'error' => $isRateLimit ? 'rate_limit' : 'processing_error',
                'timestamp' => now()->toISOString(),
                'ai_identity' => 'ChaiyoAI'
            ]);
        }
    }

    /**
     * Extract user message from various request formats
     */
    private function extractUserMessage(Request $request): string
    {
        $userMessage = '';
        
        // Method 1: From messages array (most common)
        if ($request->has('messages')) {
            $messages = $request->input('messages');
            if (is_array($messages) && !empty($messages)) {
                $latestMessage = end($messages);
                if (isset($latestMessage['content'])) {
                    $userMessage = $latestMessage['content'];
                }
            }
        }
        
        // Method 2: Direct message field
        if (empty($userMessage)) {
            $userMessage = $request->input('message', '');
        }
        
        // Method 3: Direct content field
        if (empty($userMessage)) {
            $userMessage = $request->input('content', '');
        }
        
        // Method 4: From raw JSON content
        if (empty($userMessage)) {
            $rawContent = $request->getContent();
            if (!empty($rawContent)) {
                try {
                    $decoded = json_decode($rawContent, true);
                    if (isset($decoded['message'])) {
                        $userMessage = $decoded['message'];
                    } elseif (isset($decoded['content'])) {
                        $userMessage = $decoded['content'];
                    } elseif (isset($decoded['messages']) && is_array($decoded['messages'])) {
                        $latestMessage = end($decoded['messages']);
                        if (isset($latestMessage['content'])) {
                            $userMessage = $latestMessage['content'];
                        }
                    }
                } catch (Exception $e) {
                    Log::warning('Failed to parse JSON content', ['error' => $e->getMessage()]);
                }
            }
        }

        // Clean and validate the message
        $userMessage = $this->cleanString(trim($userMessage));

        return $userMessage;
    }

    /**
     * Check if response contains company information
     */
    private function containsCompanyInfo(string $response): bool
    {
        $companyKeywords = [
            'ไชโย', 'กนก', 'chaiyo', 'kanok', 'บริษัท', 'ไปป์', 'fitting',
            'red hand', 'ตรามือแดง', 'iso', 'มอก', 'ทุนจดทะเบียน'
        ];

        $response = strtolower($response);
        foreach ($companyKeywords as $keyword) {
            if (strpos($response, strtolower($keyword)) !== false) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get error response when AI fails
     */
    private function getErrorResponse(string $userMessage, bool $isRateLimit = false): string
    {
        if ($isRateLimit) {
            return "ขออภัยครับ ขณะนี้ Gemini API กำลังรับคำขอจำนวนมาก (Quota exceeded)\n\n" .
                   "**กรุณารอ 1-2 นาที แล้วลองถามใหม่อีกครั้ง**\n\n" .
                   "Rate limit ของ Gemini API free tier ต่ำมาก (ประมาณ 15 requests/min globally)";
        }
        
        return "ขออภัยครับ เกิดข้อผิดพลาดในการประมวลผล กรุณาลองใหม่อีกครั้ง";
    }

    /**
     * Check if query is company-related
     */
    private function isCompanyQuery(string $message): bool
    {
        $companyKeywords = [
            'ไชโย', 'chaiyo', 'กนก', 'kanok', 'บริษัท', 'company',
            'ท่อ', 'pipe', 'ข้อต่อ', 'fitting', 'pvc', 'pe'
        ];

        $message = strtolower($message);
        foreach ($companyKeywords as $keyword) {
            if (strpos($message, strtolower($keyword)) !== false) {
                return true;
            }
        }

        return false;
    }

    /**
     * Get service unavailable response
     */
    private function getServiceUnavailableResponse(): string
    {
        return "ขออภัยครับ ระบบยังไม่พร้อมใช้งาน กรุณาตรวจสอบการตั้งค่า API Key";
    }

    /**
     * Safe JSON Response with proper UTF-8 handling
     */
    private function jsonResponse($data, $status = 200)
    {
        $cleanData = $this->cleanDataForJson($data);
        
        return response()->json($cleanData, $status, [
            'Content-Type' => 'application/json; charset=UTF-8'
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PARTIAL_OUTPUT_ON_ERROR);
    }

    /**
     * Clean data recursively for JSON encoding
     */
    private function cleanDataForJson($data)
    {
        if (is_array($data)) {
            foreach ($data as $key => $value) {
                $data[$key] = $this->cleanDataForJson($value);
            }
            return $data;
        }
        
        if (is_string($data)) {
            return $this->cleanString($data);
        }
        
        return $data;
    }

    /**
     * Clean string for safe JSON encoding and UTF-8 compliance
     */
    private function cleanString($str)
    {
        if (empty($str)) {
            return '';
        }

        // Remove control characters and null bytes
        $str = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $str);
        
        // Ensure UTF-8 encoding
        if (!mb_check_encoding($str, 'UTF-8')) {
            $encodings = ['UTF-8', 'Windows-1252', 'ISO-8859-1', 'ASCII'];
            foreach ($encodings as $encoding) {
                $converted = @mb_convert_encoding($str, 'UTF-8', $encoding);
                if ($converted && mb_check_encoding($converted, 'UTF-8')) {
                    $str = $converted;
                    break;
                }
            }
        }

        // Handle HTML entities
        $str = html_entity_decode($str, ENT_QUOTES, 'UTF-8');
        
        // Handle URL encoding
        if (strpos($str, '%') !== false) {
            $decoded = urldecode($str);
            if (mb_check_encoding($decoded, 'UTF-8')) {
                $str = $decoded;
            }
        }

        // Final validation
        if (!mb_check_encoding($str, 'UTF-8')) {
            return 'ข้อความไม่ถูกต้อง';
        }
        
        return $str;
    }

    /**
     * Get system stats and health information
     */
    public function getStats()
    {
        try {
            $chaiyoAiStatus = ['success' => false, 'api_key_configured' => false];
            
            if ($this->chaiyoAiService) {
                $chaiyoAiStatus = $this->chaiyoAiService->getStatus();
            }
            
            return response()->json([
                'status' => 'healthy',
                'version' => '3.0.0',
                'name' => 'ChaiyoAI',
                'ai_service' => $chaiyoAiStatus['status'] ?? 'not_configured',
                'api_key_configured' => $chaiyoAiStatus['api_key_configured'] ?? false,
                'model' => 'gemini-1.5-pro',
                'timestamp' => now(),
                'ai_identity' => 'ChaiyoAI'
            ]);

        } catch (Exception $e) {
            return response()->json([
                'status' => 'error',
                'error' => $e->getMessage(),
                'timestamp' => now(),
                'ai_identity' => 'ChaiyoAI'
            ], 500);
        }
    }

    /**
     * Get company information endpoint
     */
    public function getCompanyInfo(Request $request)
    {
        return response()->json([
            'success' => false,
            'error' => 'Company information endpoint removed - use chat endpoint instead',
            'ai_identity' => 'ChaiyoAI',
            'timestamp' => now()
        ], 404);
    }

    /**
     * Get popular questions - removed, no hardcoded data
     */
    public function getPopularQuestions()
    {
        return response()->json([
            'questions' => [],
            'note' => 'No hardcoded questions - use chat endpoint instead',
            'ai_identity' => 'ChaiyoAI'
        ]);
    }

    /**
     * Health check endpoint
     * Note: Does NOT make actual API calls to prevent rate limit issues
     * Use ?test_api=true to test actual API connection
     */
    public function health()
    {
        try {
            // Check API key directly from config/env (no API call)
            $apiKey = config('services.gemini.api_key') ?: env('GEMINI_API_KEY');
            $apiKeyConfigured = !empty($apiKey);
            
            // Check if service is initialized (no API call)
            $serviceInitialized = $this->chaiyoAiService !== null;
            
            // Only test API if ?test_api=true is passed
            $chaiyoAiTest = ['success' => false, 'api_key_configured' => $apiKeyConfigured];
            if (request()->query('test_api') === 'true' && $this->chaiyoAiService) {
                try {
                    $chaiyoAiTest = $this->chaiyoAiService->testConnection();
                } catch (\Exception $e) {
                    $chaiyoAiTest = [
                        'success' => false,
                        'error' => $e->getMessage(),
                        'api_key_configured' => $apiKeyConfigured
                    ];
                }
            }
            
            $status = 'healthy';
            if (!$apiKeyConfigured) {
                $status = 'unhealthy';
            } elseif (request()->query('test_api') === 'true' && !$chaiyoAiTest['success']) {
                $status = 'degraded';
            }
            
            return response()->json([
                'status' => $status,
                'version' => '3.0.0',
                'name' => 'ChaiyoAI',
                'timestamp' => now(),
                'services' => [
                    'chaiyo_ai' => $apiKeyConfigured ? 'configured' : 'not_configured',
                    'api_test' => request()->query('test_api') === 'true' ? ($chaiyoAiTest['success'] ? 'healthy' : 'unhealthy') : 'not_tested',
                    'utf8_handling' => 'enabled'
                ],
                'configuration' => [
                    'api_key_configured' => $apiKeyConfigured,
                    'model' => 'gemini-1.5-pro',
                    'max_tokens' => 2048,
                    'temperature' => 0.7
                ],
                'note' => request()->query('test_api') === 'true' 
                    ? 'API connection was tested' 
                    : 'API connection not tested (pass ?test_api=true to test)',
                'ai_identity' => 'ChaiyoAI'
            ]);

        } catch (Exception $e) {
            return response()->json([
                'status' => 'unhealthy',
                'error' => $e->getMessage(),
                'timestamp' => now(),
                'ai_identity' => 'ChaiyoAI'
            ], 500);
        }
    }

    /**
     * Test endpoint for debugging and verification
     * Supports both GET and POST requests
     */
    public function test(Request $request)
    {
        // Support both GET (query parameter) and POST (body) requests
        $message = $request->input('message', $request->query('message', 'Hello'));
        
        try {
            if (!$this->chaiyoAiService) {
                $apiKey = config('services.gemini.api_key') ?: env('GEMINI_API_KEY');
                $apiKeyConfigured = !empty($apiKey);
                
                return response()->json([
                    'success' => false,
                    'input' => $message,
                    'error' => 'ChaiyoAiService not initialized',
                    'api_key_configured' => $apiKeyConfigured,
                    'hint' => $apiKeyConfigured 
                        ? 'API Key is configured but service failed to initialize. Check logs for details.'
                        : 'GEMINI_API_KEY not found in .env file. Please add: GEMINI_API_KEY=your_api_key_here',
                    'setup_instructions' => [
                        '1. Get API Key from: https://makersuite.google.com/app/apikey',
                        '2. Add to .env file: GEMINI_API_KEY=your_api_key_here',
                        '3. Restart web server',
                        '4. Test again at: /api/ai/test'
                    ],
                    'ai_identity' => 'ChaiyoAI',
                    'timestamp' => now()
                ], 500);
            }

            $startTime = microtime(true);
            $response = $this->chaiyoAiService->generateResponse($message);
            $endTime = microtime(true);
            
            return response()->json([
                'success' => true,
                'input' => $message,
                'output' => $response,
                'processing_time' => round(($endTime - $startTime) * 1000, 2) . ' ms',
                'input_length' => mb_strlen($message),
                'output_length' => mb_strlen($response),
                'service_status' => $this->chaiyoAiService->getStatus(),
                'contains_company_info' => $this->containsCompanyInfo($response),
                'ai_identity' => 'ChaiyoAI',
                'timestamp' => now()
            ]);
            
        } catch (Exception $e) {
            $errorMessage = $e->getMessage();
            $isRateLimit = strpos($errorMessage, '429') !== false || 
                          strpos($errorMessage, 'Rate Limit') !== false || 
                          strpos($errorMessage, 'Quota exceeded') !== false;
            
            return response()->json([
                'success' => false,
                'input' => $message,
                'error' => $errorMessage,
                'is_rate_limit' => $isRateLimit,
                'message' => $isRateLimit 
                    ? 'Gemini API quota exceeded. Please wait 1-2 minutes and try again.' 
                    : 'An error occurred while processing your request.',
                'ai_identity' => 'ChaiyoAI',
                'timestamp' => now()
            ], $isRateLimit ? 429 : 500);
        }
    }

    /**
     * Get product recommendations - removed, no hardcoded data
     */
    public function getProductRecommendations(Request $request)
    {
        return response()->json([
            'success' => false,
            'error' => 'Product recommendations endpoint removed - use chat endpoint instead',
            'ai_identity' => 'ChaiyoAI',
            'timestamp' => now()
        ], 404);
    }

    /**
     * Quick ping endpoint
     */
    public function ping()
    {
        return response()->json([
            'status' => 'pong',
            'service' => 'ChaiyoAI',
            'version' => '3.0.0',
            'timestamp' => now(),
            'gemini_configured' => !empty(config('services.gemini.api_key') ?: env('GEMINI_API_KEY')),
            'ai_identity' => 'ChaiyoAI'
        ]);
    }
}