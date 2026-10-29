<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Office;
use App\Models\SupplierActivityLog;
use App\Models\SupplierAuthorize;
use App\Models\SupplierCriteriaScore;
use App\Models\SupplierDigitalApproval;
use App\Models\SupplierEvaluation;
use App\Models\SupplierEvaluationCriteria;
use App\Models\SupplierPdf;
use App\Models\SupplierPurchaseOrder;
use App\Models\SupplierRequest;
use App\Models\User;
use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Symfony\Component\HttpFoundation\StreamedResponse;

class SupplierEvaluationController extends Controller
{
    /**
     * Exact criteria weighted score map from Supplier_Evaluation
     */
    public const CRITERIA_WEIGHT_MAP = [
        1 => [4 => 20.0, 3 => 15.0, 2 => 10.0, 1 => 5.0],       // A. PRICE (20%)
        2 => [4 => 30.0, 3 => 22.5, 2 => 15.0, 1 => 7.5],       // B. QUALITY / SERVICE LEVEL (30%)
        3 => [4 => 25.0, 3 => 18.75, 2 => 12.5, 1 => 6.25],     // C. CUSTOMER CARE / AFTER SALES SERVICE (25%)
        4 => [4 => 25.0, 3 => 18.75, 2 => 12.5, 1 => 6.25],     // D. DELIVERY FULFILLMENT (25%)
    ];

    /**
     * Authorize access to the Supplier Evaluation System
     */
    protected function authorizeSupplierEvaluation(Request $request): User
    {
        $user = $request->user();
        if (!$user) {
            abort(response()->json(['message' => 'Unauthenticated.'], 401));
        }

        if (
            $user->isAdmin() ||
            $user->isPgso() ||
            $user->isPresentativeStaff() ||
            $user->canAccessSystem('/supplierevaluation')
        ) {
            return $user;
        }

        abort(response()->json([
            'message' => 'Forbidden. Your account is not authorized to access the Supplier Evaluation System.'
        ], 403));
    }

    /**
     * Map unified User role to Supplier Evaluation role
     */
    protected function getEffectiveRole(User $user): string
    {
        if ($user->isAdmin()) {
            return 'administrator';
        }
        if ($user->isPgso()) {
            return 'pgso';
        }
        if ($user->role === 'head') {
            return 'head';
        }
        if ($user->isPresentativeStaff()) {
            return 'presentative_staff';
        }
        return 'end_user';
    }

    /**
     * Compute weighted score (0 - 100%) from criteriaScores collection
     */
    public static function computeEvaluationScore($criteriaScores): float
    {
        $total = 0.0;
        foreach ($criteriaScores as $score) {
            $cId = (int) ($score->criteria_id ?? 0);
            $rating = (int) ($score->number_rating ?? 0);
            if (isset(self::CRITERIA_WEIGHT_MAP[$cId][$rating])) {
                $total += self::CRITERIA_WEIGHT_MAP[$cId][$rating];
            }
        }
        return round($total, 2);
    }

    /**
     * Log activity to supplier_activity_logs
     */
    protected function logActivity(
        Request $request,
        string $activity,
        ?string $description = null,
        string $status = 'success'
    ): void {
        $user = $request->user();
        if (!$user) {
            return;
        }

        SupplierActivityLog::create([
            'user_id' => $user->id,
            'activity' => $activity,
            'description' => $description,
            'role' => $this->getEffectiveRole($user),
            'status' => $status,
            'ip_address' => $request->ip(),
            'user_agent' => Str::limit((string) $request->userAgent(), 250),
        ]);
    }

    /**
     * Resolve Office matching end_user string (abbreviation, code, or name)
     */
    protected function resolveOfficeForEndUser(?string $endUser, ?int $fallbackOfficeId = null): ?Office
    {
        if ($endUser) {
            $clean = trim($endUser);
            $office = Office::whereRaw('LOWER(code) = ?', [strtolower($clean)])
                ->orWhereRaw('LOWER(name) = ?', [strtolower($clean)])
                ->first();
            if ($office) {
                return $office;
            }
        }
        if ($fallbackOfficeId) {
            return Office::find($fallbackOfficeId);
        }
        return Office::first();
    }

    /**
     * Scope a SupplierPurchaseOrder query to the user's assigned office (including subunit abbreviations)
     */
    protected function applyOfficeScopeToPoQuery($query, $user, bool $isGlobalScope)
    {
        if ($isGlobalScope || !$user->office) {
            return $query;
        }

        $code = strtoupper(trim($user->office->code ?? ''));
        $name = strtoupper(trim($user->office->name ?? ''));

        return $query->where(function ($q) use ($code, $name) {
            if ($code !== '') {
                $q->orWhereRaw('UPPER(TRIM(end_user)) = ?', [$code])
                  ->orWhereRaw('UPPER(TRIM(end_user)) LIKE ?', [$code . '-%'])
                  ->orWhereRaw('UPPER(TRIM(end_user)) LIKE ?', [$code . ' %']);
            }
            if ($name !== '') {
                $q->orWhereRaw('UPPER(TRIM(end_user)) = ?', [$name])
                  ->orWhereRaw('UPPER(TRIM(end_user)) LIKE ?', [$name . ' -%'])
                  ->orWhereRaw('UPPER(TRIM(end_user)) LIKE ?', [$name . ' %']);
            }
        });
    }

    /**
     * Initial dashboard bootstrap data & role-based counts
     */
    public function dashboardInit(Request $request): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);
        $role = $this->getEffectiveRole($user);
        $isGlobalScope = in_array($role, ['administrator', 'pgso'], true);

        $baseQuery = SupplierEvaluation::query()
            ->where(function ($q) {
                $q->where('delete_status', 0)->orWhereNull('delete_status');
            });

        if (!$isGlobalScope && $user->office_id) {
            $baseQuery->where('office_id', $user->office_id);
        }

        // Single grouped query for status counts
        $statusCounts = (clone $baseQuery)
            ->select('status', DB::raw('COUNT(*) as aggregate_count'))
            ->groupBy('status')
            ->pluck('aggregate_count', 'status');

        $deletedCount = SupplierEvaluation::where('delete_status', 1)->count();

        $requestsPendingQuery = SupplierRequest::where('status', 'pending');
        if (!in_array($role, ['administrator', 'pgso'], true)) {
            $requestsPendingQuery->where('user_id', $user->id);
        }
        $requestsPendingCount = $requestsPendingQuery->count();

        $poQuery = SupplierPurchaseOrder::query();
        $this->applyOfficeScopeToPoQuery($poQuery, $user, $isGlobalScope);
        $poTotalCount = $poQuery->count();

        $pdfsPendingCount = SupplierPdf::where('status', 'pending')->count();

        // Approved update/delete requests for this user or office
        $approvedRequests = SupplierRequest::where('status', 'approved')
            ->when(!$isGlobalScope, function ($q) use ($user) {
                $q->where('user_id', $user->id);
            })
            ->get(['id', 'evaluation_id', 'user_id', 'request_type', 'status']);

        $criteria = SupplierEvaluationCriteria::orderBy('id')->get();
        $offices = Office::orderBy('name')->get(['id', 'name', 'code', 'head_name', 'designation', 'responsibility_number'])
            ->map(function ($o) {
                $arr = $o->toArray();
                $arr['head'] = $o->head_name;
                return $arr;
            });

        // Scope available end users to the user's office for enduser role
        $endUserQuery = SupplierPurchaseOrder::whereNotNull('end_user')
            ->where('end_user', '!=', '');
        $this->applyOfficeScopeToPoQuery($endUserQuery, $user, $isGlobalScope);
        $endUsers = $endUserQuery->distinct()
            ->orderBy('end_user')
            ->pluck('end_user')
            ->values();

        if (!$isGlobalScope && $endUsers->isEmpty() && $user->office) {
            $endUsers = collect([$user->office->code, $user->office->name])->filter()->unique()->values();
        }

        // Scope available suppliers strictly to those having purchase orders with the user's office
        $supplierQuery = SupplierPurchaseOrder::whereNotNull('supplier')
            ->where('supplier', '!=', '');
        $this->applyOfficeScopeToPoQuery($supplierQuery, $user, $isGlobalScope);
        $suppliers = $supplierQuery->distinct()
            ->orderBy('supplier')
            ->pluck('supplier')
            ->values();

        $years = SupplierEvaluation::whereNotNull('period_year')
            ->distinct()
            ->orderByDesc('period_year')
            ->pluck('period_year')
            ->map(fn ($y) => (int) $y)
            ->values()
            ->toArray();

        $currentYear = (int) date('Y');
        if (!in_array($currentYear, $years, true)) {
            array_unshift($years, $currentYear);
        }

        // Approved authorization PDFs for Representative Staff / End User
        $approvedPdfs = SupplierPdf::with('user.office')
            ->where('status', 'approved')
            ->when(!$isGlobalScope && $user->office_id, function ($q) use ($user) {
                $q->whereHas('user', fn ($u) => $u->where('office_id', $user->office_id));
            })
            ->latest()
            ->get();

        return response()->json([
            'effective_role' => $role,
            'user' => $user->load('office'),
            'counts' => [
                'pending' => (int) ($statusCounts['pending'] ?? 0),
                'review' => (int) ($statusCounts['head review'] ?? 0),
                'approved' => (int) ($statusCounts['submitted'] ?? 0),
                'deleted' => $deletedCount,
                'requests_pending' => $requestsPendingCount,
                'po_total' => $poTotalCount,
                'pdfs_pending' => $pdfsPendingCount,
            ],
            'criteria' => $criteria,
            'offices' => $offices,
            'end_users' => $endUsers,
            'suppliers' => $suppliers,
            'years' => $years,
            'approved_requests' => $approvedRequests,
            'approved_pdfs' => $approvedPdfs,
        ]);
    }

    /**
     * List evaluations by status with role-based scoping & filters
     */
    public function evaluations(Request $request): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);
        $role = $this->getEffectiveRole($user);
        $isGlobalScope = in_array($role, ['administrator', 'pgso'], true);

        $status = $request->input('status', 'pending');

        $query = SupplierEvaluation::with([
            'office:id,name,code,head_name,designation,responsibility_number',
            'criteriaScores.criteria',
            'digitalApprovals.signer:id,name,email,role,designation,signature_path,office_id',
            'digitalApprovals.authorize.pdf',
            'requests',
        ])->where(function ($q) {
            $q->where('delete_status', 0)->orWhereNull('delete_status');
        });

        if ($status && $status !== 'all') {
            $query->where('status', $status);
        }

        if (!$isGlobalScope && $user->office_id) {
            $query->where('office_id', $user->office_id);
        }

        if ($request->filled('department') && $request->input('department') !== 'all') {
            $dept = trim($request->input('department'));
            $query->whereHas('office', function ($q) use ($dept) {
                $q->where('name', $dept)->orWhere('code', $dept);
            });
        }

        if ($request->filled('year') && $request->input('year') !== 'all') {
            $year = (int) $request->input('year');
            $query->where(function ($q) use ($year) {
                $q->where('period_year', $year)
                    ->orWhere('covered_period', 'like', "%{$year}%");
            });
        }

        if ($request->filled('search')) {
            $search = trim($request->input('search'));
            $query->where(function ($q) use ($search) {
                $q->where('po_no', 'like', "%{$search}%")
                    ->orWhere('supplier_name', 'like', "%{$search}%")
                    ->orWhere('covered_period', 'like', "%{$search}%")
                    ->orWhereHas('office', function ($oq) use ($search) {
                        $oq->where('name', 'like', "%{$search}%")
                            ->orWhere('code', 'like', "%{$search}%");
                    });
            });
        }

        $evaluations = $query->orderByDesc('updated_at')->orderByDesc('id')->get();

        // Batch-load PO records to avoid N+1 queries
        $poNos = $evaluations->pluck('po_no')->filter()->unique()->values()->toArray();
        $poMap = [];
        if (!empty($poNos)) {
            $pos = SupplierPurchaseOrder::whereIn('po_no', $poNos)->get();
            foreach ($pos as $po) {
                $poMap[$po->po_no] = $po;
            }
        }

        // Batch-load Office Head users by office_id
        $officeIds = $evaluations->pluck('office_id')->filter()->unique()->values()->toArray();
        $headUserMap = [];
        if (!empty($officeIds)) {
            $heads = User::where('role', 'head')->whereIn('office_id', $officeIds)->get();
            foreach ($heads as $h) {
                $headUserMap[$h->office_id] = $h;
            }
        }

        $minScore = $request->filled('min_score') ? (float) $request->input('min_score') : null;
        $maxScore = $request->filled('max_score') ? (float) $request->input('max_score') : null;

        $formatted = [];
        foreach ($evaluations as $eval) {
            $totalScore = self::computeEvaluationScore($eval->criteriaScores);

            if ($minScore !== null && $totalScore < $minScore) {
                continue;
            }
            if ($maxScore !== null && $totalScore > $maxScore) {
                continue;
            }

            $po = $poMap[$eval->po_no] ?? null;
            $officeHeadUser = $headUserMap[$eval->office_id] ?? null;

            $hasApprovedUpdate = $eval->requests->contains(function ($r) {
                return $r->status === 'approved' && strtolower($r->request_type ?? '') === 'update';
            });
            $hasApprovedDelete = $eval->requests->contains(function ($r) {
                return $r->status === 'approved' && strtolower($r->request_type ?? '') === 'delete';
            });
            $hasPendingRequest = $eval->requests->contains(fn ($r) => $r->status === 'pending');

            $evalArr = $eval->toArray();
            $evalArr['total_score'] = $totalScore;
            $evalArr['rating_status'] = $totalScore >= 60 ? 'Passed' : 'Failed';
            $evalArr['office_name'] = $eval->office->name ?? 'N/A';
            $evalArr['office_code'] = $eval->office->code ?? '';
            $evalArr['end_user'] = $po->end_user ?? ($eval->office->code ?: ($eval->office->name ?? 'N/A'));
            $evalArr['po_record'] = $po ? [
                'id' => $po->id,
                'po_no' => $po->po_no,
                'pr_no' => $po->pr_no,
                'item' => $po->item,
                'pdf_po' => $po->pdf_po,
                'has_pdf' => !empty($po->pdf_po),
                'pdf_url' => !empty($po->pdf_po) ? "/api/supplier-evaluation/purchase-orders/{$po->id}/pdf" : null,
                'end_user' => $po->end_user,
                'supplier' => $po->supplier,
                'status' => $po->status,
            ] : null;
            $evalArr['office_head_name'] = $officeHeadUser->name ?? ($eval->office->head_name ?? null);
            $evalArr['office_head_designation'] = $officeHeadUser->designation ?? ($eval->office->designation ?? null);
            $evalArr['has_approved_update_request'] = $hasApprovedUpdate;
            $evalArr['has_approved_delete_request'] = $hasApprovedDelete;
            $evalArr['has_pending_request'] = $hasPendingRequest;

            $formatted[] = $evalArr;
        }

        return response()->json([
            'data' => $formatted,
        ]);
    }

    /**
     * Show single evaluation details (for View / Evaluate / Print Form)
     */
    public function showEvaluation(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);

        $eval = SupplierEvaluation::with([
            'office',
            'criteriaScores.criteria',
            'digitalApprovals.signer:id,name,email,role,designation,signature_path,office_id',
            'digitalApprovals.authorize.pdf',
            'requests',
        ])->findOrFail($id);

        $po = SupplierPurchaseOrder::where('po_no', $eval->po_no)->first();
        $officeHead = User::where('role', 'head')->where('office_id', $eval->office_id)->first();

        $totalScore = self::computeEvaluationScore($eval->criteriaScores);

        $this->logActivity($request, 'View Evaluation', "Viewed evaluation ID {$eval->id} (PO No. {$eval->po_no}).");

        $data = $eval->toArray();
        $data['total_score'] = $totalScore;
        $data['rating_status'] = $totalScore >= 60 ? 'Passed' : 'Failed';
        $data['office_name'] = $eval->office->name ?? 'N/A';
        $data['office_code'] = $eval->office->code ?? '';
        $data['end_user'] = $po->end_user ?? ($eval->office->code ?: ($eval->office->name ?? 'N/A'));
        $data['po_record'] = $po ? [
            'id' => $po->id,
            'po_no' => $po->po_no,
            'pr_no' => $po->pr_no,
            'item' => $po->item,
            'pdf_po' => $po->pdf_po,
            'has_pdf' => !empty($po->pdf_po),
            'pdf_url' => !empty($po->pdf_po) ? "/api/supplier-evaluation/purchase-orders/{$po->id}/pdf" : null,
            'end_user' => $po->end_user,
            'supplier' => $po->supplier,
            'status' => $po->status,
        ] : null;
        $data['office_head_name'] = $officeHead->name ?? ($eval->office->head_name ?? null);
        $data['office_head_designation'] = $officeHead->designation ?? ($eval->office->designation ?? null);
        $data['office_head_id'] = $officeHead->id ?? null;

        return response()->json([
            'evaluation' => $data,
        ]);
    }

    /**
     * Create new evaluation (+ Evaluation modal or from PO List)
     */
    public function storeEvaluation(Request $request): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);

        $validated = $request->validate([
            'supplier_name' => 'required|string|max:255',
            'po_no' => 'required|string|max:255',
            'date_evaluation' => 'nullable|date',
            'covered_period' => 'required|string|max:255',
            'office_id' => 'nullable|integer|exists:offices,id',
            'end_user' => 'nullable|string|max:255',
        ]);
        $validated['date_evaluation'] = $validated['date_evaluation'] ?? now()->toDateString();

        $officeId = $validated['office_id'] ?? null;
        if (!$officeId) {
            $office = $this->resolveOfficeForEndUser($validated['end_user'] ?? null, $user->office_id);
            $officeId = $office?->id;
        }

        if (!$officeId) {
            return response()->json(['message' => 'Could not determine Office for this evaluation.'], 422);
        }

        // Extract 4-digit year from covered_period or date_evaluation
        $periodYear = (int) date('Y', strtotime($validated['date_evaluation']));
        if (preg_match('/(20\d{2})/', $validated['covered_period'], $matches)) {
            $periodYear = (int) $matches[1];
        }

        // Prevent duplicate active evaluation for the same PO No
        $existing = SupplierEvaluation::where('po_no', trim($validated['po_no']))
            ->where(function ($q) {
                $q->where('delete_status', 0)->orWhereNull('delete_status');
            })
            ->first();

        if ($existing) {
            return response()->json([
                'message' => "An active evaluation for P.O. No. {$validated['po_no']} already exists."
            ], 422);
        }

        $eval = DB::transaction(function () use ($validated, $officeId, $periodYear) {
            $evaluation = SupplierEvaluation::create([
                'supplier_name' => trim($validated['supplier_name']),
                'po_no' => trim($validated['po_no']),
                'date_evaluation' => $validated['date_evaluation'],
                'office_id' => $officeId,
                'covered_period' => trim($validated['covered_period']),
                'period_year' => $periodYear,
                'status' => 'pending',
                'delete_status' => 0,
            ]);

            // Update matching PO status to 'Added'
            $po = SupplierPurchaseOrder::where('po_no', trim($validated['po_no']))->first();
            if ($po) {
                $po->status = 'Added';
                if (!empty($validated['covered_period'])) {
                    $po->item = trim($validated['covered_period']);
                }
                $po->save();
            }

            return $evaluation;
        });

        $this->logActivity(
            $request,
            'Create Evaluation',
            "Created evaluation for PO {$eval->po_no} ({$eval->supplier_name})."
        );

        return response()->json([
            'message' => "Evaluation for P.O. {$eval->po_no} created successfully.",
            'evaluation' => $eval->load('office'),
        ], 201);
    }

    /**
     * Evaluate or Update an Evaluation (End User, Head, Representative Staff, Admin, PGSO)
     */
    public function evaluateOrUpdate(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);
        $role = $this->getEffectiveRole($user);

        $eval = SupplierEvaluation::with(['criteriaScores', 'digitalApprovals', 'requests'])->findOrFail($id);

        // If End User is updating an already reviewed/submitted evaluation, check for approved update request
        if ($role === 'end_user' && in_array($eval->status, ['head review', 'submitted'], true)) {
            $approvedRequest = SupplierRequest::where('evaluation_id', $eval->id)
                ->where('status', 'approved')
                ->whereRaw('LOWER(request_type) = ?', ['update'])
                ->first();

            if (!$approvedRequest) {
                return response()->json([
                    'message' => 'An approved Update Request from the Administrator is required to edit a submitted or reviewed evaluation.'
                ], 403);
            }
        }

        $ratings = $request->input('rating', []);
        $remarks = $request->input('remarks', []);

        DB::transaction(function () use ($request, $user, $role, $eval, $ratings, $remarks) {
            // Optional metadata updates (Admin / PGSO / End User)
            if ($request->filled('supplier_name')) {
                $eval->supplier_name = trim($request->input('supplier_name'));
            }
            if ($request->filled('po_no')) {
                $eval->po_no = trim($request->input('po_no'));
            }
            if ($request->filled('date_evaluation')) {
                $eval->date_evaluation = $request->input('date_evaluation');
            }
            if ($request->filled('covered_period')) {
                $eval->covered_period = trim($request->input('covered_period'));
                if (preg_match('/(20\d{2})/', $eval->covered_period, $m)) {
                    $eval->period_year = (int) $m[1];
                }
            }
            if ($request->filled('office_id')) {
                $eval->office_id = (int) $request->input('office_id');
            }

            // Save criteria ratings & remarks if provided
            if (is_array($ratings) && !empty($ratings)) {
                foreach ($ratings as $criteriaId => $numberRating) {
                    if ($numberRating === null || $numberRating === '') {
                        continue;
                    }
                    $remarkText = $remarks[$criteriaId] ?? null;
                    SupplierCriteriaScore::updateOrCreate(
                        [
                            'evaluation_id' => $eval->id,
                            'criteria_id' => (int) $criteriaId,
                        ],
                        [
                            'number_rating' => (int) $numberRating,
                            'remarks' => $remarkText !== '' ? $remarkText : null,
                        ]
                    );
                }
            }

            // Role-based status transitions & Digital Authorization records
            if ($role === 'head' && $eval->status === 'head review') {
                SupplierDigitalApproval::updateOrCreate(
                    [
                        'evaluation_id' => $eval->id,
                        'role' => 'Head',
                    ],
                    [
                        'signed_by' => $user->id,
                        'full_name' => $user->name,
                        'designation' => $user->designation ?? 'Department Head',
                        'image' => $request->input('captured_image'),
                        'updated_at' => now(),
                    ]
                );
                $eval->status = 'submitted';

                SupplierPurchaseOrder::where('po_no', $eval->po_no)->update(['status' => 'Approved']);
            } elseif ($role === 'presentative_staff' && $eval->status === 'head review') {
                // Link optional authorization PDF
                $authorizeId = null;
                if ($request->filled('pdf_id')) {
                    $authRecord = SupplierAuthorize::firstOrCreate([
                        'evaluation_id' => $eval->id,
                        'pdf_id' => (int) $request->input('pdf_id'),
                        'user_id' => $user->id,
                        'office_id' => $user->office_id ?? $eval->office_id,
                    ]);
                    $authorizeId = $authRecord->id;
                }

                SupplierDigitalApproval::updateOrCreate(
                    [
                        'evaluation_id' => $eval->id,
                        'role' => 'Representative Staff',
                    ],
                    [
                        'signed_by' => $user->id,
                        'authorize_id' => $authorizeId,
                        'full_name' => $user->name,
                        'designation' => $user->designation ?? 'Representative Staff',
                        'image' => $request->input('captured_image'),
                        'updated_at' => now(),
                    ]
                );
                $eval->status = 'submitted';

                SupplierPurchaseOrder::where('po_no', $eval->po_no)->update(['status' => 'Approved']);
            } else {
                // End User, PGSO, or Administrator evaluating/updating
                if ($eval->status === 'pending') {
                    SupplierDigitalApproval::updateOrCreate(
                        [
                            'evaluation_id' => $eval->id,
                            'role' => 'Prepared by',
                        ],
                        [
                            'signed_by' => $user->id,
                            'full_name' => $request->input('prepared_by_name', $user->name),
                            'designation' => $request->input('prepared_by_designation', $user->designation ?? 'Evaluator'),
                            'image' => $request->input('captured_image'),
                            'updated_at' => now(),
                        ]
                    );
                    $eval->status = 'head review';
                } elseif ($request->filled('approve_as_head') && $request->boolean('approve_as_head') && $role === 'administrator') {
                    SupplierDigitalApproval::updateOrCreate(
                        [
                            'evaluation_id' => $eval->id,
                            'role' => 'Head',
                        ],
                        [
                            'signed_by' => $user->id,
                            'full_name' => $user->name,
                            'designation' => $user->designation ?? 'Administrator',
                            'updated_at' => now(),
                        ]
                    );
                    $eval->status = 'submitted';
                    SupplierPurchaseOrder::where('po_no', $eval->po_no)->update(['status' => 'Approved']);
                }

                // Consume approved update request if End User edited a reviewed/submitted evaluation
                if ($role === 'end_user') {
                    SupplierRequest::where('evaluation_id', $eval->id)
                        ->where('status', 'approved')
                        ->whereRaw('LOWER(request_type) = ?', ['update'])
                        ->update([
                            'status' => 'completed',
                            'status_date' => now(),
                        ]);
                }
            }

            $eval->save();
        });

        $this->logActivity(
            $request,
            'Evaluate / Update Supplier',
            "Updated evaluation ID {$eval->id} (PO No. {$eval->po_no}, Status: {$eval->status})."
        );

        return response()->json([
            'message' => $eval->status === 'submitted'
                ? "Evaluation for P.O. {$eval->po_no} approved and submitted!"
                : "Evaluation for P.O. {$eval->po_no} saved successfully!",
            'evaluation' => $eval->fresh(['office', 'criteriaScores.criteria', 'digitalApprovals.signer']),
        ]);
    }

    /**
     * Get distinct suppliers available for Bulk Evaluation based on role
     */
    public function getBulkSuppliers(Request $request): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);
        $role = $this->getEffectiveRole($user);
        $isGlobalScope = in_array($role, ['administrator', 'pgso'], true);

        $targetStatus = in_array($role, ['head', 'presentative_staff'], true) ? 'head review' : 'pending';

        $query = SupplierEvaluation::query()
            ->where('status', $targetStatus)
            ->where(function ($q) {
                $q->where('delete_status', 0)->orWhereNull('delete_status');
            });

        if (!$isGlobalScope && $user->office_id) {
            $query->where('office_id', $user->office_id);
        }

        $suppliers = $query->select('supplier_name', DB::raw('COUNT(*) as po_count'))
            ->groupBy('supplier_name')
            ->orderBy('supplier_name')
            ->get();

        return response()->json([
            'target_status' => $targetStatus,
            'suppliers' => $suppliers,
        ]);
    }

    /**
     * Fetch evaluations for a selected supplier in Bulk Evaluation workspace
     */
    public function fetchBulkEvaluations(Request $request): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);
        $role = $this->getEffectiveRole($user);
        $isGlobalScope = in_array($role, ['administrator', 'pgso'], true);

        $supplierName = trim((string) $request->input('supplier_name', ''));
        $targetStatus = in_array($role, ['head', 'presentative_staff'], true) ? 'head review' : 'pending';

        $query = SupplierEvaluation::with(['office', 'criteriaScores', 'digitalApprovals.signer'])
            ->where('status', $targetStatus)
            ->where(function ($q) {
                $q->where('delete_status', 0)->orWhereNull('delete_status');
            });

        if ($supplierName !== '') {
            $query->where('supplier_name', $supplierName);
        }

        if (!$isGlobalScope && $user->office_id) {
            $query->where('office_id', $user->office_id);
        }

        $evaluations = $query->orderBy('po_no')->get();

        // Batch-load PO records
        $poNos = $evaluations->pluck('po_no')->filter()->unique()->values()->toArray();
        $poMap = [];
        if (!empty($poNos)) {
            foreach (SupplierPurchaseOrder::whereIn('po_no', $poNos)->get() as $po) {
                $poMap[$po->po_no] = $po;
            }
        }

        $data = $evaluations->map(function ($eval) use ($poMap) {
            $po = $poMap[$eval->po_no] ?? null;
            $scoresMap = [];
            $remarksMap = [];
            foreach ($eval->criteriaScores as $cs) {
                $scoresMap[$cs->criteria_id] = $cs->number_rating;
                $remarksMap[$cs->criteria_id] = $cs->remarks;
            }

            return [
                'id' => $eval->id,
                'po_no' => $eval->po_no,
                'pr_no' => $po->pr_no ?? null,
                'supplier_name' => $eval->supplier_name,
                'covered_period' => $eval->covered_period,
                'date_evaluation' => $eval->date_evaluation?->format('Y-m-d'),
                'office_id' => $eval->office_id,
                'office_name' => $eval->office->name ?? 'N/A',
                'status' => $eval->status,
                'total_score' => self::computeEvaluationScore($eval->criteriaScores),
                'has_pdf' => !empty($po?->pdf_po),
                'pdf_url' => !empty($po?->pdf_po) ? "/api/supplier-evaluation/purchase-orders/{$po->id}/pdf" : null,
                'scores' => $scoresMap,
                'remarks' => $remarksMap,
            ];
        });

        return response()->json([
            'evaluations' => $data,
        ]);
    }

    /**
     * Submit Bulk Evaluations (End User / Admin / Head / Representative Staff)
     */
    public function submitBulkEvaluations(Request $request): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);
        $role = $this->getEffectiveRole($user);

        $validated = $request->validate([
            'evaluations' => 'required|array|min:1',
            'evaluations.*.id' => 'required|integer|exists:supplier_evaluations,id',
            'evaluations.*.ratings' => 'nullable|array',
            'evaluations.*.remarks' => 'nullable|array',
        ]);

        $count = 0;

        DB::transaction(function () use ($validated, $user, $role, &$count) {
            foreach ($validated['evaluations'] as $item) {
                $eval = SupplierEvaluation::find($item['id']);
                if (!$eval) {
                    continue;
                }

                $ratings = $item['ratings'] ?? [];
                $remarks = $item['remarks'] ?? [];

                foreach ($ratings as $criteriaId => $numRating) {
                    if ($numRating === null || $numRating === '') {
                        continue;
                    }
                    SupplierCriteriaScore::updateOrCreate(
                        [
                            'evaluation_id' => $eval->id,
                            'criteria_id' => (int) $criteriaId,
                        ],
                        [
                            'number_rating' => (int) $numRating,
                            'remarks' => !empty($remarks[$criteriaId]) ? $remarks[$criteriaId] : null,
                        ]
                    );
                }

                if ($role === 'head') {
                    SupplierDigitalApproval::updateOrCreate(
                        ['evaluation_id' => $eval->id, 'role' => 'Head'],
                        [
                            'signed_by' => $user->id,
                            'full_name' => $user->name,
                            'designation' => $user->designation ?? 'Department Head',
                            'updated_at' => now(),
                        ]
                    );
                    $eval->status = 'submitted';
                    SupplierPurchaseOrder::where('po_no', $eval->po_no)->update(['status' => 'Approved']);
                } elseif ($role === 'presentative_staff') {
                    SupplierDigitalApproval::updateOrCreate(
                        ['evaluation_id' => $eval->id, 'role' => 'Representative Staff'],
                        [
                            'signed_by' => $user->id,
                            'full_name' => $user->name,
                            'designation' => $user->designation ?? 'Representative Staff',
                            'updated_at' => now(),
                        ]
                    );
                    $eval->status = 'submitted';
                    SupplierPurchaseOrder::where('po_no', $eval->po_no)->update(['status' => 'Approved']);
                } else {
                    SupplierDigitalApproval::updateOrCreate(
                        ['evaluation_id' => $eval->id, 'role' => 'Prepared by'],
                        [
                            'signed_by' => $user->id,
                            'full_name' => $user->name,
                            'designation' => $user->designation ?? 'Evaluator',
                            'updated_at' => now(),
                        ]
                    );
                    $eval->status = 'head review';
                }

                $eval->save();
                $count++;
            }
        });

        $this->logActivity(
            $request,
            'Bulk Evaluation Submitted',
            "Processed {$count} evaluation(s) via Bulk Evaluation."
        );

        return response()->json([
            'message' => "Successfully processed {$count} supplier evaluation(s)!",
            'processed_count' => $count,
        ]);
    }

    /**
     * Soft-delete evaluation (Move to Recycle Bin)
     */
    public function destroyEvaluation(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);
        $role = $this->getEffectiveRole($user);

        $eval = SupplierEvaluation::findOrFail($id);

        if (!in_array($role, ['administrator', 'pgso'], true)) {
            $approvedDel = SupplierRequest::where('evaluation_id', $eval->id)
                ->where('status', 'approved')
                ->whereRaw('LOWER(request_type) = ?', ['delete'])
                ->first();

            if (!$approvedDel) {
                return response()->json([
                    'message' => 'An approved Delete Request from the Administrator is required to delete this evaluation.'
                ], 403);
            }

            $approvedDel->update(['status' => 'completed', 'status_date' => now()]);
        }

        $eval->delete_status = 1;
        $eval->save();

        // Reset PO status to Pending so it can be re-evaluated if needed
        SupplierPurchaseOrder::where('po_no', $eval->po_no)->update(['status' => 'Pending']);

        $this->logActivity(
            $request,
            'Recycle Evaluation',
            "Moved evaluation with PO No. {$eval->po_no} to the recycle bin."
        );

        return response()->json([
            'message' => "Evaluation for P.O. {$eval->po_no} moved to Recycle Bin.",
        ]);
    }

    /**
     * List Recycle Bin evaluations
     */
    public function recycleBin(Request $request): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);
        $role = $this->getEffectiveRole($user);

        if (!in_array($role, ['administrator', 'pgso'], true)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $deleted = SupplierEvaluation::with(['office', 'criteriaScores'])
            ->where('delete_status', 1)
            ->orderByDesc('updated_at')
            ->get()
            ->map(function ($eval) {
                return [
                    'id' => $eval->id,
                    'po_no' => $eval->po_no,
                    'supplier_name' => $eval->supplier_name,
                    'office_name' => $eval->office->name ?? 'N/A',
                    'covered_period' => $eval->covered_period,
                    'date_evaluation' => $eval->date_evaluation?->format('Y-m-d'),
                    'status' => $eval->status,
                    'total_score' => self::computeEvaluationScore($eval->criteriaScores),
                    'updated_at' => $eval->updated_at?->toDateTimeString(),
                ];
            });

        return response()->json(['data' => $deleted]);
    }

    /**
     * Restore soft-deleted evaluation from Recycle Bin
     */
    public function restoreEvaluation(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);
        $role = $this->getEffectiveRole($user);

        if (!in_array($role, ['administrator', 'pgso'], true)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $eval = SupplierEvaluation::findOrFail($id);
        $eval->delete_status = 0;
        $eval->save();

        SupplierPurchaseOrder::where('po_no', $eval->po_no)->update([
            'status' => $eval->status === 'submitted' ? 'Approved' : 'Added',
        ]);

        $this->logActivity(
            $request,
            'Restore Evaluation',
            "Restored evaluation with PO No. {$eval->po_no}."
        );

        return response()->json([
            'message' => "Evaluation for P.O. {$eval->po_no} restored successfully.",
        ]);
    }

    /**
     * Permanently delete evaluation from Recycle Bin
     */
    public function forceDeleteEvaluation(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);
        $role = $this->getEffectiveRole($user);

        if (!in_array($role, ['administrator', 'pgso'], true)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $eval = SupplierEvaluation::findOrFail($id);
        $poNo = $eval->po_no;

        SupplierPurchaseOrder::where('po_no', $poNo)->update(['status' => 'Pending']);
        $eval->delete();

        $this->logActivity(
            $request,
            'Permanent Delete',
            "Permanently deleted evaluation with PO No. {$poNo}."
        );

        return response()->json([
            'message' => "Evaluation for P.O. {$poNo} permanently deleted.",
        ]);
    }

    /**
     * Paginated Purchase Orders list with search & PDF sorting
     */
    public function purchaseOrders(Request $request): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);
        $role = $this->getEffectiveRole($user);
        $isGlobalScope = in_array($role, ['administrator', 'pgso'], true);

        $query = SupplierPurchaseOrder::query();

        // Scope to user's office if not administrator/pgso
        $this->applyOfficeScopeToPoQuery($query, $user, $isGlobalScope);

        if ($request->filled('search')) {
            $search = trim($request->input('search'));
            $query->where(function ($q) use ($search) {
                $q->where('po_no', 'like', "%{$search}%")
                    ->orWhere('pr_no', 'like', "%{$search}%")
                    ->orWhere('supplier', 'like', "%{$search}%")
                    ->orWhere('end_user', 'like', "%{$search}%")
                    ->orWhere('status', 'like', "%{$search}%");
            });
        }

        if ($request->filled('status') && $request->input('status') !== 'all') {
            $query->where('status', $request->input('status'));
        }

        $pdfSort = $request->input('pdf_sort');
        if ($pdfSort === 'has_pdf') {
            $query->orderByRaw("CASE WHEN pdf_po IS NOT NULL AND pdf_po != '' THEN 0 ELSE 1 END");
        } elseif ($pdfSort === 'no_pdf') {
            $query->orderByRaw("CASE WHEN pdf_po IS NULL OR pdf_po = '' THEN 0 ELSE 1 END");
        }

        $perPage = min(max((int) $request->input('per_page', 15), 5), 100);
        $paginated = $query->orderByDesc('id')->paginate($perPage);

        $items = collect($paginated->items())->map(function ($po) {
            return [
                'id' => $po->id,
                'po_no' => $po->po_no,
                'pr_no' => $po->pr_no,
                'item' => $po->item,
                'pdf_po' => $po->pdf_po,
                'has_pdf' => !empty($po->pdf_po),
                'pdf_url' => !empty($po->pdf_po) ? "/api/supplier-evaluation/purchase-orders/{$po->id}/pdf" : null,
                'end_user' => $po->end_user,
                'supplier' => $po->supplier,
                'status' => $po->status ?: 'Pending',
                'created_at' => $po->created_at?->toDateTimeString(),
                'updated_at' => $po->updated_at?->toDateTimeString(),
            ];
        });

        return response()->json([
            'data' => $items,
            'current_page' => $paginated->currentPage(),
            'last_page' => $paginated->lastPage(),
            'total' => $paginated->total(),
            'per_page' => $paginated->perPage(),
        ]);
    }

    /**
     * Store a new Purchase Order
     */
    public function storePurchaseOrder(Request $request): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);

        $validated = $request->validate([
            'po_no' => 'required|string|max:255',
            'pr_no' => 'nullable|string|max:255',
            'item' => 'nullable|string|max:255',
            'end_user' => 'required|string|max:255',
            'supplier' => 'required|string|max:255',
            'status' => 'nullable|string|max:50',
            'pdf_po' => 'nullable|file|mimes:pdf|max:30720',
        ]);

        if (SupplierPurchaseOrder::where('po_no', trim($validated['po_no']))->exists()) {
            return response()->json([
                'message' => "Purchase Order {$validated['po_no']} already exists."
            ], 422);
        }

        $pdfPath = null;
        if ($request->hasFile('pdf_po')) {
            $file = $request->file('pdf_po');
            $filename = time() . '_' . preg_replace('/[^A-Za-z0-9_\-\.]/', '_', $validated['po_no']) . '.pdf';
            $pdfPath = 'private/' . $file->storeAs('po_pdf', $filename, 'local');
        }

        $po = SupplierPurchaseOrder::create([
            'po_no' => trim($validated['po_no']),
            'pr_no' => !empty($validated['pr_no']) ? trim($validated['pr_no']) : null,
            'item' => !empty($validated['item']) ? trim($validated['item']) : null,
            'pdf_po' => $pdfPath,
            'end_user' => strtoupper(trim($validated['end_user'])),
            'supplier' => trim($validated['supplier']),
            'status' => $validated['status'] ?? 'Pending',
        ]);

        $this->logActivity(
            $request,
            'Create Purchase Order',
            "Created Purchase Order {$po->po_no}"
        );

        return response()->json([
            'message' => "Purchase Order {$po->po_no} created successfully.",
            'purchase_order' => $po,
        ], 201);
    }

    /**
     * Update an existing Purchase Order (and sync linked Evaluation)
     */
    public function updatePurchaseOrder(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);
        $role = $this->getEffectiveRole($user);

        if (!in_array($role, ['administrator', 'pgso'], true)) {
            return response()->json(['message' => 'Only Administrators can edit Purchase Orders.'], 403);
        }

        $po = SupplierPurchaseOrder::findOrFail($id);
        $oldPoNo = $po->po_no;
        $oldStatus = $po->status;

        $validated = $request->validate([
            'po_no' => 'required|string|max:255',
            'pr_no' => 'nullable|string|max:255',
            'item' => 'nullable|string|max:255',
            'end_user' => 'required|string|max:255',
            'supplier' => 'required|string|max:255',
            'status' => 'required|string|max:50',
            'remove_pdf' => 'nullable',
            'pdf_po' => 'nullable|file|mimes:pdf|max:30720',
        ]);

        $pdfNote = '';
        if ($request->input('remove_pdf') == '1') {
            $po->pdf_po = null;
            $pdfNote = ' | PDF removed';
        }

        if ($request->hasFile('pdf_po')) {
            $file = $request->file('pdf_po');
            $filename = time() . '_' . preg_replace('/[^A-Za-z0-9_\-\.]/', '_', $validated['po_no']) . '.pdf';
            $po->pdf_po = 'private/' . $file->storeAs('po_pdf', $filename, 'local');
            $pdfNote = ' | PDF replaced';
        }

        $po->po_no = trim($validated['po_no']);
        $po->pr_no = !empty($validated['pr_no']) ? trim($validated['pr_no']) : null;
        $po->item = !empty($validated['item']) ? trim($validated['item']) : null;
        $po->end_user = strtoupper(trim($validated['end_user']));
        $po->supplier = trim($validated['supplier']);
        $po->status = $validated['status'];
        $po->save();

        // Sync linked evaluation if PO number, supplier, or covered period changed
        $eval = SupplierEvaluation::where('po_no', $oldPoNo)->first();
        if ($eval) {
            $eval->po_no = $po->po_no;
            $eval->supplier_name = $po->supplier;
            if (!empty($po->item)) {
                $eval->covered_period = $po->item;
            }
            $office = $this->resolveOfficeForEndUser($po->end_user, $eval->office_id);
            if ($office) {
                $eval->office_id = $office->id;
            }
            $eval->save();
        }

        $this->logActivity(
            $request,
            'Update Purchase Order',
            "Updated PO {$po->po_no} (Status: {$oldStatus} → {$po->status}{$pdfNote})"
        );

        return response()->json([
            'message' => "Purchase Order {$po->po_no} updated successfully.",
            'purchase_order' => $po,
        ]);
    }

    /**
     * Delete a Purchase Order
     */
    public function destroyPurchaseOrder(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);
        $role = $this->getEffectiveRole($user);

        if (!in_array($role, ['administrator', 'pgso'], true)) {
            return response()->json(['message' => 'Only Administrators can delete Purchase Orders.'], 403);
        }

        $po = SupplierPurchaseOrder::findOrFail($id);
        $poNo = $po->po_no;
        $po->delete();

        $this->logActivity($request, 'Delete Purchase Order', "Deleted PO {$poNo}.");

        return response()->json([
            'message' => "Purchase Order {$poNo} deleted successfully.",
        ]);
    }

    /**
     * Upload PDF for a Purchase Order directly from the PO List table
     */
    public function uploadPurchaseOrderPdf(Request $request, int $id): JsonResponse
    {
        $this->authorizeSupplierEvaluation($request);

        $request->validate([
            'pdf_po' => 'required|file|mimes:pdf|max:30720',
        ]);

        $po = SupplierPurchaseOrder::findOrFail($id);
        $file = $request->file('pdf_po');
        $filename = time() . '_' . preg_replace('/[^A-Za-z0-9_\-\.]/', '_', $po->po_no ?: (string) $po->id) . '.pdf';
        $po->pdf_po = 'private/' . $file->storeAs('po_pdf', $filename, 'local');
        $po->save();

        $this->logActivity(
            $request,
            'Upload Purchase Order PDF',
            "Uploaded PDF for PO {$po->po_no}"
        );

        return response()->json([
            'message' => "PDF uploaded for Purchase Order {$po->po_no}.",
            'pdf_url' => "/api/supplier-evaluation/purchase-orders/{$po->id}/pdf",
        ]);
    }

    /**
     * Serve Purchase Order PDF with fallback to legacy Supplier_Evaluation storage
     */
    public function viewPurchaseOrderPdf(Request $request, int $id): BinaryFileResponse|JsonResponse
    {
        $this->authorizeSupplierEvaluation($request);

        $po = SupplierPurchaseOrder::findOrFail($id);
        if (!$po->pdf_po) {
            return response()->json(['message' => 'No PDF uploaded for this Purchase Order.'], 404);
        }

        $relativePath = ltrim($po->pdf_po, '/');
        // Strip leading "private/" when checking Laravel 'local' disk (root is storage/app/private)
        $localDiskRelative = preg_replace('#^private/#', '', $relativePath);

        $candidates = [
            Storage::disk('local')->path($localDiskRelative),
            storage_path('app/' . $relativePath),
            storage_path('app/private/' . $localDiskRelative),
            'C:/xampp/htdocs/finalize_system/Supplier_Evaluation/storage/app/' . $relativePath,
            'C:/xampp/htdocs/finalize_system/Supplier_Evaluation/storage/app/private/' . $localDiskRelative,
        ];

        $resolvedPath = null;
        foreach ($candidates as $candidate) {
            if ($candidate && file_exists($candidate) && is_file($candidate)) {
                $resolvedPath = $candidate;
                break;
            }
        }

        if (!$resolvedPath) {
            return response()->json(['message' => 'PDF file not found on disk.'], 404);
        }

        return response()->file($resolvedPath, [
            'Content-Type' => 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . basename($resolvedPath) . '"',
        ]);
    }

    /**
     * Import Purchase Orders from CSV or Excel (.xlsx / .csv)
     */
    public function importPurchaseOrders(Request $request): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);
        $role = $this->getEffectiveRole($user);

        if (!in_array($role, ['administrator', 'pgso'], true)) {
            return response()->json(['message' => 'Only Administrators can import Purchase Orders.'], 403);
        }

        $request->validate([
            'file' => 'required|file|max:20480',
        ]);

        $file = $request->file('file');
        $ext = strtolower($file->getClientOriginalExtension());

        $rows = [];
        if ($ext === 'csv' || $ext === 'txt') {
            $handle = fopen($file->getRealPath(), 'r');
            if ($handle !== false) {
                $headers = null;
                while (($data = fgetcsv($handle, 0, ',')) !== false) {
                    if (!$headers) {
                        $headers = array_map(fn ($h) => strtolower(trim(preg_replace('/[\x00-\x1F\x80-\xFF]/', '', (string) $h))), $data);
                        continue;
                    }
                    $rowAssoc = [];
                    foreach ($headers as $idx => $key) {
                        $rowAssoc[$key] = $data[$idx] ?? null;
                    }
                    $rows[] = $rowAssoc;
                }
                fclose($handle);
            }
        } elseif ($ext === 'xlsx') {
            $rows = $this->parseSimpleXlsx($file->getRealPath());
        } else {
            return response()->json(['message' => 'Unsupported file format. Please upload a .csv or .xlsx file.'], 422);
        }

        $inserted = 0;
        $duplicates = [];

        foreach ($rows as $row) {
            $poNo = trim((string) ($row['po_no'] ?? $row['po number'] ?? $row['po'] ?? ''));
            $supplier = trim((string) ($row['supplier'] ?? $row['supplier_name'] ?? ''));
            $endUser = strtoupper(trim((string) ($row['end_user'] ?? $row['end user'] ?? $row['department'] ?? '')));
            $prNo = trim((string) ($row['pr_no'] ?? $row['pr number'] ?? $row['pr'] ?? ''));

            if ($poNo === '' || $supplier === '') {
                continue;
            }

            if (SupplierPurchaseOrder::where('po_no', $poNo)->exists()) {
                $duplicates[] = $poNo;
                continue;
            }

            SupplierPurchaseOrder::create([
                'po_no' => $poNo,
                'pr_no' => $prNo !== '' ? $prNo : null,
                'end_user' => $endUser !== '' ? $endUser : 'NA',
                'supplier' => $supplier,
                'status' => 'Pending',
            ]);
            $inserted++;
        }

        $this->logActivity(
            $request,
            'Import Purchase Orders',
            "Imported {$inserted} POs (" . count($duplicates) . " duplicates skipped)."
        );

        return response()->json([
            'message' => "Imported {$inserted} Purchase Order(s) successfully." . (count($duplicates) > 0 ? ' Skipped ' . count($duplicates) . ' duplicate(s).' : ''),
            'inserted' => $inserted,
            'duplicates' => $duplicates,
        ]);
    }

    /**
     * Lightweight native XLSX reader using ZipArchive + SimpleXML
     */
    protected function parseSimpleXlsx(string $filePath): array
    {
        if (!class_exists(\ZipArchive::class)) {
            return [];
        }
        $zip = new \ZipArchive();
        if ($zip->open($filePath) !== true) {
            return [];
        }

        $sharedStrings = [];
        if (($xmlStrings = $zip->getFromName('xl/sharedStrings.xml')) !== false) {
            $sxe = @simplexml_load_string($xmlStrings);
            if ($sxe && isset($sxe->si)) {
                foreach ($sxe->si as $si) {
                    if (isset($si->t)) {
                        $sharedStrings[] = (string) $si->t;
                    } elseif (isset($si->r)) {
                        $text = '';
                        foreach ($si->r as $run) {
                            $text .= (string) $run->t;
                        }
                        $sharedStrings[] = $text;
                    } else {
                        $sharedStrings[] = '';
                    }
                }
            }
        }

        $rows = [];
        if (($xmlSheet = $zip->getFromName('xl/worksheets/sheet1.xml')) !== false) {
            $sxe = @simplexml_load_string($xmlSheet);
            if ($sxe && isset($sxe->sheetData->row)) {
                $headers = null;
                foreach ($sxe->sheetData->row as $row) {
                    $rowVals = [];
                    foreach ($row->c as $c) {
                        $type = (string) $c['t'];
                        $val = (string) $c->v;
                        if ($type === 's') {
                            $val = $sharedStrings[(int) $val] ?? '';
                        } elseif ($type === 'inlineStr' && isset($c->is->t)) {
                            $val = (string) $c->is->t;
                        }
                        $rowVals[] = $val;
                    }
                    if (!$headers) {
                        $headers = array_map(fn ($h) => strtolower(trim((string) $h)), $rowVals);
                        continue;
                    }
                    $assoc = [];
                    foreach ($headers as $idx => $key) {
                        if ($key !== '') {
                            $assoc[$key] = $rowVals[$idx] ?? null;
                        }
                    }
                    $rows[] = $assoc;
                }
            }
        }

        $zip->close();
        return $rows;
    }

    /**
     * Get available Pending POs for Bulk Add Evaluation modal (pobulk)
     */
    public function bulkPoList(Request $request): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);
        $role = $this->getEffectiveRole($user);
        $isGlobalScope = in_array($role, ['administrator', 'pgso'], true);

        $query = SupplierPurchaseOrder::where(function ($q) {
            $q->where('status', 'Pending')->orWhereNull('status');
        });

        // Strictly enforce office scope for end_user and non-global roles
        $this->applyOfficeScopeToPoQuery($query, $user, $isGlobalScope);

        if ($request->filled('end_user')) {
            $query->where('end_user', $request->input('end_user'));
        }

        if ($request->filled('supplier')) {
            $query->where('supplier', $request->input('supplier'));
        }

        $pos = $query->orderByDesc('id')->limit(300)->get();

        // Also fetch available scoped suppliers & end-user units for the modal filter dropdowns
        $scopedSupplierQuery = SupplierPurchaseOrder::where(function ($q) {
            $q->where('status', 'Pending')->orWhereNull('status');
        })->whereNotNull('supplier')->where('supplier', '!=', '');
        $this->applyOfficeScopeToPoQuery($scopedSupplierQuery, $user, $isGlobalScope);
        if ($request->filled('end_user')) {
            $scopedSupplierQuery->where('end_user', $request->input('end_user'));
        }
        $availableSuppliers = $scopedSupplierQuery->distinct()->orderBy('supplier')->pluck('supplier')->values();

        $scopedEndUserQuery = SupplierPurchaseOrder::where(function ($q) {
            $q->where('status', 'Pending')->orWhereNull('status');
        })->whereNotNull('end_user')->where('end_user', '!=', '');
        $this->applyOfficeScopeToPoQuery($scopedEndUserQuery, $user, $isGlobalScope);
        $availableEndUsers = $scopedEndUserQuery->distinct()->orderBy('end_user')->pluck('end_user')->values();

        if (!$isGlobalScope && $availableEndUsers->isEmpty() && $user->office) {
            $availableEndUsers = collect([$user->office->code, $user->office->name])->filter()->unique()->values();
        }

        return response()->json([
            'data' => $pos,
            'suppliers' => $availableSuppliers,
            'end_users' => $availableEndUsers,
            'office' => $user->office ? [
                'id' => $user->office->id,
                'name' => $user->office->name,
                'code' => $user->office->code,
            ] : null,
        ]);
    }

    /**
     * Store Bulk PO Evaluations (from Bulk Add Evaluate modal)
     */
    public function storeBulkPoEvaluations(Request $request): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);

        $validated = $request->validate([
            'po_ids' => 'required|array|min:1',
            'po_ids.*' => 'integer|exists:supplier_purchase_orders,id',
            'covered_period' => 'nullable|string|max:255',
        ]);

        $defaultPeriod = $validated['covered_period'] ?? ('CY ' . date('Y'));
        $periodYear = (int) date('Y');
        if (preg_match('/(20\d{2})/', $defaultPeriod, $m)) {
            $periodYear = (int) $m[1];
        }

        $createdCount = 0;

        DB::transaction(function () use ($validated, $user, $request, $defaultPeriod, $periodYear, &$createdCount) {
            $pos = SupplierPurchaseOrder::whereIn('id', $validated['po_ids'])->get();
            foreach ($pos as $po) {
                $exists = SupplierEvaluation::where('po_no', $po->po_no)
                    ->where(function ($q) {
                        $q->where('delete_status', 0)->orWhereNull('delete_status');
                    })
                    ->exists();

                if ($exists) {
                    $po->update(['status' => 'Added']);
                    continue;
                }

                $office = $this->resolveOfficeForEndUser($po->end_user, $user->office_id);
                if (!$office) {
                    continue;
                }

                SupplierEvaluation::create([
                    'supplier_name' => $po->supplier,
                    'po_no' => $po->po_no,
                    'date_evaluation' => now()->toDateString(),
                    'office_id' => $office->id,
                    'covered_period' => $po->item ?: $defaultPeriod,
                    'period_year' => $periodYear,
                    'status' => 'pending',
                    'delete_status' => 0,
                ]);

                $po->update(['status' => 'Added']);
                $createdCount++;

                $this->logActivity(
                    $request,
                    'Bulk PO Evaluation Created',
                    "Created evaluation for PO No. {$po->po_no}."
                );
            }
        });

        return response()->json([
            'message' => "Added {$createdCount} Purchase Order(s) to Pending Evaluations!",
            'created_count' => $createdCount,
        ]);
    }

    /**
     * List Requests (Update / Delete requests from End Users)
     */
    public function listRequests(Request $request): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);
        $role = $this->getEffectiveRole($user);
        $isGlobalScope = in_array($role, ['administrator', 'pgso'], true);

        $query = SupplierRequest::with(['evaluation.office', 'user.office']);

        if (!$isGlobalScope) {
            $query->where('user_id', $user->id);
        }

        $requests = $query->orderByDesc('created_at')->get()->map(function ($r) {
            return [
                'id' => $r->id,
                'evaluation_id' => $r->evaluation_id,
                'po_no' => $r->evaluation->po_no ?? 'N/A',
                'supplier_name' => $r->evaluation->supplier_name ?? 'N/A',
                'office_name' => $r->evaluation->office->name ?? ($r->user->office->name ?? 'N/A'),
                'user_id' => $r->user_id,
                'user_name' => $r->user->name ?? 'Unknown',
                'request_type' => $r->request_type,
                'reason' => $r->reason,
                'status' => $r->status,
                'request_date' => $r->request_date?->toDateTimeString() ?? $r->created_at?->toDateTimeString(),
                'status_date' => $r->status_date?->toDateTimeString(),
            ];
        });

        // Also provide evaluations dropdown for creating a new request
        $evalDropdownQuery = SupplierEvaluation::where(function ($q) {
            $q->where('delete_status', 0)->orWhereNull('delete_status');
        });
        if (!$isGlobalScope && $user->office_id) {
            $evalDropdownQuery->where('office_id', $user->office_id);
        }
        $evalDropdown = $evalDropdownQuery->orderByDesc('id')
            ->get(['id', 'po_no', 'supplier_name', 'status']);

        return response()->json([
            'requests' => $requests,
            'evaluations_dropdown' => $evalDropdown,
        ]);
    }

    /**
     * Store a new Update or Delete Request (End User)
     */
    public function storeRequest(Request $request): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);

        $validated = $request->validate([
            'evaluation_id' => 'required|integer|exists:supplier_evaluations,id',
            'request_type' => 'required|string|in:update,delete',
            'reason' => 'required|string|max:1000',
        ]);

        $admin = User::whereIn('role', ['super_admin', 'admin'])->first();

        $req = SupplierRequest::create([
            'evaluation_id' => $validated['evaluation_id'],
            'user_id' => $user->id,
            'requested_to' => $admin?->id,
            'request_type' => $validated['request_type'],
            'reason' => trim($validated['reason']),
            'status' => 'pending',
            'request_date' => now(),
        ]);

        $this->logActivity(
            $request,
            'Submit Evaluation Request',
            "Submitted {$validated['request_type']} request for evaluation ID {$validated['evaluation_id']}."
        );

        return response()->json([
            'message' => ucfirst($validated['request_type']) . ' request submitted to the Administrator.',
            'request' => $req,
        ], 201);
    }

    /**
     * Approve a Request (Admin / PGSO)
     */
    public function approveRequest(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);
        $role = $this->getEffectiveRole($user);

        if (!in_array($role, ['administrator', 'pgso'], true)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $req = SupplierRequest::with('evaluation')->findOrFail($id);
        $req->status = 'approved';
        $req->status_date = now();
        $req->save();

        // If request_type is delete, soft-delete the evaluation immediately as well
        if (strtolower($req->request_type) === 'delete' && $req->evaluation) {
            $req->evaluation->update(['delete_status' => 1]);
            SupplierPurchaseOrder::where('po_no', $req->evaluation->po_no)->update(['status' => 'Pending']);
        }

        $this->logActivity(
            $request,
            'Approve Evaluation Request',
            "Approved {$req->request_type} request ID {$req->id}."
        );

        return response()->json([
            'message' => 'Request approved successfully.',
            'request' => $req,
        ]);
    }

    /**
     * Reject a Request (Admin / PGSO)
     */
    public function rejectRequest(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);
        $role = $this->getEffectiveRole($user);

        if (!in_array($role, ['administrator', 'pgso'], true)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $req = SupplierRequest::findOrFail($id);
        $req->status = 'rejected';
        $req->status_date = now();
        $req->save();

        $this->logActivity(
            $request,
            'Reject Evaluation Request',
            "Rejected {$req->request_type} request ID {$req->id}."
        );

        return response()->json([
            'message' => 'Request rejected.',
            'request' => $req,
        ]);
    }

    /**
     * Cancel a pending Request (End User)
     */
    public function cancelRequest(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);

        $req = SupplierRequest::findOrFail($id);
        if ($req->user_id !== $user->id && !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $req->delete();

        return response()->json([
            'message' => 'Request cancelled.',
        ]);
    }

    /**
     * List Authorize Personnel PDFs (supplier_pdfs)
     */
    public function listAuthorizePdfs(Request $request): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);
        $role = $this->getEffectiveRole($user);
        $isGlobalScope = in_array($role, ['administrator', 'pgso'], true);

        $query = SupplierPdf::with('user.office')->orderByDesc('created_at');
        if (!$isGlobalScope) {
            $query->where('user_id', $user->id);
        }

        $pdfs = $query->get()->map(function ($p) {
            return [
                'id' => $p->id,
                'user_id' => $p->user_id,
                'user_name' => $p->user->name ?? 'Unknown',
                'office_name' => $p->user->office->name ?? 'N/A',
                'role' => $p->user->role ?? '',
                'pdf_file' => $p->pdf_file,
                'file_url' => "/api/supplier-evaluation/pdfs/{$p->id}/file",
                'status' => $p->status,
                'created_at' => $p->created_at?->toDateTimeString(),
            ];
        });

        return response()->json(['data' => $pdfs]);
    }

    /**
     * Upload Authorize Personnel PDF
     */
    public function uploadAuthorizePdf(Request $request): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);

        $request->validate([
            'pdf_file' => 'required|file|mimes:pdf|max:20480',
        ]);

        $file = $request->file('pdf_file');
        $filename = 'auth_pdf_' . time() . '_' . $user->id . '.pdf';
        $path = $file->storeAs('supplier_authorize_pdfs', $filename, 'local');

        $pdf = SupplierPdf::create([
            'user_id' => $user->id,
            'pdf_file' => $path,
            'status' => 'pending',
        ]);

        $this->logActivity($request, 'Upload Authorize PDF', "Uploaded authorization PDF ID {$pdf->id}.");

        return response()->json([
            'message' => 'Authorization PDF uploaded successfully and submitted for approval.',
            'pdf' => $pdf,
        ], 201);
    }

    /**
     * Update Authorize PDF status (Approve / Reject)
     */
    public function updateAuthorizePdfStatus(Request $request, int $id): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);
        $role = $this->getEffectiveRole($user);

        if (!in_array($role, ['administrator', 'pgso'], true)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $validated = $request->validate([
            'status' => 'required|string|in:approved,rejected,pending',
        ]);

        $pdf = SupplierPdf::findOrFail($id);
        $pdf->status = $validated['status'];
        $pdf->save();

        $this->logActivity(
            $request,
            'Update Authorize PDF Status',
            "Set authorization PDF ID {$pdf->id} status to {$pdf->status}."
        );

        return response()->json([
            'message' => "Authorization PDF marked as {$pdf->status}.",
            'pdf' => $pdf,
        ]);
    }

    /**
     * View Authorize Personnel PDF file
     */
    public function viewAuthorizePdfFile(Request $request, int $id): BinaryFileResponse|JsonResponse
    {
        $this->authorizeSupplierEvaluation($request);

        $pdf = SupplierPdf::findOrFail($id);
        if (!$pdf->pdf_file) {
            return response()->json(['message' => 'No PDF file.'], 404);
        }

        $candidates = [
            Storage::disk('local')->path($pdf->pdf_file),
            storage_path('app/' . ltrim($pdf->pdf_file, '/')),
            'C:/xampp/htdocs/finalize_system/Supplier_Evaluation/storage/app/private/' . ltrim($pdf->pdf_file, '/'),
            'C:/xampp/htdocs/finalize_system/Supplier_Evaluation/storage/app/' . ltrim($pdf->pdf_file, '/'),
        ];

        foreach ($candidates as $path) {
            if (file_exists($path) && is_file($path)) {
                return response()->file($path, ['Content-Type' => 'application/pdf']);
            }
        }

        return response()->json(['message' => 'PDF file not found on disk.'], 404);
    }

    /**
     * Comprehensive Analytics & Reports endpoint (replicates Analytics view + Summary + Semester + Monthly + Missing PDF POs)
     */
    public function analytics(Request $request): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);
        $role = $this->getEffectiveRole($user);
        $isGlobalScope = in_array($role, ['administrator', 'pgso'], true);

        $department = $request->input('department', 'all');
        $year = $request->input('year', 'all');
        $supplierFilter = $request->input('supplier', 'all');

        $query = SupplierEvaluation::with(['office', 'criteriaScores.criteria'])
            ->where('status', 'submitted')
            ->where(function ($q) {
                $q->where('delete_status', 0)->orWhereNull('delete_status');
            });

        if (!$isGlobalScope && $user->office_id) {
            $query->where('office_id', $user->office_id);
        } elseif ($department && $department !== 'all') {
            $query->whereHas('office', function ($q) use ($department) {
                $q->where('name', $department)->orWhere('code', $department);
            });
        }

        if ($year && $year !== 'all') {
            $y = (int) $year;
            $query->where(function ($q) use ($y) {
                $q->where('period_year', $y)->orWhere('covered_period', 'like', "%{$y}%");
            });
        }

        if ($supplierFilter && $supplierFilter !== 'all') {
            $query->where('supplier_name', $supplierFilter);
        }

        $submittedEvaluations = $query->orderByDesc('date_evaluation')->get();

        // 1. Summary Report & Calculate Evaluations grouping (by Department + Supplier)
        $summaryGroups = [];
        // 2. Semester Summary grouping (by Supplier)
        $semesterGroups = [];
        // 3. Monthly evaluation counts (1..12)
        $monthlyCounts = array_fill(1, 12, 0);
        // 4. Supplier average scores
        $supplierScoreGroups = [];

        foreach ($submittedEvaluations as $eval) {
            $score = self::computeEvaluationScore($eval->criteriaScores);
            $deptName = $eval->office->name ?? 'N/A';
            $suppKey = strtoupper(trim($eval->supplier_name));
            $suppDisplay = trim($eval->supplier_name);

            // Group by Dept + Supplier for Summary PDF & Calculate Modal
            $groupKey = $eval->office_id . '|' . $suppKey;
            if (!isset($summaryGroups[$groupKey])) {
                $summaryGroups[$groupKey] = [
                    'office_id' => $eval->office_id,
                    'department' => $deptName,
                    'department_code' => $eval->office->code ?? '',
                    'supplier' => $suppDisplay,
                    'scores' => [],
                    'remarks' => [],
                    'evaluations' => [],
                ];
            }
            $summaryGroups[$groupKey]['scores'][] = $score;
            $summaryGroups[$groupKey]['evaluations'][] = [
                'id' => $eval->id,
                'po_no' => $eval->po_no,
                'date_evaluation' => $eval->date_evaluation?->format('Y-m-d'),
                'covered_period' => $eval->covered_period,
                'score' => $score,
            ];

            foreach ($eval->criteriaScores as $cs) {
                if (!empty(trim((string) $cs->remarks))) {
                    $summaryGroups[$groupKey]['remarks'][] = [
                        'po_no' => $eval->po_no,
                        'criteria' => $cs->criteria->criteria_name ?? 'Criteria',
                        'remarks' => trim($cs->remarks),
                    ];
                }
            }

            // Semester calculation (1st Sem: Jan-Jun, 2nd Sem: Jul-Dec)
            $month = $eval->date_evaluation ? (int) $eval->date_evaluation->format('n') : (int) $eval->created_at?->format('n');
            if ($month >= 1 && $month <= 12) {
                $monthlyCounts[$month]++;
            }

            if (!isset($semesterGroups[$suppKey])) {
                $semesterGroups[$suppKey] = [
                    'supplier' => $suppDisplay,
                    'sem1_scores' => [],
                    'sem2_scores' => [],
                    'all_scores' => [],
                ];
            }
            if ($month >= 1 && $month <= 6) {
                $semesterGroups[$suppKey]['sem1_scores'][] = $score;
            } else {
                $semesterGroups[$suppKey]['sem2_scores'][] = $score;
            }
            $semesterGroups[$suppKey]['all_scores'][] = $score;

            // Supplier Score chart
            if (!isset($supplierScoreGroups[$suppKey])) {
                $supplierScoreGroups[$suppKey] = [
                    'supplier' => $suppDisplay,
                    'scores' => [],
                ];
            }
            $supplierScoreGroups[$suppKey]['scores'][] = $score;
        }

        $summaryList = array_values(array_map(function ($g) {
            $count = count($g['scores']);
            $avg = $count > 0 ? round(array_sum($g['scores']) / $count, 2) : 0;
            return [
                'office_id' => $g['office_id'],
                'department' => $g['department'],
                'department_code' => $g['department_code'],
                'supplier' => $g['supplier'],
                'total_evaluations' => $count,
                'average_score' => $avg,
                'rating_label' => $avg >= 90 ? 'Outstanding' : ($avg >= 80 ? 'Satisfactory' : ($avg >= 75 ? 'Fair' : 'Needs Improvement')),
                'remarks' => $g['remarks'],
                'evaluations' => $g['evaluations'],
            ];
        }, $summaryGroups));

        $semesterList = array_values(array_map(function ($s) {
            $s1Count = count($s['sem1_scores']);
            $s2Count = count($s['sem2_scores']);
            $allCount = count($s['all_scores']);
            $s1Avg = $s1Count > 0 ? round(array_sum($s['sem1_scores']) / $s1Count, 2) : null;
            $s2Avg = $s2Count > 0 ? round(array_sum($s['sem2_scores']) / $s2Count, 2) : null;
            $overallAvg = $allCount > 0 ? round(array_sum($s['all_scores']) / $allCount, 2) : null;

            return [
                'supplier' => $s['supplier'],
                'sem1_count' => $s1Count,
                'sem1_avg' => $s1Avg,
                'sem2_count' => $s2Count,
                'sem2_avg' => $s2Avg,
                'overall_avg' => $overallAvg,
                'total_pos' => $allCount,
                'rating_label' => $overallAvg === null ? 'No Rating' : ($overallAvg >= 90 ? 'Outstanding' : ($overallAvg >= 80 ? 'Satisfactory' : ($overallAvg >= 75 ? 'Fair' : 'Needs Improvement'))),
            ];
        }, $semesterGroups));

        usort($semesterList, fn ($a, $b) => ($b['overall_avg'] ?? 0) <=> ($a['overall_avg'] ?? 0));

        $supplierScoresList = array_values(array_map(function ($s) {
            $count = count($s['scores']);
            $avg = $count > 0 ? round(array_sum($s['scores']) / $count, 2) : 0;
            return [
                'supplier' => $s['supplier'],
                'average_score' => $avg,
                'total_evaluations' => $count,
            ];
        }, $supplierScoreGroups));

        usort($supplierScoresList, fn ($a, $b) => $b['average_score'] <=> $a['average_score']);

        // 5. Purchase Orders Pending PDF Upload
        $missingPdfQuery = SupplierPurchaseOrder::where(function ($q) {
            $q->whereNull('pdf_po')->orWhere('pdf_po', '');
        });

        if ($department && $department !== 'all') {
            $missingPdfQuery->where('end_user', $department);
        }
        if ($supplierFilter && $supplierFilter !== 'all') {
            $missingPdfQuery->where('supplier', $supplierFilter);
        }
        if ($request->filled('missing_pdf_search')) {
            $ms = trim($request->input('missing_pdf_search'));
            $missingPdfQuery->where(function ($q) use ($ms) {
                $q->where('po_no', 'like', "%{$ms}%")
                    ->orWhere('pr_no', 'like', "%{$ms}%")
                    ->orWhere('supplier', 'like', "%{$ms}%")
                    ->orWhere('end_user', 'like', "%{$ms}%");
            });
        }

        $missingPdfPos = $missingPdfQuery->orderByDesc('id')->limit(500)->get();

        return response()->json([
            'summary' => $summaryList,
            'semester_data' => $semesterList,
            'monthly_counts' => array_values($monthlyCounts),
            'supplier_scores' => $supplierScoresList,
            'missing_pdf_pos' => $missingPdfPos,
        ]);
    }

    /**
     * Paginated Supplier Activity Logs
     */
    public function activityLogs(Request $request): JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);
        $role = $this->getEffectiveRole($user);

        if (!in_array($role, ['administrator', 'pgso'], true)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $query = SupplierActivityLog::with('user:id,name,email,role');

        if ($request->filled('role') && $request->input('role') !== 'all') {
            $query->where('role', $request->input('role'));
        }
        if ($request->filled('status') && $request->input('status') !== 'all') {
            $query->where('status', $request->input('status'));
        }
        if ($request->filled('from_date')) {
            $query->whereDate('created_at', '>=', $request->input('from_date'));
        }
        if ($request->filled('to_date')) {
            $query->whereDate('created_at', '<=', $request->input('to_date'));
        }
        if ($request->filled('search')) {
            $s = trim($request->input('search'));
            $query->where(function ($q) use ($s) {
                $q->where('activity', 'like', "%{$s}%")
                    ->orWhere('description', 'like', "%{$s}%")
                    ->orWhere('ip_address', 'like', "%{$s}%")
                    ->orWhereHas('user', fn ($u) => $u->where('name', 'like', "%{$s}%")->orWhere('email', 'like', "%{$s}%"));
            });
        }

        $paginated = $query->orderByDesc('created_at')->orderByDesc('id')->paginate(25);

        return response()->json($paginated);
    }

    /**
     * Export Supplier Activity Logs as CSV
     */
    public function exportActivityLogs(Request $request): StreamedResponse|JsonResponse
    {
        $user = $this->authorizeSupplierEvaluation($request);
        $role = $this->getEffectiveRole($user);

        if (!in_array($role, ['administrator', 'pgso'], true)) {
            return response()->json(['message' => 'Unauthorized.'], 403);
        }

        $query = SupplierActivityLog::with('user:id,name,email,role');

        if ($request->filled('role') && $request->input('role') !== 'all') {
            $query->where('role', $request->input('role'));
        }
        if ($request->filled('status') && $request->input('status') !== 'all') {
            $query->where('status', $request->input('status'));
        }
        if ($request->filled('from_date')) {
            $query->whereDate('created_at', '>=', $request->input('from_date'));
        }
        if ($request->filled('to_date')) {
            $query->whereDate('created_at', '<=', $request->input('to_date'));
        }
        if ($request->filled('search')) {
            $s = trim($request->input('search'));
            $query->where(function ($q) use ($s) {
                $q->where('activity', 'like', "%{$s}%")
                    ->orWhere('description', 'like', "%{$s}%")
                    ->orWhere('ip_address', 'like', "%{$s}%");
            });
        }

        $logs = $query->orderByDesc('created_at')->limit(5000)->get();

        return response()->streamDownload(function () use ($logs) {
            $out = fopen('php://output', 'w');
            fputcsv($out, ['ID', 'User', 'Email', 'Role', 'Activity', 'Description', 'Status', 'IP Address', 'Timestamp']);
            foreach ($logs as $log) {
                fputcsv($out, [
                    $log->id,
                    $log->user->name ?? 'System/Guest',
                    $log->user->email ?? '-',
                    $log->role,
                    $log->activity,
                    $log->description,
                    $log->status,
                    $log->ip_address,
                    $log->created_at?->toDateTimeString(),
                ]);
            }
            fclose($out);
        }, 'supplier_evaluation_activity_logs_' . date('Y-m-d') . '.csv', [
            'Content-Type' => 'text/csv',
        ]);
    }
}
