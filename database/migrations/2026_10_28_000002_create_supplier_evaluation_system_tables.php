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
        $driver = Schema::getConnection()->getDriverName();

        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('end_user', 'head', 'budget_officer', 'oppmo', 'twg', 'super_admin', 'admin', 'authorized_staff', 'pacco', 'monitor', 'pgso', 'presentative_staff') DEFAULT 'end_user'");
        }

        // 1. supplier_evaluation_criteria (formerly evaluation_criteria)
        Schema::create('supplier_evaluation_criteria', function (Blueprint $table) {
            $table->id();
            $table->string('criteria_name');
            $table->timestamps();
        });

        // Seed the 4 official Supplier Evaluation Criteria from the database dump
        DB::table('supplier_evaluation_criteria')->insert([
            ['id' => 1, 'criteria_name' => 'PRICE', 'created_at' => null, 'updated_at' => null],
            ['id' => 2, 'criteria_name' => 'QUALITY/SERVICE LEVEL', 'created_at' => null, 'updated_at' => null],
            ['id' => 3, 'criteria_name' => 'CUSTOMER CARE/AFTER SALES SERVICE', 'created_at' => null, 'updated_at' => null],
            ['id' => 4, 'criteria_name' => 'DELIVERY FULFILLMENT', 'created_at' => null, 'updated_at' => null],
        ]);

        // 2. supplier_evaluations (formerly evaluations)
        Schema::create('supplier_evaluations', function (Blueprint $table) {
            $table->id();
            $table->string('supplier_name')->index();
            $table->string('po_no')->index();
            $table->date('date_evaluation')->index();
            $table->foreignId('office_id')->constrained('offices')->cascadeOnDelete();
            $table->string('covered_period');
            $table->year('period_year')->index();
            $table->string('status')->default('pending')->index();
            $table->integer('delete_status')->nullable()->index();
            $table->timestamps();

            $table->index(['office_id', 'status', 'delete_status'], 'idx_supplier_evals_office_status_del');
            $table->index(['status', 'delete_status', 'period_year'], 'idx_supplier_evals_status_del_year');
        });

        // 3. supplier_criteria_scores (formerly criteria_scores)
        Schema::create('supplier_criteria_scores', function (Blueprint $table) {
            $table->id();
            $table->foreignId('evaluation_id')->constrained('supplier_evaluations')->cascadeOnDelete();
            $table->foreignId('criteria_id')->constrained('supplier_evaluation_criteria')->cascadeOnDelete();
            $table->integer('number_rating')->nullable();
            $table->text('remarks')->nullable();
            $table->timestamps();

            $table->index(['evaluation_id', 'criteria_id'], 'idx_supplier_scores_eval_criteria');
        });

        // 4. supplier_purchase_orders (formerly purchase_orders)
        Schema::create('supplier_purchase_orders', function (Blueprint $table) {
            $table->id();
            $table->string('po_no')->nullable()->index();
            $table->string('pr_no')->nullable()->index();
            $table->string('item')->nullable();
            $table->string('pdf_po')->nullable();
            $table->string('end_user')->index();
            $table->string('supplier')->index();
            $table->string('status')->nullable()->default('Pending')->index();
            $table->timestamps();

            $table->index(['end_user', 'status'], 'idx_supplier_po_enduser_status');
        });

        // 5. supplier_pdfs (formerly pdfs)
        Schema::create('supplier_pdfs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('pdf_file')->nullable();
            $table->string('status')->default('pending')->index();
            $table->timestamps();

            $table->index(['user_id', 'status'], 'idx_supplier_pdfs_user_status');
        });

        // 6. supplier_authorizes (formerly authorizes)
        Schema::create('supplier_authorizes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('evaluation_id')->nullable()->constrained('supplier_evaluations')->cascadeOnDelete();
            $table->foreignId('pdf_id')->constrained('supplier_pdfs')->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->foreignId('office_id')->nullable()->constrained('offices')->cascadeOnDelete();
            $table->timestamps();
        });

        // 7. supplier_digital_approvals (formerly digital_approvals)
        Schema::create('supplier_digital_approvals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('evaluation_id')->constrained('supplier_evaluations')->cascadeOnDelete();
            $table->foreignId('signed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('authorize_id')->nullable()->constrained('supplier_authorizes')->cascadeOnDelete();
            $table->string('full_name')->nullable();
            $table->string('designation')->nullable();
            $table->string('role')->nullable()->index();
            $table->text('image')->nullable();
            $table->timestamps();

            $table->index(['evaluation_id', 'role'], 'idx_supplier_approvals_eval_role');
        });

        // 8. supplier_evaluation_links (formerly evaluation_links)
        Schema::create('supplier_evaluation_links', function (Blueprint $table) {
            $table->id();
            $table->foreignId('evaluation_id')->constrained('supplier_evaluations')->cascadeOnDelete();
            $table->string('token')->unique();
            $table->string('code')->unique();
            $table->boolean('is_used')->default(false)->index();
            $table->timestamp('expires_at')->nullable();
            $table->timestamps();
        });

        // 9. supplier_requests (formerly requests)
        Schema::create('supplier_requests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('evaluation_id')->constrained('supplier_evaluations')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('requested_to')->nullable()->constrained('users')->nullOnDelete();
            $table->string('request_type');
            $table->text('reason');
            $table->string('status')->index();
            $table->timestamp('request_date')->nullable();
            $table->timestamp('status_date')->nullable();
            $table->timestamps();

            $table->index(['evaluation_id', 'status'], 'idx_supplier_requests_eval_status');
            $table->index(['requested_to', 'status'], 'idx_supplier_requests_reqto_status');
        });

        // 10. supplier_activity_logs (formerly activity_logs)
        Schema::create('supplier_activity_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->cascadeOnDelete();
            $table->string('activity');
            $table->text('description')->nullable();
            $table->string('role')->index();
            $table->enum('status', ['success', 'failed', 'warning'])->default('success')->index();
            $table->string('ip_address', 45)->nullable();
            $table->string('user_agent')->nullable();
            $table->timestamps();

            $table->index('created_at', 'idx_supplier_logs_created_at');
        });

        // Register Supplier Evaluation System in portal_systems if table exists
        if (Schema::hasTable('portal_systems') && !DB::table('portal_systems')->where('link_url', '/supplierevaluation')->exists()) {
            DB::table('portal_systems')->insert([
                'name' => 'Supplier Evaluation System',
                'description' => 'Official Supplier Performance Assessment & Rating System across Price, Quality, Customer Care, and Delivery Fulfillment with digital authorization.',
                'link_url' => '/supplierevaluation',
                'badge' => 'Supplier Rating',
                'icon' => 'Shield',
                'color' => 'amber',
                'status' => 'active',
                'sort_order' => 3,
                'is_external' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('supplier_activity_logs');
        Schema::dropIfExists('supplier_requests');
        Schema::dropIfExists('supplier_evaluation_links');
        Schema::dropIfExists('supplier_digital_approvals');
        Schema::dropIfExists('supplier_authorizes');
        Schema::dropIfExists('supplier_pdfs');
        Schema::dropIfExists('supplier_purchase_orders');
        Schema::dropIfExists('supplier_criteria_scores');
        Schema::dropIfExists('supplier_evaluations');
        Schema::dropIfExists('supplier_evaluation_criteria');

        $driver = Schema::getConnection()->getDriverName();
        if (in_array($driver, ['mysql', 'mariadb'], true)) {
            DB::table('users')->whereIn('role', ['pgso', 'presentative_staff'])->update(['role' => 'end_user']);
            DB::statement("ALTER TABLE users MODIFY COLUMN role ENUM('end_user', 'head', 'budget_officer', 'oppmo', 'twg', 'super_admin', 'admin', 'authorized_staff', 'pacco', 'monitor') DEFAULT 'end_user'");
        }
    }
};

