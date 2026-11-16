<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PpmpCellComment extends Model
{
    use HasFactory;

    protected $fillable = [
        'ppmp_id',
        'item_id',
        'item_no',
        'field_key',
        'field_label',
        'cell_value',
        'comment',
        'reviewer_id',
        'reviewer_name',
        'reviewer_role',
        'status',
        'compliance_note',
        'complied_by',
        'complied_at',
    ];

    protected $casts = [
        'item_no' => 'integer',
        'complied_at' => 'datetime',
    ];

    public function ppmp()
    {
        return $this->belongsTo(Ppmp::class, 'ppmp_id');
    }

    public function item()
    {
        return $this->belongsTo(PpmpItem::class, 'item_id');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewer_id');
    }

    public function compliedByUser()
    {
        return $this->belongsTo(User::class, 'complied_by');
    }
}

