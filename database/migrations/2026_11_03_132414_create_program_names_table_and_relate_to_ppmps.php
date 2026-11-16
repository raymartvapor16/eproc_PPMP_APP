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
        if (!Schema::hasTable('program_names')) {
            Schema::create('program_names', function (Blueprint $table) {
                $table->id();
                $table->string('name', 500);
                $table->string('responsibility_center', 100)->nullable();
                $table->string('sector', 150)->nullable()->index();
                $table->boolean('is_active')->default(true)->index();
                $table->integer('display_order')->default(0);
                $table->timestamps();

                // Unique index to prevent duplicate entries
                $table->unique(['name', 'responsibility_center'], 'uniq_prog_name_resp_ctr');
            });
        }

        if (Schema::hasTable('ppmps') && !Schema::hasColumn('ppmps', 'program_name_id')) {
            Schema::table('ppmps', function (Blueprint $table) {
                $table->foreignId('program_name_id')
                    ->nullable()
                    ->after('program_name')
                    ->constrained('program_names')
                    ->nullOnDelete();
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('ppmps') && Schema::hasColumn('ppmps', 'program_name_id')) {
            Schema::table('ppmps', function (Blueprint $table) {
                $table->dropForeign(['program_name_id']);
                $table->dropColumn('program_name_id');
            });
        }

        Schema::dropIfExists('program_names');
    }
};
