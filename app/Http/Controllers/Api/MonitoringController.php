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

    protected function authorizeMonitor(Request $request): void
    {
        $user = $request->user();
        if (!$user) {
            abort(response()->json([
                'message' => 'Unauthenticated.'
            ], 401));
        }

        if (
            $user->role === 'super_admin' ||
            $user->role === 'admin' ||
            $user->role === 'monitor' ||
            $user->canAccessSystem('/monitoringsystem')
        ) {
            return;
        }

        abort(response()->json([
            'message' => 'Forbidden. Your account is not authorized to access the OPPMO Monitoring System.'
        ], 403));
    }

    protected function authorizeManage(Request $request): void
    {
        $this->authorizeMonitor($request);
        $user = $request->user();

        $allowedRoles = ['super_admin', 'admin', 'monitor', 'oppmo'];
        if (!$user || !in_array($user->role, $allowedRoles, true)) {
            abort(response()->json([
                'message' => 'Forbidden. Your role is view-only on the Monitoring System and cannot add, edit, or delete projects or steps.'
            ], 403));
        }
    }

    protected function authorizeStep1AdminOnly(Request $request): void
    {
        $user = $request->user();
        if (!$user || !in_array($user->role, ['super_admin', 'admin'], true)) {
            abort(response()->json([
                'message' => 'Forbidden. Only Admin and Super Admin can manage the PIMS create & publish review step.'
            ], 403));
        }
    }

    protected function attachChecklist(MonitoringProject $project): MonitoringProject
    {
        $project->setAttribute('pims_review_checklist', $project->getPimsReviewChecklist());
        return $project;
    }

    protected function applyProjectVisibilityScope($query, $user)
    {
        if ($user && $user->canViewAllMonitoringPpmps()) {
            return $query;
        }

        return $query->where(function ($q) use ($user) {
            $q->whereHas('ppmp', function ($pq) use ($user) {
                $pq->where('created_by', $user->id);
            })->orWhere(function ($sub) use ($user) {
                $sub->whereNull('ppmp_id')->where('created_by', $user->id);
            });
        });
    }

    protected function applyPpmpVisibilityScope($query, $user)
    {
        if ($user && $user->canViewAllMonitoringPpmps()) {
            return $query;
        }

        return $query->where('created_by', $user->id);
    }

    protected function authorizeProjectAccess(Request $request, MonitoringProject $project): void
    {
        $user = $request->user();
        if ($user && $user->canViewAllMonitoringPpmps()) {
            return;
        }

        $isOwner = ($project->ppmp && (int) $project->ppmp->created_by === (int) $user->id)
            || (!$project->ppmp_id && (int) $project->created_by === (int) $user->id);

        if (!$isOwner) {
            abort(response()->json([
                'message' => 'Forbidden. You can only view PPMPs you created on the Monitoring System unless authorized by an Admin or Super Admin.'
            ], 403));
        }
    }

    public function index(Request $request): JsonResponse
    {
        $this->authorizeMonitor($request);

        if (!$request->filled('search')) {
            MonitoringProject::syncAllActivePpmps();
        }

        $query = MonitoringProject::with([
            'office',
            'steps',
            'creator',
            'ppmp.attachments',
            'ppmp.monitoringProjects',
            'ppmp.parent',
        ]);

        $this->applyProjectVisibilityScope($query, $request->user());

        if ($request->filled('category') && $request->category !== 'ALL') {
            $query->where('category', $request->category);
        }

        if ($request->filled('procurement_mode') && $request->procurement_mode !== 'ALL') {
            $selectedMode = trim($request->procurement_mode);
            $query->where(function ($q) use ($selectedMode) {
                $q->where('procurement_mode', $selectedMode);
                $modeRecord = \App\Models\ProcurementMode::where('name', $selectedMode)->orWhere('code', $selectedMode)->first();
                if ($modeRecord) {
                    if ($modeRecord->name) $q->orWhere('procurement_mode', $modeRecord->name);
                    if ($modeRecord->code) $q->orWhere('procurement_mode', $modeRecord->code);
                }
            });
        }

        if ($request->filled('current_division') && $request->current_division !== 'ALL') {
            $query->where('current_division', $request->current_division);
        }

        if ($request->filled('status') && $request->status !== 'ALL') {
            $query->where('status', $request->status);
        }

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

    public function show(Request $request, string $idOrUuid): JsonResponse
    {
        $this->authorizeMonitor($request);

        $project = MonitoringProject::with([
            'office',
            'ppmp.attachments',
            'ppmp.marketScoping',
            'ppmp.monitoringProjects',
            'ppmp.parent.marketScoping',
            'ppmp.twgReviewer',
            'ppmp.budgetReviewer',
            'ppmp.oppmoReviewer',
            'ppmp.office',
            'creator',
            'steps',
            'histories.user'
        ])
        ->where('id', $idOrUuid)
        ->orWhere('uuid', $idOrUuid)
        ->firstOrFail();

        $this->authorizeProjectAccess($request, $project);

        $project->ensureApprovePimsStepExists();
        $project->load('steps');

        return response()->json([
            'project' => $this->attachChecklist($project),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizeManage($request);

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

    public function update(Request $request, string $idOrUuid): JsonResponse
    {
        $this->authorizeManage($request);

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

    public function updatePrId(Request $request, string $idOrUuid): JsonResponse
    {
        $this->authorizeManage($request);

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

    public function destroy(Request $request, string $idOrUuid): JsonResponse
    {
        $this->authorizeManage($request);

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

    public function addStep(Request $request, string $idOrUuid): JsonResponse
    {
        $this->authorizeManage($request);

        $project = MonitoringProject::where('id', $idOrUuid)->orWhere('uuid', $idOrUuid)->firstOrFail();

        $validated = $request->validate([
            'division' => 'required|in:pr_division,technical_division,bac_support_division,contracting_division',
            'step_name' => 'required|string|max:255',
            'handled_by' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:1000',
            'special_badge' => 'nullable|string|max:100',
            'checklist_data' => 'nullable|array',
            'checklist_data.items' => 'nullable|array',
            'checklist_data.items.*.id' => 'required_with:checklist_data.items|string|max:100',
            'checklist_data.items.*.label' => 'required_with:checklist_data.items|string|max:255',
            'checklist_data.items.*.checked' => 'sometimes|boolean',
            'checklist_data.items.*.date' => 'nullable|date',
        ]);

        $checklistPayload = null;
        if (!empty($validated['checklist_data']['items'])) {
            $this->authorizeStep1AdminOnly($request);
            $checklistPayload = [
                'items' => array_values(array_map(fn ($item) => [
                    'id' => (string) $item['id'],
                    'label' => trim((string) $item['label']),
                    'checked' => (bool) ($item['checked'] ?? false),
                    'date' => $item['date'] ?? null,
                ], $validated['checklist_data']['items'])),
            ];
        }

        $maxOrder = $project->steps()->where('division', $validated['division'])->max('step_order') ?? 0;

        $step = $project->steps()->create([
            'division' => $validated['division'],
            'step_name' => $validated['step_name'],
            'step_order' => $maxOrder + 1,
            'status' => 'PENDING',
            'handled_by' => $validated['handled_by'] ?? null,
            'notes' => $validated['notes'] ?? null,
            'special_badge' => $validated['special_badge'] ?? null,
            'checklist_data' => $checklistPayload,
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
            'project' => $this->attachChecklist($project->fresh(['ppmp.attachments', 'ppmp.marketScoping', 'ppmp.parent.marketScoping', 'ppmp.twgReviewer', 'ppmp.budgetReviewer', 'ppmp.oppmoReviewer', 'ppmp.office', 'steps', 'histories.user'])),
        ], 201);
    }

    public function reorderSteps(Request $request, string $idOrUuid): JsonResponse
    {
        $this->authorizeManage($request);
        $this->authorizeStep1AdminOnly($request);

        $project = MonitoringProject::where('id', $idOrUuid)->orWhere('uuid', $idOrUuid)->firstOrFail();

        $validated = $request->validate([
            'division' => 'required|in:pr_division,technical_division,bac_support_division,contracting_division',
            'step_ids' => 'required|array|min:1',
            'step_ids.*' => 'integer|exists:monitoring_steps,id',
        ]);

        DB::transaction(function () use ($project, $validated) {
            foreach (array_values($validated['step_ids']) as $index => $stepId) {
                MonitoringStep::where('id', $stepId)
                    ->where('monitoring_project_id', $project->id)
                    ->where('division', $validated['division'])
                    ->update(['step_order' => $index + 1]);
            }
        });

        $divisionLabel = ucwords(str_replace('_', ' ', $validated['division']));
        $project->histories()->create([
            'user_id' => $request->user()->id,
            'action' => 'STEPS_REORDERED',
            'division' => $validated['division'],
            'description' => "Reordered steps in {$divisionLabel} by {$request->user()->name}.",
            'metadata' => ['step_ids' => $validated['step_ids']],
        ]);

        return response()->json([
            'message' => 'Steps reordered successfully.',
            'project' => $this->attachChecklist($project->fresh(['ppmp.attachments', 'ppmp.marketScoping', 'ppmp.parent.marketScoping', 'ppmp.twgReviewer', 'ppmp.budgetReviewer', 'ppmp.oppmoReviewer', 'ppmp.office', 'steps', 'histories.user'])),
        ]);
    }

    public function updateStep(Request $request, int $stepId): JsonResponse
    {
        $this->authorizeManage($request);

        $step = MonitoringStep::with('project')->findOrFail($stepId);
        $project = $step->project;
        $isStep1 = $project->isFirstPimsReviewStep($step);
        $isApprovePimsStep = $project->isApprovePimsStep($step);

        if ($isStep1) {
            $this->authorizeStep1AdminOnly($request);
        }

        $validated = $request->validate([
            'step_name' => 'sometimes|string|max:255',
            'status' => 'sometimes|in:PENDING,IN_PROGRESS,APPROVED,COMPLETED,SUSPENDED,RETURNED',
            'decision' => 'nullable|string|max:100',
            'completed_at' => 'nullable|date',
            'handled_by' => 'nullable|string|max:255',
            'notes' => 'nullable|string|max:1000',
            'special_badge' => 'nullable|string|max:100',
            'checklist_data' => 'nullable|array',
            'checklist_data.pr_reviewer_approved' => 'sometimes|boolean',
            'checklist_data.pr_reviewer_approved_date' => 'nullable|date',
            'checklist_data.pr_controlled' => 'sometimes|boolean',
            'checklist_data.pr_controlled_date' => 'nullable|date',
            'checklist_data.items' => 'nullable|array',
            'checklist_data.items.*.id' => 'required_with:checklist_data.items|string|max:100',
            'checklist_data.items.*.label' => 'required_with:checklist_data.items|string|max:255',
            'checklist_data.items.*.checked' => 'sometimes|boolean',
            'checklist_data.items.*.date' => 'nullable|date',
        ]);

        if (isset($validated['checklist_data'])) {
            $existingChecklist = is_array($step->checklist_data) ? $step->checklist_data : [];
            $merged = array_merge($existingChecklist, $validated['checklist_data']);

            if ($isApprovePimsStep) {
                $merged = array_merge([
                    'pr_reviewer_approved' => false,
                    'pr_reviewer_approved_date' => null,
                    'pr_controlled' => false,
                    'pr_controlled_date' => null,
                ], $merged);
            }

            if (array_key_exists('items', $validated['checklist_data'])) {
                $merged['items'] = array_values(array_map(fn ($item) => [
                    'id' => (string) $item['id'],
                    'label' => trim((string) $item['label']),
                    'checked' => (bool) ($item['checked'] ?? false),
                    'date' => $item['date'] ?? null,
                ], $validated['checklist_data']['items'] ?? []));
            }

            $validated['checklist_data'] = $merged;
        }

        $effectiveStatus = $validated['status'] ?? $step->status;
        $effectiveDate = array_key_exists('completed_at', $validated)
            ? $validated['completed_at']
            : ($step->completed_at ? $step->completed_at->toDateString() : null);

        if ($effectiveStatus !== 'PENDING' && empty($effectiveDate)) {
            return response()->json([
                'message' => 'Please select a date. Date selection is required for all division steps.',
            ], 422);
        }

        if ($isStep1 && isset($validated['status']) && in_array($validated['status'], ['COMPLETED', 'APPROVED'], true)) {
            $checklist = $project->getPimsReviewChecklist();
            if ($checklist['has_ppmp'] && !$checklist['all_approved']) {
                return response()->json([
                    'message' => 'Cannot approve/complete Step 1 yet. Pending requirements: ' . implode(', ', $checklist['missing_items']) . '. Keep this step PENDING or mark it SUSPENDED until all requirements are completed and approved.',
                    'pims_review_checklist' => $checklist,
                ], 422);
            }
        }

        if ($isApprovePimsStep && isset($validated['status']) && in_array($validated['status'], ['COMPLETED', 'APPROVED'], true)) {
            $effectiveChecklist = $validated['checklist_data'] ?? (is_array($step->checklist_data) ? $step->checklist_data : []);
            $reviewerApproved = !empty($effectiveChecklist['pr_reviewer_approved']) && !empty($effectiveChecklist['pr_reviewer_approved_date']);
            $prControlled = !empty($effectiveChecklist['pr_controlled']) && !empty($effectiveChecklist['pr_controlled_date']);

            if (!$reviewerApproved || !$prControlled) {
                return response()->json([
                    'message' => 'Cannot approve/complete Step 2 yet. Both PR Reviewer Approved (with date) and PR Controlled (with date) must be checked.',
                ], 422);
            }
        }

        if (isset($validated['status']) && in_array($validated['status'], ['COMPLETED', 'APPROVED'], true)) {
            $effectiveChecklist = $validated['checklist_data'] ?? (is_array($step->checklist_data) ? $step->checklist_data : []);
            $customItems = $effectiveChecklist['items'] ?? [];
            if (is_array($customItems) && count($customItems) > 0) {
                foreach ($customItems as $item) {
                    if (empty($item['checked']) || empty($item['date'])) {
                        return response()->json([
                            'message' => 'Cannot approve/complete this step yet. All checklist items must be checked and dated.',
                        ], 422);
                    }
                }
            }
        }

        if (!empty($validated['completed_at'])) {
            $validated['completed_at'] = \Carbon\Carbon::parse($validated['completed_at'])->startOfDay();
        } elseif (isset($validated['status']) && $validated['status'] === 'PENDING') {
            $validated['completed_at'] = null;
        } elseif (isset($validated['status']) && in_array($validated['status'], ['COMPLETED', 'APPROVED'], true) && empty($step->completed_at)) {
            $validated['completed_at'] = now();
        }

        $step->update($validated);

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
            'project' => $this->attachChecklist($project->fresh(['ppmp.attachments', 'ppmp.marketScoping', 'ppmp.parent.marketScoping', 'steps', 'histories.user'])),
        ]);
    }

    public function deleteStep(Request $request, int $stepId): JsonResponse
    {
        $this->authorizeManage($request);

        $step = MonitoringStep::with('project')->findOrFail($stepId);
        $project = $step->project;
        if ($project->isFirstPimsReviewStep($step)) {
            $this->authorizeStep1AdminOnly($request);
        }
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
            'project' => $this->attachChecklist($project->fresh(['ppmp.attachments', 'ppmp.marketScoping', 'ppmp.parent.marketScoping', 'steps', 'histories.user'])),
        ]);
    }

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

    public function unpublishPims(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'ppmp_uuid' => 'required|string',
        ]);

        $ppmp = Ppmp::where('uuid', $validated['ppmp_uuid'])->firstOrFail();

        $projects = MonitoringProject::where('ppmp_id', $ppmp->id)
            ->orWhere(function ($q) use ($ppmp) {
                if (!empty($ppmp->tracking_number)) {
                    $q->where('pr_number', $ppmp->tracking_number);
                }
            })->get();

        foreach ($projects as $project) {
            $project->steps()->delete();
            $project->histories()->delete();
            $project->delete();
        }

        AuditLog::log(
            'PIMS_UNPUBLISHED',
            'ppmps',
            $ppmp->id,
            null,
            ['tracking_number' => $ppmp->tracking_number, 'title' => $ppmp->title],
            $request->user()->id
        );

        return response()->json([
            'message' => 'PPMP publication unmarked and monitoring project removed.',
        ]);
    }

    public function getStats(Request $request): JsonResponse
    {
        $this->authorizeMonitor($request);

        MonitoringProject::syncAllActivePpmps();

        $user = $request->user();
        $baseQuery = $this->applyProjectVisibilityScope(MonitoringProject::query(), $user);

        $totalProjects = (clone $baseQuery)->count();
        $goodsConsultingCount = (clone $baseQuery)->where('category', 'GOODS_CONSULTING')->count();
        $infraCount = (clone $baseQuery)->where('category', 'INFRA')->count();

        $prDivisionCount = (clone $baseQuery)->where('current_division', 'pr_division')->where('status', '!=', 'COMPLETED')->count();
        $techDivisionCount = (clone $baseQuery)->where('current_division', 'technical_division')->where('status', '!=', 'COMPLETED')->count();
        $bacDivisionCount = (clone $baseQuery)->where('current_division', 'bac_support_division')->where('status', '!=', 'COMPLETED')->count();
        $contractingDivisionCount = (clone $baseQuery)->where('current_division', 'contracting_division')->where('status', '!=', 'COMPLETED')->count();
        $completedCount = (clone $baseQuery)->where(function ($q) {
            $q->where('status', 'COMPLETED')->orWhere('current_division', 'completed');
        })->count();
        $suspendedCount = (clone $baseQuery)->where('status', 'SUSPENDED')->count();

        $publishedPpmpIds = MonitoringProject::whereNotNull('ppmp_id')
            ->where('pims_status', 'PUBLISHED')
            ->pluck('ppmp_id')
            ->toArray();

        $publishedTrackers = MonitoringProject::whereNotNull('pr_number')
            ->where('pims_status', 'PUBLISHED')
            ->pluck('pr_number')
            ->filter()
            ->toArray();

        $pendingQuery = Ppmp::whereDoesntHave('children')
            ->whereNotIn('id', $publishedPpmpIds)
            ->where(function ($q) use ($publishedTrackers) {
                if (!empty($publishedTrackers)) {
                    $q->whereNotIn('tracking_number', $publishedTrackers)
                      ->orWhereNull('tracking_number');
                }
            });
        $this->applyPpmpVisibilityScope($pendingQuery, $user);
        $pendingPimsReminders = $pendingQuery->count();

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

    public function pendingPims(Request $request): JsonResponse
    {
        $this->authorizeMonitor($request);

        $publishedPpmpIds = MonitoringProject::whereNotNull('ppmp_id')
            ->where('pims_status', 'PUBLISHED')
            ->pluck('ppmp_id')
            ->toArray();

        $publishedTrackers = MonitoringProject::whereNotNull('pr_number')
            ->where('pims_status', 'PUBLISHED')
            ->pluck('pr_number')
            ->filter()
            ->toArray();

        $pendingPpmpsQuery = Ppmp::with(['office', 'creator', 'items', 'attachments', 'monitoringProjects'])
            ->whereDoesntHave('children')
            ->whereNotIn('id', $publishedPpmpIds)
            ->where(function ($q) use ($publishedTrackers) {
                if (!empty($publishedTrackers)) {
                    $q->whereNotIn('tracking_number', $publishedTrackers)
                      ->orWhereNull('tracking_number');
                }
            });

        $this->applyPpmpVisibilityScope($pendingPpmpsQuery, $request->user());

        $pendingPpmps = $pendingPpmpsQuery
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'pending_ppmps' => $pendingPpmps,
        ]);
    }

    public function authorizedUsers(Request $request): JsonResponse
    {
        $this->authorizeMonitor($request);
        $this->authorizeStep1AdminOnly($request);

        $users = \App\Models\User::with('office')
            ->where('is_active', true)
            ->whereNotIn('role', ['super_admin', 'admin'])
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'role', 'designation', 'office_id', 'accessible_systems', 'can_view_all_monitoring_ppmp']);

        return response()->json([
            'users' => $users,
        ]);
    }

    public function updateAuthorizedUsers(Request $request): JsonResponse
    {
        $this->authorizeMonitor($request);
        $this->authorizeStep1AdminOnly($request);

        $validated = $request->validate([
            'user_ids' => 'present|array',
            'user_ids.*' => 'integer|exists:users,id',
        ]);

        $selectedIds = array_map('intval', $validated['user_ids']);

        DB::transaction(function () use ($selectedIds) {
            \App\Models\User::whereNotIn('role', ['super_admin', 'admin'])
                ->update(['can_view_all_monitoring_ppmp' => false]);

            if (!empty($selectedIds)) {
                \App\Models\User::whereIn('id', $selectedIds)
                    ->whereNotIn('role', ['super_admin', 'admin'])
                    ->update(['can_view_all_monitoring_ppmp' => true]);
            }
        });

        AuditLog::log(
            'MONITORING_VIEW_ALL_ACCESS_UPDATED',
            'users',
            null,
            null,
            ['authorized_user_ids' => $selectedIds],
            $request->user()->id
        );

        return response()->json([
            'message' => 'Authorized Monitoring System viewers updated successfully.',
            'authorized_user_ids' => $selectedIds,
        ]);
    }
}
