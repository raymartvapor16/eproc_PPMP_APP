<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        Schema::table('offices', function (Blueprint $table) {
            $table->string('head_name')->nullable()->after('head_user_id');
            $table->string('designation')->nullable()->after('head_name');
            $table->string('responsibility_number')->nullable()->after('designation');
        });
    }

    public function down(): void
    {
        Schema::table('offices', function (Blueprint $table) {
            $table->dropColumn(['head_name', 'designation', 'responsibility_number']);
        });
    }
};
