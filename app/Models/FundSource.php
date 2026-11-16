<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class FundSource extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'code',
        'workflow_route',
        'category',
        'description',
        'is_active',
        'display_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'display_order' => 'integer',
    ];

    /**
     * Relationship to PPMPs linked to this fund source.
     */
    public function ppmps()
    {
        return $this->hasMany(Ppmp::class, 'fund_source_id');
    }

    /**
     * Relationship to individual PPMP items linked to this fund source.
     */
    public function ppmpItems()
    {
        return $this->hasMany(PpmpItem::class, 'fund_source_id');
    }

    /**
     * Check if this fund source routes to PACCO as a Trust Fund.
     */
    public function isTrustFund(): bool
    {
        return $this->workflow_route === 'pacco' || stripos($this->category ?? '', 'trust') !== false;
    }

    /**
     * Scope a query to only include active fund sources.
     *
     * @param Builder $query
     * @return Builder
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    /**
     * Scope a query to order by display_order then name.
     *
     * @param Builder $query
     * @return Builder
     */
    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('display_order', 'asc')->orderBy('name', 'asc');
    }
}
