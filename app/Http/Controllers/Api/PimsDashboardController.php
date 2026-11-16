<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MonitoringProject;
use App\Models\Office;
use App\Models\Ppmp;
use App\Models\PpmpAttachment;
use App\Models\PurchaseRequest;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PimsDashboardController extends Controller
{
    /**
     * Authorize user access to PIMS
     */
    protected function authorizePims(Request $request): void
    {
        $user = $request->user();
        if (!$user) {
            abort(response()->json(['message' => 'Unauthenticated.'], 401));
        }

        if (!$user->canAccessSystem('/pims')) {
            abort(response()->json(['message' => 'Forbidden. Your account is not authorized to access PIMS.'], 403));
        }
    }

    /**
     * Main dashboard data endpoint with dynamic filters
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorizePims($request);
        $user = $request->user();

        // Ensure active PPMPs are synchronized
        MonitoringProject::syncAllActivePpmps();

        // Apply filters
        $year = $request->filled('year') && $request->year !== 'ALL' ? (int)$request->year : null;
        $startDate = $request->filled('start_date') ? Carbon::parse($request->start_date)->startOfDay() : null;
        $endDate = $request->filled('end_date') ? Carbon::parse($request->end_date)->endOfDay() : null;
        $source = $request->filled('source') && $request->source !== 'ALL' ? $request->source : null;
        $category = $request->filled('category') && $request->category !== 'ALL' ? $request->category : null;
        $status = $request->filled('status') && $request->status !== 'ALL' ? $request->status : null;

        // Base PPMP Query
        $ppmpQuery = Ppmp::whereDoesntHave('children');
        if ($user->isEndUser() || $user->isHead()) {
            if ($user->office_id) {
                $ppmpQuery->where('office_id', $user->office_id);
            } else {
                $ppmpQuery->where('created_by', $user->id);
            }
        }
        if ($year) {
            $ppmpQuery->where(function ($q) use ($year) {
                $q->where('fiscal_year', $year)->orWhereYear('created_at', $year);
            });
        }
        if ($startDate && $endDate) {
            $ppmpQuery->whereBetween('created_at', [$startDate, $endDate]);
        }
        if ($source === 'APP') {
            $ppmpQuery->where('is_annual', true);
        } elseif ($source === 'PPMP') {
            $ppmpQuery->where('is_annual', false);
        }

        $allPpmps = $ppmpQuery->with(['office', 'creator', 'items', 'attachments', 'monitoringProjects', 'purchaseRequests'])->get();
        $totalPpmpCount = $allPpmps->count();

        // Published Monitoring Projects
        $mpQuery = MonitoringProject::with(['ppmp', 'office', 'purchaseRequest']);
        if ($user->isEndUser() || $user->isHead()) {
            if ($user->office_id) {
                $mpQuery->where('office_id', $user->office_id);
            } else {
                $mpQuery->where('created_by', $user->id);
            }
        }
        if ($category) {
            $mpQuery->where('category', $category);
        }
        if ($year) {
            $mpQuery->where(function ($q) use ($year) {
                $q->whereYear('pims_published_at', $year)->orWhereYear('created_at', $year);
            });
        }
        if ($startDate && $endDate) {
            $mpQuery->whereBetween('pims_published_at', [$startDate, $endDate]);
        }
        $monitoredProjects = $mpQuery->get();
        $monitoredPpmpIds = $monitoredProjects->pluck('ppmp_id')->filter()->unique()->toArray();

        // Base PR Query
        $prQuery = PurchaseRequest::with(['office', 'creator', 'items', 'routes', 'ppmp']);
        if ($user->isEndUser() || $user->isHead()) {
            if ($user->office_id) {
                $prQuery->where('office_id', $user->office_id);
            } else {
                $prQuery->where('created_by', $user->id);
            }
        }
        if ($year) {
            $prQuery->whereYear('date_published', $year);
        }
        if ($startDate && $endDate) {
            $prQuery->whereBetween('date_published', [$startDate, $endDate]);
        }
        if ($source) {
            $prQuery->where('source', $source);
        }
        if ($category) {
            $prQuery->where('category', $category);
        }
        if ($status) {
            $prQuery->where('status', $status);
        }
        $allPrs = $prQuery->orderBy('created_at', 'desc')->get();
        $prPpmpIds = $allPrs->pluck('ppmp_id')->filter()->unique()->toArray();

        // A. Dashboard Summary Cards
        $totalPublishedRequirements = $monitoredProjects->where('pims_status', 'PUBLISHED')->count();
        $pendingMonitoringCount = $allPpmps->whereNotIn('id', $monitoredPpmpIds)->count();
        $monitoringCompletedCount = $monitoredProjects->where('status', 'COMPLETED')->count();

        // Pending PR Generation: Monitored requirements without a generated PR
        $monitoredWithPrIds = $allPrs->pluck('monitoring_project_id')->filter()->unique()->toArray();
        $pendingPrGenerationCount = $monitoredProjects->filter(function ($mp) use ($monitoredWithPrIds, $prPpmpIds) {
            return !in_array($mp->id, $monitoredWithPrIds, true) && (!($mp->ppmp_id && in_array($mp->ppmp_id, $prPpmpIds, true)));
        })->count();

        $generatedPrsCount = $allPrs->count();

        // Total Attachments (supporting documents across eligible PPMPs)
        $totalAttachmentsCount = PpmpAttachment::whereIn('ppmp_id', $allPpmps->pluck('id'))->count();

        // Pending Actions Count:
        // 1. Pending Monitoring + 2. Pending PR Generation + 3. PRs in review or returned
        $pendingReviewPrsCount = $allPrs->whereIn('status', ['PR_DIVISION_REVIEW', 'BAC_TWG_REVIEW', 'PR_CONTROL_REVIEW', 'RETURNED'])->count();
        $pendingActionsCount = $pendingMonitoringCount + $pendingPrGenerationCount + $pendingReviewPrsCount;

        // B. Dashboard Charts and Analytics
        // 1. Requirements by Status
        $statusChart = [
            'labels' => ['Published to PIMS', 'Pending Monitoring', 'Monitoring Completed', 'Pending PR Generation', 'PR Generated', 'PR Approved'],
            'data' => [
                $totalPublishedRequirements,
                $pendingMonitoringCount,
                $monitoringCompletedCount,
                $pendingPrGenerationCount,
                $generatedPrsCount,
                $allPrs->where('status', 'PR_APPROVED')->count(),
            ],
            'colors' => ['#3b82f6', '#f59e0b', '#10b981', '#8b5cf6', '#06b6d4', '#059669'],
        ];

        // 2. Requirements by Source (PPMP vs APP)
        $ppmpSourceCount = $allPpmps->where('is_annual', false)->count();
        $appSourceCount = $allPpmps->where('is_annual', true)->count();
        $sourceChart = [
            'labels' => ['PPMP Requirements', 'APP Requirements'],
            'data' => [$ppmpSourceCount, $appSourceCount],
            'colors' => ['#0284c7', '#0d9488'],
        ];

        // 3. Monthly Procurement Activity (Last 12 Months)
        $currentYear = $year ?: (int)date('Y');
        $months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        $monthlySubmitted = array_fill(0, 12, 0);
        $monthlyMonitored = array_fill(0, 12, 0);
        $monthlyPrGenerated = array_fill(0, 12, 0);

        foreach ($allPpmps as $p) {
            $m = (int)$p->created_at->format('n') - 1;
            if ((int)$p->created_at->format('Y') === $currentYear) {
                $monthlySubmitted[$m]++;
            }
        }
        foreach ($monitoredProjects as $mp) {
            $date = $mp->pims_published_at ?: $mp->created_at;
            if ($date && (int)$date->format('Y') === $currentYear) {
                $m = (int)$date->format('n') - 1;
                $monthlyMonitored[$m]++;
            }
        }
        foreach ($allPrs as $pr) {
            $date = $pr->date_published ?: $pr->created_at;
            if ($date && (int)$date->format('Y') === $currentYear) {
                $m = (int)$date->format('n') - 1;
                $monthlyPrGenerated[$m]++;
            }
        }

        $monthlyChart = [
            'labels' => $months,
            'submitted' => $monthlySubmitted,
            'monitored' => $monthlyMonitored,
            'pr_generated' => $monthlyPrGenerated,
        ];

        // 4. Requirements by Category (Goods, Infra, Consulting)
        $categoryBreakdown = [
            'Goods' => 0,
            'Infrastructure Projects' => 0,
            'Consulting Services' => 0,
        ];
        foreach ($allPpmps as $p) {
            $firstItem = $p->items->firstWhere('is_header', false);
            $type = $firstItem?->project_type ? strtolower($firstItem->project_type) : '';
            if (str_contains($type, 'infra')) {
                $categoryBreakdown['Infrastructure Projects']++;
            } elseif (str_contains($type, 'consult')) {
                $categoryBreakdown['Consulting Services']++;
            } else {
                $categoryBreakdown['Goods']++;
            }
        }
        $categoryChart = [
            'labels' => array_keys($categoryBreakdown),
            'data' => array_values($categoryBreakdown),
            'colors' => ['#3b82f6', '#f97316', '#a855f7'],
        ];

        // C. Recent Procurement Activities Table
        $recentActivities = [];

        // Mix PRs and published PPMPs into unified timeline
        foreach ($allPrs->take(30) as $pr) {
            $recentActivities[] = [
                'id' => $pr->id,
                'uuid' => $pr->uuid,
                'tracker_id' => $pr->tracker_id,
                'title' => $pr->purpose,
                'department' => $pr->department,
                'source' => $pr->source,
                'category' => $pr->category,
                'date_published' => $pr->date_published ? $pr->date_published->format('m/d/Y') : $pr->created_at->format('m/d/Y'),
                'monitoring_status' => $pr->monitoringProject?->status ?: 'IN_PROGRESS',
                'pr_status' => $pr->status,
                'current_stage' => $pr->current_stage,
                'total_cost' => $pr->total_cost,
                'last_updated' => $pr->updated_at->diffForHumans(),
                'type' => 'PR',
                'ppmp_uuid' => $pr->ppmp?->uuid,
            ];
        }

        // D. Pending Actions Section
        $pendingActions = [];

        // 1. PPMPs awaiting monitoring
        foreach ($allPpmps->whereNotIn('id', $monitoredPpmpIds)->take(10) as $unmonitored) {
            $pendingActions[] = [
                'type' => 'AWAITING_MONITORING',
                'title' => $unmonitored->title,
                'tracker_id' => $unmonitored->tracking_number ?: $unmonitored->ppmp_number,
                'department' => $unmonitored->office?->name,
                'source' => $unmonitored->is_annual ? 'APP' : 'PPMP',
                'badge' => 'Awaiting Monitoring',
                'action_label' => 'Complete Monitoring Form',
                'ppmp' => $unmonitored,
            ];
        }

        // 2. Monitored requirements ready for PR generation
        foreach ($monitoredProjects->filter(function ($mp) use ($monitoredWithPrIds, $prPpmpIds) {
            return !in_array($mp->id, $monitoredWithPrIds, true) && (!($mp->ppmp_id && in_array($mp->ppmp_id, $prPpmpIds, true)));
        })->take(10) as $readyForPr) {
            $pendingActions[] = [
                'type' => 'READY_FOR_PR',
                'title' => $readyForPr->project_title,
                'tracker_id' => $readyForPr->pr_number ?: $readyForPr->pims_pr_id ?: $readyForPr->ppmp?->tracking_number,
                'department' => $readyForPr->implementing_unit ?: $readyForPr->office?->name,
                'source' => $readyForPr->ppmp?->is_annual ? 'APP' : 'PPMP',
                'badge' => 'Ready for PR Generation',
                'action_label' => 'Generate PR',
                'monitoring_project' => $readyForPr,
                'ppmp' => $readyForPr->ppmp,
            ];
        }

        // 3. PRs in review or returned
        foreach ($allPrs->whereIn('status', ['PR_DIVISION_REVIEW', 'BAC_TWG_REVIEW', 'PR_CONTROL_REVIEW', 'RETURNED'])->take(10) as $inReviewPr) {
            $stageLabel = strtoupper(str_replace('_', ' ', $inReviewPr->current_stage));
            $isReturned = $inReviewPr->status === 'RETURNED';
            $pendingActions[] = [
                'type' => 'PR_IN_REVIEW',
                'title' => $inReviewPr->purpose,
                'tracker_id' => $inReviewPr->tracker_id,
                'department' => $inReviewPr->department,
                'source' => $inReviewPr->source,
                'badge' => $isReturned ? 'Returned for Revision' : "Under Review ({$stageLabel})",
                'action_label' => $isReturned ? 'Revise PR' : 'Review PR',
                'pr' => $inReviewPr,
            ];
        }

        // Available offices and years for filters
        $offices = Office::orderBy('name')->get(['id', 'name', 'code']);
        $years = Ppmp::selectRaw('DISTINCT fiscal_year')->pluck('fiscal_year')->filter()->sort()->values();
        if ($years->isEmpty()) {
            $years = [(string)date('Y')];
        }

        return response()->json([
            'summary' => [
                'total_requirements' => $totalPpmpCount,
                'total_published' => $totalPublishedRequirements,
                'pending_monitoring' => $pendingMonitoringCount,
                'monitoring_completed' => $monitoringCompletedCount,
                'pending_pr_generation' => $pendingPrGenerationCount,
                'generated_prs' => $generatedPrsCount,
                'total_attachments' => $totalAttachmentsCount,
                'pending_actions' => $pendingActionsCount,
            ],
            'charts' => [
                'status' => $statusChart,
                'source' => $sourceChart,
                'monthly' => $monthlyChart,
                'category' => $categoryChart,
            ],
            'recent_activities' => $recentActivities,
            'pending_actions_list' => $pendingActions,
            'filter_options' => [
                'years' => $years,
                'offices' => $offices,
                'categories' => ['GOODS_CONSULTING', 'INFRA'],
                'sources' => ['PPMP', 'APP'],
                'statuses' => ['PR_DIVISION_REVIEW', 'BAC_TWG_REVIEW', 'PR_CONTROL_REVIEW', 'PR_APPROVED', 'RETURNED'],
            ],
        ]);
    }
}

