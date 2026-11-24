<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PpmpSignature extends Model
{
    use HasFactory;

    protected $fillable = [
        'ppmp_id',
        'user_id',
        'role',
        'signature_type',
        'signature_indicator',
        'signer_name',
        'signer_designation',
        'signed_at',
        'review_id',
    ];

    protected $casts = [
        'signed_at' => 'datetime',
    ];

    protected $with = [
        'user',
    ];

    public function ppmp()
    {
        return $this->belongsTo(Ppmp::class, 'ppmp_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }
}
