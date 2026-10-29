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
            [
                'name' => 'Provincial Bids & Awards Portal',
                'description' => 'Public bidding opportunities, PhilGEPS posting coordination, notices of award, and procurement transparency documentation for suppliers and citizens.',
                'link_url' => '/eprocrementppmpapp',
                'badge' => 'BAC Transparency',
                'icon' => 'Shield',
                'color' => 'amber',
                'status' => 'active',
                'sort_order' => 3,
                'is_external' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);

        // Seed default OPPMO Team members
        DB::table('oppmo_team_members')->insert([
            [
                'name' => 'NORJANNA M. CAMAGUIN, MPA',
                'position' => 'Provincial Government Department Head',
                'division' => 'Executive Office / BAC Secretariat',
                'bio' => 'Oversees the strategic procurement operations, compliance oversight, and workflow governance for the Province of Davao del Sur.',
                'photo_url' => null,
                'email' => 'oppmo@davaodelsur.gov.ph',
                'sort_order' => 1,
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'GINA MAE B. CARBAQUEL',
                'position' => 'Administrative Assistant II (ADAS II)',
                'division' => 'Procurement Review & Document Custody',
                'bio' => 'Manages document verification, official PPMP intake, and BAC Secretariat correspondence for all implementing offices.',
                'photo_url' => null,
                'email' => 'bac.secretariat@davaodelsur.gov.ph',
                'sort_order' => 2,
                'status' => 'active',
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'DESSAMIE BUAT-SANCHEZ, CPA, JD',
                'position' => 'PGDH - Provincial Budget Officer / BAC Chairman',
                'division' => 'Bids & Awards Committee (BAC)',
                'bio' => 'Presides over committee procurement deliberations, budget allotment certifications, and provincial bidding approvals.',
                'photo_url' => null,
                'email' => 'pbo@davaodelsur.gov.ph',
                'sort_order' => 3,
                'status' => 'active',
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
