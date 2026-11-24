<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'can_view_all_monitoring_ppmp')) {
                $table->boolean('can_view_all_monitoring_ppmp')->default(false)->after('accessible_systems');
            }
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'can_view_all_monitoring_ppmp')) {
                $table->dropColumn('can_view_all_monitoring_ppmp');
            }
        });
    }
};
