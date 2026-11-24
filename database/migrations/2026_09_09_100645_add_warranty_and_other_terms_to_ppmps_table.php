<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        Schema::table('ppmps', function (Blueprint $table) {
            $table->text('warranty_and_other_terms')->nullable()->after('payment_method');
        });
    }

    public function down(): void
    {
        Schema::table('ppmps', function (Blueprint $table) {
            $table->dropColumn('warranty_and_other_terms');
        });
    }
};
