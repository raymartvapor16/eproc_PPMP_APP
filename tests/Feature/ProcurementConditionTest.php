<?php

namespace Tests\Feature;

use App\Models\Office;
use App\Models\Ppmp;
use App\Models\ProcurementCondition;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProcurementConditionTest extends TestCase
{
    use RefreshDatabase;

    protected User $adminUser;
    protected User $endUser;
    protected Office $office;

    protected function setUp(): void
    {
        parent::setUp();

        $this->office = Office::create([
            'name' => 'Provincial General Services Office',
            'code' => 'PGSO',
        ]);

        $this->adminUser = User::factory()->create([
            'role' => 'admin',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $this->endUser = User::factory()->create([
            'role' => 'end_user',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
    }

    public function test_seeded_procurement_conditions_exist()
    {
        $this->assertDatabaseHas('procurement_conditions', [
            'name' => 'Catering Services: With Date/Schedule',
            'place_of_delivery' => 'PGSO Warehouse/On-site',
            'delivery_period' => 'Date of Activity',
            'payment_method' => 'Staggered Delivery/Credit-basis',
        ]);

        $this->assertDatabaseHas('procurement_conditions', [
            'name' => 'Catering Services: Without Schedule',
            'place_of_delivery' => 'PGSO Warehouse/On-site',
            'delivery_period' => 'As Per Demand by the End-User',
            'payment_method' => 'Staggered Delivery/Credit-basis',
        ]);

        $this->assertDatabaseHas('procurement_conditions', [
            'name' => 'POL Condition',
            'place_of_delivery' => null,
            'delivery_period' => null,
            'payment_method' => null,
        ]);

        $this->assertDatabaseHas('procurement_conditions', [
            'name' => 'Water',
            'place_of_delivery' => 'PGSO Warehouse/on-site',
            'payment_method' => 'Staggered Payment/Credit-basis',
        ]);

        $this->assertDatabaseHas('procurement_conditions', [
            'name' => 'Travelling',
            'place_of_delivery' => 'PGSO warehouse/on-site',
            'delivery_period' => 'On the Schedule date',
            'payment_method' => 'One-time Payment/cash-basis',
        ]);
    }

    public function test_end_user_can_fetch_active_conditions_and_dropdown_options()
    {
        ProcurementCondition::create([
            'name' => 'Inactive Condition',
            'place_of_delivery' => 'Secret Location',
            'delivery_period' => 'Never',
            'payment_method' => 'None',
            'is_active' => false,
        ]);

        $response = $this->actingAs($this->endUser)
            ->getJson('/api/procurement-conditions?with_options=1');

        $response->assertStatus(200);
        $data = $response->json();

        $this->assertArrayHasKey('conditions', $data);
        $this->assertArrayHasKey('delivery_periods', $data);
        $this->assertArrayHasKey('places_of_delivery', $data);
        $this->assertArrayHasKey('payment_methods', $data);

        $names = collect($data['conditions'])->pluck('name');
        $this->assertTrue($names->contains('Catering Services: With Date/Schedule'));
        $this->assertFalse($names->contains('Inactive Condition'));
    }

    public function test_admin_can_create_new_procurement_condition()
    {
        $payload = [
            'name' => 'IT Equipment & Hardware Delivery',
            'place_of_delivery' => 'PGSO Warehouse - IT Inspection Area',
            'delivery_period' => '45 Calendar Days upon receipt of NTP',
            'payment_method' => 'One-time Payment upon 100% inspection and acceptance',
            'other_terms' => 'Standard 1-year on-site warranty for parts and labor',
            'is_active' => true,
            'display_order' => 10,
        ];

        $response = $this->actingAs($this->adminUser)
            ->postJson('/api/procurement-conditions', $payload);

        $response->assertStatus(201);
        $this->assertDatabaseHas('procurement_conditions', [
            'name' => 'IT Equipment & Hardware Delivery',
            'place_of_delivery' => 'PGSO Warehouse - IT Inspection Area',
        ]);
    }

    public function test_admin_can_update_procurement_condition()
    {
        $condition = ProcurementCondition::where('name', 'Travelling')->first();

        $response = $this->actingAs($this->adminUser)
            ->putJson("/api/procurement-conditions/{$condition->id}", [
                'name' => 'Travelling & Transportation Services',
                'place_of_delivery' => 'PGSO warehouse/on-site - Transport Terminal',
                'delivery_period' => 'On the designated travel date',
                'payment_method' => 'One-time Payment/cash-basis',
                'other_terms' => 'Fuel and driver included',
                'is_active' => true,
                'display_order' => 5,
            ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('procurement_conditions', [
            'id' => $condition->id,
            'name' => 'Travelling & Transportation Services',
            'place_of_delivery' => 'PGSO warehouse/on-site - Transport Terminal',
        ]);
    }

    public function test_admin_can_delete_procurement_condition()
    {
        $condition = ProcurementCondition::create([
            'name' => 'Temporary Condition',
            'place_of_delivery' => 'Temporary Area',
            'delivery_period' => 'Immediate',
            'payment_method' => 'Cash',
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->adminUser)
            ->deleteJson("/api/procurement-conditions/{$condition->id}");

        $response->assertStatus(200);
        $this->assertDatabaseMissing('procurement_conditions', [
            'id' => $condition->id,
        ]);
    }

    public function test_end_user_cannot_mutate_procurement_conditions()
    {
        $condition = ProcurementCondition::first();

        $this->actingAs($this->endUser)
            ->postJson('/api/procurement-conditions', [
                'name' => 'Unauthorized Condition',
            ])
            ->assertStatus(403);

        $this->actingAs($this->endUser)
            ->putJson("/api/procurement-conditions/{$condition->id}", [
                'name' => 'Modified Name',
            ])
            ->assertStatus(403);

        $this->actingAs($this->endUser)
            ->deleteJson("/api/procurement-conditions/{$condition->id}")
            ->assertStatus(403);
    }

    public function test_ppmp_saves_additional_condition_and_extended_text_terms()
    {
        $polTermsText = "POL Condition:\n-Staggered Delivery based on the latest fuel pump price /At Gasoline Station\n-Staggered Payment: The end-user must ensure that payment is processed within 10 calendar days upon receiving the billing from the supplier/Credit-basis.\n-The supplier reserves the right to discontinue services if payment is not made after two consecutive billings and will resume only after the outstanding obligations are settled.";

        $payload = [
            'ppmp_number' => 'PPMP-2026-POL-001',
            'title' => 'Procurement of Fuel, Oil, and Lubricants (POL) for Provincial Heavy Equipment',
            'source_of_fund' => 'General Fund and etc..',
            'fiscal_year' => '2026',
            'plan_type' => 'INDICATIVE',
            'additional_condition' => 'POL Condition',
            'place_of_delivery' => null,
            'delivery_period' => null,
            'payment_method' => null,
            'warranty_and_other_terms' => $polTermsText,
            'items' => [
                [
                    'description' => 'Diesel Fuel Euro 4',
                    'project_type' => 'Goods',
                    'quantity_size' => '5,000 Liters',
                    'procurement_mode' => 'Direct Contracting (RA 12009)',
                    'estimated_budget' => 350000,
                ],
            ],
        ];

        $response = $this->actingAs($this->endUser)
            ->postJson('/api/ppmps', $payload);

        $response->assertStatus(201);
        $ppmp = Ppmp::where('ppmp_number', 'PPMP-2026-POL-001')->first();

        $this->assertNotNull($ppmp);
        $this->assertEquals('POL Condition', $ppmp->additional_condition);

        $this->assertNull($ppmp->place_of_delivery);
        $this->assertNull($ppmp->delivery_period);
        $this->assertNull($ppmp->payment_method);
        $this->assertEquals($polTermsText, $ppmp->warranty_and_other_terms);
        $this->assertStringContainsString('-Staggered Delivery based on the latest fuel pump price /At Gasoline Station', $ppmp->warranty_and_other_terms);
        $this->assertStringContainsString('-Staggered Payment: The end-user must ensure that payment is processed within 10 calendar days', $ppmp->warranty_and_other_terms);
        $this->assertStringContainsString('-The supplier reserves the right to discontinue services if payment is not made after two consecutive billings', $ppmp->warranty_and_other_terms);
    }
}
