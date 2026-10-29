<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class SupplierEvaluation extends Model
{
    use HasFactory;

    protected $table = 'supplier_evaluations';

    protected $fillable = [
        'supplier_name',
        'po_no',
        'date_evaluation',
        'office_id',
        'covered_period',
        'period_year',
        'status',
        'delete_status',
    ];

    protected $casts = [
        'date_evaluation' => 'date',
        'period_year'     => 'integer',
    ];

    // =========================
    // RELATIONSHIPS
    // =========================

    public function criteriaScores()
    {
        return $this->hasMany(SupplierCriteriaScore::class, 'evaluation_id');
    }

    public function digitalApprovals()
    {
        return $this->hasMany(SupplierDigitalApproval::class, 'evaluation_id');
    }

    public function requests()
    {
        return $this->hasMany(SupplierRequest::class, 'evaluation_id');
    }

    public function evaluationLink()
    {
        return $this->hasOne(SupplierEvaluationLink::class, 'evaluation_id');
    }

    public function latestRequest()
    {
        return $this->hasOne(SupplierRequest::class, 'evaluation_id')
            ->latestOfMany('request_date');
    }

    public function authorizes()
    {
        return $this->hasMany(SupplierAuthorize::class, 'evaluation_id');
    }

    public function office()
    {
        return $this->belongsTo(Office::class, 'office_id');
    }

    public function purchaseOrder()
    {
        return $this->belongsTo(SupplierPurchaseOrder::class, 'po_no', 'po_no');
    }

    // =========================
    // SCOPES
    // =========================

    public function scopeForUser($query, $user)
    {
        if (!$user->isAdmin() && !$user->isPgso()) {
            $query->where('office_id', $user->office_id);
        }

        return $query;
    }

    public function scopeNotDeleted($query)
    {
        return $query->where(function ($q) {
            $q->where('delete_status', 0)
              ->orWhereNull('delete_status');
        });
    }
}

