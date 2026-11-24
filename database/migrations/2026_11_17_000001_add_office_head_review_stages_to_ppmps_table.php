<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
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
                'BUDGET_HEAD_REVIEW',
                'BUDGET_HEAD_RETURNED',
                'PACCO_REVIEW',
                'PACCO_RETURNED',
                'PACCO_APPROVED',
                'PACCO_HEAD_REVIEW',
                'PACCO_HEAD_RETURNED',
                'OPPMO_REVIEW',
                'OPPMO_RETURNED',
                'OPPMO_APPROVED',
                'OPPMO_HEAD_REVIEW',
                'OPPMO_HEAD_RETURNED',
                'TWG_REVIEW',
                'TWG_RETURNED',
                'TWG_APPROVED',
                'READY_TO_PRINT',
                'CANCELLED',
                'ARCHIVED'
            ) DEFAULT 'DRAFT'");
        }

        Schema::table('ppmp_milestones', function (Blueprint $table) {
            if (!Schema::hasColumn('ppmp_milestones', 'budget_head_received_at')) {
                $table->timestamp('budget_head_received_at')->nullable()->after('budget_approved_at');
            }
            if (!Schema::hasColumn('ppmp_milestones', 'budget_head_approved_at')) {
                $table->timestamp('budget_head_approved_at')->nullable()->after('budget_head_received_at');
            }
            if (!Schema::hasColumn('ppmp_milestones', 'pacco_head_received_at')) {
                $table->timestamp('pacco_head_received_at')->nullable()->after('pacco_approved_at');
            }
            if (!Schema::hasColumn('ppmp_milestones', 'pacco_head_approved_at')) {
                $table->timestamp('pacco_head_approved_at')->nullable()->after('pacco_head_received_at');
            }
            if (!Schema::hasColumn('ppmp_milestones', 'oppmo_head_received_at')) {
                $table->timestamp('oppmo_head_received_at')->nullable()->after('oppmo_approved_at');
            }
            if (!Schema::hasColumn('ppmp_milestones', 'oppmo_head_approved_at')) {
                $table->timestamp('oppmo_head_approved_at')->nullable()->after('oppmo_head_received_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('ppmp_milestones', function (Blueprint $table) {
            $cols = array_filter([
                'budget_head_received_at',
                'budget_head_approved_at',
                'pacco_head_received_at',
                'pacco_head_approved_at',
                'oppmo_head_received_at',
                'oppmo_head_approved_at',
            ], fn ($col) => Schema::hasColumn('ppmp_milestones', $col));

            if (!empty($cols)) {
                $table->dropColumn($cols);
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
};
