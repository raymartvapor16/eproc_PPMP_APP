<?php

namespace App\Models;

use App\Models\Concerns\UsesSupplierEvalConnection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SupplierEvaluationCriteria extends Model
{
    use HasFactory, UsesSupplierEvalConnection;

    protected $table = 'supplier_evaluation_criteria';

    protected $fillable = [
        'criteria_name',
    ];

    public function criteriaScores()
    {
        return $this->hasMany(SupplierCriteriaScore::class, 'criteria_id');
    }
}

