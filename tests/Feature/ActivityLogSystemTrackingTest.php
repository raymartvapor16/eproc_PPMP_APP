<?php

namespace Tests\Feature;

use App\Mail\SuperAdminMfaCodeMail;
use App\Models\AuditLog;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class ActivityLogSystemTrackingTest extends TestCase
{
    use RefreshDatabase;

    public function test_user_login_and_logout_record_system_and_timestamp_in_activity_logs(): void
    {
        $user = User::factory()->create([
            'name' => 'Juan Dela Cruz',
            'email' => 'juan@example.test',
            'password' => Hash::make('Password123!'),
            'role' => 'end_user',
            'roles' => ['end_user'],
            'accessible_systems' => ['/eprocrementppmpapp', '/supplierevaluation'],
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        // Login targeting Supplier Evaluation System
        $this->postJson('/api/login', [
            'email' => $user->email,
            'password' => 'Password123!',
            'target_system' => 'supplier_evaluation',
        ])->assertOk();

        $loginLog = AuditLog::where('action', 'USER_LOGIN')
            ->where('user_id', $user->id)
            ->latest('id')
            ->first();

        $this->assertNotNull($loginLog);
        $this->assertSame('/supplierevaluation', $loginLog->new_values['system_key'] ?? null);
        $this->assertSame('Supplier Evaluation System', $loginLog->new_values['system_name'] ?? null);
        $this->assertNotEmpty($loginLog->new_values['logged_in_at'] ?? null);
        $this->assertSame('Juan Dela Cruz logged in to Supplier Evaluation System', $loginLog->humanDescription());
        $this->assertSame('auth', $loginLog->category());

        // Logout from Supplier Evaluation System
        $this->postJson('/api/logout', [
            'system' => 'supplier_evaluation',
        ])->assertOk();

        $logoutLog = AuditLog::where('action', 'USER_LOGOUT')
            ->where('user_id', $user->id)
            ->latest('id')
            ->first();

        $this->assertNotNull($logoutLog);
        $this->assertSame('/supplierevaluation', $logoutLog->new_values['system_key'] ?? null);
        $this->assertSame('Supplier Evaluation System', $logoutLog->new_values['system_name'] ?? null);
        $this->assertNotEmpty($logoutLog->new_values['logged_out_at'] ?? null);
        $this->assertSame('Juan Dela Cruz logged out from Supplier Evaluation System', $logoutLog->humanDescription());
        $this->assertSame('auth', $logoutLog->category());
    }

    public function test_super_admin_mfa_preserves_target_system_and_activity_log_search_matches_system_name(): void
    {
        Mail::fake();

        $superAdmin = User::factory()->create([
            'name' => 'Super Admin Test',
            'email' => 'sa.track@example.test',
            'password' => Hash::make('SuperSecret123!'),
            'role' => 'super_admin',
            'roles' => ['super_admin'],
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $ua = 'Mozilla/5.0 TestAgent/1.0';
        $loginRes = $this->withServerVariables(['HTTP_USER_AGENT' => $ua])
            ->postJson('/api/login', [
                'email' => $superAdmin->email,
                'password' => 'SuperSecret123!',
                'target_system' => 'monitoring',
            ])->assertOk();

        $code = null;
        Mail::assertSent(SuperAdminMfaCodeMail::class, function (SuperAdminMfaCodeMail $mail) use (&$code) {
            $code = $mail->code;
            return true;
        });

        $this->withServerVariables(['HTTP_USER_AGENT' => $ua])
            ->postJson('/api/login/mfa/verify', [
                'mfa_token' => $loginRes->json('mfa_token'),
                'code' => $code,
            ])->assertOk();

        $loginLog = AuditLog::where('action', 'USER_LOGIN')
            ->where('user_id', $superAdmin->id)
            ->latest('id')
            ->first();

        $this->assertNotNull($loginLog);
        $this->assertSame('/monitoringsystem', $loginLog->new_values['system_key'] ?? null);
        $this->assertSame('OPPMO Real-Time Monitoring System', $loginLog->new_values['system_name'] ?? null);
        $this->assertSame('Super Admin Test logged in to OPPMO Real-Time Monitoring System', $loginLog->humanDescription());

        // Search activity logs by system name
        $searchRes = $this->actingAs($superAdmin)
            ->getJson('/api/activity-logs?search=Real-Time+Monitoring')
            ->assertOk();

        $descriptions = collect($searchRes->json('logs.data'))->pluck('description')->all();
        $this->assertContains('Super Admin Test logged in to OPPMO Real-Time Monitoring System', $descriptions);
    }
}
