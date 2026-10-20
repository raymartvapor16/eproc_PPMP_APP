<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Office;
use App\Models\Ppmp;
use App\Models\PpmpItem;
use App\Models\PpmpRoute;
use App\Models\PpmpSignature;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class PpmpController extends Controller
{
    /**
     * List PPMPs with server-side filtering, search, and pagination
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        // Only show active/latest PPMPs in the list (superseded PPMPs that have child PPMPs are folded inside the new PPMP)
        $query = Ppmp::with(['office', 'creator', 'items', 'signatures'])
            ->whereDoesntHave('children');

        // Scope based on role
        if ($user->isEndUser()) {
            // End users can see PPMPs created by themselves or in their office
            $query->where('created_by', $user->id);
        } elseif ($user->isHead()) {
            // Head sees PPMPs under their office
            $query->where('office_id', $user->office_id);
        } elseif ($user->isBudgetOfficer()) {
            // Budget officer sees PPMPs that reached review or beyond
            $query->where('status', '!=', 'DRAFT');
        } elseif ($user->isOppmo()) {
            // OPPMO sees PPMPs past budget/pacco review or historical
            $query->whereNotIn('status', ['DRAFT', 'BUDGET_OFFICER_REVIEW', 'BUDGET_OFFICER_RETURNED', 'PACCO_REVIEW', 'PACCO_RETURNED']);
        } elseif ($user->isTwg()) {
            // TWG sees PPMPs reaching TWG review or that they already acted on
            $query->where(function ($q) {
                $q->whereNotIn('status', ['DRAFT', 'BUDGET_OFFICER_REVIEW', 'BUDGET_OFFICER_RETURNED', 'PACCO_REVIEW', 'PACCO_RETURNED', 'OPPMO_REVIEW', 'OPPMO_RETURNED'])
                  ->orWhereNotNull('twg_approved_at')
                  ->orWhereHas('signatures', function ($sq) {
                      $sq->where('role', 'twg');
                  });
            });
        } elseif ($user->isPacco()) {
            // PACCO reviewer sees PPMPs that reached review or beyond
            $query->where('status', '!=', 'DRAFT');
        }

        // Filters
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
            $query->where('amendment_status', $request->input('amendment_status'));
        }

        if ($request->filled('fiscal_year')) {
            $query->where('fiscal_year', $request->input('fiscal_year'));
        }

        if ($request->filled('office_id')) {
            $query->where('office_id', $request->input('office_id'));
        }

        $perPage = min((int) $request->input('per_page', 10), 100);
        $ppmps = $query->latest('id')->paginate($perPage);

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

    /**
     * Create a new PPMP (End User only)
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        if (!$user->isEndUser() && !$user->isAdmin()) {
            return response()->json(['message' => 'Only End Users can initiate a new PPMP.'], 403);
        }

        $validated = $request->validate([
            'ppmp_number' => 'nullable|string|max:50',
            'title' => 'required|string|max:500',
            'source_of_fund' => 'nullable|string|max:255',
            'account_code' => 'nullable|string',
            'fiscal_year' => 'required|string|max:10',
            'plan_type' => 'required|in:INDICATIVE,FINAL',
            'office_id' => 'nullable|exists:offices,id',
            'implementing_unit' => 'nullable|string|max:255',
            'program_name' => 'nullable|string|max:500',
            'delivery_period' => 'nullable|string',
            'place_of_delivery' => 'nullable|string',
            'payment_method' => 'nullable|string',
            'additional_condition' => 'nullable|string|max:255',
            'warranty_and_other_terms' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.description' => 'required|string',
            'items.*.project_type' => 'nullable|string',
            'items.*.quantity_size' => 'nullable|string',
            'items.*.procurement_mode' => 'nullable|string',
            'items.*.pre_proc_conference' => 'nullable|boolean',
            'items.*.start_date' => 'nullable|string',
            'items.*.end_date' => 'nullable|string',
            'items.*.delivery_period' => 'nullable|string',
            'items.*.source_of_fund' => 'nullable|string',
            'items.*.estimated_budget' => 'required|numeric|min:0',
            'items.*.supporting_docs_text' => 'nullable|string',
            'items.*.remarks' => 'nullable|string',
        ]);

        $officeId = $user->office_id ?? $validated['office_id'] ?? Office::first()->id;

        $ppmp = DB::transaction(function () use ($validated, $user, $officeId) {
            // Resolve Office abbreviation code
            $office = Office::find($officeId);
            $rawOfficeCode = $office ? ($office->code ?? 'PPMO') : 'PPMO';
            // Clean office code to alphanumeric and hyphens, uppercase
            $officeCode = strtoupper(preg_replace('/[^A-Za-z0-9\-]/', '', str_replace(' ', '', $rawOfficeCode)));
            if (empty($officeCode)) {
                $officeCode = 'PPMO';
            }

            // Determine primary project procurement type from submitted items
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

            // Clean and extract 4-digit fiscal year from input (e.g. "CY 2028" -> "2028")
            $rawYear = trim($validated['fiscal_year']);
            $year = preg_match('/\b(20\d{2}|\d{4})\b/', $rawYear, $m) ? $m[1] : preg_replace('/^CY\s*/i', '', $rawYear);
            if (empty($year)) {
                $year = (string) date('Y');
            }

            // Generate unique Tracker Number: {OFFICE}{TYPE}-{YEAR}-XXXXXX
            $trackerPrefix = "{$officeCode}{$typeCode}-{$year}-";

            // Determine next sequence by finding the highest sequence number among existing trackers
            // This prevents duplicate or skipped numbers when amendments or supplementals share the same tracker number
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
            $trackingNumber = "{$trackerPrefix}{$nextSeq}";

            // User input for PPMP Number (e.g. 0, 1, 2, 3...) or fallback to sequential index
            $ppmpNumber = isset($validated['ppmp_number']) && $validated['ppmp_number'] !== ''
                ? (string) $validated['ppmp_number']
                : (string) ($maxSeq + 1);

            $sourceOfFund = $validated['source_of_fund'] ?? 'General Fund';

            $ppmp = Ppmp::create([
                'uuid' => (string) Str::uuid(),
                'tracking_number' => $trackingNumber,
                'ppmp_number' => $ppmpNumber,
                'office_id' => $officeId,
                'implementing_unit' => $validated['implementing_unit'] ?? null,
                'program_name' => $validated['program_name'] ?? null,
                'created_by' => $user->id,
                'title' => $validated['title'],
                'source_of_fund' => $sourceOfFund,
                'account_code' => $validated['account_code'] ?? null,
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

                PpmpItem::create([
                    'ppmp_id' => $ppmp->id,
                    'item_no' => $index + 1,
                    'description' => $itemData['description'],
                    'project_type' => $itemData['project_type'] ?? 'Goods',
                    'quantity_size' => $itemData['quantity_size'] ?? '',
                    'procurement_mode' => $itemData['procurement_mode'] ?? 'Public Bidding',
                    'pre_proc_conference' => $itemBudget >= 5000000 ? true : (bool) ($itemData['pre_proc_conference'] ?? false),
                    'start_date' => $itemData['start_date'] ?? null,
                    'end_date' => $itemData['end_date'] ?? null,
                    'delivery_period' => $itemData['delivery_period'] ?? null,
                    'source_of_fund' => $itemData['source_of_fund'] ?? $sourceOfFund,
                    'estimated_budget' => $itemBudget,
                    'supporting_docs_text' => $itemData['supporting_docs_text'] ?? null,
                    'remarks' => $itemData['remarks'] ?? null,
                ]);
            }

            $ppmp->update(['total_budget' => $total]);

            // Create End User "Prepared By" e-signature indicator
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

            // Initial route record
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

        // Automatically sync to Monitoring System so accurate real-time data is available
        try {
            \App\Models\MonitoringProject::syncFromPpmp($ppmp);
        } catch (\Throwable $e) {
            \Illuminate\Support\Facades\Log::warning('MonitoringProject sync failed: ' . $e->getMessage());
        }

        return response()->json([
            'message' => 'PPMP created successfully in DRAFT status.',
            'ppmp' => $ppmp->load(['office', 'creator', 'items', 'signatures', 'attachments', 'routes']),
        ], 201);
    }

    /**
     * Get single PPMP details with full related information
     */
    public function show(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();

        $ppmp = Ppmp::with([
            'office.head',
            'creator',
            'items',
            'attachments.uploader',
            'reviews.reviewer',
            'signatures.user',
            'routes.fromUser',
            'routes.toUser',
            'changeLogs.user',
            'parent.items',
            'parent.signatures.user',
            'parent.office',
            'children.items',
        ])->where('uuid', $uuid)->firstOrFail();

        // Enforce strict access control against IDOR / unauthorized viewing
        if (!$user->isAdmin()) {
            if ($user->isEndUser() && $ppmp->created_by !== $user->id && $ppmp->office_id !== $user->office_id) {
                return response()->json(['message' => 'Unauthorized. You do not have permission to view this PPMP.'], 403);
            }
            if ($user->isHead() && $ppmp->office_id !== $user->office_id) {
                return response()->json(['message' => 'Unauthorized. You may only view PPMPs from your assigned office.'], 403);
            }
            if ($user->isBudgetOfficer() && $ppmp->status === 'DRAFT') {
                return response()->json(['message' => 'PPMP is not yet submitted for Budget review.'], 403);
            }
            if ($user->isOppmo() && in_array($ppmp->status, ['DRAFT', 'BUDGET_OFFICER_REVIEW', 'BUDGET_OFFICER_RETURNED', 'PACCO_REVIEW', 'PACCO_RETURNED'])) {
                return response()->json(['message' => 'PPMP is not yet submitted for OPPMO review.'], 403);
            }
            if ($user->isTwg()) {
                $hasTwgReviewed = $ppmp->twg_approved_at !== null || $ppmp->signatures()->where('role', 'twg')->exists();
                if (!$hasTwgReviewed && in_array($ppmp->status, ['DRAFT', 'BUDGET_OFFICER_REVIEW', 'BUDGET_OFFICER_RETURNED', 'PACCO_REVIEW', 'PACCO_RETURNED', 'OPPMO_REVIEW', 'OPPMO_RETURNED'])) {
                    return response()->json(['message' => 'PPMP is not yet submitted for BAC-TWG review.'], 403);
                }
            }
            if ($user->isPacco() && $ppmp->status === 'DRAFT') {
                return response()->json(['message' => 'PPMP is not yet submitted for review.'], 403);
            }
        }

        // Recursively build full ancestor history from immediate parent down to root annual PPMP
        // Guarded with cycle detection set and maximum iteration limit to prevent infinite loops
        $history = [];
        $currentParent = $ppmp->parent;
        $visitedIds = [$ppmp->id];
        $maxDepth = 25;
        $depth = 0;

        while ($currentParent && $depth < $maxDepth) {
            if (in_array($currentParent->id, $visitedIds, true)) {
                break; // Cycle detected, terminate loop immediately
            }
            $visitedIds[] = $currentParent->id;
            $depth++;

            $currentParent->loadMissing([
                'items',
                'signatures.user',
                'office',
                'creator',
                'attachments.uploader',
                'routes.fromUser',
                'routes.toUser',
                'reviews.reviewer',
                'changeLogs.user',
            ]);
            $history[] = $currentParent;
            $currentParent = $currentParent->parent;
        }
        $ppmp->setRelation('history', collect($history));

        // Signatories for report / details
        $activeBudget = \App\Models\PpmpSignatory::budgetRequirement()->active()->first();
        $activeBac = \App\Models\PpmpSignatory::bacSecretariat()->active()->first();
        $activeGovernor = \App\Models\PpmpSignatory::approvedBy()->active()->first();

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

    /**
     * Update an editable PPMP (End User when DRAFT or RETURNED)
     */
    public function update(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        // Check edit permission: Creator when in draft/head approved/returned, OR active reviewer in their stage, OR admin
        $isCreatorEditable = ($ppmp->created_by === $user->id) && in_array($ppmp->status, [
            'DRAFT',
            'HEAD_PENDING',
            'HEAD_APPROVED',
            'HEAD_RETURNED',
            'BUDGET_OFFICER_RETURNED',
            'PACCO_RETURNED',
            'OPPMO_RETURNED',
            'TWG_RETURNED'
        ]);

        $isReviewerEditable = (
            ($user->isHead() && in_array($ppmp->status, ['HEAD_PENDING', 'HEAD_APPROVED']) && $user->office_id === $ppmp->office_id) ||
            ($user->isBudgetOfficer() && $ppmp->status === 'BUDGET_OFFICER_REVIEW') ||
            ($user->isPacco() && $ppmp->status === 'PACCO_REVIEW') ||
            ($user->isOppmo() && $ppmp->status === 'OPPMO_REVIEW') ||
            ($user->isTwg() && $ppmp->status === 'TWG_REVIEW')
        );

        if (!$isCreatorEditable && !$isReviewerEditable && !$user->isAdmin()) {
            return response()->json([
                'message' => "PPMP cannot be modified by you in its current status: {$ppmp->status}."
            ], 403);
        }

        // Enforce Amendment Scope restriction: if scope was ATTACHMENT_LIST only, PPMP/APP items are locked
        if ($ppmp->amendment_scope === 'ATTACHMENT_LIST' && !$user->isAdmin()) {
            return response()->json([
                'message' => "PPMP items and plan details cannot be modified for this revision. The approved request scope is restricted to the PPMP List of Attachment only."
            ], 403);
        }

        $validated = $request->validate([
            'ppmp_number' => 'nullable|string|max:50',
            'title' => 'required|string|max:500',
            'source_of_fund' => 'nullable|string|max:255',
            'account_code' => 'nullable|string',
            'fiscal_year' => 'required|string|max:10',
            'plan_type' => 'required|in:INDICATIVE,FINAL',
            'implementing_unit' => 'nullable|string|max:255',
            'program_name' => 'nullable|string|max:500',
            'delivery_period' => 'nullable|string',
            'place_of_delivery' => 'nullable|string',
            'payment_method' => 'nullable|string',
            'additional_condition' => 'nullable|string|max:255',
            'warranty_and_other_terms' => 'nullable|string',
            'items' => 'required|array|min:1',
            'items.*.id' => 'nullable|integer',
            'items.*.description' => 'required|string',
            'items.*.project_type' => 'nullable|string',
            'items.*.quantity_size' => 'nullable|string',
            'items.*.procurement_mode' => 'nullable|string',
            'items.*.pre_proc_conference' => 'nullable|boolean',
            'items.*.start_date' => 'nullable|string',
            'items.*.end_date' => 'nullable|string',
            'items.*.delivery_period' => 'nullable|string',
            'items.*.source_of_fund' => 'nullable|string',
            'items.*.estimated_budget' => 'required|numeric|min:0',
            'items.*.supporting_docs_text' => 'nullable|string',
            'items.*.remarks' => 'nullable|string',
        ]);

        DB::transaction(function () use ($ppmp, $validated, $user) {
            $oldValues = $ppmp->only(['title', 'plan_type', 'total_budget']);

            $sourceOfFund = $validated['source_of_fund'] ?? $ppmp->source_of_fund ?? 'General Fund';

            $isPol = array_key_exists('additional_condition', $validated)
                ? ($validated['additional_condition'] === 'POL Condition')
                : ($ppmp->additional_condition === 'POL Condition');

            $rawYear = trim($validated['fiscal_year']);
            $cleanFiscalYear = preg_match('/\b(20\d{2}|\d{4})\b/', $rawYear, $m) ? $m[1] : preg_replace('/^CY\s*/i', '', $rawYear);
            if (empty($cleanFiscalYear)) {
                $cleanFiscalYear = $ppmp->fiscal_year ?: (string) date('Y');
            }

            // If fiscal year changed or tracking number does not match the fiscal year, update tracking_number
            $trackingNumber = $ppmp->tracking_number;
            if ($cleanFiscalYear !== $ppmp->fiscal_year || !str_contains((string)$trackingNumber, "-{$cleanFiscalYear}-")) {
                if ($trackingNumber && preg_match('/^([A-Z0-9\-]+)-(\d{4})-(\d+)$/', $trackingNumber, $tnMatches)) {
                    $prefixBase = $tnMatches[1];
                    $seqPart = $tnMatches[3];
                    $candidateTrk = "{$prefixBase}-{$cleanFiscalYear}-{$seqPart}";
                    $alreadyTaken = Ppmp::where('tracking_number', $candidateTrk)->where('id', '!=', $ppmp->id)->exists();
                    if (!$alreadyTaken) {
                        $trackingNumber = $candidateTrk;
                    } else {
                        $trackerPrefix = "{$prefixBase}-{$cleanFiscalYear}-";
                        $existingTrackers = Ppmp::where('fiscal_year', $cleanFiscalYear)
                            ->where('tracking_number', 'like', "{$trackerPrefix}%")
                            ->where('id', '!=', $ppmp->id)
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
                    $trackingNumber = preg_replace('/-(\d{4})-/', "-{$cleanFiscalYear}-", (string)$trackingNumber);
                }

                // Also update any child amendments/supplementals to inherit the synchronized tracking number & fiscal year
                Ppmp::where('parent_id', $ppmp->id)->update([
                    'tracking_number' => $trackingNumber,
                    'fiscal_year' => $cleanFiscalYear,
                ]);
            }

            $ppmp->update([
                'tracking_number' => $trackingNumber,
                'ppmp_number' => isset($validated['ppmp_number']) && $validated['ppmp_number'] !== '' ? $validated['ppmp_number'] : $ppmp->ppmp_number,
                'implementing_unit' => array_key_exists('implementing_unit', $validated) ? $validated['implementing_unit'] : $ppmp->implementing_unit,
                'program_name' => array_key_exists('program_name', $validated) ? $validated['program_name'] : $ppmp->program_name,
                'title' => $validated['title'],
                'source_of_fund' => $sourceOfFund,
                'account_code' => $validated['account_code'] ?? $ppmp->account_code,
                'fiscal_year' => $cleanFiscalYear,
                'plan_type' => $validated['plan_type'],
                'delivery_period' => $isPol ? null : ($validated['delivery_period'] ?? $ppmp->delivery_period),
                'place_of_delivery' => $isPol ? null : ($validated['place_of_delivery'] ?? $ppmp->place_of_delivery),
                'payment_method' => $isPol ? null : ($validated['payment_method'] ?? $ppmp->payment_method),
                'additional_condition' => array_key_exists('additional_condition', $validated) ? $validated['additional_condition'] : $ppmp->additional_condition,
                'warranty_and_other_terms' => array_key_exists('warranty_and_other_terms', $validated) ? $validated['warranty_and_other_terms'] : $ppmp->warranty_and_other_terms,
            ]);

            // Replace items safely
            $ppmp->items()->delete();

            $total = 0;
            foreach ($validated['items'] as $index => $itemData) {
                $itemBudget = (float) $itemData['estimated_budget'];
                $total += $itemBudget;

                PpmpItem::create([
                    'ppmp_id' => $ppmp->id,
                    'item_no' => $index + 1,
                    'description' => $itemData['description'],
                    'project_type' => $itemData['project_type'] ?? 'Goods',
                    'quantity_size' => $itemData['quantity_size'] ?? '',
                    'procurement_mode' => $itemData['procurement_mode'] ?? 'Public Bidding',
                    'pre_proc_conference' => $itemBudget >= 5000000 ? true : (bool) ($itemData['pre_proc_conference'] ?? false),
                    'start_date' => $itemData['start_date'] ?? null,
                    'end_date' => $itemData['end_date'] ?? null,
                    'delivery_period' => $itemData['delivery_period'] ?? null,
                    'source_of_fund' => $itemData['source_of_fund'] ?? $sourceOfFund,
                    'estimated_budget' => $itemBudget,
                    'supporting_docs_text' => $itemData['supporting_docs_text'] ?? null,
                    'remarks' => $itemData['remarks'] ?? null,
                ]);
            }

            $ppmp->update(['total_budget' => $total]);

            // If a reviewer edited the PPMP, log the field-level change
            if (!$user->isEndUser()) {
                \App\Models\PpmpChangeLog::create([
                    'ppmp_id' => $ppmp->id,
                    'user_id' => $user->id,
                    'role' => $user->role,
                    'field_name' => 'items_and_specifications',
                    'old_value' => 'Old Total: ' . ($oldValues['total_budget'] ?? 0),
                    'new_value' => 'New Total: ' . $total,
                    'action' => 'reviewer_edit',
                ]);
            }

            AuditLog::log('PPMP_UPDATED', 'ppmps', $ppmp->id, $oldValues, ['total_budget' => $total], $user->id);

            // Automatically sync to Monitoring System so accurate real-time data is available
            try {
                \App\Models\MonitoringProject::syncFromPpmp($ppmp);
            } catch (\Throwable $e) {
                \Illuminate\Support\Facades\Log::warning('MonitoringProject sync failed: ' . $e->getMessage());
            }
        });

        return response()->json([
            'message' => 'PPMP updated successfully.',
            'ppmp' => $ppmp->fresh(['office', 'creator', 'items', 'signatures', 'attachments', 'routes']),
        ]);
    }

    /**
     * Store customized PPMP List of Attachment data
     */
    public function saveAttachmentList(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        // Check edit permission: Creator when in draft/head approved/returned, OR active reviewer in their stage, OR admin
        $isCreatorEditable = ($ppmp->created_by === $user->id) && in_array($ppmp->status, [
            'DRAFT',
            'HEAD_PENDING',
            'HEAD_APPROVED',
            'HEAD_RETURNED',
            'BUDGET_OFFICER_RETURNED',
            'PACCO_RETURNED',
            'OPPMO_RETURNED',
            'TWG_RETURNED'
        ]);

        $isReviewerEditable = (
            ($user->isHead() && in_array($ppmp->status, ['HEAD_PENDING', 'HEAD_APPROVED']) && $user->office_id === $ppmp->office_id) ||
            ($user->isBudgetOfficer() && $ppmp->status === 'BUDGET_OFFICER_REVIEW') ||
            ($user->isPacco() && $ppmp->status === 'PACCO_REVIEW') ||
            ($user->isOppmo() && $ppmp->status === 'OPPMO_REVIEW') ||
            ($user->isTwg() && $ppmp->status === 'TWG_REVIEW')
        );

        if (!$isCreatorEditable && !$isReviewerEditable && !$user->isAdmin()) {
            return response()->json([
                'message' => "PPMP List of Attachment is locked. Once submitted for review, only the authorized reviewer can modify it."
            ], 403);
        }

        // Enforce Amendment Scope restriction: if scope was PPMP_APP only, List of Attachment is locked
        if ($ppmp->amendment_scope === 'PPMP_APP' && !$user->isAdmin()) {
            return response()->json([
                'message' => "PPMP List of Attachment cannot be modified for this revision. The approved request scope is restricted to PPMP/APP procurement items only."
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

        // Merge with existing attachment_list_data if already present, preserving keys
        $existingData = is_array($ppmp->attachment_list_data) ? $ppmp->attachment_list_data : [];
        if (!empty($validated['attachment_lists'])) {
            $mergedLists = $existingData['attachment_lists'] ?? [];
            foreach ($validated['attachment_lists'] as $key => $listVal) {
                $mergedLists[$key] = $listVal;
            }
            $validated['attachment_lists'] = $mergedLists;
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

        AuditLog::log(
            'PPMP_ATTACHMENT_LIST_GENERATED',
            'ppmps',
            $ppmp->id,
            null,
            ['items_count' => count($validated['rows'] ?? [])],
            $user->id
        );

        return response()->json([
            'message' => 'PPMP List of Attachment saved successfully.',
            'ppmp' => $ppmp->fresh(['office.head', 'creator', 'items', 'signatures.user', 'attachments', 'routes']),
        ]);
    }

    /**
     * Save / Generate APP (Annual Procurement Plan) data for PPMP
     */
    public function saveAppData(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        $isTwgDone = $ppmp->twg_approved_at !== null || $ppmp->signatures()->where('role', 'twg')->exists();
        $isOppmoAuthorized = ($user->isOppmo() && $isTwgDone);

        if (!$isOppmoAuthorized && !$user->isAdmin()) {
            return response()->json([
                'message' => 'Only the OPPMO reviewer can generate or update the Annual Procurement Plan (APP) after BAC-TWG review is completed.'
            ], 403);
        }

        $validated = $request->validate([
            'fiscal_year' => 'nullable|string',
            'plan_version_type' => 'nullable|string', // INDICATIVE, FINAL, UPDATED
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

        $ppmp->update([
            'app_data' => $validated,
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
            'ppmp' => $ppmp->fresh(['office.head', 'creator', 'items', 'signatures.user', 'attachments', 'routes']),
        ]);
    }
}
