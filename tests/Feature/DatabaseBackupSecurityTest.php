<?php

namespace Tests\Feature;

use App\Models\AuditLog;
use App\Models\SystemNotification;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Tests\TestCase;

class DatabaseBackupSecurityTest extends TestCase
{
    use RefreshDatabase;

    protected function setUp(): void
    {
        parent::setUp();
        SystemSetting::flushCache();
        SystemSetting::where('key', 'like', '%database_backup%')->delete();
        RateLimiter::clear('db_backup_auth_limit:127.0.0.1:1');
    }

    protected function tearDown(): void
    {
        SystemSetting::flushCache();
        SystemSetting::where('key', 'like', '%database_backup%')->delete();
        parent::tearDown();
    }

    public function test_unauthenticated_and_non_super_admin_users_are_forbidden(): void
    {
        // Unauthenticated
        $this->getJson('/api/database-backup/status')
            ->assertStatus(401);

        // Regular admin (not super admin)
        $admin = User::factory()->create([
            'role' => 'admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $this->actingAs($admin)
            ->getJson('/api/database-backup/status')
            ->assertStatus(403);

        $this->actingAs($admin)
            ->postJson('/api/database-backup/set-password', [
                'password' => 'NewSecuredPassword123!',
                'password_confirmation' => 'NewSecuredPassword123!',
            ])
            ->assertStatus(403);

        $this->actingAs($admin)
            ->postJson('/api/database-backup/download', [
                'password' => 'NewSecuredPassword123!',
            ])
            ->assertStatus(403);
    }

    public function test_status_indicates_no_password_initially(): void
    {
        $superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $res = $this->actingAs($superAdmin)
            ->getJson('/api/database-backup/status')
            ->assertStatus(200)
            ->assertJson([
                'has_password' => false,
                'last_backup_at' => null,
            ]);

        $this->assertFalse($res->json('has_password'));
    }

    public function test_download_rejected_if_password_not_configured_yet(): void
    {
        $superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $this->actingAs($superAdmin)
            ->postJson('/api/database-backup/download', [
                'password' => 'SomePassword123!',
            ])
            ->assertStatus(400)
            ->assertJsonFragment([
                'message' => 'Backup security password has not been created yet. Please create a backup security password before downloading backups.',
            ]);
    }

    public function test_super_admin_can_manually_create_backup_password(): void
    {
        $superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'name' => 'Chief Admin',
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        $this->actingAs($superAdmin)
            ->postJson('/api/database-backup/set-password', [
                'password' => 'short',
                'password_confirmation' => 'mismatch',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['password']);

        $res = $this->actingAs($superAdmin)
            ->postJson('/api/database-backup/set-password', [
                'password' => 'StrictBackupPass2026!',
                'password_confirmation' => 'StrictBackupPass2026!',
            ])
            ->assertStatus(200)
            ->assertJson([
                'has_password' => true,
            ]);

        $this->assertTrue(SystemSetting::get('database_backup_password_hash') !== null);
        $this->assertTrue(Hash::check('StrictBackupPass2026!', SystemSetting::get('database_backup_password_hash')));

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'DATABASE_BACKUP_PASSWORD_SET',
            'user_id' => $superAdmin->id,
        ]);
    }

    public function test_anti_brute_force_locks_out_after_three_failed_attempts_and_notifies_admins(): void
    {
        $superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'password' => Hash::make('AdminLoginPass123!'),
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        SystemSetting::set('database_backup_password_hash', Hash::make('CorrectSecretKey2026!'));

        // Attempt 1 fails
        $this->actingAs($superAdmin)
            ->postJson('/api/database-backup/request-token', [
                'password' => 'WrongKey1',
                'account_password' => 'AdminLoginPass123!',
            ])
            ->assertStatus(422);

        // Attempt 2 fails
        $this->actingAs($superAdmin)
            ->postJson('/api/database-backup/request-token', [
                'password' => 'WrongKey2',
                'account_password' => 'AdminLoginPass123!',
            ])
            ->assertStatus(422);

        // Attempt 3 fails
        $this->actingAs($superAdmin)
            ->postJson('/api/database-backup/request-token', [
                'password' => 'WrongKey3',
                'account_password' => 'AdminLoginPass123!',
            ])
            ->assertStatus(422);

        // Attempt 4 is BLOCKED by rate limiter (HTTP 429)
        $this->actingAs($superAdmin)
            ->postJson('/api/database-backup/request-token', [
                'password' => 'CorrectSecretKey2026!',
                'account_password' => 'AdminLoginPass123!',
            ])
            ->assertStatus(429)
            ->assertJsonStructure(['message', 'retry_after_seconds']);

        // Audit log created for brute force block
        $this->assertDatabaseHas('audit_logs', [
            'action' => 'DATABASE_BACKUP_BRUTE_FORCE_BLOCKED',
            'user_id' => $superAdmin->id,
        ]);

        // Security notification emitted
        $this->assertDatabaseHas('system_notifications', [
            'user_id' => $superAdmin->id,
            'type' => 'danger',
        ]);
    }

    public function test_dual_password_request_token_and_single_use_download(): void
    {
        $superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'name' => 'Executive Governor Admin',
            'password' => Hash::make('AdminLoginPass123!'),
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        SystemSetting::set('database_backup_password_hash', Hash::make('CorrectSecretKey2026!'));

        // Fails if account password is wrong
        $this->actingAs($superAdmin)
            ->postJson('/api/database-backup/request-token', [
                'password' => 'CorrectSecretKey2026!',
                'account_password' => 'WrongLoginPass',
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors(['account_password']);

        // Succeeds with dual valid credentials
        $tokenRes = $this->actingAs($superAdmin)
            ->postJson('/api/database-backup/request-token', [
                'password' => 'CorrectSecretKey2026!',
                'account_password' => 'AdminLoginPass123!',
                'encrypt' => true,
            ])
            ->assertStatus(200)
            ->assertJsonStructure(['download_token', 'expires_in', 'encrypt']);

        $token = $tokenRes->json('download_token');
        $this->assertNotEmpty($token);

        // First download with token succeeds
        $res = $this->actingAs($superAdmin)
            ->get("/api/database-backup/download?token={$token}");

        $res->assertStatus(200);
        $res->assertHeader('Content-Type', 'application/octet-stream');
        $this->assertStringContainsString('attachment; filename=', $res->headers->get('Content-Disposition'));
        $this->assertStringEndsWith('.sql.enc"', $res->headers->get('Content-Disposition'));

        $content = $res->streamedContent();
        $this->assertStringContainsString('EPROC_AES256GCM_V1', $content);
        $this->assertStringContainsString('aes-256-gcm', $content);

        // Immediate replay of same token fails (Strict single-use / anti-replay)
        $this->actingAs($superAdmin)
            ->get("/api/database-backup/download?token={$token}")
            ->assertStatus(403);
    }

    public function test_aes_256_gcm_encrypted_backup_can_be_decrypted_with_correct_password(): void
    {
        $superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'password' => Hash::make('AdminLoginPass123!'),
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        SystemSetting::set('database_backup_password_hash', Hash::make('CorrectSecretKey2026!'));

        // Request token and download encrypted backup
        $tokenRes = $this->actingAs($superAdmin)
            ->postJson('/api/database-backup/request-token', [
                'password' => 'CorrectSecretKey2026!',
                'account_password' => 'AdminLoginPass123!',
                'encrypt' => true,
            ]);

        $token = $tokenRes->json('download_token');
        $downloadRes = $this->actingAs($superAdmin)->get("/api/database-backup/download?token={$token}");
        $encryptedContent = $downloadRes->streamedContent();

        // Create temporary file to test decryption
        $tempPath = tempnam(sys_get_temp_dir(), 'enc_backup_');
        file_put_contents($tempPath, $encryptedContent);

        $uploadedFile = new UploadedFile($tempPath, 'test_backup.sql.enc', 'application/octet-stream', null, true);

        // Decryption fails with wrong password
        $this->actingAs($superAdmin)
            ->postJson('/api/database-backup/decrypt', [
                'backup_file' => $uploadedFile,
                'password' => 'WrongPassword!',
            ])
            ->assertStatus(422)
            ->assertJsonFragment([
                'message' => 'Decryption failed. The password you entered is incorrect, or the backup file has been tampered with or corrupted.',
            ]);

        // Decryption succeeds with correct password
        $decryptRes = $this->actingAs($superAdmin)
            ->post('/api/database-backup/decrypt', [
                'backup_file' => $uploadedFile,
                'password' => 'CorrectSecretKey2026!',
            ]);

        $decryptRes->assertStatus(200);
        $decryptedSql = $decryptRes->streamedContent();
        $this->assertStringContainsString('FOREIGN_KEY_CHECKS=0', $decryptedSql);
        $this->assertStringContainsString('DROP TABLE IF EXISTS', $decryptedSql);

        @unlink($tempPath);
    }

    public function test_sensitive_tokens_and_backup_password_hash_are_sanitized_from_dump(): void
    {
        $superAdmin = User::factory()->create([
            'role' => 'super_admin',
            'password' => Hash::make('AdminLoginPass123!'),
            'is_active' => true,
            'approval_status' => 'approved',
        ]);

        SystemSetting::set('database_backup_password_hash', Hash::make('StrictKeyForTesting123!'));

        // Download plain SQL directly
        $res = $this->actingAs($superAdmin)
            ->post('/api/database-backup/download', [
                'password' => 'StrictKeyForTesting123!',
                'account_password' => 'AdminLoginPass123!',
                'encrypt' => false,
            ]);

        $res->assertStatus(200);
        $sql = $res->streamedContent();

        // The backup password hash itself must NEVER be in the dump
        $this->assertStringNotContainsString('StrictKeyForTesting123!', $sql);
        $this->assertStringNotContainsString('database_backup_password_hash', $sql);

        // Sensitive tables note is present
        $this->assertStringContainsString('Sensitive authentication tokens and session states sanitized to prevent hijacking', $sql);
    }
}
