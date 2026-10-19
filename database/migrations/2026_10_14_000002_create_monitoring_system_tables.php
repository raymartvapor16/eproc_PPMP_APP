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
        Schema::create('monitoring_projects', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('ppmp_id')->nullable()->constrained('ppmps')->nullOnDelete();
            $table->string('project_title');
            $table->enum('category', ['GOODS_CONSULTING', 'INFRA'])->default('GOODS_CONSULTING');
            $table->string('procurement_mode')->default('SVP'); // SVP, CB, etc.
            $table->decimal('abc_amount', 15, 2)->nullable();
            $table->string('pr_number')->nullable();
            $table->foreignId('office_id')->nullable()->constrained('offices')->nullOnDelete();
            $table->string('implementing_unit')->nullable();
            $table->string('end_user_name')->nullable();
            $table->timestamp('pims_published_at')->nullable();
            $table->string('pims_status')->default('PUBLISHED');
            $table->string('current_division')->default('pr_division'); // pr_division, technical_division, bac_support_division, contracting_division, completed
            $table->string('status')->default('IN_PROGRESS'); // IN_PROGRESS, COMPLETED, SUSPENDED, RETURNED
            $table->text('remarks')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('monitoring_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('monitoring_project_id')->constrained('monitoring_projects')->cascadeOnDelete();
            $table->string('division'); // pr_division, technical_division, bac_support_division, contracting_division
            $table->string('step_name');
            $table->integer('step_order')->default(0);
            $table->string('status')->default('PENDING'); // PENDING, IN_PROGRESS, APPROVED, COMPLETED, SUSPENDED, RETURNED
            $table->string('decision')->nullable(); // awarded, re_canvass_1st, re_canvass_2nd, re_canvass_3rd, approved, suspended
            $table->date('action_date')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->string('handled_by')->nullable();
            $table->text('notes')->nullable();
            $table->string('special_badge')->nullable(); // e.g. for CB 'miss_sharia_release'
            $table->boolean('is_custom')->default(false);
            $table->timestamps();
        });

        Schema::create('monitoring_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('monitoring_project_id')->constrained('monitoring_projects')->cascadeOnDelete();
            $table->foreignId('step_id')->nullable()->constrained('monitoring_steps')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action'); // CREATED, STEP_ADDED, STEP_UPDATED, STEP_DELETED, STATUS_CHANGED, NOTE_ADDED
            $table->string('division')->nullable();
            $table->text('description');
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('monitoring_histories');
        Schema::dropIfExists('monitoring_steps');
        Schema::dropIfExists('monitoring_projects');
    }
};
