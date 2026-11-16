<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class ProgramName extends Model
{
    use HasFactory;

    protected $table = 'program_names';

    protected $fillable = [
        'name',
        'responsibility_center',
        'sector',
        'is_active',
        'display_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'display_order' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
    ];

    /**
     * Relationship to PPMP records.
     */
    public function ppmps(): HasMany
    {
        return $this->hasMany(Ppmp::class, 'program_name_id');
    }

    /**
     * Scope: Only active program names.
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope: Apply search and sector/status filters.
     */
    public function scopeFilter(Builder $query, array $filters): Builder
    {
        if (!empty($filters['search'])) {
            $term = trim($filters['search']);
            $query->where(function (Builder $q) use ($term) {
                $q->where('name', 'LIKE', "%{$term}%")
                  ->orWhere('responsibility_center', 'LIKE', "%{$term}%")
                  ->orWhere('sector', 'LIKE', "%{$term}%");
            });
        }

        if (!empty($filters['sector']) && $filters['sector'] !== 'ALL') {
            $query->where('sector', $filters['sector']);
        }

        if (isset($filters['status']) && $filters['status'] !== 'all') {
            $isActive = $filters['status'] === 'active' || $filters['status'] === '1' || $filters['status'] === true;
            $query->where('is_active', $isActive);
        }

        return $query;
    }
}

