<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PpmpItem extends Model
{
    use HasFactory;

    protected $fillable = [
        'ppmp_id',
        'item_no',
        'description',
        'project_type',
        'quantity_size',
        'procurement_mode',
        'pre_proc_conference',
        'start_date',
        'end_date',
        'delivery_period',
        'source_of_fund',
        'fund_source_id',
        'estimated_budget',
        'supporting_docs_text',
        'remarks',
    ];

    protected $casts = [
        'pre_proc_conference' => 'boolean',
        'estimated_budget' => 'decimal:2',
    ];

    public function ppmp()
    {
        return $this->belongsTo(Ppmp::class, 'ppmp_id');
    }

    public function fundSource()
    {
        return $this->belongsTo(FundSource::class, 'fund_source_id');
    }

    public function attachmentList()
    {
        return $this->hasOne(PpmpAttachmentList::class, 'item_id');
    }
}
