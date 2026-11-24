<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ppmp_items', function (Blueprint $table) {
            if (!Schema::hasColumn('ppmp_items', 'is_retention')) {
                $table->boolean('is_retention')->default(false)->after('description');
            }
            if (!Schema::hasColumn('ppmp_items', 'retention_percentage')) {
                $table->decimal('retention_percentage', 5, 2)->nullable()->after('is_retention');
            }
        });
    }

    public function down(): void
    {
        Schema::table('ppmp_items', function (Blueprint $table) {
            if (Schema::hasColumn('ppmp_items', 'retention_percentage')) {
                $table->dropColumn('retention_percentage');
            }
            if (Schema::hasColumn('ppmp_items', 'is_retention')) {
                $table->dropColumn('is_retention');
            }
        });
    }
};
