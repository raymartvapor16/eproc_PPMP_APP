<?php

namespace App\Traits;

use App\Services\SecurityThreatService;

trait AutoBackupsOnDelete
{
    public static function bootAutoBackupsOnDelete(): void
    {
        static::deleting(function ($model) {
            $isForceDelete = method_exists($model, 'isForceDeleting')
                ? (bool) $model->isForceDeleting()
                : true;

            SecurityThreatService::backupDeletedRecord($model, $isForceDelete, request());
        });
    }
}
