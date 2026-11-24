<?php

namespace Tests\Feature;

use App\Models\Office;
use App\Models\Ppmp;
use App\Models\PpmpItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class AmendedAppRegenerationTest extends TestCase
{
    use RefreshDatabase;

    protected User $adminUser;
    protected User $endUser;
    protected User $oppmoUser;
    protected User $budgetOfficer;
    protected User $twgUser;
    protected Office $office;

    protected function setUp(): void
    {
        parent::setUp();

        $this->office = Office::create([
            'code' => 'ENG',
            'name' => 'Provincial Engineering Office',
        ]);

        $password = Hash::make('password123');

        $this->adminUser = User::create([
            'name' => 'Admin User',
            'email' => 'admin@eproc.test',
            'password' => $password,
            'role' => 'admin',
            'office_id' => $this->office->id,
            'is_active' => true,
        ]);

        $this->endUser = User::create([
            'name' => 'End User Jane',
            'email' => 'jane@eproc.test',
            'password' => $password,
            'role' => 'end_user',
            'office_id' => $this->office->id,
            'is_active' => true,
        ]);

        $this->oppmoUser = User::create([
            'name' => 'OPPMO Officer',
            'email' => 'oppmo@eproc.test',
            'password' => $password,
            'role' => 'oppmo',
            'office_id' => $this->office->id,
            'is_active' => true,
        ]);

        $this->budgetOfficer = User::create([
            'name' => 'Budget Officer Bob',
            'email' => 'budget@eproc.test',
            'password' => $password,
            'role' => 'budget_officer',
            'office_id' => $this->office->id,
            'is_active' => true,
        ]);

        $this->twgUser = User::create([
            'name' => 'TWG Evaluator',
            'email' => 'twg@eproc.test',
            'password' => $password,
            'role' => 'twg',
            'office_id' => $this->office->id,
            'is_active' => true,
        ]);
    }

    public function test_amendment_ppmp_app_only_bypasses_twg_and_requires_app_regeneration(): void
    {

        $parentPpmp = Ppmp::create([
            'uuid' => (string) Str::uuid(),
            'tracking_number' => 'ENG-2026-000001',
            'ppmp_number' => '1',
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
            'title' => 'Original Road Maintenance Project',
            'source_of_fund' => 'General Fund',
            'fiscal_year' => '2026',
            'plan_type' => 'FINAL',
            'total_budget' => 500000.00,
            'status' => 'READY_TO_PRINT',
            'app_data' => [
                'title' => 'ANNUAL PROCUREMENT PLAN FOR FY 2026',
                'rows' => [
                    [
                        'itemNo' => 1,
                        'projectTitle' => 'Road Asphalt and Gravel',
                        'endUser' => 'Provincial Engineering Office',
                        'estimatedBudget' => 500000.00,
                        'procurementStrategy' => 'Public Bidding',
                    ]
                ],
            ],
        ]);

        PpmpItem::create([
            'ppmp_id' => $parentPpmp->id,
            'item_no' => 1,
            'description' => 'Road Asphalt and Gravel',
            'estimated_budget' => 500000.00,
            'project_type' => 'Goods',
            'procurement_mode' => 'Public Bidding',
        ]);

        $parentPpmp->update([
            'amendment_status' => 'PENDING_APPROVAL',
            'amendment_type' => 'AMENDMENT',
            'amendment_scope' => 'PPMP_APP',
            'amendment_justification' => 'Need additional materials',
            'amended_at' => now(),
        ]);

        $approveRes = $this->actingAs($this->adminUser)->postJson("/api/ppmps/{$parentPpmp->uuid}/amendment/approve", [
            'admin_notes' => 'Approved amendment request',
        ]);
        $approveRes->assertStatus(200);

        $childPpmp = Ppmp::where('parent_id', $parentPpmp->id)->firstOrFail();
        $this->assertEquals('AMENDMENT', $childPpmp->amendment_type);
        $this->assertEquals('PPMP_APP', $childPpmp->amendment_scope);
        $this->assertFalse($childPpmp->hasAppGenerated());
        $this->assertTrue($childPpmp->app_data['needs_regeneration']);
        $this->assertNotEmpty($childPpmp->app_data['old_app']);
        $this->assertEquals(500000.00, $childPpmp->app_data['old_app']['rows'][0]['estimatedBudget']);

        $updateRes = $this->actingAs($this->endUser)->putJson("/api/ppmps/{$childPpmp->uuid}", [
            'title' => 'Updated Road Maintenance Project',
            'fiscal_year' => '2026',
            'plan_type' => 'FINAL',
            'items' => [
                [
                    'description' => 'Road Asphalt, Gravel and Concrete Mix',
                    'project_type' => 'Goods',
                    'quantity_size' => '1 lot',
                    'procurement_mode' => 'Public Bidding',
                    'estimated_budget' => 650000.00,
                ]
            ],
        ]);
        $updateRes->assertStatus(200);

        $childPpmp->refresh();
        $this->assertTrue($childPpmp->changeLogs()->where('user_id', $this->endUser->id)->exists());
        $this->assertEquals(650000.00, (float)$childPpmp->total_budget);
        $this->assertTrue($childPpmp->app_data['needs_regeneration']);
        $this->assertNotNull($childPpmp->app_data['old_app']);

        $childPpmp->update(['status' => 'BUDGET_OFFICER_REVIEW']);
        $childItem = $childPpmp->items()->firstOrFail();
        $budgetReturnRes = $this->actingAs($this->budgetOfficer)->postJson("/api/ppmps/{$childPpmp->uuid}/budget/return", [
            'remarks' => 'Adjust estimated budget to 600,000',
            'field_changes' => [
                [
                    'item_id' => $childItem->id,
                    'field_name' => 'estimated_budget',
                    'old_value' => '650000.00',
                    'new_value' => '600000.00',
                ]
            ]
        ]);
        $budgetReturnRes->assertStatus(200);

        $childPpmp->refresh();
        $this->assertTrue(
            $childPpmp->changeLogs()
                ->where('user_id', $this->budgetOfficer->id)
                ->where('role', 'budget_officer')
                ->where('field_name', 'estimated_budget')
                ->exists()
        );

        $childPpmp->update(['status' => 'OPPMO_REVIEW']);

        $twgFail = $this->actingAs($this->twgUser)->postJson("/api/ppmps/{$childPpmp->uuid}/twg/approve");
        $twgFail->assertStatus(422);

        $oppmoApproveFail = $this->actingAs($this->oppmoUser)->postJson("/api/ppmps/{$childPpmp->uuid}/oppmo/approve", [
            'remarks' => 'Trying to approve without regenerating APP',
        ]);
        $oppmoApproveFail->assertStatus(422);
        $this->assertStringContainsString('Annual Procurement Plan (APP)', $oppmoApproveFail->json('message'));

        $saveAppRes = $this->actingAs($this->oppmoUser)->postJson("/api/ppmps/{$childPpmp->uuid}/app-data", [
            'fiscal_year' => '2026',
            'plan_version_type' => 'UPDATED',
            'rows' => [
                [
                    'itemNo' => 1,
                    'projectTitle' => 'Road Asphalt, Gravel and Concrete Mix',
                    'endUser' => 'Provincial Engineering Office',
                    'estimatedBudget' => 600000.00,
                    'procurementStrategy' => 'Public Bidding',
                ]
            ],
        ]);
        $saveAppRes->assertStatus(200);

        $childPpmp->refresh();
        $this->assertTrue($childPpmp->hasAppGenerated());
        $this->assertFalse($childPpmp->app_data['needs_regeneration'] ?? true);
        $this->assertTrue($childPpmp->app_data['is_generated']);
        $this->assertNotNull($childPpmp->app_data['old_app']);
        $this->assertEquals(500000.00, $childPpmp->app_data['old_app']['rows'][0]['estimatedBudget']);

        $this->assertTrue(
            $childPpmp->changeLogs()
                ->where('user_id', $this->oppmoUser->id)
                ->where('role', 'oppmo')
                ->where('field_name', 'Annual Procurement Plan (APP)')
                ->exists()
        );

        $oppmoApproveSuccess = $this->actingAs($this->oppmoUser)->postJson("/api/ppmps/{$childPpmp->uuid}/oppmo/approve", [
            'remarks' => 'APP regenerated and verified.',
        ]);
        $oppmoApproveSuccess->assertStatus(200);
        $this->assertEquals('READY_TO_PRINT', $childPpmp->fresh()->status);
    }

    public function test_supplemental_ppmp_allows_twg_review_and_requires_app_regeneration(): void
    {

        $parentPpmp = Ppmp::create([
            'uuid' => (string) Str::uuid(),
            'tracking_number' => 'ENG-2026-000002',
            'ppmp_number' => '2',
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
            'title' => 'Original Hospital Supplies',
            'source_of_fund' => 'General Fund',
            'fiscal_year' => '2026',
            'plan_type' => 'FINAL',
            'total_budget' => 300000.00,
            'status' => 'READY_TO_PRINT',
            'app_data' => [
                'title' => 'ANNUAL PROCUREMENT PLAN FOR FY 2026',
                'rows' => [
                    [
                        'itemNo' => 1,
                        'projectTitle' => 'Hospital Medical Supplies',
                        'endUser' => 'Provincial Engineering Office',
                        'estimatedBudget' => 300000.00,
                        'procurementStrategy' => 'Small Value Procurement',
                    ]
                ],
            ],
        ]);

        PpmpItem::create([
            'ppmp_id' => $parentPpmp->id,
            'item_no' => 1,
            'description' => 'Hospital Medical Supplies',
            'estimated_budget' => 300000.00,
            'project_type' => 'Goods',
            'procurement_mode' => 'Small Value Procurement',
        ]);

        $parentPpmp->update([
            'amendment_status' => 'PENDING_APPROVAL',
            'amendment_type' => 'SUPPLEMENTAL',
            'amendment_scope' => 'ALL',
            'amendment_justification' => 'Emergency additional supplies needed',
            'amended_at' => now(),
        ]);

        $approveRes = $this->actingAs($this->adminUser)->postJson("/api/ppmps/{$parentPpmp->uuid}/amendment/approve", [
            'admin_notes' => 'Approved supplemental request',
        ]);
        $approveRes->assertStatus(200);

        $childPpmp = Ppmp::where('parent_id', $parentPpmp->id)->firstOrFail();
        $this->assertEquals('SUPPLEMENTAL', $childPpmp->amendment_type);

        $childPpmp->update(['status' => 'TWG_REVIEW']);

        $twgApproveRes = $this->actingAs($this->twgUser)->postJson("/api/ppmps/{$childPpmp->uuid}/twg/approve");
        $twgApproveRes->assertStatus(200);
        $this->assertEquals('BUDGET_OFFICER_REVIEW', $childPpmp->fresh()->status);
        $this->assertNotNull($childPpmp->fresh()->twg_approved_at);

        $budgetApproveRes = $this->actingAs($this->budgetOfficer)->postJson("/api/ppmps/{$childPpmp->uuid}/budget/approve");
        $budgetApproveRes->assertStatus(200);
        $this->assertEquals('OPPMO_REVIEW', $childPpmp->fresh()->status);

        $oppmoApproveBlocked = $this->actingAs($this->oppmoUser)->postJson("/api/ppmps/{$childPpmp->uuid}/oppmo/approve");
        $oppmoApproveBlocked->assertStatus(422);

        $saveApp = $this->actingAs($this->oppmoUser)->postJson("/api/ppmps/{$childPpmp->uuid}/app-data", [
            'fiscal_year' => '2026',
            'plan_version_type' => 'UPDATED',
            'rows' => [
                [
                    'itemNo' => 1,
                    'projectTitle' => 'Hospital Medical Supplies (Supplemental)',
                    'endUser' => 'Provincial Engineering Office',
                    'estimatedBudget' => 300000.00,
                    'procurementStrategy' => 'Small Value Procurement',
                ]
            ],
        ]);
        $saveApp->assertStatus(200);

        $oppmoFinalApprove = $this->actingAs($this->oppmoUser)->postJson("/api/ppmps/{$childPpmp->uuid}/oppmo/approve", [
            'remarks' => 'APP finalized and ready to print.',
        ]);
        $oppmoFinalApprove->assertStatus(200);
        $this->assertEquals('READY_TO_PRINT', $childPpmp->fresh()->status);
    }
}
