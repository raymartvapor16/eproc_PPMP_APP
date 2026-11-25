<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\AuthController;
use App\Mail\SuperAdminMfaCodeMail;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Tests\TestCase;

class SuperAdminMfaTest extends TestCase
{
    use RefreshDatabase;

    public function test_super_admin_login_sends_mfa_code_only_to_fixed_email_and_requires_verification(): void
    {
        Mail::fake();

        $superAdmin = User::factory()->create([
            'email' => 'different.superadmin@example.test',
            'password' => Hash::make('SuperSecret123!'),
            'role' => 'super_admin',
            'roles' => ['super_admin'],
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) TestBrowser/1.0';

        $loginRes = $this->withServerVariables(['HTTP_USER_AGENT' => $ua])
            ->postJson('/api/login', [
                'email' => $superAdmin->email,
                'password' => 'SuperSecret123!',
            ]);

        $loginRes->assertStatus(200)
            ->assertJsonPath('requires_mfa', true);

        $this->assertGuest();

        $capturedCode = null;
        Mail::assertSent(SuperAdminMfaCodeMail::class, function (SuperAdminMfaCodeMail $mail) use (&$capturedCode) {
            $capturedCode = $mail->code;
            return $mail->hasTo(AuthController::SUPER_ADMIN_MFA_EMAIL)
                && !$mail->hasTo('different.superadmin@example.test')
                && preg_match('/^\d{6}$/', $mail->code) === 1;
        });

        $mfaToken = $loginRes->json('mfa_token');
        $this->assertNotEmpty($mfaToken);
        $this->assertNotNull($capturedCode);

        $wrongCode = $capturedCode === '000000' ? '999999' : '000000';
        $this->withServerVariables(['HTTP_USER_AGENT' => $ua])
            ->postJson('/api/login/mfa/verify', [
                'mfa_token' => $mfaToken,
                'code' => $wrongCode,
            ])
            ->assertStatus(422)
            ->assertJsonPath('attempts_left', 4);

        $this->assertGuest();

        $verifyRes = $this->withServerVariables(['HTTP_USER_AGENT' => $ua])
            ->postJson('/api/login/mfa/verify', [
                'mfa_token' => $mfaToken,
                'code' => $capturedCode,
            ]);

        $verifyRes->assertStatus(200)
            ->assertJsonPath('user.id', $superAdmin->id);

        $this->assertAuthenticatedAs($superAdmin);

        $this->withServerVariables(['HTTP_USER_AGENT' => $ua])
            ->postJson('/api/login/mfa/verify', [
                'mfa_token' => $mfaToken,
                'code' => $capturedCode,
            ])
            ->assertStatus(422);
    }

    public function test_super_admin_mfa_rejects_stolen_token_from_different_browser(): void
    {
        Mail::fake();

        $superAdmin = User::factory()->create([
            'email' => 'sa2@example.test',
            'password' => Hash::make('SuperSecret123!'),
            'role' => 'super_admin',
            'roles' => ['super_admin'],
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $loginRes = $this->withServerVariables(['HTTP_USER_AGENT' => 'BrowserA/1.0'])
            ->postJson('/api/login', [
                'email' => $superAdmin->email,
                'password' => 'SuperSecret123!',
            ])->assertOk();

        $capturedCode = null;
        Mail::assertSent(SuperAdminMfaCodeMail::class, function (SuperAdminMfaCodeMail $mail) use (&$capturedCode) {
            $capturedCode = $mail->code;
            return true;
        });

        $this->withServerVariables(['HTTP_USER_AGENT' => 'AttackerBrowserB/2.0'])
            ->postJson('/api/login/mfa/verify', [
                'mfa_token' => $loginRes->json('mfa_token'),
                'code' => $capturedCode,
            ])
            ->assertStatus(403);

        $this->assertGuest();
    }
}
