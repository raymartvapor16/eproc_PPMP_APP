<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('procurement_modes', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('code')->nullable();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('display_order')->default(0);
            $table->timestamps();
        });

        // Seed the 14 standard Philippine RA 12009 Modes of Procurement
        $modes = [
            [
                'name' => 'Competitive Bidding (RA 12009)',
                'code' => 'CB',
                'description' => 'Standard Competitive Bidding / Public Bidding procedure governed by Republic Act No. 12009 (New Government Procurement Act).',
                'is_active' => true,
                'display_order' => 1,
            ],
            [
                'name' => 'Small Value Procurement (RA 12009)',
                'code' => 'SVP',
                'description' => 'Alternative method of procurement for goods, infrastructure projects, and consulting services where amount does not exceed thresholds set by RA 12009.',
                'is_active' => true,
                'display_order' => 2,
            ],
            [
                'name' => 'Lease of Venue',
                'code' => 'LV',
                'description' => 'Procurement of lease of privately-owned venue for official meetings, seminars, conferences, and trainings.',
                'is_active' => true,
                'display_order' => 3,
            ],
            [
                'name' => 'CB Thru Framework (RA 12009)',
                'code' => 'CB-FW',
                'description' => 'Competitive Bidding executed through Framework Agreement arrangements pursuant to RA 12009.',
                'is_active' => true,
                'display_order' => 4,
            ],
            [
                'name' => 'Direct Contracting',
                'code' => 'DC',
                'description' => 'Single source procurement directly from a supplier with proprietary rights or exclusive distribution.',
                'is_active' => true,
                'display_order' => 5,
            ],
            [
                'name' => 'Agency to Agency',
                'code' => 'A2A',
                'description' => 'Procurement from another agency of the government that has the mandate and technical capability.',
                'is_active' => true,
                'display_order' => 6,
            ],
            [
                'name' => 'Shopping B',
                'code' => 'SHOP-B',
                'description' => 'Shopping for ordinary or regular office supplies and equipment not available in the DBM-PS under Sec. 52.1(b).',
                'is_active' => true,
                'display_order' => 7,
            ],
            [
                'name' => 'POL',
                'code' => 'POL',
                'description' => 'Petroleum, Oil, and Lubricants procurement under negotiated procurement guidelines.',
                'is_active' => true,
                'display_order' => 8,
            ],
            [
                'name' => 'Consulting',
                'code' => 'CONSULT',
                'description' => 'Procurement of specialized consultancy and professional advisory services.',
                'is_active' => true,
                'display_order' => 9,
            ],
            [
                'name' => 'Scholarly, Artistic work, Exclusive Technology and Media Services',
                'code' => 'ART-MEDIA',
                'description' => 'Procurement of highly specialized scholarly work, artistic creation, exclusive technology, and media broadcasting services.',
                'is_active' => true,
                'display_order' => 10,
            ],
            [
                'name' => 'Emergency Cases (RA 12009)',
                'code' => 'EMERGENCY',
                'description' => 'Negotiated procurement under imminent danger to life or property during an emergency or disaster response under RA 12009.',
                'is_active' => true,
                'display_order' => 11,
            ],
            [
                'name' => 'Negotiated Procurement - Sagip Saka Under 11321',
                'code' => 'SAGIP-SAKA',
                'description' => 'Direct purchase from recognized agricultural cooperatives and farmers/fisherfolk enterprises under the Sagip Saka Act (RA 11321).',
                'is_active' => true,
                'display_order' => 12,
            ],
            [
                'name' => 'Direct Acquisition Under RA 12009',
                'code' => 'DA',
                'description' => 'Direct acquisition modalities authorized under RA 12009 regulations.',
                'is_active' => true,
                'display_order' => 13,
            ],
            [
                'name' => 'A to A Thru RGP',
                'code' => 'A2A-RGP',
                'description' => 'Agency to Agency procurement conducted through recognized government printers (RGP).',
                'is_active' => true,
                'display_order' => 14,
            ],
        ];

        $now = now();
        foreach ($modes as &$mode) {
            $mode['created_at'] = $now;
            $mode['updated_at'] = $now;
        }

        DB::table('procurement_modes')->insert($modes);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('procurement_modes');
    }
};
