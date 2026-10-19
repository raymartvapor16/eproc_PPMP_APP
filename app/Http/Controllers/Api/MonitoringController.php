<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\MonitoringHistory;
use App\Models\MonitoringProject;
use App\Models\MonitoringStep;
use App\Models\Ppmp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class MonitoringController extends Controller
{
    /**
     * Strictly restrict access to users with the 'monitor' role only
     */
    protected function authorizeMonitor(Request $request): void
    {
        if (!$request->user() || $request->user()->role !== 'monitor') {
            abort(response()->json([
                'message' => 'Forbidden. Only users with the OPPMO Monitor role can access the Monitoring System.'
            ], 403));
        }
    }

    /**
     * List all monitored procurement projects with filters
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorizeMonitor($request);

        // Accurately synchronize all active PPMPs on initial listing (skip during search queries for fast response)
        if (!$request->filled('search')) {
            MonitoringProject::syncAllActivePpmps();
        }

        $query = MonitoringProject::with(['office', 'steps', 'creator', 'ppmp'])
            ->where('pims_status', 'PUBLISHED');

        // Filter by Category: GOODS_CONSULTING or INFRA
        if ($request->filled('category') && $request->category !== 'ALL') {
            $query->where('category', $request->category);
        }

        // Filter by Mode: SVP, CB, etc.
        if ($request->filled('procurement_mode') && $request->procurement_mode !== 'ALL') {
            $query->where('procurement_mode', $request->procurement_mode);
        }

        // Filter by Current Division
        if ($request->filled('current_division') && $request->current_division !== 'ALL') {
            $query->where('current_division', $request->current_division);
        }

        // Filter by Status
        if ($request->filled('status') && $request->status !== 'ALL') {
            $query->where('status', $request->status);
        }

        // Search by project title, PPMP tracker number (pr_number / tracking_number), PIMS PR ID, end user, implementing unit
        if ($request->filled('search')) {
            $search = '%' . trim($request->search) . '%';
            $query->where(function ($q) use ($search) {
                $q->where('project_title', 'like', $search)
                  ->orWhere('pr_number', 'like', $search)
                  ->orWhere('pims_pr_id', 'like', $search)
                  ->orWhere('implementing_unit', 'like', $search)
                  ->orWhere('end_user_name', 'like', $search)
                  ->orWhereHas('ppmp', function ($pq) use ($search) {
                      $pq->where('tracking_number', 'like', $search)
                         ->orWhere('ppmp_number', 'like', $search);
                  });
            });
        }

        $projects = $query->orderBy('updated_at', 'desc')->get();

        return response()->json([
            'projects' => $projects,
        ]);
    }

    /**
     * Get single monitored project with steps and timeline histories
     */
    public function show(Request $request, string $idOrUuid): JsonResponse
    {
        $this->authorizeMonitor($request);

        $project = MonitoringProject::with([
            'office',
            'ppmp',
            'creator',
            'steps',
            'histories.user'
        ])
        ->where('id', $idOrUuid)
        ->orWhere('uuid', $idOrUuid)
        ->firstOrFail();

        return response()->json([
            'project' => $project,
        ]);
    }

    /**
     * Create a new monitored procurement project
     */
    public function store(Request $request): JsonResponse
    {
        $this->authorizeMonitor($request);

        $validated = $request->validate([
            'project_title' => 'required|string|max:500',
            'category' => 'required|in:GOODS_CONSULTING,INFRA',
            'procurement_mode' => 'required|string|max:100',
            'abc_amount' => 'nullable|numeric|min:0',
            'pr_number' => 'nullable|string|max:100',
            'pims_pr_id' => 'nullable|string|max:100',
            'office_id' => 'nullable|exists:offices,id',
            'implementing_unit' => 'nullable|string|max:255',
            'end_user_name' => 'nullable|string|max:255',
            'pims_published_at' => 'nullable|date',
            'ppmp_id' => 'nullable|exists:ppmps,id',
            'remarks' => 'nullable|string|max:1000',
        ]);

        $project = DB::transaction(function () use ($validated, $request) {
            $validated['created_by'] = $request->user()->id;
            $validated['pims_published_at'] = $validated['pims_published_at'] ?? now();
            $validated['pims_status'] = 'PUBLISHED';
            $validated['current_division'] = 'pr_division';
            $validated['status'] = 'IN_PROGRESS';

            $project = MonitoringProject::create($validated);
            $project->initializeDefaultSteps();

            return $project;
        });

        AuditLog::log(
            'MONITORING_PROJECT_CREATED',
            'monitoring_projects',
            $project->id,
            null,
            ['project_title' => $project->project_title, 'category' => $project->category],
            $request->user()->id
        );

        return response()->json([
            'message' => 'Procurement monitoring project created successfully.',
            'project' => $project->load(['office', 'steps', 'histories']),
        ], 201);
    }

    /**
     * Update project details
     */
    public function update(Request $request, string $idOrUuid): JsonResponse
    {
        $this->authorizeMonitor($request);

        $project = MonitoringProject::where('id', $idOrUuid)->orWhere('uuid', $idOrUuid)->firstOrFail();

        $validated = $request->validate([
            'project_title' => 'sometimes|string|max:500',
            'category' => 'sometimes|in:GOODS_CONSULTING,INFRA',
            'procurement_mode' => 'sometimes|string|max:100',
            'abc_amount' => 'nullable|numeric|min:0',
            'pr_number' => 'nullable|string|max:100',
            'pims_pr_id' => 'nullable|string|max:100',
            'current_division' => 'sometimes|string|in:pr_division,technical_division,bac_support_division,contracting_division,completed',
            'status' => 'sometimes|string|in:IN_PROGRESS,COMPLETED,SUSPENDED,RETURNED',
            'remarks' => 'nullable|string|max:1000',
        ]);

        $oldValues = $project->only(array_keys($validated));
        $project->update($validated);

        // Record history
        $project->histories()->create([
            'user_id' => $request->user()->id,
            'action' => 'PROJECT_UPDATED',
            'division' => $project->current_division,
            'description' => "Project details updated by {$request->user()->name}.",
            'metadata' => [
                'changes' => array_diff_assoc($validated, $oldValues),
            ],
        ]);

        return response()->json([
            'message' => 'Monitoring project updated successfully.',
            'project' => $project->load(['office', 'steps', 'histories', 'ppmp']),
        ]);
    }

    /**
     * Quick update for PIMS PR ID from the Monitoring Dashboard or Detail Modal
     */
    public function updatePrId(Request $request, string $idOrUuid): JsonResponse
    {
        $this->authorizeMonitor($request);

        $validated = $request->validate([
            'pims_pr_id' => 'required|string|max:100',
        ]);

        $project = MonitoringProject::where('id', $idOrUuid)
            ->orWhere('uuid', $idOrUuid)
            ->firstOrFail();

        $oldVal = $project->pims_pr_id;
        $newVal = trim($validated['pims_pr_id']);
        $project->update([
            'pims_pr_id' => $newVal,
        ]);

        $project->histories()->create([
            'user_id' => $request->user()->id,
            'action' => 'PIMS_PR_ID_ASSIGNED',
            'division' => $project->current_division,
            'description' => "PIMS PR ID assigned: {$newVal}" . ($oldVal ? " (Replaced: {$oldVal})" : ""),
            'metadata' => [
                'pims_pr_id' => $newVal,
            ],
        ]);

        return response()->json([
            'message' => 'PIMS PR ID assigned successfully.',
            'project' => $project->load(['office', 'steps', 'creator', 'histories.user', 'ppmp']),
        ]);
    }

    /**
     * Delete a monitored project
     */
    public function destroy(Request $request, string $idOrUuid): JsonResponse
    {
        $this->authorizeMonitor($request);

        $project = MonitoringProject::where('id', $idOrUuid)->orWhere('uuid', $idOrUuid)->firstOrFail();
        $projectTitle = $project->project_title;
        $project->delete();

        AuditLog::log(
            'MONITORING_PROJECT_DELETED',
            'monitoring_projects',
            null,
            null,
            ['project_title' => $projectTitle],
            $request->user()->id
        );

        return response()->json([
            'message' => 'Procurement monitoring project deleted successfully.',
        ]);
    }

    /**
     * Add a step to a division
     * Requirement: "In all division can add/delete steps……."
     */
    public function addStep(Request $request, string $idOrUuid): JsonResponse
    {
        $this->authorizeMonitor($request);

        $project = MonitoringProject::where('id', $idOrUuid)->orWhere('uuid', $idOrUuid)->firstOrFail();

        $validated = $request->validate([
            'division' => 'required|in:pr_division,technical_division,bac_support_division,contracting_division',
            'step_name' => 'required|string|max:255',
            'action_date' => 'nullable|date',
            'handled_by' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:1000',
            'special_badge' => 'nullable|string|max:100',
        ]);

        // Calculate next step_order in this division
        $maxOrder = $project->steps()->where('division', $validated['division'])->max('step_order') ?? 0;

        $step = $project->steps()->create([
            'division' => $validated['division'],
            'step_name' => $validated['step_name'],
            'step_order' => $maxOrder + 1,
            'status' => 'PENDING',
            'action_date' => $validated['action_date'] ?? null,
            'handled_by' => $validated['handled_by'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'special_badge' => $validated['special_badge'] ?? null,
            'is_custom' => true,
        ]);

        $divisionLabel = ucwords(str_replace('_', ' ', $validated['division']));
        $project->histories()->create([
            'step_id' => $step->id,
            'user_id' => $request->user()->id,
            'action' => 'STEP_ADDED',
            'division' => $validated['division'],
            'description' => "Added new step: '{$step->step_name}' to {$divisionLabel} by {$request->user()->name}.",
            'metadata' => ['step_id' => $step->id, 'step_name' => $step->step_name],
        ]);

        return response()->json([
            'message' => "Step successfully added to {$divisionLabel}.",
            'step' => $step,
            'project' => $project->fresh(['steps', 'histories.user']),
        ], 201);
    }

    /**
     * Update a step's status, decision, notes, date, or name
     */
    public function updateStep(Request $request, int $stepId): JsonResponse
    {
        $this->authorizeMonitor($request);

        $step = MonitoringStep::with('project')->findOrFail($stepId);
        $project = $step->project;

        $validated = $request->validate([
            'step_name' => 'sometimes|string|max:255',
            'status' => 'sometimes|in:PENDING,IN_PROGRESS,APPROVED,COMPLETED,SUSPENDED,RETURNED',
            'decision' => 'nullable|string|max:100', // awarded, re_canvass_1st, re_canvass_2nd, re_canvass_3rd, approved, suspended
            'action_date' => 'nullable|date',
            'handled_by' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:1000',
            'special_badge' => 'nullable|string|max:100',
        ]);

        if (isset($validated['status']) && in_array($validated['status'], ['COMPLETED', 'APPROVED'], true)) {
            $validated['completed_at'] = now();
        }

        $step->update($validated);

        // Check if all steps in current division are done to advance division or if status is completed
        $divisionLabel = ucwords(str_replace('_', ' ', $step->division));
        $desc = "Step '{$step->step_name}' in {$divisionLabel} updated by {$request->user()->name}. Status: {$step->status}.";
        if (!empty($step->decision)) {
            $desc .= " Decision: " . strtoupper(str_replace('_', ' ', $step->decision)) . ".";
        }

        $project->histories()->create([
            'step_id' => $step->id,
            'user_id' => $request->user()->id,
            'action' => 'STEP_UPDATED',
            'division' => $step->division,
            'description' => $desc,
            'metadata' => [
                'step_name' => $step->step_name,
                'status' => $step->status,
                'decision' => $step->decision,
            ],
        ]);

        return response()->json([
            'message' => 'Step updated successfully.',
            'step' => $step,
            'project' => $project->fresh(['steps', 'histories.user']),
        ]);
    }

    /**
     * Delete a step from any division
     * Requirement: "In all division can add/delete steps……."
     */
    public function deleteStep(Request $request, int $stepId): JsonResponse
    {
        $this->authorizeMonitor($request);

        $step = MonitoringStep::with('project')->findOrFail($stepId);
        $project = $step->project;
        $stepName = $step->step_name;
        $division = $step->division;
        $divisionLabel = ucwords(str_replace('_', ' ', $division));

        $step->delete();

        $project->histories()->create([
            'user_id' => $request->user()->id,
            'action' => 'STEP_DELETED',
            'division' => $division,
            'description' => "Deleted step '{$stepName}' from {$divisionLabel} by {$request->user()->name}.",
            'metadata' => ['step_name' => $stepName, 'division' => $division],
        ]);

        return response()->json([
            'message' => "Step '{$stepName}' removed from {$divisionLabel}.",
            'project' => $project->fresh(['steps', 'histories.user']),
        ]);
    }

    /**
     * Publish on PIMS and register in Monitoring System
     * Requirement:
     * "this monitoring is based on the reminder publish on the pims system from the E-PROCUREMENT PPMP/APP SYSTEM…
     * if the enduser forgot to click the publish done then the monitor can click that….
     * The monitor click that publish done there is pop up input is the what the enduser procure is…."
     */
    public function publishPims(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ppmp_uuid' => 'nullable|string',
            'project_title' => 'required|string|max:500',
            'category' => 'required|in:GOODS_CONSULTING,INFRA',
            'procurement_mode' => 'required|string|max:100',
            'abc_amount' => 'nullable|numeric|min:0',
            'pr_number' => 'nullable|string|max:100',
            'pims_pr_id' => 'nullable|string|max:100',
            'office_id' => 'nullable|exists:offices,id',
            'implementing_unit' => 'nullable|string|max:255',
            'end_user_name' => 'nullable|string|max:255',
            'remarks' => 'nullable|string|max:1000',
        ]);

        $ppmp = null;
        if (!empty($validated['ppmp_uuid'])) {
            $ppmp = Ppmp::where('uuid', $validated['ppmp_uuid'])->first();
        }

        $project = DB::transaction(function () use ($validated, $ppmp, $request) {
            $project = MonitoringProject::create([
                'ppmp_id' => $ppmp?->id,
                'project_title' => $validated['project_title'],
                'category' => $validated['category'],
                'procurement_mode' => $validated['procurement_mode'],
                'abc_amount' => $validated['abc_amount'] ?? ($ppmp?->total_budget ?? 0),
                'pr_number' => $validated['pr_number'] ?? null,
                'pims_pr_id' => !empty($validated['pims_pr_id']) ? trim($validated['pims_pr_id']) : null,
                'office_id' => $validated['office_id'] ?? $ppmp?->office_id,
                'implementing_unit' => $validated['implementing_unit'] ?? ($ppmp?->implementing_unit ?? $ppmp?->office?->name),
                'end_user_name' => $validated['end_user_name'] ?? ($ppmp?->creator?->name ?? $request->user()->name),
                'pims_published_at' => now(),
                'pims_status' => 'PUBLISHED',
                'current_division' => 'pr_division',
                'status' => 'IN_PROGRESS',
                'remarks' => $validated['remarks'] ?? null,
                'created_by' => $request->user()->id,
            ]);

            $project->initializeDefaultSteps();

            return $project;
        });

        AuditLog::log(
            'PIMS_PUBLISHED_AND_MONITORED',
            'monitoring_projects',
            $project->id,
            null,
            [
                'project_title' => $project->project_title,
                'ppmp_uuid' => $ppmp?->uuid,
                'category' => $project->category,
                'procurement_mode' => $project->procurement_mode,
            ],
            $request->user()->id
        );

        return response()->json([
            'message' => 'PPMP publication recorded on PIMS and registered in OPPMO Monitoring System.',
            'project' => $project->load(['office', 'steps', 'histories.user']),
        ], 201);
    }

    /**
     * Get monitoring dashboard summary metrics
     */
    public function getStats(Request $request): JsonResponse
    {
        $this->authorizeMonitor($request);

        // Ensure real-time accurate PPMP synchronization
        MonitoringProject::syncAllActivePpmps();

        $totalProjects = MonitoringProject::count();
        $goodsConsultingCount = MonitoringProject::where('category', 'GOODS_CONSULTING')->count();
        $infraCount = MonitoringProject::where('category', 'INFRA')->count();

        $prDivisionCount = MonitoringProject::where('current_division', 'pr_division')->where('status', '!=', 'COMPLETED')->count();
        $techDivisionCount = MonitoringProject::where('current_division', 'technical_division')->where('status', '!=', 'COMPLETED')->count();
        $bacDivisionCount = MonitoringProject::where('current_division', 'bac_support_division')->where('status', '!=', 'COMPLETED')->count();
        $contractingDivisionCount = MonitoringProject::where('current_division', 'contracting_division')->where('status', '!=', 'COMPLETED')->count();
        $completedCount = MonitoringProject::where('status', 'COMPLETED')->orWhere('current_division', 'completed')->count();
        $suspendedCount = MonitoringProject::where('status', 'SUSPENDED')->count();

        // Get count of pending PPMP reminders that haven't been published yet
        $publishedPpmpIds = MonitoringProject::whereNotNull('ppmp_id')
            ->where('pims_status', 'PUBLISHED')
            ->pluck('ppmp_id')
            ->toArray();

        $pendingPimsReminders = Ppmp::whereDoesntHave('children')
            ->whereNotIn('id', $publishedPpmpIds)
            ->count();

        return response()->json([
            'total_projects' => $totalProjects,
            'goods_consulting_count' => $goodsConsultingCount,
            'infra_count' => $infraCount,
            'pr_division_count' => $prDivisionCount,
            'tech_division_count' => $techDivisionCount,
            'bac_division_count' => $bacDivisionCount,
            'contracting_division_count' => $contractingDivisionCount,
            'completed_count' => $completedCount,
            'suspended_count' => $suspendedCount,
            'pending_pims_reminders' => $pendingPimsReminders,
        ]);
    }

    /**
     * Get all active PPMPs that have NOT been published to PIMS yet
     */
    public function pendingPims(Request $request): JsonResponse
    {
        $this->authorizeMonitor($request);

        $publishedPpmpIds = MonitoringProject::whereNotNull('ppmp_id')
            ->where('pims_status', 'PUBLISHED')
            ->pluck('ppmp_id')
            ->toArray();

        $pendingPpmps = Ppmp::with(['office', 'creator', 'items'])
            ->whereDoesntHave('children')
            ->whereNotIn('id', $publishedPpmpIds)
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'pending_ppmps' => $pendingPpmps,
        ]);
    }
}
