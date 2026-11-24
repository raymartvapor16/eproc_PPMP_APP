<?php

namespace Tests\Feature;

use App\Models\AccountCode;
use App\Models\Office;
use App\Models\Ppmp;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Tests\TestCase;

class AccountCodeManagementTest extends TestCase
{
    use RefreshDatabase;

    protected User $adminUser;
    protected User $superAdminUser;
    protected User $endUser;
    protected Office $office;
    protected AccountCode $accountCode;

    protected function setUp(): void
    {
        parent::setUp();

        $password = Hash::make('password123');

        $this->office = Office::firstOrCreate(
            ['code' => 'ACC-OFFICE'],
            ['name' => 'Account Test Office']
        );

        $this->adminUser = User::firstOrCreate(
            ['email' => 'admin_acc@example.test'],
            ['name' => 'Admin User', 'password' => $password, 'role' => 'admin', 'is_active' => true]
        );

        $this->superAdminUser = User::firstOrCreate(
            ['email' => 'super_acc@example.test'],
            ['name' => 'Super Admin User', 'password' => $password, 'role' => 'super_admin', 'is_active' => true]
        );

        $this->endUser = User::firstOrCreate(
            ['email' => 'end_acc@example.test'],
            ['name' => 'End User', 'password' => $password, 'role' => 'end_user', 'office_id' => $this->office->id, 'is_active' => true]
        );

        $this->accountCode = AccountCode::create([
            'code' => '5-02-03-220',
            'name' => 'Semi-Expendable Furniture, Fixtures and Books Expenses',
            'account_class' => 'Expenses',
            'full_description' => '5-02-03-220 • Semi-Expendable Furniture, Fixtures and Books Expenses',
            'is_active' => true,
            'display_order' => 1,
        ]);
    }

    public function test_admin_and_super_admin_can_list_paginated_account_codes(): void
    {
        AccountCode::create([
            'code' => '1-01-01-010',
            'name' => 'Cash Local Treasury',
            'account_class' => 'Assets',
            'full_description' => '1-01-01-010 • Cash Local Treasury',
            'is_active' => true,
        ]);

        $res = $this->actingAs($this->adminUser)->getJson('/api/account-codes?per_page=10');
        $res->assertOk();
        $res->assertJsonStructure([
            'data',
            'current_page',
            'last_page',
            'per_page',
            'total',
        ]);
        $this->assertGreaterThanOrEqual(2, $res->json('total'));

        $resClass = $this->actingAs($this->adminUser)->getJson('/api/account-codes?class=Assets');
        $resClass->assertOk();
        foreach ($resClass->json('data') as $item) {
            $this->assertEquals('Assets', $item['account_class']);
        }

        $resSearch = $this->actingAs($this->adminUser)->getJson('/api/account-codes?search=5-02-03-220');
        $resSearch->assertOk();
        $this->assertCount(1, $resSearch->json('data'));
        $this->assertEquals('5-02-03-220', $resSearch->json('data.0.code'));

        $resStats = $this->actingAs($this->superAdminUser)->getJson('/api/account-codes/stats');
        $resStats->assertOk();
        $resStats->assertJsonStructure(['total', 'active', 'inactive', 'classes', 'total_ppmps_linked']);
    }

    public function test_admin_can_create_account_code_and_prevents_duplicate(): void
    {
        $payload = [
            'code' => '5-02-03-010',
            'name' => 'Office Supplies Expenses',
            'account_class' => 'Expenses',
            'is_active' => true,
        ];

        $res = $this->actingAs($this->adminUser)->postJson('/api/account-codes', $payload);
        $res->assertStatus(201);
        $this->assertDatabaseHas('account_codes', [
            'code' => '5-02-03-010',
            'name' => 'Office Supplies Expenses',
            'account_class' => 'Expenses',
        ]);

        $dupRes = $this->actingAs($this->adminUser)->postJson('/api/account-codes', $payload);
        $dupRes->assertStatus(422);
    }

    public function test_admin_can_update_and_toggle_status(): void
    {
        $updateRes = $this->actingAs($this->adminUser)->putJson("/api/account-codes/{$this->accountCode->id}", [
            'code' => '5-02-03-220',
            'name' => 'Updated Semi-Expendable Supplies Expenses',
            'account_class' => 'Expenses',
            'display_order' => 5,
        ]);

        $updateRes->assertOk();
        $this->assertEquals('Updated Semi-Expendable Supplies Expenses', $this->accountCode->fresh()->name);
        $this->assertEquals(5, $this->accountCode->fresh()->display_order);

        $toggleRes = $this->actingAs($this->adminUser)->patchJson("/api/account-codes/{$this->accountCode->id}/toggle-status");
        $toggleRes->assertOk();
        $this->assertFalse($this->accountCode->fresh()->is_active);

        $toggleRes2 = $this->actingAs($this->adminUser)->patchJson("/api/account-codes/{$this->accountCode->id}/toggle-status");
        $toggleRes2->assertOk();
        $this->assertTrue($this->accountCode->fresh()->is_active);
    }

    public function test_cannot_delete_account_code_linked_to_ppmp(): void
    {
        $ppmp = Ppmp::create([
            'uuid' => (string) Str::uuid(),
            'tracking_number' => 'ACC-TEST-001',
            'ppmp_number' => '1',
            'office_id' => $this->office->id,
            'created_by' => $this->endUser->id,
            'title' => 'Test PPMP for Account Code',
            'account_code' => '5-02-03-220',
            'account_code_id' => $this->accountCode->id,
            'fiscal_year' => '2026',
            'plan_type' => 'INDICATIVE',
            'status' => 'DRAFT',
            'total_budget' => 50000,
        ]);

        $delRes = $this->actingAs($this->adminUser)->deleteJson("/api/account-codes/{$this->accountCode->id}");
        $delRes->assertStatus(422);
        $delRes->assertJsonFragment([
            'message' => "Cannot delete account code [{$this->accountCode->code}] {$this->accountCode->name} because it is currently linked to 1 PPMP record(s). You can deactivate it instead to prevent new selections."
        ]);

        $ppmp->update(['account_code_id' => null]);
        $delSuccessRes = $this->actingAs($this->adminUser)->deleteJson("/api/account-codes/{$this->accountCode->id}");
        $delSuccessRes->assertOk();
        $this->assertDatabaseMissing('account_codes', ['id' => $this->accountCode->id]);
    }

    public function test_non_admin_cannot_manage_account_codes(): void
    {
        $this->actingAs($this->endUser)->postJson('/api/account-codes', [
            'code' => '5-00-00-000',
            'name' => 'Unauthorized Code',
        ])->assertStatus(403);

        $this->actingAs($this->endUser)->putJson("/api/account-codes/{$this->accountCode->id}", [
            'name' => 'Hacked Code',
        ])->assertStatus(403);

        $this->actingAs($this->endUser)->deleteJson("/api/account-codes/{$this->accountCode->id}")
            ->assertStatus(403);
    }

    public function test_end_user_can_fetch_dropdown_and_ppmp_links_account_code(): void
    {

        $res = $this->actingAs($this->endUser)->getJson('/api/account-codes?dropdown=1');
        $res->assertOk();
        $this->assertIsArray($res->json());
        $this->assertTrue(collect($res->json())->contains('id', $this->accountCode->id));

        $createRes = $this->actingAs($this->endUser)->postJson('/api/ppmps', [
            'title' => 'Procurement of IT Supplies',
            'account_code_id' => $this->accountCode->id,
            'source_of_fund' => 'General Fund',
            'fiscal_year' => '2026',
            'plan_type' => 'INDICATIVE',
            'items' => [
                [
                    'description' => 'Office Chair',
                    'project_type' => 'Goods',
                    'quantity_size' => '10 units',
                    'procurement_mode' => 'Small Value Procurement (RA 12009)',
                    'estimated_budget' => 25000,
                ],
            ],
        ]);

        $createRes->assertStatus(201);
        $ppmpUuid = $createRes->json('ppmp.uuid') ?? $createRes->json('data.uuid');
        $this->assertNotEmpty($ppmpUuid, 'Failed to retrieve PPMP UUID from response: ' . $createRes->getContent());
        $ppmp = Ppmp::where('uuid', $ppmpUuid)->firstOrFail();

        $this->assertEquals($this->accountCode->id, $ppmp->account_code_id);
        $this->assertNotNull($ppmp->accountCodeRef);
        $this->assertEquals('5-02-03-220', $ppmp->accountCodeRef->code);
    }
}
