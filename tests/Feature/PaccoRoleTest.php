<?php

namespace Tests\Feature;

use App\Models\Office;
use App\Models\Ppmp;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class PaccoRoleTest extends TestCase
{
    use RefreshDatabase;

    protected User $superAdmin;
    protected User $paccoUser;
    protected User $endUser;
    protected Office $office;

    protected function setUp(): void
    {
        parent::setUp();

        $this->office = Office::create([
            'code' => 'PACCO',
            'name' => 'Provincial Accounting Office',
            'head_name' => 'Provincial Accountant',
            'designation' => 'Provincial Accountant',
        ]);

        $password = Hash::make('password123');

        $this->superAdmin = User::create([
            'name' => 'Super Administrator',
            'email' => 'superadmin@test.com',
            'password' => $password,
            'role' => 'super_admin',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $this->paccoUser = User::create([
            'name' => 'PACCO Reviewer',
            'email' => 'pacco@test.com',
            'password' => $password,
            'role' => 'pacco',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $this->endUser = User::create([
            'name' => 'End User Test',
            'email' => 'enduser@test.com',
            'password' => $password,
            'role' => 'end_user',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
    }

    public function test_pacco_helper_methods_on_user_model(): void
    {
        $this->assertTrue($this->paccoUser->isPacco());
        $this->assertTrue($this->paccoUser->isReviewer());
        $this->assertFalse($this->paccoUser->isAdmin());
        $this->assertFalse($this->endUser->isPacco());
    }

    public function test_admin_can_update_user_role_to_pacco(): void
    {
        $response = $this->actingAs($this->superAdmin)
            ->putJson("/api/users/{$this->endUser->id}/role", [
                'role' => 'pacco',
            ]);

        $response->assertOk()
            ->assertJsonPath('user.role', 'pacco');

        $this->assertDatabaseHas('users', [
            'id' => $this->endUser->id,
            'role' => 'pacco',
        ]);
    }

    public function test_user_registration_accepts_pacco_role(): void
    {
        $response = $this->postJson('/api/register', [
            'name' => 'New PACCO Member',
            'email' => 'newpacco@test.com',
            'role' => 'pacco',
            'phone_number' => '09123456789',
            'address' => 'Capitol, Digos City',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'office_id' => $this->office->id,
            'designation' => 'Accounting Reviewer',
            'signature' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
        ]);

        $response->assertStatus(201);
        $this->assertDatabaseHas('users', [
            'email' => 'newpacco@test.com',
            'role' => 'pacco',
        ]);
    }

    public function test_pacco_dashboard_returns_reviewer_metrics(): void
    {

        Ppmp::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'ppmp_number' => 'PPMP-2026-001',
            'title' => 'Draft PPMP',
            'fiscal_year' => 2026,
            'status' => 'DRAFT',
            'total_budget' => 50000,
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
        ]);

        Ppmp::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'ppmp_number' => 'PPMP-2026-002',
            'title' => 'Under Review PPMP',
            'fiscal_year' => 2026,
            'status' => 'PACCO_REVIEW',
            'total_budget' => 150000,
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
        ]);

        Ppmp::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'ppmp_number' => 'PPMP-2026-003',
            'title' => 'Approved Ready to Print PPMP',
            'fiscal_year' => 2026,
            'status' => 'READY_TO_PRINT',
            'source_of_fund' => 'Trust Fund',
            'pacco_approved_at' => now(),
            'total_budget' => 200000,
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
        ]);

        Ppmp::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'ppmp_number' => 'PPMP-2026-004',
            'title' => 'Returned Review PPMP',
            'fiscal_year' => 2026,
            'status' => 'PACCO_RETURNED',
            'total_budget' => 80000,
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
        ]);

        $response = $this->actingAs($this->paccoUser)->getJson('/api/dashboard');

        $response->assertOk()
            ->assertJsonPath('role', 'pacco')
            ->assertJsonPath('metrics.pending_review', 1)
            ->assertJsonPath('metrics.approved', 1)
            ->assertJsonPath('metrics.returned', 1)
            ->assertJsonPath('metrics.ready_to_print', 1);

        $recentPpmps = $response->json('recent_ppmps');
        $statuses = array_column($recentPpmps, 'status');
        $this->assertNotContains('DRAFT', $statuses);
        $this->assertContains('PACCO_REVIEW', $statuses);
        $this->assertContains('READY_TO_PRINT', $statuses);
        $this->assertContains('PACCO_RETURNED', $statuses);
    }

    public function test_pacco_ppmp_index_and_show_access_control(): void
    {
        $draftPpmp = Ppmp::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'ppmp_number' => 'PPMP-2026-101',
            'title' => 'Draft PPMP',
            'fiscal_year' => 2026,
            'status' => 'DRAFT',
            'total_budget' => 50000,
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
        ]);

        $reviewPpmp = Ppmp::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'ppmp_number' => 'PPMP-2026-102',
            'title' => 'Review PPMP',
            'fiscal_year' => 2026,
            'status' => 'BUDGET_OFFICER_REVIEW',
            'total_budget' => 75000,
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
        ]);

        $indexResponse = $this->actingAs($this->paccoUser)->getJson('/api/ppmps');
        $indexResponse->assertOk();
        $uuids = array_column($indexResponse->json('data'), 'uuid');
        $this->assertNotContains($draftPpmp->uuid, $uuids);
        $this->assertContains($reviewPpmp->uuid, $uuids);

        $showDraftResponse = $this->actingAs($this->paccoUser)->getJson("/api/ppmps/{$draftPpmp->uuid}");
        $showDraftResponse->assertStatus(403);

        $showReviewResponse = $this->actingAs($this->paccoUser)->getJson("/api/ppmps/{$reviewPpmp->uuid}");
        $showReviewResponse->assertOk()
            ->assertJsonPath('ppmp.uuid', $reviewPpmp->uuid);
    }

    public function test_trust_fund_workflow_routes_to_pacco_reviewer_then_oppmo_then_twg(): void
    {
        $password = Hash::make('password123');

        $headUser = User::create([
            'name' => 'Department Head',
            'email' => 'head@test.com',
            'password' => $password,
            'role' => 'head',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        $this->office->update(['head_user_id' => $headUser->id]);

        $budgetUser = User::create([
            'name' => 'Budget Officer',
            'email' => 'budget@test.com',
            'password' => $password,
            'role' => 'budget_officer',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $oppmoUser = User::create([
            'name' => 'OPPMO Officer',
            'email' => 'oppmo@test.com',
            'password' => $password,
            'role' => 'oppmo',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $twgUser = User::create([
            'name' => 'TWG Officer',
            'email' => 'twg@test.com',
            'password' => $password,
            'role' => 'twg',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $createRes = $this->actingAs($this->endUser)->postJson('/api/ppmps', [
            'title' => 'Trust Fund Project 2026',
            'fiscal_year' => '2026',
            'plan_type' => 'INDICATIVE',
            'source_of_fund' => 'Trust Fund',
            'items' => [
                [
                    'description' => 'Medical Equipment funded by Trust Fund',
                    'project_type' => 'Goods',
                    'quantity_size' => '5 sets',
                    'procurement_mode' => 'Public Bidding',
                    'estimated_budget' => 300000.00,
                    'source_of_fund' => 'Trust Fund',
                ]
            ]
        ]);

        $createRes->assertStatus(201);
        $uuid = $createRes->json('ppmp.uuid');
        $this->assertEquals('DRAFT', $createRes->json('ppmp.status'));
        $this->assertEquals('Trust Fund', $createRes->json('ppmp.source_of_fund'));

        $ppmp = Ppmp::where('uuid', $uuid)->first();
        $ppmp->attachments()->create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'original_filename' => 'market_scoping_assessment.pdf',
            'stored_filename' => 'market_scoping_assessment.pdf',
            'storage_path' => 'attachments/test_market_scoping.pdf',
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
            'attachment_type' => 'MARKET_SCOPING',
            'uploaded_by' => $this->endUser->id,
        ]);

        $this->actingAs($this->endUser)->postJson("/api/ppmps/{$uuid}/app-data", [
            'prepared_by_name' => 'NORJANNA M. CAMAGUIN, MPA',
            'rows' => [
                ['code' => 'APP-001', 'procurement_program' => 'Medical Equipment', 'total' => 300000.00]
            ]
        ])->assertStatus(403);

        $this->actingAs($this->endUser)->postJson("/api/ppmps/{$uuid}/attachment-list", [
            'prepared_by_name' => 'End User Test',
            'rows' => [
                ['item_no' => 1, 'description' => 'Medical Equipment', 'qty' => 5, 'unit' => 'sets', 'unit_price' => 60000.00, 'total_amount' => 300000.00]
            ]
        ])->assertOk();

        $submitReviewRes = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$uuid}/submit-for-review");
        $submitReviewRes->assertOk();
        $this->assertEquals('TWG_REVIEW', $submitReviewRes->json('ppmp.status'));

        $budgetUnauthorized = $this->actingAs($budgetUser)->postJson("/api/ppmps/{$uuid}/budget/approve");
        $budgetUnauthorized->assertStatus(422);

        $twgApproveRes = $this->actingAs($twgUser)->postJson("/api/ppmps/{$uuid}/twg/approve");
        $twgApproveRes->assertOk();
        $this->assertEquals('PACCO_REVIEW', $twgApproveRes->json('ppmp.status'));

        $paccoReceiveRes = $this->actingAs($this->paccoUser)->postJson("/api/ppmps/{$uuid}/receive");
        $paccoReceiveRes->assertOk();

        $paccoApproveRes = $this->actingAs($this->paccoUser)->postJson("/api/ppmps/{$uuid}/pacco/approve");
        $paccoApproveRes->assertOk();
        $this->assertEquals('OPPMO_REVIEW', $paccoApproveRes->json('ppmp.status'));

        $this->actingAs($oppmoUser)->postJson("/api/ppmps/{$uuid}/app-data", [
            'prepared_by_name' => 'OPPMO Officer',
            'rows' => [['code' => 'APP-TF-01', 'total' => 500000.00]],
        ])->assertOk();

        $oppmoFinalApproveRes = $this->actingAs($oppmoUser)->postJson("/api/ppmps/{$uuid}/oppmo/approve");
        $oppmoFinalApproveRes->assertOk();
        $this->assertEquals('READY_TO_PRINT', $oppmoFinalApproveRes->json('ppmp.status'));
    }

    public function test_general_fund_workflow_routes_to_budget_officer_then_oppmo_then_twg(): void
    {
        $password = Hash::make('password123');

        $headUser = User::create([
            'name' => 'Department Head GF',
            'email' => 'head_gf@test.com',
            'password' => $password,
            'role' => 'head',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        $this->office->update(['head_user_id' => $headUser->id]);

        $budgetUser = User::create([
            'name' => 'Budget Officer GF',
            'email' => 'budget_gf@test.com',
            'password' => $password,
            'role' => 'budget_officer',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $oppmoUser = User::create([
            'name' => 'OPPMO Officer GF',
            'email' => 'oppmo_gf@test.com',
            'password' => $password,
            'role' => 'oppmo',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $twgUser = User::create([
            'name' => 'TWG Officer GF',
            'email' => 'twg_gf@test.com',
            'password' => $password,
            'role' => 'twg',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $createRes = $this->actingAs($this->endUser)->postJson('/api/ppmps', [
            'title' => 'General Fund Project 2026',
            'fiscal_year' => '2026',
            'plan_type' => 'INDICATIVE',
            'source_of_fund' => 'General Fund and etc..',
            'items' => [
                [
                    'description' => 'Office Supplies',
                    'project_type' => 'Goods',
                    'quantity_size' => '10 boxes',
                    'procurement_mode' => 'Shopping',
                    'estimated_budget' => 50000.00,
                    'source_of_fund' => 'General Fund and etc..',
                ]
            ]
        ]);

        $createRes->assertStatus(201);
        $uuid = $createRes->json('ppmp.uuid');
        $this->assertEquals('DRAFT', $createRes->json('ppmp.status'));

        $ppmp = Ppmp::where('uuid', $uuid)->first();
        $ppmp->attachments()->create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'original_filename' => 'market_scoping_assessment.pdf',
            'stored_filename' => 'market_scoping_assessment.pdf',
            'storage_path' => 'attachments/test_market_scoping.pdf',
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
            'attachment_type' => 'MARKET_SCOPING',
            'uploaded_by' => $this->endUser->id,
        ]);

        $this->actingAs($this->endUser)->postJson("/api/ppmps/{$uuid}/app-data", [
            'prepared_by_name' => 'NORJANNA M. CAMAGUIN, MPA',
            'rows' => [
                ['code' => 'APP-002', 'procurement_program' => 'General Fund Items', 'total' => 50000.00]
            ]
        ])->assertStatus(403);

        $this->actingAs($this->endUser)->postJson("/api/ppmps/{$uuid}/attachment-list", [
            'prepared_by_name' => 'End User Test',
            'rows' => [
                ['item_no' => 1, 'description' => 'Office Supplies', 'qty' => 10, 'unit' => 'boxes', 'unit_price' => 5000.00, 'total_amount' => 50000.00]
            ]
        ])->assertOk();

        $submitReviewRes = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$uuid}/submit-for-review");
        $submitReviewRes->assertOk();
        $this->assertEquals('TWG_REVIEW', $submitReviewRes->json('ppmp.status'));

        $twgApproveRes = $this->actingAs($twgUser)->postJson("/api/ppmps/{$uuid}/twg/approve");
        $twgApproveRes->assertOk();
        $this->assertEquals('BUDGET_OFFICER_REVIEW', $twgApproveRes->json('ppmp.status'));

        $budgetApproveRes = $this->actingAs($budgetUser)->postJson("/api/ppmps/{$uuid}/budget/approve");
        $budgetApproveRes->assertOk();
        $this->assertEquals('OPPMO_REVIEW', $budgetApproveRes->json('ppmp.status'));

        $this->actingAs($oppmoUser)->postJson("/api/ppmps/{$uuid}/app-data", [
            'prepared_by_name' => 'OPPMO Officer',
            'rows' => [['code' => 'APP-GF-01', 'total' => 250000.00]],
        ])->assertOk();

        $oppmoFinalApproveRes = $this->actingAs($oppmoUser)->postJson("/api/ppmps/{$uuid}/oppmo/approve");
        $oppmoFinalApproveRes->assertOk();
        $this->assertEquals('READY_TO_PRINT', $oppmoFinalApproveRes->json('ppmp.status'));
    }

    public function test_pacco_reviewer_can_return_and_enduser_can_resubmit_back_to_pacco(): void
    {
        $password = Hash::make('password123');

        $twgUser = User::create([
            'name' => 'TWG Reviewer TF Ret',
            'email' => 'twg_tf_ret@test.com',
            'password' => $password,
            'role' => 'twg',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $headUser = User::create([
            'name' => 'Department Head TF',
            'email' => 'head_tf@test.com',
            'password' => $password,
            'role' => 'head',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        $this->office->update(['head_user_id' => $headUser->id]);

        $createRes = $this->actingAs($this->endUser)->postJson('/api/ppmps', [
            'title' => 'Trust Fund Return Test',
            'fiscal_year' => '2026',
            'plan_type' => 'INDICATIVE',
            'source_of_fund' => 'Trust Fund',
            'items' => [
                [
                    'description' => 'Trust Fund Items',
                    'project_type' => 'Goods',
                    'estimated_budget' => 100000.00,
                    'source_of_fund' => 'Trust Fund',
                ]
            ]
        ]);
        $uuid = $createRes->json('ppmp.uuid');

        $ppmp = Ppmp::where('uuid', $uuid)->first();
        $ppmp->attachments()->create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'original_filename' => 'market_scoping_assessment.pdf',
            'stored_filename' => 'market_scoping_assessment.pdf',
            'storage_path' => 'attachments/test_market_scoping.pdf',
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
            'attachment_type' => 'MARKET_SCOPING',
            'uploaded_by' => $this->endUser->id,
        ]);

        $this->actingAs($this->endUser)->postJson("/api/ppmps/{$uuid}/app-data", [
            'prepared_by_name' => 'NORJANNA M. CAMAGUIN, MPA',
            'rows' => [
                ['code' => 'APP-TF', 'procurement_program' => 'Trust Fund Items', 'total' => 100000.00]
            ]
        ])->assertStatus(403);

        $this->actingAs($this->endUser)->postJson("/api/ppmps/{$uuid}/attachment-list", [
            'prepared_by_name' => 'End User Test',
            'rows' => [
                ['item_no' => 1, 'description' => 'Trust Fund Item', 'qty' => 1, 'unit' => 'lot', 'unit_price' => 100000.00, 'total_amount' => 100000.00]
            ]
        ])->assertOk();

        $this->actingAs($this->endUser)->postJson("/api/ppmps/{$uuid}/submit-for-review")->assertOk();

        $this->actingAs($twgUser)->postJson("/api/ppmps/{$uuid}/twg/approve")->assertOk();

        $returnRes = $this->actingAs($this->paccoUser)->postJson("/api/ppmps/{$uuid}/pacco/return", [
            'remarks' => 'Please provide complete trust fund grant documentation.',
        ]);
        $returnRes->assertOk();
        $this->assertEquals('PACCO_RETURNED', $returnRes->json('ppmp.status'));

        $updateRes = $this->actingAs($this->endUser)->putJson("/api/ppmps/{$uuid}", [
            'title' => 'Trust Fund Return Test (Revised)',
            'fiscal_year' => '2026',
            'plan_type' => 'INDICATIVE',
            'source_of_fund' => 'Trust Fund',
            'items' => [
                [
                    'description' => 'Trust Fund Items with complete docs',
                    'project_type' => 'Goods',
                    'estimated_budget' => 100000.00,
                    'source_of_fund' => 'Trust Fund',
                ]
            ]
        ]);
        $updateRes->assertOk();

        $resubmitRes = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$uuid}/submit-for-review");
        $resubmitRes->assertOk();
        $this->assertEquals('PACCO_REVIEW', $resubmitRes->json('ppmp.status'));
    }
}
