<?php

namespace App\Models;

use App\Models\Concerns\UsesSupplierEvalConnection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SupplierCriteriaScore extends Model
{
    use HasFactory, UsesSupplierEvalConnection;

    protected $table = 'supplier_criteria_scores';

    protected $fillable = [
        'evaluation_id',
        'criteria_id',
        'number_rating',
        'remarks',
    ];

    public function evaluation()
    {
        return $this->belongsTo(SupplierEvaluation::class, 'evaluation_id');
    }

    public function criteria()
    {
        return $this->belongsTo(SupplierEvaluationCriteria::class, 'criteria_id');
    }
}
