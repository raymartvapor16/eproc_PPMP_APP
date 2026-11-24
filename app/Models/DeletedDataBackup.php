<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DeletedDataBackup extends Model
{
    protected $table = 'deleted_data_backups';

    protected $fillable = [
        'table_name',
        'model_class',
        'record_id',
        'record_uuid',
        'record_label',
        'is_force_delete',
        'deleted_by',
        'deleted_by_name',
        'ip_address',
        'location',
        'payload',
        'restored_at',
        'restored_by',
    ];

    protected $casts = [
        'is_force_delete' => 'boolean',
        'restored_at' => 'datetime',
    ];

    public function deleter(): BelongsTo
    {
        return $this->belongsTo(User::class, 'deleted_by');
    }

    public function restorer(): BelongsTo
    {
        return $this->belongsTo(User::class, 'restored_by');
    }
}
