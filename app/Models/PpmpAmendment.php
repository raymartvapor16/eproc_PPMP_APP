<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PpmpAmendment extends Model
{
    use HasFactory;

    protected $table = 'ppmp_amendments';

    protected $fillable = [
        'ppmp_id',
        'amendment_status',
        'requested_amendment_type',
        'requested_amendment_reason',
        'requested_amendment_scope',
        'amendment_type',
        'amendment_reason',
        'amendment_scope',
        'amendment_requested_at',
        'amendment_approved_at',
    ];

    protected $casts = [
        'amendment_requested_at' => 'datetime',
        'amendment_approved_at' => 'datetime',
    ];

    public function ppmp()
    {
        return $this->belongsTo(Ppmp::class, 'ppmp_id');
    }
}
