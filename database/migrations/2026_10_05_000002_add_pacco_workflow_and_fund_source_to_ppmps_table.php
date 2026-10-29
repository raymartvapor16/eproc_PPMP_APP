<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('ppmps', function (Blueprint $table) {
            if (!Schema::hasColumn('ppmps', 'source_of_fund')) {
                $table->string('source_of_fund')->nullable()->default('General Fund')->after('title');
            }
        });

        $driver = Schema::getConnection()->getDriverName();
        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE ppmps MODIFY COLUMN status ENUM(
                'DRAFT',
                'HEAD_PENDING',
                'HEAD_RETURNED',
                'HEAD_APPROVED',
                'READY_FOR_REVIEW',
                'BUDGET_OFFICER_REVIEW',
                'BUDGET_OFFICER_RETURNED',
                'BUDGET_OFFICER_APPROVED',
                'PACCO_REVIEW',
                'PACCO_RETURNED',
                'PACCO_APPROVED',
                'OPPMO_REVIEW',
                'OPPMO_RETURNED',
                'OPPMO_APPROVED',
                'TWG_REVIEW',
                'TWG_RETURNED',
                'TWG_APPROVED',
                'READY_TO_PRINT',
                'CANCELLED',
                'ARCHIVED'
            ) DEFAULT 'DRAFT'");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ppmps', function (Blueprint $table) {
            if (Schema::hasColumn('ppmps', 'source_of_fund')) {
                $table->dropColumn('source_of_fund');
            }
        });

        $driver = Schema::getConnection()->getDriverName();
        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE ppmps MODIFY COLUMN status ENUM(
                'DRAFT',
                'HEAD_PENDING',
                'HEAD_RETURNED',
                'HEAD_APPROVED',
                'READY_FOR_REVIEW',
                'BUDGET_OFFICER_REVIEW',
                'BUDGET_OFFICER_RETURNED',
                'BUDGET_OFFICER_APPROVED',
                'OPPMO_REVIEW',
                'OPPMO_RETURNED',
                'OPPMO_APPROVED',
                'TWG_REVIEW',
                'TWG_RETURNED',
                'TWG_APPROVED',
                'READY_TO_PRINT',
                'CANCELLED',
                'ARCHIVED'
            ) DEFAULT 'DRAFT'");
        }
    }
};
