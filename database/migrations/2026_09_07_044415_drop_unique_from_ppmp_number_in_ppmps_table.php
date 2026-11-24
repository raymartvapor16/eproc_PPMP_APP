<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        Schema::table('ppmps', function (Blueprint $table) {
            $table->dropUnique('ppmps_ppmp_number_unique');

            $table->unique('tracking_number');
        });
    }

    public function down(): void
    {
        try {
            Schema::table('ppmps', function (Blueprint $table) {
                $table->dropUnique(['tracking_number']);
            });
        } catch (\Throwable $e) {

        }

        try {
            Schema::table('ppmps', function (Blueprint $table) {
                $table->unique('ppmp_number');
            });
        } catch (\Throwable $e) {

        }
    }
};
