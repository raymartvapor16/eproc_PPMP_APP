<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        Schema::create('fund_sources', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->string('code')->nullable();
            $table->enum('workflow_route', ['budget', 'pacco'])->default('budget');
            $table->text('description')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('display_order')->default(0);
            $table->timestamps();
        });

        DB::table('fund_sources')->insert([
            [
                'name' => 'General Fund and etc..',
                'code' => 'GF',
                'workflow_route' => 'budget',
                'description' => 'General Fund, 20% Development Fund, Special Education Fund (SEF), and standard budgetary allocations.',
                'is_active' => true,
                'display_order' => 1,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'name' => 'Trust Fund',
                'code' => 'TF',
                'workflow_route' => 'pacco',
                'description' => 'National agency subsidies, grants, trust deposits, and fiduciary funds requiring Provincial Accounting Office (PACCO) certification.',
                'is_active' => true,
                'display_order' => 2,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('fund_sources');
    }
};
