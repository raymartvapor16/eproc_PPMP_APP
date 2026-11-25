<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SupplierDigitalApproval extends Model
{
    use HasFactory;

    protected $table = 'supplier_digital_approvals';

    protected $fillable = [
        'evaluation_id',
        'signed_by',
        'authorize_id',
        'full_name',
        'designation',
        'role',
        'image',
    ];

    protected $appends = [
        'image_url',
        'signature_url',
        'signed_by_encrypted',
    ];

    public function getSignedByEncryptedAttribute(): ?string
    {
        return $this->signed_by ? User::encryptId((int) $this->signed_by) : null;
    }

    public function evaluation()
    {
        return $this->belongsTo(SupplierEvaluation::class, 'evaluation_id');
    }

    public function authorize()
    {
        return $this->belongsTo(SupplierAuthorize::class, 'authorize_id');
    }

    public function signer()
    {
        return $this->belongsTo(User::class, 'signed_by');
    }

    public function getSignatureUrlAttribute()
    {
        if (!$this->signer) {
            return null;
        }

        if ($this->signer->signature_path) {
            return asset('storage/' . ltrim($this->signer->signature_path, '/'));
        }

        return null;
    }

    public function getImageUrlAttribute()
    {
        if (!$this->image) {
            return null;
        }

        if (str_starts_with($this->image, 'data:image') || str_starts_with($this->image, 'http')) {
            return $this->image;
        }

        return asset(ltrim($this->image, '/'));
    }
}
