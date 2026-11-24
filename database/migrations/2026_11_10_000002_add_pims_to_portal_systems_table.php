<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        if (Schema::hasTable('portal_systems')) {
            if (!DB::table('portal_systems')->where('link_url', '/pims')->exists()) {
                DB::table('portal_systems')->insert([
                    'name' => 'Procurement Information Management System (PIMS)',
                    'description' => 'Comprehensive procurement surveillance, Purchase Request (PR) generation, and multi-stage evaluation across provincial offices.',
                    'link_url' => '/pims',
                    'badge' => 'PIMS Portal',
                    'icon' => 'Layers',
                    'color' => 'purple',
                    'status' => 'active',
                    'sort_order' => 4,
                    'is_external' => false,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('portal_systems')) {
            DB::table('portal_systems')->where('link_url', '/pims')->delete();
        }
    }
};
