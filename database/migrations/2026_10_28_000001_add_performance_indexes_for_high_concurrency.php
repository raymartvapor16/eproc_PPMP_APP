<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations to add high-concurrency composite and lookup indexes
     * for 45-50+ simultaneous users across PPMP, Monitoring, Notifications, and Audit tables.
     */
    public function up(): void
    {
        Schema::table('ppmps', function (Blueprint $table) {
            $table->index('tracking_number', 'idx_ppmps_tracking_number');
            $table->index('fiscal_year', 'idx_ppmps_fiscal_year');
            $table->index(['office_id', 'status'], 'idx_ppmps_office_status');
            $table->index(['created_by', 'status'], 'idx_ppmps_creator_status');
            $table->index(['status', 'updated_at'], 'idx_ppmps_status_updated');
            $table->index(['fiscal_year', 'tracking_number'], 'idx_ppmps_fy_tracker');
        });

        Schema::table('ppmp_items', function (Blueprint $table) {
            $table->index(['ppmp_id', 'item_no'], 'idx_ppmp_items_ppmp_itemno');
            $table->index('procurement_mode', 'idx_ppmp_items_mode');
            $table->index('project_type', 'idx_ppmp_items_type');
            $table->index('source_of_fund', 'idx_ppmp_items_fund');
        });

        Schema::table('ppmp_signatures', function (Blueprint $table) {
            $table->index(['ppmp_id', 'role'], 'idx_ppmp_signatures_ppmp_role');
        });

        Schema::table('ppmp_routes', function (Blueprint $table) {
            $table->index(['ppmp_id', 'received_at'], 'idx_ppmp_routes_ppmp_received');
            $table->index(['ppmp_id', 'status'], 'idx_ppmp_routes_ppmp_status');
        });

        Schema::table('ppmp_reviews', function (Blueprint $table) {
            $table->index(['ppmp_id', 'acted_at'], 'idx_ppmp_reviews_ppmp_acted');
        });

        Schema::table('system_notifications', function (Blueprint $table) {
            $table->index(['user_id', 'read_at'], 'idx_sys_notifs_user_read');
            $table->index(['user_id', 'ppmp_id'], 'idx_sys_notifs_user_ppmp');
        });

        Schema::table('monitoring_projects', function (Blueprint $table) {
            $table->index('pr_number', 'idx_mon_proj_pr_number');
            $table->index('pims_pr_id', 'idx_mon_proj_pims_pr_id');
            $table->index(['pims_status', 'ppmp_id'], 'idx_mon_proj_pims_status_ppmp');
            $table->index(['current_division', 'status'], 'idx_mon_proj_div_status');
            $table->index(['category', 'procurement_mode'], 'idx_mon_proj_cat_mode');
        });

        Schema::table('monitoring_steps', function (Blueprint $table) {
            $table->index(['monitoring_project_id', 'division', 'step_order'], 'idx_mon_steps_proj_div_order');
        });

        Schema::table('audit_logs', function (Blueprint $table) {
            $table->index('action', 'idx_audit_logs_action');
            $table->index(['entity_type', 'entity_id'], 'idx_audit_logs_entity');
            $table->index('created_at', 'idx_audit_logs_created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ppmps', function (Blueprint $table) {
            $table->dropIndex('idx_ppmps_tracking_number');
            $table->dropIndex('idx_ppmps_fiscal_year');
            $table->dropIndex('idx_ppmps_office_status');
            $table->dropIndex('idx_ppmps_creator_status');
            $table->dropIndex('idx_ppmps_status_updated');
            $table->dropIndex('idx_ppmps_fy_tracker');
        });

        Schema::table('ppmp_items', function (Blueprint $table) {
            $table->dropIndex('idx_ppmp_items_ppmp_itemno');
            $table->dropIndex('idx_ppmp_items_mode');
            $table->dropIndex('idx_ppmp_items_type');
            $table->dropIndex('idx_ppmp_items_fund');
        });

        Schema::table('ppmp_signatures', function (Blueprint $table) {
            $table->dropIndex('idx_ppmp_signatures_ppmp_role');
        });

        Schema::table('ppmp_routes', function (Blueprint $table) {
            $table->dropIndex('idx_ppmp_routes_ppmp_received');
            $table->dropIndex('idx_ppmp_routes_ppmp_status');
        });

        Schema::table('ppmp_reviews', function (Blueprint $table) {
            $table->dropIndex('idx_ppmp_reviews_ppmp_acted');
        });

        Schema::table('system_notifications', function (Blueprint $table) {
            $table->dropIndex('idx_sys_notifs_user_read');
            $table->dropIndex('idx_sys_notifs_user_ppmp');
        });

        Schema::table('monitoring_projects', function (Blueprint $table) {
            $table->dropIndex('idx_mon_proj_pr_number');
            $table->dropIndex('idx_mon_proj_pims_pr_id');
            $table->dropIndex('idx_mon_proj_pims_status_ppmp');
            $table->dropIndex('idx_mon_proj_div_status');
            $table->dropIndex('idx_mon_proj_cat_mode');
        });

        Schema::table('monitoring_steps', function (Blueprint $table) {
            $table->dropIndex('idx_mon_steps_proj_div_order');
        });

        Schema::table('audit_logs', function (Blueprint $table) {
            $table->dropIndex('idx_audit_logs_action');
            $table->dropIndex('idx_audit_logs_entity');
            $table->dropIndex('idx_audit_logs_created_at');
        });
    }
};

