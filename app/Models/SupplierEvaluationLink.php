<?php

namespace App\Models;

use App\Models\Concerns\UsesSupplierEvalConnection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Str;

class SupplierEvaluationLink extends Model
{
    use HasFactory, UsesSupplierEvalConnection;

    protected $table = 'supplier_evaluation_links';

    protected $fillable = [
        'evaluation_id',
        'token',
        'code',
        'is_used',
        'expires_at',
    ];

    protected $casts = [
        'is_used'    => 'boolean',
        'expires_at' => 'datetime',
    ];

    protected static function boot()
    {
        parent::boot();

        static::creating(function ($link) {
            if (empty($link->token)) {
                $link->token = Str::random(64);
            }
        });
    }

    public function evaluation(): BelongsTo
    {
        return $this->belongsTo(SupplierEvaluation::class, 'evaluation_id');
    }

    public function scopeActive($query)
    {
        return $query->where('is_used', 0)
            ->where(function ($q) {
                $q->whereNull('expires_at')
                  ->orWhere('expires_at', '>', now());
            });
    }
}
