<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DeletedDataBackup;
use App\Models\ScheduledDatabaseBackup;
use App\Models\SecurityThreatLog;
use App\Models\SystemSetting;
use App\Services\SecurityThreatService;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SecurityThreatController extends Controller
{
    protected function authorizeSuperAdmin(Request $request)
    {
        $user = $request->user();
        if (!$user || !$user->isSuperAdmin()) {
            abort(403, 'Unauthorized. Super Administrator access strictly required.');
        }
        return $user;
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizeSuperAdmin($request);

        $query = SecurityThreatLog::with(['user:id,name,email,role', 'resolver:id,name'])
            ->latest('id');

        if ($request->filled('threat_type') && $request->input('threat_type') !== 'ALL') {
            $query->where('threat_type', $request->input('threat_type'));
        }
        if ($request->filled('severity') && $request->input('severity') !== 'ALL') {
            $query->where('severity', $request->input('severity'));
        }
        if ($request->boolean('red_alert_only')) {
            $query->where('is_red_alert', true);
        }
        if ($request->filled('search')) {
            $q = '%' . trim((string) $request->input('search')) . '%';
            $query->where(function ($sub) use ($q) {
                $sub->where('ip_address', 'like', $q)
                    ->orWhere('endpoint', 'like', $q)
                    ->orWhere('token_preview', 'like', $q)
                    ->orWhere('attack_vector', 'like', $q)
                    ->orWhere('city', 'like', $q)
                    ->orWhere('country', 'like', $q)
                    ->orWhere('user_email', 'like', $q)
                    ->orWhere('user_agent', 'like', $q);
            });
        }

        $logs = $query->limit(300)->get();

        $summary = [
            'total_threats' => SecurityThreatLog::count(),
            'red_alerts_active' => SecurityThreatLog::where('is_red_alert', true)->where('is_resolved', false)->count(),
            'unique_ips' => SecurityThreatLog::whereNotNull('ip_address')->distinct('ip_address')->count('ip_address'),
            'cli_token_probes' => SecurityThreatLog::whereIn('threat_type', ['CLI_API_PROBING', 'TOKEN_PROBING', 'SESSION_HIJACK'])->count(),
            'file_upload_attacks' => SecurityThreatLog::where('threat_type', 'FILE_UPLOAD_ATTACK')->count(),
            'brute_force_events' => SecurityThreatLog::where('threat_type', 'BRUTE_FORCE')->count(),
            'deleted_backups_count' => DeletedDataBackup::count(),
            'scheduled_backups_count' => ScheduledDatabaseBackup::count(),
        ];

        $lastAutoBackupAt = SystemSetting::get('last_auto_db_backup_at');
        $nextScheduledAt = $lastAutoBackupAt
            ? Carbon::parse($lastAutoBackupAt)->addDays(SecurityThreatService::AUTO_BACKUP_INTERVAL_DAYS)->toIso8601String()
            : now()->addDays(SecurityThreatService::AUTO_BACKUP_INTERVAL_DAYS)->toIso8601String();

        return response()->json([
            'logs' => $logs,
            'summary' => $summary,
            'auto_backup_schedule' => [
                'interval_days' => SecurityThreatService::AUTO_BACKUP_INTERVAL_DAYS,
                'last_auto_backup_at' => $lastAutoBackupAt,
                'next_scheduled_at' => $nextScheduledAt,
            ],
        ]);
    }

    public function resolve(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeSuperAdmin($request);
        $log = SecurityThreatLog::findOrFail($id);
        $log->update([
            'is_resolved' => true,
            'resolved_by' => $user->id,
            'resolved_at' => now(),
        ]);

        return response()->json([
            'message' => 'Security threat alert marked as resolved.',
            'log' => $log->fresh(['user:id,name,email,role', 'resolver:id,name']),
        ]);
    }

    public function deletedBackups(Request $request): JsonResponse
    {
        $this->authorizeSuperAdmin($request);

        $query = DeletedDataBackup::with(['deleter:id,name,email', 'restorer:id,name'])
            ->latest('id');

        if ($request->filled('table_name') && $request->input('table_name') !== 'ALL') {
            $query->where('table_name', $request->input('table_name'));
        }
        if ($request->filled('search')) {
            $q = '%' . trim((string) $request->input('search')) . '%';
            $query->where(function ($sub) use ($q) {
                $sub->where('record_label', 'like', $q)
                    ->orWhere('table_name', 'like', $q)
                    ->orWhere('deleted_by_name', 'like', $q)
                    ->orWhere('ip_address', 'like', $q);
            });
        }

        return response()->json([
            'backups' => $query->limit(200)->get(),
        ]);
    }

    public function restoreDeletedBackup(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeSuperAdmin($request);
        $backup = DeletedDataBackup::findOrFail($id);

        if ($backup->restored_at) {
            return response()->json(['message' => 'This record has already been restored.'], 422);
        }

        $table = $backup->table_name;
        if (!Schema::hasTable($table)) {
            return response()->json(['message' => "Target table '{$table}' does not exist."], 422);
        }

        $payload = json_decode($backup->payload, true);
        if (!is_array($payload) || empty($payload)) {
            return response()->json(['message' => 'Backup payload is invalid or empty.'], 422);
        }

        $existingCols = Schema::getColumnListing($table);
        $insertData = array_intersect_key($payload, array_flip($existingCols));
        if (array_key_exists('deleted_at', $insertData)) {
            $insertData['deleted_at'] = null;
        }

        if (isset($insertData['id']) && DB::table($table)->where('id', $insertData['id'])->exists()) {
            DB::table($table)->where('id', $insertData['id'])->update($insertData);
        } else {
            DB::table($table)->insert($insertData);
        }

        $backup->update([
            'restored_at' => now(),
            'restored_by' => $user->id,
        ]);

        return response()->json([
            'message' => "Record '{$backup->record_label}' restored to '{$table}' successfully.",
            'backup' => $backup->fresh(['deleter:id,name,email', 'restorer:id,name']),
        ]);
    }

    public function scheduledBackups(Request $request): JsonResponse
    {
        $this->authorizeSuperAdmin($request);

        $backups = ScheduledDatabaseBackup::with('triggerUser:id,name,email')
            ->latest('id')
            ->limit(100)
            ->get();

        $lastAutoBackupAt = SystemSetting::get('last_auto_db_backup_at');
        $nextScheduledAt = $lastAutoBackupAt
            ? Carbon::parse($lastAutoBackupAt)->addDays(SecurityThreatService::AUTO_BACKUP_INTERVAL_DAYS)->toIso8601String()
            : now()->addDays(SecurityThreatService::AUTO_BACKUP_INTERVAL_DAYS)->toIso8601String();

        return response()->json([
            'backups' => $backups,
            'interval_days' => SecurityThreatService::AUTO_BACKUP_INTERVAL_DAYS,
            'last_auto_backup_at' => $lastAutoBackupAt,
            'next_scheduled_at' => $nextScheduledAt,
        ]);
    }

    public function runBackupNow(Request $request): JsonResponse
    {
        $user = $this->authorizeSuperAdmin($request);

        $snapshot = SecurityThreatService::createDatabaseBackupSnapshot(
            'manual',
            $user->id,
            "Manual snapshot triggered by Super Admin ({$user->email})."
        );

        if (!$snapshot) {
            return response()->json(['message' => 'Failed to create database backup snapshot.'], 500);
        }

        return response()->json([
            'message' => "Database backup snapshot '{$snapshot->filename}' created successfully.",
            'backup' => $snapshot->load('triggerUser:id,name,email'),
        ], 201);
    }

    public function downloadScheduledBackup(Request $request, int $id): StreamedResponse|JsonResponse
    {
        $this->authorizeSuperAdmin($request);
        $backup = ScheduledDatabaseBackup::findOrFail($id);

        if (!Storage::disk('local')->exists($backup->storage_path)) {
            return response()->json(['message' => 'Backup file not found in secure storage.'], 404);
        }

        return Storage::disk('local')->download($backup->storage_path, $backup->filename, [
            'Content-Type' => 'application/sql',
        ]);
    }
}
