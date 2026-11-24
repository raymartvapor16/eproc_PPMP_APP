<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('ppmp_market_scopings')) {
            Schema::create('ppmp_market_scopings', function (Blueprint $table) {
                $table->id();
                $table->foreignId('ppmp_id')->unique()->constrained('ppmps')->cascadeOnDelete();

                $table->string('procuring_entity', 255)->default('PROVINCIAL GOVERNMENT OF DAVAO DEL SUR');
                $table->string('implementing_unit', 255)->nullable();
                $table->string('representative_name_designation', 255)->nullable();

                $table->string('project_name', 500)->nullable();
                $table->decimal('estimated_budget', 15, 2)->nullable();
                $table->string('scoping_period_from', 25)->nullable();
                $table->string('scoping_period_to', 25)->nullable();
                $table->string('expected_delivery_date', 100)->nullable();

                $table->string('prepared_by_name', 255)->nullable();
                $table->string('prepared_by_position', 255)->nullable();
                $table->string('prepared_by_date', 50)->nullable();
                $table->string('approved_by_name', 255)->nullable();
                $table->string('approved_by_position', 255)->nullable();
                $table->string('approved_by_date', 50)->nullable();

                $table->foreignId('created_by')->nullable()->constrained('users')->nullOnDelete();
                $table->foreignId('updated_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('ppmp_market_scoping_activities')) {
            Schema::create('ppmp_market_scoping_activities', function (Blueprint $table) {
                $table->id();
                $table->foreignId('market_scoping_id')->constrained('ppmp_market_scopings')->cascadeOnDelete();
                $table->string('activity_code', 60);
                $table->boolean('is_checked')->default(false);
                $table->text('custom_activity_text')->nullable();
                $table->text('documentation_notes')->nullable();
                $table->unsignedSmallInteger('sort_order')->default(0);
                $table->timestamps();

                $table->unique(['market_scoping_id', 'activity_code'], 'ms_activities_scoping_code_unique');
            });
        }

        if (!Schema::hasTable('ppmp_market_scoping_results')) {
            Schema::create('ppmp_market_scoping_results', function (Blueprint $table) {
                $table->id();
                $table->foreignId('market_scoping_id')->constrained('ppmp_market_scopings')->cascadeOnDelete();
                $table->string('parameter_code', 60);
                $table->string('considered', 30)->nullable();
                $table->text('recommendations')->nullable();
                $table->unsignedSmallInteger('sort_order')->default(0);
                $table->timestamps();

                $table->unique(['market_scoping_id', 'parameter_code'], 'ms_results_scoping_param_unique');
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('ppmp_market_scoping_results');
        Schema::dropIfExists('ppmp_market_scoping_activities');
        Schema::dropIfExists('ppmp_market_scopings');
    }
};
