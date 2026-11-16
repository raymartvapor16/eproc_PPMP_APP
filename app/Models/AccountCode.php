<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class AccountCode extends Model
{
    use HasFactory;

    protected $fillable = [
        'code',
        'name',
        'sub_code',
        'parent_name',
        'account_class',
        'full_description',
        'is_active',
        'display_order',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'display_order' => 'integer',
    ];

    /**
     * Associated PPMPs linked to this normalized account code.
     */
    public function ppmps(): HasMany
    {
        return $this->hasMany(Ppmp::class, 'account_code_id');
    }

    /**
     * Users (TWG Reviewers) assigned to this account code.
     */
    public function users()
    {
        return $this->belongsToMany(User::class, 'account_code_user')->withTimestamps();
    }

    /**
     * Scope to only active account codes.
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    /**
     * Helper to derive account class from code first digit.
     */
    public static function deriveAccountClass(?string $code): string
    {
        if (!$code) return 'Other';
        $first = $code[0];
        return match ($first) {
            '1' => 'Assets',
            '2' => 'Liabilities',
            '3' => 'Equity',
            '4' => 'Income',
            '5' => 'Expenses',
            default => 'Other',
        };
    }
}

