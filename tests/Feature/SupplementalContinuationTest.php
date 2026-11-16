<?php

namespace Tests\Feature;

use App\Models\FundSource;
use App\Models\Office;
use App\Models\Ppmp;
use App\Models\PpmpAttachment;
use App\Models\PpmpItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\TestCase;

class SupplementalContinuationTest extends TestCase
{
    use RefreshDatabase;

    protected User $adminUser;
    protected User $endUser;
    protected User $headUser;
    protected User $twgUser;
    protected Office $office;
    protected FundSource $fundSource;
    protected Ppmp $annualPpmp;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');

        $this->office = Office::create([
            'code' => 'OFFICE-ENG',
            'name' => 'Provincial Engineering Office',
        ]);

        $password = Hash::make('password123');

        $this->adminUser = User::create([
            'name' => 'Admin User',
            'email' => 'admin@test.gov.ph',
            'password' => $password,
            'role' => 'admin',
            'office_id' => $this->office->id,
            'is_active' => true,
        ]);

        $this->headUser = User::create([
            'name' => 'Office Head',
            'email' => 'head@test.gov.ph',
            'password' => $password,
            'role' => 'head',
            'office_id' => $this->office->id,
            'is_active' => true,
        ]);

        $this->office->update(['head_user_id' => $this->headUser->id]);

        $this->endUser = User::create([
            'name' => 'End User Jane',
            'email' => 'jane@test.gov.ph',
            'password' => $password,
            'role' => 'end_user',
            'office_id' => $this->office->id,
            'is_active' => true,
        ]);

        $this->twgUser = User::create([
            'name' => 'BAC TWG Reviewer',
            'email' => 'twg@test.gov.ph',
            'password' => $password,
            'role' => 'twg',
            'office_id' => $this->office->id,
            'is_active' => true,
        ]);

        $this->fundSource = FundSource::create([
            'code' => 'GF-2026',
            'name' => 'General Fund 2026',
            'workflow_route' => 'budget',
            'is_active' => true,
        ]);

        $this->annualPpmp = Ppmp::create([
            'uuid' => (string) Str::uuid(),
            'tracking_number' => 'PMOGOODS-2026-000001',
            'ppmp_number' => '0',
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
            'title' => 'Supply and delivery of catering services',
            'fiscal_year' => '2025',
            'plan_type' => 'FINAL',
            'source_of_fund' => 'General Fund 2026',
            'fund_source_id' => $this->fundSource->id,
            'total_budget' => 300000.00,
            'status' => 'READY_TO_PRINT',
        ]);

        PpmpItem::create([
            'ppmp_id' => $this->annualPpmp->id,
            'item_no' => 1,
            'description' => 'Catering Package A',
            'project_type' => 'Goods',
            'quantity_size' => '100 pax',
            'procurement_mode' => 'Small Value Procurement',
            'start_date' => '2025-01-10',
            'end_date' => '2025-01-20',
            'delivery_period' => '10 calendar days',
            'estimated_budget' => 300000.00,
        ]);
    }

    private function createFakePdf(string $filename = 'request_letter.pdf'): UploadedFile
    {
        $content = "%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF";
        $tmpFile = tempnam(sys_get_temp_dir(), 'pdf_test');
        file_put_contents($tmpFile, $content);
        return new UploadedFile($tmpFile, $filename, 'application/pdf', null, true);
    }

    public function test_can_request_supplemental_for_continuation()
    {
        $file = $this->createFakePdf();

        $response = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$this->annualPpmp->uuid}/request-amendment-or-supplemental", [
            'request_scope' => 'PPMP_APP',
            'request_type' => 'SUPPLEMENTAL',
            'supplemental_purpose' => 'CONTINUATION',
            'reason' => 'Annual contract needs supplemental continuation for next phase.',
            'letter_file' => $file,
        ]);

        $response->assertStatus(200);

        $this->annualPpmp->refresh();
        $this->assertEquals('PENDING_APPROVAL', $this->annualPpmp->amendment_status);
        $this->assertEquals('SUPPLEMENTAL', $this->annualPpmp->requested_amendment_type);
        $this->assertEquals('CONTINUATION', $this->annualPpmp->requested_supplemental_purpose);
    }

    public function test_can_request_supplemental_with_other_and_specify()
    {
        $file = $this->createFakePdf();

        $response = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$this->annualPpmp->uuid}/request-amendment-or-supplemental", [
            'request_scope' => 'PPMP_APP',
            'request_type' => 'SUPPLEMENTAL',
            'supplemental_purpose' => 'OTHER',
            'supplemental_specify' => 'Emergency disaster response catering requirements',
            'reason' => 'Supplemental needed for emergency services.',
            'letter_file' => $file,
        ]);

        $response->assertStatus(200);

        $this->annualPpmp->refresh();
        $this->assertEquals('PENDING_APPROVAL', $this->annualPpmp->amendment_status);
        $this->assertEquals('OTHER', $this->annualPpmp->requested_supplemental_purpose);
        $this->assertEquals('Emergency disaster response catering requirements', $this->annualPpmp->requested_supplemental_specify);
    }

    public function test_request_supplemental_with_other_requires_specify_details()
    {
        $file = $this->createFakePdf();

        $response = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$this->annualPpmp->uuid}/request-amendment-or-supplemental", [
            'request_scope' => 'PPMP_APP',
            'request_type' => 'SUPPLEMENTAL',
            'supplemental_purpose' => 'OTHER',
            'supplemental_specify' => '',
            'reason' => 'Supplemental needed.',
            'letter_file' => $file,
        ]);

        $response->assertStatus(422);
    }

    public function test_admin_approving_continuation_creates_draft_with_same_tracker_current_cy_and_nulled_cells()
    {
        $file = $this->createFakePdf();

        $this->actingAs($this->endUser)->postJson("/api/ppmps/{$this->annualPpmp->uuid}/request-amendment-or-supplemental", [
            'request_scope' => 'PPMP_APP',
            'request_type' => 'SUPPLEMENTAL',
            'supplemental_purpose' => 'CONTINUATION',
            'reason' => 'Annual contract needs continuation.',
            'letter_file' => $file,
        ]);

        $response = $this->actingAs($this->adminUser)->postJson("/api/ppmps/{$this->annualPpmp->uuid}/amendment/approve");
        $response->assertStatus(200);

        $childPpmp = Ppmp::where('parent_id', $this->annualPpmp->id)->firstOrFail();

        // 1. Same tracker number
        $this->assertEquals($this->annualPpmp->tracking_number, $childPpmp->tracking_number);
        // 2. Draft status
        $this->assertEquals('DRAFT', $childPpmp->status);
        // 3. Current year fiscal year
        $this->assertEquals((string) date('Y'), $childPpmp->fiscal_year);
        // 4. Marked as continuation with baseline budget recorded
        $this->assertTrue((bool) $childPpmp->is_continuation);
        $this->assertEquals(300000.00, (float) $childPpmp->baseline_annual_budget);
        $this->assertEquals(0.00, (float) $childPpmp->total_budget);
        $this->assertNull($childPpmp->delivery_period);

        // 5. Line items: dates, delivery period, and estimated budget are null
        $item = $childPpmp->items()->firstOrFail();
        $this->assertEquals('Catering Package A', $item->description);
        $this->assertEquals('Goods', $item->project_type);
        $this->assertEquals('100 pax', $item->quantity_size);
        $this->assertNull($item->start_date);
        $this->assertNull($item->end_date);
        $this->assertNull($item->delivery_period);
        $this->assertNull($item->estimated_budget);
    }

    public function test_admin_approving_other_copies_all_cell_data_as_is()
    {
        $file = $this->createFakePdf();

        $this->actingAs($this->endUser)->postJson("/api/ppmps/{$this->annualPpmp->uuid}/request-amendment-or-supplemental", [
            'request_scope' => 'PPMP_APP',
            'request_type' => 'SUPPLEMENTAL',
            'supplemental_purpose' => 'OTHER',
            'supplemental_specify' => 'Additional batch procurement',
            'reason' => 'Supplemental for extra batch.',
            'letter_file' => $file,
        ]);

        $response = $this->actingAs($this->adminUser)->postJson("/api/ppmps/{$this->annualPpmp->uuid}/amendment/approve");
        $response->assertStatus(200);

        $childPpmp = Ppmp::where('parent_id', $this->annualPpmp->id)->firstOrFail();

        // 1. Same tracker number
        $this->assertEquals($this->annualPpmp->tracking_number, $childPpmp->tracking_number);
        $this->assertFalse((bool) $childPpmp->is_continuation);
        $this->assertEquals(300000.00, (float) $childPpmp->total_budget);

        // 2. Line items preserved
        $item = $childPpmp->items()->firstOrFail();
        $this->assertEquals('2025-01-10', $item->start_date);
        $this->assertEquals('2025-01-20', $item->end_date);
        $this->assertEquals('10 calendar days', $item->delivery_period);
        $this->assertEquals(300000.00, (float) $item->estimated_budget);
    }

    public function test_continuation_budget_cannot_exceed_baseline_annual_budget()
    {
        $file = $this->createFakePdf();

        $this->actingAs($this->endUser)->postJson("/api/ppmps/{$this->annualPpmp->uuid}/request-amendment-or-supplemental", [
            'request_scope' => 'PPMP_APP',
            'request_type' => 'SUPPLEMENTAL',
            'supplemental_purpose' => 'CONTINUATION',
            'reason' => 'Continuation request.',
            'letter_file' => $file,
        ]);

        $this->actingAs($this->adminUser)->postJson("/api/ppmps/{$this->annualPpmp->uuid}/amendment/approve");
        $childPpmp = Ppmp::where('parent_id', $this->annualPpmp->id)->firstOrFail();

        // Try updating child PPMP with 350,000 (exceeds annual baseline of 300,000)
        $response = $this->actingAs($this->endUser)->putJson("/api/ppmps/{$childPpmp->uuid}", [
            'title' => $childPpmp->title,
            'fiscal_year' => $childPpmp->fiscal_year,
            'plan_type' => 'FINAL',
            'items' => [
                [
                    'description' => 'Catering Package A Continuation',
                    'project_type' => 'Goods',
                    'quantity_size' => '150 pax',
                    'procurement_mode' => 'Small Value Procurement',
                    'start_date' => '2026-03-01',
                    'end_date' => '2026-03-10',
                    'delivery_period' => '10 calendar days',
                    'estimated_budget' => 350000.00, // Exceeds 300k
                ],
            ],
        ]);

        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['total_budget']);

        // Update with 250,000 (within 300k budget) -> Succeeds
        $responseOk = $this->actingAs($this->endUser)->putJson("/api/ppmps/{$childPpmp->uuid}", [
            'title' => $childPpmp->title,
            'fiscal_year' => $childPpmp->fiscal_year,
            'plan_type' => 'FINAL',
            'items' => [
                [
                    'description' => 'Catering Package A Continuation',
                    'project_type' => 'Goods',
                    'quantity_size' => '100 pax',
                    'procurement_mode' => 'Small Value Procurement',
                    'start_date' => '2026-03-01',
                    'end_date' => '2026-03-10',
                    'delivery_period' => '10 calendar days',
                    'estimated_budget' => 250000.00,
                ],
            ],
        ]);

        $responseOk->assertStatus(200);
        $childPpmp->refresh();
        $this->assertEquals(250000.00, (float) $childPpmp->total_budget);
    }

    public function test_continuation_submission_blocks_when_cells_are_incomplete()
    {
        $file = $this->createFakePdf();

        $this->actingAs($this->endUser)->postJson("/api/ppmps/{$this->annualPpmp->uuid}/request-amendment-or-supplemental", [
            'request_scope' => 'PPMP_APP',
            'request_type' => 'SUPPLEMENTAL',
            'supplemental_purpose' => 'CONTINUATION',
            'reason' => 'Continuation request.',
            'letter_file' => $file,
        ]);

        $this->actingAs($this->adminUser)->postJson("/api/ppmps/{$this->annualPpmp->uuid}/amendment/approve");
        $childPpmp = Ppmp::where('parent_id', $this->annualPpmp->id)->firstOrFail();

        // Attach required attachment list and market scoping mock so submission reaches continuation check
        $childPpmp->update([
            'attachment_list_data' => ['rows' => [['item_description' => 'Catering']]],
        ]);
        PpmpAttachment::create([
            'uuid' => (string) Str::uuid(),
            'ppmp_id' => $childPpmp->id,
            'uploaded_by' => $this->endUser->id,
            'original_filename' => 'market_scoping.pdf',
            'stored_filename' => 'market_scoping.pdf',
            'storage_path' => 'ppmp/dummy.pdf',
            'mime_type' => 'application/pdf',
            'attachment_type' => 'MARKET_SCOPING',
            'file_size' => 1024,
        ]);

        // Attempt submit while item cells (start_date, end_date, delivery_period, estimated_budget) are still null
        $responseIncomplete = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$childPpmp->uuid}/submit-for-review");
        $responseIncomplete->assertStatus(422);
        $this->assertStringContainsString('all item cells must be completely filled out', $responseIncomplete->json('message'));

        // Fill out all cells
        $childPpmp->items()->first()->update([
            'start_date' => '2026-04-01',
            'end_date' => '2026-04-15',
            'delivery_period' => '15 calendar days',
            'estimated_budget' => 200000.00,
        ]);
        $childPpmp->update(['total_budget' => 200000.00]);

        // Now submit succeeds
        $responseOk = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$childPpmp->uuid}/submit-for-review", [
            'twg_reviewer_id' => $this->twgUser->id,
        ]);

        $responseOk->assertStatus(200);
        $childPpmp->refresh();
        $this->assertEquals('TWG_REVIEW', $childPpmp->status);
    }

    public function test_ppmp_index_and_dashboard_return_supplemental_purpose_details()
    {
        $file = $this->createFakePdf();

        $this->actingAs($this->endUser)->postJson("/api/ppmps/{$this->annualPpmp->uuid}/request-amendment-or-supplemental", [
            'request_scope' => 'PPMP_APP',
            'request_type' => 'SUPPLEMENTAL',
            'supplemental_purpose' => 'OTHER',
            'supplemental_specify' => 'Emergency disaster response catering',
            'reason' => 'Emergency supplemental needed.',
            'letter_file' => $file,
        ]);

        // Verify index endpoint includes serialized amendment fields
        $indexRes = $this->actingAs($this->adminUser)->getJson('/api/ppmps');
        $indexRes->assertStatus(200);
        $itemData = collect($indexRes->json('data'))->firstWhere('uuid', $this->annualPpmp->uuid);
        $this->assertNotNull($itemData);
        $this->assertEquals('OTHER', $itemData['requested_supplemental_purpose']);
        $this->assertEquals('Emergency disaster response catering', $itemData['requested_supplemental_specify']);

        // Verify dashboard endpoint includes serialized amendment fields
        $dashRes = $this->actingAs($this->adminUser)->getJson('/api/dashboard');
        $dashRes->assertStatus(200);
        $pendingItem = collect($dashRes->json('pending_amendments'))->firstWhere('uuid', $this->annualPpmp->uuid);
        $this->assertNotNull($pendingItem);
        $this->assertEquals('OTHER', $pendingItem['requested_supplemental_purpose']);
        $this->assertEquals('Emergency disaster response catering', $pendingItem['requested_supplemental_specify']);
    }
}
