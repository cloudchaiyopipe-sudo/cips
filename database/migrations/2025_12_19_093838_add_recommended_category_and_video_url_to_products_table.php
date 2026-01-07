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
        // Check if products table exists
        if (!Schema::hasTable('products')) {
            return; // Table doesn't exist yet, skip this migration
        }
        
        // Check if video_url column already exists
        if (!Schema::hasColumn('products', 'video_url')) {
            // Add video_url column
            Schema::table('products', function (Blueprint $table) {
                $table->string('video_url')->nullable()->after('image_url');
            });
        }
        
        // Modify enum to include 'recommended' if not already included
        // Check current enum values first
        $result = DB::select("SHOW COLUMNS FROM products WHERE Field = 'category'");
        if (!empty($result)) {
            $column = $result[0];
            // Only modify if 'recommended' is not in the enum
            if (strpos($column->Type, 'recommended') === false) {
                DB::statement("ALTER TABLE products MODIFY COLUMN category ENUM('new', 'promotion', 'recommended') DEFAULT 'new'");
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Check if products table exists
        if (!Schema::hasTable('products')) {
            return; // Table doesn't exist, nothing to rollback
        }
        
        // Remove video_url column if it exists
        if (Schema::hasColumn('products', 'video_url')) {
            Schema::table('products', function (Blueprint $table) {
                $table->dropColumn('video_url');
            });
        }
        
        // Revert enum back to original (only if 'recommended' exists)
        $result = DB::select("SHOW COLUMNS FROM products WHERE Field = 'category'");
        if (!empty($result)) {
            $column = $result[0];
            if (strpos($column->Type, 'recommended') !== false) {
                DB::statement("ALTER TABLE products MODIFY COLUMN category ENUM('new', 'promotion') DEFAULT 'new'");
            }
        }
    }
};
