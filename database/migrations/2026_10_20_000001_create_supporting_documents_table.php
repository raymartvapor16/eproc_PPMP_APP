<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('supporting_documents', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('display_order')->default(0);
            $table->timestamps();
        });

        $now = Carbon::now();

        // Seed initial standard supporting documents requested by user
        DB::table('supporting_documents')->insertOrIgnore([
            [
                'name' => '3 Pre Canvass',
                'description' => 'Three official pre-canvass price quotations from qualified suppliers',
                'is_active' => true,
                'display_order' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Market Scoping',
                'description' => 'Market scoping assessment and price verification analysis report',
                'is_active' => true,
                'display_order' => 2,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Latest PO',
                'description' => 'Copy of latest Purchase Order (PO) or historical procurement pricing reference',
                'is_active' => true,
                'display_order' => 3,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'List of Attachment',
                'description' => 'PPMP detailed breakdown of items / List of Attachment sheet',
                'is_active' => true,
                'display_order' => 4,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Activity Design / Project Proposal',
                'description' => 'Approved Activity Design, Program of Work, or Project Concept Proposal',
                'is_active' => true,
                'display_order' => 5,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Technical Specifications',
                'description' => 'Detailed technical specifications, Terms of Reference (TOR), or Scope of Work',
                'is_active' => true,
                'display_order' => 6,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Purchase Request (PR)',
                'description' => 'Official Purchase Request document with complete account and item details',
                'is_active' => true,
                'display_order' => 7,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('supporting_documents');
    }
};
