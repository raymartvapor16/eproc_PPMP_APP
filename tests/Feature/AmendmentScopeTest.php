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

class AmendmentScopeTest extends TestCase
{
    use RefreshDatabase;

    protected User $adminUser;
    protected User $endUser;
    protected Office $office;
    protected Ppmp $ppmpReady;

    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');

        $this->office = Office::create([
            'code' => 'OFFICE-MAIN',
            'name' => 'Main Engineering Office',
        ]);

        $password = Hash::make('password123');

        $this->adminUser = User::create([
            'name' => 'Administrator',
            'email' => 'admin@example.test',
            'password' => $password,
            'role' => 'admin',
            'office_id' => $this->office->id,
            'is_active' => true,
        ]);

        $this->endUser = User::create([
            'name' => 'Engineer John',
            'email' => 'john@example.test',
            'password' => $password,
            'role' => 'end_user',
            'office_id' => $this->office->id,
            'is_active' => true,
        ]);

        $this->ppmpReady = Ppmp::create([
            'uuid' => (string) Str::uuid(),
            'tracking_number' => 'TRK-2026-0001',
            'ppmp_number' => '1',
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
            'title' => 'Office Laptop & Server Procurement',
            'fiscal_year' => '2026',
            'plan_type' => 'FINAL',
            'total_budget' => 500000.00,
            'status' => 'READY_TO_PRINT',
        ]);

        PpmpItem::create([
            'ppmp_id' => $this->ppmpReady->id,
            'item_no' => 1,
            'description' => 'Server Rack Mount',
            'estimated_budget' => 500000.00,
        ]);
    }

    private function createFakePdf(string $filename = 'request_letter.pdf'): UploadedFile
    {
        $content = "%PDF-1.4\n%âãÏÓ\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF";
        $tmpFile = tempnam(sys_get_temp_dir(), 'pdf_test');
        file_put_contents($tmpFile, $content);
        return new UploadedFile($tmpFile, $filename, 'application/pdf', null, true);
    }

    public function test_can_request_ppmp_app_only_scope()
    {
        $file = $this->createFakePdf();

        $response = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$this->ppmpReady->uuid}/request-amendment-or-supplemental", [
            'request_scope' => 'PPMP_APP',
            'request_type' => 'SUPPLEMENTAL',
            'reason' => 'Need to add additional backup power supplies.',
            'letter_file' => $file,
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('ppmp_amendments', [
            'ppmp_id' => $this->ppmpReady->id,
            'amendment_status' => 'PENDING_APPROVAL',
            'requested_amendment_scope' => 'PPMP_APP',
            'requested_amendment_type' => 'SUPPLEMENTAL',
        ]);
    }

    public function test_can_request_attachment_list_only_scope()
    {
        $file = $this->createFakePdf();

        $response = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$this->ppmpReady->uuid}/request-amendment-or-supplemental", [
            'request_scope' => 'ATTACHMENT_LIST',
            'request_type' => 'AMENDMENT',
            'reason' => 'Need to update unit quantities in standard attachment sheet.',
            'letter_file' => $file,
        ]);

        $response->assertStatus(200);
        $this->assertDatabaseHas('ppmp_amendments', [
            'ppmp_id' => $this->ppmpReady->id,
            'amendment_status' => 'PENDING_APPROVAL',
            'requested_amendment_scope' => 'ATTACHMENT_LIST',
        ]);
    }

    public function test_admin_approval_propagates_scope_and_enforces_boundaries()
    {
        $file = $this->createFakePdf();

        // Ensure baseline PPMP has an approved APP
        $this->ppmpReady->update([
            'app_data' => [
                'is_generated' => true,
                'needs_regeneration' => false,
                'rows' => [['itemNo' => 1, 'projectTitle' => 'Existing Approved APP', 'estimatedBudget' => 500000.00]],
            ],
        ]);

        // End user requests ATTACHMENT_LIST only
        $this->actingAs($this->endUser)->postJson("/api/ppmps/{$this->ppmpReady->uuid}/request-amendment-or-supplemental", [
            'request_scope' => 'ATTACHMENT_LIST',
            'request_type' => 'AMENDMENT',
            'reason' => 'Updating attachment specifications only.',
            'letter_file' => $file,
        ]);

        // Admin approves
        $approveRes = $this->actingAs($this->adminUser)->postJson("/api/ppmps/{$this->ppmpReady->uuid}/amendment/approve");
        $approveRes->assertStatus(200);

        // Does NOT create a child PPMP in DRAFT
        $this->assertEquals(0, Ppmp::where('parent_id', $this->ppmpReady->id)->count());

        // Reopens the current PPMP in DRAFT with ATTACHMENT_LIST scope
        $ppmp = $this->ppmpReady->fresh();
        $this->assertEquals('ATTACHMENT_LIST', $ppmp->amendment_scope);
        $this->assertEquals('DRAFT', $ppmp->status);

        // Existing APP remains intact, generated, and NOT flagged for regeneration
        $this->assertTrue($ppmp->hasAppGenerated());
        $this->assertFalse($ppmp->app_data['needs_regeneration'] ?? true);
        $this->assertEquals('Existing Approved APP', $ppmp->app_data['rows'][0]['projectTitle']);

        // Attempting to modify or regenerate the APP should be blocked
        $oppmoUser = User::create([
            'name' => 'OPPMO User',
            'email' => 'oppmo.test@example.test',
            'password' => bcrypt('password123'),
            'role' => 'oppmo',
            'office_id' => $this->office->id,
            'is_active' => true,
        ]);
        $appRegenRes = $this->actingAs($oppmoUser)->postJson("/api/ppmps/{$ppmp->uuid}/app-data", [
            'rows' => [['itemNo' => 1, 'projectTitle' => 'Should fail']]
        ]);
        $appRegenRes->assertStatus(403);
        $appRegenRes->assertJsonFragment([
            'message' => 'The Annual Procurement Plan (APP) cannot be modified or regenerated for this revision. The approved request scope is restricted to the PPMP List of Attachment only.'
        ]);

        // Attempting to update PPMP items on the reopened PPMP should be forbidden by scope lock
        $itemUpdateRes = $this->actingAs($this->endUser)->putJson("/api/ppmps/{$ppmp->uuid}", [
            'title' => 'Altered Title',
            'fiscal_year' => '2026',
            'plan_type' => 'FINAL',
            'items' => [
                ['description' => 'Hacked Item', 'estimated_budget' => 999999],
            ],
        ]);
        $itemUpdateRes->assertStatus(403);
        $itemUpdateRes->assertJsonFragment([
            'message' => 'PPMP items and plan details cannot be modified for this revision. The approved request scope is restricted to the PPMP List of Attachment only.'
        ]);

        // Updating attachment list should succeed
        $attSaveRes = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$ppmp->uuid}/attachment-list", [
            'rows' => [
                ['itemNo' => 1, 'unit' => 'lot', 'description' => 'Valid Attachment Update', 'qty' => 1, 'unitCost' => 5000, 'totalCost' => 5000]
            ],
        ]);
        $attSaveRes->assertStatus(200);

        // Attach fake market scoping pdf to allow submission
        $scopingFile = $this->createFakePdf('scoping.pdf');
        $this->actingAs($this->endUser)->postJson("/api/ppmps/{$ppmp->uuid}/attachments", [
            'file' => $scopingFile,
            'attachment_type' => 'MARKET_SCOPING',
        ])->assertStatus(201);

        // Submitting for review routes directly to TWG_REVIEW
        $submitRes = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$ppmp->uuid}/submit-for-review");
        $submitRes->assertStatus(200);
        $this->assertEquals('TWG_REVIEW', $ppmp->fresh()->status);

        // Create TWG User and approve
        $twgUser = User::create([
            'name' => 'TWG Reviewer Eng',
            'email' => 'twg.eng@example.test',
            'password' => bcrypt('password123'),
            'role' => 'twg',
            'office_id' => $this->office->id,
            'is_active' => true,
        ]);

        $twgApproveRes = $this->actingAs($twgUser)->postJson("/api/ppmps/{$ppmp->uuid}/twg/approve");
        $twgApproveRes->assertStatus(200);

        // TWG approval moves ATTACHMENT_LIST scope directly to READY_TO_PRINT
        $this->assertEquals('READY_TO_PRINT', $ppmp->fresh()->status);
        $this->assertNotNull($ppmp->fresh()->ready_to_print_at);
    }

    public function test_ppmp_app_only_scope_locks_attachment_list()
    {
        $file = $this->createFakePdf();

        // End user requests PPMP_APP only
        $this->actingAs($this->endUser)->postJson("/api/ppmps/{$this->ppmpReady->uuid}/request-amendment-or-supplemental", [
            'request_scope' => 'PPMP_APP',
            'request_type' => 'SUPPLEMENTAL',
            'reason' => 'Adding item 2.',
            'letter_file' => $file,
        ]);

        // Admin approves
        $approveRes = $this->actingAs($this->adminUser)->postJson("/api/ppmps/{$this->ppmpReady->uuid}/amendment/approve");
        $approveRes->assertStatus(200);

        $child = Ppmp::where('parent_id', $this->ppmpReady->id)->first();
        $this->assertNotNull($child);
        $this->assertEquals('PPMP_APP', $child->amendment_scope);

        // Updating attachment list should be forbidden by scope lock
        $attSaveRes = $this->actingAs($this->endUser)->postJson("/api/ppmps/{$child->uuid}/attachment-list", [
            'rows' => [
                ['itemNo' => 1, 'description' => 'Should fail']
            ],
        ]);
        $attSaveRes->assertStatus(403);
        $attSaveRes->assertJsonFragment([
            'message' => 'PPMP List of Attachment cannot be modified for this revision. The approved request scope is restricted to PPMP/APP procurement items only.'
        ]);
    }
}
