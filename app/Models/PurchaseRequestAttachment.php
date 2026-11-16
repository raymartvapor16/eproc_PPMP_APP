<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Str;

class PurchaseRequestAttachment extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'purchase_request_id',
        'uploaded_by',
        'attachment_type',
        'original_filename',
        'stored_filename',
        'storage_path',
        'file_size',
        'mime_type',
        'external_url',
        'link_title',
    ];

    protected $casts = [
        'file_size' => 'integer',
    ];

    protected static function booted()
    {
        static::creating(function ($model) {
            if (empty($model->uuid)) {
                $model->uuid = (string) Str::uuid();
            }
        });
    }

    public function purchaseRequest()
    {
        return $this->belongsTo(PurchaseRequest::class, 'purchase_request_id');
    }

    public function uploader()
    {
        return $this->belongsTo(User::class, 'uploaded_by');
    }
}

