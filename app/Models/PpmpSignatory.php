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

    // Scopes
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
