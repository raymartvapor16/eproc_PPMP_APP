<?php

namespace Tests\Feature;

use App\Models\Office;
use App\Models\OppmoTeamMember;
use App\Models\PortalSystem;
use App\Models\MonitoringProject;
use App\Models\Ppmp;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PortalAndMonitoringSystemTest extends TestCase
{
    use RefreshDatabase;

    protected User $superAdmin;
    protected User $admin;
    protected User $endUser;
    protected Office $office;

    protected function setUp(): void
    {
        parent::setUp();

        $this->office = Office::create([
            'code' => 'OPPMO',
            'name' => 'Provincial Procurement Management Office',
            'is_active' => true,
        ]);

        $this->superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'superadmin@example.com',
            'username' => 'superadmin',
            'password' => bcrypt('password'),
            'role' => 'super_admin',
            'office_id' => $this->office->id,
            'is_active' => true,
        ]);

        $this->admin = User::create([
            'name' => 'System Admin',
            'email' => 'admin@example.com',
            'username' => 'sysadmin',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'office_id' => $this->office->id,
            'is_active' => true,
        ]);

        $this->endUser = User::create([
            'name' => 'End User Test',
            'email' => 'enduser@example.com',
            'username' => 'enduser1',
            'password' => bcrypt('password'),
            'role' => 'end_user',
            'office_id' => $this->office->id,
            'is_active' => true,
            'accessible_systems' => ['/eprocrementppmpapp'],
        ]);
    }

    public function test_public_can_fetch_portal_systems(): void
    {
        PortalSystem::create([
            'name' => 'E-Procurement PPMP/APP System',
            'description' => 'System description',
            'link_url' => '/eprocrementppmpapp',
            'sort_order' => 1,
            'status' => 'active',
        ]);

        $res = $this->getJson('/api/public-portal-systems');
        $res->assertOk();
        $this->assertGreaterThanOrEqual(1, count($res->json('systems') ?? $res->json()));
    }

    public function test_super_admin_can_manage_portal_systems(): void
    {
        $this->actingAs($this->superAdmin);

        // Create
        $res = $this->postJson('/api/portal-systems', [
            'name' => 'OPPMO Monitoring System',
            'description' => 'Procurement progress tracking and monitoring',
            'link_url' => '/monitoringsystem',
            'badge' => 'Active',
            'icon' => 'Layers',
            'color' => 'blue',
            'sort_order' => 2,
            'status' => 'active',
        ]);
        $res->assertCreated();
        $this->assertDatabaseHas('portal_systems', ['name' => 'OPPMO Monitoring System']);

        $systemId = $res->json('system.id');

        // Update
        $updateRes = $this->putJson("/api/portal-systems/{$systemId}", [
            'name' => 'OPPMO Monitoring System Updated',
            'description' => 'Updated description',
            'link_url' => '/monitoringsystem',
        ]);
        $updateRes->assertOk();
        $this->assertDatabaseHas('portal_systems', ['name' => 'OPPMO Monitoring System Updated']);

        // Delete
        $delRes = $this->deleteJson("/api/portal-systems/{$systemId}");
        $delRes->assertOk();
        $this->assertDatabaseMissing('portal_systems', ['id' => $systemId]);
    }

    public function test_non_super_admin_cannot_manage_portal_systems(): void
    {
        $this->actingAs($this->endUser);
        $res = $this->postJson('/api/portal-systems', [
            'name' => 'Hacker System',
            'link_url' => '/hacker',
        ]);
        $res->assertForbidden();
    }

    public function test_super_admin_can_manage_oppmo_team(): void
    {
        Storage::fake('local');
        $this->actingAs($this->superAdmin);

        $photo = UploadedFile::fake()->image('member.jpg');

        $res = $this->postJson('/api/oppmo-team', [
            'name' => 'Jane Doe',
            'position' => 'Procurement Officer',
            'division' => 'Technical Division',
            'sort_order' => 1,
            'status' => 'active',
            'photo' => $photo,
        ]);

        $res->assertCreated();
        $this->assertDatabaseHas('oppmo_team_members', ['name' => 'Jane Doe']);

        $member = \App\Models\OppmoTeamMember::where('name', 'Jane Doe')->first();
        $this->assertNotNull($member->photo_url);
        $this->assertStringStartsWith('/api/oppmo-team-photo/', $member->photo_url);

        $photoRes = $this->get($member->photo_url);
        $photoRes->assertOk();
    }

    public function test_registration_with_requested_accessible_systems(): void
    {
        $signature = 'data:image/png;base64,' . base64_encode('fake-signature-bytes');

        $res = $this->postJson('/api/register', [
            'name' => 'New Staff',
            'username' => 'newstaff',
            'email' => 'newstaff@example.com',
            'phone_number' => '09123456789',
            'address' => 'Capitol Compound, Digos City',
            'designation' => 'Administrative Assistant II',
            'signature' => $signature,
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => 'end_user',
            'office_id' => $this->office->id,
            'accessible_systems' => ['/eprocrementppmpapp', '/monitoringsystem'],
        ]);

        $res->assertCreated();
        $user = User::where('email', 'newstaff@example.com')->first();
        $this->assertNotNull($user);
        $this->assertContains('/eprocrementppmpapp', $user->accessible_systems);
        $this->assertContains('/monitoringsystem', $user->accessible_systems);
    }

    public function test_admin_can_update_user_system_access(): void
    {
        $this->actingAs($this->admin);

        $res = $this->putJson("/api/users/{$this->endUser->id}/system-access", [
            'accessible_systems' => ['/eprocrementppmpapp', '/monitoringsystem'],
        ]);

        $res->assertOk();
        $this->endUser->refresh();
        $this->assertTrue($this->endUser->canAccessSystem('/monitoringsystem'));
    }

    public function test_monitoring_access_control(): void
    {
        // 1. User without /monitoringsystem receives 403
        $this->actingAs($this->endUser);
        $res = $this->getJson('/api/monitoring/stats');
        $res->assertForbidden();

        // 2. Grant access
        $this->endUser->update(['accessible_systems' => ['/eprocrementppmpapp', '/monitoringsystem']]);
        $resAllowed = $this->getJson('/api/monitoring/stats');
        $resAllowed->assertOk();

        // 3. Super admin and admin always allowed
        $this->actingAs($this->superAdmin);
        $this->getJson('/api/monitoring/stats')->assertOk();

        $this->actingAs($this->admin);
        $this->getJson('/api/monitoring/stats')->assertOk();
    }

    public function test_end_user_can_view_monitoring_project_but_cannot_add_edit_or_delete_steps(): void
    {
        $this->actingAs($this->superAdmin);
        $project = MonitoringProject::create([
            'project_title' => 'Test Medical Supplies',
            'category' => 'GOODS_CONSULTING',
            'procurement_mode' => 'SVP',
            'abc_amount' => 50000,
            'status' => 'IN_PROGRESS',
            'current_division' => 'pr_division',
            'pims_status' => 'PUBLISHED',
            'created_by' => $this->superAdmin->id,
        ]);
        $project->initializeDefaultSteps();
        $step = $project->steps()->first();

        // End user with /monitoringsystem access
        $this->endUser->update(['accessible_systems' => ['/monitoringsystem']]);
        $this->actingAs($this->endUser);

        // 1. Can view project details
        $this->getJson("/api/monitoring/projects/{$project->id}")->assertOk();

        // 2. Cannot add step
        $this->postJson("/api/monitoring/projects/{$project->id}/steps", [
            'division' => 'pr_division',
            'step_name' => 'Unauthorized custom step',
        ])->assertForbidden();

        // 3. Cannot update step
        $this->putJson("/api/monitoring/steps/{$step->id}", [
            'status' => 'COMPLETED',
        ])->assertForbidden();

        // 4. Cannot update PIMS PR ID
        $this->patchJson("/api/monitoring/projects/{$project->id}/pr-id", [
            'pims_pr_id' => 'PR-UNAUTHORIZED-01',
        ])->assertForbidden();

        // 5. Cannot delete step
        $this->deleteJson("/api/monitoring/steps/{$step->id}")->assertForbidden();

        // 6. Cannot delete project
        $this->deleteJson("/api/monitoring/projects/{$project->id}")->assertForbidden();

        // 7. Admin CAN perform manage actions
        $this->actingAs($this->admin);
        $this->putJson("/api/monitoring/steps/{$step->id}", [
            'status' => 'COMPLETED',
        ])->assertOk();

        // 8. Head and all reviewers (budget_officer, twg, pacco) cannot manage (view-only)
        foreach (['head', 'budget_officer', 'twg', 'pacco'] as $restrictedRole) {
            $restrictedUser = User::factory()->create([
                'role' => $restrictedRole,
                'office_id' => $this->office->id,
                'accessible_systems' => ['/monitoringsystem'],
            ]);
            $this->actingAs($restrictedUser);

            // Can view project
            $this->getJson("/api/monitoring/projects/{$project->id}")->assertOk();

            // Cannot add, edit, or delete step
            $this->postJson("/api/monitoring/projects/{$project->id}/steps", [
                'division' => 'pr_division',
                'step_name' => 'Restricted step',
            ])->assertForbidden();

            $this->putJson("/api/monitoring/steps/{$step->id}", [
                'status' => 'COMPLETED',
            ])->assertForbidden();

            $this->deleteJson("/api/monitoring/steps/{$step->id}")->assertForbidden();
        }
    }

    public function test_monitoring_merges_amended_ppmp_with_same_tracker_no(): void
    {
        $this->actingAs($this->superAdmin);

        // 1. Create baseline PPMP
        $baseline = Ppmp::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'ppmp_number' => '1',
            'tracking_number' => 'TEST-TRACKER-001',
            'title' => 'Office Equipment Supplies',
            'fiscal_year' => '2026',
            'total_budget' => 75000,
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
            'status' => 'READY_FOR_PRINTING',
            'is_annual' => true,
        ]);

        // Sync to monitoring
        MonitoringProject::syncFromPpmp($baseline, true);
        $this->assertEquals(1, MonitoringProject::count());

        // 2. Create child amended PPMP with same tracking number
        $amended = Ppmp::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'ppmp_number' => '1',
            'parent_id' => $baseline->id,
            'tracking_number' => 'TEST-TRACKER-001',
            'title' => 'Office Equipment Supplies (Amended)',
            'fiscal_year' => '2026',
            'total_budget' => 85000,
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
            'status' => 'OPPMO_REVIEW',
            'is_annual' => false,
            'amendment_type' => 'AMENDMENT',
        ]);

        // Sync again
        MonitoringProject::syncFromPpmp($amended);

        // Must still be EXACTLY 1 monitored project card (no duplicate)
        $this->assertEquals(1, MonitoringProject::count());

        $project = MonitoringProject::first();
        $this->assertEquals('TEST-TRACKER-001', $project->pr_number);
        $this->assertEquals($amended->id, $project->ppmp_id);
        $this->assertEquals(85000, (float) $project->abc_amount);
        $this->assertTrue($project->is_amended);
        $this->assertEquals('AMENDED PPMP', $project->amendment_badge);
        $this->assertCount(2, $project->amendment_history);
    }

    public function test_app_data_end_user_resolution(): void
    {
        // 1. With program: Implementing Office / Unit - Program
        $ppmpWithProgram = new Ppmp([
            'implementing_unit' => 'OPPMO',
            'program_name' => 'SDFGSDGF',
            'app_data' => [
                'rows' => [
                    ['endUser' => 'SDFGSDGF', 'projectTitle' => 'Item 1'],
                    ['endUser' => 'OPPMO', 'projectTitle' => 'Item 2'],
                    ['endUser' => '', 'projectTitle' => 'Item 3'],
                ],
            ],
        ]);

        $rowsWithProgram = $ppmpWithProgram->app_data['rows'];
        $this->assertEquals('OPPMO - SDFGSDGF', $rowsWithProgram[0]['endUser']);
        $this->assertEquals('OPPMO - SDFGSDGF', $rowsWithProgram[1]['endUser']);
        $this->assertEquals('OPPMO - SDFGSDGF', $rowsWithProgram[2]['endUser']);

        // 2. Without program: Implementing Office / Unit only
        $ppmpWithoutProgram = new Ppmp([
            'implementing_unit' => 'OPPMO',
            'program_name' => null,
            'app_data' => [
                'rows' => [
                    ['endUser' => '', 'projectTitle' => 'Item 1'],
                    ['endUser' => 'Implementing Unit', 'projectTitle' => 'Item 2'],
                ],
            ],
        ]);

        $rowsWithoutProgram = $ppmpWithoutProgram->app_data['rows'];
        $this->assertEquals('OPPMO', $rowsWithoutProgram[0]['endUser']);
        $this->assertEquals('OPPMO', $rowsWithoutProgram[1]['endUser']);
    }

    public function test_attachment_list_cannot_exceed_ppmp_allocated_budget(): void
    {
        $ppmp = Ppmp::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'ppmp_number' => '1',
            'tracking_number' => 'TEST-ATTACH-001',
            'title' => 'Office Laptop Supplies',
            'fiscal_year' => '2026',
            'total_budget' => 500000,
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
            'status' => 'DRAFT',
            'is_annual' => false,
        ]);

        $item = $ppmp->items()->create([
            'item_no' => 1,
            'description' => 'Procurement of Laptops',
            'estimated_budget' => 500000,
            'is_header' => false,
        ]);

        // 1. Exceeds budget (₱555,500 > ₱500,000) -> 422 rejected
        $overBudgetResponse = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$ppmp->uuid}/attachment-list", [
            'office_name' => 'OPPMO',
            'project_title' => 'Procurement of Laptops',
            'total_budget' => 555500,
            'active_item_id' => $item->id,
            'rows' => [
                ['description' => 'Laptop Unit A', 'qty' => 500, 'unitCost' => 1111, 'totalCost' => 555500],
            ],
        ]);

        $overBudgetResponse->assertStatus(422);
        $overBudgetResponse->assertJsonFragment([
            'message' => 'Cannot save: The Total Cost (₱555,500.00) of the PPMP List of Attachment exceeds the Allocated Budget (₱500,000.00) from the PPMP data by ₱55,500.00. The total cost must coincide with or be lower than the Allocated Budget.',
        ]);

        // 2. Coincides with budget (₱500,000 == ₱500,000) -> 200 accepted
        $coincidingResponse = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$ppmp->uuid}/attachment-list", [
            'office_name' => 'OPPMO',
            'project_title' => 'Procurement of Laptops',
            'total_budget' => 500000,
            'active_item_id' => $item->id,
            'rows' => [
                ['description' => 'Laptop Unit A', 'qty' => 500, 'unitCost' => 1000, 'totalCost' => 500000],
            ],
        ]);

        $coincidingResponse->assertStatus(200);

        // 3. Lower than budget (₱400,000 < ₱500,000) -> 200 accepted
        $lowerResponse = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$ppmp->uuid}/attachment-list", [
            'office_name' => 'OPPMO',
            'project_title' => 'Procurement of Laptops',
            'total_budget' => 400000,
            'active_item_id' => $item->id,
            'rows' => [
                ['description' => 'Laptop Unit A', 'qty' => 400, 'unitCost' => 1000, 'totalCost' => 400000],
            ],
        ]);

        $lowerResponse->assertStatus(200);
    }
}
