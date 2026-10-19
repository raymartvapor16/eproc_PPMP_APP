<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Office;
use App\Models\Ppmp;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class SuperAdminAndAdminRoleTest extends TestCase
{
    use RefreshDatabase;

    protected User $superAdmin;
    protected User $adminUser;
    protected User $endUser;
    protected Office $office;

    protected function setUp(): void
    {
        parent::setUp();

        $this->office = Office::create([
            'code' => 'OPPMO',
            'name' => 'Office of the Provincial Procurement Management Officer',
            'head_name' => 'Test Head',
            'designation' => 'Provincial Officer',
        ]);

        $password = Hash::make('password123');

        $this->superAdmin = User::create([
            'name' => 'Super Administrator',
            'email' => 'superadmin@example.test',
            'password' => $password,
            'role' => 'super_admin',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $this->adminUser = User::create([
            'name' => 'Administrator',
            'email' => 'admin@example.test',
            'password' => $password,
            'role' => 'admin',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $this->endUser = User::create([
            'name' => 'End User Test',
            'email' => 'enduser@example.test',
            'password' => $password,
            'role' => 'end_user',
            'office_id' => $this->office->id,
            'is_active' => true,
            'approval_status' => 'approved',
        ]);
    }

    public function test_super_admin_has_full_administrative_access(): void
    {
        $this->actingAs($this->superAdmin);

        // Can access offices management
        $response = $this->postJson('/api/offices', [
            'office_name' => 'Provincial Health Office',
            'abbreviation' => 'PHO',
            'head_name' => 'Dr. Health',
            'designation' => 'Doctor',
        ]);
        $response->assertStatus(201);

        // Can access signatories management
        $response = $this->postJson('/api/signatories', [
            'signatory_type' => 'approved_by',
            'name' => 'Hon. Governor',
            'position' => 'Provincial Governor',
        ]);
        $response->assertStatus(201);

        // Can view users
        $response = $this->getJson('/api/users');
        $response->assertOk();

        // Can view activity logs
        $response = $this->getJson('/api/activity-logs');
        $response->assertOk();
    }

    public function test_admin_role_cannot_modify_offices_but_can_manage_signatories(): void
    {
        $this->actingAs($this->adminUser);

        // Forbidden to create office (Super Admin only)
        $response = $this->postJson('/api/offices', [
            'office_name' => 'Provincial Legal Office',
            'abbreviation' => 'PLO',
        ]);
        $response->assertStatus(403);

        // Admin can configure official signatories (PPMP & APP)
        $response = $this->postJson('/api/signatories', [
            'signatory_type' => 'app_prepared_by',
            'name' => 'GINA MAE B. CARBAQUEL',
            'position' => 'ADAS II',
        ]);
        $response->assertStatus(201);

        // Non-admin (end_user) is forbidden to configure signatories
        $this->actingAs($this->endUser);
        $unauth = $this->postJson('/api/signatories', [
            'signatory_type' => 'app_prepared_by',
            'name' => 'Unauthorized User',
            'position' => 'Staff',
        ]);
        $unauth->assertStatus(403);
    }

    public function test_admin_role_can_manage_users_except_super_admin(): void
    {
        $this->actingAs($this->adminUser);

        // Create pending user
        $pendingUser = User::create([
            'name' => 'Pending Staff',
            'email' => 'pending@example.test',
            'password' => Hash::make('secret'),
            'role' => 'end_user',
            'office_id' => $this->office->id,
            'is_active' => false,
            'approval_status' => 'pending',
        ]);

        // Admin can approve user
        $response = $this->postJson("/api/users/{$pendingUser->id}/approve");
        $response->assertOk();
        $this->assertTrue($pendingUser->fresh()->is_active);

        // Admin can change password of regular user
        $response = $this->postJson("/api/users/{$pendingUser->id}/change-password", [
            'password' => 'newpassword123',
        ]);
        $response->assertOk();

        // Admin can change role of regular user
        $response = $this->putJson("/api/users/{$pendingUser->id}/role", [
            'role' => 'head',
        ]);
        $response->assertOk();
        $this->assertEquals('head', $pendingUser->fresh()->role);

        // Admin CANNOT change password of Super Admin
        $response = $this->postJson("/api/users/{$this->superAdmin->id}/change-password", [
            'password' => 'hacksuperadmin',
        ]);
        $response->assertStatus(403);

        // Admin CANNOT deactivate Super Admin
        $response = $this->postJson("/api/users/{$this->superAdmin->id}/toggle-status");
        $response->assertStatus(403);

        // Admin CANNOT delete Super Admin
        $response = $this->deleteJson("/api/users/{$this->superAdmin->id}");
        $response->assertStatus(403);
    }

    public function test_admin_role_can_view_activity_logs_and_ppmp_list(): void
    {
        $this->actingAs($this->adminUser);

        // Can view activity logs
        $response = $this->getJson('/api/activity-logs');
        $response->assertOk();
        $response->assertJsonStructure(['logs', 'available_actions']);

        // Can view all PPMPs
        $response = $this->getJson('/api/ppmps');
        $response->assertOk();

        // Can access dashboard
        $response = $this->getJson('/api/dashboard');
        $response->assertOk();
        $response->assertJsonPath('role', 'admin');
    }

    public function test_super_admin_and_admin_can_add_new_user(): void
    {
        // 1. Super admin can create a user
        $this->actingAs($this->superAdmin);
        $response = $this->postJson('/api/users', [
            'name' => 'Newly Created Staff',
            'email' => 'newstaff@example.test',
            'password' => 'SecurePass123!',
            'role' => 'authorized_staff',
            'office_id' => $this->office->id,
            'designation' => 'Procurement Assistant',
            'phone_number' => '09123456789',
        ]);
        $response->assertStatus(201);
        $response->assertJsonPath('user.email', 'newstaff@example.test');
        $response->assertJsonPath('user.is_active', true);
        $response->assertJsonPath('user.approval_status', 'approved');

        // 2. Admin can create an end_user
        $this->actingAs($this->adminUser);
        $responseAdmin = $this->postJson('/api/users', [
            'name' => 'Admin Created EndUser',
            'email' => 'enduser2@example.test',
            'password' => 'SecurePass123!',
            'role' => 'end_user',
            'office_id' => $this->office->id,
        ]);
        $responseAdmin->assertStatus(201);
        $responseAdmin->assertJsonPath('user.email', 'enduser2@example.test');

        // 3. Admin CANNOT escalate and create a super_admin
        $responseForbidden = $this->postJson('/api/users', [
            'name' => 'Fake Super Admin',
            'email' => 'fakesuper@example.test',
            'password' => 'SecurePass123!',
            'role' => 'super_admin',
        ]);
        $responseForbidden->assertStatus(403);

        // 4. End user cannot create users
        $this->actingAs($this->endUser);
        $responseUnauth = $this->postJson('/api/users', [
            'name' => 'Hacker User',
            'email' => 'hacker@example.test',
            'password' => 'SecurePass123!',
            'role' => 'admin',
        ]);
        $responseUnauth->assertStatus(403);
    }

    public function test_admin_and_super_admin_can_update_user_signature(): void
    {
        $this->actingAs($this->superAdmin);

        // 1x1 transparent png data url
        $fakePngDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

        $response = $this->postJson("/api/users/{$this->endUser->id}/signature", [
            'signature_data' => $fakePngDataUrl,
        ]);
        $response->assertOk();
        $this->assertStringStartsWith('signatures/', $response->json('user.signature_path'));

        // Verify signature is fetchable via signature endpoint
        $sigResponse = $this->getJson("/api/users/{$this->endUser->id}/signature");
        $sigResponse->assertOk();
        $this->assertEquals('image/png', $sigResponse->headers->get('content-type'));

        // Admin can also update signature
        $this->actingAs($this->adminUser);
        $response2 = $this->postJson("/api/users/{$this->endUser->id}/signature", [
            'signature_data' => $fakePngDataUrl,
        ]);
        $response2->assertOk();
    }

    public function test_super_admin_can_toggle_signature_insertion_settings(): void
    {
        // 1. Initial state defaults to all true
        $res = $this->getJson('/api/system-settings/signatures');
        $res->assertOk();
        $res->assertJson([
            'settings' => [
                'ppmp' => true,
                'app' => true,
                'attachment_list' => true,
            ],
        ]);

        // 2. Super Admin toggles PPMP to false, APP to false
        $this->actingAs($this->superAdmin);
        $updateRes = $this->putJson('/api/system-settings/signatures', [
            'ppmp' => false,
            'app' => false,
            'attachment_list' => true,
        ]);
        $updateRes->assertOk();
        $updateRes->assertJson([
            'settings' => [
                'ppmp' => false,
                'app' => false,
                'attachment_list' => true,
            ],
        ]);

        $this->assertFalse(\App\Models\SystemSetting::isSignatureInsertionEnabled('ppmp'));
        $this->assertFalse(\App\Models\SystemSetting::isSignatureInsertionEnabled('app'));
        $this->assertTrue(\App\Models\SystemSetting::isSignatureInsertionEnabled('attachment_list'));

        // Verify audit log
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'SIGNATURE_CONTROLLER_UPDATED',
            'user_id' => $this->superAdmin->id,
        ]);
    }

    public function test_admin_and_end_user_cannot_update_signature_insertion_settings(): void
    {
        // Admin gets 403
        $this->actingAs($this->adminUser);
        $resAdmin = $this->putJson('/api/system-settings/signatures', [
            'ppmp' => false,
            'app' => false,
            'attachment_list' => false,
        ]);
        $resAdmin->assertStatus(403);

        // End user gets 403
        $this->actingAs($this->endUser);
        $resEndUser = $this->putJson('/api/system-settings/signatures', [
            'ppmp' => false,
            'app' => false,
            'attachment_list' => false,
        ]);
        $resEndUser->assertStatus(403);

        // Unauthenticated gets 401
        auth()->logout();
        $resGuest = $this->putJson('/api/system-settings/signatures', [
            'ppmp' => false,
            'app' => false,
            'attachment_list' => false,
        ]);
        $resGuest->assertStatus(401);
    }
}
