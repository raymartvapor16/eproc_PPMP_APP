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
        Schema::table('ppmp_amendments', function (Blueprint $table) {
            if (!Schema::hasColumn('ppmp_amendments', 'requested_supplemental_purpose')) {
                $table->string('requested_supplemental_purpose', 50)->nullable()->after('requested_amendment_scope');
            }
            if (!Schema::hasColumn('ppmp_amendments', 'requested_supplemental_specify')) {
                $table->text('requested_supplemental_specify')->nullable()->after('requested_supplemental_purpose');
            }
            if (!Schema::hasColumn('ppmp_amendments', 'supplemental_purpose')) {
                $table->string('supplemental_purpose', 50)->nullable()->after('amendment_scope');
            }
            if (!Schema::hasColumn('ppmp_amendments', 'supplemental_purpose_specify')) {
                $table->text('supplemental_purpose_specify')->nullable()->after('supplemental_purpose');
            }
        });

        Schema::table('ppmps', function (Blueprint $table) {
            if (!Schema::hasColumn('ppmps', 'is_continuation')) {
                $table->boolean('is_continuation')->default(false)->after('is_annual');
            }
            if (!Schema::hasColumn('ppmps', 'baseline_annual_budget')) {
                $table->decimal('baseline_annual_budget', 15, 2)->nullable()->after('total_budget');
            }
        });

        if (Schema::hasTable('ppmp_items')) {
            Schema::table('ppmp_items', function (Blueprint $table) {
                $table->decimal('estimated_budget', 18, 2)->nullable()->default(null)->change();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ppmps', function (Blueprint $table) {
            if (Schema::hasColumn('ppmps', 'baseline_annual_budget')) {
                $table->dropColumn('baseline_annual_budget');
            }
            if (Schema::hasColumn('ppmps', 'is_continuation')) {
                $table->dropColumn('is_continuation');
            }
        });

        Schema::table('ppmp_amendments', function (Blueprint $table) {
            if (Schema::hasColumn('ppmp_amendments', 'supplemental_purpose_specify')) {
                $table->dropColumn('supplemental_purpose_specify');
            }
            if (Schema::hasColumn('ppmp_amendments', 'supplemental_purpose')) {
                $table->dropColumn('supplemental_purpose');
            }
            if (Schema::hasColumn('ppmp_amendments', 'requested_supplemental_specify')) {
                $table->dropColumn('requested_supplemental_specify');
            }
            if (Schema::hasColumn('ppmp_amendments', 'requested_supplemental_purpose')) {
                $table->dropColumn('requested_supplemental_purpose');
            }
        });
    }
};
