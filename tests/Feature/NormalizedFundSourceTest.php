<?php

namespace Tests\Feature;

use App\Models\FundSource;
use App\Models\Office;
use App\Models\Ppmp;
use App\Models\PpmpItem;
use App\Models\User;
use Database\Seeders\FundSourceSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Tests\TestCase;

class NormalizedFundSourceTest extends TestCase
{
    use RefreshDatabase;

    protected User $adminUser;
    protected User $endUser;
    protected Office $office;

    protected function setUp(): void
    {
        parent::setUp();

        $this->office = Office::create([
            'name' => 'Provincial Planning and Development Office',
            'code' => 'PPDO',
        ]);

        $this->adminUser = User::factory()->create([
            'role' => 'admin',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $this->endUser = User::factory()->create([
            'role' => 'end_user',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
    }

    /**
     * Test schema normalization has all required columns.
     */
    public function test_schema_has_normalized_columns_and_foreign_keys()
    {
        $this->assertTrue(Schema::hasColumn('fund_sources', 'category'));
        $this->assertTrue(Schema::hasColumn('ppmps', 'fund_source_id'));
        $this->assertTrue(Schema::hasColumn('ppmp_items', 'fund_source_id'));
    }

    /**
     * Test FundSourceSeeder populates Trust Funds and General/Special Funds.
     */
    public function test_seeder_populates_trust_and_general_funds()
    {
        $this->seed(FundSourceSeeder::class);

        // Verify Trust Fund from Excel is present with pacco route
        $this->assertDatabaseHas('fund_sources', [
            'name' => 'PENRO CY 2026',
            'category' => 'Trust Fund',
            'workflow_route' => 'pacco',
        ]);

        // Verify General Fund from Excel is present with budget route
        $this->assertDatabaseHas('fund_sources', [
            'name' => 'CY (Customize year e.g, 2026) General fund',
            'category' => 'General Fund',
            'workflow_route' => 'budget',
        ]);

        // Verify total seeded count
        $trustFundCount = FundSource::where('category', 'Trust Fund')->count();
        $this->assertGreaterThanOrEqual(40, $trustFundCount);
    }

    /**
     * Test Eloquent relationships between FundSource, Ppmp, and PpmpItem.
     */
    public function test_eloquent_relationships_work_correctly()
    {
        $fund = FundSource::create([
            'name' => 'Test Medical Trust Fund',
            'category' => 'Trust Fund',
            'workflow_route' => 'pacco',
            'is_active' => true,
        ]);

        $ppmp = Ppmp::create([
            'uuid' => (string) Str::uuid(),
            'ppmp_number' => 'PPMP-2026-TEST-001',
            'title' => 'Health Supplies PPMP 2026',
            'fiscal_year' => '2026',
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
            'prepared_by' => $this->endUser->id,
            'status' => 'draft',
            'stage' => 'preparation',
            'source_of_fund' => $fund->name,
            'fund_source_id' => $fund->id,
        ]);

        $item = PpmpItem::create([
            'ppmp_id' => $ppmp->id,
            'item_no' => 1,
            'description' => 'Surgical Masks 50pcs/box',
            'quantity_size' => '100 boxes',
            'estimated_budget' => 5000.00,
            'source_of_fund' => $fund->name,
            'fund_source_id' => $fund->id,
        ]);

        // Test Ppmp relationship to FundSource
        $this->assertNotNull($ppmp->fundSourceRef);
        $this->assertEquals($fund->id, $ppmp->fundSourceRef->id);
        $this->assertTrue($ppmp->isTrustFund());

        // Test PpmpItem relationship to FundSource
        $this->assertNotNull($item->fundSource);
        $this->assertEquals($fund->id, $item->fundSource->id);

        // Test FundSource inverse relationships
        $this->assertTrue($fund->ppmps->contains($ppmp));
        $this->assertTrue($fund->ppmpItems->contains($item));
    }

    /**
     * Test API filtering by category.
     */
    public function test_api_filtering_by_category()
    {
        FundSource::create([
            'name' => 'General Allocation Fund',
            'category' => 'General Fund',
            'workflow_route' => 'budget',
            'is_active' => true,
        ]);

        FundSource::create([
            'name' => 'Provincial Agriculture Trust',
            'category' => 'Trust Fund',
            'workflow_route' => 'pacco',
            'is_active' => true,
        ]);

        // Filter by Trust Fund
        $response = $this->actingAs($this->endUser)
            ->getJson('/api/fund-sources?category=Trust Fund');

        $response->assertStatus(200);
        $items = $response->json();
        foreach ($items as $item) {
            $this->assertEquals('Trust Fund', $item['category']);
        }
    }

    /**
     * Test Admin can export fund sources to CSV with UTF-8 BOM.
     */
    public function test_admin_can_export_fund_sources_to_csv()
    {
        $this->seed(FundSourceSeeder::class);

        $response = $this->actingAs($this->adminUser)
            ->get('/api/fund-sources/export');

        $response->assertStatus(200);
        $response->assertHeader('Content-Type', 'text/csv; charset=UTF-8');

        $content = $response->streamedContent();
        $this->assertStringContainsString('ID,"Source of Fund Name",Code,Category,"Review Route",Status,"PPMP Usage Count",Description,"Display Order"', $content);
        $this->assertStringContainsString('PENRO CY 2026', $content);
        $this->assertStringContainsString('CY (Customize year e.g, 2026) General fund', $content);
    }

    /**
     * Test Non-Admin cannot export fund sources.
     */
    public function test_non_admin_cannot_export_fund_sources()
    {
        $response = $this->actingAs($this->endUser)
            ->get('/api/fund-sources/export');

        $response->assertStatus(403);
    }

    /**
     * Test PPMP creation with fund_source_id synchronizes properly.
     */
    public function test_ppmp_creation_with_fund_source_id()
    {
        $fund = FundSource::create([
            'name' => 'Special Education Fund 2026',
            'category' => 'Special Fund',
            'workflow_route' => 'budget',
            'is_active' => true,
        ]);

        $payload = [
            'title' => 'School Board Equipment 2026',
            'fiscal_year' => '2026',
            'plan_type' => 'INDICATIVE',
            'fund_source_id' => $fund->id,
            'source_of_fund' => $fund->name,
            'status' => 'draft',
            'stage' => 'preparation',
            'items' => [
                [
                    'item_code' => 'IT-001',
                    'item_name' => 'Desktop Computer',
                    'description' => 'Workstation desktop computer with monitor',
                    'quantity' => 5,
                    'unit_price' => 35000,
                    'estimated_budget' => 175000,
                    'fund_source_id' => $fund->id,
                    'source_of_fund' => $fund->name,
                ]
            ]
        ];

        $response = $this->actingAs($this->endUser)
            ->postJson('/api/ppmps', $payload);

        $response->assertStatus(201);
        $ppmpId = $response->json('ppmp.id');

        $this->assertDatabaseHas('ppmps', [
            'id' => $ppmpId,
            'fund_source_id' => $fund->id,
            'source_of_fund' => 'Special Education Fund 2026',
        ]);

        $this->assertDatabaseHas('ppmp_items', [
            'ppmp_id' => $ppmpId,
            'fund_source_id' => $fund->id,
            'source_of_fund' => 'Special Education Fund 2026',
        ]);
    }

    /**
     * Test Budget Officer and PACCO Reviewer can manage (create, update, delete, export) fund sources.
     */
    public function test_budget_officer_and_pacco_reviewers_can_manage_fund_sources()
    {
        $budgetOfficer = User::factory()->create([
            'role' => 'budget_officer',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $paccoReviewer = User::factory()->create([
            'role' => 'pacco',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        // 1. Budget Officer creates a General Fund source
        $budgetRes = $this->actingAs($budgetOfficer)
            ->postJson('/api/fund-sources', [
                'name' => 'Provincial Disaster Management Fund 2026',
                'code' => 'PDMF-2026',
                'category' => 'General Fund',
                'workflow_route' => 'budget',
                'description' => 'Disaster risk reduction and management funds',
            ]);

        $budgetRes->assertStatus(201);
        $fundId = $budgetRes->json('fund_source.id');

        $this->assertDatabaseHas('fund_sources', [
            'id' => $fundId,
            'name' => 'Provincial Disaster Management Fund 2026',
            'workflow_route' => 'budget',
        ]);

        // 2. PACCO Reviewer updates the fund source
        $paccoUpdateRes = $this->actingAs($paccoReviewer)
            ->putJson("/api/fund-sources/{$fundId}", [
                'name' => 'Provincial Disaster Management Fund 2026 (Updated)',
                'code' => 'PDMF-REV',
                'category' => 'General Fund',
                'workflow_route' => 'budget',
                'description' => 'Updated by PACCO Reviewer',
            ]);

        $paccoUpdateRes->assertStatus(200);
        $this->assertDatabaseHas('fund_sources', [
            'id' => $fundId,
            'name' => 'Provincial Disaster Management Fund 2026 (Updated)',
            'code' => 'PDMF-REV',
        ]);

        // 3. PACCO Reviewer exports fund sources to CSV
        $paccoExportRes = $this->actingAs($paccoReviewer)
            ->get('/api/fund-sources/export');

        $paccoExportRes->assertStatus(200);
        $paccoExportRes->assertHeader('Content-Type', 'text/csv; charset=UTF-8');

        // 4. Budget Officer exports fund sources to CSV
        $budgetExportRes = $this->actingAs($budgetOfficer)
            ->get('/api/fund-sources/export');

        $budgetExportRes->assertStatus(200);

        // 5. Budget Officer deletes the fund source (not referenced by PPMP)
        $deleteRes = $this->actingAs($budgetOfficer)
            ->deleteJson("/api/fund-sources/{$fundId}");

        $deleteRes->assertStatus(200);
        $this->assertDatabaseMissing('fund_sources', [
            'id' => $fundId,
        ]);
    }
}
