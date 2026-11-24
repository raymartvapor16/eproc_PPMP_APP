<?php

namespace Tests\Feature;

use App\Models\Office;
use App\Models\OtherTerm;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OtherTermManagementTest extends TestCase
{
    use RefreshDatabase;

    protected User $adminUser;
    protected User $superAdminUser;
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

        $this->superAdminUser = User::factory()->create([
            'role' => 'super_admin',
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

    public function test_seeded_other_terms_and_green_specs_exist()
    {

        $this->assertDatabaseHas('other_terms', [
            'name' => 'Green Spec: Multi-Copy Paper & Record Books',
            'category' => 'CSE',
        ]);

        $this->assertDatabaseHas('other_terms', [
            'name' => 'Green Spec: Plastic Chairs',
            'category' => 'CSE',
        ]);

        $this->assertDatabaseHas('other_terms', [
            'name' => 'Green Spec: Computer, Monitor & Laptop',
            'category' => 'NON-CSE',
        ]);

        $this->assertDatabaseHas('other_terms', [
            'name' => 'Green Spec: Food and Catering Services (buffet & packed meals)',
            'category' => 'NON-CSE',
        ]);

        $this->assertDatabaseHas('other_terms', [
            'name' => 'POL Condition (Fuel & Lubricants)',
            'category' => 'GENERAL',
        ]);
    }

    public function test_end_user_can_fetch_active_terms_only()
    {

        OtherTerm::where('name', 'Green Spec: Plastic Chairs')->update(['is_active' => false]);

        $response = $this->actingAs($this->endUser)
            ->getJson('/api/other-terms');

        $response->assertStatus(200);
        $names = collect($response->json())->pluck('name');

        $this->assertTrue($names->contains('Green Spec: Multi-Copy Paper & Record Books'));
        $this->assertFalse($names->contains('Green Spec: Plastic Chairs'));
    }

    public function test_admin_can_create_new_other_term()
    {
        $payload = [
            'name' => 'Solar Power Generator Specification',
            'category' => 'NON-CSE',
            'description' => '- Must meet Tier 1 photovoltaic cell efficiency standard of at least 21%\n- Inverter with 10-year manufacturer warranty',
            'is_active' => true,
            'display_order' => 25,
        ];

        $response = $this->actingAs($this->adminUser)
            ->postJson('/api/other-terms', $payload);

        $response->assertStatus(201);
        $this->assertDatabaseHas('other_terms', [
            'name' => 'Solar Power Generator Specification',
            'category' => 'NON-CSE',
        ]);
    }

    public function test_admin_can_update_other_term()
    {
        $term = OtherTerm::where('name', 'Green Spec: Plastic Chairs')->first();

        $response = $this->actingAs($this->adminUser)
            ->putJson("/api/other-terms/{$term->id}", [
                'name' => 'Green Spec: Plastic Chairs (Updated)',
                'category' => 'CSE',
                'description' => 'Updated ISO 14001 certification requirement',
                'is_active' => true,
                'display_order' => 2,
            ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('other_terms', [
            'id' => $term->id,
            'name' => 'Green Spec: Plastic Chairs (Updated)',
            'description' => 'Updated ISO 14001 certification requirement',
        ]);
    }

    public function test_admin_can_delete_other_term()
    {
        $term = OtherTerm::create([
            'name' => 'Temporary Obsolete Clause',
            'category' => 'GENERAL',
            'description' => 'Obsolete clause to be removed',
            'is_active' => true,
            'display_order' => 99,
        ]);

        $response = $this->actingAs($this->adminUser)
            ->deleteJson("/api/other-terms/{$term->id}");

        $response->assertStatus(200);
        $this->assertDatabaseMissing('other_terms', [
            'id' => $term->id,
        ]);
    }

    public function test_end_user_cannot_mutate_other_terms()
    {
        $term = OtherTerm::first();

        $this->actingAs($this->endUser)
            ->postJson('/api/other-terms', [
                'name' => 'Hacker Clause',
                'category' => 'CSE',
                'description' => 'Illegal injection',
            ])
            ->assertStatus(403);

        $this->actingAs($this->endUser)
            ->putJson("/api/other-terms/{$term->id}", [
                'name' => 'Modified Name',
                'description' => 'Modified Desc',
            ])
            ->assertStatus(403);

        $this->actingAs($this->endUser)
            ->deleteJson("/api/other-terms/{$term->id}")
            ->assertStatus(403);
    }
}
