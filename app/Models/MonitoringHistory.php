<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MonitoringHistory extends Model
{
    use HasFactory;

    protected $fillable = [
        'monitoring_project_id',
        'step_id',
        'user_id',
        'action',
        'division',
        'description',
        'metadata',
    ];

    protected $casts = [
        'metadata' => 'array',
    ];

    public function project()
    {
        return $this->belongsTo(MonitoringProject::class, 'monitoring_project_id');
    }

    public function step()
    {
        return $this->belongsTo(MonitoringStep::class, 'step_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
