<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {

        if (Schema::hasTable('fund_sources') && !Schema::hasColumn('fund_sources', 'category')) {
            Schema::table('fund_sources', function (Blueprint $table) {
                $table->string('category')->default('General Fund')->after('workflow_route');
            });

            DB::table('fund_sources')
                ->where('workflow_route', 'pacco')
                ->orWhere('name', 'like', '%trust%')
                ->update(['category' => 'Trust Fund']);
        }

        if (Schema::hasTable('ppmps') && !Schema::hasColumn('ppmps', 'fund_source_id')) {
            Schema::table('ppmps', function (Blueprint $table) {
                $table->foreignId('fund_source_id')
                    ->nullable()
                    ->after('source_of_fund')
                    ->constrained('fund_sources')
                    ->nullOnDelete();
            });
        }

        if (Schema::hasTable('ppmp_items') && !Schema::hasColumn('ppmp_items', 'fund_source_id')) {
            Schema::table('ppmp_items', function (Blueprint $table) {
                $table->foreignId('fund_source_id')
                    ->nullable()
                    ->after('source_of_fund')
                    ->constrained('fund_sources')
                    ->nullOnDelete();
            });
        }

        $fundSources = DB::table('fund_sources')->select('id', 'name')->get();
        foreach ($fundSources as $fs) {
            DB::table('ppmps')
                ->where('source_of_fund', $fs->name)
                ->whereNull('fund_source_id')
                ->update(['fund_source_id' => $fs->id]);

            DB::table('ppmp_items')
                ->where('source_of_fund', $fs->name)
                ->whereNull('fund_source_id')
                ->update(['fund_source_id' => $fs->id]);
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('ppmp_items') && Schema::hasColumn('ppmp_items', 'fund_source_id')) {
            Schema::table('ppmp_items', function (Blueprint $table) {
                $table->dropForeign(['fund_source_id']);
                $table->dropColumn('fund_source_id');
            });
        }

        if (Schema::hasTable('ppmps') && Schema::hasColumn('ppmps', 'fund_source_id')) {
            Schema::table('ppmps', function (Blueprint $table) {
                $table->dropForeign(['fund_source_id']);
                $table->dropColumn('fund_source_id');
            });
        }

        if (Schema::hasTable('fund_sources') && Schema::hasColumn('fund_sources', 'category')) {
            Schema::table('fund_sources', function (Blueprint $table) {
                $table->dropColumn('category');
            });
        }
    }
};
