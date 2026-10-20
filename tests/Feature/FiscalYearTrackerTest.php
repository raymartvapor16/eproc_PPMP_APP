<?php

namespace Tests\Feature;

use Tests\TestCase;
use App\Models\User;
use App\Models\Office;
use App\Models\Ppmp;
use Illuminate\Foundation\Testing\RefreshDatabase;

class FiscalYearTrackerTest extends TestCase
{
    use RefreshDatabase;

    private User $endUser;
    private Office $office;

    protected function setUp(): void
    {
        parent::setUp();

        $this->office = Office::create([
            'name' => 'Provincial Information Office',
            'code' => 'PIO',
            'head_user_id' => null,
        ]);

        $this->endUser = User::factory()->create([
            'role' => 'end_user',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
    }

    public function test_tracker_number_bases_on_fiscal_year_input(): void
    {
        // 1. Create PPMP with fiscal year 2028
        $res = $this->actingAs($this->endUser)->postJson('/api/ppmps', [
            'title' => 'Project for Year 2028',
            'fiscal_year' => '2028',
            'plan_type' => 'FINAL',
            'items' => [
                [
                    'description' => 'Test Item 2028',
                    'project_type' => 'Goods',
                    'estimated_budget' => 50000,
                ],
            ],
        ]);

        $res->assertStatus(201);
        $this->assertEquals('PIOGOODS-2028-000001', $res->json('ppmp.tracking_number'));
        $this->assertEquals('2028', $res->json('ppmp.fiscal_year'));
        $uuid = $res->json('ppmp.uuid');

        // 2. Create PPMP with "CY 2029" formatted input - should sanitize and base tracker on 2029
        $res2 = $this->actingAs($this->endUser)->postJson('/api/ppmps', [
            'title' => 'Project for Year 2029',
            'fiscal_year' => 'CY 2029',
            'plan_type' => 'INDICATIVE',
            'items' => [
                [
                    'description' => 'Test Item 2029',
                    'project_type' => 'Goods',
                    'estimated_budget' => 60000,
                ],
            ],
        ]);

        $res2->assertStatus(201);
        $this->assertEquals('PIOGOODS-2029-000001', $res2->json('ppmp.tracking_number'));
        $this->assertEquals('2029', $res2->json('ppmp.fiscal_year'));

        // 3. Update PPMP 1 from 2028 to 2030 - tracker number must update to 2030
        $updateRes = $this->actingAs($this->endUser)->putJson("/api/ppmps/{$uuid}", [
            'title' => 'Project for Year 2028 updated to 2030',
            'fiscal_year' => '2030',
            'plan_type' => 'FINAL',
            'items' => [
                [
                    'description' => 'Test Item 2030',
                    'project_type' => 'Goods',
                    'estimated_budget' => 75000,
                ],
            ],
        ]);

        $updateRes->assertStatus(200);
        $this->assertEquals('PIOGOODS-2030-000001', $updateRes->json('ppmp.tracking_number'));
        $this->assertEquals('2030', $updateRes->json('ppmp.fiscal_year'));

        // 4. Verify index endpoint returns available_fiscal_years
        $listRes = $this->actingAs($this->endUser)->getJson('/api/ppmps');
        $listRes->assertStatus(200);
        $this->assertArrayHasKey('available_fiscal_years', $listRes->json());
        $this->assertContains('2029', $listRes->json('available_fiscal_years'));
        $this->assertContains('2030', $listRes->json('available_fiscal_years'));
    }
}
