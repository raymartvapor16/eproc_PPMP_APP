<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('monitoring_steps', function (Blueprint $table) {
            if (Schema::hasColumn('monitoring_steps', 'action_date')) {
                $table->dropColumn('action_date');
            }
        });
    }

    public function down(): void
    {
        Schema::table('monitoring_steps', function (Blueprint $table) {
            if (!Schema::hasColumn('monitoring_steps', 'action_date')) {
                $table->date('action_date')->nullable()->after('decision');
            }
        });
    }
};
