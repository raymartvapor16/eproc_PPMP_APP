<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;

class MonitoringProject extends Model
{
    use HasFactory;

    protected $fillable = [
        'uuid',
        'ppmp_id',
        'project_title',
        'category',
        'procurement_mode',
        'abc_amount',
        'pr_number',
        'pims_pr_id',
        'office_id',
        'implementing_unit',
        'end_user_name',
        'pims_published_at',
        'pims_status',
        'current_division',
        'status',
        'remarks',
        'created_by',
    ];

    protected $casts = [
        'abc_amount' => 'decimal:2',
        'pims_published_at' => 'datetime',
    ];

    protected $appends = [
        'is_amended',
        'is_supplemental',
        'amendment_type',
        'amendment_badge',
        'amendment_history',
    ];

    protected static ?array $publishedTrackerCache = null;
    protected static array $amendmentHistoryCache = [];

    public static function flushCache(): void
    {
        static::$publishedTrackerCache = null;
        static::$amendmentHistoryCache = [];
    }

    public static function getPublishedDateByTracker(string $tracker): mixed
    {
        if (static::$publishedTrackerCache === null) {
            static::$publishedTrackerCache = static::where('pims_status', 'PUBLISHED')
                ->whereNotNull('pr_number')
                ->pluck('pims_published_at', 'pr_number')
                ->all();
        }

        return array_key_exists($tracker, static::$publishedTrackerCache)
            ? static::$publishedTrackerCache[$tracker]
            : false;
    }

    protected static function booted()
    {
        static::creating(function ($project) {
            if (empty($project->uuid)) {
                $project->uuid = (string) Str::uuid();
            }
        });

        static::saved(fn () => static::flushCache());
        static::deleted(fn () => static::flushCache());
    }

    public function ppmp()
    {
        return $this->belongsTo(Ppmp::class, 'ppmp_id');
    }

    public function office()
    {
        return $this->belongsTo(Office::class, 'office_id');
    }

    public function creator()
    {
        return $this->belongsTo(User::class, 'created_by');
    }

    public function steps()
    {
        return $this->hasMany(MonitoringStep::class, 'monitoring_project_id')->orderBy('step_order')->orderBy('id');
    }

    public function histories()
    {
        return $this->hasMany(MonitoringHistory::class, 'monitoring_project_id')->latest();
    }

    public function getIsAmendedAttribute(): bool
    {
        $type = $this->amendment_type;
        return $type === 'AMENDMENT' || (!empty($this->ppmp?->parent_id) && $type !== 'SUPPLEMENTAL') || count($this->amendment_history) > 1;
    }

    public function getIsSupplementalAttribute(): bool
    {
        return $this->amendment_type === 'SUPPLEMENTAL';
    }

    public function getAmendmentTypeAttribute(): ?string
    {
        if ($this->ppmp) {
            if (!empty($this->ppmp->amendment_type)) {
                return $this->ppmp->amendment_type;
            }
            if ($this->ppmp->parent && !empty($this->ppmp->parent->amendment_type)) {
                return $this->ppmp->parent->amendment_type;
            }
            if ($this->ppmp->amendment && !empty($this->ppmp->amendment->amendment_type)) {
                return $this->ppmp->amendment->amendment_type;
            }
            if (!empty($this->ppmp->parent_id)) {
                return 'AMENDMENT';
            }
        }
        return null;
    }

    public function getAmendmentBadgeAttribute(): ?string
    {
        if ($this->is_supplemental) {
            return 'SUPPLEMENTAL PPMP';
        }
        if ($this->is_amended) {
            return 'AMENDED PPMP';
        }
        return null;
    }

    public function getAmendmentHistoryAttribute(): array
    {
        $trackerNo = $this->pr_number ?: $this->ppmp?->tracking_number;
        if (!$trackerNo && !$this->ppmp_id) {
            return [];
        }

        $cacheKey = ($trackerNo ?: 'NO_TRACKER') . ':' . ($this->ppmp_id ?: '0');
        if (array_key_exists($cacheKey, static::$amendmentHistoryCache)) {
            return static::$amendmentHistoryCache[$cacheKey];
        }

        $query = Ppmp::without(['milestones'])->with('amendment');
        if (!empty($trackerNo)) {
            $query->where('tracking_number', $trackerNo);
        } else {
            $ppmpId = $this->ppmp_id;
            $query->where(function ($q) use ($ppmpId) {
                $q->where('id', $ppmpId)->orWhere('parent_id', $ppmpId);
            });
        }

        $family = $query->orderBy('id', 'asc')->get();
        if ($family->count() <= 1 && empty($family->first()?->parent_id) && empty($family->first()?->amendment_type)) {
            return static::$amendmentHistoryCache[$cacheKey] = [];
        }

        return static::$amendmentHistoryCache[$cacheKey] = $family->map(function ($p, $index) {
            $isRoot = empty($p->parent_id) && $index === 0;
            $type = $p->amendment_type ?: ($isRoot ? 'ORIGINAL' : 'AMENDMENT');
            return [
                'id' => $p->id,
                'uuid' => $p->uuid,
                'version_number' => $index + 1,
                'version_label' => $isRoot ? 'Original Baseline' : ($type === 'SUPPLEMENTAL' ? 'Supplemental Revision' : "Amended PPMP (v" . ($index + 1) . ")"),
                'type' => $type,
                'status' => $p->status,
                'total_budget' => $p->total_budget,
                'title' => $p->title,
                'updated_at' => $p->updated_at?->toIso8601String(),
                'is_current' => $p->id === $this->ppmp_id,
            ];
        })->values()->toArray();
    }

    /**
     * Initializes default workflow steps for all 4 OPPMO divisions
     */
    public function initializeDefaultSteps(): void
    {
        // 1. PR Division Steps
        $prSteps = [
            'Monitor the create, publish (approve/suspended) to the PIMS system',
            'Releasing PR documents to the end-user',
            'Receive PR documents from the end-user',
            'Review PR documents (approve/suspend - if suspend need to comply)',
            'Review PR document and approved release to the Technical Division',
        ];

        foreach ($prSteps as $index => $stepName) {
            $this->steps()->create([
                'division' => 'pr_division',
                'step_name' => $stepName,
                'step_order' => $index + 1,
                'status' => $index === 0 ? 'COMPLETED' : 'PENDING',
                'action_date' => $index === 0 ? now()->toDateString() : null,
                'completed_at' => $index === 0 ? now() : null,
            ]);
        }

        // 2. Technical Division Steps
        $isCbMode = strtoupper($this->procurement_mode) === 'CB' || stripos($this->procurement_mode, 'Competitive') !== false;

        if ($isCbMode) {
            $techSteps = [
                ['name' => 'Pre-procurement conference review & bid documents preparation', 'badge' => null],
                ['name' => 'Posting of Invitation to Bid (PhilGEPS & Provincial Website)', 'badge' => null],
                ['name' => 'Pre-bid conference and issuance of supplemental bid bulletin', 'badge' => null],
                ['name' => 'Technical Working Group (TWG) bid evaluation & verification', 'badge' => null],
                ['name' => 'Release to end-user (For CB only miss sharia release the documents)', 'badge' => 'CB Only: Miss Sharia Release Documents'],
            ];
        } else {
            // Default SVP Mode
            $techSteps = [
                ['name' => 'Canvass document preparation and validation', 'badge' => null],
                ['name' => 'Canvassing / Request for Quotation (RFQ) distribution', 'badge' => null],
                ['name' => 'Receipt of supplier quotations and abstract preparation', 'badge' => null],
                ['name' => 'Technical evaluation and specification compliance check', 'badge' => null],
                ['name' => 'Release to end-user', 'badge' => null],
            ];
        }

        foreach ($techSteps as $index => $techItem) {
            $this->steps()->create([
                'division' => 'technical_division',
                'step_name' => $techItem['name'],
                'step_order' => $index + 1,
                'status' => 'PENDING',
                'special_badge' => $techItem['badge'],
            ]);
        }

        // 3. BAC Support Division Steps
        $bacSteps = [
            ['name' => 'Dropping documents by end-user', 'decision' => null],
            ['name' => 'Opening during BAC meeting and release to the TWG', 'decision' => null],
            ['name' => 'Decision making (Awarded / Re-canvass)', 'decision' => null],
            ['name' => 'BAC support received documents from the TWG (if awarded)', 'decision' => null],
            ['name' => 'Transmit to Contracting Division', 'decision' => null],
        ];

        foreach ($bacSteps as $index => $bacItem) {
            $this->steps()->create([
                'division' => 'bac_support_division',
                'step_name' => $bacItem['name'],
                'step_order' => $index + 1,
                'status' => 'PENDING',
            ]);
        }

        // 4. Contracting Division Steps
        $contractingSteps = [
            'Receipt of transmitted procurement folder from BAC Support',
            'Preparation and review of Notice of Award (NOA)',
            'Contract / Purchase Order (PO) drafting and approval',
            'Transmittal of Contract / PO and Notice to Proceed (NTP)',
            'Delivery, inspection and contract monitoring',
        ];

        foreach ($contractingSteps as $index => $stepName) {
            $this->steps()->create([
                'division' => 'contracting_division',
                'step_name' => $stepName,
                'step_order' => $index + 1,
                'status' => 'PENDING',
            ]);
        }

        // Initial History Log
        $this->histories()->create([
            'action' => 'PROJECT_CREATED',
            'division' => 'pr_division',
            'description' => "Procurement monitoring project created for {$this->project_title} ({$this->category}, Mode: {$this->procurement_mode}). Initialized all division workflows.",
            'metadata' => [
                'category' => $this->category,
                'procurement_mode' => $this->procurement_mode,
                'abc_amount' => $this->abc_amount,
            ],
        ]);
    }

    /**
     * Synchronize a family of PPMPs (root + amendments/supplementals sharing the same tracker number)
     * into a single unified monitoring project.
     *
     * @param Collection<int, Ppmp> $family
     */
    public static function syncPpmpFamily(Collection $family, bool $createIfMissing = false): ?self
    {
        if ($family->isEmpty()) {
            return null;
        }

        // Active PPMP is the latest revision (highest ID in family)
        $activePpmp = $family->sortByDesc('id')->first();
        // Baseline/Root PPMP is the original one without parent_id (or lowest ID)
        $rootPpmp = $family->whereNull('parent_id')->first() ?: $family->sortBy('id')->first();

        $familyIds = $family->pluck('id')->toArray();
        $trackerNo = $activePpmp->tracking_number ?: ($rootPpmp->tracking_number ?: $activePpmp->ppmp_number);

        // Check if there are amendments or supplementals
        $isAmended = $family->count() > 1 
            || !empty($activePpmp->parent_id) 
            || in_array($activePpmp->amendment_type, ['AMENDMENT', 'SUPPLEMENTAL'], true)
            || in_array($rootPpmp->amendment_status, ['APPROVED'], true);

        $amendmentType = $activePpmp->amendment_type 
            ?: ($rootPpmp->amendment_type 
            ?: ($family->whereNotNull('amendment_type')->first()?->amendment_type ?: ($isAmended ? 'AMENDMENT' : null)));

        // Find all existing monitoring project records for this tracker or family IDs
        $existingProjects = self::where(function ($query) use ($familyIds, $trackerNo) {
            if (!empty($trackerNo)) {
                $query->where('pr_number', $trackerNo)
                      ->orWhere('pims_pr_id', $trackerNo);
            }
            $query->orWhereIn('ppmp_id', $familyIds);
        })->orderBy('id', 'asc')->get();

        // If multiple duplicate monitoring projects exist for the same tracker, consolidate them into one
        $primary = null;
        if ($existingProjects->isNotEmpty()) {
            $primary = $existingProjects->first();
            if ($existingProjects->count() > 1) {
                foreach ($existingProjects->slice(1) as $duplicate) {
                    $duplicate->steps()->delete();
                    $duplicate->histories()->delete();
                    $duplicate->delete();
                }
            }
        }

        // Determine category: INFRA or GOODS_CONSULTING
        $category = 'GOODS_CONSULTING';
        $combinedText = strtolower(($activePpmp->title ?? '') . ' ' . ($activePpmp->general_description ?? '') . ' ' . ($trackerNo ?? ''));
        if (
            str_contains($combinedText, 'infra') || 
            str_contains($combinedText, 'construction') || 
            str_contains($combinedText, 'rehabilitation') || 
            str_contains($combinedText, 'building') || 
            str_contains($combinedText, 'concreting')
        ) {
            $category = 'INFRA';
        }

        // Determine procurement mode: CB (Competitive Bidding) or SVP
        $procurementMode = 'SVP';
        if (
            ($activePpmp->total_budget >= 500000) || 
            str_contains($combinedText, 'competitive') || 
            str_contains($combinedText, 'bidding') || 
            str_contains($combinedText, 'public bidding')
        ) {
            $procurementMode = 'CB';
        }

        if ($activePpmp->relationLoaded('items') && $activePpmp->items && $activePpmp->items->isNotEmpty()) {
            $firstItem = $activePpmp->items->first();
            if (!empty($firstItem->procurement_mode)) {
                $procurementMode = $firstItem->procurement_mode;
            }
            if (!empty($firstItem->project_type) && stripos($firstItem->project_type, 'infra') !== false) {
                $category = 'INFRA';
            }
        }

        // Map Active PPMP status to monitoring division
        $division = 'pr_division';
        $status = 'ON_GOING';

        if (in_array($activePpmp->status, ['APPROVED', 'COMPLETED'])) {
            $division = 'contracting_division';
        } elseif (in_array($activePpmp->status, ['READY_FOR_PRINTING'])) {
            $division = 'bac_support_division';
        } elseif (in_array($activePpmp->status, ['TWG_REVIEW', 'OPPMO_REVIEW'])) {
            $division = 'technical_division';
        } elseif ($activePpmp->status === 'RETURNED') {
            $status = 'SUSPENDED';
        }

        // Prepare remarks showing amendment/supplemental status
        if ($isAmended) {
            $typeLabel = $amendmentType === 'SUPPLEMENTAL' ? 'Supplemental' : 'Amended';
            $remarks = "PPMP Status: {$activePpmp->status} ({$typeLabel} PPMP)";
        } else {
            $remarks = "PPMP Status: {$activePpmp->status}";
        }

        if ($primary) {
            $updates = [
                'ppmp_id' => $activePpmp->id,
                'project_title' => $activePpmp->title ?: $primary->project_title,
                'category' => $category,
                'procurement_mode' => $procurementMode,
                'abc_amount' => $activePpmp->total_budget ?? $primary->abc_amount,
                'pr_number' => $trackerNo ?: $primary->pr_number,
                'pims_pr_id' => $primary->pims_pr_id ?: ($trackerNo ?: null),
                'office_id' => $activePpmp->office_id ?: $primary->office_id,
                'implementing_unit' => $activePpmp->implementing_unit ?: ($activePpmp->office?->name ?: $primary->implementing_unit),
                'end_user_name' => $activePpmp->creator?->name ?: $primary->end_user_name,
                'current_division' => $division,
                'status' => $status,
                'remarks' => $remarks,
            ];

            $primary->fill($updates);
            if ($primary->isDirty()) {
                $primary->save();
            }

            return $primary;
        }

        // Only create a new monitoring project if explicitly requested (e.g. publication or manual test)
        if (!$createIfMissing) {
            return null;
        }

        $project = self::create([
            'uuid' => (string) Str::uuid(),
            'ppmp_id' => $activePpmp->id,
            'project_title' => $activePpmp->title ?: ('Procurement Package #' . $activePpmp->id),
            'category' => $category,
            'procurement_mode' => $procurementMode,
            'abc_amount' => $activePpmp->total_budget ?? 0,
            'pr_number' => $trackerNo ?: ('PPMP-' . $activePpmp->id),
            'pims_pr_id' => $trackerNo ?: null,
            'office_id' => $activePpmp->office_id,
            'implementing_unit' => $activePpmp->implementing_unit ?: ($activePpmp->office?->name ?: 'Implementing Office'),
            'end_user_name' => $activePpmp->creator?->name ?: 'End User',
            'pims_published_at' => $activePpmp->created_at ?: now(),
            'pims_status' => 'PUBLISHED',
            'current_division' => $division,
            'status' => $status,
            'remarks' => $remarks,
            'created_by' => $activePpmp->created_by,
        ]);

        $project->initializeDefaultSteps();

        return $project;
    }

    /**
     * Synchronize details from an end-user PPMP for existing monitored projects only.
     * Automatically groups by tracker number/family to merge amendments and supplementals.
     */
    public static function syncFromPpmp(Ppmp $ppmp, bool $createIfMissing = false): ?self
    {
        static::flushCache();

        if (!$createIfMissing) {
            $rootId = $ppmp->parent_id ?: $ppmp->id;
            $hasMonitoredProject = self::where(function ($q) use ($ppmp, $rootId) {
                $q->whereIn('ppmp_id', array_unique(array_filter([$ppmp->id, $rootId])));
                if (!empty($ppmp->tracking_number)) {
                    $q->orWhere('pr_number', $ppmp->tracking_number)
                      ->orWhere('pims_pr_id', $ppmp->tracking_number);
                }
            })->exists();

            if (!$hasMonitoredProject) {
                return null;
            }
        }

        $family = Ppmp::where(function ($q) use ($ppmp) {
            if (!empty($ppmp->tracking_number)) {
                $q->where('tracking_number', $ppmp->tracking_number);
            }
            $rootId = $ppmp->parent_id ?: $ppmp->id;
            $q->orWhere('id', $rootId)->orWhere('parent_id', $rootId);
        })->with(['office', 'creator', 'items'])->get();

        return self::syncPpmpFamily($family, $createIfMissing);
    }

    /**
     * Synchronize all existing monitored projects linked to active PPMPs,
     * merging amended and supplemental PPMPs with the same tracker number.
     * Does NOT create monitoring projects for unpublished PPMPs.
     */
    public static function syncAllActivePpmps(): void
    {
        $ppmpIds = self::whereNotNull('ppmp_id')->pluck('ppmp_id')->filter()->toArray();
        $trackers = self::whereNotNull('pr_number')->pluck('pr_number')->filter()->toArray();

        if (empty($ppmpIds) && empty($trackers)) {
            return;
        }

        $allPpmps = Ppmp::with(['office', 'creator', 'items'])
            ->where(function ($q) use ($ppmpIds, $trackers) {
                if (!empty($ppmpIds)) {
                    $q->whereIn('id', $ppmpIds)->orWhereIn('parent_id', $ppmpIds);
                }
                if (!empty($trackers)) {
                    $q->orWhereIn('tracking_number', $trackers);
                }
            })
            ->get();

        // Group by tracking_number if present, else by root PPMP ID
        $grouped = $allPpmps->groupBy(function ($ppmp) {
            if (!empty($ppmp->tracking_number)) {
                return 'TRACKER_' . $ppmp->tracking_number;
            }
            return 'ROOT_' . ($ppmp->parent_id ?: $ppmp->id);
        });

        foreach ($grouped as $family) {
            self::syncPpmpFamily($family, false);
        }
    }
}
