<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountCode;
use App\Models\ProgramName;
use App\Models\FundSource;
use App\Models\AuditLog;
use App\Models\Office;
use App\Models\Ppmp;
use App\Models\PpmpItem;
use App\Models\PpmpRoute;
use App\Models\PpmpSignature;
use App\Support\ReviewHeadResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PpmpController extends Controller
{

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $query = Ppmp::with([
            'office.head' => fn ($q) => $q->without('pnpkiSignature'),
            'creator' => fn ($q) => $q->without('pnpkiSignature'),
            'items.fundSource',
            'fundSourceRef',
            'signatures',
            'attachments',
            'marketScoping',
            'monitoringProjects',
            'twgReviewer' => fn ($q) => $q->without('pnpkiSignature'),
            'budgetReviewer' => fn ($q) => $q->without('pnpkiSignature'),
            'oppmoReviewer' => fn ($q) => $q->without('pnpkiSignature'),
            'amendment',
        ])->whereDoesntHave('children');

        if ($user->isEndUser()) {

            $appStages = ReviewHeadResolver::userAppSignatoryStages($user);
            if (empty($appStages)) {
                $query->where('created_by', $user->id);
            } else {
                $appStatuses = ['READY_TO_PRINT'];
                if (in_array('app_preparer', $appStages, true)) {
                    array_push($appStatuses, 'APP_PREPARER_REVIEW', 'APP_PREPARER_RETURNED', 'GOVERNOR_REVIEW');
                }
                if (in_array('governor', $appStages, true)) {
                    array_push($appStatuses, 'GOVERNOR_REVIEW', 'GOVERNOR_RETURNED');
                }
                $appStatuses = array_values(array_unique($appStatuses));
                $query->where(function ($q) use ($user, $appStatuses) {
                    $q->where('created_by', $user->id)
                      ->orWhereIn('status', $appStatuses);
                });
            }
        } elseif ($user->isHead()) {

            $headStages = ReviewHeadResolver::userStagesForHead($user);
            $appStages = ReviewHeadResolver::userAppSignatoryStages($user);
            if (empty($headStages) && empty($appStages)) {
                $query->where('office_id', $user->office_id);
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
                $query->where(function ($q) use ($user, $stageStatuses) {
                    $q->where('office_id', $user->office_id)
                      ->orWhereIn('status', $stageStatuses);
                });
            }
        } elseif ($user->isBudgetOfficer()) {

            $query->where('status', '!=', 'DRAFT')
                ->where(function ($q) use ($user) {
                    $q->whereNull('budget_reviewer_id')
                      ->orWhere('budget_reviewer_id', $user->id)
                      ->orWhere('created_by', $user->id)
                      ->orWhere('status', 'READY_TO_PRINT');
                });
        } elseif ($user->isOppmo()) {

            $query->where(function ($q) use ($user) {
                $q->where(function ($subQ) {
                    $subQ->whereNotIn('status', ['DRAFT', 'BUDGET_OFFICER_REVIEW', 'BUDGET_OFFICER_RETURNED', 'PACCO_REVIEW', 'PACCO_RETURNED'])
                         ->orWhere('status', 'READY_TO_PRINT');
                })->where(function ($subQ) use ($user) {
                    $subQ->whereNull('oppmo_reviewer_id')
                         ->orWhere('oppmo_reviewer_id', $user->id)
                         ->orWhere('created_by', $user->id)
                         ->orWhere('status', 'READY_TO_PRINT');
                });
            });
        } elseif ($user->isTwg()) {

            $query->where(function ($q) use ($user) {
                $q->where(function ($subQ) {
                    $subQ->whereNotIn('status', ['DRAFT', 'BUDGET_OFFICER_REVIEW', 'BUDGET_OFFICER_RETURNED', 'PACCO_REVIEW', 'PACCO_RETURNED', 'OPPMO_REVIEW', 'OPPMO_RETURNED'])
                      ->orWhereHas('milestones', fn($mq) => $mq->whereNotNull('twg_approved_at'))
                      ->orWhereHas('signatures', function ($sq) {
                          $sq->where('role', 'twg');
                      })
                      ->orWhere('status', 'READY_TO_PRINT');
                })->where(function ($subQ) use ($user) {
                    $subQ->whereNull('twg_reviewer_id')
                      ->orWhere('twg_reviewer_id', $user->id)
                      ->orWhere('created_by', $user->id)
                      ->orWhere('status', 'READY_TO_PRINT');
                });
            });
        } elseif ($user->isPacco()) {

            $query->where('status', '!=', 'DRAFT')
                ->where(function ($q) use ($user) {
                    $q->whereNull('budget_reviewer_id')
                      ->orWhere('budget_reviewer_id', $user->id)
                      ->orWhere('created_by', $user->id)
                      ->orWhere('status', 'READY_TO_PRINT');
                });
        }

        if ($request->filled('search')) {
            $search = $request->input('search');
            $query->where(function ($q) use ($search) {
                $q->where('ppmp_number', 'like', "%{$search}%")
                    ->orWhere('tracking_number', 'like', "%{$search}%")
                    ->orWhere('title', 'like', "%{$search}%");
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->input('status'));
        }

        if ($request->filled('amendment_status')) {
            $query->whereHas('amendment', fn($aq) => $aq->where('amendment_status', $request->input('amendment_status')));
        }

        if ($request->filled('fiscal_year')) {
            $query->where('fiscal_year', $request->input('fiscal_year'));
        }

        if ($request->filled('office_id')) {
            $query->where('office_id', $request->input('office_id'));
        }

        if ($request->filled('project_category')) {
            $category = strtolower(trim((string) $request->input('project_category')));
            if (in_array($category, ['infrastructure', 'infra'], true)) {
                $query->where(function ($q) {
                    $q->where('tracking_number', 'like', '%INFRA-%')
                      ->orWhereHas('items', function ($iq) {
                          $iq->where('project_type', 'like', '%Infra%');
                      });
                });
            } elseif (in_array($category, ['goods_consulting', 'goods', 'consulting'], true)) {
                $query->where(function ($q) {
                    $q->where('tracking_number', 'not like', '%INFRA-%')
                      ->whereDoesntHave('items', function ($iq) {
                          $iq->where('project_type', 'like', '%Infra%');
                      });
                });
            }
        }

        $perPage = min((int) $request->input('per_page', 10), 100);
        $ppmps = $query->latest('id')->paginate($perPage);

        $returnedPpmps = $ppmps->getCollection()->filter(fn ($p) => str_ends_with($p->status ?? '', '_RETURNED'));
        if ($returnedPpmps->isNotEmpty()) {
            \Illuminate\Database\Eloquent\Collection::make($returnedPpmps->all())->load(['reviews.reviewer', 'routes.fromUser']);
        }

        $distinctYears = Ppmp::whereNotNull('fiscal_year')
            ->where('fiscal_year', '!=', '')
            ->distinct()
            ->orderByDesc('fiscal_year')
            ->pluck('fiscal_year')
            ->values();

        $response = $ppmps->toArray();
        $response['available_fiscal_years'] = $distinctYears;

        return response()->json($response);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->isEndUser() && !$user->isAdmin()) {
            return response()->json(['message' => 'Only End Users can initiate a new PPMP.'], 403);
        }

        $validated = $request->validate([
            'tracking_number' => 'nullable|string|max:100',
            'ppmp_number' => 'nullable|string|max:50',
            'title' => 'required|string|max:500',
            'source_of_fund' => 'nullable|string|max:255',
            'fund_source_id' => 'nullable|integer|exists:fund_sources,id',
            'account_code' => 'nullable|string',
            'account_code_id' => 'nullable|integer|exists:account_codes,id',
            'fiscal_year' => 'required|string|max:10',
            'plan_type' => 'required|in:INDICATIVE,FINAL',
            'office_id' => 'nullable|exists:offices,id',
            'implementing_unit' => 'nullable|string|max:255',
            'program_name' => 'nullable|string|max:500',
            'program_name_id' => 'nullable|integer|exists:program_names,id',
            'delivery_period' => 'nullable|string',
            'place_of_delivery' => 'nullable|string',
            'payment_method' => 'nullable|string',
            'additional_condition' => 'nullable|string|max:255',
            'warranty_and_other_terms' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.description' => 'required|string',
            'items.*.is_retention' => 'nullable|boolean',
            'items.*.retention_percentage' => 'nullable|numeric|min:0|max:100',
            'items.*.project_type' => 'nullable|string',
            'items.*.quantity_size' => 'nullable|string',
            'items.*.procurement_mode' => 'nullable|string',
            'items.*.pre_proc_conference' => 'nullable|boolean',
            'items.*.start_date' => 'nullable|string',
            'items.*.end_date' => 'nullable|string',
            'items.*.delivery_period' => 'nullable|string',
            'items.*.source_of_fund' => 'nullable|string',
            'items.*.fund_source_id' => 'nullable|integer|exists:fund_sources,id',
            'items.*.estimated_budget' => 'required|numeric|min:0',
            'items.*.supporting_docs_text' => 'nullable|string',
            'items.*.remarks' => 'nullable|string',
        ]);

        $officeId = $user->office_id ?? $validated['office_id'] ?? Office::first()->id;

        $ppmp = DB::transaction(function () use ($validated, $user, $officeId) {

            $office = Office::find($officeId);
            $rawOfficeCode = $office ? ($office->code ?? 'PPMO') : 'PPMO';

            $officeCode = strtoupper(preg_replace('/[^A-Za-z0-9\-]/', '', str_replace(' ', '', $rawOfficeCode)));
            if (empty($officeCode)) {
                $officeCode = 'PPMO';
            }

            $rawType = 'Goods';
            if (!empty($validated['items'])) {
                foreach ($validated['items'] as $item) {
                    if (!empty($item['project_type'])) {
                        $rawType = $item['project_type'];
                        break;
                    }
                }
            }

            $rawTypeLower = strtolower($rawType);
            if (str_contains($rawTypeLower, 'infra')) {
                $typeCode = 'INFRA';
            } elseif (str_contains($rawTypeLower, 'consult')) {
                $typeCode = 'CONSULTING';
            } else {
                $typeCode = 'GOODS';
            }

            $rawYear = trim($validated['fiscal_year']);
            $year = preg_match('/\b(20\d{2}|\d{4})\b/', $rawYear, $m) ? $m[1] : preg_replace('/^CY\s*/i', '', $rawYear);
            if (empty($year)) {
                $year = (string) date('Y');
            }

            $trackerPrefix = "{$officeCode}{$typeCode}-{$year}-";

            $existingTrackers = Ppmp::where('fiscal_year', $year)
                ->where('tracking_number', 'like', "{$trackerPrefix}%")
                ->lockForUpdate()
                ->pluck('tracking_number');

            $maxSeq = 0;
            $prefixRegex = '/^' . preg_quote($trackerPrefix, '/') . '(\d+)/';
            foreach ($existingTrackers as $tn) {
                if (preg_match($prefixRegex, $tn, $matches)) {
                    $num = (int) $matches[1];
                    if ($num > $maxSeq) {
                        $maxSeq = $num;
                    }
                }
            }

            $nextSeq = str_pad($maxSeq + 1, 6, '0', STR_PAD_LEFT);
            $autoTrackingNumber = "{$trackerPrefix}{$nextSeq}";

            $customTracker = isset($validated['tracking_number']) ? Ppmp::normalizeTrackingNumber($validated['tracking_number']) : '';
            if ($customTracker !== '') {
                if (Ppmp::isTrackingNumberTaken($customTracker)) {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'tracking_number' => ["Tracker No. \"{$customTracker}\" already exists. Duplicate tracker numbers are not allowed."],
                    ]);
                }
                $trackingNumber = $customTracker;
            } else {
                $trackingNumber = $autoTrackingNumber;
            }

            $ppmpNumber = isset($validated['ppmp_number']) && $validated['ppmp_number'] !== ''
                ? (string) $validated['ppmp_number']
                : (string) ($maxSeq + 1);

            $fundSourceId = $validated['fund_source_id'] ?? null;
            $sourceOfFund = $validated['source_of_fund'] ?? null;
            if ($fundSourceId) {
                $fs = FundSource::find($fundSourceId);
                if ($fs && empty($sourceOfFund)) {
                    $sourceOfFund = $fs->name;
                }
            } elseif (!empty($sourceOfFund)) {
                $fs = FundSource::where('name', trim($sourceOfFund))->first();
                if ($fs) {
                    $fundSourceId = $fs->id;
                }
            }
            if (empty($sourceOfFund)) {
                $sourceOfFund = 'General Fund';
            }

            $programNameId = $validated['program_name_id'] ?? null;
            $programNameStr = $validated['program_name'] ?? null;
            if ($programNameId) {
                $prog = ProgramName::find($programNameId);
                if ($prog && empty($programNameStr)) {
                    $programNameStr = $prog->name;
                }
            } elseif (!empty($programNameStr)) {
                $prog = ProgramName::where('name', trim($programNameStr))->first();
                if ($prog) {
                    $programNameId = $prog->id;
                }
            }

            $accountCodeId = $validated['account_code_id'] ?? null;
            $accountCodeStr = $validated['account_code'] ?? null;
            if ($accountCodeId) {
                $ac = AccountCode::find($accountCodeId);
                if ($ac && empty($accountCodeStr)) {
                    $accountCodeStr = $ac->code ? "{$ac->name}\n{$ac->code}" : $ac->name;
                }
            } elseif (!empty($accountCodeStr)) {
                if (preg_match('/[0-9]-[0-9]{2}-[0-9]{2}-[0-9]{3}/', $accountCodeStr, $m)) {
                    $ac = AccountCode::where('code', $m[0])->first();
                    if ($ac) {
                        $accountCodeId = $ac->id;
                    }
                }
            }

            $ppmp = Ppmp::create([
                'uuid' => (string) Str::uuid(),
                'tracking_number' => $trackingNumber,
                'ppmp_number' => $ppmpNumber,
                'office_id' => $officeId,
                'implementing_unit' => $validated['implementing_unit'] ?? null,
                'program_name' => $programNameStr,
                'program_name_id' => $programNameId,
                'created_by' => $user->id,
                'title' => $validated['title'],
                'source_of_fund' => $sourceOfFund,
                'fund_source_id' => $fundSourceId,
                'account_code' => $accountCodeStr,
                'account_code_id' => $accountCodeId,
                'fiscal_year' => $year,
                'plan_type' => $validated['plan_type'],
                'is_annual' => true,
                'delivery_period' => ($validated['additional_condition'] ?? null) === 'POL Condition' ? null : ($validated['delivery_period'] ?? null),
                'place_of_delivery' => ($validated['additional_condition'] ?? null) === 'POL Condition' ? null : ($validated['place_of_delivery'] ?? null),
                'payment_method' => ($validated['additional_condition'] ?? null) === 'POL Condition' ? null : ($validated['payment_method'] ?? null),
                'additional_condition' => $validated['additional_condition'] ?? null,
                'warranty_and_other_terms' => $validated['warranty_and_other_terms'] ?? null,
                'total_budget' => 0.00,
                'status' => 'DRAFT',
                'prepared_at' => now(),
            ]);

            $total = 0;
            foreach ($validated['items'] as $index => $itemData) {
                $itemBudget = (float) $itemData['estimated_budget'];
                $total += $itemBudget;

                $itemFundSourceId = $itemData['fund_source_id'] ?? null;
                $itemSourceOfFund = $itemData['source_of_fund'] ?? null;
                if ($itemFundSourceId) {
                    $itemFs = FundSource::find($itemFundSourceId);
                    if ($itemFs && empty($itemSourceOfFund)) {
                        $itemSourceOfFund = $itemFs->name;
                    }
                } elseif (!empty($itemSourceOfFund)) {
                    $itemFs = FundSource::where('name', trim($itemSourceOfFund))->first();
                    if ($itemFs) {
                        $itemFundSourceId = $itemFs->id;
                    }
                }
                if (empty($itemSourceOfFund)) {
                    $itemSourceOfFund = $sourceOfFund;
                    $itemFundSourceId = $fundSourceId;
                }

                PpmpItem::create([
                    'ppmp_id' => $ppmp->id,
                    'item_no' => $index + 1,
                    'description' => $itemData['description'],
                    'is_retention' => (bool) ($itemData['is_retention'] ?? false),
                    'retention_percentage' => isset($itemData['retention_percentage']) && $itemData['retention_percentage'] !== '' ? (float) $itemData['retention_percentage'] : null,
                    'project_type' => $itemData['project_type'] ?? 'Goods',
                    'quantity_size' => $itemData['quantity_size'] ?? '',
                    'procurement_mode' => $itemData['procurement_mode'] ?? 'Public Bidding',
                    'pre_proc_conference' => $itemBudget >= 5000000 ? true : (bool) ($itemData['pre_proc_conference'] ?? false),
                    'start_date' => $itemData['start_date'] ?? null,
                    'end_date' => $itemData['end_date'] ?? null,
                    'delivery_period' => $itemData['delivery_period'] ?? null,
                    'source_of_fund' => $itemSourceOfFund,
                    'fund_source_id' => $itemFundSourceId,
                    'estimated_budget' => $itemBudget,
                    'supporting_docs_text' => $itemData['supporting_docs_text'] ?? null,
                    'remarks' => $itemData['remarks'] ?? null,
                ]);
            }

            $ppmp->update(['total_budget' => $total]);

            PpmpSignature::create([
                'ppmp_id' => $ppmp->id,
                'user_id' => $user->id,
                'role' => 'end_user',
                'signature_type' => 'full_esignature',
                'signature_indicator' => 'ESIG-PREPARED-' . strtoupper(substr(md5($user->id . $ppmp->id . now()), 0, 8)),
                'signer_name' => $user->name,
                'signer_designation' => $user->designation ?? 'Implementing Unit Staff',
                'signed_at' => now(),
            ]);

            $office = $user->office_id ? \App\Models\Office::find($user->office_id) : null;
            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $user->id,
                'to_user_id' => $office?->getEffectiveHeadUser()?->id,
                'from_role' => 'end_user',
                'to_role' => 'head',
                'action' => 'DRAFT_CREATED',
                'status' => 'DRAFT',
                'remarks' => 'PPMP Draft created and initialized.',
                'submitted_at' => now(),
                'received_at' => now(),
                'acted_at' => now(),
            ]);

            AuditLog::log('PPMP_CREATED', 'ppmps', $ppmp->id, null, ['number' => $ppmp->ppmp_number, 'total' => $total], $user->id);

            return $ppmp;
        });

        return response()->json([
            'message' => 'PPMP created successfully in DRAFT status.',
            'ppmp' => $ppmp->load(['office.head', 'creator.office.head', 'items', 'signatures.user', 'attachments', 'routes', 'monitoringProjects']),
        ], 201);
    }

    public function show(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();

        $ppmp = Ppmp::with([
            'office.head',
            'creator.office.head',
            'items.fundSource',
            'fundSourceRef',
            'attachments.uploader',
            'marketScoping.activities',
            'marketScoping.results',
            'reviews.reviewer',
            'signatures.user',
            'routes.fromUser',
            'routes.toUser',
            'changeLogs.user',
            'monitoringProjects',
            'cellComments.reviewer',
            'cellComments.compliedByUser',
            'accountCodeRef',
            'programNameRef',
            'twgReviewer',
            'budgetReviewer',
            'oppmoReviewer',
            'parent.items',
            'parent.signatures.user',
            'parent.office.head',
            'parent.marketScoping.activities',
            'parent.marketScoping.results',
            'children.items',
        ])->where(function ($q) use ($uuid) {
            $q->where('uuid', $uuid);
            if (ctype_digit($uuid)) {
                $q->orWhere('id', (int) $uuid);
            }
        })->first();

        if (!$ppmp) {
            return response()->json([
                'message' => 'This PPMP record no longer exists or may have been deleted.',
            ], 404);
        }

        if (!$user->isAdmin()) {
            if ($user->isEndUser() && $ppmp->created_by !== $user->id && $ppmp->office_id !== $user->office_id) {
                $appStages = ReviewHeadResolver::userAppSignatoryStages($user);
                $allowedAppView = (
                    (in_array('app_preparer', $appStages, true) && in_array($ppmp->status, ['APP_PREPARER_REVIEW', 'APP_PREPARER_RETURNED', 'GOVERNOR_REVIEW', 'READY_TO_PRINT'], true)) ||
                    (in_array('governor', $appStages, true) && in_array($ppmp->status, ['GOVERNOR_REVIEW', 'GOVERNOR_RETURNED', 'READY_TO_PRINT'], true))
                );
                if (!$allowedAppView) {
                    return response()->json(['message' => 'Unauthorized. You do not have permission to view this PPMP.'], 403);
                }
            }
            if ($user->isHead() && $ppmp->office_id !== $user->office_id) {
                $headStages = ReviewHeadResolver::userStagesForHead($user);
                $appStages = ReviewHeadResolver::userAppSignatoryStages($user);
                $allowedHeadView = false;
                if (in_array('budget', $headStages, true) && ($ppmp->budget_head_approved_at || in_array($ppmp->status, ['BUDGET_HEAD_REVIEW', 'BUDGET_HEAD_RETURNED', 'OPPMO_REVIEW', 'OPPMO_HEAD_REVIEW', 'APP_PREPARER_REVIEW', 'GOVERNOR_REVIEW', 'READY_TO_PRINT'], true))) {
                    $allowedHeadView = true;
                }
                if (in_array('pacco', $headStages, true) && ($ppmp->pacco_head_approved_at || in_array($ppmp->status, ['PACCO_HEAD_REVIEW', 'PACCO_HEAD_RETURNED', 'OPPMO_REVIEW', 'OPPMO_HEAD_REVIEW', 'APP_PREPARER_REVIEW', 'GOVERNOR_REVIEW', 'READY_TO_PRINT'], true))) {
                    $allowedHeadView = true;
                }
                if (in_array('oppmo', $headStages, true) && ($ppmp->oppmo_head_approved_at || in_array($ppmp->status, ['OPPMO_HEAD_REVIEW', 'OPPMO_HEAD_RETURNED', 'APP_PREPARER_REVIEW', 'GOVERNOR_REVIEW', 'READY_TO_PRINT'], true))) {
                    $allowedHeadView = true;
                }
                if (in_array('app_preparer', $appStages, true) && in_array($ppmp->status, ['APP_PREPARER_REVIEW', 'APP_PREPARER_RETURNED', 'GOVERNOR_REVIEW', 'READY_TO_PRINT'], true)) {
                    $allowedHeadView = true;
                }
                if (in_array('governor', $appStages, true) && in_array($ppmp->status, ['GOVERNOR_REVIEW', 'GOVERNOR_RETURNED', 'READY_TO_PRINT'], true)) {
                    $allowedHeadView = true;
                }
                if (!$allowedHeadView) {
                    return response()->json(['message' => 'Unauthorized. You may only view PPMPs from your assigned office.'], 403);
                }
            }
            if ($user->isBudgetOfficer()) {
                if ($ppmp->status === 'DRAFT') {
                    return response()->json(['message' => 'PPMP is not yet submitted for Budget review.'], 403);
                }
                if ($ppmp->status !== 'READY_TO_PRINT' && $ppmp->budget_reviewer_id && $ppmp->budget_reviewer_id !== $user->id && $ppmp->created_by !== $user->id) {
                    return response()->json(['message' => 'Unauthorized. This PPMP is assigned to a different Budget Officer.'], 403);
                }
            }
            if ($user->isOppmo()) {
                if ($ppmp->status !== 'READY_TO_PRINT' && in_array($ppmp->status, ['DRAFT', 'BUDGET_OFFICER_REVIEW', 'BUDGET_OFFICER_RETURNED', 'PACCO_REVIEW', 'PACCO_RETURNED'])) {
                    return response()->json(['message' => 'PPMP is not yet submitted for OPPMO review.'], 403);
                }
                if ($ppmp->status !== 'READY_TO_PRINT' && $ppmp->oppmo_reviewer_id && $ppmp->oppmo_reviewer_id !== $user->id && $ppmp->created_by !== $user->id) {
                    return response()->json(['message' => 'Unauthorized. This PPMP is assigned to a different OPPMO reviewer.'], 403);
                }
            }
            if ($user->isTwg()) {
                $hasTwgReviewed = $ppmp->twg_approved_at !== null || $ppmp->signatures()->where('role', 'twg')->exists();
                if (!$hasTwgReviewed && $ppmp->status !== 'READY_TO_PRINT' && in_array($ppmp->status, ['DRAFT', 'BUDGET_OFFICER_REVIEW', 'BUDGET_OFFICER_RETURNED', 'PACCO_REVIEW', 'PACCO_RETURNED', 'OPPMO_REVIEW', 'OPPMO_RETURNED'])) {
                    return response()->json(['message' => 'PPMP is not yet submitted for BAC-TWG review.'], 403);
                }
                if ($ppmp->status !== 'READY_TO_PRINT' && $ppmp->twg_reviewer_id && $ppmp->twg_reviewer_id !== $user->id && $ppmp->created_by !== $user->id) {
                    return response()->json(['message' => 'Unauthorized. This PPMP is assigned to a different BAC-TWG reviewer.'], 403);
                }
            }
            if ($user->isPacco()) {
                if ($ppmp->status === 'DRAFT') {
                    return response()->json(['message' => 'PPMP is not yet submitted for review.'], 403);
                }
                if ($ppmp->status !== 'READY_TO_PRINT' && $ppmp->budget_reviewer_id && $ppmp->budget_reviewer_id !== $user->id && $ppmp->created_by !== $user->id) {
                    return response()->json(['message' => 'Unauthorized. This PPMP is assigned to a different PACCO reviewer.'], 403);
                }
            }
        }

        $history = [];
        $currentParent = $ppmp->parent;
        $visitedIds = [$ppmp->id];
        $maxDepth = 25;
        $depth = 0;

        while ($currentParent && $depth < $maxDepth) {
            if (in_array($currentParent->id, $visitedIds, true)) {
                break;
            }
            $visitedIds[] = $currentParent->id;
            $depth++;

            $currentParent->loadMissing([
                'items.attachmentList',
                'attachmentLists',
                'marketScoping.activities',
                'marketScoping.results',
                'signatures.user',
                'office.head',
                'accountCodeRef',
                'programNameRef',
                'creator',
                'attachments.uploader',
                'routes.fromUser',
                'routes.toUser',
                'reviews.reviewer',
                'changeLogs.user',
                'monitoringProjects',
            ]);
            $history[] = $currentParent;
            $currentParent = $currentParent->parent;
        }
        $ppmp->setRelation('history', collect($history));

        $isSuspended = str_ends_with($ppmp->status, '_RETURNED');
        $isReviewerOrAdmin = in_array($user?->role, ['head', 'authorized_staff', 'budget_officer', 'pacco', 'oppmo', 'twg', 'admin', 'super_admin']) || ($user && $user->isAdmin());
        if (!$isReviewerOrAdmin && !$isSuspended) {

            $ppmp->setRelation('cellComments', $ppmp->cellComments->where('status', 'complied')->values());
        }

        $activeSignatories = \App\Models\PpmpSignatory::getActiveSignatories();
        $activeBudget = $activeSignatories->firstWhere('signatory_type', 'budget_requirement');
        $activeBac = $activeSignatories->firstWhere('signatory_type', 'bac_secretariat');
        $activeGovernor = $activeSignatories->firstWhere('signatory_type', 'approved_by');

        return response()->json([
            'ppmp' => $ppmp,
            'history' => $history,
            'default_signatories' => [
                'budget_requirement' => $activeBudget ? [
                    'name' => $activeBudget->name,
                    'position' => $activeBudget->position,
                ] : null,
                'bac_secretariat' => $activeBac ? [
                    'name' => $activeBac->name,
                    'position' => $activeBac->position,
                ] : null,
                'approved_by' => $activeGovernor ? [
                    'name' => $activeGovernor->name,
                    'position' => $activeGovernor->position,
                ] : null,
            ],
            'signature_settings' => \App\Models\SystemSetting::getSignatureSettings(),
        ]);
    }

    public function update(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        $isCreatorEditable = ($ppmp->created_by === $user->id) && in_array($ppmp->status, [
            'DRAFT',
            'HEAD_PENDING',
            'HEAD_APPROVED',
            'HEAD_RETURNED',
            'BUDGET_OFFICER_RETURNED',
            'BUDGET_HEAD_RETURNED',
            'PACCO_RETURNED',
            'PACCO_HEAD_RETURNED',
            'OPPMO_RETURNED',
            'OPPMO_HEAD_RETURNED',
            'TWG_RETURNED'
        ]);

        $headStage = ReviewHeadResolver::stageForStatus($ppmp->status);
        $isReviewOfficeHead = $user->isHead() && $headStage && (int) $user->office_id === ReviewHeadResolver::resolveOfficeIdForStage($headStage, $ppmp);

        $isReviewerEditable = (
            ($user->isHead() && in_array($ppmp->status, ['HEAD_PENDING', 'HEAD_APPROVED']) && $user->office_id === $ppmp->office_id) ||
            $isReviewOfficeHead ||
            ($user->isBudgetOfficer() && $ppmp->status === 'BUDGET_OFFICER_REVIEW' && (!$ppmp->budget_reviewer_id || $ppmp->budget_reviewer_id === $user->id)) ||
            ($user->isPacco() && $ppmp->status === 'PACCO_REVIEW' && (!$ppmp->budget_reviewer_id || $ppmp->budget_reviewer_id === $user->id)) ||
            ($user->isOppmo() && $ppmp->status === 'OPPMO_REVIEW' && (!$ppmp->oppmo_reviewer_id || $ppmp->oppmo_reviewer_id === $user->id)) ||
            ($user->isTwg() && $ppmp->status === 'TWG_REVIEW' && (!$ppmp->twg_reviewer_id || $ppmp->twg_reviewer_id === $user->id))
        );

        if (!$isCreatorEditable && !$isReviewerEditable && !$user->isAdmin()) {
            return response()->json([
                'message' => "PPMP cannot be modified by you in its current status: {$ppmp->status}."
            ], 403);
        }

        if ($ppmp->amendment_scope === 'ATTACHMENT_LIST' && !$user->isAdmin()) {
            return response()->json([
                'message' => "PPMP items and plan details cannot be modified for this revision. The approved request scope is restricted to the Detailed Specifications only."
            ], 403);
        }

        $validated = $request->validate([
            'tracking_number' => 'nullable|string|max:100',
            'ppmp_number' => 'nullable|string|max:50',
            'title' => 'required|string|max:500',
            'source_of_fund' => 'nullable|string|max:255',
            'fund_source_id' => 'nullable|integer|exists:fund_sources,id',
            'account_code' => 'nullable|string',
            'account_code_id' => 'nullable|integer|exists:account_codes,id',
            'fiscal_year' => 'required|string|max:10',
            'plan_type' => 'required|in:INDICATIVE,FINAL',
            'implementing_unit' => 'nullable|string|max:255',
            'program_name' => 'nullable|string|max:500',
            'program_name_id' => 'nullable|integer|exists:program_names,id',
            'delivery_period' => 'nullable|string',
            'place_of_delivery' => 'nullable|string',
            'payment_method' => 'nullable|string',
            'additional_condition' => 'nullable|string|max:255',
            'warranty_and_other_terms' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.id' => 'nullable|integer',
            'items.*.description' => 'required|string',
            'items.*.is_retention' => 'nullable|boolean',
            'items.*.retention_percentage' => 'nullable|numeric|min:0|max:100',
            'items.*.project_type' => 'nullable|string',
            'items.*.quantity_size' => 'nullable|string',
            'items.*.procurement_mode' => 'nullable|string',
            'items.*.pre_proc_conference' => 'nullable|boolean',
            'items.*.start_date' => 'nullable|string',
            'items.*.end_date' => 'nullable|string',
            'items.*.delivery_period' => 'nullable|string',
            'items.*.source_of_fund' => 'nullable|string',
            'items.*.fund_source_id' => 'nullable|integer|exists:fund_sources,id',
            'items.*.estimated_budget' => 'required|numeric|min:0',
            'items.*.supporting_docs_text' => 'nullable|string',
            'items.*.remarks' => 'nullable|string',
        ]);

        DB::transaction(function () use ($ppmp, $validated, $user) {
            $oldValues = $ppmp->toArray();

            $fundSourceId = array_key_exists('fund_source_id', $validated) ? $validated['fund_source_id'] : $ppmp->fund_source_id;
            $sourceOfFund = $validated['source_of_fund'] ?? $ppmp->source_of_fund;
            if (!empty($validated['fund_source_id'])) {
                $fs = FundSource::find($validated['fund_source_id']);
                if ($fs && (empty($sourceOfFund) || !array_key_exists('source_of_fund', $validated))) {
                    $sourceOfFund = $fs->name;
                }
            } elseif (array_key_exists('source_of_fund', $validated) && !empty($validated['source_of_fund'])) {
                $fs = FundSource::where('name', trim($validated['source_of_fund']))->first();
                if ($fs) {
                    $fundSourceId = $fs->id;
                }
            }
            if (empty($sourceOfFund)) {
                $sourceOfFund = 'General Fund';
            }

            $isPol = array_key_exists('additional_condition', $validated)
                ? ($validated['additional_condition'] === 'POL Condition')
                : ($ppmp->additional_condition === 'POL Condition');

            $rawYear = trim($validated['fiscal_year']);
            $cleanFiscalYear = preg_match('/\b(20\d{2}|\d{4})\b/', $rawYear, $m) ? $m[1] : preg_replace('/^CY\s*/i', '', $rawYear);
            if (empty($cleanFiscalYear)) {
                $cleanFiscalYear = $ppmp->fiscal_year ?: (string) date('Y');
            }

            $oldTrackingNumber = $ppmp->tracking_number;
            $familyIds = $ppmp->getFamilyIds();
            $requestedTracker = array_key_exists('tracking_number', $validated) && $validated['tracking_number'] !== null
                ? Ppmp::normalizeTrackingNumber((string) $validated['tracking_number'])
                : '';

            if ($requestedTracker !== '' && strcasecmp($requestedTracker, (string) $oldTrackingNumber) !== 0) {
                if (Ppmp::isTrackingNumberTaken($requestedTracker, $familyIds)) {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'tracking_number' => ["Tracker No. \"{$requestedTracker}\" already exists. Duplicate tracker numbers are not allowed."],
                    ]);
                }
                $trackingNumber = $requestedTracker;
            } else {
                $trackingNumber = $requestedTracker !== '' ? $requestedTracker : $oldTrackingNumber;
                if ($cleanFiscalYear !== $ppmp->fiscal_year || !str_contains((string)$trackingNumber, "-{$cleanFiscalYear}-")) {
                    if ($trackingNumber && preg_match('/^([A-Z0-9\-]+)-(\d{4})-(\d+)$/', $trackingNumber, $tnMatches)) {
                        $prefixBase = $tnMatches[1];
                        $seqPart = $tnMatches[3];
                        $candidateTrk = "{$prefixBase}-{$cleanFiscalYear}-{$seqPart}";
                        $alreadyTaken = Ppmp::isTrackingNumberTaken($candidateTrk, $familyIds);
                        if (!$alreadyTaken) {
                            $trackingNumber = $candidateTrk;
                        } else {
                            $trackerPrefix = "{$prefixBase}-{$cleanFiscalYear}-";
                            $existingTrackers = Ppmp::where('fiscal_year', $cleanFiscalYear)
                                ->where('tracking_number', 'like', "{$trackerPrefix}%")
                                ->whereNotIn('id', $familyIds)
                                ->lockForUpdate()
                                ->pluck('tracking_number');
                            $maxSeq = 0;
                            $prefixRegex = '/^' . preg_quote($trackerPrefix, '/') . '(\d+)/';
                            foreach ($existingTrackers as $tn) {
                                if (preg_match($prefixRegex, $tn, $m)) {
                                    $num = (int) $m[1];
                                    if ($num > $maxSeq) $maxSeq = $num;
                                }
                            }
                            $trackingNumber = "{$trackerPrefix}" . str_pad($maxSeq + 1, 6, '0', STR_PAD_LEFT);
                        }
                    } elseif ($cleanFiscalYear) {
                        $candidateTrk = preg_replace('/-(\d{4})-/', "-{$cleanFiscalYear}-", (string)$trackingNumber);
                        if (!Ppmp::isTrackingNumberTaken($candidateTrk, $familyIds)) {
                            $trackingNumber = $candidateTrk;
                        }
                    }
                }
            }

            if ($trackingNumber !== $oldTrackingNumber || $cleanFiscalYear !== $ppmp->fiscal_year) {
                $otherFamilyIds = array_values(array_diff($familyIds, [$ppmp->id]));
                if (!empty($otherFamilyIds)) {
                    Ppmp::whereIn('id', $otherFamilyIds)->update([
                        'tracking_number' => $trackingNumber,
                        'fiscal_year' => $cleanFiscalYear,
                    ]);
                }
            }
            if ($trackingNumber !== $oldTrackingNumber) {
                \App\Models\MonitoringProject::whereIn('ppmp_id', $familyIds)->update([
                    'pr_number' => $trackingNumber,
                ]);
                \App\Models\PurchaseRequest::whereIn('ppmp_id', $familyIds)->update([
                    'tracker_id' => $trackingNumber,
                ]);
                \App\Models\MonitoringProject::flushCache();
            }

            if (array_key_exists('program_name', $validated) || array_key_exists('program_name_id', $validated)) {
                $rawProgStr = array_key_exists('program_name', $validated) && $validated['program_name'] !== null
                    ? trim((string)$validated['program_name'])
                    : null;
                $rawProgId = array_key_exists('program_name_id', $validated) && !empty($validated['program_name_id'])
                    ? (int)$validated['program_name_id']
                    : null;

                if (!empty($rawProgId)) {
                    $prog = ProgramName::find($rawProgId);
                    $programNameId = $rawProgId;
                    $programNameStr = !empty($rawProgStr) ? $rawProgStr : ($prog?->name ?: null);
                } elseif (!empty($rawProgStr)) {
                    $prog = ProgramName::where('name', $rawProgStr)->first();
                    $programNameId = $prog?->id;
                    $programNameStr = $rawProgStr;
                } else {

                    $programNameId = null;
                    $programNameStr = null;
                }
            } else {
                $programNameId = $ppmp->program_name_id;
                $programNameStr = $ppmp->program_name;
            }

            if (array_key_exists('account_code', $validated) || array_key_exists('account_code_id', $validated)) {
                $rawCodeStr = array_key_exists('account_code', $validated) && $validated['account_code'] !== null
                    ? trim((string)$validated['account_code'])
                    : null;
                $rawCodeId = array_key_exists('account_code_id', $validated) && !empty($validated['account_code_id'])
                    ? (int)$validated['account_code_id']
                    : null;

                if (!empty($rawCodeId)) {
                    $ac = AccountCode::find($rawCodeId);
                    $accountCodeId = $rawCodeId;
                    $accountCodeStr = !empty($rawCodeStr) ? $rawCodeStr : ($ac ? ($ac->code ? "{$ac->name}\n{$ac->code}" : $ac->name) : null);
                } elseif (!empty($rawCodeStr)) {
                    $accountCodeStr = $rawCodeStr;
                    $accountCodeId = null;
                    if (preg_match('/[0-9]-[0-9]{2}-[0-9]{2}-[0-9]{3}/', $rawCodeStr, $m)) {
                        $ac = AccountCode::where('code', $m[0])->first();
                        if ($ac) {
                            $accountCodeId = $ac->id;
                        }
                    }
                } else {

                    $accountCodeId = null;
                    $accountCodeStr = null;
                }
            } else {
                $accountCodeId = $ppmp->account_code_id;
                $accountCodeStr = $ppmp->account_code;
            }

            $ppmp->update([
                'tracking_number' => $trackingNumber,
                'ppmp_number' => isset($validated['ppmp_number']) && $validated['ppmp_number'] !== '' ? $validated['ppmp_number'] : $ppmp->ppmp_number,
                'implementing_unit' => array_key_exists('implementing_unit', $validated) ? $validated['implementing_unit'] : $ppmp->implementing_unit,
                'program_name' => $programNameStr,
                'program_name_id' => $programNameId,
                'title' => $validated['title'],
                'source_of_fund' => $sourceOfFund,
                'fund_source_id' => $fundSourceId,
                'account_code' => $accountCodeStr,
                'account_code_id' => $accountCodeId,
                'fiscal_year' => $cleanFiscalYear,
                'plan_type' => $validated['plan_type'],
                'delivery_period' => $isPol ? null : ($validated['delivery_period'] ?? $ppmp->delivery_period),
                'place_of_delivery' => $isPol ? null : ($validated['place_of_delivery'] ?? $ppmp->place_of_delivery),
                'payment_method' => $isPol ? null : ($validated['payment_method'] ?? $ppmp->payment_method),
                'additional_condition' => array_key_exists('additional_condition', $validated) ? $validated['additional_condition'] : $ppmp->additional_condition,
                'warranty_and_other_terms' => array_key_exists('warranty_and_other_terms', $validated) ? $validated['warranty_and_other_terms'] : $ppmp->warranty_and_other_terms,
            ]);

            $oldItems = $ppmp->items()->get();
            $oldItemsMap = $oldItems->keyBy('item_no');
            $changeLogsToCreate = [];

            $headerFields = [
                'tracking_number' => 'Tracker Number',
                'title' => 'Project Title',
                'program_name' => 'Program Name',
                'account_code' => 'Account Code',
                'implementing_unit' => 'Implementing Office / Unit',
                'fiscal_year' => 'Fiscal Year',
                'ppmp_number' => 'PPMP Number',
                'plan_type' => 'Plan Type',
                'delivery_period' => 'Delivery Period',
                'place_of_delivery' => 'Place of Delivery',
                'payment_method' => 'Payment Method',
                'source_of_fund' => 'Source of Fund',
                'additional_condition' => 'Additional Condition',
                'warranty_and_other_terms' => 'Warranty and Other Terms',
            ];
            foreach ($headerFields as $field => $label) {
                $oldVal = trim((string) ($oldValues[$field] ?? ''));
                $newVal = trim((string) ($field === 'tracking_number' ? $trackingNumber : ($validated[$field] ?? ($field === 'source_of_fund' ? $sourceOfFund : ($field === 'fiscal_year' ? $cleanFiscalYear : '')))));
                if ($oldVal !== $newVal && ($oldVal !== '' || $newVal !== '')) {
                    $changeLogsToCreate[] = [
                        'ppmp_id' => $ppmp->id,
                        'user_id' => $user->id,
                        'role' => $user->role,
                        'field_name' => $label,
                        'old_value' => $oldVal ?: '(empty)',
                        'new_value' => $newVal ?: '(empty)',
                        'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                    ];
                }
            }

            $oldProgCombined = trim(($oldValues['program_name'] ?? '') . ' • ' . ($oldValues['account_code'] ?? ''));
            $newProgCombined = trim(($programNameStr ?? '') . ' • ' . ($accountCodeStr ?? ''));
            if ($oldProgCombined !== $newProgCombined && $oldProgCombined !== '•' && $newProgCombined !== '•') {
                $changeLogsToCreate[] = [
                    'ppmp_id' => $ppmp->id,
                    'user_id' => $user->id,
                    'role' => $user->role,
                    'field_name' => 'Category / Program Name & Account Code',
                    'old_value' => $oldProgCombined ?: '(empty)',
                    'new_value' => $newProgCombined ?: '(empty)',
                    'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                ];
            }

            $ppmp->items()->delete();

            $total = 0;
            foreach ($validated['items'] as $index => $itemData) {
                $itemNo = $index + 1;
                $itemBudget = (float) $itemData['estimated_budget'];
                $total += $itemBudget;

                $itemFundSourceId = $itemData['fund_source_id'] ?? null;
                $itemSourceOfFund = $itemData['source_of_fund'] ?? null;
                if ($itemFundSourceId) {
                    $itemFs = FundSource::find($itemFundSourceId);
                    if ($itemFs && empty($itemSourceOfFund)) {
                        $itemSourceOfFund = $itemFs->name;
                    }
                } elseif (!empty($itemSourceOfFund)) {
                    $itemFs = FundSource::where('name', trim($itemSourceOfFund))->first();
                    if ($itemFs) {
                        $itemFundSourceId = $itemFs->id;
                    }
                }
                if (empty($itemSourceOfFund)) {
                    $itemSourceOfFund = $sourceOfFund;
                    $itemFundSourceId = $fundSourceId;
                }

                $newItem = PpmpItem::create([
                    'ppmp_id' => $ppmp->id,
                    'item_no' => $itemNo,
                    'description' => $itemData['description'],
                    'is_retention' => (bool) ($itemData['is_retention'] ?? false),
                    'retention_percentage' => isset($itemData['retention_percentage']) && $itemData['retention_percentage'] !== '' ? (float) $itemData['retention_percentage'] : null,
                    'project_type' => $itemData['project_type'] ?? 'Goods',
                    'quantity_size' => $itemData['quantity_size'] ?? '',
                    'procurement_mode' => $itemData['procurement_mode'] ?? 'Public Bidding',
                    'pre_proc_conference' => $itemBudget >= 5000000 ? true : (bool) ($itemData['pre_proc_conference'] ?? false),
                    'start_date' => $itemData['start_date'] ?? null,
                    'end_date' => $itemData['end_date'] ?? null,
                    'delivery_period' => $itemData['delivery_period'] ?? null,
                    'source_of_fund' => $itemSourceOfFund,
                    'fund_source_id' => $itemFundSourceId,
                    'estimated_budget' => $itemBudget,
                    'supporting_docs_text' => $itemData['supporting_docs_text'] ?? null,
                    'remarks' => $itemData['remarks'] ?? null,
                ]);

                $ppmp->cellComments()->where('item_no', $itemNo)->update(['item_id' => $newItem->id]);

                $oldItem = $oldItemsMap->get($itemNo);
                $newDesc = trim((string) ($itemData['description'] ?? ''));
                $newMode = trim((string) ($itemData['procurement_mode'] ?? ''));
                $newQty = trim((string) ($itemData['quantity_size'] ?? ''));

                if (!$oldItem) {
                    $changeLogsToCreate[] = [
                        'ppmp_id' => $ppmp->id,
                        'user_id' => $user->id,
                        'role' => $user->role,
                        'field_name' => "Item #{$itemNo} Added",
                        'old_value' => '(none)',
                        'new_value' => "{$newDesc} (₱" . number_format($itemBudget, 2) . ")",
                        'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                    ];
                } else {
                    $oldBudget = (float) $oldItem->estimated_budget;
                    $oldDesc = trim((string) $oldItem->description);
                    $oldMode = trim((string) $oldItem->procurement_mode);
                    $oldQty = trim((string) $oldItem->quantity_size);

                    if ($oldDesc !== $newDesc) {
                        $changeLogsToCreate[] = [
                            'ppmp_id' => $ppmp->id,
                            'user_id' => $user->id,
                            'role' => $user->role,
                            'field_name' => "Item #{$itemNo} Description",
                            'old_value' => $oldDesc,
                            'new_value' => $newDesc,
                            'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                        ];
                    }
                    if (abs($oldBudget - $itemBudget) > 0.009) {
                        $changeLogsToCreate[] = [
                            'ppmp_id' => $ppmp->id,
                            'user_id' => $user->id,
                            'role' => $user->role,
                            'field_name' => "Item #{$itemNo} Estimated Budget",
                            'old_value' => '₱' . number_format($oldBudget, 2),
                            'new_value' => '₱' . number_format($itemBudget, 2),
                            'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                        ];
                    }
                    if ($oldMode !== $newMode) {
                        $changeLogsToCreate[] = [
                            'ppmp_id' => $ppmp->id,
                            'user_id' => $user->id,
                            'role' => $user->role,
                            'field_name' => "Item #{$itemNo} Procurement Mode",
                            'old_value' => $oldMode,
                            'new_value' => $newMode,
                            'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                        ];
                    }
                    if ($oldQty !== $newQty) {
                        $changeLogsToCreate[] = [
                            'ppmp_id' => $ppmp->id,
                            'user_id' => $user->id,
                            'role' => $user->role,
                            'field_name' => "Item #{$itemNo} Quantity/Size",
                            'old_value' => $oldQty ?: '(empty)',
                            'new_value' => $newQty ?: '(empty)',
                            'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                        ];
                    }
                }
            }

            $newCount = count($validated['items']);
            foreach ($oldItems as $oldItem) {
                if ($oldItem->item_no > $newCount) {
                    $changeLogsToCreate[] = [
                        'ppmp_id' => $ppmp->id,
                        'user_id' => $user->id,
                        'role' => $user->role,
                        'field_name' => "Item #{$oldItem->item_no} Removed",
                        'old_value' => "{$oldItem->description} (₱" . number_format((float)$oldItem->estimated_budget, 2) . ")",
                        'new_value' => '(removed)',
                        'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                    ];
                }
            }

            $oldTotal = (float) ($oldValues['total_budget'] ?? 0);
            if (abs($oldTotal - $total) > 0.009) {
                $changeLogsToCreate[] = [
                    'ppmp_id' => $ppmp->id,
                    'user_id' => $user->id,
                    'role' => $user->role,
                    'field_name' => 'Total Budget',
                    'old_value' => '₱' . number_format($oldTotal, 2),
                    'new_value' => '₱' . number_format($total, 2),
                    'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                ];
            }

            foreach ($changeLogsToCreate as $log) {
                \App\Models\PpmpChangeLog::create($log);
            }

            if ($ppmp->is_continuation) {
                $rootAnnual = $ppmp->getRootAnnualPpmp();
                $annualCeiling = (float) ($ppmp->baseline_annual_budget ?? ($rootAnnual ? ($rootAnnual->total_budget ?: $rootAnnual->items()->sum('estimated_budget')) : 0));
                if ($annualCeiling > 0 && $total > ($annualCeiling + 0.01)) {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'total_budget' => ["The estimated budget (₱" . number_format($total, 2) . ") cannot exceed the baseline Annual PPMP budgetary allocation (₱" . number_format($annualCeiling, 2) . ")."]
                    ]);
                }
            }

            $ppmp->update(['total_budget' => $total]);

            $isAmendedOrSupplemental = !empty($ppmp->parent_id) || in_array($ppmp->amendment_type, ['AMENDMENT', 'SUPPLEMENTAL'], true);
            if ($isAmendedOrSupplemental && count($changeLogsToCreate) > 0) {
                $existingApp = $ppmp->app_data;
                $oldApp = $existingApp['old_app'] ?? ((!empty($existingApp['rows']) && is_array($existingApp['rows'])) ? $existingApp : null) ?? $ppmp->parent?->app_data;
                $ppmp->update([
                    'app_data' => [
                        'needs_regeneration' => true,
                        'is_generated' => false,
                        'old_app' => $oldApp,
                        'invalidated_at' => now()->toIso8601String(),
                        'invalidated_by' => $user->name,
                        'invalidated_by_role' => $user->role,
                    ],
                ]);
            }

            AuditLog::log('PPMP_UPDATED', 'ppmps', $ppmp->id, $oldValues, ['total_budget' => $total], $user->id);
        });

        return response()->json([
            'message' => 'PPMP updated successfully.',
            'ppmp' => $ppmp->fresh(['office.head', 'creator.office.head', 'items', 'signatures.user', 'attachments', 'routes', 'changeLogs.user', 'monitoringProjects']),
        ]);
    }

    public function saveAttachmentList(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        $isCreatorEditable = ($ppmp->created_by === $user->id) && in_array($ppmp->status, [
            'DRAFT',
            'HEAD_PENDING',
            'HEAD_APPROVED',
            'HEAD_RETURNED',
            'BUDGET_OFFICER_RETURNED',
            'BUDGET_HEAD_RETURNED',
            'PACCO_RETURNED',
            'PACCO_HEAD_RETURNED',
            'OPPMO_RETURNED',
            'OPPMO_HEAD_RETURNED',
            'TWG_RETURNED'
        ]);

        $headStage = ReviewHeadResolver::stageForStatus($ppmp->status);
        $isReviewOfficeHead = $user->isHead() && $headStage && (int) $user->office_id === ReviewHeadResolver::resolveOfficeIdForStage($headStage, $ppmp);

        $isReviewerEditable = (
            ($user->isHead() && in_array($ppmp->status, ['HEAD_PENDING', 'HEAD_APPROVED']) && $user->office_id === $ppmp->office_id) ||
            $isReviewOfficeHead ||
            ($user->isBudgetOfficer() && $ppmp->status === 'BUDGET_OFFICER_REVIEW' && (!$ppmp->budget_reviewer_id || $ppmp->budget_reviewer_id === $user->id)) ||
            ($user->isPacco() && $ppmp->status === 'PACCO_REVIEW' && (!$ppmp->budget_reviewer_id || $ppmp->budget_reviewer_id === $user->id)) ||
            ($user->isOppmo() && $ppmp->status === 'OPPMO_REVIEW' && (!$ppmp->oppmo_reviewer_id || $ppmp->oppmo_reviewer_id === $user->id)) ||
            ($user->isTwg() && $ppmp->status === 'TWG_REVIEW' && (!$ppmp->twg_reviewer_id || $ppmp->twg_reviewer_id === $user->id))
        );

        if (!$isCreatorEditable && !$isReviewerEditable && !$user->isAdmin()) {
            return response()->json([
                'message' => "Detailed Specifications are locked. Once submitted for review, only the authorized reviewer can modify them."
            ], 403);
        }

        if ($ppmp->amendment_scope === 'PPMP_APP' && !$user->isAdmin()) {
            return response()->json([
                'message' => "Detailed Specifications cannot be modified for this revision. The approved request scope is restricted to PPMP/APP procurement items only."
            ], 403);
        }

        $validated = $request->validate([
            'office_name' => 'nullable|string',
            'project_title' => 'nullable|string',
            'total_budget' => 'nullable|numeric',
            'other_terms' => 'nullable|string',
            'additional_condition' => 'nullable|string',
            'charges' => 'nullable|string',
            'place_of_delivery' => 'nullable|string',
            'payment_method' => 'nullable|string',
            'delivery_period' => 'nullable|string',
            'prepared_by_name' => 'nullable|string',
            'prepared_by_position' => 'nullable|string',
            'submitted_by_name' => 'nullable|string',
            'submitted_by_position' => 'nullable|string',
            'approved_by_name' => 'nullable|string',
            'approved_by_position' => 'nullable|string',
            'rows' => 'nullable|array',
            'attachment_lists' => 'nullable|array',
            'active_item_id' => 'nullable',
        ]);

        if (empty($validated['rows']) && empty($validated['attachment_lists'])) {
            return response()->json(['message' => 'The rows or attachment_lists field is required.'], 422);
        }

        $ppmpBudget = (float) ($ppmp->total_budget ?? 0);
        $procurementItems = $ppmp->items()->whereNotNull('description')->where('description', '!=', '')->get();
        $itemsByIdBudget = [];
        $itemsByIdxBudget = [];
        foreach ($procurementItems as $idx => $pItem) {
            $itemEstimated = (float) ($pItem->estimated_budget ?? 0);
            $effectiveBudget = $itemEstimated > 0 ? $itemEstimated : $ppmpBudget;
            $itemsByIdBudget[(string) $pItem->id] = $effectiveBudget;
            $itemsByIdxBudget[(string) $idx] = $effectiveBudget;
        }

        $listsToCheck = !empty($validated['attachment_lists']) ? $validated['attachment_lists'] : [];
        if (!empty($validated['rows'])) {
            $activeKey = (string) ($validated['active_item_id'] ?? '0');
            $listsToCheck[$activeKey] = array_merge($listsToCheck[$activeKey] ?? [], ['rows' => $validated['rows']]);
        }

        foreach ($listsToCheck as $key => $listData) {
            if (empty($listData['rows']) || !is_array($listData['rows'])) {
                continue;
            }
            $calculatedTotal = 0.0;
            foreach ($listData['rows'] as $r) {
                if (isset($r['totalCost']) && is_numeric($r['totalCost'])) {
                    $calculatedTotal += (float) $r['totalCost'];
                } elseif (!empty($r['qty']) && !empty($r['unitCost']) && is_numeric($r['qty']) && is_numeric($r['unitCost'])) {
                    $calculatedTotal += ((float) $r['qty']) * ((float) $r['unitCost']);
                }
            }
            $allocatedBudget = $itemsByIdBudget[(string) $key] ?? $itemsByIdxBudget[(string) $key] ?? $ppmpBudget;
            if ($allocatedBudget > 0 && $calculatedTotal > ($allocatedBudget + 0.01)) {
                $formattedTotal = number_format($calculatedTotal, 2);
                $formattedBudget = number_format($allocatedBudget, 2);
                $excess = number_format($calculatedTotal - $allocatedBudget, 2);
                return response()->json([
                    'message' => "Cannot save: The Total Cost (₱{$formattedTotal}) of the Detailed Specifications exceeds the Allocated Budget (₱{$formattedBudget}) from the PPMP data by ₱{$excess}. The total cost must coincide with or be lower than the Allocated Budget."
                ], 422);
            }
        }

        $existingData = is_array($ppmp->attachment_list_data) ? $ppmp->attachment_list_data : [];
        if (!empty($validated['attachment_lists'])) {
            $mergedLists = $existingData['attachment_lists'] ?? [];
            foreach ($validated['attachment_lists'] as $key => $listVal) {
                $mergedLists[$key] = $listVal;
            }
            $validated['attachment_lists'] = $mergedLists;
        }

        $twgSig = $ppmp->signatures()->where('role', 'twg')->first();
        if ($twgSig) {
            $validated['approved_by_name'] = $twgSig->signer_name;
            $validated['approved_by_position'] = $twgSig->signer_designation;
        } else {
            if (!empty($validated['approved_by_name']) && (stripos($validated['approved_by_name'], 'cagas') !== false || stripos($validated['approved_by_name'], 'governor') !== false)) {
                $validated['approved_by_name'] = null;
                $validated['approved_by_position'] = null;
            }
        }

        $changeLogsToCreate = [];

        $attHeaderFields = [
            'warranty_and_other_terms' => ['key' => 'other_terms', 'label' => 'Attachment List • Other Terms & Delivery Info'],
            'additional_condition' => ['key' => 'additional_condition', 'label' => 'Attachment List • Additional Condition'],
            'place_of_delivery' => ['key' => 'place_of_delivery', 'label' => 'Attachment List • Place of Delivery'],
            'payment_method' => ['key' => 'payment_method', 'label' => 'Attachment List • Payment Method'],
            'delivery_period' => ['key' => 'delivery_period', 'label' => 'Attachment List • Delivery Period'],
        ];

        foreach ($attHeaderFields as $modelField => $cfg) {
            $valKey = $cfg['key'];
            if (array_key_exists($valKey, $validated)) {
                $oldHVal = trim((string) ($ppmp->{$modelField} ?? ''));
                $newHVal = trim((string) ($validated[$valKey] ?? ''));
                if ($oldHVal !== $newHVal && ($oldHVal !== '' || $newHVal !== '')) {
                    $changeLogsToCreate[] = [
                        'ppmp_id' => $ppmp->id,
                        'user_id' => $user->id,
                        'role' => $user->role,
                        'field_name' => $cfg['label'],
                        'old_value' => $oldHVal ?: '(empty)',
                        'new_value' => $newHVal ?: '(empty)',
                        'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                    ];
                }
            }
        }

        $existingLists = $existingData['attachment_lists'] ?? [];
        $incomingLists = $validated['attachment_lists'] ?? [];
        if (!empty($validated['rows']) && empty($incomingLists)) {
            $activeKey = (string) ($validated['active_item_id'] ?? '0');
            $incomingLists[$activeKey] = ['rows' => $validated['rows']];
        }

        foreach ($incomingLists as $listKey => $listVal) {
            $listNum = is_numeric($listKey) ? ((int) $listKey + 1) : 1;
            $oldRows = $existingLists[$listKey]['rows'] ?? ($existingData['rows'] ?? []);
            $newRows = $listVal['rows'] ?? [];

            foreach ($newRows as $rIdx => $newRow) {
                $rowNum = $rIdx + 1;
                $oldRow = $oldRows[$rIdx] ?? null;

                if (!$oldRow) {
                    $newDesc = trim((string) ($newRow['description'] ?? ''));
                    $newUnit = trim((string) ($newRow['unit'] ?? ''));
                    $newQty = trim((string) ($newRow['qty'] ?? ''));
                    if ($newDesc !== '') {
                        $changeLogsToCreate[] = [
                            'ppmp_id' => $ppmp->id,
                            'user_id' => $user->id,
                            'role' => $user->role,
                            'field_name' => "Attachment List #{$listNum} • Row #{$rowNum} Description",
                            'old_value' => '(none)',
                            'new_value' => "{$newDesc} ({$newQty} {$newUnit})",
                            'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                        ];
                    }
                } else {
                    $rowDiffFields = [
                        'unit' => "Attachment List #{$listNum} • Row #{$rowNum} Unit",
                        'description' => "Attachment List #{$listNum} • Row #{$rowNum} Description",
                        'qty' => "Attachment List #{$listNum} • Row #{$rowNum} Quantity",
                        'unitCost' => "Attachment List #{$listNum} • Row #{$rowNum} Unit Cost",
                        'totalCost' => "Attachment List #{$listNum} • Row #{$rowNum} Total Cost",
                    ];

                    foreach ($rowDiffFields as $fKey => $fLabel) {
                        $oldRVal = trim((string) ($oldRow[$fKey] ?? ''));
                        $newRVal = trim((string) ($newRow[$fKey] ?? ''));

                        if ($oldRVal !== $newRVal && ($oldRVal !== '' || $newRVal !== '')) {
                            $oldDisplay = in_array($fKey, ['unitCost', 'totalCost']) && is_numeric($oldRVal) ? '₱' . number_format((float) $oldRVal, 2) : $oldRVal;
                            $newDisplay = in_array($fKey, ['unitCost', 'totalCost']) && is_numeric($newRVal) ? '₱' . number_format((float) $newRVal, 2) : $newRVal;

                            $changeLogsToCreate[] = [
                                'ppmp_id' => $ppmp->id,
                                'user_id' => $user->id,
                                'role' => $user->role,
                                'field_name' => $fLabel,
                                'old_value' => $oldDisplay ?: '(empty)',
                                'new_value' => $newDisplay ?: '(empty)',
                                'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                            ];
                        }
                    }
                }
            }
        }

        foreach ($changeLogsToCreate as $log) {
            \App\Models\PpmpChangeLog::create($log);
        }

        $ppmpUpdates = ['attachment_list_data' => $validated];
        if (array_key_exists('other_terms', $validated)) {
            $ppmpUpdates['warranty_and_other_terms'] = $validated['other_terms'];
        }
        if (array_key_exists('additional_condition', $validated)) {
            $ppmpUpdates['additional_condition'] = $validated['additional_condition'];
        }
        if (array_key_exists('place_of_delivery', $validated) && $validated['place_of_delivery']) {
            $ppmpUpdates['place_of_delivery'] = $validated['place_of_delivery'];
        }
        if (array_key_exists('payment_method', $validated) && $validated['payment_method']) {
            $ppmpUpdates['payment_method'] = $validated['payment_method'];
        }
        if (array_key_exists('delivery_period', $validated) && $validated['delivery_period']) {
            $ppmpUpdates['delivery_period'] = $validated['delivery_period'];
        }

        $ppmp->update($ppmpUpdates);
        $ppmp->syncAttachmentLists($validated);

        AuditLog::log(
            'PPMP_ATTACHMENT_LIST_GENERATED',
            'ppmps',
            $ppmp->id,
            null,
            ['items_count' => count($validated['rows'] ?? [])],
            $user->id
        );

        return response()->json([
            'message' => 'Detailed Specifications saved successfully.',
            'ppmp' => $ppmp->fresh(['office.head', 'creator.office.head', 'items', 'signatures.user', 'attachments', 'routes', 'changeLogs.user']),
        ]);
    }

    public function saveAppData(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        $isOppmoAuthorized = $user->isOppmo() && in_array($ppmp->status, ['OPPMO_REVIEW', 'READY_TO_PRINT'], true) && (!$ppmp->oppmo_reviewer_id || $ppmp->oppmo_reviewer_id === $user->id);

        if ($ppmp->amendment_scope === 'ATTACHMENT_LIST' && !$user->isAdmin()) {
            return response()->json([
                'message' => 'The Annual Procurement Plan (APP) cannot be modified or regenerated for this revision. The approved request scope is restricted to the Detailed Specifications only.'
            ], 403);
        }

        if (!$isOppmoAuthorized && !$user->isAdmin()) {
            return response()->json([
                'message' => 'Only the OPPMO reviewer can generate or regenerate the Annual Procurement Plan (APP).'
            ], 403);
        }

        $validated = $request->validate([
            'fiscal_year' => 'nullable|string',
            'plan_version_type' => 'nullable|string',
            'updated_version_no' => 'nullable|string',
            'prepared_by_name' => 'nullable|string',
            'prepared_by_position' => 'nullable|string',
            'reviewed_by_name' => 'nullable|string',
            'reviewed_by_position' => 'nullable|string',
            'recommending_name' => 'nullable|string',
            'recommending_position' => 'nullable|string',
            'approved_by_name' => 'nullable|string',
            'approved_by_position' => 'nullable|string',
            'rows' => 'required|array',
        ]);

        $existingApp = $ppmp->app_data;
        $oldApp = $existingApp['old_app'] ?? ((!empty($existingApp['rows']) && is_array($existingApp['rows'])) ? $existingApp : null) ?? $ppmp->parent?->app_data;

        $validated['is_generated'] = true;
        $validated['needs_regeneration'] = false;
        $validated['is_oppmo_approved'] = $ppmp->status === 'READY_TO_PRINT';
        $validated['generated_at'] = now()->toIso8601String();
        $validated['generated_by_id'] = $user->id;
        $validated['generated_by_name'] = $user->name;
        if ($oldApp) {
            $validated['old_app'] = $oldApp;
        }

        $ppmp->update([
            'app_data' => $validated,
        ]);

        \App\Models\PpmpChangeLog::create([
            'ppmp_id' => $ppmp->id,
            'user_id' => $user->id,
            'role' => $user->role,
            'field_name' => 'Annual Procurement Plan (APP)',
            'old_value' => $oldApp ? 'Previous APP Baseline' : '(none)',
            'new_value' => 'Regenerated APP (' . count($validated['rows']) . ' item rows)',
            'action' => 'app_generated',
        ]);

        AuditLog::log(
            'PPMP_APP_DATA_SAVED',
            'ppmps',
            $ppmp->id,
            null,
            ['items_count' => count($validated['rows'])],
            $user->id
        );

        return response()->json([
            'message' => 'Annual Procurement Plan (APP) data saved successfully.',
            'ppmp' => $ppmp->fresh(['office.head', 'creator.office.head', 'items', 'signatures.user', 'attachments', 'routes', 'changeLogs.user']),
        ]);
    }

    public function checkTrackerAvailability(Request $request): JsonResponse
    {
        $raw = (string) $request->query('tracking_number', '');
        $normalized = Ppmp::normalizeTrackingNumber($raw);

        if ($normalized === '') {
            return response()->json([
                'available' => false,
                'exists' => false,
                'tracking_number' => '',
                'message' => 'Please enter a valid Tracker No.',
            ]);
        }

        $excludeIds = [];
        $excludeUuid = $request->query('exclude_uuid');
        if (!empty($excludeUuid)) {
            $currentPpmp = Ppmp::where('uuid', $excludeUuid)->first();
            if ($currentPpmp) {
                $excludeIds = $currentPpmp->getFamilyIds();
            }
        }

        $existingQuery = Ppmp::with('office')->whereRaw('UPPER(TRIM(tracking_number)) = ?', [$normalized]);
        if (!empty($excludeIds)) {
            $existingQuery->whereNotIn('id', $excludeIds);
        }

        $existing = $existingQuery->first();
        if ($existing) {
            $officeLabel = $existing->office?->code ?: ($existing->office?->name ?: 'another record');
            return response()->json([
                'available' => false,
                'exists' => true,
                'tracking_number' => $normalized,
                'existing_ppmp' => [
                    'uuid' => $existing->uuid,
                    'title' => $existing->title,
                    'office' => $officeLabel,
                    'fiscal_year' => $existing->fiscal_year,
                ],
                'message' => "Tracker No. \"{$normalized}\" already exists ({$existing->title}). Duplicate tracker numbers are not allowed.",
            ]);
        }

        return response()->json([
            'available' => true,
            'exists' => false,
            'tracking_number' => $normalized,
            'message' => "Tracker No. \"{$normalized}\" is available.",
        ]);
    }

    public function nextTrackingNumber(Request $request): JsonResponse
    {
        $user = $request->user();

        $officeCode = null;
        $implementingUnit = trim((string) $request->query('implementing_unit', ''));
        if ($implementingUnit !== '' && preg_match('/^\(([^)]+)\)/', $implementingUnit, $m)) {
            $candidate = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $m[1]));
            if ($candidate !== '' && $candidate !== 'NA') {
                $officeCode = $candidate;
            }
        }
        if (!$officeCode && $user?->office_id) {
            $office = \App\Models\Office::find($user->office_id);
            if ($office && !empty($office->code) && strtoupper($office->code) !== 'NA') {
                $officeCode = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $office->code));
            }
        }
        if (!$officeCode) {
            $officeCode = 'PPMO';
        }

        $rawType = strtolower(trim((string) $request->query('project_type', 'Goods')));
        if (str_contains($rawType, 'infra')) {
            $typeCode = 'INFRA';
        } elseif (str_contains($rawType, 'consult')) {
            $typeCode = 'CONSULTING';
        } else {
            $typeCode = 'GOODS';
        }

        $rawYear = trim((string) $request->query('fiscal_year', (string) date('Y')));
        $year = preg_match('/\b(20\d{2}|\d{4})\b/', $rawYear, $m) ? $m[1] : preg_replace('/^CY\s*/i', '', $rawYear);
        if (empty($year)) {
            $year = (string) date('Y');
        }

        $trackerPrefix = "{$officeCode}{$typeCode}-{$year}-";
        $existingTrackers = Ppmp::where('tracking_number', 'like', "{$trackerPrefix}%")
            ->pluck('tracking_number');

        $maxSeq = 0;
        $prefixRegex = '/^' . preg_quote($trackerPrefix, '/') . '(\d+)/';
        foreach ($existingTrackers as $tn) {
            if (preg_match($prefixRegex, (string) $tn, $matches)) {
                $num = (int) $matches[1];
                if ($num > $maxSeq) {
                    $maxSeq = $num;
                }
            }
        }

        $seq = $maxSeq + 1;
        $candidateTracker = $trackerPrefix . str_pad((string) $seq, 6, '0', STR_PAD_LEFT);
        while (Ppmp::isTrackingNumberTaken($candidateTracker)) {
            $seq++;
            $candidateTracker = $trackerPrefix . str_pad((string) $seq, 6, '0', STR_PAD_LEFT);
        }

        return response()->json([
            'tracking_number' => $candidateTracker,
        ]);
    }

    public function updateTrackingNumber(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        $isCreatorEditable = ($ppmp->created_by === $user->id) && in_array($ppmp->status, [
            'DRAFT',
            'HEAD_PENDING',
            'HEAD_APPROVED',
            'HEAD_RETURNED',
            'BUDGET_OFFICER_RETURNED',
            'BUDGET_HEAD_RETURNED',
            'PACCO_RETURNED',
            'PACCO_HEAD_RETURNED',
            'OPPMO_RETURNED',
            'OPPMO_HEAD_RETURNED',
            'TWG_RETURNED',
        ], true);

        $headStage = ReviewHeadResolver::stageForStatus($ppmp->status);
        $isReviewOfficeHead = $user->isHead() && $headStage && (int) $user->office_id === ReviewHeadResolver::resolveOfficeIdForStage($headStage, $ppmp);

        $isReviewerEditable = (
            ($user->isHead() && in_array($ppmp->status, ['HEAD_PENDING', 'HEAD_APPROVED'], true) && $user->office_id === $ppmp->office_id) ||
            $isReviewOfficeHead ||
            ($user->isBudgetOfficer() && $ppmp->status === 'BUDGET_OFFICER_REVIEW' && (!$ppmp->budget_reviewer_id || $ppmp->budget_reviewer_id === $user->id)) ||
            ($user->isPacco() && $ppmp->status === 'PACCO_REVIEW' && (!$ppmp->budget_reviewer_id || $ppmp->budget_reviewer_id === $user->id)) ||
            ($user->isOppmo() && $ppmp->status === 'OPPMO_REVIEW' && (!$ppmp->oppmo_reviewer_id || $ppmp->oppmo_reviewer_id === $user->id)) ||
            ($user->isTwg() && $ppmp->status === 'TWG_REVIEW' && (!$ppmp->twg_reviewer_id || $ppmp->twg_reviewer_id === $user->id))
        );

        if (!$isCreatorEditable && !$isReviewerEditable && !$user->isAdmin()) {
            return response()->json([
                'message' => "Tracker No. cannot be modified by you in its current status: {$ppmp->status}.",
            ], 403);
        }

        $validated = $request->validate([
            'tracking_number' => 'required|string|max:100',
        ]);

        $newTracker = Ppmp::normalizeTrackingNumber($validated['tracking_number']);
        if ($newTracker === '') {
            return response()->json([
                'message' => 'Tracker No. cannot be empty.',
                'errors' => ['tracking_number' => ['Tracker No. cannot be empty.']],
            ], 422);
        }

        $familyIds = $ppmp->getFamilyIds();
        if (Ppmp::isTrackingNumberTaken($newTracker, $familyIds)) {
            return response()->json([
                'message' => "Tracker No. \"{$newTracker}\" already exists. Duplicate tracker numbers are not allowed.",
                'errors' => [
                    'tracking_number' => ["Tracker No. \"{$newTracker}\" already exists. Duplicate tracker numbers are not allowed."],
                ],
            ], 422);
        }

        $oldTracker = (string) ($ppmp->tracking_number ?? '');

        DB::transaction(function () use ($ppmp, $familyIds, $oldTracker, $newTracker, $user) {
            $ppmp->update(['tracking_number' => $newTracker]);

            $otherFamilyIds = array_values(array_diff($familyIds, [$ppmp->id]));
            if (!empty($otherFamilyIds)) {
                Ppmp::whereIn('id', $otherFamilyIds)->update(['tracking_number' => $newTracker]);
            }

            if ($oldTracker !== $newTracker) {
                \App\Models\MonitoringProject::whereIn('ppmp_id', $familyIds)->update([
                    'pr_number' => $newTracker,
                ]);
                \App\Models\PurchaseRequest::whereIn('ppmp_id', $familyIds)->update([
                    'tracker_id' => $newTracker,
                ]);
                \App\Models\MonitoringProject::flushCache();

                \App\Models\PpmpChangeLog::create([
                    'ppmp_id' => $ppmp->id,
                    'user_id' => $user->id,
                    'role' => $user->role,
                    'field_name' => 'Tracker Number',
                    'old_value' => $oldTracker !== '' ? $oldTracker : '(empty)',
                    'new_value' => $newTracker,
                    'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                ]);

                AuditLog::log(
                    'PPMP_TRACKER_UPDATED',
                    'ppmps',
                    $ppmp->id,
                    ['tracking_number' => $oldTracker],
                    ['tracking_number' => $newTracker],
                    $user->id
                );
            }
        });

        return response()->json([
            'message' => "Tracker No. updated to {$newTracker}.",
            'tracking_number' => $newTracker,
            'ppmp' => $ppmp->fresh([
                'office.head',
                'creator.office.head',
                'items',
                'signatures.user',
                'attachments',
                'marketScoping.activities',
                'marketScoping.results',
                'routes',
                'changeLogs.user',
                'monitoringProjects',
            ]),
        ]);
    }

    public function saveMarketScoping(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        $isCreatorEditable = ($ppmp->created_by === $user->id) && in_array($ppmp->status, [
            'DRAFT',
            'HEAD_PENDING',
            'HEAD_APPROVED',
            'HEAD_RETURNED',
            'BUDGET_OFFICER_RETURNED',
            'BUDGET_HEAD_RETURNED',
            'PACCO_RETURNED',
            'PACCO_HEAD_RETURNED',
            'OPPMO_RETURNED',
            'OPPMO_HEAD_RETURNED',
            'TWG_RETURNED',
        ], true);

        $headStage = ReviewHeadResolver::stageForStatus($ppmp->status);
        $isReviewOfficeHead = $user->isHead() && $headStage && (int) $user->office_id === ReviewHeadResolver::resolveOfficeIdForStage($headStage, $ppmp);

        $isReviewerEditable = (
            ($user->isHead() && in_array($ppmp->status, ['HEAD_PENDING', 'HEAD_APPROVED'], true) && $user->office_id === $ppmp->office_id) ||
            $isReviewOfficeHead ||
            ($user->isBudgetOfficer() && $ppmp->status === 'BUDGET_OFFICER_REVIEW' && (!$ppmp->budget_reviewer_id || $ppmp->budget_reviewer_id === $user->id)) ||
            ($user->isPacco() && $ppmp->status === 'PACCO_REVIEW' && (!$ppmp->budget_reviewer_id || $ppmp->budget_reviewer_id === $user->id)) ||
            ($user->isOppmo() && $ppmp->status === 'OPPMO_REVIEW' && (!$ppmp->oppmo_reviewer_id || $ppmp->oppmo_reviewer_id === $user->id)) ||
            ($user->isTwg() && $ppmp->status === 'TWG_REVIEW' && (!$ppmp->twg_reviewer_id || $ppmp->twg_reviewer_id === $user->id))
        );

        if (!$isCreatorEditable && !$isReviewerEditable && !$user->isAdmin()) {
            return response()->json([
                'message' => "Market Scoping Checklist cannot be modified by you in its current status: {$ppmp->status}.",
            ], 403);
        }

        $validated = $request->validate([
            'procuring_entity' => 'nullable|string|max:255',
            'implementing_unit' => 'nullable|string|max:255',
            'representative_name_designation' => 'nullable|string|max:255',
            'project_name' => 'nullable|string|max:500',
            'estimated_budget' => 'nullable|numeric|min:0',
            'scoping_period_from' => 'nullable|string|max:25',
            'scoping_period_to' => 'nullable|string|max:25',
            'expected_delivery_date' => 'nullable|string|max:100',
            'prepared_by_name' => 'nullable|string|max:255',
            'prepared_by_position' => 'nullable|string|max:255',
            'prepared_by_date' => 'nullable|string|max:50',
            'approved_by_name' => 'nullable|string|max:255',
            'approved_by_position' => 'nullable|string|max:255',
            'approved_by_date' => 'nullable|string|max:50',
            'activities' => 'nullable|array',
            'activities.*.activity_code' => 'required|string|max:60',
            'activities.*.is_checked' => 'nullable|boolean',
            'activities.*.custom_activity_text' => 'nullable|string|max:2000',
            'activities.*.documentation_notes' => 'nullable|string|max:2000',
            'activities.*.sort_order' => 'nullable|integer|min:0',
            'results' => 'nullable|array',
            'results.*.parameter_code' => 'required|string|max:60',
            'results.*.considered' => 'nullable|string|in:Yes,No,Not Applicable,',
            'results.*.recommendations' => 'nullable|string|max:4000',
            'results.*.sort_order' => 'nullable|integer|min:0',
        ]);

        $scoping = DB::transaction(function () use ($ppmp, $user, $validated) {
            $existing = \App\Models\PpmpMarketScoping::where('ppmp_id', $ppmp->id)->first();
            $isNew = !$existing;

            $scoping = \App\Models\PpmpMarketScoping::updateOrCreate(
                ['ppmp_id' => $ppmp->id],
                [
                    'procuring_entity' => $validated['procuring_entity'] ?? 'PROVINCIAL GOVERNMENT OF DAVAO DEL SUR',
                    'implementing_unit' => $validated['implementing_unit'] ?? ($ppmp->implementing_unit ?: $ppmp->office?->name),
                    'representative_name_designation' => $validated['representative_name_designation'] ?? null,
                    'project_name' => $validated['project_name'] ?? $ppmp->title,
                    'estimated_budget' => array_key_exists('estimated_budget', $validated) && $validated['estimated_budget'] !== null
                        ? (float) $validated['estimated_budget']
                        : (float) ($ppmp->total_budget ?? 0),
                    'scoping_period_from' => $validated['scoping_period_from'] ?? null,
                    'scoping_period_to' => $validated['scoping_period_to'] ?? null,
                    'expected_delivery_date' => $validated['expected_delivery_date'] ?? null,
                    'prepared_by_name' => $validated['prepared_by_name'] ?? null,
                    'prepared_by_position' => $validated['prepared_by_position'] ?? null,
                    'prepared_by_date' => $validated['prepared_by_date'] ?? null,
                    'approved_by_name' => $validated['approved_by_name'] ?? null,
                    'approved_by_position' => $validated['approved_by_position'] ?? null,
                    'approved_by_date' => $validated['approved_by_date'] ?? null,
                    'created_by' => $existing?->created_by ?? $user->id,
                    'updated_by' => $user->id,
                ]
            );

            if (isset($validated['activities']) && is_array($validated['activities'])) {
                foreach ($validated['activities'] as $idx => $act) {
                    \App\Models\PpmpMarketScopingActivity::updateOrCreate(
                        [
                            'market_scoping_id' => $scoping->id,
                            'activity_code' => $act['activity_code'],
                        ],
                        [
                            'is_checked' => !empty($act['is_checked']),
                            'custom_activity_text' => $act['custom_activity_text'] ?? null,
                            'documentation_notes' => $act['documentation_notes'] ?? null,
                            'sort_order' => $act['sort_order'] ?? ($idx + 1),
                        ]
                    );
                }
            }

            if (isset($validated['results']) && is_array($validated['results'])) {
                foreach ($validated['results'] as $idx => $res) {
                    \App\Models\PpmpMarketScopingResult::updateOrCreate(
                        [
                            'market_scoping_id' => $scoping->id,
                            'parameter_code' => $res['parameter_code'],
                        ],
                        [
                            'considered' => ($res['considered'] ?? '') !== '' ? $res['considered'] : null,
                            'recommendations' => $res['recommendations'] ?? null,
                            'sort_order' => $res['sort_order'] ?? ($idx + 1),
                        ]
                    );
                }
            }

            \App\Models\PpmpChangeLog::create([
                'ppmp_id' => $ppmp->id,
                'user_id' => $user->id,
                'role' => $user->role,
                'field_name' => 'Market Scoping Checklist',
                'old_value' => $isNew ? '(not created)' : 'Updated',
                'new_value' => $isNew ? 'Market Scoping Checklist Created' : 'Market Scoping Checklist Saved',
                'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
            ]);

            AuditLog::log(
                'MARKET_SCOPING_SAVED',
                'ppmp_market_scopings',
                $scoping->id,
                null,
                ['ppmp_id' => $ppmp->id, 'project_name' => $scoping->project_name],
                $user->id
            );

            return $scoping->fresh(['activities', 'results']);
        });

        $freshPpmp = $ppmp->fresh([
            'office.head',
            'creator.office.head',
            'items',
            'signatures.user',
            'attachments',
            'marketScoping.activities',
            'marketScoping.results',
            'routes',
            'changeLogs.user',
            'cellComments.reviewer',
            'cellComments.compliedByUser',
            'monitoringProjects',
        ]);

        return response()->json([
            'message' => 'Market Scoping Checklist saved successfully.',
            'market_scoping' => $scoping,
            'ppmp' => $freshPpmp,
        ]);
    }

    public function readyToPrintList(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin or Super Admin access required.'], 403);
        }

        $desiredColumns = [
            'id',
            'uuid',
            'tracking_number',
            'ppmp_number',
            'title',
            'office_id',
            'implementing_unit',
            'fiscal_year',
            'plan_type',
            'account_code',
            'program_name',
            'total_budget',
            'status',
            'oppmo_approved_at',
            'head_approved_at',
            'created_at',
            'updated_at',
        ];
        $existingColumns = \Illuminate\Support\Facades\Schema::getColumnListing('ppmps');
        $selectColumns = array_values(array_intersect($desiredColumns, $existingColumns));
        if (empty($selectColumns)) {
            $selectColumns = ['*'];
        }

        $ppmps = Ppmp::with([
            'office:id,name,code',
            'items:id,ppmp_id,project_type,source_of_fund',
        ])
            ->where('status', 'READY_TO_PRINT')
            ->orderByDesc('updated_at')
            ->get($selectColumns);

        $offices = Office::orderBy('name')->get(['id', 'name', 'code']);

        return response()->json([
            'ppmps' => $ppmps,
            'offices' => $offices,
            'signature_settings' => \App\Models\SystemSetting::getSignatureSettings(),
        ]);
    }

    public function readyToPrintBatchDetails(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin or Super Admin access required.'], 403);
        }

        $validated = $request->validate([
            'uuids' => 'required|array|min:1|max:150',
            'uuids.*' => 'required|string',
        ]);

        $signatureSettings = \App\Models\SystemSetting::getSignatureSettings();
        $activeSignatories = \App\Models\PpmpSignatory::getActiveSignatories();
        $activeBudget = $activeSignatories->firstWhere('signatory_type', 'budget_requirement');
        $activeBac = $activeSignatories->firstWhere('signatory_type', 'bac_secretariat');
        $activeGovernor = $activeSignatories->firstWhere('signatory_type', 'approved_by');

        $defaultSignatories = [
            'budget_requirement' => $activeBudget ? [
                'name' => $activeBudget->name,
                'position' => $activeBudget->position,
            ] : null,
            'bac_secretariat' => $activeBac ? [
                'name' => $activeBac->name,
                'position' => $activeBac->position,
            ] : null,
            'approved_by' => $activeGovernor ? [
                'name' => $activeGovernor->name,
                'position' => $activeGovernor->position,
            ] : null,
        ];

        $ppmps = Ppmp::with([
            'office.head',
            'creator.office.head',
            'items.fundSource',
            'fundSourceRef',
            'signatures.user',
            'parent.signatures.user',
            'parent.office.head',
            'accountCodeRef',
            'programNameRef',
        ])
            ->where('status', 'READY_TO_PRINT')
            ->whereIn('uuid', $validated['uuids'])
            ->get()
            ->map(function (Ppmp $ppmp) use ($signatureSettings, $defaultSignatories) {
                $arr = $ppmp->toArray();
                $arr['signature_settings'] = $signatureSettings;
                $arr['default_signatories'] = $defaultSignatories;
                return $arr;
            })
            ->keyBy('uuid');

        return response()->json([
            'ppmps_by_uuid' => $ppmps,
            'signature_settings' => $signatureSettings,
            'default_signatories' => $defaultSignatories,
        ]);
    }
}
