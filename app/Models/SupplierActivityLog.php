<?php

namespace App\Models;

use App\Models\Concerns\UsesSupplierEvalConnection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SupplierActivityLog extends Model
{
    use HasFactory, UsesSupplierEvalConnection;

    protected $table = 'supplier_activity_logs';

    protected $fillable = [
        'user_id',
        'activity',
        'description',
        'role',
        'status',
        'ip_address',
        'user_agent',
    ];

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}

