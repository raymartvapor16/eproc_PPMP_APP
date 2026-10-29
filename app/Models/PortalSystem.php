<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PortalSystem extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'description',
        'link_url',
        'badge',
        'icon',
        'color',
        'status',
        'sort_order',
        'is_external',
    ];

    protected $casts = [
        'sort_order' => 'integer',
        'is_external' => 'boolean',
    ];

    /**
     * Scope a query to only include active portal systems.
     *
     * @param Builder $query
     * @return Builder
     */
    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', 'active')->orderBy('sort_order', 'asc');
    }
}
