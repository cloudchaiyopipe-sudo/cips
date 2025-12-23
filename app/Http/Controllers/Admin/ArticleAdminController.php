<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Article;
use Illuminate\Http\Request;
use Inertia\Inertia; // Import Inertia

class ArticleAdminController extends Controller
{
    // แสดงรายการบทความทั้งหมด
    public function index()
    {
        $articles = Article::orderBy('published_at', 'desc')
                          ->orderBy('created_at', 'desc')
                          ->get();

        return Inertia::render('free-plan/admin/newsArticle', [
            'articles' => $articles
        ]);
    }

    // แสดงหน้าฟอร์มสำหรับสร้างข่าวใหม่
    public function create()
    {
        // นี่คือการบอกให้ Laravel เรนเดอร์ไฟล์ React ที่:
        // resources/js/pages/free-plan/admin/newsArticle.tsx
        return Inertia::render('free-plan/admin/newsArticle');
    }

    // บันทึกข่าวใหม่ลง DB
    public function store(Request $request)
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'content' => 'required|string',
            'image_url' => 'nullable|string|max:500',
        ]);

        $article = Article::create([
            'title' => $request->title,
            'content' => $request->content,
            'image_url' => $request->image_url,
            'published_at' => now(), // เผยแพร่ทันที
            // เพิ่ม field อื่นๆ ตามต้องการ
        ]);

        // หลังบันทึก ให้เด้งกลับไปหน้า Account
        // พร้อมข้อความ "success"
        return redirect()->route('free-plan.account')
                         ->with('success', 'บทความถูกสร้างเรียบร้อยแล้ว');
    }

    // แสดงหน้าฟอร์มแก้ไขบทความ
    public function edit(Article $article)
    {
        return Inertia::render('free-plan/admin/newsArticle', [
            'article' => [
                'id' => $article->id,
                'title' => $article->title,
                'content' => $article->content,
                'image_url' => $article->image_url ?? '',
            ]
        ]);
    }

    // อัปเดตบทความ
    public function update(Request $request, Article $article)
    {
        $request->validate([
            'title' => 'required|string|max:255',
            'content' => 'required|string',
            'image_url' => 'nullable|string|max:500',
        ]);

        $article->update([
            'title' => $request->title,
            'content' => $request->content,
            'image_url' => $request->image_url,
        ]);

        return redirect()->route('free.news')
                         ->with('success', 'บทความถูกแก้ไขเรียบร้อยแล้ว');
    }

    // ลบบทความ
    public function destroy(Article $article)
    {
        $article->delete();

        // ถ้ามาจากหน้า free-plan/news ให้ redirect กลับไปที่นั่น
        if (request()->header('Referer') && str_contains(request()->header('Referer'), '/free-plan/news')) {
            return redirect()->route('free.news')->with('success', 'บทความถูกลบเรียบร้อยแล้ว');
        }

        return redirect()->back()->with('success', 'บทความถูกลบเรียบร้อยแล้ว');
    }
}