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
        Schema::table('products', function (Blueprint $table) {
            $table->string('name')->after('id');
            $table->text('description')->after('name');
            $table->decimal('price', 10, 2)->after('description');
            $table->decimal('original_price', 10, 2)->nullable()->after('price');
            $table->enum('category', ['new', 'promotion'])->default('new')->after('original_price');
            $table->integer('discount')->nullable()->after('category');
            $table->string('image_url')->nullable()->after('discount');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn([
                'name',
                'description',
                'price',
                'original_price',
                'category',
                'discount',
                'image_url',
            ]);
        });
    }
};
