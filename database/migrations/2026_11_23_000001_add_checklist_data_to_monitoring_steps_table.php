<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('monitoring_steps', function (Blueprint $table) {
            if (!Schema::hasColumn('monitoring_steps', 'checklist_data')) {
                $table->json('checklist_data')->nullable()->after('special_badge');
            }
        });
    }

    public function down(): void
    {
        Schema::table('monitoring_steps', function (Blueprint $table) {
            if (Schema::hasColumn('monitoring_steps', 'checklist_data')) {
                $table->dropColumn('checklist_data');
            }
        });
    }
};
