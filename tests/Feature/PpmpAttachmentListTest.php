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

class PpmpAttachmentListTest extends TestCase
{
    use RefreshDatabase;

    protected User $creator;
    protected User $adminUser;
    protected Office $office;

    protected function setUp(): void
    {
        parent::setUp();

        $this->office = Office::create([
            'code' => 'PGO-GEN',
            'name' => 'Provincial Governor\'s Office',
        ]);

        $password = Hash::make('password123');

        $this->creator = User::create([
            'name' => 'End User Maria',
            'email' => 'maria@example.test',
            'password' => $password,
            'role' => 'end_user',
            'office_id' => $this->office->id,
            'is_active' => true,
        ]);

        $this->adminUser = User::create([
            'name' => 'Admin User',
            'email' => 'admin@example.test',
            'password' => $password,
            'role' => 'admin',
            'office_id' => $this->office->id,
            'is_active' => true,
        ]);
    }

    public function test_creator_can_save_ppmp_list_of_attachment_with_budget_and_items(): void
    {
        $ppmp = Ppmp::create([
            'uuid' => (string) Str::uuid(),
            'tracking_number' => 'TRK-2026-ATT-001',
            'ppmp_number' => '1',
            'office_id' => $this->office->id,
            'created_by' => $this->creator->id,
            'year' => 2026,
            'fiscal_year' => 2026,
            'title' => 'Procurement of Office Supplies',
            'total_budget' => 50000.00,
            'status' => 'DRAFT',
            'current_stage' => 'END_USER',
        ]);

        $response = $this->actingAs($this->creator)->postJson("/api/ppmps/{$ppmp->uuid}/attachment-list", [
            'office_name' => 'Provincial Governor\'s Office',
            'project_title' => 'Office Supplies Attachment List',
            'total_budget' => 50000.00,
            'charges' => '5-02-03-010 / CY 2026 General Fund',
            'place_of_delivery' => 'PGSO Warehouse/On-site',
            'payment_method' => 'Credit-basis',
            'delivery_period' => '30 Calendar Days',
            'rows' => [
                [
                    'id' => 1,
                    'itemNo' => 1,
                    'unit' => 'reams',
                    'description' => 'A4 Copy Paper 80gsm',
                    'qty' => 100,
                    'unitCost' => 300.00,
                    'totalCost' => 30000.00,
                ],
                [
                    'id' => 2,
                    'itemNo' => 2,
                    'unit' => 'boxes',
                    'description' => 'Ballpen Black 0.5mm',
                    'qty' => 50,
                    'unitCost' => 400.00,
                    'totalCost' => 20000.00,
                ],
            ],
            'prepared_by_name' => 'End User Maria',
            'prepared_by_position' => 'Project In-Charge',
        ]);

        $response->assertStatus(200);
        $response->assertJsonFragment([
            'message' => 'PPMP List of Attachment saved successfully.',
        ]);

        $ppmp->refresh();
        $this->assertNotNull($ppmp->attachment_list_data);
        $this->assertEquals(50000.00, $ppmp->attachment_list_data['total_budget']);
        $this->assertCount(2, $ppmp->attachment_list_data['rows']);
        $this->assertEquals('PGSO Warehouse/On-site', $ppmp->place_of_delivery);
    }

    public function test_multiple_attachment_lists_preserve_keys_without_reindexing(): void
    {
        $ppmp = Ppmp::create([
            'uuid' => (string) Str::uuid(),
            'tracking_number' => 'TRK-2026-ATT-MULTI',
            'ppmp_number' => '2',
            'office_id' => $this->office->id,
            'created_by' => $this->creator->id,
            'year' => 2026,
            'fiscal_year' => 2026,
            'title' => 'Multi-Project Procurement',
            'total_budget' => 150000.00,
            'status' => 'DRAFT',
            'current_stage' => 'END_USER',
        ]);

        $item1 = PpmpItem::create([
            'ppmp_id' => $ppmp->id,
            'item_no' => 1,
            'description' => 'IT Equipment Lot',
            'estimated_budget' => 100000.00,
            'source_of_fund' => 'General Fund',
        ]);

        $item2 = PpmpItem::create([
            'ppmp_id' => $ppmp->id,
            'item_no' => 2,
            'description' => 'Catering Services',
            'estimated_budget' => 50000.00,
            'source_of_fund' => 'General Fund',
        ]);

        // Keyed by string numeric ids
        $attachmentLists = [
            (string) $item1->id => [
                'office_name' => 'Provincial Governor\'s Office',
                'project_title' => 'IT Equipment Lot Breakdown',
                'total_budget' => 100000.00,
                'charges' => '5-02-03-010 / CY 2026',
                'rows' => [
                    ['id' => 1, 'itemNo' => 1, 'unit' => 'unit', 'description' => 'Desktop PC', 'qty' => 2, 'unitCost' => 50000, 'totalCost' => 100000],
                ],
            ],
            (string) $item2->id => [
                'office_name' => 'Provincial Governor\'s Office',
                'project_title' => 'Catering Services Breakdown',
                'total_budget' => 50000.00,
                'charges' => '5-02-02-010 / CY 2026',
                'rows' => [
                    ['id' => 1, 'itemNo' => 1, 'unit' => 'pax', 'description' => 'Lunch & Snacks', 'qty' => 100, 'unitCost' => 500, 'totalCost' => 50000],
                ],
            ],
        ];

        $response = $this->actingAs($this->creator)->postJson("/api/ppmps/{$ppmp->uuid}/attachment-list", [
            'office_name' => 'Provincial Governor\'s Office',
            'project_title' => 'IT Equipment Lot Breakdown',
            'total_budget' => 100000.00,
            'attachment_lists' => $attachmentLists,
        ]);

        $response->assertStatus(200);

        $ppmp->refresh();
        $savedAttachmentLists = $ppmp->attachment_list_data['attachment_lists'];

        // Ensure keys were NOT converted to 0, 1 but kept as (string)$item1->id and (string)$item2->id
        $this->assertArrayHasKey((string) $item1->id, $savedAttachmentLists);
        $this->assertArrayHasKey((string) $item2->id, $savedAttachmentLists);
        $this->assertEquals(100000.00, $savedAttachmentLists[(string) $item1->id]['total_budget']);
        $this->assertEquals(50000.00, $savedAttachmentLists[(string) $item2->id]['total_budget']);
    }

    public function test_attachment_list_is_locked_when_amendment_scope_is_ppmp_app_only(): void
    {
        $ppmp = Ppmp::create([
            'uuid' => (string) Str::uuid(),
            'tracking_number' => 'TRK-2026-LOCKED',
            'ppmp_number' => '3',
            'office_id' => $this->office->id,
            'created_by' => $this->creator->id,
            'year' => 2026,
            'fiscal_year' => 2026,
            'title' => 'Scope Locked PPMP',
            'total_budget' => 20000.00,
            'status' => 'DRAFT',
            'amendment_scope' => 'PPMP_APP', // Restricted to PPMP/APP items only
            'current_stage' => 'END_USER',
        ]);

        $response = $this->actingAs($this->creator)->postJson("/api/ppmps/{$ppmp->uuid}/attachment-list", [
            'office_name' => 'Provincial Governor\'s Office',
            'total_budget' => 20000.00,
            'rows' => [
                ['id' => 1, 'unit' => 'pcs', 'description' => 'Test', 'qty' => 1, 'unitCost' => 20000, 'totalCost' => 20000],
            ],
        ]);

        $response->assertStatus(403);
        $response->assertJsonFragment([
            'message' => 'PPMP List of Attachment cannot be modified for this revision. The approved request scope is restricted to PPMP/APP procurement items only.',
        ]);
    }

    public function test_attachment_list_preserves_ppmp_contractual_delivery_period_even_when_items_have_schedule_dates(): void
    {
        $ppmp = Ppmp::create([
            'uuid' => (string) Str::uuid(),
            'tracking_number' => 'TRK-2026-CATERING-01',
            'ppmp_number' => '4',
            'office_id' => $this->office->id,
            'created_by' => $this->creator->id,
            'fiscal_year' => 2026,
            'title' => 'Catering Services Project',
            'total_budget' => 60000.00,
            'status' => 'DRAFT',
            'delivery_period' => 'Date of Activity',
            'place_of_delivery' => 'PGSO Warehouse/On-site',
            'payment_method' => 'Staggered Delivery/Credit-basis',
            'additional_condition' => 'Catering Services: With Date/Schedule',
        ]);

        $item = PpmpItem::create([
            'ppmp_id' => $ppmp->id,
            'item_no' => 1,
            'description' => 'Food and Catering Services (buffet & packed meals)',
            'estimated_budget' => 60000.00,
            'source_of_fund' => 'General Fund',
            'delivery_period' => '10/2026', // Item schedule month
        ]);

        $response = $this->actingAs($this->creator)->postJson("/api/ppmps/{$ppmp->uuid}/attachment-list", [
            'office_name' => 'Provincial Governor\'s Office',
            'project_title' => 'Food and Catering Services',
            'total_budget' => 60000.00,
            'delivery_period' => 'Date of Activity',
            'place_of_delivery' => 'PGSO Warehouse/On-site',
            'payment_method' => 'Staggered Delivery/Credit-basis',
            'additional_condition' => 'Catering Services: With Date/Schedule',
            'rows' => [
                ['id' => 1, 'unit' => 'meals', 'description' => 'Buffet Meals', 'qty' => 100, 'unitCost' => 600, 'totalCost' => 60000],
            ],
        ]);

        $response->assertStatus(200);

        $ppmp->refresh();
        $this->assertEquals('Date of Activity', $ppmp->delivery_period);
        $this->assertEquals('Date of Activity', $ppmp->attachment_list_data['delivery_period']);
        $this->assertEquals('10/2026', $item->delivery_period); // Item monthly schedule unchanged
    }

    public function test_attachment_list_approved_by_fetches_approving_twg_reviewer(): void
    {
        $twgUser = User::create([
            'name' => 'Engr. Juan Dela Cruz',
            'email' => 'juan.twg@example.test',
            'password' => Hash::make('password123'),
            'role' => 'twg',
            'designation' => 'BAC TWG Technical Evaluator',
            'office_id' => $this->office->id,
            'is_active' => true,
        ]);

        $ppmp = Ppmp::create([
            'uuid' => (string) Str::uuid(),
            'tracking_number' => 'TRK-2026-TWG-ATT-01',
            'ppmp_number' => '5',
            'office_id' => $this->office->id,
            'created_by' => $this->creator->id,
            'fiscal_year' => 2026,
            'title' => 'Hardware Equipment Project',
            'total_budget' => 45000.00,
            'status' => 'TWG_REVIEW',
            'attachment_list_data' => [
                'is_generated' => true,
                'project_title' => 'Hardware Equipment',
                'prepared_by_name' => 'Maria',
                'submitted_by_name' => 'Head',
                'approved_by_name' => null,
                'approved_by_position' => null,
                'rows' => [
                    ['id' => 1, 'unit' => 'unit', 'description' => 'Router', 'qty' => 1, 'unitCost' => 45000, 'totalCost' => 45000],
                ],
            ],
        ]);

        // When TWG approves the PPMP in workflow
        $response = $this->actingAs($twgUser)->postJson("/api/ppmps/{$ppmp->uuid}/twg/approve");
        $response->assertStatus(200);

        $ppmp->refresh();

        // Verify attachment_list_data now has the TWG reviewer's exact name and designation
        $this->assertEquals('Engr. Juan Dela Cruz', $ppmp->attachment_list_data['approved_by_name']);
        $this->assertEquals('BAC TWG Technical Evaluator', $ppmp->attachment_list_data['approved_by_position']);

        // Verify that saving an attachment list as end-user strips any legacy Governor name
        $this->actingAs($this->creator)->postJson("/api/ppmps/{$ppmp->uuid}/attachment-list", [
            'approved_by_name' => 'HON. YVONNE R. CAGAS',
            'approved_by_position' => 'PROVINCIAL GOVERNOR',
            'rows' => [
                ['id' => 1, 'unit' => 'unit', 'description' => 'Router', 'qty' => 1, 'unitCost' => 45000, 'totalCost' => 45000],
            ],
        ]);

        $ppmp->refresh();
        // Since TWG already approved, it retains the TWG signer's name
        $this->assertEquals('Engr. Juan Dela Cruz', $ppmp->attachment_list_data['approved_by_name']);
    }
}

