<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{

    public function up(): void
    {
        Schema::create('procurement_conditions', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->text('place_of_delivery')->nullable();
            $table->text('delivery_period')->nullable();
            $table->text('payment_method')->nullable();
            $table->text('other_terms')->nullable();
            $table->boolean('is_active')->default(true);
            $table->integer('display_order')->default(0);
            $table->timestamps();
        });

        if (Schema::hasTable('ppmps')) {
            Schema::table('ppmps', function (Blueprint $table) {
                if (!Schema::hasColumn('ppmps', 'additional_condition')) {
                    $table->string('additional_condition')->nullable()->after('payment_method');
                }
                $table->text('delivery_period')->nullable()->change();
                $table->text('place_of_delivery')->nullable()->change();
                $table->text('payment_method')->nullable()->change();
            });
        }

        $now = Carbon::now();
        DB::table('procurement_conditions')->insertOrIgnore([
            [
                'name' => 'Catering Services: With Date/Schedule',
                'place_of_delivery' => 'PGSO Warehouse/On-site',
                'delivery_period' => 'Date of Activity',
                'payment_method' => 'Staggered Delivery/Credit-basis',
                'other_terms' => null,
                'is_active' => true,
                'display_order' => 1,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Catering Services: Without Schedule',
                'place_of_delivery' => 'PGSO Warehouse/On-site',
                'delivery_period' => 'As Per Demand by the End-User',
                'payment_method' => 'Staggered Delivery/Credit-basis',
                'other_terms' => null,
                'is_active' => true,
                'display_order' => 2,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'POL Condition',
                'place_of_delivery' => null,
                'delivery_period' => null,
                'payment_method' => null,
                'other_terms' => "POL Condition:\n-Staggered Delivery based on the latest fuel pump price /At Gasoline Station\n-Staggered Payment: The end-user must ensure that payment is processed within 10 calendar days upon receiving the billing from the supplier/Credit-basis.\n-The supplier reserves the right to discontinue services if payment is not made after two consecutive billings and will resume only after the outstanding obligations are settled.",
                'is_active' => true,
                'display_order' => 3,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Water',
                'place_of_delivery' => 'PGSO Warehouse/on-site',
                'delivery_period' => "1st Delivery 10 calendar days upon receipt of P.O\n-Succeeding deliveries: upon request of the end-user or as per empty gallon",
                'payment_method' => 'Staggered Payment/Credit-basis',
                'other_terms' => null,
                'is_active' => true,
                'display_order' => 4,
                'created_at' => $now,
                'updated_at' => $now,
            ],
            [
                'name' => 'Travelling',
                'place_of_delivery' => 'PGSO warehouse/on-site',
                'delivery_period' => 'On the Schedule date',
                'payment_method' => 'One-time Payment/cash-basis',
                'other_terms' => null,
                'is_active' => true,
                'display_order' => 5,
                'created_at' => $now,
                'updated_at' => $now,
            ],
        ]);
    }

    public function down(): void
    {
        if (Schema::hasTable('ppmps') && Schema::hasColumn('ppmps', 'additional_condition')) {
            Schema::table('ppmps', function (Blueprint $table) {
                $table->dropColumn('additional_condition');
            });
        }

        Schema::dropIfExists('procurement_conditions');
    }
};
