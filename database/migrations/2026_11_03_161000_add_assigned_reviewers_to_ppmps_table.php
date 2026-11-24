<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        Schema::table('ppmps', function (Blueprint $table) {
            $table->foreignId('twg_reviewer_id')->nullable()->after('status')->constrained('users')->nullOnDelete();
            $table->foreignId('budget_reviewer_id')->nullable()->after('twg_reviewer_id')->constrained('users')->nullOnDelete();
            $table->foreignId('oppmo_reviewer_id')->nullable()->after('budget_reviewer_id')->constrained('users')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('ppmps', function (Blueprint $table) {
            $table->dropForeign(['twg_reviewer_id']);
            $table->dropForeign(['budget_reviewer_id']);
            $table->dropForeign(['oppmo_reviewer_id']);
            $table->dropColumn(['twg_reviewer_id', 'budget_reviewer_id', 'oppmo_reviewer_id']);
        });
    }
};
