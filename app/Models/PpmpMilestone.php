<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PpmpMilestone extends Model
{
    use HasFactory;

    protected $table = 'ppmp_milestones';

    protected $fillable = [
        'ppmp_id',
        'prepared_at',
        'head_submitted_at',
        'head_received_at',
        'head_approved_at',
        'review_submitted_at',
        'budget_received_at',
        'budget_approved_at',
        'pacco_received_at',
        'pacco_approved_at',
        'oppmo_received_at',
        'oppmo_approved_at',
        'twg_received_at',
        'twg_approved_at',
        'ready_to_print_at',
        'enduser_received_at',
        'admin_received_at',
        'amendment_requested_at',
        'amendment_approved_at',
    ];

    protected $casts = [
        'prepared_at' => 'datetime',
        'head_submitted_at' => 'datetime',
        'head_received_at' => 'datetime',
        'head_approved_at' => 'datetime',
        'review_submitted_at' => 'datetime',
        'budget_received_at' => 'datetime',
        'budget_approved_at' => 'datetime',
        'pacco_received_at' => 'datetime',
        'pacco_approved_at' => 'datetime',
        'oppmo_received_at' => 'datetime',
        'oppmo_approved_at' => 'datetime',
        'twg_received_at' => 'datetime',
        'twg_approved_at' => 'datetime',
        'ready_to_print_at' => 'datetime',
        'enduser_received_at' => 'datetime',
        'admin_received_at' => 'datetime',
        'amendment_requested_at' => 'datetime',
        'amendment_approved_at' => 'datetime',
    ];

    public function ppmp()
    {
        return $this->belongsTo(Ppmp::class, 'ppmp_id');
    }
}
