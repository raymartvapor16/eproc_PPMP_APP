<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SupplierAuthorize extends Model
{
    use HasFactory;

    protected $table = 'supplier_authorizes';

    protected $fillable = [
        'pdf_id',
        'evaluation_id',
        'user_id',
        'office_id',
    ];

    public function evaluation()
    {
        return $this->belongsTo(SupplierEvaluation::class, 'evaluation_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function office()
    {
        return $this->belongsTo(Office::class, 'office_id');
    }

    public function pdf()
    {
        return $this->belongsTo(SupplierPdf::class, 'pdf_id');
    }

    // Accessor for PDF status
    public function getStatusAttribute()
    {
        return $this->pdf ? $this->pdf->status : null;
    }
}

