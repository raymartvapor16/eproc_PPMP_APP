<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MonitoringStep extends Model
{
    use HasFactory;

    protected $fillable = [
        'monitoring_project_id',
        'division',
        'step_name',
        'step_order',
        'status',
        'decision',
        'action_date',
        'completed_at',
        'handled_by',
        'notes',
        'special_badge',
        'is_custom',
    ];

    protected $casts = [
        'action_date' => 'date',
        'completed_at' => 'datetime',
        'is_custom' => 'boolean',
    ];

    public function project()
    {
        return $this->belongsTo(MonitoringProject::class, 'monitoring_project_id');
    }
}
