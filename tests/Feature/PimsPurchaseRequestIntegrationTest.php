<?php

namespace Tests\Feature;

use App\Models\Office;
use App\Models\Ppmp;
use App\Models\PpmpAttachmentList;
use App\Models\PpmpItem;
use App\Models\PurchaseRequest;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Str;
use Tests\TestCase;

class PimsPurchaseRequestIntegrationTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $endUser;
    protected User $twg;
    protected Office $office;

    protected function setUp(): void
    {
        parent::setUp();

        $this->office = Office::create([
            'name' => 'Provincial Social Welfare and Development Office',
            'code' => 'PSWDO',
            'is_active' => true,
        ]);

        $this->admin = User::factory()->create([
            'name' => 'System Administrator',
            'email' => 'admin@system.com',
            'role' => 'admin',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $this->endUser = User::factory()->create([
            'name' => 'Geraldine Sanchez-Lano',
            'email' => 'pswdo@system.com',
            'role' => 'end_user',
            'office_id' => $this->office->id,
            'designation' => 'Provincial Social Welfare and Development Officer',
            'is_active' => true,
            'approval_status' => 'approved',
            'accessible_systems' => ['/eprocrementppmpapp', '/pims'],
        ]);

        $this->twg = User::factory()->create([
            'name' => 'BAC TWG Evaluator',
            'email' => 'twg@system.com',
            'role' => 'twg',
            'is_active' => true,
            'approval_status' => 'approved',
            'accessible_systems' => ['/eprocrementppmpapp', '/pims'],
        ]);
    }

    public function test_can_fetch_ppmp_prepopulated_data_for_pr_generation(): void
    {
        $ppmp = Ppmp::create([
            'uuid' => (string) Str::uuid(),
            'tracking_number' => 'PSWDOGoods-2026-149',
            'ppmp_number' => 'PPMP-2026-001',
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
            'title' => 'Supply and delivery of Catering Services without Venue',
            'fiscal_year' => '2026',
            'status' => 'READY_TO_PRINT',
            'total_budget' => 2499850.00,
        ]);

        PpmpAttachmentList::create([
            'uuid' => (string) Str::uuid(),
            'ppmp_id' => $ppmp->id,
            'project_title' => 'Catering Services for Year End Festival',
            'office_name' => $this->office->name,
            'total_budget' => 2499850.00,
            'charges' => 'CY 2026 GENERAL FUND Account Code: 5-02-99-030',
            'place_of_delivery' => 'PGSO Warehouse/On Site',
            'delivery_period' => 'Date of activity',
            'payment_method' => 'One-Time Payment/ Credit Basis',
            'rows' => [
                [
                    'item_no' => '1.1',
                    'unit' => 'pax',
                    'item_description' => '1 HEAVY MEAL ONLY (packed meals)',
                    'quantity' => 5521,
                    'unit_cost' => 350.00,
                    'total_cost' => 1932350.00,
                ],
                [
                    'item_no' => '1.2',
                    'unit' => 'pax',
                    'item_description' => '1 MEAL ONLY WITH PICA-PICA (buffet style)',
                    'quantity' => 150,
                    'unit_cost' => 750.00,
                    'total_cost' => 112500.00,
                ],
            ],
        ]);

        $response = $this->actingAs($this->admin)
            ->getJson("/api/pims/purchase-requests/ppmp-data/{$ppmp->uuid}")
            ->assertOk();

        $response->assertJsonPath('prepopulated.tracker_id', 'PSWDOGoods-2026-149');
        $response->assertJsonPath('prepopulated.department', 'Provincial Social Welfare and Development Office');
        $this->assertCount(2, $response->json('prepopulated.items'));
    }

    public function test_can_generate_purchase_request_and_copies_tracker_id(): void
    {
        $ppmp = Ppmp::create([
            'uuid' => (string) Str::uuid(),
            'tracking_number' => 'PSWDOGoods-2026-149',
            'ppmp_number' => 'PPMP-2026-001',
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
            'title' => 'Supply and delivery of Catering Services without Venue',
            'fiscal_year' => '2026',
            'status' => 'READY_TO_PRINT',
            'total_budget' => 2499850.00,
        ]);

        $payload = [
            'ppmp_uuid' => $ppmp->uuid,
            'tracker_id' => 'PSWDOGoods-2026-149',
            'department' => $this->office->name,
            'purpose' => 'For the use of the Provincial Government of Davao del Sur Year End Festival',
            'total_cost' => 2499850.00,
            'items' => [
                [
                    'item_no' => '1.1',
                    'unit' => 'pax',
                    'item_description' => '1 HEAVY MEAL ONLY (packed meals)',
                    'quantity' => 5521,
                    'unit_cost' => 350.00,
                    'total_cost' => 1932350.00,
                ],
            ],
        ];

        $response = $this->actingAs($this->endUser)
            ->postJson('/api/pims/purchase-requests', $payload)
            ->assertStatus(201);

        $response->assertJsonPath('purchase_request.tracker_id', 'PSWDOGoods-2026-149');
        $response->assertJsonPath('purchase_request.current_stage', 'pr_division');
        $response->assertJsonPath('purchase_request.status', 'PR_DIVISION_REVIEW');

        $this->assertDatabaseHas('purchase_requests', [
            'tracker_id' => 'PSWDOGoods-2026-149',
            'ppmp_id' => $ppmp->id,
        ]);

        $this->assertDatabaseHas('purchase_request_items', [
            'item_no' => '1.1',
            'quantity' => 5521,
        ]);

        // Duplicate generation for same PPMP must be rejected
        $this->actingAs($this->endUser)
            ->postJson('/api/pims/purchase-requests', $payload)
            ->assertStatus(409);
    }

    public function test_purchase_request_reviewer_lifecycle_flow(): void
    {
        $ppmp = Ppmp::create([
            'uuid' => (string) Str::uuid(),
            'tracking_number' => 'PSWDOGoods-2026-149',
            'ppmp_number' => 'PPMP-2026-001',
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
            'title' => 'Supply and delivery of Catering Services without Venue',
            'fiscal_year' => '2026',
            'status' => 'READY_TO_PRINT',
            'total_budget' => 2499850.00,
        ]);

        $pr = PurchaseRequest::create([
            'uuid' => (string) Str::uuid(),
            'ppmp_id' => $ppmp->id,
            'office_id' => $this->office->id,
            'tracker_id' => 'PSWDOGoods-2026-149',
            'department' => $this->office->name,
            'purpose' => 'Test Purchase Request',
            'total_cost' => 2499850.00,
            'current_stage' => 'pr_division',
            'status' => 'PR_DIVISION_REVIEW',
            'created_by' => $this->endUser->id,
        ]);

        // 1. PR Division review -> passes to BAC TWG
        $this->actingAs($this->admin)
            ->postJson("/api/pims/purchase-requests/{$pr->uuid}/review", [
                'action' => 'approve',
                'remarks' => 'PR Division preliminary check passed.',
            ])
            ->assertOk()
            ->assertJsonPath('purchase_request.current_stage', 'bac_twg')
            ->assertJsonPath('purchase_request.status', 'BAC_TWG_REVIEW');

        // 2. BAC TWG review -> passes to PR Division Control
        $this->actingAs($this->twg)
            ->postJson("/api/pims/purchase-requests/{$pr->uuid}/review", [
                'action' => 'approve',
                'remarks' => 'Technical specifications verified by BAC TWG.',
            ])
            ->assertOk()
            ->assertJsonPath('purchase_request.current_stage', 'pr_control')
            ->assertJsonPath('purchase_request.status', 'PR_CONTROL_REVIEW');

        // 3. PR Control -> assigns PR Number and officially approves
        $this->actingAs($this->admin)
            ->postJson("/api/pims/purchase-requests/{$pr->uuid}/review", [
                'action' => 'approve',
                'assigned_pr_number' => 'PR-2026-PSWDO-001',
                'remarks' => 'PR number assigned and approved.',
            ])
            ->assertOk()
            ->assertJsonPath('purchase_request.current_stage', 'approved')
            ->assertJsonPath('purchase_request.status', 'PR_APPROVED')
            ->assertJsonPath('purchase_request.pr_number', 'PR-2026-PSWDO-001');

        $this->assertCount(3, $pr->fresh()->routes);
    }

    public function test_pr_generation_automatically_creates_monitoring_record_and_attaches_pdf_and_secure_links(): void
    {
        $ppmp = Ppmp::create([
            'uuid' => (string) Str::uuid(),
            'tracking_number' => 'PMOGOODS-2026-000001',
            'ppmp_number' => 'PPMP-2026-999',
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
            'title' => 'Supply and Delivery of Medical Equipment',
            'fiscal_year' => '2026',
            'status' => 'READY_TO_PRINT',
            'total_budget' => 500000.00,
            'is_published_to_pims' => false,
        ]);

        // Create a fake PDF with genuine %PDF- magic bytes
        $fakePdfContent = "%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF";
        $fakePdf = \Illuminate\Http\UploadedFile::fake()->createWithContent('specs.pdf', $fakePdfContent);

        $payload = [
            'ppmp_uuid' => $ppmp->uuid,
            'tracker_id' => 'PMOGOODS-2026-000001',
            'department' => $this->office->name,
            'purpose' => 'Procurement of Medical Equipment for Provincial Hospital',
            'total_cost' => 500000.00,
            'items' => [
                [
                    'item_no' => '1',
                    'unit' => 'unit',
                    'item_description' => 'Medical Monitors',
                    'quantity' => 10,
                    'unit_cost' => 50000.00,
                    'total_cost' => 500000.00,
                ],
            ],
            'links' => [
                [
                    'url' => 'https://drive.google.com/file/d/test-doc-id/view',
                    'title' => 'Technical Specifications Cloud Drive',
                ],
            ],
        ];

        // 1. Non-HTTPS link must be rejected
        $invalidPayload = $payload;
        $invalidPayload['links'] = [
            ['url' => 'http://insecure-site.com/file.pdf', 'title' => 'Insecure link'],
        ];
        $this->actingAs($this->endUser)
            ->postJson('/api/pims/purchase-requests', $invalidPayload)
            ->assertStatus(422);

        // 2. Valid generation with PDF file and HTTPS link
        $response = $this->actingAs($this->endUser)
            ->post('/api/pims/purchase-requests', array_merge($payload, [
                'pdf_files' => [$fakePdf],
                'items' => json_encode($payload['items']),
                'links' => json_encode($payload['links']),
            ]))
            ->assertStatus(201);

        $prData = $response->json('purchase_request');
        $this->assertEquals('PMOGOODS-2026-000001', $prData['tracker_id']);

        // Check attachments were created
        $this->assertDatabaseHas('purchase_request_attachments', [
            'purchase_request_id' => $prData['id'],
            'attachment_type' => 'PDF_FILE',
            'original_filename' => 'specs.pdf',
        ]);
        $this->assertDatabaseHas('purchase_request_attachments', [
            'purchase_request_id' => $prData['id'],
            'attachment_type' => 'SECURE_LINK',
            'external_url' => 'https://drive.google.com/file/d/test-doc-id/view',
        ]);

        // Check PPMP was marked as published
        $this->assertTrue((bool) $ppmp->fresh()->is_published_to_pims);

        // Check MonitoringProject was automatically created with pims_pr_id = tracker_id
        $this->assertDatabaseHas('monitoring_projects', [
            'ppmp_id' => $ppmp->id,
            'purchase_request_id' => $prData['id'],
            'pims_pr_id' => 'PMOGOODS-2026-000001',
            'pr_number' => 'PMOGOODS-2026-000001',
            'pims_status' => 'PUBLISHED',
        ]);
    }

    public function test_pims_dashboard_endpoint_returns_real_time_metrics(): void
    {
        $response = $this->actingAs($this->admin)
            ->getJson('/api/pims/dashboard')
            ->assertOk();

        $response->assertJsonStructure([
            'summary' => [
                'total_requirements',
                'total_published',
                'pending_monitoring',
                'monitoring_completed',
                'pending_pr_generation',
                'generated_prs',
                'total_attachments',
                'pending_actions',
            ],
            'charts' => [
                'status',
                'source',
                'monthly',
                'category',
            ],
            'recent_activities',
            'pending_actions_list',
            'filter_options',
        ]);
    }

    public function test_end_user_with_ppmp_access_can_query_purchase_requests_by_ppmp_id(): void
    {
        // End user has only PPMP access, NOT direct /pims access
        $userOnlyPpmp = User::factory()->create([
            'name' => 'PPMP End User',
            'email' => 'ppmp.only@system.com',
            'role' => 'end_user',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
            'accessible_systems' => ['/eprocrementppmpapp'],
        ]);

        $ppmp = Ppmp::create([
            'uuid' => (string) Str::uuid(),
            'ppmp_number' => 'PPMP-2026-099',
            'title' => 'Test PPMP for PR Query',
            'fiscal_year' => 2026,
            'office_id' => $this->office->id,
            'created_by' => $userOnlyPpmp->id,
            'status' => 'DRAFT',
            'is_active' => true,
            'tracking_number' => 'PSWDO-2026-000099',
        ]);

        // Direct PIMS dashboard should be 403 Forbidden
        $this->actingAs($userOnlyPpmp)
            ->getJson('/api/pims/dashboard')
            ->assertStatus(403);

        // But querying purchase-requests by ppmp_id should be 200 OK
        $response = $this->actingAs($userOnlyPpmp)
            ->getJson('/api/pims/purchase-requests?ppmp_id=' . $ppmp->id)
            ->assertOk();

        $response->assertJsonStructure([
            'purchase_requests',
        ]);
    }
}

