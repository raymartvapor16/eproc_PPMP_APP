<?php

namespace Tests\Feature;

use App\Models\AccountCode;
use App\Models\Office;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class TwgAccountCodeAssignmentTest extends TestCase
{
    use RefreshDatabase;

    protected User $admin;
    protected User $superAdmin;
    protected User $regularUser;
    protected Office $office;
    protected AccountCode $accountCode1;
    protected AccountCode $accountCode2;
    protected AccountCode $accountCode3;

    protected function setUp(): void
    {
        parent::setUp();

        $this->office = Office::create([
            'name' => 'Provincial General Services Office',
            'code' => 'PGSO',
            'is_active' => true,
        ]);

        $this->admin = User::create([
            'name' => 'System Admin',
            'email' => 'admin@davaodelsur.gov.ph',
            'password' => bcrypt('Password123!'),
            'role' => 'admin',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $this->superAdmin = User::create([
            'name' => 'Super Admin',
            'email' => 'superadmin@davaodelsur.gov.ph',
            'password' => bcrypt('Password123!'),
            'role' => 'super_admin',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $this->regularUser = User::create([
            'name' => 'Regular User',
            'email' => 'enduser@davaodelsur.gov.ph',
            'password' => bcrypt('Password123!'),
            'role' => 'end_user',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $this->accountCode1 = AccountCode::create([
            'code' => '5-02-03-010',
            'name' => 'Office Supplies Expenses',
            'account_class' => 'Expenses',
            'is_active' => true,
        ]);

        $this->accountCode2 = AccountCode::create([
            'code' => '5-02-03-220',
            'name' => 'Semi-Expendable Furnitures',
            'account_class' => 'Expenses',
            'is_active' => true,
        ]);

        $this->accountCode3 = AccountCode::create([
            'code' => '1-07-05-020',
            'name' => 'Office Equipment',
            'account_class' => 'Assets',
            'is_active' => true,
        ]);
    }

    public function test_public_account_codes_endpoint_returns_active_codes(): void
    {
        $response = $this->getJson('/api/public-account-codes');

        $response->assertStatus(200)
            ->assertJsonStructure([
                '*' => ['id', 'code', 'name', 'account_class', 'parent_name']
            ]);

        $this->assertCount(3, $response->json());
    }

    public function test_twg_reviewer_self_registration_with_account_codes(): void
    {
        $payload = [
            'name' => 'TWG Specialist',
            'email' => 'twg.specialist@davaodelsur.gov.ph',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'role' => 'twg',
            'office_id' => $this->office->id,
            'phone_number' => '09123456789',
            'address' => 'Matti, Digos City',
            'designation' => 'Technical Evaluator',
            'signature' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            'accessible_systems' => ['/eprocrementppmpapp'],
            'account_code_ids' => [$this->accountCode1->id, $this->accountCode2->id],
        ];

        $response = $this->postJson('/api/register', $payload);

        $response->assertStatus(201);
        $this->assertDatabaseHas('users', [
            'email' => 'twg.specialist@davaodelsur.gov.ph',
            'role' => 'twg',
        ]);

        $user = User::where('email', 'twg.specialist@davaodelsur.gov.ph')->first();
        $this->assertNotNull($user);
        $this->assertCount(2, $user->accountCodes);
        $this->assertTrue($user->accountCodes->contains('id', $this->accountCode1->id));
        $this->assertTrue($user->accountCodes->contains('id', $this->accountCode2->id));
    }

    public function test_twg_reviewer_self_registration_with_json_string_account_codes(): void
    {
        // Simulating FormData multipart upload where array becomes JSON string
        $payload = [
            'name' => 'TWG Specialist 2',
            'email' => 'twg2@davaodelsur.gov.ph',
            'password' => 'Password123!',
            'password_confirmation' => 'Password123!',
            'role' => 'twg',
            'office_id' => $this->office->id,
            'phone_number' => '09987654321',
            'address' => 'Digos City, Davao del Sur',
            'designation' => 'Technical Evaluator',
            'signature' => 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
            'accessible_systems' => json_encode(['/eprocrementppmpapp']),
            'account_code_ids' => json_encode([$this->accountCode3->id]),
        ];

        $response = $this->postJson('/api/register', $payload);

        $response->assertStatus(201);
        $user = User::where('email', 'twg2@davaodelsur.gov.ph')->first();
        $this->assertNotNull($user);
        $this->assertCount(1, $user->accountCodes);
        $this->assertTrue($user->accountCodes->contains('id', $this->accountCode3->id));
    }

    public function test_admin_creating_twg_reviewer_with_assigned_account_codes(): void
    {
        $payload = [
            'name' => 'Admin Created TWG',
            'email' => 'twg.admincreated@davaodelsur.gov.ph',
            'password' => 'Password123!',
            'role' => 'twg',
            'office_id' => $this->office->id,
            'designation' => 'Engineer III',
            'accessible_systems' => ['/eprocrementppmpapp'],
            'account_code_ids' => [$this->accountCode1->id, $this->accountCode3->id],
        ];

        $response = $this->actingAs($this->admin)->postJson('/api/users', $payload);

        $response->assertStatus(201);
        $user = User::where('email', 'twg.admincreated@davaodelsur.gov.ph')->first();
        $this->assertNotNull($user);
        $this->assertCount(2, $user->accountCodes);
    }

    public function test_admin_can_update_twg_assigned_account_codes(): void
    {
        $twgUser = User::create([
            'name' => 'TWG Target',
            'email' => 'twg.target@davaodelsur.gov.ph',
            'password' => bcrypt('Password123!'),
            'role' => 'twg',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        $twgUser->accountCodes()->sync([$this->accountCode1->id]);

        $this->assertCount(1, $twgUser->fresh()->accountCodes);

        // Admin updates assignments to accountCode2 and accountCode3
        $response = $this->actingAs($this->admin)->putJson("/api/users/{$twgUser->id}/account-codes", [
            'account_code_ids' => [$this->accountCode2->id, $this->accountCode3->id],
        ]);

        $response->assertStatus(200)
            ->assertJsonPath('message', 'Assigned account codes for TWG Target have been updated successfully.');

        $this->assertCount(2, $twgUser->fresh()->accountCodes);
        $this->assertFalse($twgUser->fresh()->accountCodes->contains('id', $this->accountCode1->id));
        $this->assertTrue($twgUser->fresh()->accountCodes->contains('id', $this->accountCode2->id));
        $this->assertTrue($twgUser->fresh()->accountCodes->contains('id', $this->accountCode3->id));
    }

    public function test_regular_user_cannot_update_account_codes(): void
    {
        $twgUser = User::create([
            'name' => 'TWG Test',
            'email' => 'twg.test@davaodelsur.gov.ph',
            'password' => bcrypt('Password123!'),
            'role' => 'twg',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $response = $this->actingAs($this->regularUser)->putJson("/api/users/{$twgUser->id}/account-codes", [
            'account_code_ids' => [$this->accountCode1->id],
        ]);

        $response->assertStatus(403);
    }

    public function test_admin_can_fetch_twg_account_codes_endpoint(): void
    {
        $twgUser = User::create([
            'name' => 'TWG Fetch Test',
            'email' => 'twg.fetch@davaodelsur.gov.ph',
            'password' => bcrypt('Password123!'),
            'role' => 'twg',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        $twgUser->accountCodes()->sync([$this->accountCode1->id, $this->accountCode2->id]);

        $response = $this->actingAs($this->admin)->getJson("/api/users/{$twgUser->id}/account-codes");

        $response->assertStatus(200)
            ->assertJsonPath('user_id', $twgUser->id)
            ->assertJsonCount(2, 'account_codes');
    }

    public function test_dashboard_api_eager_loads_user_account_codes(): void
    {
        $twgUser = User::create([
            'name' => 'TWG Dashboard Test',
            'email' => 'twg.dash@davaodelsur.gov.ph',
            'password' => bcrypt('Password123!'),
            'role' => 'twg',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        $twgUser->accountCodes()->sync([$this->accountCode1->id, $this->accountCode2->id]);

        $response = $this->actingAs($this->admin)->getJson('/api/dashboard');

        $response->assertStatus(200);
        $users = collect($response->json('users'));
        $found = $users->firstWhere('id', $twgUser->id);

        $this->assertNotNull($found);
        $this->assertArrayHasKey('account_codes', $found);
        $this->assertCount(2, $found['account_codes']);
    }

    public function test_user_deletion_cascades_pivot_table_entries(): void
    {
        $twgUser = User::create([
            'name' => 'TWG Deletion Test',
            'email' => 'twg.delete@davaodelsur.gov.ph',
            'password' => bcrypt('Password123!'),
            'role' => 'twg',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
        $twgUser->accountCodes()->sync([$this->accountCode1->id, $this->accountCode2->id]);

        $this->assertDatabaseHas('account_code_user', [
            'user_id' => $twgUser->id,
            'account_code_id' => $this->accountCode1->id,
        ]);

        $twgUser->delete();

        $this->assertDatabaseMissing('account_code_user', [
            'user_id' => $twgUser->id,
        ]);
    }
}
