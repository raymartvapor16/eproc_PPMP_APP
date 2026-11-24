<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {

        Schema::create('ppmps', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->string('ppmp_number')->unique();
            $table->foreignId('office_id')->constrained('offices')->cascadeOnDelete();
            $table->foreignId('created_by')->constrained('users')->cascadeOnDelete();
            $table->string('title');
            $table->string('source_of_fund')->nullable()->default('General Fund');
            $table->string('fiscal_year', 10);
            $table->enum('plan_type', ['INDICATIVE', 'FINAL'])->default('INDICATIVE');
            $table->string('delivery_period')->nullable();
            $table->string('place_of_delivery')->nullable();
            $table->string('payment_method')->nullable();
            $table->decimal('total_budget', 18, 2)->default(0.00);

            $table->enum('status', [
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
            ])->default('DRAFT')->index();

            $table->timestamps();
        });

        Schema::create('ppmp_milestones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ppmp_id')->unique()->constrained('ppmps')->cascadeOnDelete();
            $table->timestamp('prepared_at')->nullable();
            $table->timestamp('head_submitted_at')->nullable();
            $table->timestamp('head_received_at')->nullable();
            $table->timestamp('head_approved_at')->nullable();
            $table->timestamp('review_submitted_at')->nullable();
            $table->timestamp('budget_received_at')->nullable();
            $table->timestamp('budget_approved_at')->nullable();
            $table->timestamp('pacco_received_at')->nullable();
            $table->timestamp('pacco_approved_at')->nullable();
            $table->timestamp('oppmo_received_at')->nullable();
            $table->timestamp('oppmo_approved_at')->nullable();
            $table->timestamp('twg_received_at')->nullable();
            $table->timestamp('twg_approved_at')->nullable();
            $table->timestamp('ready_to_print_at')->nullable();
            $table->timestamp('enduser_received_at')->nullable();
            $table->timestamp('admin_received_at')->nullable();
            $table->timestamps();
        });

        Schema::create('ppmp_amendments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ppmp_id')->unique()->constrained('ppmps')->cascadeOnDelete();
            $table->string('amendment_status', 30)->nullable()->index();
            $table->string('requested_amendment_type', 50)->nullable();
            $table->text('requested_amendment_reason')->nullable();
            $table->string('requested_amendment_scope', 50)->nullable();
            $table->string('amendment_type', 50)->nullable();
            $table->text('amendment_reason')->nullable();
            $table->string('amendment_scope', 50)->nullable();
            $table->timestamp('amendment_requested_at')->nullable();
            $table->timestamp('amendment_approved_at')->nullable();
            $table->timestamps();
        });

        Schema::create('ppmp_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ppmp_id')->constrained('ppmps')->cascadeOnDelete();
            $table->integer('item_no')->default(1);
            $table->text('description');
            $table->string('project_type')->nullable();
            $table->string('quantity_size')->nullable();
            $table->string('procurement_mode')->nullable();
            $table->boolean('pre_proc_conference')->default(false);
            $table->string('start_date')->nullable();
            $table->string('end_date')->nullable();
            $table->string('delivery_period')->nullable();
            $table->string('source_of_fund')->nullable();
            $table->decimal('estimated_budget', 18, 2)->nullable()->default(null);
            $table->text('supporting_docs_text')->nullable();
            $table->text('remarks')->nullable();
            $table->timestamps();
        });

        Schema::create('ppmp_attachments', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('ppmp_id')->constrained('ppmps')->cascadeOnDelete();
            $table->foreignId('uploaded_by')->constrained('users')->cascadeOnDelete();
            $table->string('original_filename');
            $table->string('stored_filename');
            $table->string('storage_path');
            $table->string('mime_type')->default('application/pdf');
            $table->unsignedBigInteger('file_size')->default(0);
            $table->timestamps();
        });

        Schema::create('ppmp_reviews', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ppmp_id')->constrained('ppmps')->cascadeOnDelete();
            $table->foreignId('reviewer_id')->constrained('users')->cascadeOnDelete();
            $table->string('reviewer_role');
            $table->enum('action', ['approve', 'return']);
            $table->text('remarks');
            $table->string('status_before');
            $table->string('status_after');
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->timestamp('acted_at');
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamps();
        });

        Schema::create('ppmp_signatures', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ppmp_id')->constrained('ppmps')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('role');
            $table->string('signature_type');
            $table->text('signature_indicator');
            $table->string('signer_name');
            $table->string('signer_designation')->nullable();
            $table->timestamp('signed_at');
            $table->unsignedBigInteger('review_id')->nullable();
            $table->timestamps();
        });

        Schema::create('ppmp_routes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ppmp_id')->constrained('ppmps')->cascadeOnDelete();
            $table->foreignId('from_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('to_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('from_role');
            $table->string('to_role');
            $table->string('action');
            $table->string('status');
            $table->text('remarks')->nullable();
            $table->timestamp('submitted_at')->nullable();
            $table->timestamp('received_at')->nullable();
            $table->timestamp('acted_at')->nullable();
            $table->timestamps();
        });

        Schema::create('ppmp_change_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ppmp_id')->constrained('ppmps')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('role');
            $table->string('field_name');
            $table->text('old_value')->nullable();
            $table->text('new_value')->nullable();
            $table->string('action')->default('update');
            $table->unsignedBigInteger('review_id')->nullable();
            $table->timestamps();
        });

        Schema::create('audit_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action');
            $table->string('entity_type');
            $table->unsignedBigInteger('entity_id')->nullable();
            $table->json('old_values')->nullable();
            $table->json('new_values')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->text('user_agent')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('system_notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('ppmp_id')->nullable()->constrained('ppmps')->nullOnDelete();
            $table->string('type')->default('info');
            $table->string('title');
            $table->text('message');
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_notifications');
        Schema::dropIfExists('audit_logs');
        Schema::dropIfExists('ppmp_change_logs');
        Schema::dropIfExists('ppmp_routes');
        Schema::dropIfExists('ppmp_signatures');
        Schema::dropIfExists('ppmp_reviews');
        Schema::dropIfExists('ppmp_attachments');
        Schema::dropIfExists('ppmp_items');
        Schema::dropIfExists('ppmp_amendments');
        Schema::dropIfExists('ppmp_milestones');
        Schema::dropIfExists('ppmps');
    }
};
