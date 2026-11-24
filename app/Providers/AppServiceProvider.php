<?php

namespace App\Providers;

use App\Services\SecurityThreatService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Event;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{

    public function register(): void
    {

    }

    public function boot(): void
    {

        Event::listen('eloquent.deleting: *', function (string $eventName, array $data) {
            $model = $data[0] ?? null;
            if (!$model instanceof Model) {
                return;
            }

            $excluded = [
                \App\Models\DeletedDataBackup::class,
                \App\Models\SecurityThreatLog::class,
                \App\Models\ScheduledDatabaseBackup::class,
                \App\Models\AuditLog::class,
                \App\Models\SystemNotification::class,
                \App\Models\PpmpChangeLog::class,
                \App\Models\PpmpMarketScopingActivity::class,
                \App\Models\PpmpMarketScopingResult::class,
                \App\Models\SupplierActivityLog::class,
            ];

            if (in_array(get_class($model), $excluded, true)) {
                return;
            }

            $isForceDelete = method_exists($model, 'isForceDeleting')
                ? (bool) $model->isForceDeleting()
                : true;

            SecurityThreatService::backupDeletedRecord($model, $isForceDelete, request());
        });
    }
}
