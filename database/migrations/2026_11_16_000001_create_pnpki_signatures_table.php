<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        if (!Schema::hasTable('pnpki_signatures')) {
            Schema::create('pnpki_signatures', function (Blueprint $table) {
                $table->id();
                $table->foreignId('user_id')
                    ->constrained('users')
                    ->cascadeOnDelete()
                    ->unique();
                $table->string('signature_type', 30)->default('pnpki');
                $table->date('expiration_date')->nullable();
                $table->string('proof_pdf_path')->nullable();
                $table->string('proof_original_name')->nullable();
                $table->string('signature_image_path')->nullable();
                $table->string('capture_method', 30)->default('drawn');
                $table->timestamps();

                $table->index(['signature_type', 'expiration_date']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('pnpki_signatures');
    }
};
