<?php

namespace Tests\Feature;

use App\Models\FundSource;
use App\Models\Office;
use App\Models\Ppmp;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class FundSourceManagementTest extends TestCase
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
            'name' => 'Provincial Planning and Development Office',
            'code' => 'PPDO',
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

    public function test_seeded_fund_sources_exist()
    {
        $this->assertDatabaseHas('fund_sources', [
            'name' => 'General Fund and etc..',
            'workflow_route' => 'budget',
        ]);

        $this->assertDatabaseHas('fund_sources', [
            'name' => 'Trust Fund',
            'workflow_route' => 'pacco',
        ]);
    }

    public function test_end_user_can_view_active_fund_sources_only()
    {
        FundSource::create([
            'name' => 'Inactive Special Grant',
            'workflow_route' => 'budget',
            'is_active' => false,
        ]);

        $response = $this->actingAs($this->endUser)
            ->getJson('/api/fund-sources');

        $response->assertStatus(200);
        $names = collect($response->json())->pluck('name');

        $this->assertTrue($names->contains('General Fund and etc..'));
        $this->assertTrue($names->contains('Trust Fund'));
        $this->assertFalse($names->contains('Inactive Special Grant'));
    }

    public function test_admin_can_view_all_fund_sources_with_usage_counts()
    {
        FundSource::create([
            'name' => 'Inactive Special Grant',
            'workflow_route' => 'budget',
            'is_active' => false,
        ]);

        $response = $this->actingAs($this->adminUser)
            ->getJson('/api/fund-sources');

        $response->assertStatus(200);
        $names = collect($response->json())->pluck('name');

        $this->assertTrue($names->contains('Inactive Special Grant'));
        $this->assertArrayHasKey('ppmps_count', $response->json()[0]);
    }

    public function test_admin_can_create_new_fund_source()
    {
        $payload = [
            'name' => 'Special Education Fund (SEF)',
            'code' => 'SEF',
            'workflow_route' => 'budget',
            'description' => 'Dedicated educational procurement fund',
            'is_active' => true,
            'display_order' => 2,
        ];

        $response = $this->actingAs($this->adminUser)
            ->postJson('/api/fund-sources', $payload);

        $response->assertStatus(201);
        $this->assertDatabaseHas('fund_sources', [
            'name' => 'Special Education Fund (SEF)',
            'code' => 'SEF',
            'workflow_route' => 'budget',
        ]);
    }

    public function test_admin_can_update_fund_source_and_sync_ppmps()
    {
        $source = FundSource::create([
            'name' => 'Old Fund Name',
            'workflow_route' => 'budget',
            'is_active' => true,
        ]);

        $ppmp = Ppmp::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'ppmp_number' => 'PPMP-2026-0001',
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
            'title' => 'Test PPMP',
            'source_of_fund' => 'Old Fund Name',
            'fiscal_year' => 2026,
            'status' => 'DRAFT',
        ]);

        $response = $this->actingAs($this->adminUser)
            ->putJson("/api/fund-sources/{$source->id}", [
                'name' => 'New Updated Fund Name',
                'workflow_route' => 'pacco',
                'description' => 'Updated notes',
                'is_active' => true,
                'display_order' => 5,
            ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('fund_sources', [
            'id' => $source->id,
            'name' => 'New Updated Fund Name',
            'workflow_route' => 'pacco',
        ]);

        $this->assertEquals('New Updated Fund Name', $ppmp->fresh()->source_of_fund);
    }

    public function test_admin_cannot_delete_fund_source_linked_to_ppmps()
    {
        $source = FundSource::create([
            'name' => 'In-Use Fund',
            'workflow_route' => 'budget',
            'is_active' => true,
        ]);

        Ppmp::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'ppmp_number' => 'PPMP-2026-0002',
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
            'title' => 'Linked PPMP',
            'source_of_fund' => 'In-Use Fund',
            'fiscal_year' => 2026,
            'status' => 'DRAFT',
        ]);

        $response = $this->actingAs($this->adminUser)
            ->deleteJson("/api/fund-sources/{$source->id}");

        $response->assertStatus(422);
        $this->assertDatabaseHas('fund_sources', ['id' => $source->id]);
    }

    public function test_admin_can_delete_unlinked_fund_source()
    {
        $source = FundSource::create([
            'name' => 'Unused Fund Source',
            'workflow_route' => 'budget',
            'is_active' => true,
        ]);

        $response = $this->actingAs($this->adminUser)
            ->deleteJson("/api/fund-sources/{$source->id}");

        $response->assertStatus(200);
        $this->assertDatabaseMissing('fund_sources', ['id' => $source->id]);
    }

    public function test_end_user_cannot_manage_fund_sources()
    {
        $source = FundSource::first();

        $this->actingAs($this->endUser)
            ->postJson('/api/fund-sources', ['name' => 'Hacked Fund', 'workflow_route' => 'budget'])
            ->assertStatus(403);

        $this->actingAs($this->endUser)
            ->putJson("/api/fund-sources/{$source->id}", ['name' => 'Hacked Name', 'workflow_route' => 'budget'])
            ->assertStatus(403);

        $this->actingAs($this->endUser)
            ->deleteJson("/api/fund-sources/{$source->id}")
            ->assertStatus(403);
    }
}
