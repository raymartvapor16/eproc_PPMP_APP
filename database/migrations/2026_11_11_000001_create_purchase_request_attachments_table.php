<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        Schema::create('purchase_request_attachments', function (Blueprint $table) {
            $table->id();
            $table->uuid('uuid')->unique();
            $table->foreignId('purchase_request_id')->constrained('purchase_requests')->cascadeOnDelete();
            $table->foreignId('uploaded_by')->nullable()->constrained('users')->nullOnDelete();
            $table->string('attachment_type', 30)->default('PDF_FILE');
            $table->string('original_filename')->nullable();
            $table->string('stored_filename')->nullable();
            $table->string('storage_path')->nullable();
            $table->unsignedBigInteger('file_size')->default(0);
            $table->string('mime_type')->default('application/pdf');
            $table->text('external_url')->nullable();
            $table->string('link_title')->nullable();
            $table->timestamps();

            $table->index('purchase_request_id');
            $table->index('attachment_type');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('purchase_request_attachments');
    }
};
