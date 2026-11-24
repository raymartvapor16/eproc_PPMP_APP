<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        Schema::table('ppmps', function (Blueprint $table) {
            $table->string('tracking_number')->nullable()->after('uuid');
        });

        DB::table('ppmps')->update([
            'tracking_number' => DB::raw('ppmp_number')
        ]);
    }

    public function down(): void
    {
        Schema::table('ppmps', function (Blueprint $table) {
            $table->dropColumn('tracking_number');
        });
    }
};
