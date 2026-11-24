<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ScheduledDatabaseBackup extends Model
{
    protected $table = 'scheduled_database_backups';

    protected $fillable = [
        'filename',
        'storage_path',
        'size_bytes',
        'trigger_type',
        'triggered_by',
        'notes',
    ];

    public function triggerUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'triggered_by');
    }
}
