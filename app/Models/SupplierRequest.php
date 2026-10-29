<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SupplierRequest extends Model
{
    use HasFactory;

    protected $table = 'supplier_requests';

    protected $fillable = [
        'evaluation_id',
        'user_id',
        'requested_to',
        'request_type',
        'reason',
        'status',
        'request_date',
        'status_date',
    ];

    protected $casts = [
        'request_date' => 'datetime:Y-m-d',
        'status_date'  => 'datetime:Y-m-d',
    ];

    // Creator
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    // Receiver (administrator / pgso / etc)
    public function receiver()
    {
        return $this->belongsTo(User::class, 'requested_to');
    }

    public function evaluation()
    {
        return $this->belongsTo(SupplierEvaluation::class, 'evaluation_id');
    }
}

