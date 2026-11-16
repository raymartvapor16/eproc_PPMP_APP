<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('portal_systems', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->text('description')->nullable();
            $table->string('link_url');
            $table->string('badge')->nullable();
            $table->string('icon')->nullable()->default('FileSpreadsheet');
            $table->string('color')->nullable()->default('blue');
            $table->string('status')->default('active'); // active, inactive
            $table->integer('sort_order')->default(0);
            $table->boolean('is_external')->default(false);
            $table->timestamps();
        });

        Schema::create('oppmo_team_members', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('position');
            $table->string('division')->nullable();
            $table->text('bio')->nullable();
            $table->string('photo_url')->nullable();
            $table->string('email')->nullable();
            $table->integer('sort_order')->default(0);
            $table->string('status')->default('active'); // active, inactive
            $table->timestamps();
        });

        // Seed default systems
        DB::table('portal_systems')->insert([
            [
                'name' => 'E-Procurement PPMP & APP System',
                'description' => 'Automated preparation, review lifecycle, e-signature validation, and consolidation of Project Procurement Management Plans (PPMP) and Annual Procurement Plans (APP).',
                'link_url' => '/eprocrementppmpapp',
                'badge' => 'Primary System',
                'icon' => 'FileSpreadsheet',
                'color' => 'blue',
                'status' => 'active',
                'sort_order' => 1,
                'is_external' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'OPPMO Real-Time Monitoring System',
                'description' => 'Procurement implementation monitoring, milestone stage tracking and purchase request timelines across provincial offices.',
                'link_url' => '/monitoringsystem',
                'badge' => 'Live Monitoring',
                'icon' => 'Activity',
                'color' => 'emerald',
                'status' => 'active',
                'sort_order' => 2,
                'is_external' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('oppmo_team_members');
        Schema::dropIfExists('portal_systems');
    }
};
