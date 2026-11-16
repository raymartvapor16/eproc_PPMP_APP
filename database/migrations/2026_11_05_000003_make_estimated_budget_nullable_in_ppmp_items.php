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
        if (Schema::hasTable('ppmp_items')) {
            // Raw ALTER TABLE for MySQL/MariaDB and Schema builder for SQLite/Postgres
            $driver = DB::getDriverName();
            if ($driver === 'mysql') {
                DB::statement('ALTER TABLE `ppmp_items` MODIFY `estimated_budget` DECIMAL(18, 2) NULL DEFAULT NULL');
            } else {
                Schema::table('ppmp_items', function (Blueprint $table) {
                    $table->decimal('estimated_budget', 18, 2)->nullable()->default(null)->change();
                });
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('ppmp_items')) {
            $driver = DB::getDriverName();
            if ($driver === 'mysql') {
                DB::statement('ALTER TABLE `ppmp_items` MODIFY `estimated_budget` DECIMAL(18, 2) NOT NULL DEFAULT 0.00');
            } else {
                Schema::table('ppmp_items', function (Blueprint $table) {
                    $table->decimal('estimated_budget', 18, 2)->default(0.00)->change();
                });
            }
        }
    }
};

