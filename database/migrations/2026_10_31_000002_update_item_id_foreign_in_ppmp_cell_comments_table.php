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
        Schema::table('ppmp_cell_comments', function (Blueprint $table) {
            $table->dropForeign(['item_id']);
            $table->foreign('item_id')->references('id')->on('ppmp_items')->nullOnDelete();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ppmp_cell_comments', function (Blueprint $table) {
            $table->dropForeign(['item_id']);
            $table->foreign('item_id')->references('id')->on('ppmp_items')->cascadeOnDelete();
        });
    }
};

