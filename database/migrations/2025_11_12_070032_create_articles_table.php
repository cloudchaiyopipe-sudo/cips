<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('articles', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->text('content'); // เก็บเนื้อหา (รวม HTML)
            $table->string('image_url')->nullable(); // ลิงก์รูปภาพ
            $table->string('category')->default('ข่าวสาร');
            $table->string('author')->default('Fanggy005');
            $table->timestamp('published_at')->nullable(); // วันที่เผยแพร่
            $table->timestamps(); // สร้าง created_at, updated_at
        });
    }
};
