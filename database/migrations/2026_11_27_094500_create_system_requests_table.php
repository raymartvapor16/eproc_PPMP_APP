<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('system_requests')) {
            return;
        }

        Schema::create('system_requests', function (Blueprint $table) {
            $table->id();
            $table->string('ticket_number', 40)->unique();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('office_id')->nullable()->constrained('offices')->nullOnDelete();
            $table->string('request_type', 30)->default('enhancement'); // bug_fix | enhancement
            $table->string('system_module', 50)->default('eproc_ppmp_app');
            $table->string('priority', 20)->default('medium'); // low | medium | high | urgent
            $table->string('subject', 180);
            $table->text('description');
            $table->string('attachment_path')->nullable();
            $table->string('attachment_original_name', 180)->nullable();
            $table->string('attachment_mime', 60)->nullable();
            $table->unsignedInteger('attachment_size')->nullable();
            $table->string('status', 30)->default('pending'); // pending | in_progress | resolved | rejected
            $table->text('admin_remarks')->nullable();
            $table->foreignId('handled_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('resolved_at')->nullable();
            $table->string('ip_address', 45)->nullable();
            $table->timestamps();

            $table->index(['status', 'created_at']);
            $table->index(['user_id', 'created_at']);
            $table->index('request_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('system_requests');
    }
};
