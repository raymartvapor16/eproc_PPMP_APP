<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class PpmpMarketScoping extends Model
{
    use HasFactory;

    protected $table = 'ppmp_market_scopings';

    protected $fillable = [
        'ppmp_id',
        'procuring_entity',
        'implementing_unit',
        'representative_name_designation',
        'project_name',
        'estimated_budget',
        'scoping_period_from',
        'scoping_period_to',
        'expected_delivery_date',
        'prepared_by_name',
        'prepared_by_position',
        'prepared_by_date',
        'approved_by_name',
        'approved_by_position',
        'approved_by_date',
        'created_by',
        'updated_by',
    ];

    protected $casts = [
        'estimated_budget' => 'decimal:2',
    ];

    public function ppmp(): BelongsTo
    {
        return $this->belongsTo(Ppmp::class, 'ppmp_id');
    }

    public function activities(): HasMany
    {
        return $this->hasMany(PpmpMarketScopingActivity::class, 'market_scoping_id')->orderBy('sort_order');
    }

    public function results(): HasMany
    {
        return $this->hasMany(PpmpMarketScopingResult::class, 'market_scoping_id')->orderBy('sort_order');
    }

    public function creator(): BelongsTo
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function updater(): BelongsTo
    {
        return $this->belongsTo(User::class, 'updated_by');
    }
}
