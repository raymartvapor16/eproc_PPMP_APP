<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
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

    protected static function booted()
    {
        static::creating(function ($project) {
            if (empty($project->uuid)) {
                $project->uuid = (string) Str::uuid();
            }
        });
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
     * Synchronize details from an end-user PPMP for existing monitored projects only
     */
    public static function syncFromPpmp(Ppmp $ppmp): ?self
    {
        $existing = self::where('ppmp_id', $ppmp->id)->first();
        if ($existing) {
            // Keep existing published project synchronized if title, budget, or office changed in PPMP
            $existing->update([
                'project_title' => $ppmp->title ?: $existing->project_title,
                'abc_amount' => $ppmp->total_budget ?? $existing->abc_amount,
                'pr_number' => $ppmp->tracking_number ?: ($ppmp->ppmp_number ?: $existing->pr_number),
                'office_id' => $ppmp->office_id ?: $existing->office_id,
                'implementing_unit' => $ppmp->implementing_unit ?: ($ppmp->office?->name ?: $existing->implementing_unit),
                'end_user_name' => $ppmp->creator?->name ?: $existing->end_user_name,
                'remarks' => 'PPMP Status: ' . $ppmp->status,
            ]);
            return $existing;
        }

        return null;
    }

    /**
     * Synchronize all existing monitored projects linked to PPMPs
     */
    public static function syncAllActivePpmps(): void
    {
        // Only update existing monitored projects that are linked to a PPMP
        $ppmpIds = self::whereNotNull('ppmp_id')->pluck('ppmp_id');
        $ppmps = Ppmp::with(['office', 'creator', 'items'])
            ->whereIn('id', $ppmpIds)
            ->get();

        foreach ($ppmps as $ppmp) {
            self::syncFromPpmp($ppmp);
        }
    }
}
