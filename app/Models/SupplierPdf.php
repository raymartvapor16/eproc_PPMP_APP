<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SupplierPdf extends Model
{
    use HasFactory;

    protected $table = 'supplier_pdfs';

    protected $fillable = [
        'user_id',
        'pdf_file',
        'status',
    ];

    /**
     * A PDF belongs to a user
     */
    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function authorizes()
    {
        return $this->hasMany(SupplierAuthorize::class, 'pdf_id');
    }
}

