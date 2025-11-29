<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class PaymentController extends Controller
{
    /**
     * Initialize Omise with API keys
     */
    private function initializeOmise()
    {
        // Ensure Omise classes are loaded
        $omisePath = base_path('vendor/omise/omise-php/lib/Omise.php');
        
        if (!file_exists($omisePath)) {
            Log::error('Omise library not found', [
                'path' => $omisePath,
                'vendor_exists' => file_exists(base_path('vendor/omise')),
            ]);
            throw new \Exception('Omise library not found. Please run: composer install');
        }
        
        if (!class_exists('OmiseCharge')) {
            require_once $omisePath;
        }

        // Use config() instead of env() directly because:
        // 1. If config cache exists, env() won't work
        // 2. config() will read from cache if exists, or from .env if not
        // 3. config/services.php already maps env() to config values
        $publicKey = config('services.omise.public_key');
        $secretKey = config('services.omise.secret_key');

        // Also try env() as fallback (in case config cache is cleared but .env exists)
        if (empty($publicKey)) {
            $publicKey = env('OMISE_PUBLIC_KEY');
        }
        if (empty($secretKey)) {
            $secretKey = env('OMISE_SECRET_KEY');
        }

        // Trim whitespace in case there are spaces
        $publicKey = $publicKey ? trim($publicKey) : null;
        $secretKey = $secretKey ? trim($secretKey) : null;

        if (empty($publicKey) || empty($secretKey)) {
            // Log debug info
            $configCachePath = base_path('bootstrap/cache/config.php');
            Log::error('Omise API keys missing', [
                'public_key_exists' => !empty($publicKey),
                'secret_key_exists' => !empty($secretKey),
                'public_key_length' => $publicKey ? strlen($publicKey) : 0,
                'secret_key_length' => $secretKey ? strlen($secretKey) : 0,
                'config_cache_exists' => file_exists($configCachePath),
                'env_file_exists' => file_exists(base_path('.env')),
            ]);
            
            $errorMessage = 'Omise API keys are not configured. ';
            $errorMessage .= 'Please set OMISE_PUBLIC_KEY and OMISE_SECRET_KEY in your .env file. ';
            
            // Check if config cache exists
            if (file_exists($configCachePath)) {
                $errorMessage .= 'Config cache detected. Please run: php artisan config:clear';
            } else {
                $errorMessage .= 'After adding the keys, run: php artisan config:clear';
            }
            
            throw new \Exception($errorMessage);
        }

        // Define constants if not already defined
        if (!defined('OMISE_PUBLIC_KEY')) {
            define('OMISE_PUBLIC_KEY', $publicKey);
        }
        if (!defined('OMISE_SECRET_KEY')) {
            define('OMISE_SECRET_KEY', $secretKey);
        }

        return [
            'public_key' => $publicKey,
            'secret_key' => $secretKey
        ];
    }

    public function generateQr(Request $request)
    {
        try {
            // Initialize Omise
            $keys = $this->initializeOmise();
            $publicKey = $keys['public_key'];
            $secretKey = $keys['secret_key'];

            // 1. สร้าง "Source" (บอกว่าเป็น PromptPay)
            $source = \OmiseSource::create([
                'amount'   => 59900, // 599.00 บาท (หน่วยเป็นสตางค์)
                'currency' => 'THB',
                'type'     => 'promptpay'
            ], $publicKey, $secretKey);

            // Log source creation for debugging
            Log::info('Omise Source created', [
                'source_id' => $source['id'] ?? 'unknown',
                'source_type' => $source['type'] ?? 'unknown',
                'source_object' => $source['object'] ?? 'unknown',
            ]);

            // Check if source creation was successful
            if (isset($source['object']) && $source['object'] === 'error') {
                throw new \Exception('Failed to create Omise Source: ' . ($source['message'] ?? 'Unknown error'));
            }

            if (empty($source['id'])) {
                throw new \Exception('Source ID is missing from Omise response');
            }

            // 2. สร้าง "Charge" (คำสั่งซื้อ) จาก Source นั้น
            $charge = \OmiseCharge::create([
                'amount'   => 59900,
                'currency' => 'THB',
                'source'   => $source['id'], // เอา ID จากขั้นตอนที่แล้วมาใส่
                'return_uri' => url('/payment/success'), // Return URL after payment
                'metadata' => [
                    'user_id' => auth()->id() ?? 'guest_123', // เก็บ ID ลูกค้าไว้เช็คทีหลัง
                    'order_id' => 'ORDER-'.time()
                ]
            ], $publicKey, $secretKey);

            // Log charge creation for debugging
            Log::info('Omise Charge created', [
                'charge_id' => $charge['id'] ?? 'unknown',
                'charge_status' => $charge['status'] ?? 'unknown',
                'charge_object' => $charge['object'] ?? 'unknown',
                'has_source' => isset($charge['source']),
            ]);

            // Check if charge creation was successful
            if (isset($charge['object']) && $charge['object'] === 'error') {
                throw new \Exception('Failed to create Omise Charge: ' . ($charge['message'] ?? 'Unknown error'));
            }

            if (empty($charge['id'])) {
                throw new \Exception('Charge ID is missing from Omise response');
            }

            // 3. ดึง URL ของรูป QR Code ออกมา
            // Check response structure more carefully
            $qrImage = null;
            
            if (isset($charge['source']['scannable_code']['image']['download_uri'])) {
                $qrImage = $charge['source']['scannable_code']['image']['download_uri'];
            } elseif (isset($charge['source']['scannable_code']['image']['uri'])) {
                $qrImage = $charge['source']['scannable_code']['image']['uri'];
            } elseif (isset($charge['source']['scannable_code']['image'])) {
                // Try to get any image URL from the structure
                $imageData = $charge['source']['scannable_code']['image'];
                if (is_array($imageData)) {
                    $qrImage = $imageData['download_uri'] ?? $imageData['uri'] ?? null;
                }
            }

            if (empty($qrImage)) {
                // Log full charge response for debugging
                Log::error('QR code image URL not found', [
                    'charge_id' => $charge['id'] ?? 'unknown',
                    'charge_source' => $charge['source'] ?? null,
                    'charge_full_response' => json_encode($charge, JSON_PRETTY_PRINT),
                ]);
                
                throw new \Exception('QR code image URL not found in charge response. Charge ID: ' . ($charge['id'] ?? 'unknown') . '. Please check Omise API response structure.');
            }

            // 4. ส่งกลับไปให้ Frontend
            return response()->json([
                'qrCodeUrl' => $qrImage,
                'chargeId'  => $charge['id'], // ส่ง Charge ID กลับไปด้วย เผื่อใช้เช็คสถานะ
                'amount'    => 59900, // จำนวนเงินในหน่วยสตางค์
                'amountFormatted' => 599, // จำนวนเงินในหน่วยบาท (สำหรับแสดงผล)
                'status'    => 'success'
            ]);

        } catch (\Exception $e) {
            // Log the full error for debugging
            Log::error('Error generating QR code', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine()
            ]);

            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage(),
                'debug' => config('app.debug') ? [
                    'file' => $e->getFile(),
                    'line' => $e->getLine(),
                    'trace' => $e->getTraceAsString()
                ] : null
            ], 500);
        }
    }
    
    /**
     * เพิ่มฟังก์ชันเช็คสถานะ (สำหรับ Frontend ไว้ polling ถาม)
     */
    public function checkStatus($chargeId)
    {
        try {
            // Initialize Omise
            $keys = $this->initializeOmise();
            $publicKey = $keys['public_key'];
            $secretKey = $keys['secret_key'];
            
            $charge = \OmiseCharge::retrieve($chargeId, $publicKey, $secretKey);
            
            return response()->json([
                'status' => $charge['status'], // 'pending', 'successful', 'failed'
                'paid'   => $charge['paid'] ?? false
            ]);
        } catch (\Exception $e) {
            Log::error('Error checking payment status', [
                'charge_id' => $chargeId,
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'status' => 'error',
                'message' => $e->getMessage()
            ], 500);
        }
    }
}
