<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class OppmoTeamMember extends Model
{
    use HasFactory;

    protected $fillable = [
        'name',
        'position',
        'division',
        'bio',
        'photo_url',
        'email',
        'sort_order',
        'status',
    ];

    protected $casts = [
        'sort_order' => 'integer',
    ];

    public function scopeActive(Builder $query): Builder
    {
        return $query->where('status', 'active')->orderBy('sort_order', 'asc');
    }
}
