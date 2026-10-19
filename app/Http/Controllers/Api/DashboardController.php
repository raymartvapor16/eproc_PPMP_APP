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

        if ($user->isEndUser()) {
            $base = Ppmp::where('created_by', $user->id)->whereDoesntHave('children');

            $metrics = [
                'draft' => (clone $base)->where('status', 'DRAFT')->count(),
                'head_pending' => (clone $base)->where('status', 'HEAD_PENDING')->count(),
                'head_returned' => (clone $base)->where('status', 'HEAD_RETURNED')->count(),
                'ready_for_review' => (clone $base)->where('status', 'HEAD_APPROVED')->count(),
                'in_review' => (clone $base)->whereIn('status', ['BUDGET_OFFICER_REVIEW', 'PACCO_REVIEW', 'OPPMO_REVIEW', 'TWG_REVIEW'])->count(),
                'returned_by_reviewer' => (clone $base)->whereIn('status', ['BUDGET_OFFICER_RETURNED', 'PACCO_RETURNED', 'OPPMO_RETURNED', 'TWG_RETURNED'])->count(),
                'ready_to_print' => (clone $base)->where('status', 'READY_TO_PRINT')->count(),
                'total' => (clone $base)->count(),
            ];

            $endUserRecent = clone $base;
            $recentPpmps = $endUserRecent->with(['office', 'signatures', 'items'])->latest('updated_at')->take(100)->get();
        } elseif ($user->isHead()) {
            $base = Ppmp::where('office_id', $user->office_id)->whereDoesntHave('children');

            $metrics = [
                'pending_endorsement' => (clone $base)->where('status', 'HEAD_PENDING')->count(),
                'endorsed_approved' => (clone $base)->where('status', 'READY_TO_PRINT')->count(),
                'returned' => (clone $base)->where('status', 'HEAD_RETURNED')->count(),
                'total_office' => (clone $base)->count(),
            ];

            $headRecent = clone $base;
            $recentPpmps = $headRecent->with(['creator', 'signatures'])->latest('updated_at')->take(100)->get();
        } elseif ($user->isBudgetOfficer()) {
            $base = Ppmp::whereDoesntHave('children');

            $metrics = [
                'pending_review' => (clone $base)->where('status', 'BUDGET_OFFICER_REVIEW')->count(),
                'returned' => (clone $base)->where('status', 'BUDGET_OFFICER_RETURNED')->count(),
                'approved' => (clone $base)->whereIn('status', ['OPPMO_REVIEW', 'TWG_REVIEW', 'HEAD_PENDING', 'READY_TO_PRINT'])->count(),
            ];

            $budgetRecent = clone $base;
            $recentPpmps = $budgetRecent->whereIn('status', ['BUDGET_OFFICER_REVIEW', 'BUDGET_OFFICER_RETURNED', 'OPPMO_REVIEW', 'TWG_REVIEW', 'HEAD_PENDING', 'READY_TO_PRINT'])
                ->with(['office', 'creator', 'signatures'])
                ->latest('updated_at')
                ->take(100)
                ->get();
        } elseif ($user->isOppmo()) {
            $base = Ppmp::whereDoesntHave('children');

            $metrics = [
                'pending_review' => (clone $base)->where('status', 'OPPMO_REVIEW')->count(),
                'returned' => (clone $base)->where('status', 'OPPMO_RETURNED')->count(),
                'approved' => (clone $base)->whereIn('status', ['TWG_REVIEW', 'HEAD_PENDING', 'READY_TO_PRINT'])->count(),
            ];

            $oppmoRecent = clone $base;
            $recentPpmps = $oppmoRecent->whereIn('status', ['OPPMO_REVIEW', 'OPPMO_RETURNED', 'TWG_REVIEW', 'HEAD_PENDING', 'READY_TO_PRINT'])
                ->with(['office', 'creator', 'signatures'])
                ->latest('updated_at')
                ->take(100)
                ->get();
        } elseif ($user->isTwg()) {
            $base = Ppmp::whereDoesntHave('children');

            $metrics = [
                'pending_review' => (clone $base)->where('status', 'TWG_REVIEW')->count(),
                'returned' => (clone $base)->where('status', 'TWG_RETURNED')->count(),
                'ready_to_print' => (clone $base)->where('status', 'READY_TO_PRINT')->count(),
            ];

            $twgRecent = clone $base;
            $recentPpmps = $twgRecent->whereIn('status', ['TWG_REVIEW', 'TWG_RETURNED', 'HEAD_PENDING', 'HEAD_RETURNED', 'READY_TO_PRINT'])
                ->with(['office', 'creator', 'signatures'])
                ->latest('updated_at')
                ->take(100)
                ->get();
        } elseif ($user->isPacco()) {
            $base = Ppmp::whereDoesntHave('children');

            $metrics = [
                'pending_review' => (clone $base)->where('status', 'PACCO_REVIEW')->count(),
                'returned' => (clone $base)->where('status', 'PACCO_RETURNED')->count(),
                'approved' => (clone $base)->whereIn('status', ['OPPMO_REVIEW', 'TWG_REVIEW', 'HEAD_PENDING', 'READY_TO_PRINT'])->count(),
                'ready_to_print' => (clone $base)->where('status', 'READY_TO_PRINT')->count(),
                'total_review' => (clone $base)->whereNotIn('status', ['DRAFT'])->count(),
            ];

            $paccoRecent = clone $base;
            $recentPpmps = $paccoRecent->where(function ($q) {
                $q->whereIn('status', ['PACCO_REVIEW', 'PACCO_RETURNED'])
                    ->orWhereNotNull('pacco_approved_at')
                    ->orWhere('source_of_fund', 'like', '%trust%');
            })
                ->with(['office', 'creator', 'signatures'])
                ->latest('updated_at')
                ->take(100)
                ->get();
        } elseif ($user->isSuperAdmin()) {
            // Super Admin: Full Executive Overview & Analytics
            $base = Ppmp::whereDoesntHave('children');

            $metrics = [
                'total_ppmps' => (clone $base)->count(),
                'total_budget' => (float) ((clone $base)->sum('total_budget') ?? 0),
                'draft' => (clone $base)->where('status', 'DRAFT')->count(),
                'head_pending' => (clone $base)->where('status', 'HEAD_PENDING')->count(),
                'in_review' => (clone $base)->whereIn('status', ['BUDGET_OFFICER_REVIEW', 'PACCO_REVIEW', 'OPPMO_REVIEW', 'TWG_REVIEW'])->count(),
                'ready_to_print' => (clone $base)->where('status', 'READY_TO_PRINT')->count(),
                'pending_amendments' => Ppmp::where('amendment_status', 'PENDING_APPROVAL')->count(),
            ];

            $superRecent = clone $base;
            $recentPpmps = $superRecent->with(['office', 'creator', 'signatures'])->latest('updated_at')->take(100)->get();

            $adminAnalytics = $this->buildAdminAnalytics($base, $metrics);
        } else {
            // Admin role: Specialized management for Users, Amended/Supplemental, System Logs, PPMP List
            $base = Ppmp::whereDoesntHave('children');

            $metrics = [
                'total_ppmps' => (clone $base)->count(),
                'total_budget' => (float) ((clone $base)->sum('total_budget') ?? 0),
                'draft' => (clone $base)->where('status', 'DRAFT')->count(),
                'head_pending' => (clone $base)->where('status', 'HEAD_PENDING')->count(),
                'in_review' => (clone $base)->whereIn('status', ['BUDGET_OFFICER_REVIEW', 'PACCO_REVIEW', 'OPPMO_REVIEW', 'TWG_REVIEW'])->count(),
                'ready_to_print' => (clone $base)->where('status', 'READY_TO_PRINT')->count(),
                'pending_amendments' => Ppmp::where('amendment_status', 'PENDING_APPROVAL')->count(),
                'total_amendments' => Ppmp::whereNotNull('amendment_status')->count(),
                'total_users' => User::count(),
                'pending_users' => User::where('is_active', false)->where('approval_status', '!=', 'rejected')->count(),
                'active_users' => User::where('is_active', true)->where('approval_status', '!=', 'rejected')->count(),
                'rejected_users' => User::where('approval_status', 'rejected')->count(),
                'total_logs' => AuditLog::count(),
            ];

            $recentPpmps = (clone $base)->with(['office', 'creator', 'signatures'])->latest('updated_at')->take(100)->get();

            $pendingAmendments = Ppmp::with(['office', 'creator', 'attachments'])
                ->where('amendment_status', 'PENDING_APPROVAL')
                ->latest('updated_at')
                ->get();

            $adminAnalytics = $this->buildAdminAnalytics($base, $metrics);
        }

        // Recent Routing Actions
        $recentRoutes = PpmpRoute::with(['ppmp', 'fromUser', 'toUser'])
            ->latest('id')
            ->take(8)
            ->get();

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

        // 4. Compliance Summary (Pre-proc conference & competitive vs alternative)
        $preProcItems = PpmpItem::whereHas('ppmp', function ($q) {
            $q->whereDoesntHave('children');
        })->where('pre_proc_conference', true);

        $competitiveItems = PpmpItem::whereHas('ppmp', function ($q) {
            $q->whereDoesntHave('children');
        })->where(function ($q) {
            $q->where('procurement_mode', 'LIKE', '%Competitive%')
              ->orWhere('procurement_mode', 'LIKE', '%Bidding%');
        });

        $compliance = [
            'pre_proc_count' => (clone $preProcItems)->count(),
            'pre_proc_budget' => (float) ((clone $preProcItems)->sum('estimated_budget') ?? 0),
            'competitive_count' => (clone $competitiveItems)->count(),
            'competitive_budget' => (float) ((clone $competitiveItems)->sum('estimated_budget') ?? 0),
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

        $scopedMetrics = [
            'total_ppmps' => (clone $scopedBase)->count(),
            'total_budget' => (float) ((clone $scopedBase)->sum('total_budget') ?? 0),
            'draft' => (clone $scopedBase)->where('status', 'DRAFT')->count(),
            'head_pending' => (clone $scopedBase)->where('status', 'HEAD_PENDING')->count(),
            'in_review' => (clone $scopedBase)->whereIn('status', ['BUDGET_OFFICER_REVIEW', 'PACCO_REVIEW', 'OPPMO_REVIEW', 'TWG_REVIEW'])->count(),
            'ready_to_print' => (clone $scopedBase)->where('status', 'READY_TO_PRINT')->count(),
            'pending_amendments' => (clone $scopedBase)->where('amendment_status', 'PENDING_APPROVAL')->count(),
        ];

        // 1. Budget distribution by office
        $budgetByOffice = (clone $scopedBase)
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

        // 2. Procurement Mode breakdown from items
        $procurementModes = PpmpItem::whereHas('ppmp', function ($q) use ($fiscalYear) {
            $q->whereDoesntHave('children');
            if ($fiscalYear) {
                $q->where('fiscal_year', $fiscalYear);
            }
        })
            ->selectRaw('procurement_mode, count(*) as item_count, sum(estimated_budget) as total_amount')
            ->whereNotNull('procurement_mode')
            ->where('procurement_mode', '!=', '')
            ->groupBy('procurement_mode')
            ->orderByDesc('total_amount')
            ->get()
            ->map(function ($row) {
                return [
                    'mode' => $row->procurement_mode,
                    'item_count' => (int) $row->item_count,
                    'total_amount' => (float) $row->total_amount,
                ];
            });

        // 3. Status Distribution for Visual Analytics
        $statusDistribution = [
            ['status' => 'DRAFT', 'label' => 'Drafts', 'count' => $scopedMetrics['draft'], 'color' => '#64748b'],
            ['status' => 'HEAD_PENDING', 'label' => 'Pending Office Head', 'count' => $scopedMetrics['head_pending'], 'color' => '#f59e0b'],
            ['status' => 'IN_REVIEW', 'label' => 'Under Review (PBO/PACCO/OPPMO/TWG)', 'count' => $scopedMetrics['in_review'], 'color' => '#6366f1'],
            ['status' => 'READY_TO_PRINT', 'label' => 'Ready to Print / Approved', 'count' => $scopedMetrics['ready_to_print'], 'color' => '#10b981'],
            ['status' => 'PENDING_AMENDMENTS', 'label' => 'Pending Amendments', 'count' => $scopedMetrics['pending_amendments'], 'color' => '#a855f7'],
        ];

        // 4. Source of Fund Distribution
        $fundSources = PpmpItem::whereHas('ppmp', function ($q) use ($fiscalYear) {
            $q->whereDoesntHave('children');
            if ($fiscalYear) {
                $q->where('fiscal_year', $fiscalYear);
            }
        })
            ->selectRaw('COALESCE(NULLIF(source_of_fund, ""), "General Fund") as source, count(*) as count, sum(estimated_budget) as total_amount')
            ->groupBy('source')
            ->orderByDesc('total_amount')
            ->get()
            ->map(function ($row) {
                return [
                    'source' => $row->source,
                    'count' => (int) $row->count,
                    'total_amount' => (float) $row->total_amount,
                ];
            });

        // 5. Project Type Distribution (Goods, Infra, Consulting)
        $projectTypes = PpmpItem::whereHas('ppmp', function ($q) use ($fiscalYear) {
            $q->whereDoesntHave('children');
            if ($fiscalYear) {
                $q->where('fiscal_year', $fiscalYear);
            }
        })
            ->selectRaw('COALESCE(NULLIF(project_type, ""), "Goods") as ptype, count(*) as count, sum(estimated_budget) as total_amount')
            ->groupBy('ptype')
            ->orderByDesc('total_amount')
            ->get()
            ->map(function ($row) {
                return [
                    'project_type' => $row->ptype,
                    'count' => (int) $row->count,
                    'total_amount' => (float) $row->total_amount,
                ];
            });

        // 6. Monthly Spending Schedule (Jan to Dec)
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

        $items = PpmpItem::whereHas('ppmp', function ($q) use ($fiscalYear) {
            $q->whereDoesntHave('children');
            if ($fiscalYear) {
                $q->where('fiscal_year', $fiscalYear);
            }
        })->get(['id', 'start_date', 'end_date', 'estimated_budget', 'created_at']);

        foreach ($items as $item) {
            $budget = (float) $item->estimated_budget;
            $matchedMonths = [];
            $combined = ($item->start_date ?? '') . ' ' . ($item->end_date ?? '');
            preg_match_all('/\b([1-9]|1[0-2])\/\d{4}\b/', $combined, $matches);
            if (!empty($matches[1])) {
                foreach ($matches[1] as $m) {
                    $matchedMonths[(int)$m] = true;
                }
            }
            if (empty($matchedMonths)) {
                $createdMonth = (int) ($item->created_at ? $item->created_at->format('n') : 1);
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

        // 7. Quarterly Totals
        $quarterlySchedule = [
            'Q1' => ['label' => 'Q1 (Jan - Mar)', 'amount' => $monthlySchedule[1]['amount'] + $monthlySchedule[2]['amount'] + $monthlySchedule[3]['amount'], 'count' => $monthlySchedule[1]['count'] + $monthlySchedule[2]['count'] + $monthlySchedule[3]['count']],
            'Q2' => ['label' => 'Q2 (Apr - Jun)', 'amount' => $monthlySchedule[4]['amount'] + $monthlySchedule[5]['amount'] + $monthlySchedule[6]['amount'], 'count' => $monthlySchedule[4]['count'] + $monthlySchedule[5]['count'] + $monthlySchedule[6]['count']],
            'Q3' => ['label' => 'Q3 (Jul - Sep)', 'amount' => $monthlySchedule[7]['amount'] + $monthlySchedule[8]['amount'] + $monthlySchedule[9]['amount'], 'count' => $monthlySchedule[7]['count'] + $monthlySchedule[8]['count'] + $monthlySchedule[9]['count']],
            'Q4' => ['label' => 'Q4 (Oct - Dec)', 'amount' => $monthlySchedule[10]['amount'] + $monthlySchedule[11]['amount'] + $monthlySchedule[12]['amount'], 'count' => $monthlySchedule[10]['count'] + $monthlySchedule[11]['count'] + $monthlySchedule[12]['count']],
        ];

        // 8. Top Procurement Projects (High-Value Items)
        $topProjects = PpmpItem::with(['ppmp.office'])
            ->whereHas('ppmp', function ($q) use ($fiscalYear) {
                $q->whereDoesntHave('children');
                if ($fiscalYear) {
                    $q->where('fiscal_year', $fiscalYear);
                }
            })
            ->orderByDesc('estimated_budget')
            ->take(8)
            ->get()
            ->map(function ($it) {
                return [
                    'id' => $it->id,
                    'description' => $it->description,
                    'estimated_budget' => (float) $it->estimated_budget,
                    'procurement_mode' => $it->procurement_mode ?? 'Not Specified',
                    'project_type' => $it->project_type ?? 'Goods',
                    'source_of_fund' => $it->source_of_fund ?? ($it->ppmp?->source_of_fund ?? 'General Fund'),
                    'office_code' => $it->ppmp?->office?->code ?? 'N/A',
                    'office_name' => $it->ppmp?->office?->name ?? 'N/A',
                    'fiscal_year' => $it->ppmp?->fiscal_year ?? '2026',
                    'ppmp_id' => $it->ppmp_id,
                    'ppmp_title' => $it->ppmp?->title ?? '',
                ];
            });

        // 9. Detailed Workflow Stages
        $workflowStages = [
            ['stage' => 'DRAFT', 'label' => 'End-User Drafting', 'count' => (clone $scopedBase)->where('status', 'DRAFT')->count(), 'color' => '#64748b'],
            ['stage' => 'HEAD_PENDING', 'label' => 'Office Head Approval', 'count' => (clone $scopedBase)->where('status', 'HEAD_PENDING')->count(), 'color' => '#f59e0b'],
            ['stage' => 'BUDGET_OFFICER_REVIEW', 'label' => 'Provincial Budget (PBO)', 'count' => (clone $scopedBase)->where('status', 'BUDGET_OFFICER_REVIEW')->count(), 'color' => '#3b82f6'],
            ['stage' => 'PACCO_REVIEW', 'label' => 'Accounting Office (PACCO)', 'count' => (clone $scopedBase)->where('status', 'PACCO_REVIEW')->count(), 'color' => '#06b6d4'],
            ['stage' => 'OPPMO_REVIEW', 'label' => 'Procurement Management (OPPMO)', 'count' => (clone $scopedBase)->where('status', 'OPPMO_REVIEW')->count(), 'color' => '#8b5cf6'],
            ['stage' => 'TWG_REVIEW', 'label' => 'Technical Working Group (TWG)', 'count' => (clone $scopedBase)->where('status', 'TWG_REVIEW')->count(), 'color' => '#ec4899'],
            ['stage' => 'READY_TO_PRINT', 'label' => 'Cleared / Ready to Print', 'count' => (clone $scopedBase)->where('status', 'READY_TO_PRINT')->count(), 'color' => '#10b981'],
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
