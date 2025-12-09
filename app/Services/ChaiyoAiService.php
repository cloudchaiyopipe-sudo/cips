<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Exception;

class ChaiyoAiService
{
    private $apiKey;
    private $baseUrl;

    public function __construct()
    {
        // Use config() first (works with config cache), then fallback to env()
        $this->apiKey = config('services.gemini.api_key') ?: env('GEMINI_API_KEY');
        $this->baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent';
        
        // Trim whitespace in case there are spaces
        $this->apiKey = $this->apiKey ? trim($this->apiKey) : null;
        
        if (empty($this->apiKey)) {
            $configCachePath = base_path('bootstrap/cache/config.php');
            $errorMsg = 'GEMINI_API_KEY not found. ';
            $errorMsg .= 'Please set GEMINI_API_KEY in your .env file. ';
            
            if (file_exists($configCachePath)) {
                $errorMsg .= 'Config cache detected. Please run: php artisan config:clear && php artisan config:cache';
            } else {
                $errorMsg .= 'After adding the key, run: php artisan config:clear';
            }
            
            throw new Exception($errorMsg);
        }
    }

    /**
     * Generate AI response using Gemini API
     */
    public function generateResponse(string $userMessage, string $language = 'auto'): string
    {
        try {
            // Clean input message
            $userMessage = $this->cleanUtf8($userMessage);
            
            // Detect language if auto
            if ($language === 'auto') {
                $language = $this->detectLanguage($userMessage);
            }

            // Handle empty message - throw exception
            if (empty(trim($userMessage))) {
                throw new Exception('Empty message provided');
            }

            // Simple prompt - just pass user message to Gemini
            $fullPrompt = $userMessage;

            Log::info('ChaiyoAI Request', [
                'user_message' => $userMessage,
                'language' => $language,
                'message_length' => mb_strlen($userMessage)
            ]);

            // Prepare API request
            $requestData = [
                'contents' => [
                    [
                        'parts' => [
                            [
                                'text' => $fullPrompt
                            ]
                        ]
                    ]
                ],
                'generationConfig' => [
                    'temperature' => 0.7,
                    'topK' => 40,
                    'topP' => 0.95,
                    'maxOutputTokens' => 2048,
                ],
                'safetySettings' => [
                    [
                        'category' => 'HARM_CATEGORY_HARASSMENT',
                        'threshold' => 'BLOCK_MEDIUM_AND_ABOVE'
                    ],
                    [
                        'category' => 'HARM_CATEGORY_HATE_SPEECH',
                        'threshold' => 'BLOCK_MEDIUM_AND_ABOVE'
                    ],
                    [
                        'category' => 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
                        'threshold' => 'BLOCK_MEDIUM_AND_ABOVE'
                    ],
                    [
                        'category' => 'HARM_CATEGORY_DANGEROUS_CONTENT',
                        'threshold' => 'BLOCK_MEDIUM_AND_ABOVE'
                    ]
                ]
            ];

            // Make API call
            $apiUrl = $this->baseUrl . '?key=' . $this->apiKey;
            Log::debug('ChaiyoAI API Call', [
                'url' => str_replace($this->apiKey, '***', $apiUrl),
                'request_size' => strlen(json_encode($requestData)),
                'prompt_length' => mb_strlen($fullPrompt)
            ]);
            
            // Manual retry loop with exponential backoff for rate limiting
            $maxRetries = 2;
            $attempt = 0;
            $response = null;
            
            while ($attempt < $maxRetries) {
                try {
                    $response = Http::timeout(30)
                        ->withHeaders([
                            'Content-Type' => 'application/json',
                        ])
                        ->post($apiUrl, $requestData);
                    
                    // Check response status
                    if ($response->successful()) {
                        break; // Success, exit retry loop
                    }
                    
                    $statusCode = $response->status();
                    $errorBody = $response->body();
                    
                    // For 429 (rate limit), retry ONCE with short wait
                    if ($statusCode === 429 && $attempt < $maxRetries - 1) {
                        $waitTime = 5000; // 5 seconds only
                        Log::warning('ChaiyoAI Rate Limit - Retrying once', [
                            'attempt' => $attempt + 1,
                            'max_retries' => $maxRetries,
                            'wait_time_seconds' => 5,
                            'note' => 'Gemini API quota exceeded. Retrying once with 5s wait.'
                        ]);
                        
                        usleep($waitTime * 1000); // Convert to microseconds
                        $attempt++;
                        continue;
                    }
                    
                    // For other errors or final attempt, throw exception
                    $errorData = json_decode($errorBody, true);
                    $errorMessage = $errorData['error']['message'] ?? $errorData['message'] ?? "HTTP {$statusCode}";
                    
                    if ($statusCode === 429) {
                        throw new Exception("ChaiyoAI API Rate Limit: {$errorMessage}. Please wait a moment and try again.");
                    }
                    
                    throw new Exception("ChaiyoAI API Error: {$errorMessage}");
                    
                } catch (\Illuminate\Http\Client\RequestException $e) {
                    $statusCode = $e->response?->status();
                    
                    // Retry on 429 ONCE with short wait
                    if ($statusCode === 429 && $attempt < $maxRetries - 1) {
                        $waitTime = 5000; // 5 seconds only
                        Log::warning('ChaiyoAI Rate Limit Exception - Retrying once', [
                            'attempt' => $attempt + 1,
                            'max_retries' => $maxRetries,
                            'wait_time_seconds' => 5,
                            'error' => $e->getMessage(),
                            'note' => 'Gemini API quota exceeded. Retrying once with 5s wait.'
                        ]);
                        
                        usleep($waitTime * 1000);
                        $attempt++;
                        continue;
                    }
                    
                    // Re-throw for other errors or final attempt
                    throw $e;
                } catch (Exception $e) {
                    // Don't retry on other exceptions
                    throw $e;
                }
            }
            
            // If we exhausted retries and still have error
            if (!$response || !$response->successful()) {
                $errorBody = $response?->body() ?? '';
                $statusCode = $response?->status() ?? 0;
                
                Log::error('ChaiyoAI API HTTP Error', [
                    'status' => $statusCode,
                    'body' => $errorBody,
                    'url' => str_replace($this->apiKey, '***', $apiUrl),
                    'attempts' => $attempt
                ]);
                
                $errorData = json_decode($errorBody, true);
                $errorMessage = $errorData['error']['message'] ?? $errorData['message'] ?? "HTTP {$statusCode}";
                
                if ($statusCode === 429) {
                    throw new Exception("ChaiyoAI API Rate Limit: {$errorMessage}. Please wait a moment and try again.");
                }
                
                throw new Exception("ChaiyoAI API Error: {$errorMessage}");
            }

            $responseData = $response->json();
            
            // Extract response text
            $aiResponse = $this->extractResponseText($responseData);
            
            if (empty($aiResponse)) {
                // Check for block reason
                if (isset($responseData['promptFeedback']['blockReason'])) {
                    $blockReason = $responseData['promptFeedback']['blockReason'];
                    Log::warning('ChaiyoAI Response Blocked', [
                        'block_reason' => $blockReason
                    ]);
                    throw new Exception("Response blocked by safety filter: {$blockReason}");
                }
                
                Log::warning('Empty response from ChaiyoAI', [
                    'response_data' => $responseData
                ]);
                throw new Exception('Empty response received from ChaiyoAI');
            }

            // Clean up the response
            $finalResponse = $this->postProcessResponse($aiResponse);

            Log::info('ChaiyoAI Success', [
                'response_length' => mb_strlen($finalResponse),
                'language' => $language
            ]);

            return $finalResponse;

        } catch (Exception $e) {
            Log::error('ChaiyoAI Error', [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'user_message' => $userMessage ?? 'N/A',
                'api_key_preview' => !empty($this->apiKey) ? substr($this->apiKey, 0, 10) . '...' : 'Not set',
                'base_url' => $this->baseUrl
            ]);

            // Re-throw exception - let controller handle error response
            throw $e;
        }
    }

    /**
     * Extract response text from Gemini API response
     */
    private function extractResponseText(array $data): string
    {
        // Check standard response structure
        if (isset($data['candidates'][0]['content']['parts'][0]['text'])) {
            return trim($data['candidates'][0]['content']['parts'][0]['text']);
        }

        // Check alternative structures
        if (isset($data['candidates'][0]['output'])) {
            return trim($data['candidates'][0]['output']);
        }

        if (isset($data['text'])) {
            return trim($data['text']);
        }

        return '';
    }

    /**
     * Post-process AI response
     */
    private function postProcessResponse(string $response): string
    {
        // Clean up response
        $response = trim($response);
        
        // Remove common prefixes
        $response = preg_replace('/^(ตอบ:|คำตอบ:|Answer:|Response:|Assistant:)\s*/i', '', $response);
        
        // Normalize line breaks
        $response = preg_replace('/\n{3,}/', "\n\n", $response);
        
        return $response;
    }

    /**
     * Detect language from message
     */
    private function detectLanguage(string $message): string
    {
        // Check for Thai characters
        if (preg_match('/[\x{0E00}-\x{0E7F}]/u', $message)) {
            return 'thai';
        }
        
        return 'english';
    }

    /**
     * Clean and validate UTF-8 encoding
     */
    private function cleanUtf8(string $text): string
    {
        // Remove null bytes and control characters
        $text = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/', '', $text);
        
        // Ensure valid UTF-8
        if (!mb_check_encoding($text, 'UTF-8')) {
            // Try common encodings
            $encodings = ['UTF-8', 'ISO-8859-1', 'Windows-1252', 'ASCII'];
            foreach ($encodings as $encoding) {
                $converted = @mb_convert_encoding($text, 'UTF-8', $encoding);
                if (mb_check_encoding($converted, 'UTF-8')) {
                    $text = $converted;
                    break;
                }
            }
        }

        // Final fallback
        if (!mb_check_encoding($text, 'UTF-8')) {
            $text = mb_convert_encoding($text, 'UTF-8', 'UTF-8');
        }

        return $text;
    }

    /**
     * Test API connection
     */
    public function testConnection(): array
    {
        try {
            $testMessage = 'Hello';
            $response = $this->generateResponse($testMessage);
            
            return [
                'success' => true,
                'response' => $response,
                'api_key_configured' => !empty($this->apiKey),
                'test_message' => $testMessage
            ];
        } catch (\Exception $e) {
            return [
                'success' => false,
                'error' => $e->getMessage(),
                'api_key_configured' => !empty($this->apiKey)
            ];
        }
    }

    /**
     * Get API status information
     */
    public function getStatus(): array
    {
        $apiKey = config('services.gemini.api_key') ?: env('GEMINI_API_KEY');
        $apiKeyConfigured = !empty($apiKey) || !empty($this->apiKey);
        
        return [
            'api_key_configured' => $apiKeyConfigured,
            'api_key_preview' => !empty($this->apiKey) ? substr($this->apiKey, 0, 10) . '...' : (!empty($apiKey) ? substr($apiKey, 0, 10) . '...' : 'Not configured'),
            'base_url' => $this->baseUrl,
            'service_name' => 'ChaiyoAI',
            'model' => 'gemini-1.5-pro',
            'status' => $apiKeyConfigured ? 'ready' : 'not_configured'
        ];
    }
}
