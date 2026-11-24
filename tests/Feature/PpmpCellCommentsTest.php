<?php

namespace Tests\Feature;

use App\Models\Office;
use App\Models\Ppmp;
use App\Models\PpmpCellComment;
use App\Models\PpmpItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class PpmpCellCommentsTest extends TestCase
{
    use RefreshDatabase;

    protected User $endUser;
    protected User $budgetUser;
    protected User $oppmoUser;
    protected User $headUser;
    protected Office $office;
    protected Ppmp $ppmp;
    protected PpmpItem $item;

    protected function setUp(): void
    {
        parent::setUp();

        $this->office = Office::firstOrCreate(
            ['code' => 'TEST-OFFICE-CELL'],
            ['name' => 'Cell Comments Office', 'head_user_id' => null]
        );

        $password = Hash::make('password123');

        $this->endUser = User::firstOrCreate(
            ['email' => 'cell_enduser@example.test'],
            ['name' => 'Cell End User', 'password' => $password, 'role' => 'end_user', 'office_id' => $this->office->id, 'is_active' => true]
        );

        $this->headUser = User::firstOrCreate(
            ['email' => 'cell_head@example.test'],
            ['name' => 'Cell Head User', 'password' => $password, 'role' => 'head', 'office_id' => $this->office->id, 'is_active' => true]
        );
        $this->office->update(['head_user_id' => $this->headUser->id]);

        $this->budgetUser = User::firstOrCreate(
            ['email' => 'cell_budget@example.test'],
            ['name' => 'Cell Budget Officer', 'password' => $password, 'role' => 'budget_officer', 'office_id' => $this->office->id, 'is_active' => true]
        );

        $this->oppmoUser = User::firstOrCreate(
            ['email' => 'cell_oppmo@example.test'],
            ['name' => 'Cell OPPMO Officer', 'password' => $password, 'role' => 'oppmo', 'office_id' => $this->office->id, 'is_active' => true]
        );

        $this->ppmp = Ppmp::create([
            'uuid' => (string) Str::uuid(),
            'ppmp_number' => 1,
            'title' => 'Cell Comments Testing PPMP',
            'fiscal_year' => '2026',
            'plan_type' => 'FINAL',
            'status' => 'BUDGET_OFFICER_REVIEW',
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
            'source_of_fund' => 'General Fund',
            'total_budget' => 500000.00,
        ]);

        $this->item = PpmpItem::create([
            'ppmp_id' => $this->ppmp->id,
            'item_no' => 1,
            'description' => 'Dell Workstation',
            'estimated_budget' => 500000.00,
            'quantity_size' => '5 units',
            'procurement_mode' => 'Public Bidding',
            'source_of_fund' => 'General Fund',
        ]);
    }

    public function test_reviewer_can_add_cell_comment(): void
    {
        $response = $this->actingAs($this->budgetUser)->postJson("/api/ppmps/{$this->ppmp->uuid}/cell-comments", [
            'item_id' => $this->item->id,
            'item_no' => 1,
            'field_key' => 'estimated_budget',
            'field_label' => 'Estimated Budget',
            'cell_value' => '₱500,000.00',
            'comment' => 'Please provide detailed cost breakdown for each workstation.',
        ]);

        $response->assertStatus(201)
            ->assertJson([
                'message' => 'Reviewer comment added to cell.',
                'data' => [
                    'field_key' => 'estimated_budget',
                    'field_label' => 'Estimated Budget',
                    'comment' => 'Please provide detailed cost breakdown for each workstation.',
                    'reviewer_name' => 'Cell Budget Officer',
                    'status' => 'pending',
                ],
            ]);

        $this->assertDatabaseHas('ppmp_cell_comments', [
            'ppmp_id' => $this->ppmp->id,
            'item_id' => $this->item->id,
            'field_key' => 'estimated_budget',
            'status' => 'pending',
        ]);
    }

    public function test_cannot_resubmit_while_pending_cell_comments_exist(): void
    {

        PpmpCellComment::create([
            'ppmp_id' => $this->ppmp->id,
            'item_id' => $this->item->id,
            'item_no' => 1,
            'field_key' => 'source_of_fund',
            'field_label' => 'Source of Funds',
            'cell_value' => 'General Fund',
            'comment' => 'Verify if funding is chargeable against 2026 GF or continuing appropriation.',
            'reviewer_id' => $this->budgetUser->id,
            'reviewer_name' => $this->budgetUser->name,
            'reviewer_role' => $this->budgetUser->role,
            'status' => 'pending',
        ]);

        $this->ppmp->update([
            'status' => 'BUDGET_OFFICER_RETURNED',
            'enduser_received_at' => now(),
        ]);

        $resubmitResponse = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$this->ppmp->uuid}/submit-for-review");

        $resubmitResponse->assertStatus(422)
            ->assertJson([
                'pending_comments_count' => 1,
            ]);

        $this->assertStringContainsString('pending reviewer comment', $resubmitResponse->json('message'));
    }

    public function test_end_user_can_comply_and_then_resubmit_to_head(): void
    {

        $comment = PpmpCellComment::create([
            'ppmp_id' => $this->ppmp->id,
            'item_id' => $this->item->id,
            'item_no' => 1,
            'field_key' => 'quantity_size',
            'field_label' => 'Quantity and Size',
            'cell_value' => '5 units',
            'comment' => 'Indicate complete technical specification for RAM and SSD.',
            'reviewer_id' => $this->headUser->id,
            'reviewer_name' => $this->headUser->name,
            'reviewer_role' => $this->headUser->role,
            'status' => 'pending',
        ]);

        $this->ppmp->update([
            'status' => 'HEAD_RETURNED',
            'enduser_received_at' => now(),
        ]);

        $blockedRes = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$this->ppmp->uuid}/submit-to-head");
        $blockedRes->assertStatus(422);

        $complyRes = $this->actingAs($this->endUser)->patchJson("/api/ppmps/{$this->ppmp->uuid}/cell-comments/{$comment->id}/comply", [
            'compliance_note' => 'Updated item description to specify 32GB RAM and 1TB NVMe SSD.',
        ]);

        $complyRes->assertStatus(200)
            ->assertJson([
                'message' => 'Comment marked as complied.',
                'data' => [
                    'id' => $comment->id,
                    'status' => 'complied',
                    'compliance_note' => 'Updated item description to specify 32GB RAM and 1TB NVMe SSD.',
                    'complied_by' => $this->endUser->id,
                ],
            ]);

        $this->assertDatabaseHas('ppmp_cell_comments', [
            'id' => $comment->id,
            'status' => 'complied',
        ]);

        $resubmitResponse = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$this->ppmp->uuid}/submit-to-head");
        $resubmitResponse->assertStatus(200);

        $this->ppmp->refresh();
        $this->assertEquals('HEAD_PENDING', $this->ppmp->status);
    }

    public function test_end_user_cannot_delete_reviewer_comment(): void
    {
        $comment = PpmpCellComment::create([
            'ppmp_id' => $this->ppmp->id,
            'item_id' => $this->item->id,
            'item_no' => 1,
            'field_key' => 'delivery_period',
            'field_label' => 'Expected Delivery Period',
            'cell_value' => '15 days',
            'comment' => 'Lead time for specialized servers requires 45 calendar days.',
            'reviewer_id' => $this->budgetUser->id,
            'reviewer_name' => $this->budgetUser->name,
            'reviewer_role' => $this->budgetUser->role,
            'status' => 'pending',
        ]);

        $deleteResponse = $this->actingAs($this->endUser)->deleteJson("/api/ppmps/{$this->ppmp->uuid}/cell-comments/{$comment->id}");
        $deleteResponse->assertStatus(403);

        $this->assertDatabaseHas('ppmp_cell_comments', ['id' => $comment->id]);
    }

    public function test_end_user_cannot_view_reviewer_comments_until_suspended(): void
    {

        $comment = PpmpCellComment::create([
            'ppmp_id' => $this->ppmp->id,
            'item_id' => $this->item->id,
            'item_no' => 1,
            'field_key' => 'estimated_budget',
            'field_label' => 'Estimated Budget',
            'cell_value' => '₱500,000.00',
            'comment' => 'Reviewer draft note before suspension',
            'reviewer_id' => $this->budgetUser->id,
            'reviewer_name' => $this->budgetUser->name,
            'reviewer_role' => $this->budgetUser->role,
            'status' => 'pending',
        ]);

        $reviewerRes = $this->actingAs($this->budgetUser)->getJson("/api/ppmps/{$this->ppmp->uuid}/cell-comments");
        $reviewerRes->assertStatus(200);
        $this->assertCount(1, $reviewerRes->json('data'));

        $endUserResBeforeSuspend = $this->actingAs($this->endUser)->getJson("/api/ppmps/{$this->ppmp->uuid}/cell-comments");
        $endUserResBeforeSuspend->assertStatus(200);
        $this->assertCount(0, $endUserResBeforeSuspend->json('data'));

        $endUserShowRes = $this->actingAs($this->endUser)->getJson("/api/ppmps/{$this->ppmp->uuid}");
        $endUserShowRes->assertStatus(200);
        $this->assertEmpty($endUserShowRes->json('ppmp.cell_comments'));

        $this->ppmp->update([
            'status' => 'BUDGET_OFFICER_RETURNED',
            'enduser_received_at' => now(),
        ]);

        $endUserResAfterSuspend = $this->actingAs($this->endUser)->getJson("/api/ppmps/{$this->ppmp->uuid}/cell-comments");
        $endUserResAfterSuspend->assertStatus(200);
        $this->assertCount(1, $endUserResAfterSuspend->json('data'));
        $this->assertEquals('Reviewer draft note before suspension', $endUserResAfterSuspend->json('data.0.comment'));
    }

    public function test_cell_comments_persist_and_relink_when_end_user_updates_items(): void
    {

        $itemComment = PpmpCellComment::create([
            'ppmp_id' => $this->ppmp->id,
            'item_id' => $this->item->id,
            'item_no' => 1,
            'field_key' => 'estimated_budget',
            'field_label' => 'Estimated Budget',
            'cell_value' => '₱500,000.00',
            'comment' => 'Cost exceeds benchmark',
            'reviewer_id' => $this->budgetUser->id,
            'reviewer_name' => $this->budgetUser->name,
            'reviewer_role' => $this->budgetUser->role,
            'status' => 'pending',
        ]);

        $categoryComment = PpmpCellComment::create([
            'ppmp_id' => $this->ppmp->id,
            'item_id' => null,
            'item_no' => null,
            'field_key' => 'program_name',
            'field_label' => 'Category / Program Name & Account Code',
            'cell_value' => 'Support to LFC',
            'comment' => 'Update code',
            'reviewer_id' => $this->budgetUser->id,
            'reviewer_name' => $this->budgetUser->name,
            'reviewer_role' => $this->budgetUser->role,
            'status' => 'pending',
        ]);

        $this->ppmp->update([
            'status' => 'BUDGET_OFFICER_RETURNED',
            'enduser_received_at' => now(),
        ]);

        $updateRes = $this->actingAs($this->endUser)->putJson("/api/ppmps/{$this->ppmp->uuid}", [
            'title' => $this->ppmp->title,
            'fiscal_year' => $this->ppmp->fiscal_year,
            'plan_type' => $this->ppmp->plan_type,
            'source_of_fund' => 'General Fund',
            'items' => [
                [
                    'description' => 'Dell Workstation Updated',
                    'project_type' => 'Goods',
                    'quantity_size' => '5 units',
                    'procurement_mode' => 'Public Bidding',
                    'estimated_budget' => 450000.00,
                    'source_of_fund' => 'General Fund',
                ]
            ]
        ]);

        $updateRes->assertStatus(200);

        $this->assertDatabaseHas('ppmp_cell_comments', ['id' => $itemComment->id]);
        $this->assertDatabaseHas('ppmp_cell_comments', ['id' => $categoryComment->id]);

        $newItem = $this->ppmp->fresh()->items()->first();
        $this->assertNotNull($newItem);

        $itemComment->refresh();
        $this->assertEquals($newItem->id, $itemComment->item_id);
        $this->assertEquals(1, $itemComment->item_no);
    }

    public function test_end_user_can_view_complied_comments_after_submitting_to_reviewer(): void
    {

        $comment = PpmpCellComment::create([
            'ppmp_id' => $this->ppmp->id,
            'item_id' => $this->item->id,
            'item_no' => 1,
            'field_key' => 'estimated_budget',
            'field_label' => 'Estimated Budget',
            'cell_value' => '₱500,000.00',
            'comment' => 'Please explain budget escalation.',
            'reviewer_id' => $this->budgetUser->id,
            'reviewer_name' => $this->budgetUser->name,
            'reviewer_role' => $this->budgetUser->role,
            'status' => 'pending',
        ]);

        $this->ppmp->update([
            'status' => 'BUDGET_OFFICER_RETURNED',
            'enduser_received_at' => now(),
        ]);

        $this->actingAs($this->endUser)->patchJson("/api/ppmps/{$this->ppmp->uuid}/cell-comments/{$comment->id}/comply", [
            'compliance_note' => 'Attached updated cost-benefit matrix.',
        ])->assertStatus(200);

        $this->ppmp->update([
            'status' => 'BUDGET_OFFICER_REVIEW',
        ]);

        $cellCommentsRes = $this->actingAs($this->endUser)->getJson("/api/ppmps/{$this->ppmp->uuid}/cell-comments");
        $cellCommentsRes->assertStatus(200);
        $this->assertCount(1, $cellCommentsRes->json('data'));
        $this->assertEquals('complied', $cellCommentsRes->json('data.0.status'));
        $this->assertEquals('Attached updated cost-benefit matrix.', $cellCommentsRes->json('data.0.compliance_note'));
        $this->assertEquals(0, $cellCommentsRes->json('pending_count'));
        $this->assertEquals(1, $cellCommentsRes->json('complied_count'));

        $showRes = $this->actingAs($this->endUser)->getJson("/api/ppmps/{$this->ppmp->uuid}");
        $showRes->assertStatus(200);
        $this->assertCount(1, $showRes->json('ppmp.cell_comments'));
        $this->assertEquals('complied', $showRes->json('ppmp.cell_comments.0.status'));

        $draftComment = PpmpCellComment::create([
            'ppmp_id' => $this->ppmp->id,
            'item_id' => null,
            'item_no' => null,
            'field_key' => 'program_name',
            'field_label' => 'Category',
            'cell_value' => 'Support',
            'comment' => 'Draft reviewer note not yet suspended',
            'reviewer_id' => $this->budgetUser->id,
            'reviewer_name' => $this->budgetUser->name,
            'reviewer_role' => $this->budgetUser->role,
            'status' => 'pending',
        ]);

        $cellCommentsRes2 = $this->actingAs($this->endUser)->getJson("/api/ppmps/{$this->ppmp->uuid}/cell-comments");
        $cellCommentsRes2->assertStatus(200);

        $this->assertCount(1, $cellCommentsRes2->json('data'));
        $this->assertEquals('complied', $cellCommentsRes2->json('data.0.status'));

        $reviewerRes = $this->actingAs($this->budgetUser)->getJson("/api/ppmps/{$this->ppmp->uuid}/cell-comments");
        $reviewerRes->assertStatus(200);
        $this->assertCount(2, $reviewerRes->json('data'));
    }

    public function test_reviewer_can_comment_on_ppmp_header_fields(): void
    {
        $headerFields = [
            ['field_key' => 'ppmp_number', 'field_label' => 'PPMP No.', 'cell_value' => '1', 'comment' => 'Please adjust PPMP sequence number.'],
            ['field_key' => 'fiscal_year', 'field_label' => 'Fiscal Year', 'cell_value' => 'CY 2026', 'comment' => 'Please confirm calendar/fiscal year alignment.'],
            ['field_key' => 'plan_type', 'field_label' => 'Plan Type (INDICATIVE / FINAL)', 'cell_value' => 'FINAL', 'comment' => 'Must be marked INDICATIVE for initial submission.'],
            ['field_key' => 'title', 'field_label' => 'Project Title', 'cell_value' => $this->ppmp->title, 'comment' => 'Project title must specify exact hospital unit.'],
            ['field_key' => 'implementing_unit', 'field_label' => 'End-User or Implementing Unit', 'cell_value' => 'Cell Comments Office', 'comment' => 'Provide complete formal office division name.'],
        ];

        foreach ($headerFields as $field) {
            $res = $this->actingAs($this->budgetUser)->postJson("/api/ppmps/{$this->ppmp->uuid}/cell-comments", [
                'item_id' => null,
                'item_no' => null,
                'field_key' => $field['field_key'],
                'field_label' => $field['field_label'],
                'cell_value' => $field['cell_value'],
                'comment' => $field['comment'],
            ]);

            $res->assertStatus(201);
            $this->assertEquals($field['field_key'], $res->json('data.field_key'));
            $this->assertEquals('pending', $res->json('data.status'));
        }

        $this->actingAs($this->budgetUser)->postJson("/api/ppmps/{$this->ppmp->uuid}/budget/return", [
            'remarks' => 'Review header fields and comply with remarks.',
        ])->assertOk();

        $comments = PpmpCellComment::where('ppmp_id', $this->ppmp->id)->whereNull('item_id')->get();
        $this->assertCount(5, $comments);

        foreach ($comments as $comment) {
            $this->actingAs($this->endUser)
                ->patchJson("/api/ppmps/{$this->ppmp->uuid}/cell-comments/{$comment->id}/comply", [
                    'compliance_note' => 'Header detail updated as requested.',
                ])
                ->assertOk();
        }

        $this->assertEquals(5, PpmpCellComment::where('ppmp_id', $this->ppmp->id)->where('status', 'complied')->count());
        $this->assertEquals(0, PpmpCellComment::where('ppmp_id', $this->ppmp->id)->where('status', 'pending')->count());
    }

    public function test_reviewer_can_comment_on_ppmp_attachment_list_fields_and_header(): void
    {

        $attachmentFields = [
            ['field_key' => 'att_fiscal_year', 'field_label' => 'Attachment List #1 • Fiscal Year', 'cell_value' => 'CY 2026', 'comment' => 'Please confirm calendar year matching.'],
            ['field_key' => 'att_office_name', 'field_label' => 'Attachment List #1 • End-User / Implementing Unit', 'cell_value' => 'Cell Comments Office', 'comment' => 'Specify exact division office.'],
            ['field_key' => 'att_project_title', 'field_label' => 'Attachment List #1 • Program / Project Title', 'cell_value' => $this->ppmp->title, 'comment' => 'Clarify project title specification.'],
            ['field_key' => 'att_charges', 'field_label' => 'Attachment List #1 • Charges', 'cell_value' => '5-02-02-100 / General Fund', 'comment' => 'Please verify charges account code.'],
            ['field_key' => 'att_r1_unit', 'field_label' => 'Attachment List #1 • Row #1 Unit', 'cell_value' => 'pcs', 'comment' => 'Change unit from pcs to box.'],
            ['field_key' => 'att_r1_description', 'field_label' => 'Attachment List #1 • Row #1 Description', 'cell_value' => 'Dell Workstation', 'comment' => 'Add detailed technical specifications.'],
            ['field_key' => 'att_r1_qty', 'field_label' => 'Attachment List #1 • Row #1 Quantity', 'cell_value' => '5', 'comment' => 'Verify quantity requirement.'],
            ['field_key' => 'att_r1_unit_cost', 'field_label' => 'Attachment List #1 • Row #1 Unit Cost', 'cell_value' => '₱100,000.00', 'comment' => 'Unit cost must match market canvass.'],
            ['field_key' => 'att_other_terms', 'field_label' => 'Attachment List #1 • Other Terms & Delivery Info', 'cell_value' => '30 Calendar Days', 'comment' => 'Include warranty clause.'],
            ['field_key' => 'att_total_budget', 'field_label' => 'Attachment List #1 • Total Estimated Budget', 'cell_value' => '₱500,000.00', 'comment' => 'Confirm ABC matches procurement plan total.'],
        ];

        foreach ($attachmentFields as $field) {
            $res = $this->actingAs($this->budgetUser)->postJson("/api/ppmps/{$this->ppmp->uuid}/cell-comments", [
                'item_id' => $this->item->id,
                'item_no' => 1,
                'field_key' => $field['field_key'],
                'field_label' => $field['field_label'],
                'cell_value' => $field['cell_value'],
                'comment' => $field['comment'],
            ]);

            $res->assertStatus(201);
            $this->assertEquals($field['field_key'], $res->json('data.field_key'));
            $this->assertEquals('pending', $res->json('data.status'));
        }

        $this->actingAs($this->budgetUser)->postJson("/api/ppmps/{$this->ppmp->uuid}/budget/return", [
            'remarks' => 'Review attachment list findings and comply before resubmission.',
        ])->assertOk();

        $comments = PpmpCellComment::where('ppmp_id', $this->ppmp->id)->where('field_key', 'like', 'att_%')->get();
        $this->assertCount(10, $comments);

        foreach ($comments as $comment) {
            $this->actingAs($this->endUser)
                ->patchJson("/api/ppmps/{$this->ppmp->uuid}/cell-comments/{$comment->id}/comply", [
                    'compliance_note' => 'Attachment list updated and complied as instructed.',
                ])
                ->assertOk();
        }

        $this->assertEquals(10, PpmpCellComment::where('ppmp_id', $this->ppmp->id)->where('field_key', 'like', 'att_%')->where('status', 'complied')->count());
        $this->assertEquals(0, PpmpCellComment::where('ppmp_id', $this->ppmp->id)->where('status', 'pending')->count());
    }

    public function test_comply_updates_cell_value_and_writes_to_ppmp_change_logs(): void
    {

        $this->item->update(['procurement_mode' => 'Small Value Procurement (RA 12009)']);

        $commentRes = $this->actingAs($this->budgetUser)->postJson("/api/ppmps/{$this->ppmp->uuid}/cell-comments", [
            'item_id' => $this->item->id,
            'item_no' => 1,
            'field_key' => 'procurement_mode',
            'field_label' => 'Recommended Mode of Procurement',
            'cell_value' => 'Small Value Procurement (RA 12009)',
            'comment' => 'chamhe to cb',
        ]);
        $commentRes->assertStatus(201);
        $commentId = $commentRes->json('data.id');

        $this->actingAs($this->budgetUser)->postJson("/api/ppmps/{$this->ppmp->uuid}/budget/return", [
            'remarks' => 'Review and comply with procurement mode finding.',
        ])->assertOk();

        $complyRes = $this->actingAs($this->endUser)
            ->patchJson("/api/ppmps/{$this->ppmp->uuid}/cell-comments/{$commentId}/comply", [
                'compliance_note' => 'Complied and updated cell value to: "Competitive Bidding (RA 12009)"',
                'updated_cell_value' => 'Competitive Bidding (RA 12009)',
            ]);

        $complyRes->assertOk();
        $this->assertEquals('complied', $complyRes->json('data.status'));

        $this->assertEquals('Competitive Bidding (RA 12009)', $this->item->fresh()->procurement_mode);

        $this->assertDatabaseHas('ppmp_change_logs', [
            'ppmp_id' => $this->ppmp->id,
            'user_id' => $this->endUser->id,
            'field_name' => 'Item #1 Recommended Mode of Procurement',
            'old_value' => 'Small Value Procurement (RA 12009)',
            'new_value' => 'Competitive Bidding (RA 12009)',
            'action' => 'end_user_edit',
        ]);

        $updateCellRes = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$this->ppmp->uuid}/update-cell", [
            'field_key' => 'category',
            'field_label' => 'Category / Program Name & Account Code',
            'value' => 'Support to LFC ghfghhdfhd • Representation 5-02-99-010',
        ]);

        $updateCellRes->assertOk();
        $freshPpmp = $this->ppmp->fresh();
        $this->assertEquals('Support to LFC ghfghhdfhd', $freshPpmp->program_name);
        $this->assertEquals('Representation 5-02-99-010', $freshPpmp->account_code);

        $this->assertDatabaseHas('ppmp_change_logs', [
            'ppmp_id' => $this->ppmp->id,
            'user_id' => $this->endUser->id,
            'field_name' => 'Category / Program Name & Account Code',
            'action' => 'end_user_edit',
        ]);

        $updateCellProgRes = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$this->ppmp->uuid}/update-cell", [
            'field_key' => 'program_name',
            'field_label' => 'Category / Program Name & Account Code',
            'value' => 'SUPPORT TO PLECS • Representation Expenses 5-02-99-030',
        ]);

        $updateCellProgRes->assertOk();
        $freshPpmp2 = $this->ppmp->fresh();
        $this->assertEquals('SUPPORT TO PLECS', $freshPpmp2->program_name);
        $this->assertEquals('Representation Expenses 5-02-99-030', $freshPpmp2->account_code);
    }

    public function test_comply_updates_combined_other_terms_and_delivery_info(): void
    {
        $this->ppmp->update(['status' => 'BUDGET_OFFICER_RETURNED']);

        $updateRes = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$this->ppmp->uuid}/update-cell", [
            'field_key' => 'att_other_terms',
            'field_label' => 'Attachment List #1 • Other Terms & Delivery Info',
            'item_id' => $this->item->id,
            'item_no' => 1,
            'value' => json_encode([
                'other_terms' => "Green Specs:\n- use of waxed carton instead of Styrofoam",
                'place_of_delivery' => 'PGSO Warehouse/On-site',
                'payment_method' => 'Staggered Delivery/Credit-basis',
                'delivery_period' => 'As Per Demand by the End-User',
            ]),
        ]);

        $updateRes->assertOk();
        $freshPpmp = $this->ppmp->fresh();
        $this->assertEquals('PGSO Warehouse/On-site', $freshPpmp->place_of_delivery);
        $this->assertEquals('Staggered Delivery/Credit-basis', $freshPpmp->payment_method);
        $this->assertEquals('As Per Demand by the End-User', $freshPpmp->delivery_period);
        $this->assertStringContainsString('Green Specs', $freshPpmp->warranty_and_other_terms);

        $attData = $freshPpmp->attachment_list_data;
        $this->assertEquals('PGSO Warehouse/On-site', $attData['place_of_delivery']);
        $this->assertEquals('Staggered Delivery/Credit-basis', $attData['payment_method']);
        $this->assertEquals('As Per Demand by the End-User', $attData['delivery_period']);
        $this->assertStringContainsString('Green Specs', $attData['other_terms']);

        $this->assertDatabaseHas('ppmp_change_logs', [
            'ppmp_id' => $this->ppmp->id,
            'user_id' => $this->endUser->id,
            'field_name' => 'Attachment List #1 • Place of Delivery',
        ]);
        $this->assertDatabaseHas('ppmp_change_logs', [
            'ppmp_id' => $this->ppmp->id,
            'user_id' => $this->endUser->id,
            'field_name' => 'Attachment List #1 • Payment Method',
        ]);
        $this->assertDatabaseHas('ppmp_change_logs', [
            'ppmp_id' => $this->ppmp->id,
            'user_id' => $this->endUser->id,
            'field_name' => 'Attachment List #1 • Delivery Period',
        ]);
    }
}
