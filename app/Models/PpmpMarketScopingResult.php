<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PpmpMarketScopingResult extends Model
{
    use HasFactory;

    protected $table = 'ppmp_market_scoping_results';

    protected $fillable = [
        'market_scoping_id',
        'parameter_code',
        'considered',
        'recommendations',
        'sort_order',
    ];

    protected $casts = [
        'sort_order' => 'integer',
    ];

    public function marketScoping(): BelongsTo
    {
        return $this->belongsTo(PpmpMarketScoping::class, 'market_scoping_id');
    }
}
