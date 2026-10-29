<?php

namespace Tests\Feature;

use App\Models\Office;
use App\Models\MonitoringProject;
use App\Models\Ppmp;
use App\Models\PpmpItem;
use App\Models\ProcurementMode;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class ProcurementModeManagementTest extends TestCase
{
    use RefreshDatabase;

    private User $superAdmin;
    private User $admin;
    private User $endUser;
    private Office $office;

    protected function setUp(): void
    {
        parent::setUp();

        $this->office = Office::create([
            'name' => 'Office of the Provincial Governor',
            'code' => 'OPG',
        ]);

        $this->superAdmin = User::create([
            'name' => 'Super Administrator',
            'email' => 'superadmin@example.com',
            'password' => bcrypt('password123'),
            'role' => 'super_admin',
            'office_id' => $this->office->id,
            'approval_status' => 'approved',
            'is_active' => true,
        ]);

        $this->admin = User::create([
            'name' => 'Admin User',
            'email' => 'admin@example.com',
            'password' => bcrypt('password123'),
            'role' => 'admin',
            'office_id' => $this->office->id,
            'approval_status' => 'approved',
            'is_active' => true,
        ]);

        $this->endUser = User::create([
            'name' => 'End User',
            'email' => 'enduser@example.com',
            'password' => bcrypt('password123'),
            'role' => 'end_user',
            'office_id' => $this->office->id,
            'approval_status' => 'approved',
            'is_active' => true,
        ]);

        // Seed initial modes if table is refreshed
        if (ProcurementMode::count() === 0) {
            $this->seedModes();
        }
    }

    private function seedModes(): void
    {
        $modes = [
            ['name' => 'Competitive Bidding (RA 12009)', 'code' => 'CB', 'display_order' => 1, 'is_active' => true],
            ['name' => 'Small Value Procurement (RA 12009)', 'code' => 'SVP', 'display_order' => 2, 'is_active' => true],
            ['name' => 'Lease of Venue', 'code' => 'LV', 'display_order' => 3, 'is_active' => true],
            ['name' => 'CB Thru Framework (RA 12009)', 'code' => 'CB-FW', 'display_order' => 4, 'is_active' => true],
            ['name' => 'Direct Contracting', 'code' => 'DC', 'display_order' => 5, 'is_active' => true],
            ['name' => 'Agency to Agency', 'code' => 'A2A', 'display_order' => 6, 'is_active' => true],
            ['name' => 'Shopping B', 'code' => 'SHOP-B', 'display_order' => 7, 'is_active' => true],
            ['name' => 'POL', 'code' => 'POL', 'display_order' => 8, 'is_active' => true],
            ['name' => 'Consulting', 'code' => 'CONSULT', 'display_order' => 9, 'is_active' => true],
            ['name' => 'Scholarly, Artistic work, Exclusive Technology and Media Services', 'code' => 'ART-MEDIA', 'display_order' => 10, 'is_active' => true],
            ['name' => 'Emergency Cases (RA 12009)', 'code' => 'EMERGENCY', 'display_order' => 11, 'is_active' => true],
            ['name' => 'Negotiated Procurement - Sagip Saka Under 11321', 'code' => 'SAGIP-SAKA', 'display_order' => 12, 'is_active' => true],
            ['name' => 'Direct Acquisition Under RA 12009', 'code' => 'DA', 'display_order' => 13, 'is_active' => true],
            ['name' => 'A to A Thru RGP', 'code' => 'A2A-RGP', 'display_order' => 14, 'is_active' => true],
        ];

        foreach ($modes as $mode) {
            ProcurementMode::create($mode);
        }
    }

    public function test_seeded_modes_exist_in_database(): void
    {
        $this->assertDatabaseHas('procurement_modes', [
            'name' => 'Competitive Bidding (RA 12009)',
            'code' => 'CB',
        ]);
        $this->assertDatabaseHas('procurement_modes', [
            'name' => 'Small Value Procurement (RA 12009)',
            'code' => 'SVP',
        ]);
        $this->assertDatabaseHas('procurement_modes', [
            'name' => 'A to A Thru RGP',
            'code' => 'A2A-RGP',
        ]);
    }

    public function test_end_user_receives_active_modes_only(): void
    {
        // Deactivate one mode
        $mode = ProcurementMode::where('code', 'LV')->first();
        $mode->update(['is_active' => false]);

        $response = $this->actingAs($this->endUser)->getJson('/api/procurement-modes');

        $response->assertStatus(200);
        $names = collect($response->json())->pluck('name')->toArray();

        $this->assertContains('Competitive Bidding (RA 12009)', $names);
        $this->assertNotContains('Lease of Venue', $names);
    }

    public function test_admin_can_view_all_modes_with_usage_counts(): void
    {
        // Create an inactive mode
        $inactive = ProcurementMode::create([
            'name' => 'Special Modality Test',
            'code' => 'SMT',
            'is_active' => false,
            'display_order' => 99,
        ]);

        $response = $this->actingAs($this->admin)->getJson('/api/procurement-modes');

        $response->assertStatus(200);
        $names = collect($response->json())->pluck('name')->toArray();

        $this->assertContains('Special Modality Test', $names);
        $this->assertArrayHasKey('usage_count', $response->json()[0]);
    }

    public function test_non_admin_cannot_create_or_modify_modes(): void
    {
        $createResponse = $this->actingAs($this->endUser)->postJson('/api/procurement-modes', [
            'name' => 'Unauthorized Mode',
            'code' => 'UM',
        ]);
        $createResponse->assertStatus(403);

        $target = ProcurementMode::first();

        $updateResponse = $this->actingAs($this->endUser)->putJson("/api/procurement-modes/{$target->id}", [
            'name' => 'Hacked Mode',
        ]);
        $updateResponse->assertStatus(403);

        $toggleResponse = $this->actingAs($this->endUser)->patchJson("/api/procurement-modes/{$target->id}/toggle-status");
        $toggleResponse->assertStatus(403);

        $deleteResponse = $this->actingAs($this->endUser)->deleteJson("/api/procurement-modes/{$target->id}");
        $deleteResponse->assertStatus(403);
    }

    public function test_admin_can_create_new_procurement_mode(): void
    {
        $payload = [
            'name' => 'Two-Stage Competitive Bidding',
            'code' => 'TSCB',
            'description' => 'Two-stage competitive bidding process under RA 12009 rules.',
            'is_active' => true,
            'display_order' => 15,
        ];

        $response = $this->actingAs($this->admin)->postJson('/api/procurement-modes', $payload);

        $response->assertStatus(201);
        $this->assertDatabaseHas('procurement_modes', [
            'name' => 'Two-Stage Competitive Bidding',
            'code' => 'TSCB',
        ]);
    }

    public function test_admin_can_update_mode_and_synchronize_existing_records(): void
    {
        $mode = ProcurementMode::where('code', 'LV')->first();

        // Create a PPMP item referencing this mode
        $ppmp = Ppmp::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'ppmp_number' => 'PPMP-2026-0001',
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
            'user_id' => $this->endUser->id,
            'title' => 'Test Seminar PPMP',
            'fiscal_year' => '2026',
            'status' => 'draft',
        ]);

        $item = PpmpItem::create([
            'ppmp_id' => $ppmp->id,
            'description' => 'Hotel Venue Rental',
            'project_type' => 'Goods',
            'procurement_mode' => 'Lease of Venue',
            'estimated_budget' => 50000,
        ]);

        // Create a Monitoring project referencing this mode
        $proj = MonitoringProject::create([
            'ppmp_id' => $ppmp->id,
            'project_title' => 'Venue Rental Monitoring',
            'category' => 'GOODS_CONSULTING',
            'procurement_mode' => 'Lease of Venue',
            'current_division' => 'pr_division',
            'status' => 'IN_PROGRESS',
        ]);

        $updateResponse = $this->actingAs($this->admin)->putJson("/api/procurement-modes/{$mode->id}", [
            'name' => 'Lease of Real Property and Venue (RA 12009)',
            'code' => 'LRPV',
            'is_active' => true,
        ]);

        $updateResponse->assertStatus(200);

        // Verify PPMP item and Monitoring project were synchronized to new name
        $this->assertEquals('Lease of Real Property and Venue (RA 12009)', $item->fresh()->procurement_mode);
        $this->assertEquals('Lease of Real Property and Venue (RA 12009)', $proj->fresh()->procurement_mode);
    }

    public function test_admin_can_toggle_mode_status(): void
    {
        $mode = ProcurementMode::where('code', 'LV')->first();
        $this->assertTrue($mode->is_active);

        $response = $this->actingAs($this->admin)->patchJson("/api/procurement-modes/{$mode->id}/toggle-status");
        $response->assertStatus(200);

        $this->assertFalse($mode->fresh()->is_active);
    }

    public function test_admin_cannot_delete_mode_in_use(): void
    {
        $mode = ProcurementMode::where('code', 'CB')->first();

        // Attach an item to this mode
        $ppmp = Ppmp::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'ppmp_number' => 'PPMP-2026-0002',
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
            'user_id' => $this->endUser->id,
            'title' => 'Bidding Project',
            'fiscal_year' => '2026',
            'status' => 'draft',
        ]);

        PpmpItem::create([
            'ppmp_id' => $ppmp->id,
            'description' => 'Heavy Equipment',
            'project_type' => 'Goods',
            'procurement_mode' => $mode->name,
            'estimated_budget' => 2000000,
        ]);

        $deleteResponse = $this->actingAs($this->admin)->deleteJson("/api/procurement-modes/{$mode->id}");
        $deleteResponse->assertStatus(422);

        $this->assertDatabaseHas('procurement_modes', ['id' => $mode->id]);
    }

    public function test_admin_can_delete_unused_mode(): void
    {
        $mode = ProcurementMode::create([
            'name' => 'Temporary Test Mode',
            'code' => 'TTM',
            'is_active' => true,
        ]);

        $deleteResponse = $this->actingAs($this->admin)->deleteJson("/api/procurement-modes/{$mode->id}");
        $deleteResponse->assertStatus(200);

        $this->assertDatabaseMissing('procurement_modes', ['id' => $mode->id]);
    }
}
