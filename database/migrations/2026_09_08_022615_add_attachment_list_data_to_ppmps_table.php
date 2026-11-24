<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        Schema::table('ppmps', function (Blueprint $table) {
            $table->json('attachment_list_data')->nullable()->after('payment_method');
        });
    }

    public function down(): void
    {
        Schema::table('ppmps', function (Blueprint $table) {
            $table->dropColumn('attachment_list_data');
        });
    }
};
