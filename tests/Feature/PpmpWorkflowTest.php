<?php

namespace Tests\Feature;

use App\Models\Office;
use App\Models\Ppmp;
use App\Models\PpmpItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class PpmpWorkflowTest extends TestCase
{
    use RefreshDatabase;

    protected User $endUser;
    protected User $headUser;
    protected User $budgetUser;
    protected User $oppmoUser;
    protected User $twgUser;
    protected Office $office;

    protected function setUp(): void
    {
        parent::setUp();

        // Prepare test environment
        $this->office = Office::firstOrCreate(
            ['code' => 'TEST-OFFICE'],
            ['name' => 'Testing Office', 'head_user_id' => null]
        );

        $password = Hash::make('password123');

        $this->endUser = User::firstOrCreate(
            ['email' => 'test_enduser@example.test'],
            ['name' => 'Test End User', 'password' => $password, 'role' => 'end_user', 'office_id' => $this->office->id, 'is_active' => true]
        );

        $this->headUser = User::firstOrCreate(
            ['email' => 'test_head@example.test'],
            ['name' => 'Test Head', 'password' => $password, 'role' => 'head', 'office_id' => $this->office->id, 'is_active' => true]
        );

        $this->office->update(['head_user_id' => $this->headUser->id]);

        $this->budgetUser = User::firstOrCreate(
            ['email' => 'test_budget@example.test'],
            ['name' => 'Test Budget Officer', 'password' => $password, 'role' => 'budget_officer', 'office_id' => $this->office->id, 'is_active' => true]
        );

        $this->oppmoUser = User::firstOrCreate(
            ['email' => 'test_oppmo@example.test'],
            ['name' => 'Test OPPMO User', 'password' => $password, 'role' => 'oppmo', 'office_id' => $this->office->id, 'is_active' => true]
        );

        $this->twgUser = User::firstOrCreate(
            ['email' => 'test_twg@example.test'],
            ['name' => 'Test TWG User', 'password' => $password, 'role' => 'twg', 'office_id' => $this->office->id, 'is_active' => true]
        );
    }

    /**
     * Test full normal happy path workflow
     * DRAFT -> (Pre-submission checks: APP, Attachment List, Market Scoping PDF) -> BUDGET -> OPPMO -> TWG -> HEAD -> READY_TO_PRINT
     */
    public function test_complete_ppmp_workflow_and_signatures(): void
    {
        // 1. End User creates PPMP Draft
        $createRes = $this->actingAs($this->endUser)->postJson('/api/ppmps', [
            'title' => 'Automated Workflow Testing PPMP',
            'fiscal_year' => '2026',
            'plan_type' => 'FINAL',
            'items' => [
                [
                    'description' => 'Workflow Verification Workstation',
                    'project_type' => 'Goods',
                    'quantity_size' => '2 units',
                    'procurement_mode' => 'Public Bidding',
                    'estimated_budget' => 250000.00,
                    'source_of_fund' => 'General Fund',
                ]
            ]
        ]);

        $createRes->assertStatus(201);
        $ppmpUuid = $createRes->json('ppmp.uuid');
        $this->assertEquals('DRAFT', $createRes->json('ppmp.status'));
        $this->assertEquals('TEST-OFFICEGOODS-2026-000001', $createRes->json('ppmp.tracking_number'));

        // Verify End user e-signature exists
        $ppmp = Ppmp::where('uuid', $ppmpUuid)->first();
        $this->assertTrue($ppmp->signatures()->where('role', 'end_user')->exists());

        // 2. Attempting to submit for review before requirements must fail with 422
        $prematureRes = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$ppmpUuid}/submit-for-review");
        $prematureRes->assertStatus(422)
            ->assertJsonPath('checks.is_ready', false)
            ->assertJsonPath('checks.attachment_list_generated', false)
            ->assertJsonPath('checks.market_scoping_attached', false);

        // 3. End User uploads Market Scoping PDF
        Storage::fake('local');
        $pdfContent = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\nxref\n0 2\ntrailer<</Size 2/Root 1 0 R>>\nstartxref\n50\n%%EOF";
        $fakePdf = UploadedFile::fake()->createWithContent('market_scoping_assessment.pdf', $pdfContent);

        $uploadRes = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$ppmpUuid}/attachments", [
            'file' => $fakePdf,
            'attachment_type' => 'MARKET_SCOPING',
        ]);
        $uploadRes->assertStatus(201);
        $attachmentUuid = $uploadRes->json('attachment.uuid');

        // Verify attachment can be downloaded securely
        $downloadRes = $this->actingAs($this->endUser)->get("/api/ppmps/{$ppmpUuid}/attachments/{$attachmentUuid}/download");
        $downloadRes->assertStatus(200);

        // 4. End user attempting to save APP Data is rejected with 403 (only OPPMO after TWG can generate APP)
        $unauthAppRes = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$ppmpUuid}/app-data", [
            'prepared_by_name' => 'NORJANNA M. CAMAGUIN, MPA',
            'rows' => [
                [
                    'code' => 'APP-001',
                    'procurement_program' => 'Workstation Procurement',
                    'pmo_end_user' => 'TEST-OFFICE',
                    'total' => 250000.00,
                ]
            ]
        ]);
        $unauthAppRes->assertStatus(403);

        // End User generates PPMP List of Attachment Data
        $attListSaveRes = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$ppmpUuid}/attachment-list", [
            'prepared_by_name' => 'Test End User',
            'rows' => [
                [
                    'item_no' => 1,
                    'description' => 'Workstation Unit',
                    'unit' => 'unit',
                    'qty' => 2,
                    'unit_price' => 125000.00,
                    'total_amount' => 250000.00,
                ]
            ]
        ]);
        $attListSaveRes->assertStatus(200);

        // 5. Submit for formal review: General Fund routes directly to Provincial Budget Officer
        $submitReviewRes = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$ppmpUuid}/submit-for-review");
        $submitReviewRes->assertStatus(200);
        $this->assertEquals('BUDGET_OFFICER_REVIEW', $submitReviewRes->json('ppmp.status'));

        // 6. Budget Officer receives before approving
        $this->actingAs($this->budgetUser)->postJson("/api/ppmps/{$ppmpUuid}/receive")->assertStatus(200);

        // Budget Officer Approves -> routes to OPPMO_REVIEW
        $budgetApproveRes = $this->actingAs($this->budgetUser)->postJson("/api/ppmps/{$ppmpUuid}/budget/approve");
        $budgetApproveRes->assertStatus(200);
        $this->assertEquals('OPPMO_REVIEW', $budgetApproveRes->json('ppmp.status'));
        $this->assertTrue($ppmp->fresh()->signatures()->where('role', 'budget_officer')->exists());

        // 7. OPPMO receives before approving
        $this->actingAs($this->oppmoUser)->postJson("/api/ppmps/{$ppmpUuid}/receive")->assertStatus(200);

        // OPPMO Approves -> routes to TWG_REVIEW
        $oppmoApproveRes = $this->actingAs($this->oppmoUser)->postJson("/api/ppmps/{$ppmpUuid}/oppmo/approve");
        $oppmoApproveRes->assertStatus(200);
        $this->assertEquals('TWG_REVIEW', $oppmoApproveRes->json('ppmp.status'));
        $this->assertTrue($ppmp->fresh()->signatures()->where('role', 'oppmo')->exists());

        // 8. TWG receives before approving
        $this->actingAs($this->twgUser)->postJson("/api/ppmps/{$ppmpUuid}/receive")->assertStatus(200);

        // TWG Approves -> routes back to OPPMO for APP generation (OPPMO_REVIEW)
        $twgApproveRes = $this->actingAs($this->twgUser)->postJson("/api/ppmps/{$ppmpUuid}/twg/approve");
        $twgApproveRes->assertStatus(200);
        $this->assertEquals('OPPMO_REVIEW', $twgApproveRes->json('ppmp.status'));
        $this->assertTrue($ppmp->fresh()->signatures()->where('role', 'twg')->exists());

        // TWG can view PPMP in show and index after approving (when status is OPPMO_REVIEW)
        $twgShowRes = $this->actingAs($this->twgUser)->getJson("/api/ppmps/{$ppmpUuid}");
        $twgShowRes->assertStatus(200);
        $this->assertEquals('OPPMO_REVIEW', $twgShowRes->json('ppmp.status'));

        $twgIndexRes = $this->actingAs($this->twgUser)->getJson("/api/ppmps");
        $twgIndexRes->assertStatus(200);
        $indexUuids = array_column($twgIndexRes->json('data'), 'uuid');
        $this->assertContains($ppmpUuid, $indexUuids);

        // 9. OPPMO receives document in post-TWG review
        $this->actingAs($this->oppmoUser)->postJson("/api/ppmps/{$ppmpUuid}/receive")->assertStatus(200);

        // Attempting to approve without generating APP must fail with 422
        $prematureOppmoRes = $this->actingAs($this->oppmoUser)->postJson("/api/ppmps/{$ppmpUuid}/oppmo/approve");
        $prematureOppmoRes->assertStatus(422)
            ->assertJsonPath('message', 'Please generate the Annual Procurement Plan (APP) before forwarding to the Office Head.');

        // OPPMO generates/saves APP Data
        $appSaveRes = $this->actingAs($this->oppmoUser)->postJson("/api/ppmps/{$ppmpUuid}/app-data", [
            'prepared_by_name' => 'NORJANNA M. CAMAGUIN, MPA',
            'rows' => [
                [
                    'code' => 'APP-001',
                    'procurement_program' => 'Workstation Procurement',
                    'pmo_end_user' => 'TEST-OFFICE',
                    'total' => 250000.00,
                ]
            ]
        ]);
        $appSaveRes->assertStatus(200);

        // OPPMO Approves -> routes to Office Head for approval (HEAD_PENDING)
        $oppmoFinalApproveRes = $this->actingAs($this->oppmoUser)->postJson("/api/ppmps/{$ppmpUuid}/oppmo/approve");
        $oppmoFinalApproveRes->assertStatus(200);
        $this->assertEquals('HEAD_PENDING', $oppmoFinalApproveRes->json('ppmp.status'));

        // 10. Office Head receives before approving
        $this->actingAs($this->headUser)->postJson("/api/ppmps/{$ppmpUuid}/receive")->assertStatus(200);

        // Office Head Approves -> marks READY_TO_PRINT
        $headApproveRes = $this->actingAs($this->headUser)->postJson("/api/ppmps/{$ppmpUuid}/head/approve");
        $headApproveRes->assertStatus(200);
        $this->assertEquals('READY_TO_PRINT', $headApproveRes->json('ppmp.status'));
        $this->assertTrue($ppmp->fresh()->signatures()->where('role', 'head')->exists());

        // Verify all 5 required approval signatures exist
        $freshPpmp = $ppmp->fresh(['signatures', 'routes']);
        $this->assertEquals(5, $freshPpmp->signatures()->count()); // end_user + budget + oppmo + twg + head
        $this->assertTrue($freshPpmp->routes()->where('status', 'READY_TO_PRINT')->exists());
    }

    /**
     * Test Reviewer UPDATE / REMARKS return loop with mandatory remarks
     */
    public function test_reviewer_return_requires_remarks_and_allows_correction(): void
    {
        $ppmp = Ppmp::create([
            'uuid' => (string) Str::uuid(),
            'ppmp_number' => 'PPMP-2026-TEST02',
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
            'title' => 'Correction Loop Test',
            'fiscal_year' => '2026',
            'status' => 'BUDGET_OFFICER_REVIEW',
            'total_budget' => 100000.00,
            'app_data' => ['is_generated' => true, 'saved_at' => now()->toIso8601String()],
            'attachment_list_data' => ['is_generated' => true, 'saved_at' => now()->toIso8601String()],
        ]);

        $ppmp->attachments()->create([
            'uuid' => (string) Str::uuid(),
            'original_filename' => 'market_scoping.pdf',
            'stored_filename' => 'market_scoping.pdf',
            'storage_path' => 'attachments/test_market_scoping.pdf',
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
            'attachment_type' => 'MARKET_SCOPING',
            'uploaded_by' => $this->endUser->id,
        ]);

        $item = PpmpItem::create([
            'ppmp_id' => $ppmp->id,
            'item_no' => 1,
            'description' => 'Test Item',
            'estimated_budget' => 100000.00,
        ]);

        // Receive document first
        $this->actingAs($this->budgetUser)->postJson("/api/ppmps/{$ppmp->uuid}/receive")->assertStatus(200);

        // Attempt return without remarks (Must fail validation)
        $failRes = $this->actingAs($this->budgetUser)->postJson("/api/ppmps/{$ppmp->uuid}/budget/return", [
            'remarks' => '',
        ]);
        $failRes->assertStatus(422);

        // Submit valid return with remarks and field correction
        $returnRes = $this->actingAs($this->budgetUser)->postJson("/api/ppmps/{$ppmp->uuid}/budget/return", [
            'remarks' => 'Please lower the ABC in Item 1 to 90,000.',
            'field_changes' => [
                [
                    'item_id' => $item->id,
                    'field_name' => 'estimated_budget',
                    'old_value' => '100000.00',
                    'new_value' => '90000.00',
                ]
            ]
        ]);

        $returnRes->assertStatus(200);
        $this->assertEquals('BUDGET_OFFICER_RETURNED', $returnRes->json('ppmp.status'));

        // Verify change log and updated total
        $this->assertTrue($ppmp->changeLogs()->where('field_name', 'estimated_budget')->exists());
        $this->assertEquals(90000.00, (float)$ppmp->fresh()->total_budget);

        // End user corrects and resubmits for review
        $resubmitRes = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$ppmp->uuid}/submit-for-review");
        $resubmitRes->assertStatus(200);
        $this->assertEquals('BUDGET_OFFICER_REVIEW', $resubmitRes->json('ppmp.status'));
    }

    /**
     * Test unauthorized role access is forbidden
     */
    public function test_unauthorized_role_access_is_forbidden(): void
    {
        $ppmp = Ppmp::create([
            'uuid' => (string) Str::uuid(),
            'ppmp_number' => 'PPMP-2026-TEST03',
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
            'title' => 'Security Forbidden Check',
            'fiscal_year' => '2026',
            'status' => 'HEAD_PENDING',
            'total_budget' => 50000.00,
        ]);

        // End user tries to approve own PPMP as head -> HTTP 403
        $unauthRes = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$ppmp->uuid}/head/approve");
        $unauthRes->assertStatus(403);

        // Budget officer tries to approve TWG endpoint -> HTTP 403
        $unauthRes2 = $this->actingAs($this->budgetUser)->postJson("/api/ppmps/{$ppmp->uuid}/twg/approve");
        $unauthRes2->assertStatus(403);
    }

    /**
     * Test explicit receive endpoint for Head, Reviewers, and End User
     */
    public function test_explicit_receive_document_endpoint(): void
    {
        $ppmp = Ppmp::create([
            'uuid' => (string) Str::uuid(),
            'ppmp_number' => 'PPMP-2026-RECEIVE-01',
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
            'title' => 'Receive Tracking Test',
            'fiscal_year' => '2026',
            'status' => 'DRAFT',
            'total_budget' => 60000.00,
            'app_data' => ['is_generated' => true, 'saved_at' => now()->toIso8601String()],
            'attachment_list_data' => ['is_generated' => true, 'saved_at' => now()->toIso8601String()],
        ]);

        $ppmp->attachments()->create([
            'uuid' => (string) Str::uuid(),
            'original_filename' => 'market_scoping.pdf',
            'stored_filename' => 'market_scoping.pdf',
            'storage_path' => 'attachments/test_market_scoping.pdf',
            'file_size' => 1024,
            'mime_type' => 'application/pdf',
            'attachment_type' => 'MARKET_SCOPING',
            'uploaded_by' => $this->endUser->id,
        ]);

        // 1. End user submits for review (General Fund routes to Budget Officer)
        $this->actingAs($this->endUser)->postJson("/api/ppmps/{$ppmp->uuid}/submit-for-review")->assertStatus(200);
        $this->assertEquals('BUDGET_OFFICER_REVIEW', $ppmp->fresh()->status);
        $this->assertNull($ppmp->fresh()->budget_received_at);

        // 2. Budget Officer receives document
        $budgetReceiveRes = $this->actingAs($this->budgetUser)->postJson("/api/ppmps/{$ppmp->uuid}/receive");
        $budgetReceiveRes->assertStatus(200);
        $this->assertNotNull($ppmp->fresh()->budget_received_at);

        // Budget Officer returns document with remarks
        $this->actingAs($this->budgetUser)->postJson("/api/ppmps/{$ppmp->uuid}/budget/return", [
            'remarks' => 'Please revise item quantity and fund source.',
        ])->assertStatus(200);

        $this->assertEquals('BUDGET_OFFICER_RETURNED', $ppmp->fresh()->status);
        $this->assertNull($ppmp->fresh()->enduser_received_at);

        // 3. End user receives returned document
        $endUserReceiveRes = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$ppmp->uuid}/receive");
        $endUserReceiveRes->assertStatus(200);
        $this->assertNotNull($ppmp->fresh()->enduser_received_at);
    }

    public function test_pre_proc_conference_automatically_checked_when_budget_is_five_million_or_above(): void
    {
        $payload = [
            'title' => 'Large Infrastructure Project',
            'fiscal_year' => '2026',
            'source_of_fund' => 'General Fund',
            'plan_type' => 'INDICATIVE',
            'items' => [
                [
                    'description' => 'Construction of Hospital Wing',
                    'project_type' => 'Infrastructure',
                    'quantity_size' => '1 lot',
                    'procurement_mode' => 'Public Bidding',
                    'pre_proc_conference' => false, // explicitly false
                    'estimated_budget' => 5000000,   // 5 million
                ],
                [
                    'description' => 'Minor Maintenance Repair',
                    'project_type' => 'Goods',
                    'quantity_size' => '1 unit',
                    'procurement_mode' => 'Small Value Procurement',
                    'pre_proc_conference' => false,
                    'estimated_budget' => 450000,    // Under 5M
                ]
            ],
        ];

        $res = $this->actingAs($this->endUser)->postJson('/api/ppmps', $payload);
        $res->assertStatus(201);

        $created = Ppmp::latest('id')->first();
        $this->assertNotNull($created);
        $items = $created->items()->orderBy('item_no')->get();

        // Item 1 (5,000,000) must have pre_proc_conference = true
        $this->assertTrue((bool) $items[0]->pre_proc_conference);

        // Item 2 (450,000) retains false
        $this->assertFalse((bool) $items[1]->pre_proc_conference);
    }

    public function test_end_user_dashboard_includes_items_with_start_date_for_procurement_reminders(): void
    {
        $ppmp = Ppmp::create([
            'uuid' => (string) Str::uuid(),
            'ppmp_number' => 101,
            'title' => 'Office Equipment Procurement',
            'fiscal_year' => '2026',
            'source_of_fund' => 'General Fund',
            'plan_type' => 'INDICATIVE',
            'total_budget' => 250000,
            'status' => 'DRAFT',
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
        ]);

        PpmpItem::create([
            'ppmp_id' => $ppmp->id,
            'item_no' => 1,
            'description' => 'Heavy Duty Printers',
            'project_type' => 'Goods',
            'start_date' => '8/2026',
            'estimated_budget' => 250000,
        ]);

        $res = $this->actingAs($this->endUser)->getJson('/api/dashboard');
        $res->assertStatus(200);
        $recent = $res->json('recent_ppmps');
        $this->assertNotEmpty($recent);

        $found = collect($recent)->firstWhere('uuid', $ppmp->uuid);
        $this->assertNotNull($found);
        $this->assertArrayHasKey('items', $found);
        $this->assertNotEmpty($found['items']);
        $this->assertEquals('8/2026', $found['items'][0]['start_date']);
    }

    public function test_tracker_number_sequence_continues_correctly_when_amendments_or_supplementals_exist(): void
    {
        // 1. Create baseline PPMP with tracking number sequence 7
        $baseline = Ppmp::create([
            'uuid' => (string) Str::uuid(),
            'tracking_number' => 'TEST-OFFICEGOODS-2026-000007',
            'ppmp_number' => '7',
            'title' => 'Project Seven',
            'fiscal_year' => '2026',
            'source_of_fund' => 'General Fund',
            'plan_type' => 'INDICATIVE',
            'total_budget' => 100000,
            'status' => 'READY_TO_PRINT',
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
            'amendment_status' => 'APPROVED',
            'is_annual' => true,
        ]);

        // 2. An amendment child was created with the same tracking number (as in approved amendments)
        $amendedChild = Ppmp::create([
            'uuid' => (string) Str::uuid(),
            'parent_id' => $baseline->id,
            'tracking_number' => 'TEST-OFFICEGOODS-2026-000007', // Reuses baseline tracker number
            'ppmp_number' => '7',
            'title' => 'Project Seven Amended',
            'fiscal_year' => '2026',
            'source_of_fund' => 'General Fund',
            'plan_type' => 'INDICATIVE',
            'total_budget' => 120000,
            'status' => 'DRAFT',
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
            'amendment_type' => 'SUPPLEMENTAL',
            'is_annual' => false,
        ]);

        // 3. Now create a new PPMP
        $res = $this->actingAs($this->endUser)->postJson('/api/ppmps', [
            'title' => 'Brand New Project Eight',
            'fiscal_year' => '2026',
            'plan_type' => 'INDICATIVE',
            'source_of_fund' => 'General Fund',
            'items' => [
                [
                    'description' => 'Supplies Item',
                    'project_type' => 'Goods',
                    'estimated_budget' => 50000,
                ],
            ],
        ]);

        $res->assertStatus(201);
        $newPpmp = Ppmp::where('uuid', $res->json('ppmp.uuid'))->firstOrFail();

        // Must be sequence 000008 (NOT skipped to 000009!)
        $this->assertEquals('TEST-OFFICEGOODS-2026-000008', $newPpmp->tracking_number);
    }

    public function test_ppmp_stores_and_updates_program_name(): void
    {
        $res = $this->actingAs($this->endUser)->postJson('/api/ppmps', [
            'title' => 'Health Equipment Procurement',
            'fiscal_year' => '2026',
            'plan_type' => 'INDICATIVE',
            'source_of_fund' => 'General Fund',
            'program_name' => 'Provincial Health Outreach Program',
            'implementing_unit' => 'Provincial Health Office',
            'items' => [
                [
                    'description' => 'Medical Monitors',
                    'project_type' => 'Goods',
                    'estimated_budget' => 75000,
                ],
            ],
        ]);

        $res->assertStatus(201);
        $ppmp = Ppmp::where('uuid', $res->json('ppmp.uuid'))->firstOrFail();
        $this->assertEquals('Provincial Health Outreach Program', $ppmp->program_name);

        // Update program_name
        $updateRes = $this->actingAs($this->endUser)->putJson("/api/ppmps/{$ppmp->uuid}", [
            'title' => 'Health Equipment Procurement Updated',
            'fiscal_year' => '2026',
            'plan_type' => 'INDICATIVE',
            'source_of_fund' => 'General Fund',
            'program_name' => 'Provincial Nutrition & Wellness Program',
            'implementing_unit' => 'Provincial Health Office',
            'items' => [
                [
                    'description' => 'Medical Monitors',
                    'project_type' => 'Goods',
                    'estimated_budget' => 75000,
                ],
            ],
        ]);

        $updateRes->assertStatus(200);
        $this->assertEquals('Provincial Nutrition & Wellness Program', $ppmp->fresh()->program_name);
    }
}

