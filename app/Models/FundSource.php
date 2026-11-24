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

    public function ppmps()
    {
        return $this->hasMany(Ppmp::class, 'fund_source_id');
    }

    public function ppmpItems()
    {
        return $this->hasMany(PpmpItem::class, 'fund_source_id');
    }

    public function isTrustFund(): bool
    {
        return $this->workflow_route === 'pacco' || stripos($this->category ?? '', 'trust') !== false;
    }

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('is_active', true);
    }

    public function scopeOrdered(Builder $query): Builder
    {
        return $query->orderBy('display_order', 'asc')->orderBy('name', 'asc');
    }
}
