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
        Schema::table('pump_accessories', function (Blueprint $table) {
            $table->unsignedBigInteger('group_id')->nullable()->after('equipment_id');
            $table->unsignedBigInteger('equipment_set_id')->nullable()->after('group_id');
            
            $table->foreign('group_id')->references('id')->on('equipment_set_groups')->onDelete('set null');
            $table->foreign('equipment_set_id')->references('id')->on('equipment_sets')->onDelete('set null');
            
            $table->index(['group_id', 'equipment_set_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pump_accessories', function (Blueprint $table) {
            $table->dropForeign(['group_id']);
            $table->dropForeign(['equipment_set_id']);
            $table->dropIndex(['group_id', 'equipment_set_id']);
            $table->dropColumn(['group_id', 'equipment_set_id']);
        });
    }
};
