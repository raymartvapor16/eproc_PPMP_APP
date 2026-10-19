<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Ppmp extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'parent_id',
        'tracking_number',
        'ppmp_number',
        'office_id',
        'implementing_unit',
        'program_name',
        'created_by',
        'title',
        'source_of_fund',
        'account_code',
        'fiscal_year',
        'plan_type',
        'is_annual',
        'delivery_period',
        'place_of_delivery',
        'payment_method',
        'additional_condition',
        'warranty_and_other_terms',
        'attachment_list_data',
        'app_data',
        'total_budget',
        'status',
        'amendment_status',
        'amendment_type',
        'amendment_scope',
        'amendment_reason',
        'requested_amendment_type',
        'requested_amendment_scope',
        'requested_amendment_reason',
        'amendment_requested_at',
        'amendment_approved_at',
        'prepared_at',
        'head_submitted_at',
        'head_approved_at',
        'review_submitted_at',
        'budget_received_at',
        'budget_approved_at',
        'pacco_received_at',
        'pacco_approved_at',
        'oppmo_received_at',
        'oppmo_approved_at',
        'twg_received_at',
        'twg_approved_at',
        'ready_to_print_at',
        'head_received_at',
        'enduser_received_at',
        'admin_received_at',
    ];

    protected $casts = [
        'is_annual' => 'boolean',
        'attachment_list_data' => 'array',
        'app_data' => 'array',
        'total_budget' => 'decimal:2',
        'amendment_requested_at' => 'datetime',
        'amendment_approved_at' => 'datetime',
        'prepared_at' => 'datetime',
        'head_submitted_at' => 'datetime',
        'head_received_at' => 'datetime',
        'head_approved_at' => 'datetime',
        'review_submitted_at' => 'datetime',
        'budget_received_at' => 'datetime',
        'budget_approved_at' => 'datetime',
        'pacco_received_at' => 'datetime',
        'pacco_approved_at' => 'datetime',
        'oppmo_received_at' => 'datetime',
        'oppmo_approved_at' => 'datetime',
        'twg_received_at' => 'datetime',
        'twg_approved_at' => 'datetime',
        'ready_to_print_at' => 'datetime',
        'enduser_received_at' => 'datetime',
        'admin_received_at' => 'datetime',
    ];

    public function isTrustFund(): bool
    {
        if ($this->source_of_fund) {
            static $routeCache = [];
            if (!array_key_exists($this->source_of_fund, $routeCache)) {
                $fundSource = FundSource::where('name', $this->source_of_fund)->first();
                $routeCache[$this->source_of_fund] = $fundSource ? $fundSource->workflow_route : null;
            }

            if ($routeCache[$this->source_of_fund] !== null) {
                return $routeCache[$this->source_of_fund] === 'pacco';
            }

            if (stripos($this->source_of_fund, 'trust') !== false) {
                return true;
            }
        }

        if ($this->relationLoaded('items')) {
            return $this->items->contains(function ($item) {
                return $item->source_of_fund && stripos($item->source_of_fund, 'trust') !== false;
            });
        }

        return $this->items()->where('source_of_fund', 'like', '%trust%')->exists();
    }

    protected $appends = ['default_signatories', 'pre_submission_checks'];

    public function hasAppGenerated(): bool
    {
        if (!empty($this->app_data) && is_array($this->app_data)) {
            if (!empty($this->app_data['rows']) || !empty($this->app_data['is_generated']) || !empty($this->app_data['saved_at']) || count($this->app_data) > 0) {
                return true;
            }
        }

        $atts = $this->relationLoaded('attachments') ? $this->attachments : $this->attachments()->get();
        return $atts->contains(function ($att) {
            $filename = $att->original_filename ?? $att->file_name ?? '';
            $isPdf = ($att->mime_type === 'application/pdf') || str_ends_with(strtolower($filename), '.pdf');
            return $isPdf && ($att->attachment_type === 'APP_DOCUMENT' || stripos($filename, 'app') !== false);
        });
    }

    public function hasAttachmentListGenerated(): bool
    {
        if (!empty($this->attachment_list_data) && is_array($this->attachment_list_data)) {
            if (!empty($this->attachment_list_data['rows']) || !empty($this->attachment_list_data['attachment_lists']) || !empty($this->attachment_list_data['is_generated']) || !empty($this->attachment_list_data['saved_at']) || count($this->attachment_list_data) > 0) {
                return true;
            }
        }

        $atts = $this->relationLoaded('attachments') ? $this->attachments : $this->attachments()->get();
        return $atts->contains(function ($att) {
            $filename = $att->original_filename ?? $att->file_name ?? '';
            $isPdf = ($att->mime_type === 'application/pdf') || str_ends_with(strtolower($filename), '.pdf');
            return $isPdf && ($att->attachment_type === 'ATTACHMENT_LIST_DOC' || stripos($filename, 'attachment') !== false);
        });
    }

    public function hasMarketScopingPdf(): bool
    {
        $atts = $this->relationLoaded('attachments') ? $this->attachments : $this->attachments()->get();

        if ($atts->isEmpty() && $this->parent_id) {
            $ancestorIds = [];
            $curr = $this->parent;
            while ($curr && count($ancestorIds) < 10) {
                $ancestorIds[] = $curr->id;
                $curr = $curr->parent;
            }
            if (!empty($ancestorIds)) {
                $atts = PpmpAttachment::whereIn('ppmp_id', $ancestorIds)->get();
            }
        }

        return $atts->contains(function ($att) {
            $filename = $att->original_filename ?? $att->file_name ?? '';
            $isPdf = ($att->mime_type === 'application/pdf') || str_ends_with(strtolower($filename), '.pdf');
            if (!$isPdf) return false;

            if ($att->attachment_type === 'MARKET_SCOPING') {
                return true;
            }

            $fname = strtolower($filename);
            return str_contains($fname, 'market') || str_contains($fname, 'scoping');
        });
    }

    public function getPreSubmissionChecksAttribute(): array
    {
        $app = $this->hasAppGenerated();
        $attachmentList = $this->hasAttachmentListGenerated();
        $marketScoping = $this->hasMarketScopingPdf();
        // APP is created exclusively by OPPMO reviewer after BAC-TWG review
        $isReady = $attachmentList && $marketScoping;

        return [
            'app_generated' => $app,
            'attachment_list_generated' => $attachmentList,
            'market_scoping_attached' => $marketScoping,
            'can_submit' => $isReady,
            'is_ready' => $isReady,
        ];
    }

    public function getDefaultSignatoriesAttribute(): array
    {
        static $cachedSignatories = null;
        if ($cachedSignatories === null) {
            $signatories = \App\Models\PpmpSignatory::where('is_active', true)->get();
            $budget = $signatories->firstWhere('signatory_type', 'budget_requirement');
            $pacco = $signatories->firstWhere('signatory_type', 'pacco_requirement');
            $bac = $signatories->firstWhere('signatory_type', 'bac_secretariat');
            $gov = $signatories->firstWhere('signatory_type', 'approved_by');

            // APP specific signatories
            $appPrepared = $signatories->firstWhere('signatory_type', 'app_prepared_by');
            $appReviewed = $signatories->firstWhere('signatory_type', 'app_reviewed_by');
            $appRecommending = $signatories->firstWhere('signatory_type', 'app_recommending');
            $appApproved = $signatories->firstWhere('signatory_type', 'app_approved_by');

            $cachedSignatories = [
                'budget_requirement' => [
                    'name' => $budget ? $budget->name : 'DESSAMIE BUAT-SANCHEZ, CPA, JD',
                    'position' => $budget ? $budget->position : 'PGDH - PBO / BAC - Chairman',
                ],
                'pacco_requirement' => [
                    'name' => $pacco ? $pacco->name : 'MAY FERNANDO-UY, CPA',
                    'position' => $pacco ? $pacco->position : 'Provincial Accountant',
                ],
                'bac_secretariat' => [
                    'name' => $bac ? $bac->name : 'NORJANNA M. CAMAGUIN, MPA',
                    'position' => $bac ? $bac->position : 'PGDH - OPPMO',
                ],
                'approved_by' => [
                    'name' => $gov ? $gov->name : 'HON. YVONNE R. CAGAS',
                    'position' => $gov ? $gov->position : 'Provincial Governor',
                ],
                'app_prepared_by' => [
                    'name' => $appPrepared ? $appPrepared->name : 'GINA MAE B. CARBAQUEL',
                    'position' => $appPrepared ? $appPrepared->position : 'ADAS II',
                ],
                'app_reviewed_by' => [
                    'name' => $appReviewed ? $appReviewed->name : ($bac ? $bac->name : 'NORJANNA M. CAMAGUIN, MPA'),
                    'position' => $appReviewed ? $appReviewed->position : ($bac ? $bac->position : 'PGDH - OPPMO'),
                ],
                'app_recommending' => [
                    'name' => $appRecommending ? $appRecommending->name : ($budget ? $budget->name : 'DESSAMIE BUAT-SANCHEZ, CPA, JD'),
                    'position' => $appRecommending ? $appRecommending->position : ($budget ? $budget->position : 'PGDH - PBO / BAC - Chairman'),
                ],
                'app_approved_by' => [
                    'name' => $appApproved ? $appApproved->name : ($gov ? $gov->name : 'HON. YVONNE R. CAGAS'),
                    'position' => $appApproved ? $appApproved->position : ($gov ? $gov->position : 'Provincial Governor'),
                ],
            ];
        }
        return $cachedSignatories;
    }

    public function getAppDataAttribute($value)
    {
        $data = is_string($value) ? json_decode($value, true) : $value;
        if (!is_array($data)) {
            return $data;
        }

        $defaultSignatories = $this->default_signatories;
        $appPrepared = $defaultSignatories['app_prepared_by'] ?? null;
        $appReviewed = $defaultSignatories['app_reviewed_by'] ?? null;

        // If legacy data had Norjanna saved under prepared_by_name before Gina Mae was introduced,
        // automatically route Norjanna to reviewed_by and set prepared_by to active DB signatory (Gina Mae).
        $isLegacyNorjanna = !empty($data['prepared_by_name']) && (
            $data['prepared_by_name'] === 'NORJANNA M. CAMAGUIN, MPA' ||
            (isset($appReviewed['name']) && $data['prepared_by_name'] === $appReviewed['name'])
        ) && (empty($data['reviewed_by_name']) || $data['reviewed_by_name'] === $data['prepared_by_name']);

        if ($isLegacyNorjanna) {
            $data['reviewed_by_name'] = $appReviewed['name'] ?? 'NORJANNA M. CAMAGUIN, MPA';
            $data['reviewed_by_position'] = $appReviewed['position'] ?? 'PGDH - OPPMO';
            $data['prepared_by_name'] = $appPrepared['name'] ?? 'GINA MAE B. CARBAQUEL';
            $data['prepared_by_position'] = $appPrepared['position'] ?? 'ADAS II';
        }

        return $data;
    }

    public function parent()
    {
        return $this->belongsTo(Ppmp::class, 'parent_id');
    }

    public function children()
    {
        return $this->hasMany(Ppmp::class, 'parent_id');
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
        return $this->hasMany(PpmpItem::class, 'ppmp_id');
    }

    public function attachments()
    {
        return $this->hasMany(PpmpAttachment::class, 'ppmp_id');
    }

    public function reviews()
    {
        return $this->hasMany(PpmpReview::class, 'ppmp_id');
    }

    public function signatures()
    {
        return $this->hasMany(PpmpSignature::class, 'ppmp_id');
    }

    public function routes()
    {
        return $this->hasMany(PpmpRoute::class, 'ppmp_id');
    }

    public function changeLogs()
    {
        return $this->hasMany(PpmpChangeLog::class, 'ppmp_id');
    }

    public function notifications()
    {
        return $this->hasMany(SystemNotification::class, 'ppmp_id');
    }

    public function monitoringProjects()
    {
        return $this->hasMany(MonitoringProject::class, 'ppmp_id');
    }
}
