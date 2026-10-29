<?php

namespace App\Models;

use Carbon\Carbon;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Ppmp extends Model
{
    use HasFactory;

    public static array $milestoneFields = [
        'prepared_at',
        'head_submitted_at',
        'head_received_at',
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
        'enduser_received_at',
        'admin_received_at',
    ];

    public static array $amendmentFields = [
        'amendment_status',
        'requested_amendment_type',
        'requested_amendment_reason',
        'requested_amendment_scope',
        'amendment_type',
        'amendment_reason',
        'amendment_scope',
        'amendment_requested_at',
        'amendment_approved_at',
    ];

    protected $with = ['milestones', 'amendment'];

    protected array $pendingMilestoneAttributes = [];
    protected array $pendingAmendmentAttributes = [];

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
    ];

    public function setAttribute($key, $value)
    {
        if (in_array($key, self::$milestoneFields, true)) {
            $this->pendingMilestoneAttributes[$key] = $value;
            if ($this->relationLoaded('milestones') && $this->milestones) {
                $this->milestones->setAttribute($key, $value);
            }
            return $this;
        }

        if (in_array($key, self::$amendmentFields, true)) {
            $this->pendingAmendmentAttributes[$key] = $value;
            if ($this->relationLoaded('amendment') && $this->amendment) {
                $this->amendment->setAttribute($key, $value);
            }
            return $this;
        }

        return parent::setAttribute($key, $value);
    }

    public function getAttribute($key)
    {
        if (in_array($key, self::$milestoneFields, true)) {
            if (array_key_exists($key, $this->pendingMilestoneAttributes)) {
                $val = $this->pendingMilestoneAttributes[$key];
                return $val ? Carbon::parse($val) : null;
            }

            return $this->milestones?->getAttribute($key);
        }

        if (in_array($key, self::$amendmentFields, true)) {
            if (array_key_exists($key, $this->pendingAmendmentAttributes)) {
                $val = $this->pendingAmendmentAttributes[$key];
                if (in_array($key, ['amendment_requested_at', 'amendment_approved_at'], true) && $val) {
                    return Carbon::parse($val);
                }
                return $val;
            }

            return $this->amendment?->getAttribute($key);
        }

        return parent::getAttribute($key);
    }

    public function update(array $attributes = [], array $options = [])
    {
        $milestoneUpdates = [];
        $amendmentUpdates = [];
        $ppmpUpdates = [];

        foreach ($attributes as $key => $value) {
            if (in_array($key, self::$milestoneFields, true)) {
                $milestoneUpdates[$key] = $value;
            } elseif (in_array($key, self::$amendmentFields, true)) {
                $amendmentUpdates[$key] = $value;
            } else {
                $ppmpUpdates[$key] = $value;
            }
        }

        $saved = true;
        if (!empty($ppmpUpdates)) {
            $saved = parent::update($ppmpUpdates, $options);
        }

        if (!empty($milestoneUpdates)) {
            $milestone = ($this->relationLoaded('milestones') && $this->milestones && $this->milestones->exists)
                ? $this->milestones
                : PpmpMilestone::firstOrCreate(['ppmp_id' => $this->id]);
            $milestone->update($milestoneUpdates);
            $this->setRelation('milestones', $milestone);
        }

        if (!empty($amendmentUpdates)) {
            $amendment = ($this->relationLoaded('amendment') && $this->amendment && $this->amendment->exists)
                ? $this->amendment
                : PpmpAmendment::firstOrCreate(['ppmp_id' => $this->id]);
            $amendment->update($amendmentUpdates);
            $this->setRelation('amendment', $amendment);
        }

        return $saved;
    }

    public function save(array $options = [])
    {
        $saved = parent::save($options);

        if ($saved && $this->exists) {
            if (!empty($this->pendingMilestoneAttributes)) {
                $milestone = ($this->relationLoaded('milestones') && $this->milestones && $this->milestones->exists)
                    ? $this->milestones
                    : PpmpMilestone::firstOrCreate(['ppmp_id' => $this->id]);
                $milestone->update($this->pendingMilestoneAttributes);
                $this->pendingMilestoneAttributes = [];
                $this->setRelation('milestones', $milestone);
            }

            if (!empty($this->pendingAmendmentAttributes)) {
                $amendment = ($this->relationLoaded('amendment') && $this->amendment && $this->amendment->exists)
                    ? $this->amendment
                    : PpmpAmendment::firstOrCreate(['ppmp_id' => $this->id]);
                $amendment->update($this->pendingAmendmentAttributes);
                $this->pendingAmendmentAttributes = [];
                $this->setRelation('amendment', $amendment);
            }
        }

        return $saved;
    }

    protected static function booted()
    {
        static::created(function ($ppmp) {
            $milestoneData = array_merge(
                ['ppmp_id' => $ppmp->id],
                $ppmp->pendingMilestoneAttributes ?? []
            );
            $milestone = PpmpMilestone::firstOrCreate(['ppmp_id' => $ppmp->id], $milestoneData);
            if (!$milestone->wasRecentlyCreated && !empty($ppmp->pendingMilestoneAttributes)) {
                $milestone->update($ppmp->pendingMilestoneAttributes);
            }
            $ppmp->pendingMilestoneAttributes = [];
            $ppmp->setRelation('milestones', $milestone);

            $amendmentData = array_merge(
                ['ppmp_id' => $ppmp->id],
                $ppmp->pendingAmendmentAttributes ?? []
            );
            $amendment = PpmpAmendment::firstOrCreate(['ppmp_id' => $ppmp->id], $amendmentData);
            if (!$amendment->wasRecentlyCreated && !empty($ppmp->pendingAmendmentAttributes)) {
                $amendment->update($ppmp->pendingAmendmentAttributes);
            }
            $ppmp->pendingAmendmentAttributes = [];
            $ppmp->setRelation('amendment', $amendment);
        });

        static::saved(function ($ppmp) {
            try {
                if (class_exists(\App\Models\MonitoringProject::class)) {
                    \App\Models\MonitoringProject::syncFromPpmp($ppmp);
                }
            } catch (\Throwable $e) {
                // Defensive: prevent PPMP workflow failures on logging or sync exceptions
            }
        });
    }

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

    protected $appends = [
        'default_signatories',
        'pre_submission_checks',
        'is_published_to_pims',
        'pims_published_at',
    ];

    public function toArray()
    {
        $array = parent::toArray();
        $serializedMilestones = $array['milestones'] ?? null;
        foreach (self::$milestoneFields as $field) {
            if (!array_key_exists($field, $this->pendingMilestoneAttributes) && is_array($serializedMilestones) && array_key_exists($field, $serializedMilestones)) {
                $array[$field] = $serializedMilestones[$field];
            } else {
                $val = $this->getAttribute($field);
                $array[$field] = $val instanceof \DateTimeInterface ? $this->serializeDate($val) : $val;
            }
        }
        $serializedAmendment = $array['amendment'] ?? null;
        foreach (self::$amendmentFields as $field) {
            if (!array_key_exists($field, $this->pendingAmendmentAttributes) && is_array($serializedAmendment) && array_key_exists($field, $serializedAmendment)) {
                $array[$field] = $serializedAmendment[$field];
            } else {
                $val = $this->getAttribute($field);
                $array[$field] = $val instanceof \DateTimeInterface ? $this->serializeDate($val) : $val;
            }
        }
        if (str_ends_with($this->status ?? '', '_RETURNED')) {
            $array['latest_return_remarks'] = $this->getLatestReturnRemarks();
        } else {
            $array['latest_return_remarks'] = null;
        }
        return $array;
    }

    public function getLatestReturnRemarks(): ?array
    {
        // 1. Check reviews
        if ($this->relationLoaded('reviews')) {
            $review = $this->reviews
                ->filter(fn ($r) => $r->action === 'return' || str_ends_with((string) $r->status_after, '_RETURNED'))
                ->sortByDesc('acted_at')
                ->first();
        } else {
            $review = $this->reviews()
                ->with('reviewer')
                ->where(function ($q) {
                    $q->where('action', 'return')
                      ->orWhere('status_after', 'like', '%_RETURNED');
                })
                ->latest('acted_at')
                ->first();
        }

        if ($review && !empty($review->remarks)) {
            return [
                'remarks' => $review->remarks,
                'reviewer_name' => $review->reviewer?->name,
                'reviewer_role' => $review->reviewer_role,
                'acted_at' => $review->acted_at ? $review->acted_at->toIso8601String() : null,
                'status_after' => $review->status_after,
            ];
        }

        // 2. Fallback to routes
        if ($this->relationLoaded('routes')) {
            $route = $this->routes
                ->filter(fn ($r) => str_ends_with((string) $r->action, '_RETURNED') || str_ends_with((string) $r->status, '_RETURNED'))
                ->sortByDesc('acted_at')
                ->first();
        } else {
            $route = $this->routes()
                ->with('fromUser')
                ->where(function ($q) {
                    $q->where('action', 'like', '%_RETURNED')
                      ->orWhere('status', 'like', '%_RETURNED');
                })
                ->latest('acted_at')
                ->first();
        }

        if ($route && !empty($route->remarks)) {
            return [
                'remarks' => $route->remarks,
                'reviewer_name' => $route->fromUser?->name,
                'reviewer_role' => $route->from_role,
                'acted_at' => ($route->acted_at ?? $route->submitted_at) ? ($route->acted_at ?? $route->submitted_at)->toIso8601String() : null,
                'status_after' => $route->status,
            ];
        }

        return null;
    }

    public function hasAppGenerated(): bool
    {
        $raw = $this->attributes['app_data'] ?? null;
        $data = is_string($raw) ? json_decode($raw, true) : $raw;
        if (!empty($data) && is_array($data)) {
            // If explicitly marked as needing regeneration due to amendments or line-item changes
            if (!empty($data['needs_regeneration'])) {
                return false;
            }
            if (!empty($data['is_generated'])) {
                return true;
            }
            if (!empty($data['rows']) && count($data['rows']) > 0) {
                return true;
            }
        }

        return false;
    }

    public function hasAttachmentListGenerated(): bool
    {
        $raw = $this->attributes['attachment_list_data'] ?? null;
        $data = is_string($raw) ? json_decode($raw, true) : $raw;
        if (!empty($data) && is_array($data)) {
            if (!empty($data['rows']) || !empty($data['attachment_lists']) || !empty($data['is_generated']) || !empty($data['saved_at']) || count($data) > 0) {
                return true;
            }
        }

        $atts = $this->relationLoaded('attachments') ? $this->attachments : $this->attachments()->get();
        return $atts->contains(function ($att) {
            $filename = $att->original_filename ?? $att->file_name ?? '';
            $isPdf = ($att->mime_type === 'application/pdf') || str_ends_with(strtolower($filename), '.pdf');
            return $isPdf && $att->attachment_type === 'ATTACHMENT_LIST_DOC';
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
        $signatories = \App\Models\PpmpSignatory::getActiveSignatories();
        $budget = $signatories->firstWhere('signatory_type', 'budget_requirement');
        $pacco = $signatories->firstWhere('signatory_type', 'pacco_requirement');
        $bac = $signatories->firstWhere('signatory_type', 'bac_secretariat');
        $gov = $signatories->firstWhere('signatory_type', 'approved_by');

        // APP specific signatories
        $appPrepared = $signatories->firstWhere('signatory_type', 'app_prepared_by');
        $appReviewed = $signatories->firstWhere('signatory_type', 'app_reviewed_by');
        $appRecommending = $signatories->firstWhere('signatory_type', 'app_recommending');
        $appApproved = $signatories->firstWhere('signatory_type', 'app_approved_by');

        return [
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

    /**
     * Get the app_data attribute with legacy signatory backfill applied.
     *
     * @param mixed $value
     * @return mixed
     */
    public function getAppDataAttribute(mixed $value): mixed
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

        // Normalize rows in app_data: if PPMP has a program, End-User or Implementing Unit cell
        // displays "(Implementing Office / Unit data) - (Program data)". If no program, displays Implementing Office / Unit data.
        if (!empty($data['rows']) && is_array($data['rows'])) {
            $unit = trim((string)($this->implementing_unit ?? ($this->relationLoaded('office') ? ($this->office?->name ?? '') : '')));
            $prog = trim((string)($this->program_name ?? ''));
            $expectedEndUser = ($unit !== '' && $prog !== '')
                ? "{$unit} - {$prog}"
                : ($unit !== '' ? $unit : ($prog !== '' ? $prog : 'Implementing Unit'));

            foreach ($data['rows'] as &$row) {
                if (!isset($row['endUser'])) {
                    $row['endUser'] = $expectedEndUser;
                    continue;
                }
                $currentEndUser = trim((string)$row['endUser']);
                if (
                    $currentEndUser === '' ||
                    strcasecmp($currentEndUser, 'implementing unit') === 0 ||
                    ($prog !== '' && strcasecmp($currentEndUser, $prog) === 0) ||
                    ($unit !== '' && $prog !== '' && strcasecmp($currentEndUser, $unit) === 0)
                ) {
                    $row['endUser'] = $expectedEndUser;
                }
            }
            unset($row);
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

    public function milestones()
    {
        return $this->hasOne(PpmpMilestone::class, 'ppmp_id')->withDefault();
    }

    public function amendment()
    {
        return $this->hasOne(PpmpAmendment::class, 'ppmp_id')->withDefault();
    }

    public function getIsPublishedToPimsAttribute(): bool
    {
        if ($this->relationLoaded('monitoringProjects')) {
            if ($this->monitoringProjects->where('pims_status', 'PUBLISHED')->isNotEmpty()) {
                return true;
            }
            if (empty($this->tracking_number)) {
                return false;
            }
            return MonitoringProject::getPublishedDateByTracker($this->tracking_number) !== false;
        }

        return MonitoringProject::where(function ($q) {
            $q->where('ppmp_id', $this->id);
            if (!empty($this->tracking_number)) {
                $q->orWhere('pr_number', $this->tracking_number);
            }
        })->where('pims_status', 'PUBLISHED')->exists();
    }

    public function getPimsPublishedAtAttribute(): ?string
    {
        if ($this->relationLoaded('monitoringProjects')) {
            $proj = $this->monitoringProjects->where('pims_status', 'PUBLISHED')->first();
            if ($proj) {
                return $proj->pims_published_at?->toIso8601String();
            }
            if (empty($this->tracking_number)) {
                return null;
            }
            $date = MonitoringProject::getPublishedDateByTracker($this->tracking_number);
            if ($date === false || $date === null) {
                return null;
            }
            return is_string($date) ? $date : (method_exists($date, 'toIso8601String') ? $date->toIso8601String() : (string) $date);
        }

        $date = MonitoringProject::where(function ($q) {
            $q->where('ppmp_id', $this->id);
            if (!empty($this->tracking_number)) {
                $q->orWhere('pr_number', $this->tracking_number);
            }
        })->where('pims_status', 'PUBLISHED')->value('pims_published_at');

        return $date ? (is_string($date) ? $date : (method_exists($date, 'toIso8601String') ? $date->toIso8601String() : (string) $date)) : null;
    }
}
