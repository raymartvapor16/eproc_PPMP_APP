<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        Schema::create('ppmp_signatories', function (Blueprint $table) {
            $table->id();
            $table->string('signatory_type');
            $table->string('name');
            $table->string('position');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ppmp_signatories');
    }
};
