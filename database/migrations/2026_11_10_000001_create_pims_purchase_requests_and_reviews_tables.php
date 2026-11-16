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
        // 1. Purchase Requests Table
        Schema::create('purchase_requests', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('ppmp_id')->constrained('ppmps')->cascadeOnDelete();
            $table->foreignId('ppmp_attachment_list_id')->nullable()->constrained('ppmp_attachment_lists')->nullOnDelete();
            $table->foreignId('monitoring_project_id')->nullable()->constrained('monitoring_projects')->nullOnDelete();
            $table->foreignId('office_id')->nullable()->constrained('offices')->nullOnDelete();
            $table->string('tracker_id', 100)->index(); // Exact tracker ID from PPMP (e.g. PSWDOGoods-2026-149)
            $table->string('pr_number', 100)->nullable()->index(); // Official assigned P.R No.
            $table->date('date_published')->nullable();
            $table->date('pr_date')->nullable();
            $table->string('department');
            $table->string('section')->nullable();
            $table->string('source', 20)->default('PPMP'); // PPMP or APP
            $table->string('category', 50)->default('GOODS_CONSULTING'); // GOODS_CONSULTING, INFRA, etc.
            $table->string('procurement_mode', 100)->nullable();
            $table->text('purpose'); // Justification / Purpose
            $table->string('place_of_delivery')->nullable();
            $table->string('delivery_period')->nullable();
            $table->string('payment_method')->nullable();
            $table->text('charges')->nullable();
            $table->text('green_specifications')->nullable();
            $table->date('pr_certification_date')->nullable();
            $table->decimal('total_cost', 18, 2)->default(0.00);

            // Signatories
            $table->string('requested_by_name')->nullable();
            $table->string('requested_by_designation')->nullable();
            $table->string('cash_availability_name')->nullable()->default('FARAH GEMMA V. BIDAN, CPA');
            $table->string('cash_availability_designation')->nullable()->default('Provincial Treasurer');
            $table->string('approved_by_name')->nullable()->default('HON. YVONNE R. CAGAS');
            $table->string('approved_by_designation')->nullable()->default('Provincial Governor');
            $table->string('direct_end_user_name')->nullable();
            $table->string('direct_end_user_designation')->nullable();
            $table->date('direct_end_user_signed_at')->nullable();

            // Review Stage & Status
            // Workflow: PR Division -> BAC TWG -> PR Division (Control) -> PR Approved
            $table->string('current_stage', 50)->default('pr_division'); // pr_division, bac_twg, pr_control, approved
            $table->string('status', 50)->default('PR_DIVISION_REVIEW'); // PR_DIVISION_REVIEW, BAC_TWG_REVIEW, PR_CONTROL_REVIEW, PR_APPROVED, RETURNED, CANCELLED
            $table->text('remarks')->nullable();

            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['ppmp_id', 'status']);
            $table->index('current_stage');
        });

        // 2. Normalized Purchase Request Items Table
        Schema::create('purchase_request_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_request_id')->constrained('purchase_requests')->cascadeOnDelete();
            $table->string('item_no', 50)->default('1');
            $table->string('unit', 50)->nullable();
            $table->text('item_description');
            $table->decimal('quantity', 14, 2)->nullable();
            $table->decimal('unit_cost', 15, 2)->nullable();
            $table->decimal('total_cost', 18, 2)->nullable();
            $table->boolean('is_lot_header')->default(false);
            $table->integer('sort_order')->default(0);
            $table->timestamps();

            $table->index('purchase_request_id');
        });

        // 3. Normalized Purchase Request Reviews & Routes (Workflow history & comments)
        Schema::create('purchase_request_routes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('purchase_request_id')->constrained('purchase_requests')->cascadeOnDelete();
            $table->foreignId('from_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('to_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('from_stage', 50); // end_user, pr_division, bac_twg, pr_control
            $table->string('to_stage', 50);   // pr_division, bac_twg, pr_control, approved, returned
            $table->string('action', 50);     // submit, approve, return, control_pass, finalize
            $table->string('status', 50);     // PENDING, APPROVED, RETURNED
            $table->text('remarks')->nullable();
            $table->timestamp('acted_at')->nullable();
            $table->timestamps();

            $table->index('purchase_request_id');
        });

        // 4. Update monitoring_projects to link back to purchase_requests
        if (Schema::hasTable('monitoring_projects')) {
            Schema::table('monitoring_projects', function (Blueprint $table) {
                if (!Schema::hasColumn('monitoring_projects', 'purchase_request_id')) {
                    $table->foreignId('purchase_request_id')->nullable()->after('ppmp_id')->constrained('purchase_requests')->nullOnDelete();
                }
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('monitoring_projects') && Schema::hasColumn('monitoring_projects', 'purchase_request_id')) {
            Schema::table('monitoring_projects', function (Blueprint $table) {
                $table->dropForeign(['purchase_request_id']);
                $table->dropColumn('purchase_request_id');
            });
        }

        Schema::dropIfExists('purchase_request_routes');
        Schema::dropIfExists('purchase_request_items');
        Schema::dropIfExists('purchase_requests');
    }
};

