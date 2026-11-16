<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class PurchaseRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'ppmp_id',
        'ppmp_attachment_list_id',
        'monitoring_project_id',
        'office_id',
        'tracker_id',
        'pr_number',
        'date_published',
        'pr_date',
        'department',
        'section',
        'source',
        'category',
        'procurement_mode',
        'purpose',
        'place_of_delivery',
        'delivery_period',
        'payment_method',
        'charges',
        'green_specifications',
        'pr_certification_date',
        'total_cost',
        'requested_by_name',
        'requested_by_designation',
        'cash_availability_name',
        'cash_availability_designation',
        'approved_by_name',
        'approved_by_designation',
        'direct_end_user_name',
        'direct_end_user_designation',
        'direct_end_user_signed_at',
        'current_stage',
        'status',
        'remarks',
        'created_by',
    ];

    protected $casts = [
        'total_cost' => 'decimal:2',
        'date_published' => 'date',
        'pr_date' => 'date',
        'pr_certification_date' => 'date',
        'direct_end_user_signed_at' => 'date',
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

    public function ppmpAttachmentList()
    {
        return $this->belongsTo(PpmpAttachmentList::class, 'ppmp_attachment_list_id');
    }

    public function monitoringProject()
    {
        return $this->belongsTo(MonitoringProject::class, 'monitoring_project_id');
    }

    public function office()
    {
        return $this->belongsTo(Office::class, 'office_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function items()
    {
        return $this->hasMany(PurchaseRequestItem::class, 'purchase_request_id')->orderBy('sort_order')->orderBy('id');
    }

    public function routes()
    {
        return $this->hasMany(PurchaseRequestRoute::class, 'purchase_request_id')->orderBy('id', 'desc');
    }

    public function attachments()
    {
        return $this->hasMany(PurchaseRequestAttachment::class, 'purchase_request_id')->orderBy('id', 'asc');
    }
}

