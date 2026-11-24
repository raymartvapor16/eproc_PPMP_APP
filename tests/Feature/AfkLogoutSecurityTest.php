<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\Office;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AfkLogoutSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected Office $office;
    protected User $superAdmin;
    protected User $admin;
    protected User $endUser;

    protected function setUp(): void
    {
        parent::setUp();
        SystemSetting::flushCache();

        $this->office = Office::create([
            'name' => 'Provincial Procurement Management Office',
            'code' => 'OPPMO',
            'is_active' => true,
        ]);

        $this->superAdmin = User::create([
            'name' => 'Super Administrator',
            'email' => 'superadmin@system.gov',
            'username' => 'superadmin',
            'password' => bcrypt('password'),
            'role' => 'super_admin',
            'office_id' => $this->office->id,
            'is_active' => true,
        ]);

        $this->admin = User::create([
            'name' => 'Regular Admin',
            'email' => 'admin@system.gov',
            'username' => 'admin1',
            'password' => bcrypt('password'),
            'role' => 'admin',
            'office_id' => $this->office->id,
            'is_active' => true,
        ]);

        $this->endUser = User::create([
            'name' => 'End User Staff',
            'email' => 'staff@system.gov',
            'username' => 'staff1',
            'password' => bcrypt('password'),
            'role' => 'end_user',
            'office_id' => $this->office->id,
            'is_active' => true,
        ]);
    }

    public function test_can_fetch_default_afk_logout_settings(): void
    {
        $response = $this->getJson('/api/system-settings/afk-logout');
        $response->assertOk();

        $response->assertJson([
            'enabled' => true,
            'timeout_minutes' => 15,
            'warning_seconds' => 60,
        ]);
    }

    public function test_non_super_admin_cannot_update_afk_logout_settings(): void
    {

        $this->putJson('/api/system-settings/afk-logout', [
            'enabled' => false,
            'timeout_minutes' => 30,
        ])->assertStatus(401);

        $this->actingAs($this->admin)
            ->putJson('/api/system-settings/afk-logout', [
                'enabled' => false,
                'timeout_minutes' => 30,
            ])
            ->assertStatus(403);

        $this->actingAs($this->endUser)
            ->putJson('/api/system-settings/afk-logout', [
                'enabled' => false,
                'timeout_minutes' => 30,
            ])
            ->assertStatus(403);
    }

    public function test_super_admin_can_update_afk_logout_settings_and_logs_audit(): void
    {
        $this->actingAs($this->superAdmin);

        $payload = [
            'enabled' => true,
            'timeout_minutes' => 20,
            'warning_seconds' => 90,
        ];

        $response = $this->putJson('/api/system-settings/afk-logout', $payload);
        $response->assertOk();

        $response->assertJsonPath('settings.enabled', true);
        $response->assertJsonPath('settings.timeout_minutes', 20);
        $response->assertJsonPath('settings.warning_seconds', 90);

        $this->assertEquals('true', SystemSetting::where('key', 'afk_logout_enabled')->value('value'));
        $this->assertEquals('20', SystemSetting::where('key', 'afk_logout_timeout_minutes')->value('value'));
        $this->assertEquals('90', SystemSetting::where('key', 'afk_logout_warning_seconds')->value('value'));

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'AFK_LOGOUT_SETTINGS_UPDATED',
            'user_id' => $this->superAdmin->id,
        ]);

        $fetchRes = $this->getJson('/api/system-settings/afk-logout');
        $fetchRes->assertOk();
        $this->assertEquals(20, $fetchRes->json('timeout_minutes'));
        $this->assertEquals(90, $fetchRes->json('warning_seconds'));
    }

    public function test_afk_logout_input_validation(): void
    {
        $this->actingAs($this->superAdmin);

        $this->putJson('/api/system-settings/afk-logout', [
            'enabled' => true,
            'timeout_minutes' => 0,
        ])->assertStatus(422);

        $this->putJson('/api/system-settings/afk-logout', [
            'enabled' => true,
            'timeout_minutes' => 500,
        ])->assertStatus(422);
    }
}
