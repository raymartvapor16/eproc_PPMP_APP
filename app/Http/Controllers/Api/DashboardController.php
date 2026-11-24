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
use App\Support\ReviewHeadResolver;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class DashboardController extends Controller
{

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $metrics = [];
        $recentPpmps = [];

        $commonRecentRelations = [
            'office.head' => fn ($q) => $q->without('pnpkiSignature'),
            'creator' => fn ($q) => $q->without('pnpkiSignature'),
            'items',
            'signatures',
            'attachments',
            'marketScoping',
            'monitoringProjects',
            'amendment',
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
            $endUserRelations = array_diff_key($commonRecentRelations, ['creator' => true]);
            $recentPpmps = $endUserRecent->with($endUserRelations)->latest('updated_at')->take(100)->get();
            $recentPpmps->each(fn ($p) => $p->setRelation('creator', $user));
            $endUserAnalytics = $this->buildEndUserAnalytics($recentPpmps, $metrics);
        } elseif ($user->isHead()) {
            if ($user->office_id && !$user->relationLoaded('office')) {
                $user->load(['office.head' => fn ($q) => $q->without('pnpkiSignature')]);
            }
            $headStages = ReviewHeadResolver::userStagesForHead($user);
            $appStages = ReviewHeadResolver::userAppSignatoryStages($user);
            $base = Ppmp::whereDoesntHave('children');
            if (empty($headStages) && empty($appStages)) {
                $base->where('office_id', $user->office_id);
            } else {
                $stageStatuses = [];
                if (in_array('budget', $headStages, true)) {
                    array_push($stageStatuses, 'BUDGET_HEAD_REVIEW', 'BUDGET_HEAD_RETURNED', 'OPPMO_HEAD_REVIEW', 'APP_PREPARER_REVIEW', 'GOVERNOR_REVIEW', 'READY_TO_PRINT');
                }
                if (in_array('pacco', $headStages, true)) {
                    array_push($stageStatuses, 'PACCO_HEAD_REVIEW', 'PACCO_HEAD_RETURNED', 'OPPMO_HEAD_REVIEW', 'APP_PREPARER_REVIEW', 'GOVERNOR_REVIEW', 'READY_TO_PRINT');
                }
                if (in_array('oppmo', $headStages, true)) {
                    array_push($stageStatuses, 'OPPMO_HEAD_REVIEW', 'OPPMO_HEAD_RETURNED', 'APP_PREPARER_REVIEW', 'GOVERNOR_REVIEW', 'READY_TO_PRINT');
                }
                if (in_array('app_preparer', $appStages, true)) {
                    array_push($stageStatuses, 'APP_PREPARER_REVIEW', 'APP_PREPARER_RETURNED', 'GOVERNOR_REVIEW', 'READY_TO_PRINT');
                }
                if (in_array('governor', $appStages, true)) {
                    array_push($stageStatuses, 'GOVERNOR_REVIEW', 'GOVERNOR_RETURNED', 'READY_TO_PRINT');
                }
                $stageStatuses = array_values(array_unique($stageStatuses));
                $base->where(function ($q) use ($user, $stageStatuses) {
                    $q->where('office_id', $user->office_id)
                      ->orWhereIn('status', $stageStatuses);
                });
            }

            $byStatus = (clone $base)->selectRaw('status, count(*) as cnt')->groupBy('status')->pluck('cnt', 'status');
            $c = fn (string $s): int => (int) ($byStatus[$s] ?? 0);

            $metrics = [
                'pending_endorsement' => $c('HEAD_PENDING') + $c('BUDGET_HEAD_REVIEW') + $c('PACCO_HEAD_REVIEW') + $c('OPPMO_HEAD_REVIEW') + $c('APP_PREPARER_REVIEW') + $c('GOVERNOR_REVIEW'),
                'endorsed_approved' => $c('READY_TO_PRINT'),
                'returned' => $c('HEAD_RETURNED') + $c('BUDGET_HEAD_RETURNED') + $c('PACCO_HEAD_RETURNED') + $c('OPPMO_HEAD_RETURNED') + $c('APP_PREPARER_RETURNED') + $c('GOVERNOR_RETURNED'),
                'total_office' => (int) $byStatus->sum(),
            ];

            $headRecent = clone $base;
            if (empty($headStages) && empty($appStages) && $user->relationLoaded('office') && $user->office) {
                $headRelations = array_diff_key($commonRecentRelations, ['office.head' => true]);
                $recentPpmps = $headRecent->with($headRelations)->latest('updated_at')->take(100)->get();
                $recentPpmps->each(fn ($p) => $p->setRelation('office', $user->office));
            } else {
                $recentPpmps = $headRecent->with($commonRecentRelations)->latest('updated_at')->take(100)->get();
            }
        } elseif ($user->isBudgetOfficer()) {
            $base = Ppmp::whereDoesntHave('children')->where(function ($q) use ($user) {
                $q->where(function ($subQ) use ($user) {
                    $subQ->whereNull('budget_reviewer_id')
                         ->orWhere('budget_reviewer_id', $user->id)
                         ->orWhere('created_by', $user->id)
                         ->orWhereHas('signatures', function ($sq) use ($user) {
                             $sq->where('role', 'budget_officer')->where('user_id', $user->id);
                         });
                })->orWhere('status', 'READY_TO_PRINT');
            });
            $byStatus = (clone $base)->selectRaw('status, count(*) as cnt')->groupBy('status')->pluck('cnt', 'status');
            $c = fn (string $s): int => (int) ($byStatus[$s] ?? 0);

            $myApproved = $c('BUDGET_HEAD_REVIEW') + $c('BUDGET_HEAD_RETURNED') + $c('OPPMO_REVIEW') + $c('OPPMO_HEAD_REVIEW') + $c('OPPMO_HEAD_RETURNED') + $c('HEAD_PENDING') + $c('HEAD_RETURNED');
            $myReady = Ppmp::whereDoesntHave('children')
                ->where('status', 'READY_TO_PRINT')
                ->where(function ($q) use ($user) {
                    $q->where('budget_reviewer_id', $user->id)
                      ->orWhereHas('signatures', fn($sq) => $sq->where('role', 'budget_officer')->where('user_id', $user->id));
                })->count();

            $metrics = [
                'pending_review' => $c('BUDGET_OFFICER_REVIEW'),
                'returned' => $c('BUDGET_OFFICER_RETURNED'),
                'approved' => $myApproved + $myReady,
                'ready_to_print' => $c('READY_TO_PRINT'),
            ];

            $budgetRecent = clone $base;
            $recentPpmps = $budgetRecent->whereIn('status', ['BUDGET_OFFICER_REVIEW', 'BUDGET_OFFICER_RETURNED', 'OPPMO_REVIEW', 'HEAD_PENDING', 'READY_TO_PRINT'])
                ->with($commonRecentRelations)
                ->latest('updated_at')
                ->take(100)
                ->get();
        } elseif ($user->isOppmo()) {
            $base = Ppmp::whereDoesntHave('children')->where(function ($q) use ($user) {
                $q->where(function ($subQ) use ($user) {
                    $subQ->whereNull('oppmo_reviewer_id')
                         ->orWhere('oppmo_reviewer_id', $user->id)
                         ->orWhere('created_by', $user->id)
                         ->orWhereHas('signatures', function ($sq) use ($user) {
                             $sq->where('role', 'oppmo')->where('user_id', $user->id);
                         });
                })->orWhere('status', 'READY_TO_PRINT');
            });
            $byStatus = (clone $base)->selectRaw('status, count(*) as cnt')->groupBy('status')->pluck('cnt', 'status');
            $c = fn (string $s): int => (int) ($byStatus[$s] ?? 0);

            $myApproved = (clone $base)->where('status', '!=', 'READY_TO_PRINT')
                ->whereIn('status', ['HEAD_PENDING', 'HEAD_RETURNED'])
                ->count();
            $myReady = Ppmp::whereDoesntHave('children')
                ->where('status', 'READY_TO_PRINT')
                ->where(function ($q) use ($user) {
                    $q->where('oppmo_reviewer_id', $user->id)
                      ->orWhereHas('signatures', fn($sq) => $sq->where('role', 'oppmo')->where('user_id', $user->id));
                })->count();

            $metrics = [
                'pending_review' => $c('OPPMO_REVIEW'),
                'returned' => $c('OPPMO_RETURNED'),
                'approved' => $myApproved + $myReady,
                'ready_to_print' => $c('READY_TO_PRINT'),
            ];

            $oppmoRecent = clone $base;
            $recentPpmps = $oppmoRecent->whereIn('status', ['OPPMO_REVIEW', 'OPPMO_RETURNED', 'HEAD_PENDING', 'READY_TO_PRINT'])
                ->with($commonRecentRelations)
                ->latest('updated_at')
                ->take(100)
                ->get();
        } elseif ($user->isTwg()) {
            $base = Ppmp::whereDoesntHave('children')->where(function ($q) use ($user) {
                $q->where(function ($subQ) use ($user) {
                    $subQ->whereNull('twg_reviewer_id')
                         ->orWhere('twg_reviewer_id', $user->id)
                         ->orWhere('created_by', $user->id)
                         ->orWhereHas('signatures', function ($sq) use ($user) {
                             $sq->where('role', 'twg')->where('user_id', $user->id);
                         });
                })->orWhere('status', 'READY_TO_PRINT');
            });
            $byStatus = (clone $base)->selectRaw('status, count(*) as cnt')->groupBy('status')->pluck('cnt', 'status');
            $c = fn (string $s): int => (int) ($byStatus[$s] ?? 0);

            $myApproved = (clone $base)->where('status', '!=', 'READY_TO_PRINT')
                ->whereIn('status', [
                    'BUDGET_OFFICER_REVIEW', 'BUDGET_OFFICER_RETURNED',
                    'PACCO_REVIEW', 'PACCO_RETURNED',
                    'OPPMO_REVIEW', 'OPPMO_RETURNED'
                ])->count();
            $myReady = Ppmp::whereDoesntHave('children')
                ->where('status', 'READY_TO_PRINT')
                ->where(function ($q) use ($user) {
                    $q->where('twg_reviewer_id', $user->id)
                      ->orWhereHas('signatures', fn($sq) => $sq->where('role', 'twg')->where('user_id', $user->id));
                })->count();

            $metrics = [
                'pending_review' => $c('TWG_REVIEW'),
                'returned' => $c('TWG_RETURNED'),
                'approved' => $myApproved + $myReady,
                'ready_to_print' => $c('READY_TO_PRINT'),
            ];

            $twgRecent = clone $base;
            $recentPpmps = $twgRecent->whereIn('status', [
                'TWG_REVIEW', 'TWG_RETURNED',
                'BUDGET_OFFICER_REVIEW', 'BUDGET_OFFICER_RETURNED',
                'PACCO_REVIEW', 'PACCO_RETURNED',
                'OPPMO_REVIEW', 'OPPMO_RETURNED',
                'HEAD_PENDING', 'HEAD_RETURNED', 'READY_TO_PRINT'
            ])
                ->with($commonRecentRelations)
                ->latest('updated_at')
                ->take(100)
                ->get();
        } elseif ($user->isPacco()) {
            $base = Ppmp::whereDoesntHave('children')->where(function ($q) use ($user) {
                $q->where(function ($subQ) use ($user) {
                    $subQ->whereNull('budget_reviewer_id')
                         ->orWhere('budget_reviewer_id', $user->id)
                         ->orWhere('created_by', $user->id)
                         ->orWhereHas('signatures', function ($sq) use ($user) {
                             $sq->where('role', 'pacco')->where('user_id', $user->id);
                         });
                })->orWhere('status', 'READY_TO_PRINT');
            });
            $byStatus = (clone $base)->selectRaw('status, count(*) as cnt')->groupBy('status')->pluck('cnt', 'status');
            $c = fn (string $s): int => (int) ($byStatus[$s] ?? 0);

            $myApproved = $c('OPPMO_REVIEW') + $c('HEAD_PENDING') + $c('HEAD_RETURNED');
            $myReady = Ppmp::whereDoesntHave('children')
                ->where('status', 'READY_TO_PRINT')
                ->where(function ($q) use ($user) {
                    $q->where('budget_reviewer_id', $user->id)
                      ->orWhereHas('milestones', fn($mq) => $mq->whereNotNull('pacco_approved_at'))
                      ->orWhereHas('signatures', fn($sq) => $sq->where('role', 'pacco')->where('user_id', $user->id));
                })->count();

            $metrics = [
                'pending_review' => $c('PACCO_REVIEW'),
                'returned' => $c('PACCO_RETURNED'),
                'approved' => $myApproved + $myReady,
                'ready_to_print' => $c('READY_TO_PRINT'),
                'total_review' => (int) $byStatus->except(['DRAFT'])->sum(),
            ];

            $paccoRecent = clone $base;
            $recentPpmps = $paccoRecent->where(function ($q) {
                $q->whereIn('status', ['PACCO_REVIEW', 'PACCO_RETURNED'])
                    ->orWhereHas('milestones', fn($mq) => $mq->whereNotNull('pacco_approved_at'))
                    ->orWhere('source_of_fund', 'like', '%trust%')
                    ->orWhere('status', 'READY_TO_PRINT');
            })
                ->with($commonRecentRelations)
                ->latest('updated_at')
                ->take(100)
                ->get();
        } elseif ($user->isSuperAdmin()) {

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
            $endUserAnalytics = $this->buildEndUserAnalytics($recentPpmps, $metrics);
        } else {

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
            $endUserAnalytics = $this->buildEndUserAnalytics($recentPpmps, $metrics);
        }

        $recentRoutes = PpmpRoute::with([
            'ppmp' => fn ($q) => $q->without('milestones')->select([
                'id', 'uuid', 'tracking_number', 'ppmp_number', 'title', 'status', 'office_id', 'created_by',
            ]),
            'ppmp.amendment',
            'fromUser' => fn ($q) => $q->without('pnpkiSignature'),
            'toUser' => fn ($q) => $q->without('pnpkiSignature'),
        ])
            ->latest('id')
            ->take(8)
            ->get();

        $recentRoutes->each(function ($route) {
            if ($route->ppmp) {
                $route->ppmp->setAppends([]);
            }
        });

        $allDashboardPpmps = collect($recentPpmps)
            ->merge($pendingAmendments ?? [])
            ->merge($recentRoutes->pluck('ppmp')->filter());
        $returnedRecent = $allDashboardPpmps
            ->filter(fn ($p) => $p && str_ends_with($p->status ?? '', '_RETURNED'))
            ->unique('id')
            ->values();
        if ($returnedRecent->isNotEmpty()) {
            \Illuminate\Database\Eloquent\Collection::make($returnedRecent->all())->load([
                'reviews.reviewer' => fn ($q) => $q->without('pnpkiSignature'),
                'routes.fromUser' => fn ($q) => $q->without('pnpkiSignature'),
            ]);
        }

        $signatories = $user->isAdmin() ? PpmpSignatory::latest('id')->get() : [];
        $users = ($user->isSuperAdmin() || $user->isAdminRole()) ? User::with(['office', 'accountCodes', 'pnpkiSignature'])->latest('id')->get() : [];
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
            'end_user_analytics' => $endUserAnalytics ?? null,
            'signature_settings' => \App\Models\SystemSetting::getSignatureSettings(),
        ]);
    }

    private function buildEndUserAnalytics($ppmps, array $metrics): array
    {
        $collection = collect($ppmps);

        $isInfraPpmp = function ($ppmp): bool {
            $items = $ppmp->relationLoaded('items') ? $ppmp->items : collect();
            foreach ($items as $item) {
                if (stripos((string) ($item->project_type ?? ''), 'infra') !== false) {
                    return true;
                }
            }
            return stripos((string) ($ppmp->tracking_number ?? ''), 'INFRA') !== false;
        };

        $infraCollection = $collection->filter($isInfraPpmp)->values();
        $goodsCollection = $collection->reject($isInfraPpmp)->values();

        $overall = $this->summarizePpmpCollection($collection, $metrics);
        $overall['by_category'] = [
            'goods_consulting' => $this->summarizePpmpCollection($goodsCollection, null),
            'infrastructure' => $this->summarizePpmpCollection($infraCollection, null),
        ];

        $byYearMap = [];
        $groupedByYear = $collection->groupBy(fn ($p) => (string) ($p->fiscal_year ?: date('Y')));
        $availableYears = $groupedByYear->keys()->sortDesc()->values()->all();

        foreach ($availableYears as $yr) {
            $yrCollection = $groupedByYear->get($yr, collect())->values();
            $yrInfra = $yrCollection->filter($isInfraPpmp)->values();
            $yrGoods = $yrCollection->reject($isInfraPpmp)->values();

            $yrSummary = $this->summarizePpmpCollection($yrCollection, null);
            $yrSummary['by_category'] = [
                'goods_consulting' => $this->summarizePpmpCollection($yrGoods, null),
                'infrastructure' => $this->summarizePpmpCollection($yrInfra, null),
            ];
            $byYearMap[(string) $yr] = $yrSummary;
        }

        $overall['available_years'] = $availableYears;
        $overall['by_year_map'] = $byYearMap;

        return $overall;
    }

    private function summarizePpmpCollection($collection, ?array $metricsOverride = null): array
    {
        if ($collection->isEmpty()) {
            return [
                'ppmp_count' => 0,
                'gross_budget' => 0.0,
                'procured_budget' => 0.0,
                'retention_budget' => 0.0,
                'retention_ratio' => 0.0,
                'retention_count' => 0,
                'retention_items' => [],
                'status_breakdown' => [
                    ['key' => 'ready_to_print', 'label' => 'Ready to Print', 'count' => 0, 'color' => '#10b981'],
                    ['key' => 'in_review', 'label' => 'In Review', 'count' => 0, 'color' => '#6366f1'],
                    ['key' => 'draft', 'label' => 'Draft', 'count' => 0, 'color' => '#64748b'],
                    ['key' => 'returned', 'label' => 'Returned', 'count' => 0, 'color' => '#f43f5e'],
                ],
                'by_fiscal_year' => [],
                'by_fund_source' => [],
            ];
        }

        $grossBudget = 0.0;
        $retentionBudget = 0.0;
        $procuredBudget = 0.0;
        $retentionItems = [];
        $fyMap = [];
        $fundMap = [];
        $statusCounts = [
            'ready_to_print' => 0,
            'in_review' => 0,
            'draft' => 0,
            'returned' => 0,
        ];

        foreach ($collection as $ppmp) {
            $st = (string) ($ppmp->status ?? '');
            if ($st === 'READY_TO_PRINT') {
                $statusCounts['ready_to_print']++;
            } elseif (in_array($st, ['BUDGET_OFFICER_REVIEW', 'PACCO_REVIEW', 'OPPMO_REVIEW', 'TWG_REVIEW', 'HEAD_PENDING', 'BUDGET_HEAD_REVIEW', 'PACCO_HEAD_REVIEW', 'OPPMO_HEAD_REVIEW', 'APP_PREPARER_REVIEW', 'GOVERNOR_REVIEW'], true)) {
                $statusCounts['in_review']++;
            } elseif ($st === 'DRAFT') {
                $statusCounts['draft']++;
            } elseif (str_ends_with($st, '_RETURNED')) {
                $statusCounts['returned']++;
            }

            $items = $ppmp->relationLoaded('items') ? $ppmp->items : collect();
            $ppmpGross = 0.0;
            $ppmpRet = 0.0;
            $ppmpProcured = 0.0;
            $maxRetPct = null;
            $retRemarks = null;

            foreach ($items as $item) {
                $amt = (float) ($item->estimated_budget ?? 0);
                $isRet = (bool) ($item->is_retention ?? false);
                $ppmpGross += $amt;

                if ($isRet) {
                    $ppmpRet += $amt;
                    if ($item->retention_percentage !== null) {
                        $pct = (float) $item->retention_percentage;
                        $maxRetPct = $maxRetPct === null ? $pct : max($maxRetPct, $pct);
                    }
                    if (!empty($item->remarks) && $retRemarks === null) {
                        $retRemarks = $item->remarks;
                    }
                } else {
                    $ppmpProcured += $amt;
                }

                $fsName = trim((string) ($item->source_of_fund ?: $ppmp->source_of_fund ?: 'General Fund'));
                if ($fsName === '') {
                    $fsName = 'General Fund';
                }
                if (!isset($fundMap[$fsName])) {
                    $fundMap[$fsName] = ['source_of_fund' => $fsName, 'ppmp_ids' => [], 'gross_budget' => 0.0, 'retention_budget' => 0.0];
                }
                $fundMap[$fsName]['ppmp_ids'][$ppmp->id] = true;
                $fundMap[$fsName]['gross_budget'] += $amt;
                if ($isRet) {
                    $fundMap[$fsName]['retention_budget'] += $amt;
                }
            }

            if ($items->isEmpty() && (float) ($ppmp->total_budget ?? 0) > 0) {
                $ppmpGross = (float) $ppmp->total_budget;
                $ppmpProcured = $ppmpGross;
            }

            $grossBudget += $ppmpGross;
            $retentionBudget += $ppmpRet;
            $procuredBudget += $ppmpProcured;

            $fy = (string) ($ppmp->fiscal_year ?: date('Y'));
            if (!isset($fyMap[$fy])) {
                $fyMap[$fy] = ['fiscal_year' => $fy, 'count' => 0, 'gross_budget' => 0.0, 'procured_budget' => 0.0, 'retention_budget' => 0.0];
            }
            $fyMap[$fy]['count']++;
            $fyMap[$fy]['gross_budget'] += $ppmpGross;
            $fyMap[$fy]['procured_budget'] += $ppmpProcured;
            $fyMap[$fy]['retention_budget'] += $ppmpRet;

            if ($ppmpRet > 0) {
                $grossRounded = round($ppmpGross, 2);
                $retRounded = round($ppmpRet, 2);
                $retentionItems[] = [
                    'ppmp_id' => (int) $ppmp->id,
                    'ppmp_uuid' => $ppmp->uuid,
                    'tracking_number' => $ppmp->tracking_number ?: ("PPMP #" . $ppmp->ppmp_number),
                    'title' => $ppmp->title,
                    'fiscal_year' => $fy,
                    'status' => $ppmp->status,
                    'creator_name' => $ppmp->relationLoaded('creator') ? ($ppmp->creator?->name ?? 'End-User') : 'End-User',
                    'office_code' => $ppmp->relationLoaded('office') ? ($ppmp->office?->code ?? '') : '',
                    'office_name' => $ppmp->relationLoaded('office') ? ($ppmp->office?->name ?? $ppmp->implementing_unit ?? '') : ($ppmp->implementing_unit ?? ''),
                    'gross_budget' => $grossRounded,
                    'procured_budget' => max(0.0, round($grossRounded - $retRounded, 2)),
                    'retention_amount' => $retRounded,
                    'retention_percentage' => $maxRetPct !== null ? $maxRetPct : ($grossRounded > 0 ? round(($retRounded / $grossRounded) * 100, 1) : 0.0),
                    'remarks' => $retRemarks,
                ];
            }
        }

        usort($retentionItems, fn ($a, $b) => $b['retention_amount'] <=> $a['retention_amount']);
        $retentionItems = array_slice($retentionItems, 0, 25);

        krsort($fyMap);
        $byFiscalYear = array_values(array_map(fn ($r) => [
            'fiscal_year' => $r['fiscal_year'],
            'count' => $r['count'],
            'gross_budget' => round($r['gross_budget'], 2),
            'procured_budget' => round($r['procured_budget'], 2),
            'retention_budget' => round($r['retention_budget'], 2),
        ], array_slice($fyMap, 0, 6, true)));

        uasort($fundMap, fn ($a, $b) => $b['gross_budget'] <=> $a['gross_budget']);
        $byFundSource = array_values(array_map(fn ($r) => [
            'source_of_fund' => $r['source_of_fund'],
            'count' => count($r['ppmp_ids']),
            'gross_budget' => round($r['gross_budget'], 2),
            'retention_budget' => round($r['retention_budget'], 2),
        ], array_slice($fundMap, 0, 6, true)));

        $grossRounded = round($grossBudget, 2);
        $retRounded = round($retentionBudget, 2);
        $procuredRounded = round($procuredBudget, 2);
        $retentionRatio = $grossRounded > 0 ? round(($retRounded / $grossRounded) * 100, 1) : 0.0;

        $statusBreakdown = $metricsOverride !== null ? [
            ['key' => 'ready_to_print', 'label' => 'Ready to Print', 'count' => (int) ($metricsOverride['ready_to_print'] ?? 0), 'color' => '#10b981'],
            ['key' => 'in_review', 'label' => 'In Review', 'count' => (int) ($metricsOverride['in_review'] ?? 0), 'color' => '#6366f1'],
            ['key' => 'draft', 'label' => 'Draft', 'count' => (int) ($metricsOverride['draft'] ?? 0), 'color' => '#64748b'],
            ['key' => 'returned', 'label' => 'Returned', 'count' => (int) (($metricsOverride['returned_by_reviewer'] ?? 0) + ($metricsOverride['head_returned'] ?? 0)), 'color' => '#f43f5e'],
        ] : [
            ['key' => 'ready_to_print', 'label' => 'Ready to Print', 'count' => $statusCounts['ready_to_print'], 'color' => '#10b981'],
            ['key' => 'in_review', 'label' => 'In Review', 'count' => $statusCounts['in_review'], 'color' => '#6366f1'],
            ['key' => 'draft', 'label' => 'Draft', 'count' => $statusCounts['draft'], 'color' => '#64748b'],
            ['key' => 'returned', 'label' => 'Returned', 'count' => $statusCounts['returned'], 'color' => '#f43f5e'],
        ];

        return [
            'ppmp_count' => $collection->count(),
            'gross_budget' => $grossRounded,
            'procured_budget' => $procuredRounded,
            'retention_budget' => $retRounded,
            'retention_ratio' => $retentionRatio,
            'retention_count' => count($retentionItems),
            'retention_items' => $retentionItems,
            'status_breakdown' => $statusBreakdown,
            'by_fiscal_year' => $byFiscalYear,
            'by_fund_source' => $byFundSource,
        ];
    }

    private function buildAdminAnalytics(Builder $base, array $metrics): array
    {

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

        $overall = $this->computeAnalyticsForScope($base, null);

        $byFiscalYear = [];
        foreach ($fiscalYears as $fy) {
            $yearKey = (string) $fy['fiscal_year'];
            $byFiscalYear[$yearKey] = $this->computeAnalyticsForScope($base, $yearKey);
        }

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

    private function computeAnalyticsForScope(Builder $base, ?string $fiscalYear = null): array
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

        $statusDistribution = [
            ['status' => 'DRAFT', 'label' => 'Drafts', 'count' => $scopedMetrics['draft'], 'color' => '#64748b'],
            ['status' => 'HEAD_PENDING', 'label' => 'Pending Office Head', 'count' => $scopedMetrics['head_pending'], 'color' => '#f59e0b'],
            ['status' => 'IN_REVIEW', 'label' => 'Under Review (PBO/PACCO/OPPMO/TWG)', 'count' => $scopedMetrics['in_review'], 'color' => '#6366f1'],
            ['status' => 'READY_TO_PRINT', 'label' => 'Ready to Print / Approved', 'count' => $scopedMetrics['ready_to_print'], 'color' => '#10b981'],
            ['status' => 'PENDING_AMENDMENTS', 'label' => 'Pending Amendments', 'count' => $scopedMetrics['pending_amendments'], 'color' => '#a855f7'],
        ];

        $quarterlySchedule = [
            'Q1' => ['label' => 'Q1 (Jan - Mar)', 'amount' => $monthlySchedule[1]['amount'] + $monthlySchedule[2]['amount'] + $monthlySchedule[3]['amount'], 'count' => $monthlySchedule[1]['count'] + $monthlySchedule[2]['count'] + $monthlySchedule[3]['count']],
            'Q2' => ['label' => 'Q2 (Apr - Jun)', 'amount' => $monthlySchedule[4]['amount'] + $monthlySchedule[5]['amount'] + $monthlySchedule[6]['amount'], 'count' => $monthlySchedule[4]['count'] + $monthlySchedule[5]['count'] + $monthlySchedule[6]['count']],
            'Q3' => ['label' => 'Q3 (Jul - Sep)', 'amount' => $monthlySchedule[7]['amount'] + $monthlySchedule[8]['amount'] + $monthlySchedule[9]['amount'], 'count' => $monthlySchedule[7]['count'] + $monthlySchedule[8]['count'] + $monthlySchedule[9]['count']],
            'Q4' => ['label' => 'Q4 (Oct - Dec)', 'amount' => $monthlySchedule[10]['amount'] + $monthlySchedule[11]['amount'] + $monthlySchedule[12]['amount'], 'count' => $monthlySchedule[10]['count'] + $monthlySchedule[11]['count'] + $monthlySchedule[12]['count']],
        ];

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

        $workflowStages = [
            ['stage' => 'DRAFT', 'label' => 'End-User Drafting', 'count' => $c('DRAFT'), 'color' => '#64748b'],
            ['stage' => 'TWG_REVIEW', 'label' => 'Technical Working Group (TWG)', 'count' => $c('TWG_REVIEW'), 'color' => '#ec4899'],
            ['stage' => 'BUDGET_OFFICER_REVIEW', 'label' => 'Provincial Budget (PBO)', 'count' => $c('BUDGET_OFFICER_REVIEW'), 'color' => '#3b82f6'],
            ['stage' => 'PACCO_REVIEW', 'label' => 'Accounting Office (PACCO)', 'count' => $c('PACCO_REVIEW'), 'color' => '#06b6d4'],
            ['stage' => 'OPPMO_REVIEW', 'label' => 'Procurement Management (OPPMO)', 'count' => $c('OPPMO_REVIEW'), 'color' => '#8b5cf6'],
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
