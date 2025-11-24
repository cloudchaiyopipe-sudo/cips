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
        if (!class_exists('OmiseCharge')) {
            require_once base_path('vendor/omise/omise-php/lib/Omise.php');
        }

        $publicKey = env('OMISE_PUBLIC_KEY');
        $secretKey = env('OMISE_SECRET_KEY');

        if (empty($publicKey) || empty($secretKey)) {
            throw new \Exception('Omise API keys are not configured. Please set OMISE_PUBLIC_KEY and OMISE_SECRET_KEY in your .env file.');
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

            // 3. ดึง URL ของรูป QR Code ออกมา
            if (!isset($charge['source']['scannable_code']['image']['download_uri'])) {
                throw new \Exception('QR code image URL not found in charge response. Charge ID: ' . ($charge['id'] ?? 'unknown'));
            }

            $qrImage = $charge['source']['scannable_code']['image']['download_uri'];

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
