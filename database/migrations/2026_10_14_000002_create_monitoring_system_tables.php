<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        Schema::create('monitoring_projects', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('ppmp_id')->nullable()->constrained('ppmps')->nullOnDelete();
            $table->string('project_title');
            $table->enum('category', ['GOODS_CONSULTING', 'INFRA'])->default('GOODS_CONSULTING');
            $table->string('procurement_mode')->default('SVP');
            $table->decimal('abc_amount', 15, 2)->nullable();
            $table->string('pr_number')->nullable();
            $table->foreignId('office_id')->nullable()->constrained('offices')->nullOnDelete();
            $table->string('implementing_unit')->nullable();
            $table->string('end_user_name')->nullable();
            $table->timestamp('pims_published_at')->nullable();
            $table->string('pims_status')->default('PUBLISHED');
            $table->string('current_division')->default('pr_division');
            $table->string('status')->default('IN_PROGRESS');
            $table->text('remarks')->nullable();
            $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });

        Schema::create('monitoring_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('monitoring_project_id')->constrained('monitoring_projects')->cascadeOnDelete();
            $table->string('division');
            $table->string('step_name');
            $table->integer('step_order')->default(0);
            $table->string('status')->default('PENDING');
            $table->string('decision')->nullable();
            $table->date('action_date')->nullable();
            $table->timestamp('completed_at')->nullable();
            $table->string('handled_by')->nullable();
            $table->text('notes')->nullable();
            $table->string('special_badge')->nullable();
            $table->boolean('is_custom')->default(false);
            $table->timestamps();
        });

        Schema::create('monitoring_histories', function (Blueprint $table) {
            $table->id();
            $table->foreignId('monitoring_project_id')->constrained('monitoring_projects')->cascadeOnDelete();
            $table->foreignId('step_id')->nullable()->constrained('monitoring_steps')->nullOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action');
            $table->string('division')->nullable();
            $table->text('description');
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('monitoring_histories');
        Schema::dropIfExists('monitoring_steps');
        Schema::dropIfExists('monitoring_projects');
    }
};
