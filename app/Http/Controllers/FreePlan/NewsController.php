<?php
namespace App\Http\Controllers\FreePlan;

use App\Http\Controllers\Controller;
use App\Models\Article;
use Inertia\Inertia;
use Illuminate\Support\Facades\Log;
use Exception;

class NewsController extends Controller
{
    // หน้า FreeNews.tsx
    public function index()
    {
        try {
            // ดึงบทความทั้งหมดที่เผยแพร่แล้ว
            // เงื่อนไข: published_at <= now() หรือ published_at เป็น null
            $articles = Article::where(function($query) {
                                $query->where(function($q) {
                                    // บทความที่มี published_at และ <= now()
                                    $q->whereNotNull('published_at')
                                      ->where('published_at', '<=', now());
                                })
                                ->orWhereNull('published_at'); // หรือบทความที่ไม่มี published_at
                            })
                            ->orderByRaw('COALESCE(published_at, created_at) DESC')
                            ->get();

            // ส่ง $articles ไปเป็น props ชื่อ 'articles'
            return Inertia::render('free-plan/freeNews', [
                'articles' => $articles 
            ]);
        } catch (Exception $e) {
            Log::error('NewsController::index error', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
                'file' => $e->getFile(),
                'line' => $e->getLine(),
            ]);
            
            // Return empty articles on error instead of crashing
            return Inertia::render('free-plan/freeNews', [
                'articles' => []
            ]);
        }
    }

    // หน้า FreeArticles.tsx
    public function show(Article $article) // Laravel Model Binding
    {
        // ส่ง $article ไปเป็น props ชื่อ 'article'
        return Inertia::render('free-plan/freeArticles', [
            'article' => $article
        ]);
    }
}