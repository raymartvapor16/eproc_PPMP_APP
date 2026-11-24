<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('security_threat_logs')) {
            Schema::create('security_threat_logs', function (Blueprint $table) {
                $table->id();
                $table->string('threat_type', 60)->index();
                $table->string('severity', 20)->default('medium')->index();
                $table->boolean('is_red_alert')->default(false)->index();
                $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
                $table->string('user_email')->nullable();
                $table->string('ip_address', 64)->nullable()->index();
                $table->string('forwarded_ips', 255)->nullable();
                $table->string('country', 100)->nullable();
                $table->string('region', 100)->nullable();
                $table->string('city', 100)->nullable();
                $table->string('isp', 150)->nullable();
                $table->decimal('latitude', 10, 6)->nullable();
                $table->decimal('longitude', 10, 6)->nullable();
                $table->string('http_method', 15)->nullable();
                $table->string('endpoint', 500)->nullable();
                $table->string('target_feature', 150)->nullable();
                $table->string('token_type', 60)->nullable();
                $table->string('token_preview', 255)->nullable();
                $table->text('user_agent')->nullable();
                $table->text('attack_vector')->nullable();
                $table->json('payload_summary')->nullable();
                $table->unsignedSmallInteger('status_code')->nullable();
                $table->boolean('is_resolved')->default(false)->index();
                $table->foreignId('resolved_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamp('resolved_at')->nullable();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('deleted_data_backups')) {
            Schema::create('deleted_data_backups', function (Blueprint $table) {
                $table->id();
                $table->string('table_name', 100)->index();
                $table->string('model_class', 180)->nullable();
                $table->string('record_id', 64)->nullable()->index();
                $table->string('record_uuid', 100)->nullable();
                $table->string('record_label', 255)->nullable();
                $table->boolean('is_force_delete')->default(false)->index();
                $table->foreignId('deleted_by')->nullable()->constrained('users')->nullOnDelete();
                $table->string('deleted_by_name', 150)->nullable();
                $table->string('ip_address', 64)->nullable();
                $table->string('location', 200)->nullable();
                $table->longText('payload');
                $table->timestamp('restored_at')->nullable();
                $table->foreignId('restored_by')->nullable()->constrained('users')->nullOnDelete();
                $table->timestamps();
            });
        }

        if (!Schema::hasTable('scheduled_database_backups')) {
            Schema::create('scheduled_database_backups', function (Blueprint $table) {
                $table->id();
                $table->string('filename', 255);
                $table->string('storage_path', 500);
                $table->unsignedBigInteger('size_bytes')->default(0);
                $table->string('trigger_type', 50)->default('scheduled_15day')->index();
                $table->foreignId('triggered_by')->nullable()->constrained('users')->nullOnDelete();
                $table->text('notes')->nullable();
                $table->timestamps();
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('scheduled_database_backups');
        Schema::dropIfExists('deleted_data_backups');
        Schema::dropIfExists('security_threat_logs');
    }
};
