<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Modify enum to include 'recommended'
        DB::statement("ALTER TABLE products MODIFY COLUMN category ENUM('new', 'promotion', 'recommended') DEFAULT 'new'");
        
        // Add video_url column
        Schema::table('products', function (Blueprint $table) {
            $table->string('video_url')->nullable()->after('image_url');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Remove video_url column
        Schema::table('products', function (Blueprint $table) {
            $table->dropColumn('video_url');
        });
        
        // Revert enum back to original
        DB::statement("ALTER TABLE products MODIFY COLUMN category ENUM('new', 'promotion') DEFAULT 'new'");
    }
};
