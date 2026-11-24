<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DeveloperModeTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_can_get_developer_mode_status(): void
    {
        SystemSetting::set('developer_mode', false);

        $response = $this->getJson('/api/system-settings/developer-mode');
        $response->assertStatus(200);
        $response->assertJson(['developer_mode' => false]);

        SystemSetting::set('developer_mode', true);
        $response2 = $this->getJson('/api/system-settings/developer-mode');
        $response2->assertStatus(200);
        $response2->assertJson(['developer_mode' => true]);
    }

    public function test_guest_cannot_update_developer_mode(): void
    {
        $response = $this->putJson('/api/system-settings/developer-mode', [
            'developer_mode' => true,
        ]);

        $response->assertStatus(401);
    }

    public function test_regular_user_cannot_update_developer_mode(): void
    {
        $user = User::factory()->create([
            'role' => 'end_user',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $response = $this->actingAs($user)->putJson('/api/system-settings/developer-mode', [
            'developer_mode' => true,
        ]);

        $response->assertStatus(403);
    }

    public function test_admin_cannot_update_developer_mode_only_super_admin(): void
    {
        $admin = User::factory()->create([
            'role' => 'admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $response = $this->actingAs($admin)->putJson('/api/system-settings/developer-mode', [
            'developer_mode' => true,
        ]);

        $response->assertStatus(403);
    }

    public function test_super_admin_can_toggle_developer_mode_and_audit_log_is_recorded(): void
    {
        $superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        SystemSetting::set('developer_mode', false);

        $response = $this->actingAs($superAdmin)->putJson('/api/system-settings/developer-mode', [
            'developer_mode' => true,
        ]);

        $response->assertStatus(200);
        $response->assertJson([
            'developer_mode' => true,
        ]);

        $this->assertTrue(SystemSetting::isDeveloperMode());

        $this->assertDatabaseHas('audit_logs', [
            'user_id' => $superAdmin->id,
            'action' => 'DEVELOPER_MODE_TOGGLED',
            'entity_type' => 'system_settings',
        ]);

        $response2 = $this->actingAs($superAdmin)->putJson('/api/system-settings/developer-mode', [
            'developer_mode' => false,
        ]);

        $response2->assertStatus(200);
        $response2->assertJson([
            'developer_mode' => false,
        ]);

        $this->assertFalse(SystemSetting::isDeveloperMode());
    }

    public function test_when_developer_mode_is_on_user_agent_device_emulation_does_not_kill_session(): void
    {
        SystemSetting::set('developer_mode', true);

        $user = User::factory()->create([
            'role' => 'end_user',
            'is_active' => true,
            'approval_status' => 'approved',
            'password' => bcrypt('password123'),
        ]);

        $desktopAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0';
        $mobileEmulatedAgent = 'Mozilla/5.0 (Linux; Android 14; Pixel 9) Chrome/120.0.0.0 Mobile Safari/537.36';

        $loginRes = $this->withServerVariables(['HTTP_USER_AGENT' => $desktopAgent])
            ->postJson('/api/login', [
                'email' => $user->email,
                'password' => 'password123',
            ]);
        $loginRes->assertStatus(200);

        $meRes = $this->withServerVariables(['HTTP_USER_AGENT' => $mobileEmulatedAgent])
            ->getJson('/api/me');

        $meRes->assertStatus(200);
        $meRes->assertJson(['user' => ['id' => $user->id]]);

        $this->assertFalse(
            AuditLog::where('action', 'SESSION_HIJACK_DETECTED')
                ->where('user_id', $user->id)
                ->exists()
        );
    }

    public function test_when_developer_mode_is_off_user_agent_mismatch_triggers_session_hijack_prevention(): void
    {
        SystemSetting::set('developer_mode', false);

        $user = User::factory()->create([
            'role' => 'end_user',
            'is_active' => true,
            'approval_status' => 'approved',
            'password' => bcrypt('password123'),
        ]);

        $desktopAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0';
        $attackerAgent = 'AttackerScript/2.0 (Linux x86_64)';

        $loginRes = $this->withServerVariables(['HTTP_USER_AGENT' => $desktopAgent])
            ->postJson('/api/login', [
                'email' => $user->email,
                'password' => 'password123',
            ]);
        $loginRes->assertStatus(200);

        $hijackRes = $this->withServerVariables(['HTTP_USER_AGENT' => $attackerAgent])
            ->getJson('/api/me');

        $hijackRes->assertStatus(401);
        $hijackRes->assertJson(['code' => 'SESSION_HIJACK_PREVENTED']);
    }
}
