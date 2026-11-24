<?php

namespace Tests\Feature;

use App\Models\Office;
use App\Models\PnpkiSignature;
use App\Models\Ppmp;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class ReviewHeadWorkflowTest extends TestCase
{
    use RefreshDatabase;

    private Office $endUserOffice;
    private Office $budgetOffice;
    private Office $paccoOffice;
    private Office $oppmoOffice;
    private User $endUser;
    private User $budgetReviewer;
    private User $paccoReviewer;
    private User $oppmoReviewer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->endUserOffice = Office::create([
            'code' => 'AGRI',
            'name' => 'Office of the Provincial Agriculturist',
            'is_active' => true,
        ]);
        $this->budgetOffice = Office::create([
            'code' => 'PBO',
            'name' => 'Office of the Provincial Budget Officer',
            'is_active' => true,
        ]);
        $this->paccoOffice = Office::create([
            'code' => 'PACCO',
            'name' => 'Office of the Provincial Accountant',
            'is_active' => true,
        ]);
        $this->oppmoOffice = Office::create([
            'code' => 'PMO',
            'name' => 'Office of the Provincial Procurement Management Officer',
            'is_active' => true,
        ]);

        $this->endUser = User::factory()->create([
            'role' => 'end_user',
            'office_id' => $this->endUserOffice->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        $this->budgetReviewer = User::factory()->create([
            'role' => 'budget_officer',
            'office_id' => $this->budgetOffice->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        $this->paccoReviewer = User::factory()->create([
            'role' => 'pacco',
            'office_id' => $this->paccoOffice->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        $this->oppmoReviewer = User::factory()->create([
            'role' => 'oppmo',
            'office_id' => $this->oppmoOffice->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
    }

    private function makePpmp(string $status, string $sourceOfFund = 'General Fund'): Ppmp
    {
        return Ppmp::create([
            'uuid' => (string) Str::uuid(),
            'ppmp_number' => 'PPMP-' . Str::random(6),
            'office_id' => $this->endUserOffice->id,
            'created_by' => $this->endUser->id,
            'title' => 'Test PPMP',
            'source_of_fund' => $sourceOfFund,
            'fiscal_year' => 2026,
            'plan_type' => 'FINAL',
            'total_budget' => 10000,
            'status' => $status,
            'budget_reviewer_id' => $sourceOfFund === 'Trust Fund' ? $this->paccoReviewer->id : $this->budgetReviewer->id,
            'oppmo_reviewer_id' => $this->oppmoReviewer->id,
            'app_data' => ['rows' => [['item' => 'Test']]],
        ]);
    }

    public function test_skips_budget_and_oppmo_head_when_heads_not_registered(): void
    {
        $ppmp = $this->makePpmp('BUDGET_OFFICER_REVIEW');

        $this->actingAs($this->budgetReviewer)
            ->postJson("/api/ppmps/{$ppmp->uuid}/budget/approve")
            ->assertOk();
        $this->assertEquals('OPPMO_REVIEW', $ppmp->fresh()->status);

        $this->actingAs($this->oppmoReviewer)
            ->postJson("/api/ppmps/{$ppmp->uuid}/oppmo/approve")
            ->assertOk();
        $this->assertEquals('READY_TO_PRINT', $ppmp->fresh()->status);
    }

    public function test_skips_heads_when_pending_or_optional_or_expired_pnpki(): void
    {
        $budgetHead = User::factory()->create([
            'name' => 'DESSAMIE BUAT-SANCHEZ, CPA, JD',
            'role' => 'head',
            'office_id' => $this->budgetOffice->id,
            'is_active' => true,
            'approval_status' => 'pending',
        ]);
        PnpkiSignature::create([
            'user_id' => $budgetHead->id,
            'signature_type' => 'pnpki',
            'expiration_date' => now()->addDays(10)->toDateString(),
        ]);

        $oppmoHead = User::factory()->create([
            'name' => 'NORJANNA M. CAMAGUIN, MPA',
            'role' => 'head',
            'office_id' => $this->oppmoOffice->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        PnpkiSignature::create([
            'user_id' => $oppmoHead->id,
            'signature_type' => 'optional',
        ]);

        $ppmp = $this->makePpmp('BUDGET_OFFICER_REVIEW');

        $this->actingAs($this->budgetReviewer)
            ->postJson("/api/ppmps/{$ppmp->uuid}/budget/approve")
            ->assertOk();
        $this->assertEquals('OPPMO_REVIEW', $ppmp->fresh()->status);

        $this->actingAs($this->oppmoReviewer)
            ->postJson("/api/ppmps/{$ppmp->uuid}/oppmo/approve")
            ->assertOk();
        $this->assertEquals('READY_TO_PRINT', $ppmp->fresh()->status);

        $oppmoHead->pnpkiSignature()->update([
            'signature_type' => 'pnpki',
            'expiration_date' => now()->subDay()->toDateString(),
        ]);
        $ppmp2 = $this->makePpmp('OPPMO_REVIEW');
        $this->actingAs($this->oppmoReviewer)
            ->postJson("/api/ppmps/{$ppmp2->uuid}/oppmo/approve")
            ->assertOk();
        $this->assertEquals('READY_TO_PRINT', $ppmp2->fresh()->status);
    }

    public function test_oppmo_approve_routes_to_budget_head_then_oppmo_head_when_both_have_active_pnpki(): void
    {

        $budgetHead = User::factory()->create([
            'name' => 'DESSAMIE BUAT-SANCHEZ, CPA, JD',
            'role' => 'head',
            'office_id' => $this->budgetOffice->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        PnpkiSignature::create([
            'user_id' => $budgetHead->id,
            'signature_type' => 'pnpki',
            'expiration_date' => now()->addDays(30)->toDateString(),
        ]);

        $oppmoHead = User::factory()->create([
            'name' => 'NORJANNA M. CAMAGUIN, MPA',
            'role' => 'head',
            'office_id' => $this->oppmoOffice->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        PnpkiSignature::create([
            'user_id' => $oppmoHead->id,
            'signature_type' => 'pnpki',
            'expiration_date' => now()->addDays(30)->toDateString(),
        ]);

        $otherHead = User::factory()->create([
            'role' => 'head',
            'office_id' => $this->endUserOffice->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $ppmp = $this->makePpmp('BUDGET_OFFICER_REVIEW');

        $this->actingAs($this->budgetReviewer)
            ->postJson("/api/ppmps/{$ppmp->uuid}/budget/approve")
            ->assertOk();
        $this->assertEquals('OPPMO_REVIEW', $ppmp->fresh()->status);

        $this->actingAs($this->oppmoReviewer)
            ->postJson("/api/ppmps/{$ppmp->uuid}/oppmo/approve")
            ->assertOk();
        $this->assertEquals('BUDGET_HEAD_REVIEW', $ppmp->fresh()->status);
        $this->assertDatabaseHas('ppmp_routes', [
            'ppmp_id' => $ppmp->id,
            'to_user_id' => $budgetHead->id,
            'to_role' => 'budget_head',
            'status' => 'BUDGET_HEAD_REVIEW',
        ]);

        $this->actingAs($otherHead)
            ->postJson("/api/ppmps/{$ppmp->uuid}/budget-head/approve")
            ->assertStatus(403);

        $this->actingAs($budgetHead)
            ->getJson("/api/ppmps/{$ppmp->uuid}")
            ->assertOk();
        $this->actingAs($budgetHead)
            ->postJson("/api/ppmps/{$ppmp->uuid}/budget-head/approve")
            ->assertOk();
        $this->assertEquals('OPPMO_HEAD_REVIEW', $ppmp->fresh()->status);
        $this->assertDatabaseHas('ppmp_signatures', [
            'ppmp_id' => $ppmp->id,
            'role' => 'budget_head',
            'user_id' => $budgetHead->id,
        ]);
        $this->assertDatabaseHas('ppmp_routes', [
            'ppmp_id' => $ppmp->id,
            'to_user_id' => $oppmoHead->id,
            'to_role' => 'oppmo_head',
            'status' => 'OPPMO_HEAD_REVIEW',
        ]);

        $this->actingAs($oppmoHead)
            ->postJson("/api/ppmps/{$ppmp->uuid}/oppmo-head/approve")
            ->assertOk();
        $this->assertEquals('READY_TO_PRINT', $ppmp->fresh()->status);
        $this->assertDatabaseHas('ppmp_signatures', [
            'ppmp_id' => $ppmp->id,
            'role' => 'oppmo_head',
            'user_id' => $oppmoHead->id,
        ]);
    }

    public function test_oppmo_approve_routes_to_pacco_head_for_trust_fund_then_ready_to_print_when_no_oppmo_head(): void
    {

        $paccoHead = User::factory()->create([
            'name' => 'MAY FERNANDO-UY, CPA',
            'role' => 'head',
            'office_id' => $this->paccoOffice->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        PnpkiSignature::create([
            'user_id' => $paccoHead->id,
            'signature_type' => 'pnpki',
            'expiration_date' => now()->addDays(15)->toDateString(),
        ]);

        $ppmp = $this->makePpmp('PACCO_REVIEW', 'Trust Fund');

        $this->actingAs($this->paccoReviewer)
            ->postJson("/api/ppmps/{$ppmp->uuid}/pacco/approve")
            ->assertOk();
        $this->assertEquals('OPPMO_REVIEW', $ppmp->fresh()->status);

        $this->actingAs($this->oppmoReviewer)
            ->postJson("/api/ppmps/{$ppmp->uuid}/oppmo/approve")
            ->assertOk();
        $this->assertEquals('PACCO_HEAD_REVIEW', $ppmp->fresh()->status);

        $this->actingAs($paccoHead)
            ->postJson("/api/ppmps/{$ppmp->uuid}/pacco-head/approve")
            ->assertOk();
        $this->assertEquals('READY_TO_PRINT', $ppmp->fresh()->status);
        $this->assertDatabaseHas('ppmp_signatures', [
            'ppmp_id' => $ppmp->id,
            'role' => 'pacco_head',
            'user_id' => $paccoHead->id,
        ]);
    }

    public function test_forwards_to_app_preparer_and_governor_when_registered_with_active_pnpki(): void
    {

        $oppmoHead = User::factory()->create([
            'name' => 'NORJANNA M. CAMAGUIN, MPA',
            'role' => 'head',
            'office_id' => $this->oppmoOffice->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        PnpkiSignature::create([
            'user_id' => $oppmoHead->id,
            'signature_type' => 'pnpki',
            'expiration_date' => now()->addDays(20)->toDateString(),
        ]);

        $appPreparer = User::factory()->create([
            'name' => 'GINA MAE B. CARBAQUEL',
            'role' => 'end_user',
            'office_id' => $this->oppmoOffice->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        PnpkiSignature::create([
            'user_id' => $appPreparer->id,
            'signature_type' => 'pnpki',
            'expiration_date' => now()->addDays(20)->toDateString(),
        ]);

        $governor = User::factory()->create([
            'name' => 'HON. YVONNE R. CAGAS',
            'role' => 'head',
            'office_id' => $this->endUserOffice->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        PnpkiSignature::create([
            'user_id' => $governor->id,
            'signature_type' => 'pnpki',
            'expiration_date' => now()->addDays(20)->toDateString(),
        ]);

        $ppmp = $this->makePpmp('OPPMO_REVIEW');

        $this->actingAs($this->oppmoReviewer)
            ->postJson("/api/ppmps/{$ppmp->uuid}/oppmo/approve")
            ->assertOk();
        $this->assertEquals('OPPMO_HEAD_REVIEW', $ppmp->fresh()->status);

        $this->actingAs($oppmoHead)
            ->postJson("/api/ppmps/{$ppmp->uuid}/oppmo-head/approve")
            ->assertOk();
        $this->assertEquals('APP_PREPARER_REVIEW', $ppmp->fresh()->status);

        $this->actingAs($appPreparer)
            ->postJson("/api/ppmps/{$ppmp->uuid}/app-preparer/approve")
            ->assertOk();
        $this->assertEquals('GOVERNOR_REVIEW', $ppmp->fresh()->status);
        $this->assertDatabaseHas('ppmp_signatures', [
            'ppmp_id' => $ppmp->id,
            'role' => 'app_preparer',
            'user_id' => $appPreparer->id,
        ]);

        $this->actingAs($governor)
            ->postJson("/api/ppmps/{$ppmp->uuid}/governor/approve")
            ->assertOk();
        $this->assertEquals('READY_TO_PRINT', $ppmp->fresh()->status);
        $this->assertDatabaseHas('ppmp_signatures', [
            'ppmp_id' => $ppmp->id,
            'role' => 'governor',
            'user_id' => $governor->id,
        ]);
    }

    public function test_admin_and_super_admin_can_update_ppmp_status_while_non_admin_cannot(): void
    {

        $admin = User::factory()->create([
            'name' => 'SYSTEM ADMIN',
            'role' => 'admin',
            'office_id' => $this->oppmoOffice->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $superAdmin = User::factory()->create([
            'name' => 'SUPER ADMIN',
            'role' => 'super_admin',
            'office_id' => $this->oppmoOffice->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $ppmp = $this->makePpmp('READY_TO_PRINT');

        $this->actingAs($this->endUser)
            ->putJson("/api/ppmps/{$ppmp->uuid}/status", [
                'status' => 'DRAFT',
            ])
            ->assertStatus(403);

        $this->actingAs($admin)
            ->putJson("/api/ppmps/{$ppmp->uuid}/status", [
                'status' => 'DRAFT',
                'remarks' => 'Reopened to Draft by Admin for correction.',
            ])
            ->assertOk()
            ->assertJsonPath('ppmp.status', 'DRAFT');

        $this->assertEquals('DRAFT', $ppmp->fresh()->status);
        $this->assertDatabaseHas('ppmp_routes', [
            'ppmp_id' => $ppmp->id,
            'from_user_id' => $admin->id,
            'action' => 'ADMIN_STATUS_OVERRIDE',
            'status' => 'DRAFT',
        ]);
        $this->assertDatabaseHas('ppmp_change_logs', [
            'ppmp_id' => $ppmp->id,
            'user_id' => $admin->id,
            'field_name' => 'Status',
            'old_value' => 'READY_TO_PRINT',
            'new_value' => 'DRAFT',
        ]);

        $this->actingAs($superAdmin)
            ->putJson("/api/ppmps/{$ppmp->uuid}/status", [
                'status' => 'OPPMO_REVIEW',
                'remarks' => 'Moved directly to OPPMO Review.',
            ])
            ->assertOk()
            ->assertJsonPath('ppmp.status', 'OPPMO_REVIEW');

        $this->assertEquals('OPPMO_REVIEW', $ppmp->fresh()->status);
    }

    public function test_attachment_list_only_amendment_routes_from_twg_to_enduser_head_with_active_pnpki_or_ready_to_print(): void
    {

        $twgReviewer = User::factory()->create([
            'name' => 'TWG REVIEWER',
            'role' => 'twg',
            'office_id' => $this->oppmoOffice->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $ppmpNoHead = $this->makePpmp('TWG_REVIEW');
        $ppmpNoHead->update(['amendment_scope' => 'ATTACHMENT_LIST', 'twg_reviewer_id' => $twgReviewer->id]);

        $this->actingAs($twgReviewer)
            ->postJson("/api/ppmps/{$ppmpNoHead->uuid}/twg/approve")
            ->assertOk();
        $this->assertEquals('READY_TO_PRINT', $ppmpNoHead->fresh()->status);

        $endUserHead = User::factory()->create([
            'name' => 'ENDUSER OFFICE HEAD',
            'role' => 'head',
            'office_id' => $this->endUserOffice->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        PnpkiSignature::create([
            'user_id' => $endUserHead->id,
            'signature_type' => 'pnpki',
            'expiration_date' => now()->subDays(2)->toDateString(),
        ]);

        $ppmpExpiredHead = $this->makePpmp('TWG_REVIEW');
        $ppmpExpiredHead->update(['amendment_scope' => 'ATTACHMENT_LIST', 'twg_reviewer_id' => $twgReviewer->id]);

        $this->actingAs($twgReviewer)
            ->postJson("/api/ppmps/{$ppmpExpiredHead->uuid}/twg/approve")
            ->assertOk();
        $this->assertEquals('READY_TO_PRINT', $ppmpExpiredHead->fresh()->status);

        $endUserHead->pnpkiSignature()->update([
            'signature_type' => 'pnpki',
            'expiration_date' => now()->addDays(30)->toDateString(),
        ]);

        $ppmpActiveHead = $this->makePpmp('TWG_REVIEW');
        $ppmpActiveHead->update(['amendment_scope' => 'ATTACHMENT_LIST', 'twg_reviewer_id' => $twgReviewer->id]);

        $this->actingAs($twgReviewer)
            ->postJson("/api/ppmps/{$ppmpActiveHead->uuid}/twg/approve")
            ->assertOk();
        $this->assertEquals('HEAD_PENDING', $ppmpActiveHead->fresh()->status);

        $this->actingAs($endUserHead)
            ->postJson("/api/ppmps/{$ppmpActiveHead->uuid}/head/approve")
            ->assertOk();
        $this->assertEquals('READY_TO_PRINT', $ppmpActiveHead->fresh()->status);
        $this->assertDatabaseHas('ppmp_signatures', [
            'ppmp_id' => $ppmpActiveHead->id,
            'role' => 'head',
            'user_id' => $endUserHead->id,
        ]);
    }

    public function test_tracker_number_can_be_edited_and_blocks_duplicate_tracker_numbers(): void
    {
        $ppmpA = $this->makePpmp('DRAFT');
        $ppmpA->update(['tracking_number' => 'PMOGOODS-2026-000001']);

        $ppmpB = $this->makePpmp('DRAFT');
        $ppmpB->update(['tracking_number' => 'PMOGOODS-2026-000002']);

        $this->actingAs($this->endUser)
            ->getJson("/api/ppmps/check-tracker?tracking_number=PMOGOODS-2026-000001&exclude_uuid={$ppmpB->uuid}")
            ->assertOk()
            ->assertJson([
                'available' => false,
                'exists' => true,
            ]);

        $this->actingAs($this->endUser)
            ->getJson("/api/ppmps/check-tracker?tracking_number=PMOGOODS-2026-000099&exclude_uuid={$ppmpB->uuid}")
            ->assertOk()
            ->assertJson([
                'available' => true,
                'exists' => false,
            ]);

        $this->actingAs($this->endUser)
            ->patchJson("/api/ppmps/{$ppmpB->uuid}/tracking-number", [
                'tracking_number' => 'PMOGOODS-2026-000001',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['tracking_number']);

        $this->actingAs($this->endUser)
            ->patchJson("/api/ppmps/{$ppmpB->uuid}/tracking-number", [
                'tracking_number' => 'PMOGOODS-2026-000099',
            ])
            ->assertOk()
            ->assertJsonPath('ppmp.tracking_number', 'PMOGOODS-2026-000099');

        $this->assertEquals('PMOGOODS-2026-000099', $ppmpB->fresh()->tracking_number);

        $childRevision = $this->makePpmp('DRAFT');
        $childRevision->update([
            'parent_id' => $ppmpB->id,
            'tracking_number' => 'PMOGOODS-2026-000099',
        ]);

        $this->actingAs($this->endUser)
            ->patchJson("/api/ppmps/{$childRevision->uuid}/tracking-number", [
                'tracking_number' => 'PMOGOODS-2026-000105',
            ])
            ->assertOk();

        $this->assertEquals('PMOGOODS-2026-000105', $childRevision->fresh()->tracking_number);
        $this->assertEquals('PMOGOODS-2026-000105', $ppmpB->fresh()->tracking_number);
    }

    public function test_super_admin_can_toggle_pnpki_enabled_and_disabled_mode_enforces_optional_signature(): void
    {
        $superAdmin = User::create([
            'name' => 'Super Administrator',
            'email' => 'superadmin@test.local',
            'password' => bcrypt('password'),
            'role' => 'super_admin',
            'office_id' => $this->oppmoOffice->id,
            'designation' => 'Super Admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $this->getJson('/api/system-settings/signatures')
            ->assertOk()
            ->assertJsonPath('settings.pnpki_enabled', true);

        $this->actingAs($superAdmin)
            ->putJson('/api/system-settings/signatures', [
                'pnpki_enabled' => false,
                'ppmp' => true,
                'app' => true,
                'attachment_list' => true,
            ])
            ->assertOk()
            ->assertJsonPath('settings.pnpki_enabled', false);

        $this->assertFalse(\App\Models\SystemSetting::isPnpkiEnabled());

        $sig = \App\Models\PnpkiSignature::updateOrCreate(
            ['user_id' => $this->endUser->id],
            ['signature_type' => 'pnpki', 'expiration_date' => now()->addDays(5)->toDateString()]
        );
        $this->assertSame('optional', $sig->fresh()->effective_signature_type);
        $this->assertTrue($sig->fresh()->is_forced_optional);
        $this->assertFalse($sig->fresh()->is_expiring_soon);

        $this->actingAs($this->endUser)
            ->postJson('/api/profile/renew-pnpki', ['pnpki_expiration_date' => now()->addYear()->toDateString()])
            ->assertStatus(403);

        $ppmp = $this->makePpmp('READY_TO_PRINT');
        $this->actingAs($this->endUser)
            ->getJson("/api/ppmps/{$ppmp->uuid}")
            ->assertOk()
            ->assertJsonPath('signature_settings.pnpki_enabled', false);

        $this->actingAs($superAdmin)
            ->putJson('/api/system-settings/signatures', [
                'pnpki_enabled' => true,
            ])
            ->assertOk()
            ->assertJsonPath('settings.pnpki_enabled', true);

        $this->assertTrue(\App\Models\SystemSetting::isPnpkiEnabled());
    }

    public function test_market_scoping_normalized_tables_save_and_cell_comments_work(): void
    {
        $ppmp = $this->makePpmp('DRAFT');

        $this->actingAs($this->endUser)
            ->getJson("/api/ppmps/{$ppmp->uuid}")
            ->assertOk()
            ->assertJsonPath('ppmp.pre_submission_checks.market_scoping_generated', false);

        $this->actingAs($this->endUser)
            ->postJson("/api/ppmps/{$ppmp->uuid}/market-scoping", [
                'procuring_entity' => 'PROVINCIAL GOVERNMENT OF DAVAO DEL SUR',
                'implementing_unit' => 'Office of the Provincial Agriculturist',
                'representative_name_designation' => 'End User — Admin Officer II',
                'project_name' => 'Test Procurement Project',
                'estimated_budget' => 100000,
                'scoping_period_from' => '10/2026',
                'scoping_period_to' => '11/2026',
                'expected_delivery_date' => '12/2026',
                'prepared_by_name' => 'End User',
                'prepared_by_position' => 'Admin Officer II',
                'prepared_by_date' => '2026-11-19',
                'approved_by_name' => 'Office Head',
                'approved_by_position' => 'Department Head',
                'activities' => [
                    [
                        'activity_code' => 'price_sourcing',
                        'is_checked' => true,
                        'sort_order' => 5,
                    ],
                    [
                        'activity_code' => 'philgeps_websites',
                        'is_checked' => true,
                        'sort_order' => 6,
                    ],
                ],
                'results' => [
                    [
                        'parameter_code' => 'project_cost_estimate',
                        'considered' => 'Yes',
                        'recommendations' => 'Aligned with current market canvass.',
                        'sort_order' => 1,
                    ],
                    [
                        'parameter_code' => 'delivery_lead_time',
                        'considered' => 'Yes',
                        'recommendations' => 'Feasible within 30 calendar days.',
                        'sort_order' => 4,
                    ],
                ],
            ])
            ->assertOk()
            ->assertJsonPath('ppmp.pre_submission_checks.market_scoping_generated', true)
            ->assertJsonPath('ppmp.pre_submission_checks.market_scoping_attached', true);

        $this->assertDatabaseHas('ppmp_market_scopings', [
            'ppmp_id' => $ppmp->id,
            'project_name' => 'Test Procurement Project',
            'scoping_period_from' => '10/2026',
            'scoping_period_to' => '11/2026',
        ]);
        $this->assertDatabaseHas('ppmp_market_scoping_activities', [
            'activity_code' => 'price_sourcing',
            'is_checked' => true,
        ]);
        $this->assertDatabaseHas('ppmp_market_scoping_results', [
            'parameter_code' => 'project_cost_estimate',
            'considered' => 'Yes',
        ]);

        $ppmp->update(['status' => 'TWG_REVIEW']);

        $twgReviewer = User::factory()->create([
            'name' => 'TWG Evaluator',
            'role' => 'twg',
            'office_id' => $this->oppmoOffice->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $commentRes = $this->actingAs($twgReviewer)
            ->postJson("/api/ppmps/{$ppmp->uuid}/cell-comments", [
                'field_key' => 'ms_result_project_cost_estimate_recommendations',
                'field_label' => 'Market Scoping • Project Cost Estimate (Recommendations)',
                'cell_value' => 'Aligned with current market canvass.',
                'comment' => 'Please specify number of supplier quotations gathered.',
            ])
            ->assertStatus(201);

        $commentId = $commentRes->json('data.id');
        $ppmp->update(['status' => 'TWG_RETURNED']);

        $this->actingAs($this->endUser)
            ->patchJson("/api/ppmps/{$ppmp->uuid}/cell-comments/{$commentId}/comply", [
                'compliance_note' => 'Updated with 3 supplier quotations.',
                'updated_cell_value' => 'Aligned with 3 recent supplier quotations and canvass sheets.',
            ])
            ->assertOk();

        $this->assertDatabaseHas('ppmp_market_scoping_results', [
            'parameter_code' => 'project_cost_estimate',
            'recommendations' => 'Aligned with 3 recent supplier quotations and canvass sheets.',
        ]);

        $ppmp->update(['status' => 'TWG_REVIEW']);
        $actCommentRes = $this->actingAs($twgReviewer)
            ->postJson("/api/ppmps/{$ppmp->uuid}/cell-comments", [
                'field_key' => 'ms_activity_philgeps_websites',
                'field_label' => 'Market Scoping Activity • Use of data from PhilGEPS or agency websites',
                'cell_value' => 'Unchecked',
                'comment' => 'Please check PhilGEPS data activity since postings were referenced.',
            ])
            ->assertStatus(201);

        $actCommentId = $actCommentRes->json('data.id');
        $ppmp->update(['status' => 'TWG_RETURNED']);

        $this->actingAs($this->endUser)
            ->patchJson("/api/ppmps/{$ppmp->uuid}/cell-comments/{$actCommentId}/comply", [
                'compliance_note' => 'Checked PhilGEPS data activity.',
                'updated_cell_value' => 'Checked',
            ])
            ->assertOk();

        $this->assertDatabaseHas('ppmp_market_scoping_activities', [
            'activity_code' => 'philgeps_websites',
            'is_checked' => true,
        ]);
    }

    public function test_only_admin_and_super_admin_can_delete_reviewer_comments(): void
    {
        $ppmp = $this->makePpmp('TWG_REVIEW');

        $twgReviewer = User::factory()->create([
            'name' => 'TWG Reviewer',
            'role' => 'twg',
            'office_id' => $this->oppmoOffice->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $admin = User::factory()->create([
            'name' => 'System Admin',
            'role' => 'admin',
            'office_id' => $this->oppmoOffice->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $superAdmin = User::factory()->create([
            'name' => 'Super Admin',
            'role' => 'super_admin',
            'office_id' => $this->oppmoOffice->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $comment1 = $this->actingAs($twgReviewer)
            ->postJson("/api/ppmps/{$ppmp->uuid}/cell-comments", [
                'field_key' => 'title',
                'field_label' => 'Project Title',
                'cell_value' => $ppmp->title,
                'comment' => 'Clarify project title.',
            ])
            ->assertStatus(201)
            ->json('data.id');

        $comment2 = $this->actingAs($twgReviewer)
            ->postJson("/api/ppmps/{$ppmp->uuid}/cell-comments", [
                'field_key' => 'title',
                'field_label' => 'Project Title',
                'cell_value' => $ppmp->title,
                'comment' => 'Second reviewer remark.',
            ])
            ->assertStatus(201)
            ->json('data.id');

        $this->actingAs($twgReviewer)
            ->deleteJson("/api/ppmps/{$ppmp->uuid}/cell-comments/{$comment1}")
            ->assertStatus(403);

        $this->actingAs($this->endUser)
            ->deleteJson("/api/ppmps/{$ppmp->uuid}/cell-comments/{$comment1}")
            ->assertStatus(403);

        $this->actingAs($admin)
            ->deleteJson("/api/ppmps/{$ppmp->uuid}/cell-comments/{$comment1}")
            ->assertOk();

        $this->actingAs($superAdmin)
            ->deleteJson("/api/ppmps/{$ppmp->uuid}/cell-comments/{$comment2}")
            ->assertOk();
    }

    public function test_admin_and_super_admin_can_fetch_ready_to_print_bulk_list_and_batch_details(): void
    {
        $readyPpmp = $this->makePpmp('READY_TO_PRINT');
        $draftPpmp = $this->makePpmp('DRAFT');

        $admin = User::factory()->create([
            'name' => 'Bulk Admin',
            'role' => 'admin',
            'office_id' => $this->oppmoOffice->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $this->actingAs($this->endUser)
            ->getJson('/api/admin/ready-to-print')
            ->assertStatus(403);

        $listRes = $this->actingAs($admin)
            ->getJson('/api/admin/ready-to-print')
            ->assertOk();

        $uuids = collect($listRes->json('ppmps'))->pluck('uuid')->all();
        $this->assertContains($readyPpmp->uuid, $uuids);
        $this->assertNotContains($draftPpmp->uuid, $uuids);

        $this->actingAs($admin)
            ->postJson('/api/admin/ready-to-print/batch-details', [
                'uuids' => [$readyPpmp->uuid, $draftPpmp->uuid],
            ])
            ->assertOk()
            ->assertJsonPath("ppmps_by_uuid.{$readyPpmp->uuid}.uuid", $readyPpmp->uuid);
    }

    public function test_multi_role_account_prompts_role_selection_on_login_and_can_switch_roles(): void
    {
        \App\Models\SystemSetting::set('turnstile_enabled', 'false');

        $multiUser = User::create([
            'name' => 'Multi Role Official',
            'email' => 'multirole@test.local',
            'password' => bcrypt('Secret123!'),
            'role' => 'end_user',
            'roles' => ['end_user', 'twg'],
            'office_id' => $this->oppmoOffice->id,
            'designation' => 'Admin Officer IV',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $step1 = $this->postJson('/api/login', [
            'email' => 'multirole@test.local',
            'password' => 'Secret123!',
        ])
            ->assertOk()
            ->assertJsonPath('requires_role_selection', true)
            ->assertJsonPath('available_roles', ['end_user', 'twg']);

        $token = $step1->json('role_selection_token');
        $this->assertNotEmpty($token);

        $this->postJson('/api/login', [
            'role_selection_token' => $token,
            'selected_role' => 'twg',
        ])
            ->assertOk()
            ->assertJsonPath('user.role', 'twg')
            ->assertJsonPath('user.available_roles', ['end_user', 'twg']);

        $this->assertSame('twg', $multiUser->fresh()->role);

        $this->actingAs($multiUser->fresh())
            ->postJson('/api/switch-role', ['role' => 'end_user'])
            ->assertOk()
            ->assertJsonPath('user.role', 'end_user');

        $this->actingAs($multiUser->fresh())
            ->postJson('/api/switch-role', ['role' => 'super_admin'])
            ->assertStatus(403);

        $ppmp = $this->makePpmp('DRAFT');
        $availRes = $this->actingAs($this->endUser)
            ->getJson("/api/ppmps/{$ppmp->uuid}/available-reviewers")
            ->assertOk();

        $twgIds = collect($availRes->json('twg_reviewers'))->pluck('id')->all();
        $this->assertContains($multiUser->id, $twgIds);

        $this->actingAs($this->endUser)
            ->putJson("/api/ppmps/{$ppmp->uuid}/reassign-reviewers", [
                'twg_reviewer_id' => $multiUser->id,
            ])
            ->assertOk();

        $this->assertSame($multiUser->id, $ppmp->fresh()->twg_reviewer_id);
    }

    public function test_super_admin_threat_logs_deleted_data_auto_backup_mass_delete_red_alert_and_15day_backup(): void
    {

        $superAdmin = User::factory()->create([
            'name' => 'SOC Super Admin',
            'role' => 'super_admin',
            'office_id' => $this->oppmoOffice->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $regularAdmin = User::factory()->create([
            'name' => 'Regular Admin',
            'role' => 'admin',
            'office_id' => $this->oppmoOffice->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $this->withHeaders([
            'User-Agent' => 'curl/8.5.0',
            'X-Forwarded-For' => '203.0.113.45',
            'Authorization' => 'Bearer secret_attacker_token_99999',
        ])->getJson('/api/ppmps')->assertStatus(401);

        $this->assertDatabaseHas('security_threat_logs', [
            'threat_type' => 'CLI_API_PROBING',
            'ip_address' => '203.0.113.45',
            'endpoint' => '/api/ppmps',
            'token_type' => 'Bearer Token',
        ]);

        $this->actingAs($regularAdmin)
            ->getJson('/api/super-admin/security-threats')
            ->assertStatus(403);

        $deletedIds = [];
        for ($i = 0; $i < 5; $i++) {
            $p = $this->makePpmp('DRAFT');
            $deletedIds[] = $p->id;
            $p->delete();
        }

        $this->assertDatabaseHas('deleted_data_backups', [
            'table_name' => 'ppmps',
            'record_id' => (string) $deletedIds[0],
            'is_force_delete' => true,
        ]);

        $this->assertDatabaseHas('security_threat_logs', [
            'threat_type' => 'MASS_DELETE_RED_ALERT',
            'severity' => 'critical',
            'is_red_alert' => true,
        ]);

        $this->assertDatabaseHas('scheduled_database_backups', [
            'trigger_type' => 'mass_delete_emergency',
        ]);

        $this->actingAs($superAdmin)
            ->getJson('/api/super-admin/security-threats')
            ->assertOk()
            ->assertJsonStructure(['logs', 'summary', 'auto_backup_schedule']);

        $backup = \App\Models\DeletedDataBackup::where('table_name', 'ppmps')->firstOrFail();
        $this->actingAs($superAdmin)
            ->postJson("/api/super-admin/deleted-backups/{$backup->id}/restore")
            ->assertOk();

        $this->assertDatabaseHas('ppmps', ['id' => (int) $backup->record_id]);

        $this->actingAs($superAdmin)
            ->postJson('/api/super-admin/scheduled-backups/run-now')
            ->assertStatus(201);
    }

    public function test_cell_comments_enforce_1000_word_limit_and_handle_long_labels_and_numeric_values(): void
    {
        $ppmp = $this->makePpmp('TWG_REVIEW');

        $twgReviewer = User::factory()->create([
            'name' => 'TWG Word Limit Tester',
            'role' => 'twg',
            'office_id' => $this->oppmoOffice->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $exactly1000Words = implode(' ', array_fill(0, 1000, 'remark'));
        $longLabel = 'Market Scoping Activity • Review of product or service brochures, marketing materials, industry journals and publications or related materials';

        $createRes = $this->actingAs($twgReviewer)
            ->postJson("/api/ppmps/{$ppmp->uuid}/cell-comments", [
                'field_key' => 'ms_activity_brochures_materials',
                'field_label' => $longLabel,
                'cell_value' => 55555550,
                'comment' => $exactly1000Words,
            ])
            ->assertStatus(201);

        $commentId = $createRes->json('data.id');
        $this->assertNotEmpty($commentId);

        $over1000Words = implode(' ', array_fill(0, 1001, 'remark'));
        $this->actingAs($twgReviewer)
            ->postJson("/api/ppmps/{$ppmp->uuid}/cell-comments", [
                'field_key' => 'title',
                'field_label' => 'Project Title',
                'cell_value' => 'Sample',
                'comment' => $over1000Words,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['comment']);

        $ppmp->update(['status' => 'TWG_RETURNED']);
        $this->actingAs($this->endUser)
            ->patchJson("/api/ppmps/{$ppmp->uuid}/cell-comments/{$commentId}/comply", [
                'compliance_note' => $over1000Words,
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['compliance_note']);

        $this->actingAs($this->endUser)
            ->patchJson("/api/ppmps/{$ppmp->uuid}/cell-comments/{$commentId}/comply", [
                'compliance_note' => $exactly1000Words,
            ])
            ->assertOk();
    }
}
