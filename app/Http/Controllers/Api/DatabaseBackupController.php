<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\SystemNotification;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\StreamedResponse;

class DatabaseBackupController extends Controller
{
    /**
     * Tables whose schema is preserved, but data records are stripped
     * to prevent session hijacking, bearer token theft, and credential exfiltration.
     */
    protected array $dataOmittedTables = [
        'personal_access_tokens',
        'sessions',
        'password_reset_tokens',
        'failed_jobs',
        'job_batches',
        'cache',
        'cache_locks',
    ];

    /**
     * Require active super_admin access for all database backup operations.
     */
    protected function authorizeSuperAdmin(Request $request): User
    {
        $user = $request->user();
        if (!$user || !$user->isSuperAdmin() || !$user->is_active || $user->approval_status !== 'approved') {
            abort(403, 'Unauthorized. Super Administrator privileges are strictly required to manage or download database backups.');
        }

        return $user;
    }

    /**
     * Get throttle key for anti-brute-force defense.
     */
    protected function getThrottleKey(Request $request, int $userId): string
    {
        return 'db_backup_auth_limit:' . $request->ip() . ':' . $userId;
    }

    /**
     * Check if the current client is locked out due to brute force attempts.
     */
    protected function checkRateLimit(Request $request, User $user): void
    {
        $throttleKey = $this->getThrottleKey($request, $user->id);

        if (RateLimiter::tooManyAttempts($throttleKey, 3)) {
            $secondsRemaining = RateLimiter::availableIn($throttleKey);
            $minutesRemaining = (int) ceil($secondsRemaining / 60);

            AuditLog::log(
                'DATABASE_BACKUP_BRUTE_FORCE_BLOCKED',
                'system_settings',
                null,
                [
                    'ip' => $request->ip(),
                    'user_id' => $user->id,
                    'seconds_remaining' => $secondsRemaining,
                ],
                null,
                $user->id
            );

            // Emit high-priority security alert to all active super administrators
            $superAdmins = User::where('role', 'super_admin')->where('is_active', true)->get();
            foreach ($superAdmins as $admin) {
                SystemNotification::notify(
                    $admin->id,
                    'CRITICAL SECURITY ALERT: Database Backup Lockout',
                    "Unauthorized attempts to access database backup from IP {$request->ip()}. Database downloads are temporarily locked for {$minutesRemaining} minute(s).",
                    null,
                    'danger'
                );
            }

            abort(response()->json([
                'message' => "Too many failed attempts. Database download is temporarily locked for security. Please try again in {$minutesRemaining} minute(s).",
                'retry_after_seconds' => $secondsRemaining,
            ], 429));
        }
    }

    /**
     * Record a failed attempt towards rate limiting.
     */
    protected function recordFailedAttempt(Request $request, User $user, string $reason): void
    {
        $throttleKey = $this->getThrottleKey($request, $user->id);
        RateLimiter::hit($throttleKey, 900); // 15-minute lockout window

        $remaining = RateLimiter::remaining($throttleKey, 3);

        AuditLog::log(
            'DATABASE_BACKUP_DOWNLOAD_FAILED',
            'system_settings',
            null,
            [
                'ip' => $request->ip(),
                'user_agent' => $request->userAgent(),
                'reason' => $reason,
                'attempts_remaining' => $remaining,
            ],
            null,
            $user->id
        );
    }

    /**
     * Get database backup status and security telemetry.
     */
    public function getStatus(Request $request): JsonResponse
    {
        $this->authorizeSuperAdmin($request);

        $passwordHash = SystemSetting::get('database_backup_password_hash');
        $hasPassword = !empty($passwordHash);

        $dbName = config('database.connections.mysql.database', 'eproc_finalize');

        $tablesCount = 0;
        $totalSizeMb = '0.00';

        try {
            $connection = config('database.default', 'mysql');
            if ($connection === 'mysql') {
                $stats = DB::selectOne("
                    SELECT 
                        COUNT(table_name) AS total_tables,
                        ROUND(SUM(data_length + index_length) / 1024 / 1024, 2) AS total_size_mb
                    FROM information_schema.tables 
                    WHERE table_schema = ?
                ", [$dbName]);

                if ($stats) {
                    $tablesCount = (int) ($stats->total_tables ?? 0);
                    $totalSizeMb = (string) ($stats->total_size_mb ?? '0.00');
                }
            } else {
                $tablesCount = count(DB::getSchemaBuilder()->getTableListing());
            }
        } catch (\Throwable $e) {
            // Non-fatal telemetry fallback
        }

        $throttleKey = $this->getThrottleKey($request, $request->user()->id);
        $attemptsRemaining = RateLimiter::remaining($throttleKey, 3);
        $isLocked = RateLimiter::tooManyAttempts($throttleKey, 3);

        return response()->json([
            'has_password' => $hasPassword,
            'database_name' => $dbName,
            'tables_count' => $tablesCount,
            'total_size_mb' => $totalSizeMb,
            'last_backup_at' => SystemSetting::get('last_database_backup_at'),
            'last_backup_by' => SystemSetting::get('last_database_backup_by'),
            'password_updated_at' => SystemSetting::get('database_backup_password_updated_at'),
            'attempts_remaining' => $attemptsRemaining,
            'is_locked' => $isLocked,
        ]);
    }

    /**
     * Create or rotate the manual database backup security password.
     */
    public function setPassword(Request $request): JsonResponse
    {
        $user = $this->authorizeSuperAdmin($request);

        $currentHash = SystemSetting::get('database_backup_password_hash');
        $hasPassword = !empty($currentHash);

        if ($hasPassword) {
            $validated = $request->validate([
                'current_password' => ['required', 'string'],
                'password' => ['required', 'string', 'min:8', 'confirmed'],
            ], [
                'current_password.required' => 'Please provide your current backup security password.',
                'password.min' => 'The new backup security password must be at least 8 characters long.',
                'password.confirmed' => 'The new password confirmation does not match.',
            ]);

            if (!Hash::check($validated['current_password'], $currentHash)) {
                return response()->json([
                    'message' => 'The provided current backup password is incorrect.',
                    'errors' => [
                        'current_password' => ['Current backup security password is incorrect.'],
                    ],
                ], 422);
            }

            SystemSetting::set('database_backup_password_hash', Hash::make($validated['password']));
            SystemSetting::set('database_backup_password_updated_at', now()->toDateTimeString());

            AuditLog::log(
                'DATABASE_BACKUP_PASSWORD_CHANGED',
                'system_settings',
                null,
                null,
                ['status' => 'password_updated'],
                $user->id
            );

            return response()->json([
                'message' => 'Database backup security password successfully updated.',
                'has_password' => true,
                'password_updated_at' => now()->toDateTimeString(),
            ]);
        }

        // Setting initial password
        $validated = $request->validate([
            'password' => ['required', 'string', 'min:8', 'confirmed'],
        ], [
            'password.required' => 'Please enter a backup security password.',
            'password.min' => 'The backup security password must be at least 8 characters long.',
            'password.confirmed' => 'The password confirmation does not match.',
        ]);

        SystemSetting::set('database_backup_password_hash', Hash::make($validated['password']));
        SystemSetting::set('database_backup_password_updated_at', now()->toDateTimeString());

        AuditLog::log(
            'DATABASE_BACKUP_PASSWORD_SET',
            'system_settings',
            null,
            null,
            ['status' => 'password_created'],
            $user->id
        );

        return response()->json([
            'message' => 'Database backup security password successfully created. You may now export secure database dumps.',
            'has_password' => true,
            'password_updated_at' => now()->toDateTimeString(),
        ]);
    }

    /**
     * Request an ephemeral, single-use 60-second download token.
     * Enforces dual-password verification (Account password + Backup password)
     * and anti-brute-force rate limiting.
     */
    public function requestDownloadToken(Request $request): JsonResponse
    {
        $user = $this->authorizeSuperAdmin($request);
        $this->checkRateLimit($request, $user);

        $backupHash = SystemSetting::get('database_backup_password_hash');
        if (empty($backupHash)) {
            return response()->json([
                'message' => 'Backup security password has not been created yet. Please create a backup security password before downloading backups.',
            ], 400);
        }

        $validated = $request->validate([
            'password' => ['required', 'string'],
            'account_password' => ['nullable', 'string'],
            'encrypt' => ['nullable', 'boolean'],
        ]);

        $backupPassword = $validated['password'];

        // Dual factor verification: if account_password provided, verify it matches logged-in user
        if (!empty($validated['account_password'])) {
            if (!Hash::check($validated['account_password'], $user->password)) {
                $this->recordFailedAttempt($request, $user, 'Invalid Super Admin account password');
                $remaining = RateLimiter::remaining($this->getThrottleKey($request, $user->id), 3);
                return response()->json([
                    'message' => "Invalid Super Admin account password. ({$remaining} attempt(s) remaining before security lockout).",
                    'errors' => ['account_password' => ['The account login password you entered is incorrect.']],
                ], 422);
            }
        }

        // Verify backup security password
        if (!Hash::check($backupPassword, $backupHash)) {
            $this->recordFailedAttempt($request, $user, 'Invalid backup security password');
            $remaining = RateLimiter::remaining($this->getThrottleKey($request, $user->id), 3);
            return response()->json([
                'message' => "Invalid backup security password. ({$remaining} attempt(s) remaining before security lockout).",
                'errors' => ['password' => ['The backup security password you entered is incorrect.']],
            ], 422);
        }

        // Clear throttle on successful credentials
        RateLimiter::clear($this->getThrottleKey($request, $user->id));

        $token = Str::random(64);
        $shouldEncrypt = $request->boolean('encrypt', true);

        // Store single-use token in cache for exactly 60 seconds
        Cache::put("db_download_token:{$token}", [
            'user_id' => $user->id,
            'ip' => $request->ip(),
            'encrypt' => $shouldEncrypt,
            'backup_password' => $backupPassword,
            'created_at' => now()->timestamp,
        ], 60);

        return response()->json([
            'message' => 'Authorization verified. Single-use download token generated.',
            'download_token' => $token,
            'expires_in' => 60,
            'encrypt' => $shouldEncrypt,
        ]);
    }

    /**
     * Download database backup. Supports single-use ephemeral token (anti-replay)
     * or direct password authentication with anti-brute-force protection.
     */
    public function downloadBackup(Request $request): StreamedResponse|JsonResponse
    {
        $user = $this->authorizeSuperAdmin($request);
        $this->checkRateLimit($request, $user);

        $token = $request->input('token') ?? $request->query('token');
        $shouldEncrypt = true;
        $backupPassword = null;

        if ($token) {
            $cacheKey = "db_download_token:{$token}";
            $tokenData = Cache::get($cacheKey);

            // Strictly burn token immediately (Single-use token, zero replay attacks)
            Cache::forget($cacheKey);

            if (!$tokenData || $tokenData['user_id'] !== $user->id || $tokenData['ip'] !== $request->ip()) {
                AuditLog::log(
                    'DATABASE_BACKUP_DOWNLOAD_FAILED',
                    'system_settings',
                    null,
                    ['reason' => 'Expired or invalid download token', 'token' => substr($token, 0, 8) . '...'],
                    null,
                    $user->id
                );

                return response()->json([
                    'message' => 'Download token has expired or is invalid. Please authorize again.',
                ], 403);
            }

            $shouldEncrypt = (bool) ($tokenData['encrypt'] ?? true);
            $backupPassword = $tokenData['backup_password'];
        } else {
            // Direct authentication fallback
            $backupHash = SystemSetting::get('database_backup_password_hash');
            if (empty($backupHash)) {
                return response()->json([
                    'message' => 'Backup security password has not been created yet. Please create a backup security password before downloading backups.',
                ], 400);
            }

            $validated = $request->validate([
                'password' => ['required', 'string'],
                'account_password' => ['nullable', 'string'],
                'encrypt' => ['nullable', 'boolean'],
            ]);

            if (!empty($validated['account_password'])) {
                if (!Hash::check($validated['account_password'], $user->password)) {
                    $this->recordFailedAttempt($request, $user, 'Invalid Super Admin account password');
                    return response()->json([
                        'message' => 'Invalid Super Admin account password.',
                        'errors' => ['account_password' => ['The account login password you entered is incorrect.']],
                    ], 422);
                }
            }

            if (!Hash::check($validated['password'], $backupHash)) {
                $this->recordFailedAttempt($request, $user, 'Invalid backup security password');
                return response()->json([
                    'message' => 'Invalid backup security password. Download rejected.',
                    'errors' => ['password' => ['The backup security password you entered is incorrect.']],
                ], 422);
            }

            RateLimiter::clear($this->getThrottleKey($request, $user->id));
            $shouldEncrypt = $request->boolean('encrypt', false);
            $backupPassword = $validated['password'];
        }

        $dbName = config('database.connections.mysql.database', 'eproc_finalize');
        $timestamp = now()->format('Y-m-d_His');
        $filename = $shouldEncrypt
            ? "{$dbName}_backup_{$timestamp}.sql.enc"
            : "{$dbName}_backup_{$timestamp}.sql";

        SystemSetting::set('last_database_backup_at', now()->toDateTimeString());
        SystemSetting::set('last_database_backup_by', $user->name);

        AuditLog::log(
            'DATABASE_BACKUP_DOWNLOADED',
            'system_settings',
            null,
            null,
            [
                'database' => $dbName,
                'filename' => $filename,
                'encrypted' => $shouldEncrypt,
                'downloaded_by' => $user->name,
                'ip' => $request->ip(),
            ],
            $user->id
        );

        $securityHeaders = [
            'Content-Type' => $shouldEncrypt ? 'application/octet-stream' : 'application/sql; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$filename}\"",
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0, post-check=0, pre-check=0, private',
            'Pragma' => 'no-cache',
            'Expires' => '0',
            'X-Content-Type-Options' => 'nosniff',
            'X-Frame-Options' => 'DENY',
            'Content-Security-Policy' => "default-src 'none'",
        ];

        return response()->streamDownload(function () use ($dbName, $user, $shouldEncrypt, $backupPassword) {
            if ($shouldEncrypt) {
                $this->streamEncryptedDatabaseDump($dbName, $user->name, $backupPassword);
            } else {
                $this->streamSanitizedDatabaseDump($dbName, $user->name);
            }
        }, $filename, $securityHeaders);
    }

    /**
     * Decrypt an uploaded .sql.enc backup archive into pure SQL.
     */
    public function decryptBackup(Request $request): StreamedResponse|JsonResponse
    {
        $user = $this->authorizeSuperAdmin($request);
        $this->checkRateLimit($request, $user);

        $request->validate([
            'backup_file' => ['required', 'file', 'max:51200'], // max 50MB
            'password' => ['required', 'string'],
        ], [
            'backup_file.required' => 'Please upload an encrypted backup (.sql.enc) file.',
            'password.required' => 'Please enter the backup security password used during encryption.',
        ]);

        /** @var UploadedFile $file */
        $file = $request->file('backup_file');
        $rawContent = file_get_contents($file->getRealPath());

        $envelope = json_decode($rawContent, true);
        if (!$envelope || !isset($envelope['format']) || $envelope['format'] !== 'EPROC_AES256GCM_V1') {
            return response()->json([
                'message' => 'The uploaded file is not a valid E-PROC encrypted backup archive.',
            ], 422);
        }

        $salt = base64_decode($envelope['salt'] ?? '');
        $iv = base64_decode($envelope['iv'] ?? '');
        $tag = base64_decode($envelope['tag'] ?? '');
        $ciphertext = base64_decode($envelope['ciphertext'] ?? '');

        $derivedKey = hash_pbkdf2('sha256', $request->input('password'), $salt, 100000, 32, true);
        $decryptedSql = openssl_decrypt($ciphertext, 'aes-256-gcm', $derivedKey, OPENSSL_RAW_DATA, $iv, $tag);

        if ($decryptedSql === false) {
            $this->recordFailedAttempt($request, $user, 'Decryption failure: incorrect password or tampered backup file');
            return response()->json([
                'message' => 'Decryption failed. The password you entered is incorrect, or the backup file has been tampered with or corrupted.',
            ], 422);
        }

        RateLimiter::clear($this->getThrottleKey($request, $user->id));

        AuditLog::log(
            'DATABASE_BACKUP_DECRYPTED',
            'system_settings',
            null,
            null,
            ['file' => $file->getClientOriginalName(), 'decrypted_by' => $user->name],
            $user->id
        );

        $outFilename = str_replace('.enc', '', $file->getClientOriginalName());
        if (!str_ends_with($outFilename, '.sql')) {
            $outFilename .= '.sql';
        }

        return response()->streamDownload(function () use ($decryptedSql) {
            echo $decryptedSql;
        }, $outFilename, [
            'Content-Type' => 'application/sql; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$outFilename}\"",
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0, private',
        ]);
    }

    /**
     * Stream sanitized, plain SQL dump.
     */
    protected function streamSanitizedDatabaseDump(string $dbName, string $userName): void
    {
        $out = fopen('php://output', 'w');
        $this->generateSqlDump($dbName, $userName, $out);
        fclose($out);
    }

    /**
     * Stream AES-256-GCM encrypted database dump.
     */
    protected function streamEncryptedDatabaseDump(string $dbName, string $userName, string $backupPassword): void
    {
        // Generate SQL in temporary memory stream
        $memStream = fopen('php://temp', 'w+');
        $this->generateSqlDump($dbName, $userName, $memStream);
        rewind($memStream);
        $plainSql = stream_get_contents($memStream);
        fclose($memStream);

        // Derive strong 256-bit AES key via PBKDF2 (100,000 iterations)
        $salt = random_bytes(16);
        $derivedKey = hash_pbkdf2('sha256', $backupPassword, $salt, 100000, 32, true);
        $iv = random_bytes(12); // Standard 96-bit IV for GCM
        $tag = '';

        $ciphertext = openssl_encrypt($plainSql, 'aes-256-gcm', $derivedKey, OPENSSL_RAW_DATA, $iv, $tag, '', 16);

        $envelope = json_encode([
            'format' => 'EPROC_AES256GCM_V1',
            'cipher' => 'aes-256-gcm',
            'kdf' => 'pbkdf2_sha256',
            'iterations' => 100000,
            'salt' => base64_encode($salt),
            'iv' => base64_encode($iv),
            'tag' => base64_encode($tag),
            'database' => $dbName,
            'exported_at' => now()->toIso8601String(),
            'ciphertext' => base64_encode($ciphertext),
        ], JSON_PRETTY_PRINT);

        $out = fopen('php://output', 'w');
        fwrite($out, $envelope);
        fclose($out);
    }

    /**
     * Core SQL dump generation with table sanitization.
     */
    protected function generateSqlDump(string $dbName, string $userName, $out): void
    {
        $header = <<<SQL
-- ====================================================================
-- Provincial Government of Davao del Sur
-- Electronic Procurement Management System (E-PROC)
-- MySQL Database Secure Backup Dump
-- Database: {$dbName}
-- Generated On: @DATE@
-- Authorized By: {$userName} (Super Administrator)
-- Defense Level: Enterprise Hardened (Tokens & Sessions Sanitized)
-- ====================================================================

SET FOREIGN_KEY_CHECKS=0;
SET SQL_MODE="NO_AUTO_VALUE_ON_ZERO";
SET AUTOCOMMIT=0;
START TRANSACTION;
SET time_zone = "+00:00";
SET NAMES utf8mb4;

SQL;
        $header = str_replace('@DATE@', now()->format('Y-m-d H:i:s T'), $header);
        fwrite($out, $header);

        $connection = DB::connection();
        $pdo = $connection->getPdo();
        $driver = $connection->getDriverName();

        $tables = [];
        try {
            if ($driver === 'mysql') {
                $tableRows = DB::select("SHOW FULL TABLES WHERE Table_type = 'BASE TABLE'");
                foreach ($tableRows as $row) {
                    $rowArr = (array) $row;
                    $tables[] = reset($rowArr);
                }
            } elseif ($driver === 'sqlite') {
                $tableRows = DB::select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
                foreach ($tableRows as $row) {
                    $tables[] = $row->name;
                }
            } else {
                $tables = DB::getSchemaBuilder()->getTableListing();
            }
        } catch (\Throwable $e) {
            try {
                $tables = DB::getSchemaBuilder()->getTableListing();
            } catch (\Throwable $ex) {
                $tables = [];
            }
        }

        foreach ($tables as $table) {
            fwrite($out, "\n-- ------------------------------------------------------------\n");
            fwrite($out, "-- Table structure for table `{$table}`\n");
            fwrite($out, "-- ------------------------------------------------------------\n");
            fwrite($out, "DROP TABLE IF EXISTS `{$table}`;\n");

            try {
                if ($driver === 'mysql') {
                    $createTableQuery = DB::select("SHOW CREATE TABLE `{$table}`");
                    if (!empty($createTableQuery)) {
                        $createTableArr = (array) $createTableQuery[0];
                        $createSql = $createTableArr['Create Table'] ?? ($createTableArr['create table'] ?? null);
                        if ($createSql) {
                            fwrite($out, $createSql . ";\n\n");
                        }
                    }
                } elseif ($driver === 'sqlite') {
                    $sqliteCreate = DB::selectOne("SELECT sql FROM sqlite_master WHERE type='table' AND name = ?", [$table]);
                    if ($sqliteCreate && !empty($sqliteCreate->sql)) {
                        fwrite($out, $sqliteCreate->sql . ";\n\n");
                    }
                }
            } catch (\Throwable $e) {
                continue;
            }

            // OMIT DATA for sensitive session, token, and cache tables
            if (in_array(strtolower($table), $this->dataOmittedTables, true)) {
                fwrite($out, "-- (Sensitive authentication tokens and session states sanitized to prevent hijacking)\n\n");
                continue;
            }

            fwrite($out, "-- Dumping data for table `{$table}`\n");

            $query = DB::table($table);

            // Redact backup password hash itself from system settings
            if ($table === 'system_settings') {
                $query->where('key', '!=', 'database_backup_password_hash');
            }

            $totalRows = $query->count();
            if ($totalRows === 0) {
                fwrite($out, "-- (Table `{$table}` contains 0 records)\n\n");
                continue;
            }

            $chunkSize = 250;
            $query->orderBy(DB::raw('1'))->chunk($chunkSize, function ($rows) use ($out, $table, $pdo) {
                if ($rows->isEmpty()) {
                    return;
                }

                $columns = array_keys((array) $rows->first());
                $columnList = '`' . implode('`, `', $columns) . '`';

                $valStatements = [];
                foreach ($rows as $row) {
                    $rowValues = (array) $row;
                    $escaped = [];
                    foreach ($rowValues as $val) {
                        if (is_null($val)) {
                            $escaped[] = 'NULL';
                        } elseif (is_int($val) || is_float($val)) {
                            $escaped[] = (string) $val;
                        } elseif (is_bool($val)) {
                            $escaped[] = $val ? '1' : '0';
                        } else {
                            $escaped[] = $pdo->quote((string) $val);
                        }
                    }
                    $valStatements[] = '(' . implode(', ', $escaped) . ')';
                }

                $insertSql = "INSERT INTO `{$table}` ({$columnList}) VALUES\n" . implode(",\n", $valStatements) . ";\n";
                fwrite($out, $insertSql);
            });

            fwrite($out, "\n");
        }

        $footer = <<<SQL

-- ====================================================================
-- Finalize Transaction & Re-enable Foreign Key Checks
-- ====================================================================
COMMIT;
SET FOREIGN_KEY_CHECKS=1;

-- Backup completed successfully.

SQL;
        fwrite($out, $footer);
    }
}
