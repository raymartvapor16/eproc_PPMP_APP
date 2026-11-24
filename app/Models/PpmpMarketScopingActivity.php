<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PpmpMarketScopingActivity extends Model
{
    use HasFactory;

    protected $table = 'ppmp_market_scoping_activities';

    protected $fillable = [
        'market_scoping_id',
        'activity_code',
        'is_checked',
        'custom_activity_text',
        'documentation_notes',
        'sort_order',
    ];

    protected $casts = [
        'is_checked' => 'boolean',
        'sort_order' => 'integer',
    ];

    public function marketScoping(): BelongsTo
    {
        return $this->belongsTo(PpmpMarketScoping::class, 'market_scoping_id');
    }
}
