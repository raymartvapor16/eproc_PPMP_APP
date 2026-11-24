<?php

namespace Tests\Feature;

use App\Models\AccountCode;
use App\Models\Office;
use App\Models\Ppmp;
use App\Models\PpmpAttachment;
use App\Models\PpmpItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class ReviewerAssignmentWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected Office $office;
    protected User $endUser;
    protected User $twg1;
    protected User $twg2;
    protected User $budgetOfficer;
    protected User $paccoReviewer;
    protected User $oppmoReviewer;
    protected AccountCode $accountCode;
    protected Ppmp $ppmp;

    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('private');

        $this->office = Office::create([
            'name' => 'Provincial General Services Office',
            'code' => 'PGSO',
            'is_active' => true,
        ]);

        $this->endUser = User::create([
            'name' => 'End User Preparer',
            'email' => 'enduser@davaodelsur.gov.ph',
            'password' => bcrypt('Password123!'),
            'role' => 'end_user',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $this->accountCode = AccountCode::create([
            'code' => '5-02-03-010',
            'name' => 'Office Supplies Expenses',
            'account_class' => 'Expenses',
            'is_active' => true,
        ]);

        $this->twg1 = User::create([
            'name' => 'TWG Supplies Specialist',
            'email' => 'twg1@davaodelsur.gov.ph',
            'password' => bcrypt('Password123!'),
            'role' => 'twg',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        $this->twg1->accountCodes()->sync([$this->accountCode->id]);

        $this->twg2 = User::create([
            'name' => 'TWG Infrastructure Specialist',
            'email' => 'twg2@davaodelsur.gov.ph',
            'password' => bcrypt('Password123!'),
            'role' => 'twg',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $this->budgetOfficer = User::create([
            'name' => 'Provincial Budget Officer',
            'email' => 'pbo@davaodelsur.gov.ph',
            'password' => bcrypt('Password123!'),
            'role' => 'budget_officer',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $this->paccoReviewer = User::create([
            'name' => 'PACCO Accountant',
            'email' => 'pacco@davaodelsur.gov.ph',
            'password' => bcrypt('Password123!'),
            'role' => 'pacco',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $this->oppmoReviewer = User::create([
            'name' => 'OPPMO Secretariat',
            'email' => 'oppmo@davaodelsur.gov.ph',
            'password' => bcrypt('Password123!'),
            'role' => 'oppmo',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $this->ppmp = Ppmp::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'ppmp_number' => 'PPMP-2026-0001',
            'tracking_number' => 'TEST-PGSO-2026-000001',
            'title' => 'Supply and Delivery of Stationery Supplies',
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
            'status' => 'DRAFT',
            'fiscal_year' => 2026,
            'source_of_fund' => 'General Fund',
            'account_code' => $this->accountCode->code,
            'account_code_id' => $this->accountCode->id,
            'attachment_list_data' => [
                'attachment_lists' => [
                    '0' => [
                        'rows' => [
                            ['item_no' => 1, 'description' => 'A4 Paper', 'qty' => 100, 'unit_cost' => 250],
                        ],
                    ],
                ],
            ],
        ]);

        PpmpItem::create([
            'ppmp_id' => $this->ppmp->id,
            'item_no' => 1,
            'description' => 'A4 Copier Paper',
            'quantity' => 100,
            'unit_cost' => 250,
            'estimated_budget' => 25000,
            'account_code_id' => $this->accountCode->id,
        ]);

        PpmpAttachment::create([
            'uuid' => (string) \Illuminate\Support\Str::uuid(),
            'ppmp_id' => $this->ppmp->id,
            'attachment_type' => 'MARKET_SCOPING',
            'original_filename' => 'market_scoping.pdf',
            'stored_filename' => 'market_scoping.pdf',
            'storage_path' => 'attachments/test_market_scoping.pdf',
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
            'uploaded_by' => $this->endUser->id,
        ]);
    }

    public function test_get_available_reviewers_returns_categorized_reviewers_with_matching_flags(): void
    {
        $response = $this->actingAs($this->endUser)->getJson("/api/ppmps/{$this->ppmp->uuid}/available-reviewers");

        $response->assertStatus(200)
            ->assertJsonStructure([
                'is_trust_fund',
                'source_of_fund',
                'twg_reviewers',
                'budget_reviewers',
                'pacco_reviewers',
                'oppmo_reviewers',
                'assigned_reviewers',
            ]);

        $twgList = collect($response->json('twg_reviewers'));
        $matchingTwg = $twgList->firstWhere('id', $this->twg1->id);
        $nonMatchingTwg = $twgList->firstWhere('id', $this->twg2->id);

        $this->assertNotNull($matchingTwg);
        $this->assertTrue($matchingTwg['matches_ppmp_account_code']);
        $this->assertFalse($nonMatchingTwg['matches_ppmp_account_code']);
    }

    public function test_submit_for_review_assigns_reviewers_and_routes_to_first_pick_twg(): void
    {
        $payload = [
            'twg_reviewer_id' => $this->twg1->id,
            'budget_reviewer_id' => $this->budgetOfficer->id,
            'oppmo_reviewer_id' => $this->oppmoReviewer->id,
        ];

        $response = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$this->ppmp->uuid}/submit-for-review", $payload);

        $response->assertStatus(200);

        $this->ppmp->refresh();
        $this->assertEquals('TWG_REVIEW', $this->ppmp->status);
        $this->assertEquals($this->twg1->id, $this->ppmp->twg_reviewer_id);
        $this->assertEquals($this->budgetOfficer->id, $this->ppmp->budget_reviewer_id);
        $this->assertEquals($this->oppmoReviewer->id, $this->ppmp->oppmo_reviewer_id);

        $this->assertDatabaseHas('ppmp_routes', [
            'ppmp_id' => $this->ppmp->id,
            'to_user_id' => $this->twg1->id,
            'to_role' => 'twg',
            'action' => 'SUBMITTED_FOR_REVIEW',
            'status' => 'TWG_REVIEW',
        ]);
    }

    public function test_twg_approval_routes_to_assigned_budget_reviewer(): void
    {

        $this->ppmp->update([
            'status' => 'TWG_REVIEW',
            'twg_reviewer_id' => $this->twg1->id,
            'budget_reviewer_id' => $this->budgetOfficer->id,
            'oppmo_reviewer_id' => $this->oppmoReviewer->id,
            'twg_received_at' => now(),
        ]);

        $response = $this->actingAs($this->twg1)->postJson("/api/ppmps/{$this->ppmp->uuid}/twg/approve");

        $response->assertStatus(200);
        $this->ppmp->refresh();
        $this->assertEquals('BUDGET_OFFICER_REVIEW', $this->ppmp->status);

        $this->assertDatabaseHas('ppmp_routes', [
            'ppmp_id' => $this->ppmp->id,
            'to_user_id' => $this->budgetOfficer->id,
            'to_role' => 'budget_officer',
            'action' => 'TWG_APPROVED',
            'status' => 'BUDGET_OFFICER_REVIEW',
        ]);
    }

    public function test_budget_approval_routes_to_assigned_oppmo_reviewer(): void
    {

        $this->ppmp->update([
            'status' => 'BUDGET_OFFICER_REVIEW',
            'twg_reviewer_id' => $this->twg1->id,
            'budget_reviewer_id' => $this->budgetOfficer->id,
            'oppmo_reviewer_id' => $this->oppmoReviewer->id,
            'budget_received_at' => now(),
        ]);

        $response = $this->actingAs($this->budgetOfficer)->postJson("/api/ppmps/{$this->ppmp->uuid}/budget/approve");

        $response->assertStatus(200);
        $this->ppmp->refresh();
        $this->assertEquals('OPPMO_REVIEW', $this->ppmp->status);

        $this->assertDatabaseHas('ppmp_routes', [
            'ppmp_id' => $this->ppmp->id,
            'to_user_id' => $this->oppmoReviewer->id,
            'to_role' => 'oppmo',
            'action' => 'BUDGET_APPROVED',
            'status' => 'OPPMO_REVIEW',
        ]);
    }

    public function test_end_user_and_reviewers_can_reassign_mistaken_selection(): void
    {

        $this->ppmp->update([
            'status' => 'TWG_REVIEW',
            'twg_reviewer_id' => $this->twg1->id,
            'budget_reviewer_id' => $this->budgetOfficer->id,
            'oppmo_reviewer_id' => $this->oppmoReviewer->id,
        ]);

        \App\Models\PpmpRoute::create([
            'ppmp_id' => $this->ppmp->id,
            'from_user_id' => $this->endUser->id,
            'to_user_id' => $this->twg1->id,
            'from_role' => 'end_user',
            'to_role' => 'twg',
            'action' => 'SUBMITTED_FOR_REVIEW',
            'status' => 'TWG_REVIEW',
        ]);

        $response = $this->actingAs($this->endUser)->putJson("/api/ppmps/{$this->ppmp->uuid}/reassign-reviewers", [
            'twg_reviewer_id' => $this->twg2->id,
            'budget_reviewer_id' => $this->budgetOfficer->id,
            'oppmo_reviewer_id' => $this->oppmoReviewer->id,
            'reason' => 'Mistaken TWG pick during submission',
        ]);

        $response->assertStatus(200);
        $this->ppmp->refresh();
        $this->assertEquals($this->twg2->id, $this->ppmp->twg_reviewer_id);

        $this->assertDatabaseHas('ppmp_routes', [
            'ppmp_id' => $this->ppmp->id,
            'to_user_id' => $this->twg2->id,
            'to_role' => 'twg',
            'status' => 'TWG_REVIEW',
        ]);
    }

    public function test_unauthorized_user_cannot_reassign_reviewers(): void
    {
        $otherUser = User::create([
            'name' => 'Outsider User',
            'email' => 'outsider@davaodelsur.gov.ph',
            'password' => bcrypt('Password123!'),
            'role' => 'end_user',
            'office_id' => Office::create(['name' => 'Other Office', 'code' => 'OTHER', 'is_active' => true])->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $response = $this->actingAs($otherUser)->putJson("/api/ppmps/{$this->ppmp->uuid}/reassign-reviewers", [
            'twg_reviewer_id' => $this->twg2->id,
        ]);

        $response->assertStatus(403);
    }

    public function test_unselected_reviewer_cannot_view_edit_comment_receive_or_approve(): void
    {

        $this->ppmp->update([
            'status' => 'TWG_REVIEW',
            'twg_reviewer_id' => $this->twg1->id,
            'budget_reviewer_id' => $this->budgetOfficer->id,
            'oppmo_reviewer_id' => $this->oppmoReviewer->id,
        ]);

        $viewRes = $this->actingAs($this->twg2)->getJson("/api/ppmps/{$this->ppmp->uuid}");
        $viewRes->assertStatus(403);

        $indexRes = $this->actingAs($this->twg2)->getJson('/api/ppmps');
        $indexRes->assertStatus(200);
        $uuids = collect($indexRes->json('data'))->pluck('uuid');
        $this->assertFalse($uuids->contains($this->ppmp->uuid));

        $receiveRes = $this->actingAs($this->twg2)->postJson("/api/ppmps/{$this->ppmp->uuid}/receive");
        $receiveRes->assertStatus(403);

        $commentRes = $this->actingAs($this->twg2)->postJson("/api/ppmps/{$this->ppmp->uuid}/cell-comments", [
            'field_key' => 'general_description',
            'comment' => 'Unassigned comment attempt',
        ]);
        $commentRes->assertStatus(403);

        $approveRes = $this->actingAs($this->twg2)->postJson("/api/ppmps/{$this->ppmp->uuid}/twg/approve");
        $approveRes->assertStatus(403);

        $twg1ViewRes = $this->actingAs($this->twg1)->getJson("/api/ppmps/{$this->ppmp->uuid}");
        $twg1ViewRes->assertStatus(200);

        $twg1CommentRes = $this->actingAs($this->twg1)->postJson("/api/ppmps/{$this->ppmp->uuid}/cell-comments", [
            'field_key' => 'general_description',
            'comment' => 'Valid assigned comment',
        ]);
        $twg1CommentRes->assertStatus(201);
    }

    public function test_reviewer_can_return_ppmp_to_previous_reviewer_with_remarks(): void
    {

        $this->ppmp->update([
            'status' => 'BUDGET_OFFICER_REVIEW',
            'twg_reviewer_id' => $this->twg1->id,
            'budget_reviewer_id' => $this->budgetOfficer->id,
            'oppmo_reviewer_id' => $this->oppmoReviewer->id,
            'budget_received_at' => now(),
        ]);

        $this->ppmp->milestones()->updateOrCreate([], [
            'twg_approved_at' => now(),
        ]);

        $remarks = 'Technical specifications for Item #1 do not correspond to the requested account code. Please adjust.';
        $response = $this->actingAs($this->budgetOfficer)->postJson("/api/ppmps/{$this->ppmp->uuid}/return", [
            'target' => 'twg',
            'remarks' => $remarks,
        ]);

        $response->assertStatus(200);

        $this->ppmp->refresh();

        $this->assertEquals('TWG_REVIEW', $this->ppmp->status);
        $this->assertNull($this->ppmp->twg_received_at);

        $this->assertNull($this->ppmp->milestones->fresh()->twg_approved_at);

        $this->assertDatabaseHas('ppmp_routes', [
            'ppmp_id' => $this->ppmp->id,
            'from_user_id' => $this->budgetOfficer->id,
            'to_user_id' => $this->twg1->id,
            'to_role' => 'twg',
            'action' => 'RETURNED_TO_TWG',
            'status' => 'TWG_REVIEW',
            'remarks' => $remarks,
        ]);

        $this->assertDatabaseHas('system_notifications', [
            'user_id' => $this->twg1->id,
            'ppmp_id' => $this->ppmp->id,
        ]);
    }

    public function test_oppmo_can_return_to_budget_reviewer_with_remarks(): void
    {

        $this->ppmp->update([
            'status' => 'OPPMO_REVIEW',
            'twg_reviewer_id' => $this->twg1->id,
            'budget_reviewer_id' => $this->budgetOfficer->id,
            'oppmo_reviewer_id' => $this->oppmoReviewer->id,
            'oppmo_received_at' => now(),
        ]);

        $this->ppmp->milestones()->updateOrCreate([], [
            'twg_approved_at' => now(),
            'budget_approved_at' => now(),
        ]);

        $remarks = 'The budget source allocation needs re-certification against the approved appropriation.';
        $response = $this->actingAs($this->oppmoReviewer)->postJson("/api/ppmps/{$this->ppmp->uuid}/return", [
            'target' => 'budget',
            'remarks' => $remarks,
        ]);

        $response->assertStatus(200);

        $this->ppmp->refresh();
        $this->assertEquals('BUDGET_OFFICER_REVIEW', $this->ppmp->status);
        $this->assertNull($this->ppmp->budget_received_at);
        $this->assertNull($this->ppmp->milestones->fresh()->budget_approved_at);

        $this->assertDatabaseHas('ppmp_routes', [
            'ppmp_id' => $this->ppmp->id,
            'from_user_id' => $this->oppmoReviewer->id,
            'to_user_id' => $this->budgetOfficer->id,
            'action' => 'RETURNED_TO_BUDGET_OFFICER',
            'status' => 'BUDGET_OFFICER_REVIEW',
            'remarks' => $remarks,
        ]);
    }

    public function test_twg_reviewer_can_only_reassign_to_another_twg_reviewer(): void
    {
        $this->ppmp->update([
            'status' => 'TWG_REVIEW',
            'twg_reviewer_id' => $this->twg1->id,
            'budget_reviewer_id' => $this->budgetOfficer->id,
            'oppmo_reviewer_id' => $this->oppmoReviewer->id,
            'twg_received_at' => now(),
        ]);

        $res = $this->actingAs($this->twg1)->putJson("/api/ppmps/{$this->ppmp->uuid}/reassign-reviewers", [
            'twg_reviewer_id' => $this->twg2->id,
            'reason' => 'Reassigning to Infrastructure specialist',
        ]);
        $res->assertStatus(200);

        $this->ppmp->refresh();
        $this->assertEquals($this->twg2->id, $this->ppmp->twg_reviewer_id);

        $this->assertNull($this->ppmp->twg_received_at);

        $failRes = $this->actingAs($this->twg2)->putJson("/api/ppmps/{$this->ppmp->uuid}/reassign-reviewers", [
            'budget_reviewer_id' => $this->paccoReviewer->id,
        ]);
        $failRes->assertStatus(403);
        $failRes->assertJsonFragment([
            'message' => 'Unauthorized. As a BAC-TWG reviewer, you may only reassign to another BAC-TWG reviewer.'
        ]);
    }

    public function test_reassigned_reviewer_must_receive_ppmp_first_for_monitoring(): void
    {
        $this->ppmp->update([
            'status' => 'TWG_REVIEW',
            'twg_reviewer_id' => $this->twg1->id,
            'budget_reviewer_id' => $this->budgetOfficer->id,
            'oppmo_reviewer_id' => $this->oppmoReviewer->id,
            'twg_received_at' => now(),
        ]);

        $this->actingAs($this->twg1)->putJson("/api/ppmps/{$this->ppmp->uuid}/reassign-reviewers", [
            'twg_reviewer_id' => $this->twg2->id,
            'reason' => 'Domain adjustment',
        ])->assertStatus(200);

        $this->ppmp->refresh();

        $this->assertNull($this->ppmp->twg_received_at);

        $this->assertDatabaseHas('ppmp_routes', [
            'ppmp_id' => $this->ppmp->id,
            'to_user_id' => $this->twg2->id,
            'to_role' => 'twg',
            'action' => 'REASSIGNED',
            'status' => 'TWG_REVIEW',
            'received_at' => null,
        ]);

        $receiveRes = $this->actingAs($this->twg2)->postJson("/api/ppmps/{$this->ppmp->uuid}/receive");
        $receiveRes->assertStatus(200);

        $this->ppmp->refresh();
        $this->assertNotNull($this->ppmp->twg_received_at);

        $this->assertDatabaseHas('ppmp_routes', [
            'ppmp_id' => $this->ppmp->id,
            'from_user_id' => $this->twg2->id,
            'action' => 'TWG_RECEIVED',
            'status' => 'TWG_REVIEW',
        ]);
    }

    public function test_budget_reviewer_can_only_reassign_to_another_budget_reviewer(): void
    {
        $this->ppmp->update([
            'status' => 'BUDGET_OFFICER_REVIEW',
            'twg_reviewer_id' => $this->twg1->id,
            'budget_reviewer_id' => $this->budgetOfficer->id,
            'oppmo_reviewer_id' => $this->oppmoReviewer->id,
            'budget_received_at' => now(),
        ]);

        $failRes = $this->actingAs($this->budgetOfficer)->putJson("/api/ppmps/{$this->ppmp->uuid}/reassign-reviewers", [
            'twg_reviewer_id' => $this->twg2->id,
        ]);
        $failRes->assertStatus(403);
        $failRes->assertJsonFragment([
            'message' => 'Unauthorized. As a Budget/PACCO reviewer, you may only reassign to another Budget/PACCO reviewer.'
        ]);

        $res = $this->actingAs($this->budgetOfficer)->putJson("/api/ppmps/{$this->ppmp->uuid}/reassign-reviewers", [
            'budget_reviewer_id' => $this->paccoReviewer->id,
            'reason' => 'Trust fund scope reassignment',
        ]);
        $res->assertStatus(200);

        $this->ppmp->refresh();
        $this->assertEquals($this->paccoReviewer->id, $this->ppmp->budget_reviewer_id);
        $this->assertNull($this->ppmp->budget_received_at);
    }

    public function test_end_user_resubmitting_after_suspension_automatically_resubmits_to_assigned_reviewer(): void
    {

        $this->ppmp->update([
            'status' => 'TWG_RETURNED',
            'twg_reviewer_id' => $this->twg1->id,
            'budget_reviewer_id' => $this->budgetOfficer->id,
            'oppmo_reviewer_id' => $this->oppmoReviewer->id,
            'enduser_received_at' => now(),
        ]);

        $res = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$this->ppmp->uuid}/submit-for-review", []);
        $res->assertStatus(200);

        $this->ppmp->refresh();
        $this->assertEquals('TWG_REVIEW', $this->ppmp->status);
        $this->assertEquals($this->twg1->id, $this->ppmp->twg_reviewer_id);
        $this->assertNull($this->ppmp->twg_received_at);

        $this->assertDatabaseHas('ppmp_routes', [
            'ppmp_id' => $this->ppmp->id,
            'from_user_id' => $this->endUser->id,
            'to_user_id' => $this->twg1->id,
            'to_role' => 'twg',
            'action' => 'SUBMITTED_FOR_REVIEW',
            'status' => 'TWG_REVIEW',
        ]);

        $this->assertDatabaseHas('system_notifications', [
            'user_id' => $this->twg1->id,
            'ppmp_id' => $this->ppmp->id,
            'title' => 'PPMP Resubmitted for Review',
        ]);
    }

    public function test_ready_to_print_ppmp_is_visible_and_accessible_to_unselected_reviewers(): void
    {

        $this->ppmp->update([
            'status' => 'READY_TO_PRINT',
            'twg_reviewer_id' => $this->twg1->id,
            'budget_reviewer_id' => $this->budgetOfficer->id,
            'oppmo_reviewer_id' => $this->oppmoReviewer->id,
            'twg_approved_at' => now(),
            'budget_approved_at' => now(),
            'ready_to_print_at' => now(),
        ]);

        $dashboardRes = $this->actingAs($this->twg2)->getJson('/api/dashboard');
        $dashboardRes->assertStatus(200);
        $this->assertGreaterThanOrEqual(1, $dashboardRes->json('metrics.ready_to_print'));
        $recentIds = collect($dashboardRes->json('recent_ppmps'))->pluck('id')->all();
        $this->assertContains($this->ppmp->id, $recentIds);

        $listRes = $this->actingAs($this->twg2)->getJson('/api/ppmps');
        $listRes->assertStatus(200);
        $listIds = collect($listRes->json('data'))->pluck('id')->all();
        $this->assertContains($this->ppmp->id, $listIds);

        $detailRes = $this->actingAs($this->twg2)->getJson("/api/ppmps/{$this->ppmp->uuid}");
        $detailRes->assertStatus(200);
        $this->assertEquals('READY_TO_PRINT', $detailRes->json('ppmp.status'));
    }

    public function test_cannot_reassign_reviewers_when_ppmp_is_ready_to_print(): void
    {
        $this->ppmp->update([
            'status' => 'READY_TO_PRINT',
            'twg_reviewer_id' => $this->twg1->id,
            'budget_reviewer_id' => $this->budgetOfficer->id,
            'oppmo_reviewer_id' => $this->oppmoReviewer->id,
            'ready_to_print_at' => now(),
        ]);

        $response = $this->actingAs($this->endUser)->putJson("/api/ppmps/{$this->ppmp->uuid}/reassign-reviewers", [
            'twg_reviewer_id' => $this->twg2->id,
        ]);

        $response->assertStatus(422)
            ->assertJsonPath('message', 'Cannot reassign reviewers. This PPMP has completed all reviews and is Ready to Print.');
    }
}
