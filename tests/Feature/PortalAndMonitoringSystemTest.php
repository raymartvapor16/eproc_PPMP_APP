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

    public function test_pims_status_endpoint_reflects_active_and_inactive_status(): void
    {
        $pims = PortalSystem::where('link_url', '/pims')->first();
        if (!$pims) {
            $pims = PortalSystem::create([
                'name' => 'Procurement Information Management System (PIMS)',
                'description' => 'PIMS Module',
                'link_url' => '/pims',
                'sort_order' => 4,
                'status' => 'active',
            ]);
        } else {
            $pims->update(['status' => 'active']);
        }

        $res = $this->getJson('/api/portal-systems/pims-status');
        $res->assertOk();
        $this->assertTrue($res->json('is_active'));
        $this->assertEquals('active', $res->json('status'));

        $pims->update(['status' => 'inactive']);
        $resInactive = $this->getJson('/api/portal-systems/pims-status');
        $resInactive->assertOk();
        $this->assertFalse($resInactive->json('is_active'));
        $this->assertEquals('inactive', $resInactive->json('status'));
    }

    public function test_super_admin_can_manage_portal_systems(): void
    {
        $this->actingAs($this->superAdmin);

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

        $updateRes = $this->putJson("/api/portal-systems/{$systemId}", [
            'name' => 'OPPMO Monitoring System Updated',
            'description' => 'Updated description',
            'link_url' => '/monitoringsystem',
        ]);
        $updateRes->assertOk();
        $this->assertDatabaseHas('portal_systems', ['name' => 'OPPMO Monitoring System Updated']);

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
        $this->assertNotNull($user->pnpkiSignature);
        $this->assertEquals('optional', $user->pnpkiSignature->signature_type);
    }

    public function test_registration_with_pnpki_digital_signature_creates_normalized_record(): void
    {
        Storage::fake('local');
        $signature = 'data:image/png;base64,' . base64_encode('fake-signature-bytes');
        $pdfContent = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\n%%EOF";
        $proofPdf = UploadedFile::fake()->createWithContent('PNPKI_Certificate_Proof.pdf', $pdfContent);

        $res = $this->post('/api/register', [
            'name' => 'PNPKI Officer',
            'email' => 'pnpki.officer@example.com',
            'phone_number' => '09123456789',
            'address' => 'Capitol Compound, Digos City',
            'designation' => 'Administrative Officer IV',
            'signature' => $signature,
            'signature_type' => 'pnpki',
            'pnpki_expiration_date' => '2028-12-31',
            'pnpki_proof_pdf' => $proofPdf,
            'signature_capture_method' => 'uploaded',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'role' => 'end_user',
            'office_id' => $this->office->id,
            'accessible_systems' => json_encode(['/eprocrementppmpapp']),
        ]);

        $res->assertCreated();
        $user = User::with('pnpkiSignature')->where('email', 'pnpki.officer@example.com')->first();
        $this->assertNotNull($user);
        $this->assertNotNull($user->pnpkiSignature);
        $this->assertEquals('pnpki', $user->pnpkiSignature->signature_type);
        $this->assertEquals('2028-12-31', $user->pnpkiSignature->expiration_date->format('Y-m-d'));
        $this->assertEquals('uploaded', $user->pnpkiSignature->capture_method);
        $this->assertNotNull($user->pnpkiSignature->proof_pdf_path);
        $this->assertTrue(Storage::disk('local')->exists($user->pnpkiSignature->proof_pdf_path));

        $this->actingAs($this->superAdmin);
        $pdfRes = $this->get("/api/users/{$user->id}/pnpki-proof");
        $pdfRes->assertOk();

        $this->actingAs($this->endUser);
        $newProofPdf = UploadedFile::fake()->createWithContent('Updated_PNPKI_Proof.pdf', $pdfContent);
        $profileRes = $this->post('/api/profile', [
            'name' => 'Updated End User',
            'phone_number' => '09998887777',
            'address' => 'Matti, Digos City',
            'designation' => 'Admin Officer II',
            'signature' => $signature,
            'signature_type' => 'pnpki',
            'pnpki_expiration_date' => '2029-06-30',
            'pnpki_proof_pdf' => $newProofPdf,
            'signature_capture_method' => 'drawn',
        ]);
        $profileRes->assertOk();
        $this->endUser->refresh();
        $this->assertNotNull($this->endUser->pnpkiSignature);
        $this->assertEquals('pnpki', $this->endUser->pnpkiSignature->signature_type);
        $this->assertEquals('2029-06-30', $this->endUser->pnpkiSignature->expiration_date->format('Y-m-d'));

        $this->endUser->pnpkiSignature->update(['expiration_date' => '2020-01-15']);
        $this->endUser->refresh();
        $this->assertTrue($this->endUser->pnpkiSignature->is_expired);
        $this->assertTrue($this->endUser->pnpkiSignature->is_forced_optional);
        $this->assertEquals('optional', $this->endUser->pnpkiSignature->effective_signature_type);
        $this->assertEquals('2020-01-15', $this->endUser->pnpkiSignature->expiration_date->format('Y-m-d'));

        $optRes = $this->postJson('/api/profile/use-optional-signature');
        $optRes->assertOk();
        $this->endUser->refresh();
        $this->assertEquals('optional', $this->endUser->pnpkiSignature->signature_type);
        $this->assertEquals('2020-01-15', $this->endUser->pnpkiSignature->expiration_date->format('Y-m-d'));
        $this->assertNotNull($this->endUser->pnpkiSignature->proof_pdf_path);

        $renewedPdf = UploadedFile::fake()->createWithContent('Renewed_PNPKI_2030.pdf', $pdfContent);
        $renewRes = $this->post('/api/profile/renew-pnpki', [
            'pnpki_expiration_date' => '2030-12-31',
            'pnpki_proof_pdf' => $renewedPdf,
        ]);
        $renewRes->assertOk();
        $this->endUser->refresh();
        $this->assertEquals('pending', $this->endUser->pnpkiSignature->renewal_status);
        $this->assertEquals('2030-12-31', $this->endUser->pnpkiSignature->pending_expiration_date->format('Y-m-d'));
        $this->assertEquals('optional', $this->endUser->pnpkiSignature->effective_signature_type);

        $this->actingAs($this->admin);
        $this->postJson("/api/users/{$this->endUser->id}/pnpki-renewal/approve")->assertStatus(403);

        $this->actingAs($this->superAdmin);
        $approveRes = $this->postJson("/api/users/{$this->endUser->id}/pnpki-renewal/approve");
        $approveRes->assertOk();
        $this->endUser->refresh();
        $this->assertEquals('approved', $this->endUser->pnpkiSignature->renewal_status);
        $this->assertEquals('pnpki', $this->endUser->pnpkiSignature->signature_type);
        $this->assertFalse($this->endUser->pnpkiSignature->is_expired);
        $this->assertEquals('2030-12-31', $this->endUser->pnpkiSignature->expiration_date->format('Y-m-d'));
        $this->assertEquals('2020-01-15', $this->endUser->pnpkiSignature->previous_expiration_date->format('Y-m-d'));
        $this->assertNotNull($this->endUser->pnpkiSignature->previous_proof_pdf_path);
        $this->assertEquals(1, $this->endUser->pnpkiSignature->renewal_count);

        $otherUser = User::factory()->create(['role' => 'twg', 'office_id' => $this->office->id, 'is_active' => true]);
        $otherUser->pnpkiSignature()->create([
            'signature_type' => 'pnpki',
            'expiration_date' => '2031-05-01',
            'proof_pdf_path' => 'pnpki_proofs/other.pdf',
            'proof_original_name' => 'other.pdf',
        ]);

        $this->actingAs($this->endUser);
        $ownListRes = $this->getJson('/api/pnpki-signatures')->assertOk();
        $this->assertCount(1, $ownListRes->json('pnpki_signatures'));
        $this->assertEquals($this->endUser->id, $ownListRes->json('pnpki_signatures.0.user_id'));
        $this->get("/api/users/{$otherUser->id}/pnpki-proof")->assertStatus(403);

        $this->actingAs($this->superAdmin);
        $adminListRes = $this->getJson('/api/pnpki-signatures')->assertOk();
        $this->assertGreaterThanOrEqual(2, count($adminListRes->json('pnpki_signatures')));
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

        $this->actingAs($this->endUser);
        $res = $this->getJson('/api/monitoring/stats');
        $res->assertForbidden();

        $this->endUser->update(['accessible_systems' => ['/eprocrementppmpapp', '/monitoringsystem']]);
        $resAllowed = $this->getJson('/api/monitoring/stats');
        $resAllowed->assertOk();

        $this->actingAs($this->superAdmin);
        $this->getJson('/api/monitoring/stats')->assertOk();

        $this->actingAs($this->admin);
        $this->getJson('/api/monitoring/stats')->assertOk();
    }

    public function test_user_without_checked_system_access_is_forbidden(): void
    {

        $this->endUser->update(['accessible_systems' => ['/eprocrementppmpapp']]);
        $this->actingAs($this->endUser);
        $this->getJson('/api/pims/dashboard')->assertForbidden();
        $this->getJson('/api/monitoring/stats')->assertForbidden();
        $this->assertFalse($this->endUser->canAccessSystem('/pims'));
        $this->assertFalse($this->endUser->canAccessSystem('/monitoringsystem'));
        $this->assertTrue($this->endUser->canAccessSystem('/eprocrementppmpapp'));

        $this->endUser->update(['accessible_systems' => ['/eprocrementppmpapp', '/pims']]);
        $this->assertTrue($this->endUser->canAccessSystem('/pims'));
        $this->getJson('/api/pims/dashboard')->assertOk();

        $this->assertFalse($this->endUser->canAccessSystem('/monitoringsystem'));
        $this->getJson('/api/monitoring/stats')->assertForbidden();
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

        $this->endUser->update(['accessible_systems' => ['/monitoringsystem'], 'can_view_all_monitoring_ppmp' => true]);
        $this->actingAs($this->endUser);

        $this->getJson("/api/monitoring/projects/{$project->id}")->assertOk();

        $this->postJson("/api/monitoring/projects/{$project->id}/steps", [
            'division' => 'pr_division',
            'step_name' => 'Unauthorized custom step',
        ])->assertForbidden();

        $this->putJson("/api/monitoring/steps/{$step->id}", [
            'status' => 'COMPLETED',
        ])->assertForbidden();

        $this->patchJson("/api/monitoring/projects/{$project->id}/pr-id", [
            'pims_pr_id' => 'PR-UNAUTHORIZED-01',
        ])->assertForbidden();

        $this->deleteJson("/api/monitoring/steps/{$step->id}")->assertForbidden();

        $this->deleteJson("/api/monitoring/projects/{$project->id}")->assertForbidden();

        $this->actingAs($this->admin);
        $this->putJson("/api/monitoring/steps/{$step->id}", [
            'status' => 'COMPLETED',
        ])->assertStatus(422);

        $this->putJson("/api/monitoring/steps/{$step->id}", [
            'status' => 'COMPLETED',
            'completed_at' => '2026-11-23',
        ])->assertOk();

        foreach (['head', 'budget_officer', 'twg', 'pacco'] as $restrictedRole) {

            $restrictedUser = User::factory()->create([
                'role' => $restrictedRole,
                'office_id' => $this->office->id,
                'accessible_systems' => ['/monitoringsystem'],
                'can_view_all_monitoring_ppmp' => true,
            ]);
            $this->actingAs($restrictedUser);

            $this->getJson("/api/monitoring/projects/{$project->id}")->assertOk();

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

        MonitoringProject::syncFromPpmp($baseline, true);
        $this->assertEquals(1, MonitoringProject::count());

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

        MonitoringProject::syncFromPpmp($amended);

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
            'message' => 'Cannot save: The Total Cost (₱555,500.00) of the Detailed Specifications exceeds the Allocated Budget (₱500,000.00) from the PPMP data by ₱55,500.00. The total cost must coincide with or be lower than the Allocated Budget.',
        ]);

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

    public function test_cell_update_persists_for_ppmp_and_detailed_specifications(): void
    {
        $ppmp = Ppmp::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'tracking_number' => 'OPPMOGOODS-2026-888888',
            'ppmp_number' => '888888',
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
            'title' => 'Catering Services',
            'fiscal_year' => '2026',
            'plan_type' => 'FINAL',
            'total_budget' => 60000,
            'status' => 'TWG_RETURNED',
        ]);

        $item1 = \App\Models\PpmpItem::create([
            'ppmp_id' => $ppmp->id,
            'item_no' => 1,
            'description' => 'Catering without venue',
            'quantity_size' => '10 pax',
            'estimated_budget' => 50000,
            'is_header' => false,
        ]);

        $item2 = \App\Models\PpmpItem::create([
            'ppmp_id' => $ppmp->id,
            'item_no' => 2,
            'description' => 'Catering with venue',
            'quantity_size' => '10 pax',
            'estimated_budget' => 10000,
            'is_header' => false,
        ]);

        $ppmp->update([
            'attachment_list_data' => [
                'rows' => [
                    ['id' => 1, 'itemNo' => 1, 'unit' => 'pax', 'description' => 'sdfsdfgsdfgd', 'qty' => '50', 'unitCost' => '100', 'totalCost' => '5000'],
                ],
                'attachment_lists' => [
                    (string) $item1->id => [
                        'total_budget' => 50000,
                        'rows' => [
                            ['id' => 1, 'itemNo' => 1, 'unit' => 'pax', 'description' => 'sdfsdfgsdfgd', 'qty' => '50', 'unitCost' => '100', 'totalCost' => '5000'],
                        ],
                    ],
                    (string) $item2->id => [
                        'total_budget' => 10000,
                        'rows' => [
                            ['id' => 1, 'itemNo' => 1, 'unit' => 'pax', 'description' => 'Venue meal', 'qty' => '10', 'unitCost' => '500', 'totalCost' => '5000'],
                        ],
                    ],
                ],
            ],
        ]);

        $this->actingAs($this->endUser);

        $this->postJson("/api/ppmps/{$ppmp->uuid}/update-cell", [
            'field_key' => 'quantity_size',
            'field_label' => 'Quantity / Size',
            'value' => '25 pax',
            'item_id' => $item1->id,
            'item_no' => 1,
        ])->assertOk();

        $this->assertEquals('25 pax', $item1->fresh()->quantity_size);

        $this->postJson("/api/ppmps/{$ppmp->uuid}/update-cell", [
            'field_key' => 'att_r1_description',
            'field_label' => 'Detailed Specifications #1 • Row #1 Description',
            'value' => 'sdfsdfgsdfgd ok',
            'item_id' => $item1->id,
            'item_no' => 1,
        ])->assertOk();

        $this->postJson("/api/ppmps/{$ppmp->uuid}/update-cell", [
            'field_key' => 'att_r1_qty',
            'field_label' => 'Detailed Specifications #2 • Row #1 Quantity',
            'value' => '9',
            'item_id' => $item2->id,
            'item_no' => 2,
        ])->assertOk();

        $freshAtt = $ppmp->fresh()->attachment_list_data;
        $this->assertEquals('sdfsdfgsdfgd ok', $freshAtt['attachment_lists'][(string) $item1->id]['rows'][0]['description']);
        $this->assertEquals('9', $freshAtt['attachment_lists'][(string) $item2->id]['rows'][0]['qty']);
        $this->assertEquals('4500', $freshAtt['attachment_lists'][(string) $item2->id]['rows'][0]['totalCost']);
    }

    public function test_monitoring_step1_starts_pending_requires_admin_and_checks_ppmp_prerequisites(): void
    {
        $this->actingAs($this->endUser);

        $ppmp = Ppmp::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'ppmp_number' => 'PPMP-2026-999',
            'office_id' => $this->office->id,
            'implementing_unit' => $this->office->name,
            'created_by' => $this->endUser->id,
            'title' => 'Unfinished PPMP Published Early',
            'fiscal_year' => '2026',
            'tracking_number' => 'TRK-2026-999',
            'total_budget' => 100000,
            'status' => 'DRAFT',
        ]);

        $publishRes = $this->postJson('/api/monitoring/pims-publish', [
            'ppmp_uuid' => $ppmp->uuid,
            'project_title' => $ppmp->title,
            'category' => 'GOODS_CONSULTING',
            'procurement_mode' => 'Competitive Bidding (RA 12009)',
            'abc_amount' => 100000,
            'pr_number' => $ppmp->tracking_number,
        ]);
        $publishRes->assertCreated();

        $projectId = $publishRes->json('project.id');
        $step1 = collect($publishRes->json('project.steps'))->firstWhere('step_order', 1);

        $this->assertNotNull($step1);
        $this->assertEquals('PENDING', $step1['status']);

        $monitorUser = User::factory()->create([
            'role' => 'monitor',
            'office_id' => $this->office->id,
            'accessible_systems' => ['/monitoringsystem'],
        ]);
        $this->actingAs($monitorUser);
        $this->putJson("/api/monitoring/steps/{$step1['id']}", [
            'status' => 'SUSPENDED',
        ])->assertForbidden();

        $this->actingAs($this->admin);
        $failRes = $this->putJson("/api/monitoring/steps/{$step1['id']}", [
            'status' => 'COMPLETED',
            'completed_at' => '2026-11-23',
        ]);
        $failRes->assertStatus(422);
        $this->assertFalse($failRes->json('pims_review_checklist.all_approved'));
        $this->assertEquals('DRAFT', $failRes->json('pims_review_checklist.ppmp_status'));
        $this->assertEquals('Draft', $failRes->json('pims_review_checklist.ppmp_status_label'));

        $budgetReviewer = User::factory()->create([
            'name' => 'Budget Reviewer Jane',
            'role' => 'budget_officer',
            'office_id' => $this->office->id,
        ]);
        $ppmp->update([
            'status' => 'BUDGET_OFFICER_REVIEW',
            'budget_reviewer_id' => $budgetReviewer->id,
        ]);
        $showUnderReview = $this->getJson("/api/monitoring/projects/{$projectId}");
        $showUnderReview->assertOk();
        $this->assertTrue($showUnderReview->json('project.pims_review_checklist.ppmp_is_under_review'));
        $this->assertEquals('Budget Reviewer Jane', $showUnderReview->json('project.pims_review_checklist.ppmp_reviewer_name'));
        $this->assertEquals('Under Review (Budget Reviewer Jane)', $showUnderReview->json('project.pims_review_checklist.ppmp_status_label'));

        $this->putJson("/api/monitoring/steps/{$step1['id']}", [
            'status' => 'SUSPENDED',
            'completed_at' => '2026-11-23',
        ])->assertOk();

        $ppmp->update([
            'status' => 'READY_TO_PRINT',
            'app_data' => ['is_generated' => true, 'rows' => [['id' => 1]]],
            'attachment_list_data' => ['is_generated' => true, 'rows' => [['id' => 1]]],
        ]);
        \App\Models\PpmpMarketScoping::create([
            'ppmp_id' => $ppmp->id,
            'project_name' => $ppmp->title,
            'approved_by_name' => 'Test Approver',
            'approved_by_date' => now()->toDateString(),
            'created_by' => $this->endUser->id,
            'updated_by' => $this->endUser->id,
        ]);

        $this->actingAs($this->superAdmin);
        $okRes = $this->putJson("/api/monitoring/steps/{$step1['id']}", [
            'status' => 'COMPLETED',
            'completed_at' => '2026-11-23',
        ]);
        $okRes->assertOk();
        $this->assertTrue($okRes->json('project.pims_review_checklist.all_approved'));
        $this->assertEquals('COMPLETED', $okRes->json('step.status'));

        $step2 = collect($publishRes->json('project.steps'))->firstWhere('step_order', 2);
        $this->assertNotNull($step2);
        $this->assertStringContainsString('Approve PIMS', $step2['step_name']);
        $this->assertEquals('PENDING', $step2['status']);

        $this->putJson("/api/monitoring/steps/{$step2['id']}", [
            'status' => 'COMPLETED',
        ])->assertStatus(422);

        $step2Ok = $this->putJson("/api/monitoring/steps/{$step2['id']}", [
            'status' => 'COMPLETED',
            'completed_at' => '2026-11-23',
            'checklist_data' => [
                'pr_reviewer_approved' => true,
                'pr_reviewer_approved_date' => '2026-11-23',
                'pr_controlled' => true,
                'pr_controlled_date' => '2026-11-23',
            ],
        ]);
        $step2Ok->assertOk();
        $this->assertEquals('COMPLETED', $step2Ok->json('step.status'));
        $this->assertTrue($step2Ok->json('step.checklist_data.pr_reviewer_approved'));
        $this->assertEquals('2026-11-23', $step2Ok->json('step.checklist_data.pr_reviewer_approved_date'));
        $this->assertTrue($step2Ok->json('step.checklist_data.pr_controlled'));
        $this->assertEquals('2026-11-23', $step2Ok->json('step.checklist_data.pr_controlled_date'));

        $this->actingAs($monitorUser);
        $this->postJson("/api/monitoring/projects/{$projectId}/steps", [
            'division' => 'technical_division',
            'step_name' => 'Monitor Cannot Add Checkbox Step',
            'checklist_data' => [
                'items' => [['id' => 'c1', 'label' => 'Check 1']],
            ],
        ])->assertForbidden();

        $this->actingAs($this->admin);
        $addStepRes = $this->postJson("/api/monitoring/projects/{$projectId}/steps", [
            'division' => 'technical_division',
            'step_name' => 'Technical Verification Step',
            'checklist_data' => [
                'items' => [
                    ['id' => 'chk-1', 'label' => 'Specs Checked'],
                    ['id' => 'chk-2', 'label' => 'ABC Verified'],
                ],
            ],
        ]);
        $addStepRes->assertCreated();
        $customStep = $addStepRes->json('step');
        $this->assertCount(2, $customStep['checklist_data']['items']);

        $this->putJson("/api/monitoring/steps/{$customStep['id']}", [
            'status' => 'COMPLETED',
            'completed_at' => '2026-11-23',
        ])->assertStatus(422);

        $updateCustomRes = $this->putJson("/api/monitoring/steps/{$customStep['id']}", [
            'status' => 'COMPLETED',
            'completed_at' => '2026-11-23',
            'checklist_data' => [
                'items' => [
                    ['id' => 'chk-2', 'label' => 'ABC Verified', 'checked' => true, 'date' => '2026-11-23'],
                    ['id' => 'chk-1', 'label' => 'Specs Checked', 'checked' => true, 'date' => '2026-11-23'],
                    ['id' => 'chk-3', 'label' => 'End-User Signed', 'checked' => true, 'date' => '2026-11-23'],
                ],
            ],
        ]);
        $updateCustomRes->assertOk();
        $this->assertCount(3, $updateCustomRes->json('step.checklist_data.items'));
        $this->assertEquals('chk-2', $updateCustomRes->json('step.checklist_data.items.0.id'));

        $techStepIds = collect($updateCustomRes->json('project.steps'))
            ->where('division', 'technical_division')
            ->pluck('id')
            ->reverse()
            ->values()
            ->toArray();

        $reorderRes = $this->postJson("/api/monitoring/projects/{$projectId}/reorder-steps", [
            'division' => 'technical_division',
            'step_ids' => $techStepIds,
        ]);
        $reorderRes->assertOk();
    }

    public function test_monitoring_system_scopes_ppmp_to_creator_unless_authorized_by_admin(): void
    {
        $userA = User::factory()->create([
            'name' => 'Creator A',
            'role' => 'end_user',
            'office_id' => $this->office->id,
            'accessible_systems' => ['/eprocrementppmpapp', '/monitoringsystem'],
        ]);
        $userB = User::factory()->create([
            'name' => 'Creator B',
            'role' => 'end_user',
            'office_id' => $this->office->id,
            'accessible_systems' => ['/eprocrementppmpapp', '/monitoringsystem'],
        ]);

        $ppmpA = Ppmp::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'ppmp_number' => 'PPMP-A-001',
            'office_id' => $this->office->id,
            'implementing_unit' => $this->office->name,
            'created_by' => $userA->id,
            'title' => 'User A Project',
            'fiscal_year' => '2026',
            'tracking_number' => 'TRK-A-001',
            'total_budget' => 50000,
            'status' => 'READY_TO_PRINT',
        ]);
        $ppmpB = Ppmp::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'ppmp_number' => 'PPMP-B-001',
            'office_id' => $this->office->id,
            'implementing_unit' => $this->office->name,
            'created_by' => $userB->id,
            'title' => 'User B Project',
            'fiscal_year' => '2026',
            'tracking_number' => 'TRK-B-001',
            'total_budget' => 75000,
            'status' => 'READY_TO_PRINT',
        ]);

        $this->actingAs($userA);
        $pubA = $this->postJson('/api/monitoring/pims-publish', [
            'ppmp_uuid' => $ppmpA->uuid,
            'project_title' => $ppmpA->title,
            'category' => 'GOODS_CONSULTING',
            'procurement_mode' => 'SVP',
            'abc_amount' => 50000,
            'pr_number' => $ppmpA->tracking_number,
        ])->assertCreated();
        $projAId = $pubA->json('project.id');

        $this->actingAs($userB);
        $pubB = $this->postJson('/api/monitoring/pims-publish', [
            'ppmp_uuid' => $ppmpB->uuid,
            'project_title' => $ppmpB->title,
            'category' => 'GOODS_CONSULTING',
            'procurement_mode' => 'SVP',
            'abc_amount' => 75000,
            'pr_number' => $ppmpB->tracking_number,
        ])->assertCreated();
        $projBId = $pubB->json('project.id');

        $this->actingAs($userA);
        $listA = $this->getJson('/api/monitoring/projects')->assertOk();
        $idsA = collect($listA->json('projects'))->pluck('id')->all();
        $this->assertContains($projAId, $idsA);
        $this->assertNotContains($projBId, $idsA);
        $this->getJson("/api/monitoring/projects/{$projBId}")->assertForbidden();

        $this->postJson('/api/monitoring/authorized-users', ['user_ids' => [$userA->id]])->assertForbidden();

        $this->actingAs($this->admin);
        $this->postJson('/api/monitoring/authorized-users', [
            'user_ids' => [$userA->id],
        ])->assertOk();

        $this->actingAs($userA->fresh());
        $listAAuth = $this->getJson('/api/monitoring/projects')->assertOk();
        $idsAAuth = collect($listAAuth->json('projects'))->pluck('id')->all();
        $this->assertContains($projAId, $idsAAuth);
        $this->assertContains($projBId, $idsAAuth);
        $this->getJson("/api/monitoring/projects/{$projBId}")->assertOk();

        $this->actingAs($this->admin);
        $this->postJson('/api/monitoring/authorized-users', [
            'user_ids' => [],
        ])->assertOk();

        $this->actingAs($userA->fresh());
        $listARevoked = $this->getJson('/api/monitoring/projects')->assertOk();
        $idsARevoked = collect($listARevoked->json('projects'))->pluck('id')->all();
        $this->assertContains($projAId, $idsARevoked);
        $this->assertNotContains($projBId, $idsARevoked);
    }
}
