<?php

namespace Tests\Feature;

use App\Models\Office;
use App\Models\Ppmp;
use App\Models\ProgramName;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ProgramNameManagementTest extends TestCase
{
    use RefreshDatabase;

    protected User $adminUser;
    protected User $superAdminUser;
    protected User $endUser;
    protected Office $office;
    protected ProgramName $program;

    protected function setUp(): void
    {
        parent::setUp();

        $this->office = Office::create([
            'name' => 'Office of the Provincial Governor',
            'code' => 'OPG',
            'is_active' => true,
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

        $this->program = ProgramName::create([
            'name' => 'SUPPORT TO LOCAL FINANCE COMMITTEE',
            'responsibility_center' => '1999-25',
            'sector' => 'I. GENERAL PUBLIC SERVICES',
            'is_active' => true,
            'display_order' => 1,
        ]);
    }

    public function test_admin_and_super_admin_can_list_paginated_programs(): void
    {
        $res = $this->actingAs($this->adminUser)->getJson('/api/program-names?page=1&per_page=15');
        $res->assertOk();
        $res->assertJsonStructure([
            'data',
            'current_page',
            'total',
            'per_page',
            'last_page',
        ]);

        // Stats endpoint
        $resStats = $this->actingAs($this->superAdminUser)->getJson('/api/program-names/stats');
        $resStats->assertOk();
        $resStats->assertJsonStructure(['total', 'active', 'inactive', 'sectors', 'total_ppmps_linked']);
    }

    public function test_admin_can_create_program_and_prevents_duplicate(): void
    {
        $payload = [
            'name' => 'SUPPORT TO PROVINCIAL HEALTH BOARD',
            'responsibility_center' => '1999-45',
            'sector' => 'I. GENERAL PUBLIC SERVICES',
            'is_active' => true,
        ];

        $res = $this->actingAs($this->adminUser)->postJson('/api/program-names', $payload);
        $res->assertStatus(201);
        $this->assertDatabaseHas('program_names', [
            'name' => 'SUPPORT TO PROVINCIAL HEALTH BOARD',
            'responsibility_center' => '1999-45',
            'sector' => 'I. GENERAL PUBLIC SERVICES',
        ]);

        // Duplicate insertion must fail with 422
        $dupRes = $this->actingAs($this->adminUser)->postJson('/api/program-names', $payload);
        $dupRes->assertStatus(422);
    }

    public function test_admin_can_update_and_toggle_status(): void
    {
        $updateRes = $this->actingAs($this->adminUser)->putJson("/api/program-names/{$this->program->id}", [
            'name' => 'UPDATED SUPPORT TO LOCAL FINANCE COMMITTEE',
            'responsibility_center' => '1999-25',
            'sector' => 'I. GENERAL PUBLIC SERVICES',
            'display_order' => 5,
        ]);

        $updateRes->assertOk();
        $this->assertEquals('UPDATED SUPPORT TO LOCAL FINANCE COMMITTEE', $this->program->fresh()->name);
        $this->assertEquals(5, $this->program->fresh()->display_order);

        // Toggle status
        $toggleRes = $this->actingAs($this->adminUser)->patchJson("/api/program-names/{$this->program->id}/toggle-status");
        $toggleRes->assertOk();
        $this->assertFalse($this->program->fresh()->is_active);

        $toggleRes2 = $this->actingAs($this->adminUser)->patchJson("/api/program-names/{$this->program->id}/toggle-status");
        $toggleRes2->assertOk();
        $this->assertTrue($this->program->fresh()->is_active);
    }

    public function test_cannot_delete_program_linked_to_ppmp(): void
    {
        $ppmp = Ppmp::create([
            'uuid' => (string) Str::uuid(),
            'tracking_number' => 'PROG-TEST-001',
            'ppmp_number' => '1',
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
            'title' => 'Test PPMP for Program Name',
            'program_name' => $this->program->name,
            'program_name_id' => $this->program->id,
            'fiscal_year' => '2026',
            'plan_type' => 'INDICATIVE',
            'status' => 'DRAFT',
            'total_budget' => 50000,
        ]);

        // Trying to delete must be blocked with 422
        $delRes = $this->actingAs($this->adminUser)->deleteJson("/api/program-names/{$this->program->id}");
        $delRes->assertStatus(422);
        $delRes->assertJsonFragment([
            'message' => "Cannot delete program \"{$this->program->name}\" because it is currently linked to 1 PPMP record(s). You can deactivate it instead to prevent new selections."
        ]);

        // Unlink PPMP, now delete succeeds
        $ppmp->update(['program_name_id' => null]);
        $delSuccessRes = $this->actingAs($this->adminUser)->deleteJson("/api/program-names/{$this->program->id}");
        $delSuccessRes->assertOk();
        $this->assertDatabaseMissing('program_names', ['id' => $this->program->id]);
    }

    public function test_non_admin_cannot_manage_programs(): void
    {
        $this->actingAs($this->endUser)->postJson('/api/program-names', [
            'name' => 'Unauthorized Program',
        ])->assertStatus(403);

        $this->actingAs($this->endUser)->putJson("/api/program-names/{$this->program->id}", [
            'name' => 'Hacked Program',
        ])->assertStatus(403);

        $this->actingAs($this->endUser)->deleteJson("/api/program-names/{$this->program->id}")
            ->assertStatus(403);
    }

    public function test_end_user_can_fetch_dropdown_and_ppmp_links_program(): void
    {
        // End user fetches active programs for dropdown
        $res = $this->actingAs($this->endUser)->getJson('/api/program-names?dropdown=1');
        $res->assertOk();
        $this->assertIsArray($res->json());
        $this->assertTrue(collect($res->json())->contains('id', $this->program->id));

        // Create PPMP with program_name_id
        $createRes = $this->actingAs($this->endUser)->postJson('/api/ppmps', [
            'title' => 'PPMP Catering for LFC Meetings',
            'program_name_id' => $this->program->id,
            'source_of_fund' => 'General Fund',
            'fiscal_year' => '2026',
            'plan_type' => 'INDICATIVE',
            'items' => [
                [
                    'description' => 'Snacks and Meals',
                    'project_type' => 'Goods',
                    'quantity_size' => '50 pax',
                    'procurement_mode' => 'Small Value Procurement (RA 12009)',
                    'estimated_budget' => 35000,
                ],
            ],
        ]);

        $createRes->assertStatus(201);
        $ppmpUuid = $createRes->json('ppmp.uuid') ?? $createRes->json('data.uuid');
        $this->assertNotEmpty($ppmpUuid, 'Failed to retrieve PPMP UUID from response: ' . $createRes->getContent());
        $ppmp = Ppmp::where('uuid', $ppmpUuid)->firstOrFail();

        // Verify normalized relationship!
        $this->assertEquals($this->program->id, $ppmp->program_name_id);
        $this->assertEquals($this->program->name, $ppmp->program_name);
        $this->assertNotNull($ppmp->programNameRef);
        $this->assertEquals('1999-25', $ppmp->programNameRef->responsibility_center);

        // Now update and remove program_name by sending null
        $updateRes = $this->actingAs($this->endUser)->putJson("/api/ppmps/{$ppmpUuid}", [
            'fiscal_year' => '2026',
            'plan_type' => 'INDICATIVE',
            'title' => 'PPMP Catering Package Updated',
            'implementing_unit' => 'Provincial Information and Communications Technology Office',
            'source_of_fund' => 'General Fund',
            'program_name' => null,
            'program_name_id' => null,
            'items' => [
                [
                    'description' => 'Catering services meal package',
                    'project_type' => 'Food Services',
                    'quantity_size' => '50 pax',
                    'procurement_mode' => 'Small Value Procurement (RA 12009)',
                    'estimated_budget' => 35000,
                ],
            ],
        ]);

        $updateRes->assertOk();
        $ppmp->refresh();

        $this->assertNull($ppmp->program_name, 'Program name should be removed (null).');
        $this->assertNull($ppmp->program_name_id, 'Program name ID should be removed (null).');
    }
}

