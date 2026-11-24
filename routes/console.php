<?php

use App\Models\SystemSetting;
use App\Services\SecurityThreatService;
use Carbon\Carbon;
use Illuminate\Foundation\Inspiring;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\Schedule;

Artisan::command('inspire', function () {
    $this->comment(Inspiring::quote());
})->purpose('Display an inspiring quote');

Artisan::command('db:auto-backup-15days {--force : Force backup immediately regardless of 15-day interval}', function () {
    $lastBackup = SystemSetting::get('last_auto_db_backup_at');
    $force = (bool) $this->option('force');

    if (!$force && $lastBackup) {
        $daysElapsed = Carbon::parse($lastBackup)->diffInDays(now());
        if ($daysElapsed < SecurityThreatService::AUTO_BACKUP_INTERVAL_DAYS) {
            $remaining = SecurityThreatService::AUTO_BACKUP_INTERVAL_DAYS - $daysElapsed;
            $this->info("Skipping auto-backup: {$daysElapsed} day(s) since last backup ({$remaining} day(s) remaining).");
            return;
        }
    }

    $snapshot = SecurityThreatService::createDatabaseBackupSnapshot(
        'scheduled_15day',
        null,
        'Scheduled automatic 15-day full database backup.'
    );

    if ($snapshot) {
        $this->info("15-day auto-backup created: {$snapshot->filename} ({$snapshot->size_bytes} bytes)");
    } else {
        $this->error('Failed to create 15-day automatic database backup.');
    }
})->purpose('Automatically back up the database every 15 days');

Schedule::command('db:auto-backup-15days')->dailyAt('02:00');
