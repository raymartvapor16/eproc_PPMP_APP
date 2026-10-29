<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PpmpSignatory extends Model
{
    use HasFactory;

    protected $fillable = [
        'signatory_type',
        'name',
        'position',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'is_active' => 'boolean',
        ];
    }

    // Scopes & In-Memory Cache
    protected static ?\Illuminate\Support\Collection $activeCache = null;

    public static function flushCache(): void
    {
        static::$activeCache = null;
    }

    public static function getActiveSignatories(): \Illuminate\Support\Collection
    {
        if (static::$activeCache === null) {
            static::$activeCache = static::where('is_active', true)->get();
        }
        return static::$activeCache;
    }

    protected static function booted(): void
    {
        static::saved(fn() => static::flushCache());
        static::deleted(fn() => static::flushCache());
    }

    public function scopeBudgetRequirement(Builder $query): Builder
    {
        return $query->where('signatory_type', 'budget_requirement');
    }

    public function scopePaccoRequirement(Builder $query): Builder
    {
        return $query->where('signatory_type', 'pacco_requirement');
    }

    public function scopeBacSecretariat(Builder $query): Builder
    {
        return $query->where('signatory_type', 'bac_secretariat');
    }

    public function scopeApprovedBy(Builder $query): Builder
    {
        return $query->where('signatory_type', 'approved_by');
    }

    public function scopeAppPreparedBy(Builder $query): Builder
    {
        return $query->where('signatory_type', 'app_prepared_by');
    }

    public function scopeAppReviewedBy(Builder $query): Builder
    {
        return $query->where('signatory_type', 'app_reviewed_by');
    }

    public function scopeAppRecommending(Builder $query): Builder
    {
        return $query->where('signatory_type', 'app_recommending');
    }

    public function scopeAppApprovedBy(Builder $query): Builder
    {
        return $query->where('signatory_type', 'app_approved_by');
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }
}
