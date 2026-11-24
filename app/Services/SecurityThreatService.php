<?php

namespace App\Services;

use App\Models\DeletedDataBackup;
use App\Models\ScheduledDatabaseBackup;
use App\Models\SecurityThreatLog;
use App\Models\SystemNotification;
use App\Models\SystemSetting;
use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class SecurityThreatService
{
    public const MASS_DELETE_THRESHOLD = 5;
    public const MASS_DELETE_WINDOW_SECONDS = 300;
    public const AUTO_BACKUP_INTERVAL_DAYS = 15;

    public static function resolveRealIp(?Request $request): string
    {
        if (!$request) {
            return '127.0.0.1';
        }

        $candidates = [
            $request->header('CF-Connecting-IP'),
            $request->header('True-Client-IP'),
            $request->header('X-Real-IP'),
        ];

        $xff = $request->header('X-Forwarded-For');
        if ($xff) {
            foreach (explode(',', $xff) as $part) {
                $candidates[] = trim($part);
            }
        }

        $candidates[] = $request->ip();

        foreach ($candidates as $ip) {
            if (is_string($ip) && filter_var($ip, FILTER_VALIDATE_IP)) {
                return $ip;
            }
        }

        return (string) ($request->ip() ?: '127.0.0.1');
    }

    public static function resolveGeoLocation(string $ip): array
    {
        $isPrivate = !filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE);
        if ($isPrivate) {
            return [
                'country' => 'Local / Private Network',
                'region' => 'Internal LAN',
                'city' => $ip === '127.0.0.1' || $ip === '::1' ? 'Localhost' : 'Private Subnet',
                'isp' => 'Internal Network',
                'latitude' => null,
                'longitude' => null,
                'label' => ($ip === '127.0.0.1' || $ip === '::1') ? 'Localhost (Private Network)' : 'Internal LAN (Private Network)',
            ];
        }

        return Cache::remember("sec_geoip:{$ip}", 86400, function () use ($ip) {
            try {
                if (app()->runningUnitTests()) {
                    return [
                        'country' => 'Test Network',
                        'region' => 'Test Region',
                        'city' => 'Test City',
                        'isp' => 'Test ISP',
                        'latitude' => null,
                        'longitude' => null,
                        'label' => 'Test City, Test Country',
                    ];
                }

                $resp = Http::timeout(1.5)->get("http://ip-api.com/json/{$ip}", [
                    'fields' => 'status,country,regionName,city,isp,lat,lon',
                ]);

                if ($resp->ok() && $resp->json('status') === 'success') {
                    $country = (string) ($resp->json('country') ?? 'Unknown');
                    $region = $resp->json('regionName');
                    $city = $resp->json('city');
                    $isp = $resp->json('isp');
                    $parts = array_filter([$city, $region, $country]);
                    return [
                        'country' => $country,
                        'region' => $region,
                        'city' => $city,
                        'isp' => $isp,
                        'latitude' => is_numeric($resp->json('lat')) ? (float) $resp->json('lat') : null,
                        'longitude' => is_numeric($resp->json('lon')) ? (float) $resp->json('lon') : null,
                        'label' => implode(', ', $parts) ?: 'Unknown Location',
                    ];
                }
            } catch (\Throwable $e) {

            }

            return [
                'country' => 'Unknown',
                'region' => null,
                'city' => null,
                'isp' => null,
                'latitude' => null,
                'longitude' => null,
                'label' => 'Unknown Location',
            ];
        });
    }

    public static function extractTokenInfo(?Request $request): array
    {
        if (!$request) {
            return ['token_type' => null, 'token_preview' => null];
        }

        $mask = function (string $raw): string {
            $clean = trim($raw);
            $len = strlen($clean);
            if ($len === 0) return '';
            $hashShort = substr(hash('sha256', $clean), 0, 10);
            if ($len <= 10) {
                return substr($clean, 0, 3) . '*** (sha256:' . $hashShort . ')';
            }
            return substr($clean, 0, 6) . '...' . substr($clean, -4) . ' (sha256:' . $hashShort . ')';
        };

        if ($bearer = $request->bearerToken()) {
            return ['token_type' => 'Bearer Token', 'token_preview' => $mask($bearer)];
        }
        if ($csrf = $request->header('X-CSRF-TOKEN')) {
            return ['token_type' => 'X-CSRF-TOKEN', 'token_preview' => $mask((string) $csrf)];
        }
        if ($xsrf = $request->header('X-XSRF-TOKEN')) {
            return ['token_type' => 'X-XSRF-TOKEN', 'token_preview' => $mask((string) $xsrf)];
        }
        if ($inputToken = $request->input('_token')) {
            return ['token_type' => 'Form CSRF Token', 'token_preview' => $mask((string) $inputToken)];
        }
        if ($request->hasSession()) {
            $sid = $request->session()->getId();
            if ($sid) {
                return ['token_type' => 'Session Cookie', 'token_preview' => $mask($sid)];
            }
        }
        $cookieSession = $request->cookie(config('session.cookie', 'laravel_session'));
        if ($cookieSession) {
            return ['token_type' => 'Session Cookie', 'token_preview' => $mask((string) $cookieSession)];
        }

        return ['token_type' => 'None', 'token_preview' => null];
    }

    public static function resolveTargetFeature(string $path): string
    {
        $p = strtolower($path);
        if (str_contains($p, 'login') || str_contains($p, 'register') || str_contains($p, 'auth') || str_contains($p, 'switch-role')) return 'Authentication / Multi-Role Login';
        if (str_contains($p, 'backup')) return 'Database Backup & Recovery';
        if (str_contains($p, 'pnpki')) return 'PNPKI E-Signature Registry';
        if (str_contains($p, 'supplier-evaluation') || str_contains($p, 'supplierevaluation') || str_contains($p, 'supplier')) return 'Supplier Evaluation System';
        if (str_contains($p, 'monitoring')) return 'OPPMO Real-Time Monitoring System';
        if (str_contains($p, 'pims') || str_contains($p, 'purchase-request')) return 'PIMS / Purchase Requests';
        if (str_contains($p, 'attachment') || str_contains($p, 'signature')) return 'File Upload / Attachments / E-Sign';
        if (str_contains($p, 'ppmp') || str_contains($p, 'market-scoping') || str_contains($p, 'app-data')) return 'E-Procurement PPMP / APP / Market Scoping';
        if (str_contains($p, 'portal-systems') || str_contains($p, 'oppmo-team')) return 'Portal Systems & Landing Catalog';
        if (str_contains($p, 'account-codes') || str_contains($p, 'fund-sources') || str_contains($p, 'procurement-modes') || str_contains($p, 'offices') || str_contains($p, 'program-names')) return 'Master Data & Governance';
        if (str_contains($p, 'user')) return 'User Management';
        if (str_contains($p, 'system-settings') || str_contains($p, 'security')) return 'System Security Controls';
        if (str_contains($p, '.env') || str_contains($p, '.git') || str_contains($p, 'wp-') || str_contains($p, 'phpmyadmin')) return 'Server Config / Exploit Probe';
        return 'Platform Endpoint';
    }

    public static function recordThreat(
        ?Request $request,
        string $threatType,
        string $severity,
        string $attackVector,
        array $extra = []
    ): ?SecurityThreatLog {
        try {
            if (!Schema::hasTable('security_threat_logs')) {
                return null;
            }

            $ip = $extra['ip_address'] ?? self::resolveRealIp($request);
            $geo = self::resolveGeoLocation($ip);
            $tokenInfo = self::extractTokenInfo($request);
            $user = $extra['user'] ?? ($request?->user() ?? Auth::user());
            $endpoint = $extra['endpoint'] ?? ($request ? '/' . ltrim($request->path(), '/') : '/cli');
            $method = $extra['http_method'] ?? ($request ? $request->method() : 'CLI');
            $isRedAlert = (bool) ($extra['is_red_alert'] ?? ($severity === 'critical'));

            $log = SecurityThreatLog::create([
                'threat_type' => $threatType,
                'severity' => $severity,
                'is_red_alert' => $isRedAlert,
                'user_id' => $user?->id,
                'user_email' => $extra['user_email'] ?? $user?->email ?? $request?->input('email'),
                'ip_address' => $ip,
                'forwarded_ips' => $request?->header('X-Forwarded-For') ? Str::limit((string) $request->header('X-Forwarded-For'), 250, '') : null,
                'country' => $geo['country'],
                'region' => $geo['region'],
                'city' => $geo['city'],
                'isp' => $geo['isp'],
                'latitude' => $geo['latitude'],
                'longitude' => $geo['longitude'],
                'http_method' => $method,
                'endpoint' => Str::limit($endpoint, 490, ''),
                'target_feature' => $extra['target_feature'] ?? self::resolveTargetFeature($endpoint),
                'token_type' => $extra['token_type'] ?? $tokenInfo['token_type'],
                'token_preview' => $extra['token_preview'] ?? $tokenInfo['token_preview'],
                'user_agent' => $request ? Str::limit((string) $request->userAgent(), 1000, '') : 'CLI',
                'attack_vector' => $attackVector,
                'payload_summary' => $extra['payload_summary'] ?? null,
                'status_code' => $extra['status_code'] ?? null,
            ]);

            if ($isRedAlert && Schema::hasTable('system_notifications')) {
                $superAdmins = User::withRole('super_admin')->where('is_active', true)->get(['id']);
                foreach ($superAdmins as $sa) {
                    SystemNotification::notify(
                        $sa->id,
                        "RED ALERT: {$threatType}",
                        "{$attackVector} | Real IP: {$ip} ({$geo['label']}) | Endpoint: {$method} {$endpoint}",
                        null,
                        'danger'
                    );
                }
            }

            return $log;
        } catch (\Throwable $e) {
            return null;
        }
    }

    public static function backupDeletedRecord(Model $model, bool $isForceDelete = false, ?Request $request = null): void
    {
        try {
            if (!Schema::hasTable('deleted_data_backups')) {
                return;
            }

            $user = $request?->user() ?? Auth::user();
            $ip = self::resolveRealIp($request);
            $geo = self::resolveGeoLocation($ip);

            $attrs = $model->getAttributes();

            $label = $attrs['tracking_number']
                ?? $attrs['title']
                ?? $attrs['name']
                ?? $attrs['email']
                ?? $attrs['original_name']
                ?? ($model->getTable() . ' #' . $model->getKey());

            DeletedDataBackup::create([
                'table_name' => $model->getTable(),
                'model_class' => get_class($model),
                'record_id' => (string) $model->getKey(),
                'record_uuid' => $attrs['uuid'] ?? null,
                'record_label' => Str::limit((string) $label, 240, ''),
                'is_force_delete' => $isForceDelete,
                'deleted_by' => $user?->id,
                'deleted_by_name' => $user?->name ?? 'System / Unauthenticated',
                'ip_address' => $ip,
                'location' => $geo['label'],
                'payload' => json_encode($attrs, JSON_UNESCAPED_UNICODE),
            ]);

            $actorKey = $user?->id ? "user:{$user->id}" : "ip:{$ip}";
            $cacheKey = "sec_delete_velocity:{$actorKey}";
            $count = (int) Cache::get($cacheKey, 0) + 1;
            Cache::put($cacheKey, $count, self::MASS_DELETE_WINDOW_SECONDS);

            if ($count >= self::MASS_DELETE_THRESHOLD) {
                $alertCooldownKey = "sec_mass_delete_alerted:{$actorKey}";
                if (!Cache::has($alertCooldownKey)) {
                    Cache::put($alertCooldownKey, true, self::MASS_DELETE_WINDOW_SECONDS);

                    self::recordThreat(
                        $request,
                        'MASS_DELETE_RED_ALERT',
                        'critical',
                        "RED ALERT: Rapid deletion detected ({$count} records deleted within 5 minutes, latest: {$model->getTable()} #{$model->getKey()}). Emergency auto-backup triggered.",
                        [
                            'is_red_alert' => true,
                            'user' => $user,
                            'target_feature' => 'Database Integrity / Mass Deletion Guard',
                            'payload_summary' => [
                                'deleted_count_5min' => $count,
                                'latest_table' => $model->getTable(),
                                'latest_record_id' => $model->getKey(),
                                'is_force_delete' => $isForceDelete,
                            ],
                        ]
                    );

                    self::createDatabaseBackupSnapshot(
                        'mass_delete_emergency',
                        $user?->id,
                        "Emergency auto-backup triggered by Mass-Delete Red Alert ({$count} deletions in 5 min by " . ($user?->email ?? $ip) . ")."
                    );
                }
            }
        } catch (\Throwable $e) {

        }
    }

    public static function createDatabaseBackupSnapshot(
        string $triggerType = 'scheduled_15day',
        ?int $triggeredBy = null,
        ?string $notes = null
    ): ?ScheduledDatabaseBackup {
        try {
            if (!Schema::hasTable('scheduled_database_backups')) {
                return null;
            }

            $timestamp = now()->format('Y-m-d_His');
            $filename = "auto_backup_{$triggerType}_{$timestamp}.sql";
            $storagePath = "auto_backups/{$filename}";
            $driver = DB::connection()->getDriverName();

            $sqlLines = [
                "-- Automated Database Backup Snapshot",
                "-- Trigger: {$triggerType}",
                "-- Generated At: " . now()->toDateTimeString(),
                "-- Driver: {$driver}",
                "",
            ];

            $omittedDataTables = [
                'sessions',
                'cache',
                'cache_locks',
                'failed_jobs',
                'job_batches',
                'personal_access_tokens',
                'password_reset_tokens',
            ];

            if ($driver === 'mysql' || $driver === 'mariadb') {
                $sqlLines[] = "SET FOREIGN_KEY_CHECKS=0;";
                $tables = array_map('current', DB::select('SHOW TABLES'));
                foreach ($tables as $table) {
                    $createRow = DB::select("SHOW CREATE TABLE `{$table}`");
                    if (!empty($createRow)) {
                        $arr = (array) $createRow[0];
                        $createSql = $arr['Create Table'] ?? end($arr);
                        $sqlLines[] = "\nDROP TABLE IF EXISTS `{$table}`;";
                        $sqlLines[] = $createSql . ";";
                    }

                    if (in_array($table, $omittedDataTables, true)) {
                        continue;
                    }

                    $rows = DB::table($table)->get();
                    foreach ($rows as $row) {
                        $rowArr = (array) $row;
                        $cols = implode('`, `', array_keys($rowArr));
                        $vals = array_map(function ($v) {
                            if ($v === null) return 'NULL';
                            return DB::getPdo()->quote((string) $v);
                        }, array_values($rowArr));
                        $sqlLines[] = "INSERT INTO `{$table}` (`{$cols}`) VALUES (" . implode(', ', $vals) . ");";
                    }
                }
                $sqlLines[] = "\nSET FOREIGN_KEY_CHECKS=1;";
            } else {

                $tables = DB::select("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'");
                foreach ($tables as $t) {
                    $table = $t->name;
                    if (in_array($table, $omittedDataTables, true)) {
                        continue;
                    }
                    $count = DB::table($table)->count();
                    $sqlLines[] = "-- Table `{$table}` ({$count} rows)";
                }
            }

            $content = implode("\n", $sqlLines);
            Storage::disk('local')->put($storagePath, $content);
            $sizeBytes = strlen($content);

            $record = ScheduledDatabaseBackup::create([
                'filename' => $filename,
                'storage_path' => $storagePath,
                'size_bytes' => $sizeBytes,
                'trigger_type' => $triggerType,
                'triggered_by' => $triggeredBy,
                'notes' => $notes,
            ]);

            SystemSetting::set('last_auto_db_backup_at', now()->toIso8601String());

            return $record;
        } catch (\Throwable $e) {
            return null;
        }
    }
}
