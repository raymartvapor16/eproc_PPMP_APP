<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Office;
use App\Models\Ppmp;
use App\Models\PpmpItem;
use App\Models\PpmpRoute;
use App\Models\PpmpSignatory;
use App\Models\SystemNotification;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    /**
     * Role-specific dashboard metrics and activity feed
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $metrics = [];
        $recentPpmps = [];

        $commonRecentRelations = [
            'office',
            'creator',
            'signatures',
            'attachments',
            'monitoringProjects',
        ];

        if ($user->isEndUser()) {
            $base = Ppmp::where('created_by', $user->id)->whereDoesntHave('children');
            $byStatus = (clone $base)->selectRaw('status, count(*) as cnt')->groupBy('status')->pluck('cnt', 'status');
            $c = fn (string $s): int => (int) ($byStatus[$s] ?? 0);

            $metrics = [
                'draft' => $c('DRAFT'),
                'head_pending' => $c('HEAD_PENDING'),
                'head_returned' => $c('HEAD_RETURNED'),
                'ready_for_review' => $c('HEAD_APPROVED'),
                'in_review' => $c('BUDGET_OFFICER_REVIEW') + $c('PACCO_REVIEW') + $c('OPPMO_REVIEW') + $c('TWG_REVIEW'),
                'returned_by_reviewer' => $c('BUDGET_OFFICER_RETURNED') + $c('PACCO_RETURNED') + $c('OPPMO_RETURNED') + $c('TWG_RETURNED'),
                'ready_to_print' => $c('READY_TO_PRINT'),
                'total' => (int) $byStatus->sum(),
            ];

            $endUserRecent = clone $base;
            $recentPpmps = $endUserRecent->with(array_merge($commonRecentRelations, ['items']))->latest('updated_at')->take(100)->get();
        } elseif ($user->isHead()) {
            $base = Ppmp::where('office_id', $user->office_id)->whereDoesntHave('children');
            $byStatus = (clone $base)->selectRaw('status, count(*) as cnt')->groupBy('status')->pluck('cnt', 'status');
            $c = fn (string $s): int => (int) ($byStatus[$s] ?? 0);

            $metrics = [
                'pending_endorsement' => $c('HEAD_PENDING'),
                'endorsed_approved' => $c('READY_TO_PRINT'),
                'returned' => $c('HEAD_RETURNED'),
                'total_office' => (int) $byStatus->sum(),
            ];

            $headRecent = clone $base;
            $recentPpmps = $headRecent->with($commonRecentRelations)->latest('updated_at')->take(100)->get();
        } elseif ($user->isBudgetOfficer()) {
            $base = Ppmp::whereDoesntHave('children');
            $byStatus = (clone $base)->selectRaw('status, count(*) as cnt')->groupBy('status')->pluck('cnt', 'status');
            $c = fn (string $s): int => (int) ($byStatus[$s] ?? 0);

            $metrics = [
                'pending_review' => $c('BUDGET_OFFICER_REVIEW'),
                'returned' => $c('BUDGET_OFFICER_RETURNED'),
                'approved' => $c('OPPMO_REVIEW') + $c('TWG_REVIEW') + $c('HEAD_PENDING') + $c('READY_TO_PRINT'),
            ];

            $budgetRecent = clone $base;
            $recentPpmps = $budgetRecent->whereIn('status', ['BUDGET_OFFICER_REVIEW', 'BUDGET_OFFICER_RETURNED', 'OPPMO_REVIEW', 'TWG_REVIEW', 'HEAD_PENDING', 'READY_TO_PRINT'])
                ->with($commonRecentRelations)
                ->latest('updated_at')
                ->take(100)
                ->get();
        } elseif ($user->isOppmo()) {
            $base = Ppmp::whereDoesntHave('children');
            $byStatus = (clone $base)->selectRaw('status, count(*) as cnt')->groupBy('status')->pluck('cnt', 'status');
            $c = fn (string $s): int => (int) ($byStatus[$s] ?? 0);

            $metrics = [
                'pending_review' => $c('OPPMO_REVIEW'),
                'returned' => $c('OPPMO_RETURNED'),
                'approved' => $c('TWG_REVIEW') + $c('HEAD_PENDING') + $c('READY_TO_PRINT'),
            ];

            $oppmoRecent = clone $base;
            $recentPpmps = $oppmoRecent->whereIn('status', ['OPPMO_REVIEW', 'OPPMO_RETURNED', 'TWG_REVIEW', 'HEAD_PENDING', 'READY_TO_PRINT'])
                ->with($commonRecentRelations)
                ->latest('updated_at')
                ->take(100)
                ->get();
        } elseif ($user->isTwg()) {
            $base = Ppmp::whereDoesntHave('children');
            $byStatus = (clone $base)->selectRaw('status, count(*) as cnt')->groupBy('status')->pluck('cnt', 'status');
            $c = fn (string $s): int => (int) ($byStatus[$s] ?? 0);

            $metrics = [
                'pending_review' => $c('TWG_REVIEW'),
                'returned' => $c('TWG_RETURNED'),
                'ready_to_print' => $c('READY_TO_PRINT'),
            ];

            $twgRecent = clone $base;
            $recentPpmps = $twgRecent->whereIn('status', ['TWG_REVIEW', 'TWG_RETURNED', 'HEAD_PENDING', 'HEAD_RETURNED', 'READY_TO_PRINT'])
                ->with($commonRecentRelations)
                ->latest('updated_at')
                ->take(100)
                ->get();
        } elseif ($user->isPacco()) {
            $base = Ppmp::whereDoesntHave('children');
            $byStatus = (clone $base)->selectRaw('status, count(*) as cnt')->groupBy('status')->pluck('cnt', 'status');
            $c = fn (string $s): int => (int) ($byStatus[$s] ?? 0);

            $metrics = [
                'pending_review' => $c('PACCO_REVIEW'),
                'returned' => $c('PACCO_RETURNED'),
                'approved' => $c('OPPMO_REVIEW') + $c('TWG_REVIEW') + $c('HEAD_PENDING') + $c('READY_TO_PRINT'),
                'ready_to_print' => $c('READY_TO_PRINT'),
                'total_review' => (int) $byStatus->except(['DRAFT'])->sum(),
            ];

            $paccoRecent = clone $base;
            $recentPpmps = $paccoRecent->where(function ($q) {
                $q->whereIn('status', ['PACCO_REVIEW', 'PACCO_RETURNED'])
                    ->orWhereHas('milestones', fn($mq) => $mq->whereNotNull('pacco_approved_at'))
                    ->orWhere('source_of_fund', 'like', '%trust%');
            })
                ->with($commonRecentRelations)
                ->latest('updated_at')
                ->take(100)
                ->get();
        } elseif ($user->isSuperAdmin()) {
            // Super Admin: Full Executive Overview & Analytics
            $base = Ppmp::whereDoesntHave('children');
            $statusRows = (clone $base)->toBase()->selectRaw('status, count(*) as cnt, sum(total_budget) as budget_sum')->groupBy('status')->get()->keyBy('status');
            $c = fn (string $s): int => (int) ($statusRows[$s]->cnt ?? 0);

            $metrics = [
                'total_ppmps' => (int) $statusRows->sum('cnt'),
                'total_budget' => (float) $statusRows->sum('budget_sum'),
                'draft' => $c('DRAFT'),
                'head_pending' => $c('HEAD_PENDING'),
                'in_review' => $c('BUDGET_OFFICER_REVIEW') + $c('PACCO_REVIEW') + $c('OPPMO_REVIEW') + $c('TWG_REVIEW'),
                'ready_to_print' => $c('READY_TO_PRINT'),
                'pending_amendments' => Ppmp::whereHas('amendment', fn($aq) => $aq->where('amendment_status', 'PENDING_APPROVAL'))->count(),
            ];

            $superRecent = clone $base;
            $recentPpmps = $superRecent->with($commonRecentRelations)->latest('updated_at')->take(100)->get();

            $adminAnalytics = $this->buildAdminAnalytics($base, $metrics);
        } else {
            // Admin role: Specialized management for Users, Amended/Supplemental, System Logs, PPMP List
            $base = Ppmp::whereDoesntHave('children');
            $statusRows = (clone $base)->toBase()->selectRaw('status, count(*) as cnt, sum(total_budget) as budget_sum')->groupBy('status')->get()->keyBy('status');
            $c = fn (string $s): int => (int) ($statusRows[$s]->cnt ?? 0);

            $metrics = [
                'total_ppmps' => (int) $statusRows->sum('cnt'),
                'total_budget' => (float) $statusRows->sum('budget_sum'),
                'draft' => $c('DRAFT'),
                'head_pending' => $c('HEAD_PENDING'),
                'in_review' => $c('BUDGET_OFFICER_REVIEW') + $c('PACCO_REVIEW') + $c('OPPMO_REVIEW') + $c('TWG_REVIEW'),
                'ready_to_print' => $c('READY_TO_PRINT'),
                'pending_amendments' => Ppmp::whereHas('amendment', fn($aq) => $aq->where('amendment_status', 'PENDING_APPROVAL'))->count(),
                'total_amendments' => Ppmp::whereHas('amendment', fn($aq) => $aq->whereNotNull('amendment_status'))->count(),
                'total_users' => User::count(),
                'pending_users' => User::where('is_active', false)->where('approval_status', '!=', 'rejected')->count(),
                'active_users' => User::where('is_active', true)->where('approval_status', '!=', 'rejected')->count(),
                'rejected_users' => User::where('approval_status', 'rejected')->count(),
                'total_logs' => AuditLog::count(),
            ];

            $recentPpmps = (clone $base)->with($commonRecentRelations)->latest('updated_at')->take(100)->get();

            $pendingAmendments = Ppmp::with($commonRecentRelations)
                ->whereHas('amendment', fn($aq) => $aq->where('amendment_status', 'PENDING_APPROVAL'))
                ->latest('updated_at')
                ->get();

            $adminAnalytics = $this->buildAdminAnalytics($base, $metrics);
        }

        // Recent Routing Actions
        $recentRoutes = PpmpRoute::with([
            'ppmp.attachments',
            'ppmp.monitoringProjects',
            'fromUser',
            'toUser',
        ])
            ->latest('id')
            ->take(8)
            ->get();

        $allDashboardPpmps = collect($recentPpmps)
            ->merge($pendingAmendments ?? [])
            ->merge($recentRoutes->pluck('ppmp')->filter());
        $returnedRecent = $allDashboardPpmps
            ->filter(fn ($p) => $p && str_ends_with($p->status ?? '', '_RETURNED'))
            ->unique('id')
            ->values();
        if ($returnedRecent->isNotEmpty()) {
            \Illuminate\Database\Eloquent\Collection::make($returnedRecent->all())->load(['reviews.reviewer', 'routes.fromUser']);
        }

        $signatories = $user->isAdmin() ? PpmpSignatory::latest('id')->get() : [];
        $users = ($user->isSuperAdmin() || $user->isAdminRole()) ? User::with('office')->orderBy('name')->get() : [];
        $offices = ($user->isSuperAdmin() || $user->isAdminRole()) ? Office::with('head')->orderBy('name')->get() : [];

        return response()->json([
            'role' => $user->role,
            'metrics' => $metrics,
            'recent_ppmps' => $recentPpmps,
            'recent_routes' => $recentRoutes,
            'pending_amendments' => $pendingAmendments ?? [],
            'signatories' => $signatories,
            'users' => $users,
            'offices' => $offices,
            'analytics' => $adminAnalytics ?? null,
            'signature_settings' => \App\Models\SystemSetting::getSignatureSettings(),
        ]);
    }

    /**
     * Compute rich executive visual analytics metrics for Admin & Super Admin,
     * including instant pre-computed datasets for all fiscal years and per fiscal year.
     */
    private function buildAdminAnalytics($base, array $metrics): array
    {
        // 1. Fiscal years distinct breakdown
        $fiscalYears = (clone $base)
            ->toBase()
            ->selectRaw('fiscal_year, count(*) as count, sum(total_budget) as total_budget')
            ->groupBy('fiscal_year')
            ->orderByDesc('fiscal_year')
            ->get()
            ->map(function ($row) {
                return [
                    'fiscal_year' => $row->fiscal_year,
                    'count' => (int) $row->count,
                    'total_budget' => (float) $row->total_budget,
                ];
            });

        // 2. Overall analytics scope (All fiscal years)
        $overall = $this->computeAnalyticsForScope($base, null);

        // 3. Pre-compute analytics breakdown for each individual fiscal year
        $byFiscalYear = [];
        foreach ($fiscalYears as $fy) {
            $yearKey = (string) $fy['fiscal_year'];
            $byFiscalYear[$yearKey] = $this->computeAnalyticsForScope($base, $yearKey);
        }

        // 4. Compliance Summary (Pre-proc conference & competitive vs alternative) in a single pass
        $complianceRow = PpmpItem::whereHas('ppmp', function ($q) {
            $q->whereDoesntHave('children');
        })
            ->toBase()
            ->selectRaw('
                SUM(CASE WHEN pre_proc_conference = 1 THEN 1 ELSE 0 END) as pre_proc_count,
                SUM(CASE WHEN pre_proc_conference = 1 THEN estimated_budget ELSE 0 END) as pre_proc_budget,
                SUM(CASE WHEN procurement_mode LIKE "%Competitive%" OR procurement_mode LIKE "%Bidding%" THEN 1 ELSE 0 END) as competitive_count,
                SUM(CASE WHEN procurement_mode LIKE "%Competitive%" OR procurement_mode LIKE "%Bidding%" THEN estimated_budget ELSE 0 END) as competitive_budget
            ')
            ->first();

        $compliance = [
            'pre_proc_count' => (int) ($complianceRow->pre_proc_count ?? 0),
            'pre_proc_budget' => (float) ($complianceRow->pre_proc_budget ?? 0),
            'competitive_count' => (int) ($complianceRow->competitive_count ?? 0),
            'competitive_budget' => (float) ($complianceRow->competitive_budget ?? 0),
        ];

        return array_merge($overall, [
            'fiscal_years' => $fiscalYears,
            'by_fiscal_year' => $byFiscalYear,
            'compliance' => $compliance,
        ]);
    }

    /**
     * Compute analytics dataset scoped to a specific fiscal year (or null for all)
     */
    private function computeAnalyticsForScope($base, ?string $fiscalYear = null): array
    {
        $scopedBase = clone $base;
        if ($fiscalYear) {
            $scopedBase->where('fiscal_year', $fiscalYear);
        }

        $statusRows = (clone $scopedBase)
            ->toBase()
            ->selectRaw('status, count(*) as cnt, sum(total_budget) as budget_sum')
            ->groupBy('status')
            ->get()
            ->keyBy('status');
        $c = fn (string $s): int => (int) ($statusRows[$s]->cnt ?? 0);

        $scopedMetrics = [
            'total_ppmps' => (int) $statusRows->sum('cnt'),
            'total_budget' => (float) $statusRows->sum('budget_sum'),
            'draft' => $c('DRAFT'),
            'head_pending' => $c('HEAD_PENDING'),
            'in_review' => $c('BUDGET_OFFICER_REVIEW') + $c('PACCO_REVIEW') + $c('OPPMO_REVIEW') + $c('TWG_REVIEW'),
            'ready_to_print' => $c('READY_TO_PRINT'),
            'pending_amendments' => (clone $scopedBase)->whereHas('amendment', fn($aq) => $aq->where('amendment_status', 'PENDING_APPROVAL'))->count(),
        ];

        // 1. Budget distribution by office
        $budgetByOffice = (clone $scopedBase)
            ->toBase()
            ->join('offices', 'ppmps.office_id', '=', 'offices.id')
            ->selectRaw('offices.id, offices.code, offices.name, count(ppmps.id) as ppmp_count, sum(ppmps.total_budget) as total_budget')
            ->groupBy('offices.id', 'offices.code', 'offices.name')
            ->orderByDesc('total_budget')
            ->get()
            ->map(function ($row) {
                return [
                    'office_id' => $row->id,
                    'code' => $row->code,
                    'name' => $row->name,
                    'ppmp_count' => (int) $row->ppmp_count,
                    'total_budget' => (float) $row->total_budget,
                ];
            });

        // 2. Procurement Mode, 4. Source of Fund, 5. Project Type, and 6. Monthly Spending Schedule
        // Computed in a single lightweight pass over scoped items instead of 4 separate correlated subquery scans per fiscal year
        $items = PpmpItem::whereHas('ppmp', function ($q) use ($fiscalYear) {
            $q->whereDoesntHave('children');
            if ($fiscalYear) {
                $q->where('fiscal_year', $fiscalYear);
            }
        })
            ->toBase()
            ->get(['id', 'procurement_mode', 'source_of_fund', 'project_type', 'start_date', 'end_date', 'estimated_budget', 'created_at']);

        $modeBuckets = [];
        $fundBuckets = [];
        $typeBuckets = [];

        $monthNames = [1 => 'Jan', 2 => 'Feb', 3 => 'Mar', 4 => 'Apr', 5 => 'May', 6 => 'Jun', 7 => 'Jul', 8 => 'Aug', 9 => 'Sep', 10 => 'Oct', 11 => 'Nov', 12 => 'Dec'];
        $monthlySchedule = [];
        for ($m = 1; $m <= 12; $m++) {
            $monthlySchedule[$m] = [
                'month' => $m,
                'name' => $monthNames[$m],
                'count' => 0,
                'amount' => 0.0,
            ];
        }

        foreach ($items as $item) {
            $budget = (float) $item->estimated_budget;

            $mode = trim((string) ($item->procurement_mode ?? ''));
            if ($mode !== '') {
                $modeBuckets[$mode] ??= ['mode' => $mode, 'item_count' => 0, 'total_amount' => 0.0];
                $modeBuckets[$mode]['item_count']++;
                $modeBuckets[$mode]['total_amount'] += $budget;
            }

            $fund = trim((string) ($item->source_of_fund ?? ''));
            $fundKey = $fund !== '' ? $fund : 'General Fund';
            $fundBuckets[$fundKey] ??= ['source' => $fundKey, 'count' => 0, 'total_amount' => 0.0];
            $fundBuckets[$fundKey]['count']++;
            $fundBuckets[$fundKey]['total_amount'] += $budget;

            $ptype = trim((string) ($item->project_type ?? ''));
            $ptypeKey = $ptype !== '' ? $ptype : 'Goods';
            $typeBuckets[$ptypeKey] ??= ['project_type' => $ptypeKey, 'count' => 0, 'total_amount' => 0.0];
            $typeBuckets[$ptypeKey]['count']++;
            $typeBuckets[$ptypeKey]['total_amount'] += $budget;

            $matchedMonths = [];
            $combined = ($item->start_date ?? '') . ' ' . ($item->end_date ?? '');
            preg_match_all('/\b([1-9]|1[0-2])\/\d{4}\b/', $combined, $matches);
            if (!empty($matches[1])) {
                foreach ($matches[1] as $m) {
                    $matchedMonths[(int)$m] = true;
                }
            }
            if (empty($matchedMonths)) {
                $createdMonth = $item->created_at ? (int) date('n', strtotime((string) $item->created_at)) : 1;
                $matchedMonths[$createdMonth] = true;
            }
            $monthCount = count($matchedMonths);
            $splitAmount = $monthCount > 0 ? $budget / $monthCount : $budget;
            foreach (array_keys($matchedMonths) as $m) {
                if ($m >= 1 && $m <= 12) {
                    $monthlySchedule[$m]['count'] += 1;
                    $monthlySchedule[$m]['amount'] += round($splitAmount, 2);
                }
            }
        }

        $procurementModes = collect($modeBuckets)->sortByDesc('total_amount')->values();
        $fundSources = collect($fundBuckets)->sortByDesc('total_amount')->values();
        $projectTypes = collect($typeBuckets)->sortByDesc('total_amount')->values();

        // 3. Status Distribution for Visual Analytics
        $statusDistribution = [
            ['status' => 'DRAFT', 'label' => 'Drafts', 'count' => $scopedMetrics['draft'], 'color' => '#64748b'],
            ['status' => 'HEAD_PENDING', 'label' => 'Pending Office Head', 'count' => $scopedMetrics['head_pending'], 'color' => '#f59e0b'],
            ['status' => 'IN_REVIEW', 'label' => 'Under Review (PBO/PACCO/OPPMO/TWG)', 'count' => $scopedMetrics['in_review'], 'color' => '#6366f1'],
            ['status' => 'READY_TO_PRINT', 'label' => 'Ready to Print / Approved', 'count' => $scopedMetrics['ready_to_print'], 'color' => '#10b981'],
            ['status' => 'PENDING_AMENDMENTS', 'label' => 'Pending Amendments', 'count' => $scopedMetrics['pending_amendments'], 'color' => '#a855f7'],
        ];

        // 7. Quarterly Totals
        $quarterlySchedule = [
            'Q1' => ['label' => 'Q1 (Jan - Mar)', 'amount' => $monthlySchedule[1]['amount'] + $monthlySchedule[2]['amount'] + $monthlySchedule[3]['amount'], 'count' => $monthlySchedule[1]['count'] + $monthlySchedule[2]['count'] + $monthlySchedule[3]['count']],
            'Q2' => ['label' => 'Q2 (Apr - Jun)', 'amount' => $monthlySchedule[4]['amount'] + $monthlySchedule[5]['amount'] + $monthlySchedule[6]['amount'], 'count' => $monthlySchedule[4]['count'] + $monthlySchedule[5]['count'] + $monthlySchedule[6]['count']],
            'Q3' => ['label' => 'Q3 (Jul - Sep)', 'amount' => $monthlySchedule[7]['amount'] + $monthlySchedule[8]['amount'] + $monthlySchedule[9]['amount'], 'count' => $monthlySchedule[7]['count'] + $monthlySchedule[8]['count'] + $monthlySchedule[9]['count']],
            'Q4' => ['label' => 'Q4 (Oct - Dec)', 'amount' => $monthlySchedule[10]['amount'] + $monthlySchedule[11]['amount'] + $monthlySchedule[12]['amount'], 'count' => $monthlySchedule[10]['count'] + $monthlySchedule[11]['count'] + $monthlySchedule[12]['count']],
        ];

        // 8. Top Procurement Projects (High-Value Items) - single joined query without N+1 Eloquent $with relations
        $topProjects = PpmpItem::whereHas('ppmp', function ($q) use ($fiscalYear) {
                $q->whereDoesntHave('children');
                if ($fiscalYear) {
                    $q->where('fiscal_year', $fiscalYear);
                }
            })
            ->toBase()
            ->join('ppmps', 'ppmp_items.ppmp_id', '=', 'ppmps.id')
            ->leftJoin('offices', 'ppmps.office_id', '=', 'offices.id')
            ->select([
                'ppmp_items.id',
                'ppmp_items.description',
                'ppmp_items.estimated_budget',
                'ppmp_items.procurement_mode',
                'ppmp_items.project_type',
                'ppmp_items.source_of_fund',
                'ppmp_items.ppmp_id',
                'ppmps.source_of_fund as ppmp_source_of_fund',
                'ppmps.fiscal_year as ppmp_fiscal_year',
                'ppmps.title as ppmp_title',
                'offices.code as office_code',
                'offices.name as office_name',
            ])
            ->orderByDesc('ppmp_items.estimated_budget')
            ->take(8)
            ->get()
            ->map(function ($it) {
                return [
                    'id' => $it->id,
                    'description' => $it->description,
                    'estimated_budget' => (float) $it->estimated_budget,
                    'procurement_mode' => $it->procurement_mode ?? 'Not Specified',
                    'project_type' => $it->project_type ?? 'Goods',
                    'source_of_fund' => $it->source_of_fund ?? ($it->ppmp_source_of_fund ?? 'General Fund'),
                    'office_code' => $it->office_code ?? 'N/A',
                    'office_name' => $it->office_name ?? 'N/A',
                    'fiscal_year' => $it->ppmp_fiscal_year ?? '2026',
                    'ppmp_id' => $it->ppmp_id,
                    'ppmp_title' => $it->ppmp_title ?? '',
                ];
            });

        // 9. Detailed Workflow Stages (reusing grouped $statusRows counts)
        $workflowStages = [
            ['stage' => 'DRAFT', 'label' => 'End-User Drafting', 'count' => $c('DRAFT'), 'color' => '#64748b'],
            ['stage' => 'HEAD_PENDING', 'label' => 'Office Head Approval', 'count' => $c('HEAD_PENDING'), 'color' => '#f59e0b'],
            ['stage' => 'BUDGET_OFFICER_REVIEW', 'label' => 'Provincial Budget (PBO)', 'count' => $c('BUDGET_OFFICER_REVIEW'), 'color' => '#3b82f6'],
            ['stage' => 'PACCO_REVIEW', 'label' => 'Accounting Office (PACCO)', 'count' => $c('PACCO_REVIEW'), 'color' => '#06b6d4'],
            ['stage' => 'OPPMO_REVIEW', 'label' => 'Procurement Management (OPPMO)', 'count' => $c('OPPMO_REVIEW'), 'color' => '#8b5cf6'],
            ['stage' => 'TWG_REVIEW', 'label' => 'Technical Working Group (TWG)', 'count' => $c('TWG_REVIEW'), 'color' => '#ec4899'],
            ['stage' => 'READY_TO_PRINT', 'label' => 'Cleared / Ready to Print', 'count' => $c('READY_TO_PRINT'), 'color' => '#10b981'],
        ];

        return [
            'metrics' => $scopedMetrics,
            'budget_by_office' => $budgetByOffice,
            'procurement_modes' => $procurementModes,
            'status_distribution' => $statusDistribution,
            'fund_sources' => $fundSources,
            'project_types' => $projectTypes,
            'monthly_schedule' => array_values($monthlySchedule),
            'quarterly_schedule' => $quarterlySchedule,
            'top_projects' => $topProjects,
            'workflow_stages' => $workflowStages,
        ];
    }
}
