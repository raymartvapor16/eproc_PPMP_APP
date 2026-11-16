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
        Schema::create('ppmp_cell_comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('ppmp_id')->constrained('ppmps')->cascadeOnDelete();
            $table->foreignId('item_id')->nullable()->constrained('ppmp_items')->nullOnDelete();
            $table->integer('item_no')->nullable();
            $table->string('field_key', 60);
            $table->string('field_label', 100)->nullable();
            $table->text('cell_value')->nullable();
            $table->text('comment');
            $table->foreignId('reviewer_id')->constrained('users')->cascadeOnDelete();
            $table->string('reviewer_name');
            $table->string('reviewer_role', 50);
            $table->string('status', 30)->default('pending')->index(); // 'pending', 'complied'
            $table->text('compliance_note')->nullable();
            $table->foreignId('complied_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('complied_at')->nullable();
            $table->timestamps();

            $table->index(['ppmp_id', 'status']);
            $table->index(['ppmp_id', 'item_id', 'field_key']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ppmp_cell_comments');
    }
};

