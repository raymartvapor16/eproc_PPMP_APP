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

    public function test_complete_ppmp_workflow_and_signatures(): void
    {

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

        $ppmp = Ppmp::where('uuid', $ppmpUuid)->first();
        $this->assertTrue($ppmp->signatures()->where('role', 'end_user')->exists());

        $prematureRes = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$ppmpUuid}/submit-for-review");
        $prematureRes->assertStatus(422)
            ->assertJsonPath('checks.is_ready', false)
            ->assertJsonPath('checks.attachment_list_generated', false)
            ->assertJsonPath('checks.market_scoping_attached', false);

        Storage::fake('local');
        $pdfContent = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\nxref\n0 2\ntrailer<</Size 2/Root 1 0 R>>\nstartxref\n50\n%%EOF";
        $fakePdf = UploadedFile::fake()->createWithContent('market_scoping_assessment.pdf', $pdfContent);

        $uploadRes = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$ppmpUuid}/attachments", [
            'file' => $fakePdf,
            'attachment_type' => 'MARKET_SCOPING',
        ]);
        $uploadRes->assertStatus(201);
        $attachmentUuid = $uploadRes->json('attachment.uuid');

        $downloadRes = $this->actingAs($this->endUser)->get("/api/ppmps/{$ppmpUuid}/attachments/{$attachmentUuid}/download");
        $downloadRes->assertStatus(200);

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

        $submitReviewRes = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$ppmpUuid}/submit-for-review");
        $submitReviewRes->assertStatus(200);
        $this->assertEquals('TWG_REVIEW', $submitReviewRes->json('ppmp.status'));

        $this->actingAs($this->twgUser)->postJson("/api/ppmps/{$ppmpUuid}/receive")->assertStatus(200);

        $twgApproveRes = $this->actingAs($this->twgUser)->postJson("/api/ppmps/{$ppmpUuid}/twg/approve");
        $twgApproveRes->assertStatus(200);
        $this->assertEquals('BUDGET_OFFICER_REVIEW', $twgApproveRes->json('ppmp.status'));
        $this->assertTrue($ppmp->fresh()->signatures()->where('role', 'twg')->exists());

        $this->actingAs($this->budgetUser)->postJson("/api/ppmps/{$ppmpUuid}/receive")->assertStatus(200);

        $budgetApproveRes = $this->actingAs($this->budgetUser)->postJson("/api/ppmps/{$ppmpUuid}/budget/approve");
        $budgetApproveRes->assertStatus(200);
        $this->assertEquals('OPPMO_REVIEW', $budgetApproveRes->json('ppmp.status'));
        $this->assertTrue($ppmp->fresh()->signatures()->where('role', 'budget_officer')->exists());

        $this->actingAs($this->oppmoUser)->postJson("/api/ppmps/{$ppmpUuid}/receive")->assertStatus(200);

        $prematureOppmoRes = $this->actingAs($this->oppmoUser)->postJson("/api/ppmps/{$ppmpUuid}/oppmo/approve");
        $prematureOppmoRes->assertStatus(422)
            ->assertJsonPath('message', 'Please generate or regenerate the Annual Procurement Plan (APP) before granting final approval.');

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

        $oppmoFinalApproveRes = $this->actingAs($this->oppmoUser)->postJson("/api/ppmps/{$ppmpUuid}/oppmo/approve");
        $oppmoFinalApproveRes->assertStatus(200);
        $this->assertEquals('READY_TO_PRINT', $oppmoFinalApproveRes->json('ppmp.status'));
        $this->assertTrue($ppmp->fresh()->signatures()->where('role', 'oppmo')->exists());

        $freshPpmp = $ppmp->fresh(['signatures', 'routes']);
        $this->assertTrue($freshPpmp->signatures()->where('role', 'twg')->exists());
        $this->assertTrue($freshPpmp->signatures()->where('role', 'budget_officer')->exists());
        $this->assertTrue($freshPpmp->signatures()->where('role', 'oppmo')->exists());
        $this->assertTrue($freshPpmp->routes()->where('status', 'READY_TO_PRINT')->exists());
    }

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

        $this->actingAs($this->budgetUser)->postJson("/api/ppmps/{$ppmp->uuid}/receive")->assertStatus(200);

        $failRes = $this->actingAs($this->budgetUser)->postJson("/api/ppmps/{$ppmp->uuid}/budget/return", [
            'remarks' => '',
        ]);
        $failRes->assertStatus(422);

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

        $this->assertTrue($ppmp->changeLogs()->where('field_name', 'estimated_budget')->exists());
        $this->assertEquals(90000.00, (float)$ppmp->fresh()->total_budget);

        $resubmitRes = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$ppmp->uuid}/submit-for-review");
        $resubmitRes->assertStatus(200);
        $this->assertEquals('BUDGET_OFFICER_REVIEW', $resubmitRes->json('ppmp.status'));
    }

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

        $unauthRes = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$ppmp->uuid}/head/approve");
        $unauthRes->assertStatus(403);

        $unauthRes2 = $this->actingAs($this->budgetUser)->postJson("/api/ppmps/{$ppmp->uuid}/twg/approve");
        $unauthRes2->assertStatus(403);
    }

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

        $this->actingAs($this->endUser)->postJson("/api/ppmps/{$ppmp->uuid}/submit-for-review")->assertStatus(200);
        $this->assertEquals('TWG_REVIEW', $ppmp->fresh()->status);
        $this->assertNull($ppmp->fresh()->twg_received_at);

        $twgReceiveRes = $this->actingAs($this->twgUser)->postJson("/api/ppmps/{$ppmp->uuid}/receive");
        $twgReceiveRes->assertStatus(200);
        $this->assertNotNull($ppmp->fresh()->twg_received_at);

        $this->actingAs($this->twgUser)->postJson("/api/ppmps/{$ppmp->uuid}/twg/return", [
            'remarks' => 'Please revise item quantity and technical specifications.',
        ])->assertStatus(200);

        $this->assertEquals('TWG_RETURNED', $ppmp->fresh()->status);
        $this->assertNull($ppmp->fresh()->enduser_received_at);

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
                    'pre_proc_conference' => false,
                    'estimated_budget' => 5000000,
                ],
                [
                    'description' => 'Minor Maintenance Repair',
                    'project_type' => 'Goods',
                    'quantity_size' => '1 unit',
                    'procurement_mode' => 'Small Value Procurement',
                    'pre_proc_conference' => false,
                    'estimated_budget' => 450000,
                ]
            ],
        ];

        $res = $this->actingAs($this->endUser)->postJson('/api/ppmps', $payload);
        $res->assertStatus(201);

        $created = Ppmp::latest('id')->first();
        $this->assertNotNull($created);
        $items = $created->items()->orderBy('item_no')->get();

        $this->assertTrue((bool) $items[0]->pre_proc_conference);

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

        $amendedChild = Ppmp::create([
            'uuid' => (string) Str::uuid(),
            'parent_id' => $baseline->id,
            'tracking_number' => 'TEST-OFFICEGOODS-2026-000007',
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

    public function test_ppmp_milestones_normalized_relationship_and_schema_integrity(): void
    {

        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasColumn('ppmps', 'head_received_at'));
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasColumn('ppmps', 'budget_received_at'));
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasColumn('ppmps', 'admin_received_at'));
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasColumn('ppmps', 'pacco_received_at'));
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasColumn('ppmps', 'oppmo_received_at'));
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasColumn('ppmps', 'twg_received_at'));
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasColumn('ppmps', 'ready_to_print_at'));
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasColumn('ppmps', 'enduser_received_at'));
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasColumn('ppmps', 'amendment_requested_at'));
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasColumn('ppmps', 'amendment_approved_at'));
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasColumn('ppmps', 'amendment_status'));
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasColumn('ppmps', 'amendment_type'));
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasColumn('ppmps', 'amendment_scope'));
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasColumn('ppmps', 'amendment_reason'));
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasColumn('ppmps', 'requested_amendment_type'));
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasColumn('ppmps', 'requested_amendment_scope'));
        $this->assertFalse(\Illuminate\Support\Facades\Schema::hasColumn('ppmps', 'requested_amendment_reason'));

        $this->assertTrue(\Illuminate\Support\Facades\Schema::hasTable('ppmp_milestones'));
        $this->assertTrue(\Illuminate\Support\Facades\Schema::hasColumn('ppmp_milestones', 'ppmp_id'));
        $this->assertTrue(\Illuminate\Support\Facades\Schema::hasColumn('ppmp_milestones', 'head_received_at'));
        $this->assertTrue(\Illuminate\Support\Facades\Schema::hasColumn('ppmp_milestones', 'budget_received_at'));
        $this->assertTrue(\Illuminate\Support\Facades\Schema::hasColumn('ppmp_milestones', 'admin_received_at'));

        $this->assertTrue(\Illuminate\Support\Facades\Schema::hasTable('ppmp_amendments'));
        $this->assertTrue(\Illuminate\Support\Facades\Schema::hasColumn('ppmp_amendments', 'ppmp_id'));
        $this->assertTrue(\Illuminate\Support\Facades\Schema::hasColumn('ppmp_amendments', 'amendment_status'));
        $this->assertTrue(\Illuminate\Support\Facades\Schema::hasColumn('ppmp_amendments', 'amendment_type'));
        $this->assertTrue(\Illuminate\Support\Facades\Schema::hasColumn('ppmp_amendments', 'amendment_scope'));

        $res = $this->actingAs($this->endUser)->postJson('/api/ppmps', [
            'title' => 'Normalized Milestones Test PPMP',
            'fiscal_year' => '2026',
            'plan_type' => 'INDICATIVE',
            'source_of_fund' => 'General Fund',
            'items' => [
                [
                    'description' => 'Test Item',
                    'project_type' => 'Goods',
                    'estimated_budget' => 50000,
                ],
            ],
        ]);

        $res->assertStatus(201);
        $ppmp = Ppmp::where('uuid', $res->json('ppmp.uuid'))->firstOrFail();

        $this->assertInstanceOf(\App\Models\PpmpMilestone::class, $ppmp->milestones);
        $this->assertInstanceOf(\App\Models\PpmpAmendment::class, $ppmp->amendment);
        $this->assertEquals($ppmp->id, $ppmp->milestones->ppmp_id);
        $this->assertEquals($ppmp->id, $ppmp->amendment->ppmp_id);
        $this->assertNotNull($ppmp->prepared_at);
        $this->assertNotNull($ppmp->milestones->prepared_at);

        $ppmp->update([
            'status' => 'HEAD_PENDING',
            'head_submitted_at' => now(),
            'amendment_status' => 'PENDING_APPROVAL',
            'requested_amendment_type' => 'SUPPLEMENTAL',
        ]);
        $this->assertNull($ppmp->fresh()->head_received_at);
        $this->assertEquals('PENDING_APPROVAL', $ppmp->fresh()->amendment_status);
        $this->assertEquals('SUPPLEMENTAL', $ppmp->fresh()->requested_amendment_type);
        $this->assertEquals('PENDING_APPROVAL', $ppmp->fresh()->amendment->amendment_status);

        $receiveRes = $this->actingAs($this->headUser)->postJson("/api/ppmps/{$ppmp->uuid}/receive");
        $receiveRes->assertStatus(200);

        $freshPpmp = $ppmp->fresh();
        $this->assertNotNull($freshPpmp->milestones->head_received_at);
        $this->assertNotNull($freshPpmp->head_received_at);

        $showRes = $this->actingAs($this->endUser)->getJson("/api/ppmps/{$ppmp->uuid}");
        $showRes->assertStatus(200)
            ->assertJsonStructure([
                'ppmp' => [
                    'id',
                    'milestones' => [
                        'ppmp_id',
                        'prepared_at',
                        'head_submitted_at',
                        'head_received_at',
                    ],
                    'amendment' => [
                        'ppmp_id',
                        'amendment_status',
                        'requested_amendment_type',
                    ],
                    'prepared_at',
                    'head_received_at',
                    'amendment_status',
                ],
            ]);
    }
}
