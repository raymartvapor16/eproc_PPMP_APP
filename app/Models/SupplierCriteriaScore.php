<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SupplierCriteriaScore extends Model
{
    use HasFactory;

    protected $table = 'supplier_criteria_scores';

    protected $fillable = [
        'evaluation_id',
        'criteria_id',
        'number_rating',
        'remarks',
    ];

    /**
     * Each score belongs to an evaluation
     */
    public function evaluation()
    {
        return $this->belongsTo(SupplierEvaluation::class, 'evaluation_id');
    }

    /**
     * Each score belongs to a criteria
     */
    public function criteria()
    {
        return $this->belongsTo(SupplierEvaluationCriteria::class, 'criteria_id');
    }
}

