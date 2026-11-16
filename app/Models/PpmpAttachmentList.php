<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class PpmpAttachmentList extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'ppmp_id',
        'item_id',
        'item_no',
        'project_title',
        'office_name',
        'total_budget',
        'charges',
        'place_of_delivery',
        'payment_method',
        'delivery_period',
        'additional_condition',
        'other_terms',
        'rows',
        'prepared_by_name',
        'prepared_by_position',
        'submitted_by_name',
        'submitted_by_position',
        'approved_by_name',
        'approved_by_position',
        'is_approved',
    ];

    protected $casts = [
        'total_budget' => 'decimal:2',
        'rows' => 'array',
        'is_approved' => 'boolean',
    ];

    protected static function booted()
    {
        static::creating(function ($model) {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }

    public function ppmp()
    {
        return $this->belongsTo(Ppmp::class, 'ppmp_id');
    }

    public function item()
    {
        return $this->belongsTo(PpmpItem::class, 'item_id');
    }
}

