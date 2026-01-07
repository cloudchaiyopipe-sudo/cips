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
        Schema::create('products', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description');
            $table->decimal('price', 10, 2); // ราคาขาย
            $table->decimal('original_price', 10, 2)->nullable(); // ราคาเดิม (สำหรับโปรโมชั่น)
            $table->string('image_url')->nullable(); // ลิงก์รูปภาพ
            $table->string('video_url')->nullable(); // ลิงก์วิดีโอ
            $table->enum('category', ['new', 'promotion', 'recommended'])->default('new'); // หมวดหมู่
            $table->integer('discount')->nullable(); // ส่วนลด %
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('products');
    }
};
