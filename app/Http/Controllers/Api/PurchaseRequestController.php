<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\MonitoringProject;
use App\Models\Ppmp;
use App\Models\PpmpAttachmentList;
use App\Models\PurchaseRequest;
use App\Models\PurchaseRequestAttachment;
use App\Models\PurchaseRequestItem;
use App\Models\PurchaseRequestRoute;
use App\Models\SystemNotification;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class PurchaseRequestController extends Controller
{
    /**
     * Authorize user access to PIMS or PPMP-related purchase request operations
     */
    protected function authorizePims(Request $request, ?PurchaseRequest $pr = null): void
    {
        $user = $request->user();
        if (!$user) {
            abort(response()->json(['message' => 'Unauthenticated.'], 401));
        }

        // 1. Direct access to PIMS (or administrator)
        if ($user->canAccessSystem('/pims')) {
            return;
        }

        // 2. Allow users authorized for PPMP & APP System to query or manage purchase requests linked to a PPMP
        // (e.g. from PPMP Detail view, reminder cards, or PR generation from PPMP)
        if ($user->canAccessSystem('/eprocrementppmpapp')) {
            if (
                $request->filled('ppmp_id') ||
                $request->filled('ppmp_uuid') ||
                $request->route('ppmpUuid') ||
                ($pr && $pr->ppmp_id)
            ) {
                return;
            }
        }

        abort(response()->json(['message' => 'Forbidden. Your account is not authorized to access PIMS.'], 403));
    }

    /**
     * List purchase requests with filters and search
     */
    public function index(Request $request): JsonResponse
    {
        $this->authorizePims($request);
        $user = $request->user();

        $query = PurchaseRequest::with([
            'office',
            'creator',
            'ppmp.attachments',
            'monitoringProject',
            'items',
            'attachments',
            'routes.fromUser',
            'routes.toUser',
        ]);

        // Filter by PPMP ID if requested (e.g. from PPMP Detail view or reminder card)
        if ($request->filled('ppmp_id')) {
            $query->where('ppmp_id', $request->ppmp_id);
        }

        // Filter by PPMP UUID if requested
        if ($request->filled('ppmp_uuid')) {
            $query->whereHas('ppmp', function ($q) use ($request) {
                $q->where('uuid', $request->ppmp_uuid);
            });
        }

        // Restrict end users to their own office's PRs unless admin / oppmo / monitor / twg
        if ($user->isEndUser() || $user->isHead()) {
            if ($user->office_id) {
                $query->where(function ($q) use ($user, $request) {
                    $q->where('office_id', $user->office_id);
                    if ($request->filled('ppmp_id')) {
                        $q->orWhere('ppmp_id', $request->ppmp_id);
                    }
                });
            } else {
                $query->where(function ($q) use ($user, $request) {
                    $q->where('created_by', $user->id);
                    if ($request->filled('ppmp_id')) {
                        $q->orWhere('ppmp_id', $request->ppmp_id);
                    }
                });
            }
        }

        // Filter by Status
        if ($request->filled('status') && $request->status !== 'ALL') {
            $query->where('status', $request->status);
        }

        // Filter by Stage
        if ($request->filled('stage') && $request->stage !== 'ALL') {
            $query->where('current_stage', $request->stage);
        }

        // Filter by Source (PPMP or APP)
        if ($request->filled('source') && $request->source !== 'ALL') {
            $query->where('source', $request->source);
        }

        // Filter by Office
        if ($request->filled('office_id') && $request->office_id !== 'ALL') {
            $query->where('office_id', $request->office_id);
        }

        // Filter by Year
        if ($request->filled('year') && $request->year !== 'ALL') {
            $query->whereYear('date_published', $request->year);
        }

        // Search by tracker_id, pr_number, purpose, department, requested_by_name
        if ($request->filled('search')) {
            $search = '%' . trim($request->search) . '%';
            $query->where(function ($q) use ($search) {
                $q->where('tracker_id', 'like', $search)
                  ->orWhere('pr_number', 'like', $search)
                  ->orWhere('purpose', 'like', $search)
                  ->orWhere('department', 'like', $search)
                  ->orWhere('requested_by_name', 'like', $search);
            });
        }

        $purchaseRequests = $query->orderBy('created_at', 'desc')->get();

        return response()->json([
            'purchase_requests' => $purchaseRequests,
        ]);
    }

    /**
     * Get single purchase request with items, routes, and attachments
     */
    public function show(Request $request, string $idOrUuid): JsonResponse
    {
        $pr = PurchaseRequest::with([
            'office',
            'creator',
            'ppmp.attachments',
            'ppmp.attachmentLists',
            'monitoringProject.steps',
            'items',
            'attachments',
            'routes.fromUser',
            'routes.toUser',
        ])
        ->where('id', $idOrUuid)
        ->orWhere('uuid', $idOrUuid)
        ->firstOrFail();

        $this->authorizePims($request, $pr);

        return response()->json([
            'purchase_request' => $pr,
        ]);
    }

    /**
     * Pre-populate data from PPMP, attachment list, and monitoring project for PR Generation
     */
    public function getPpmpData(Request $request, string $ppmpUuid): JsonResponse
    {
        $this->authorizePims($request);

        $ppmp = Ppmp::with([
            'office',
            'creator',
            'items',
            'attachments',
            'attachmentLists',
            'monitoringProjects',
        ])->where('uuid', $ppmpUuid)->firstOrFail();

        // Find primary or latest attachment list
        $attachmentList = $ppmp->attachmentLists()->first();
        if (!$attachmentList && !empty($ppmp->attachment_list_data)) {
            $ppmp->syncAttachmentLists(json_decode($ppmp->attachment_list_data, true) ?: []);
            $attachmentList = $ppmp->attachmentLists()->first();
        }

        // Latest monitoring project
        $monitoringProject = $ppmp->monitoringProjects()->latest()->first();

        // Check if a PR already exists for this PPMP
        $existingPr = PurchaseRequest::where('ppmp_id', $ppmp->id)->first();

        // Resolve Department / Office Name
        $department = $ppmp->implementing_unit ?: ($ppmp->office?->name ?: 'Provincial Government Office');

        // Resolve Tracker ID from PPMP
        $trackerId = $ppmp->tracking_number ?: $ppmp->ppmp_number ?: ('PR-' . date('Y') . '-' . Str::upper(Str::random(6)));

        // Resolve Purpose / Title
        $purpose = $attachmentList?->project_title ?: ($ppmp->title ?: 'Procurement Requirement');

        // Resolve Charges
        $fiscalYearStr = $ppmp->fiscal_year ? "CY {$ppmp->fiscal_year} " : '';
        $rawFund = $ppmp->source_of_fund ?: 'GENERAL FUND';
        $charges = $attachmentList?->charges ?: "{$fiscalYearStr}{$rawFund} Account Code: " . ($ppmp->account_code ?: 'N/A');

        // Items breakdown
        $items = [];
        if ($attachmentList && !empty($attachmentList->rows) && is_array($attachmentList->rows)) {
            foreach ($attachmentList->rows as $index => $row) {
                $items[] = [
                    'item_no' => (string) ($row['item_no'] ?? $row['itemNo'] ?? ($index + 1)),
                    'unit' => $row['unit'] ?? 'lot',
                    'item_description' => $row['description'] ?? $row['item_description'] ?? '',
                    'quantity' => floatval($row['quantity'] ?? $row['qty'] ?? 1),
                    'unit_cost' => floatval($row['unit_cost'] ?? $row['unitCost'] ?? 0),
                    'total_cost' => floatval($row['total_cost'] ?? $row['totalCost'] ?? 0),
                    'is_lot_header' => !empty($row['is_lot_header']),
                ];
            }
        } elseif ($ppmp->items && $ppmp->items->isNotEmpty()) {
            foreach ($ppmp->items as $index => $item) {
                if ($item->is_header) continue;
                $items[] = [
                    'item_no' => (string)($item->item_no ?: ($index + 1)),
                    'unit' => 'lot',
                    'item_description' => $item->description,
                    'quantity' => floatval($item->quantity_size ?: 1),
                    'unit_cost' => floatval($item->estimated_budget ?: 0),
                    'total_cost' => floatval($item->estimated_budget ?: 0),
                    'is_lot_header' => false,
                ];
            }
        }

        // Green procurement specifications
        $greenSpecs = $attachmentList?->other_terms ?: ($ppmp->warranty_and_other_terms ?: '');

        // Resolve is_infrastructure flag from items, category, and metadata
        $isInfra = false;
        if ($monitoringProject?->category === 'INFRA') {
            $isInfra = true;
        } elseif ($ppmp->items && $ppmp->items->contains(function ($item) {
            return !empty($item->project_type) && stripos($item->project_type, 'infra') !== false;
        })) {
            $isInfra = true;
        } elseif (
            stripos($ppmp->project_type ?? '', 'infra') !== false ||
            stripos($ppmp->general_description ?? '', 'infra') !== false ||
            stripos($ppmp->title ?? '', 'infra') !== false ||
            stripos($trackerId, 'infra') !== false
        ) {
            $isInfra = true;
        }

        $category = $isInfra ? 'INFRA' : ($monitoringProject?->category ?: 'GOODS_CONSULTING');

        // Resolve signatories
        $signatories = DB::table('ppmp_signatories')->where('is_active', true)->get();
        $treasurer = $signatories->firstWhere('signatory_type', 'cash_availability') ?: $signatories->firstWhere('position', 'Provincial Treasurer');
        $governor = $signatories->firstWhere('signatory_type', 'approved_by') ?: $signatories->firstWhere('position', 'Provincial Governor');

        return response()->json([
            'ppmp' => $ppmp,
            'existing_pr' => $existingPr,
            'monitoring_project' => $monitoringProject,
            'prepopulated' => [
                'tracker_id' => $trackerId,
                'department' => $department,
                'section' => '',
                'source' => $ppmp->is_annual ? 'APP' : 'PPMP',
                'category' => $category,
                'is_infrastructure' => $isInfra,
                'procurement_mode' => $monitoringProject?->procurement_mode ?: ($ppmp->items()->whereNotNull('procurement_mode')->value('procurement_mode') ?: 'SVP'),
                'purpose' => $purpose,
                'place_of_delivery' => $attachmentList?->place_of_delivery ?: ($ppmp->place_of_delivery ?: 'PGSO Warehouse/On Site'),
                'delivery_period' => $attachmentList?->delivery_period ?: ($ppmp->delivery_period ?: 'Date of activity'),
                'payment_method' => $attachmentList?->payment_method ?: ($ppmp->payment_method ?: 'One-Time Payment/ Credit Basis'),
                'charges' => $charges,
                'green_specifications' => $greenSpecs,
                'total_cost' => $attachmentList?->total_budget ?: ($ppmp->total_budget ?: 0),
                'requested_by_name' => $attachmentList?->approved_by_name ?: ($ppmp->creator?->name ?: $request->user()->name),
                'requested_by_designation' => $attachmentList?->approved_by_position ?: ($ppmp->office?->name ? "Officer of {$ppmp->office->name}" : 'Authorized Officer'),
                'cash_availability_name' => $treasurer?->name ?: 'FARAH GEMMA V. BIDAN, CPA',
                'cash_availability_designation' => $treasurer?->position ?: 'Provincial Treasurer',
                'approved_by_name' => $governor?->name ?: 'HON. YVONNE R. CAGAS',
                'approved_by_designation' => $governor?->position ?: 'Provincial Governor',
                'direct_end_user_name' => $ppmp->creator?->name ?: $request->user()->name,
                'direct_end_user_designation' => $ppmp->creator?->designation ?: 'End-User / Project In-Charge',
                'items' => $items,
                'attachments' => $ppmp->attachments,
            ],
        ]);
    }

    /**
     * Store a newly generated Purchase Request (PR)
     */
    public function store(Request $request): JsonResponse
    {
        $this->authorizePims($request);
        $user = $request->user();

        // Support JSON string parsing if submitted via FormData
        $input = $request->all();

        // Convert empty strings to null for nullable dates/ids/strings
        foreach (['monitoring_project_id', 'pr_number', 'pr_certification_date', 'section', 'charges', 'green_specifications', 'direct_end_user_signed_at', 'pr_date'] as $field) {
            if (isset($input[$field]) && trim((string)$input[$field]) === '') {
                $input[$field] = null;
            }
        }

        if (is_string($request->input('items'))) {
            $decodedItems = json_decode($request->input('items'), true);
            if (is_array($decodedItems)) {
                $input['items'] = $decodedItems;
            }
        }
        if (is_string($request->input('links'))) {
            $decodedLinks = json_decode($request->input('links'), true);
            if (is_array($decodedLinks)) {
                $input['links'] = $decodedLinks;
            }
        }

        // Sanitize items: cast item_no to string, is_lot_header to boolean, default missing descriptions
        if (is_array($input['items'] ?? null)) {
            foreach ($input['items'] as $idx => &$item) {
                if (isset($item['item_no'])) {
                    $item['item_no'] = (string) $item['item_no'];
                } else {
                    $item['item_no'] = (string) ($idx + 1);
                }
                if (empty($item['item_description'])) {
                    $item['item_description'] = $input['purpose'] ?? 'Procurement requirement';
                }
                if (isset($item['is_lot_header'])) {
                    $item['is_lot_header'] = (bool) $item['is_lot_header'];
                }
            }
            unset($item);
        }

        $validator = Validator::make($input, [
            'ppmp_uuid' => 'required|string|exists:ppmps,uuid',
            'monitoring_project_id' => 'nullable|exists:monitoring_projects,id',
            'tracker_id' => 'required|string|max:100',
            'pr_number' => 'nullable|string|max:100',
            'date_published' => 'nullable|date',
            'pr_date' => 'nullable|date',
            'department' => 'required|string|max:255',
            'section' => 'nullable|string|max:255',
            'source' => 'nullable|string|in:PPMP,APP',
            'category' => 'nullable|string|max:50',
            'procurement_mode' => 'nullable|string|max:100',
            'purpose' => 'required|string',
            'place_of_delivery' => 'nullable|string|max:255',
            'delivery_period' => 'nullable|string|max:255',
            'payment_method' => 'nullable|string|max:255',
            'charges' => 'nullable|string',
            'green_specifications' => 'nullable|string',
            'pr_certification_date' => 'nullable|date',
            'total_cost' => 'required|numeric|min:0',
            'requested_by_name' => 'nullable|string|max:255',
            'requested_by_designation' => 'nullable|string|max:255',
            'cash_availability_name' => 'nullable|string|max:255',
            'cash_availability_designation' => 'nullable|string|max:255',
            'approved_by_name' => 'nullable|string|max:255',
            'approved_by_designation' => 'nullable|string|max:255',
            'direct_end_user_name' => 'nullable|string|max:255',
            'direct_end_user_designation' => 'nullable|string|max:255',
            'direct_end_user_signed_at' => 'nullable|date',
            'items' => 'required|array|min:1',
            'items.*.item_no' => 'required|string|max:50',
            'items.*.unit' => 'nullable|string|max:50',
            'items.*.item_description' => 'required|string',
            'items.*.quantity' => 'nullable|numeric|min:0',
            'items.*.unit_cost' => 'nullable|numeric|min:0',
            'items.*.total_cost' => 'nullable|numeric|min:0',
            'items.*.is_lot_header' => 'nullable|boolean',
            'pdf_files' => 'nullable|array',
            'pdf_files.*' => 'file|mimes:pdf|max:10240', // PDF only, max 10MB per file
            'links' => 'nullable|array',
            'links.*.url' => 'required|string|url',
            'links.*.title' => 'nullable|string|max:255',
        ]);

        if ($validator->fails()) {
            return response()->json([
                'message' => $validator->errors()->first(),
                'errors' => $validator->errors(),
            ], 422);
        }

        $validated = $validator->validated();

        // Strict URL security check: Links must start with https://
        if (!empty($validated['links'])) {
            foreach ($validated['links'] as $link) {
                $url = trim($link['url'] ?? '');
                if (!str_starts_with(strtolower($url), 'https://')) {
                    return response()->json([
                        'message' => 'Security Error: External links must strictly use secure HTTPS protocol (https://). Non-HTTPS, javascript:, or data: URLs are forbidden.',
                    ], 422);
                }
            }
        }

        // Strict PDF Binary Magic Bytes Verification (%PDF-)
        $uploadedPdfFiles = $request->file('pdf_files') ?: [];
        if (!is_array($uploadedPdfFiles) && $uploadedPdfFiles instanceof \Illuminate\Http\UploadedFile) {
            $uploadedPdfFiles = [$uploadedPdfFiles];
        }

        foreach ($uploadedPdfFiles as $uploadedPdf) {
            if (!$uploadedPdf->isValid()) {
                return response()->json(['message' => 'Uploaded file is invalid or corrupted.'], 422);
            }
            if ($uploadedPdf->getSize() > 10 * 1024 * 1024) {
                return response()->json(['message' => 'Security Limit: PDF file "' . $uploadedPdf->getClientOriginalName() . '" exceeds 10MB maximum size limit.'], 422);
            }
            $handle = fopen($uploadedPdf->getRealPath(), 'rb');
            $magicHeader = fread($handle, 5);
            fclose($handle);
            if ($magicHeader !== '%PDF-') {
                return response()->json([
                    'message' => 'Security Error: File "' . $uploadedPdf->getClientOriginalName() . '" does not match genuine PDF binary header signature (%PDF-). Only genuine PDF documents are permitted.',
                ], 422);
            }
        }

        $ppmp = Ppmp::where('uuid', $validated['ppmp_uuid'])->firstOrFail();

        // Check if duplicate PR already exists for this PPMP
        $existingPr = PurchaseRequest::where('ppmp_id', $ppmp->id)->first();
        if ($existingPr) {
            return response()->json([
                'message' => "A Purchase Request ({$existingPr->tracker_id}) has already been generated for this PPMP.",
                'purchase_request' => $existingPr->load(['items', 'routes', 'attachments']),
            ], 409);
        }

        $purchaseRequest = DB::transaction(function () use ($validated, $ppmp, $user, $uploadedPdfFiles) {
            $datePublished = now()->toDateString();
            $prDate = $validated['pr_date'] ?? now();

            $attachmentList = $ppmp->attachmentLists()->first();
            $trackerNo = trim($validated['tracker_id']);

            $pr = PurchaseRequest::create([
                'ppmp_id' => $ppmp->id,
                'ppmp_attachment_list_id' => $attachmentList?->id,
                'monitoring_project_id' => $validated['monitoring_project_id'] ?? null,
                'office_id' => $ppmp->office_id,
                'tracker_id' => $trackerNo,
                'pr_number' => !empty($validated['pr_number']) ? trim($validated['pr_number']) : null,
                'date_published' => $datePublished,
                'pr_date' => $prDate,
                'department' => $validated['department'],
                'section' => $validated['section'] ?? null,
                'source' => $validated['source'] ?? ($ppmp->is_annual ? 'APP' : 'PPMP'),
                'category' => $validated['category'] ?? 'GOODS_CONSULTING',
                'procurement_mode' => $validated['procurement_mode'] ?? 'SVP',
                'purpose' => $validated['purpose'],
                'place_of_delivery' => $validated['place_of_delivery'] ?? 'PGSO Warehouse/On Site',
                'delivery_period' => $validated['delivery_period'] ?? 'Date of activity',
                'payment_method' => $validated['payment_method'] ?? 'One-Time Payment/ Credit Basis',
                'charges' => !empty($validated['charges']) ? $validated['charges'] : null,
                'green_specifications' => !empty($validated['green_specifications']) ? $validated['green_specifications'] : null,
                'pr_certification_date' => !empty($validated['pr_certification_date']) ? $validated['pr_certification_date'] : null,
                'total_cost' => $validated['total_cost'],
                'requested_by_name' => !empty($validated['requested_by_name']) ? $validated['requested_by_name'] : null,
                'requested_by_designation' => !empty($validated['requested_by_designation']) ? $validated['requested_by_designation'] : null,
                'cash_availability_name' => $validated['cash_availability_name'] ?? 'FARAH GEMMA V. BIDAN, CPA',
                'cash_availability_designation' => $validated['cash_availability_designation'] ?? 'Provincial Treasurer',
                'approved_by_name' => $validated['approved_by_name'] ?? 'HON. YVONNE R. CAGAS',
                'approved_by_designation' => $validated['approved_by_designation'] ?? 'Provincial Governor',
                'direct_end_user_name' => $validated['direct_end_user_name'] ?? $user->name,
                'direct_end_user_designation' => $validated['direct_end_user_designation'] ?? ($user->designation ?: 'End-User'),
                'direct_end_user_signed_at' => !empty($validated['direct_end_user_signed_at']) ? $validated['direct_end_user_signed_at'] : now(),
                'current_stage' => 'pr_division',
                'status' => 'PR_DIVISION_REVIEW',
                'created_by' => $user->id,
            ]);

            // Save normalized items
            foreach ($validated['items'] as $idx => $itemData) {
                $pr->items()->create([
                    'item_no' => $itemData['item_no'],
                    'unit' => $itemData['unit'] ?? null,
                    'item_description' => $itemData['item_description'],
                    'quantity' => $itemData['quantity'] ?? null,
                    'unit_cost' => $itemData['unit_cost'] ?? null,
                    'total_cost' => $itemData['total_cost'] ?? null,
                    'is_lot_header' => !empty($itemData['is_lot_header']),
                    'sort_order' => $idx + 1,
                ]);
            }

            // Save uploaded multiple PDF files securely
            foreach ($uploadedPdfFiles as $file) {
                $safeName = (string) Str::uuid() . '.pdf';
                $dir = 'purchase_requests/' . $pr->uuid;
                $path = $file->storeAs($dir, $safeName, 'local');

                $pr->attachments()->create([
                    'uploaded_by' => $user->id,
                    'attachment_type' => 'PDF_FILE',
                    'original_filename' => basename($file->getClientOriginalName()),
                    'stored_filename' => $safeName,
                    'storage_path' => $path,
                    'file_size' => $file->getSize(),
                    'mime_type' => 'application/pdf',
                ]);
            }

            // Save secure external links
            if (!empty($validated['links'])) {
                foreach ($validated['links'] as $link) {
                    $url = trim($link['url'] ?? '');
                    if (empty($url)) continue;
                    $pr->attachments()->create([
                        'uploaded_by' => $user->id,
                        'attachment_type' => 'SECURE_LINK',
                        'external_url' => $url,
                        'link_title' => trim($link['title'] ?? '') ?: 'Secure Cloud Document Link',
                    ]);
                }
            }

            // Create initial route (Submission into PR Division Review)
            $pr->routes()->create([
                'from_user_id' => $user->id,
                'from_stage' => 'end_user',
                'to_stage' => 'pr_division',
                'action' => 'submit',
                'status' => 'PENDING',
                'remarks' => "Purchase Request generated and submitted for PR Division review. Tracker ID: {$pr->tracker_id}.",
                'acted_at' => now(),
            ]);

            // Automatic Monitoring System Sync: Automatically fetch data & register/update monitoring project!
            $monitoringProject = null;
            if (!empty($validated['monitoring_project_id'])) {
                $monitoringProject = MonitoringProject::find($validated['monitoring_project_id']);
            }
            if (!$monitoringProject) {
                $monitoringProject = MonitoringProject::where('ppmp_id', $ppmp->id)
                    ->orWhere('pr_number', $trackerNo)
                    ->orWhere('pims_pr_id', $trackerNo)
                    ->latest()
                    ->first();
            }

            if (!$monitoringProject) {
                $monitoringProject = MonitoringProject::create([
                    'ppmp_id' => $ppmp->id,
                    'purchase_request_id' => $pr->id,
                    'project_title' => $pr->purpose,
                    'category' => $pr->category ?: 'GOODS_CONSULTING',
                    'procurement_mode' => $pr->procurement_mode ?: 'SVP',
                    'abc_amount' => $pr->total_cost,
                    'pr_number' => $trackerNo,
                    'pims_pr_id' => $trackerNo, // PR ID is the tracker no!
                    'office_id' => $pr->office_id ?: $ppmp->office_id,
                    'implementing_unit' => $pr->department ?: ($ppmp->implementing_unit ?: $ppmp->office?->name),
                    'end_user_name' => $pr->direct_end_user_name ?: ($ppmp->creator?->name ?: $user->name),
                    'pims_published_at' => now(),
                    'pims_status' => 'PUBLISHED',
                    'current_division' => 'pr_division',
                    'status' => 'IN_PROGRESS',
                    'remarks' => "Automatically published to PIMS upon PR generation for Tracker {$trackerNo}.",
                    'created_by' => $user->id,
                ]);
                $monitoringProject->initializeDefaultSteps();
            } else {
                $monitoringProject->update([
                    'purchase_request_id' => $pr->id,
                    'pims_pr_id' => $trackerNo, // PR ID is the tracker no!
                    'pr_number' => $trackerNo,
                    'project_title' => $pr->purpose,
                    'abc_amount' => $pr->total_cost,
                    'pims_status' => 'PUBLISHED',
                    'pims_published_at' => $monitoringProject->pims_published_at ?: now(),
                ]);
            }

            $pr->update(['monitoring_project_id' => $monitoringProject->id]);

            // Mark PPMP as published to PIMS
            $ppmp->update([
                'is_published_to_pims' => true,
                'pims_published_at' => now(),
            ]);

            return $pr;
        });

        AuditLog::log(
            'PURCHASE_REQUEST_GENERATED',
            'purchase_requests',
            $purchaseRequest->id,
            null,
            [
                'tracker_id' => $purchaseRequest->tracker_id,
                'ppmp_uuid' => $ppmp->uuid,
                'total_cost' => $purchaseRequest->total_cost,
                'department' => $purchaseRequest->department,
                'attachments_count' => $purchaseRequest->attachments()->count(),
            ],
            $user->id
        );

        return response()->json([
            'message' => "Purchase Request {$purchaseRequest->tracker_id} successfully generated and submitted to PR Division review.",
            'purchase_request' => $purchaseRequest->load(['office', 'creator', 'items', 'routes', 'monitoringProject', 'attachments']),
        ], 201);
    }

    /**
     * Download or view a PR PDF attachment securely
     */
    public function downloadAttachment(Request $request, string $prUuid, string $attachmentUuid)
    {
        $pr = PurchaseRequest::where('uuid', $prUuid)->orWhere('id', $prUuid)->firstOrFail();
        $this->authorizePims($request, $pr);
        $attachment = $pr->attachments()->where('uuid', $attachmentUuid)->firstOrFail();

        if ($attachment->attachment_type === 'SECURE_LINK') {
            return redirect()->away($attachment->external_url);
        }

        if (!Storage::disk('local')->exists($attachment->storage_path)) {
            abort(404, 'PDF file not found in secure storage.');
        }

        return response()->file(Storage::disk('local')->path($attachment->storage_path), [
            'Content-Type' => $attachment->mime_type ?: 'application/pdf',
            'Content-Disposition' => 'inline; filename="' . addslashes($attachment->original_filename) . '"',
        ]);
    }

    /**
     * Update an editable Purchase Request
     */
    public function update(Request $request, string $idOrUuid): JsonResponse
    {
        $this->authorizePims($request);
        $user = $request->user();

        $pr = PurchaseRequest::where('id', $idOrUuid)->orWhere('uuid', $idOrUuid)->firstOrFail();

        // Only creator when returned, or admin can update
        if (!$user->isAdmin() && $pr->created_by !== $user->id && $pr->status !== 'RETURNED') {
            return response()->json(['message' => 'This Purchase Request is currently locked in review and cannot be edited.'], 403);
        }

        $validated = $request->validate([
            'pr_number' => 'nullable|string|max:100',
            'department' => 'sometimes|string|max:255',
            'section' => 'nullable|string|max:255',
            'purpose' => 'sometimes|string',
            'place_of_delivery' => 'nullable|string|max:255',
            'delivery_period' => 'nullable|string|max:255',
            'payment_method' => 'nullable|string|max:255',
            'charges' => 'nullable|string',
            'green_specifications' => 'nullable|string',
            'pr_certification_date' => 'nullable|date',
            'total_cost' => 'sometimes|numeric|min:0',
            'requested_by_name' => 'nullable|string|max:255',
            'requested_by_designation' => 'nullable|string|max:255',
            'cash_availability_name' => 'nullable|string|max:255',
            'cash_availability_designation' => 'nullable|string|max:255',
            'approved_by_name' => 'nullable|string|max:255',
            'approved_by_designation' => 'nullable|string|max:255',
            'items' => 'sometimes|array',
        ]);

        DB::transaction(function () use ($pr, $validated) {
            $pr->update(collect($validated)->except('items')->toArray());

            if (isset($validated['items']) && is_array($validated['items'])) {
                $pr->items()->delete();
                foreach ($validated['items'] as $idx => $itemData) {
                    $pr->items()->create([
                        'item_no' => $itemData['item_no'],
                        'unit' => $itemData['unit'] ?? null,
                        'item_description' => $itemData['item_description'],
                        'quantity' => $itemData['quantity'] ?? null,
                        'unit_cost' => $itemData['unit_cost'] ?? null,
                        'total_cost' => $itemData['total_cost'] ?? null,
                        'is_lot_header' => !empty($itemData['is_lot_header']),
                        'sort_order' => $idx + 1,
                    ]);
                }
            }
        });

        return response()->json([
            'message' => 'Purchase Request updated successfully.',
            'purchase_request' => $pr->fresh(['items', 'routes', 'office']),
        ]);
    }

    /**
     * Execute reviewer workflow transition
     * Flow: PR division -> BAC TWG -> PR division (Control) -> PR approved
     */
    public function review(Request $request, string $idOrUuid): JsonResponse
    {
        $this->authorizePims($request);
        $user = $request->user();

        $pr = PurchaseRequest::where('id', $idOrUuid)->orWhere('uuid', $idOrUuid)->firstOrFail();

        $validated = $request->validate([
            'action' => 'required|in:approve,return',
            'remarks' => 'nullable|string|max:2000',
            'return_to_stage' => 'nullable|string|in:end_user,pr_division,bac_twg',
            'assigned_pr_number' => 'nullable|string|max:100', // Option to assign/update official P.R No. during control
        ]);

        $action = $validated['action'];
        $remarks = trim($validated['remarks'] ?? '');
        $currentStage = $pr->current_stage;

        if ($action === 'return' && empty($remarks)) {
            return response()->json(['message' => 'Remarks/comments are strictly required when returning a Purchase Request.'], 422);
        }

        // Determine next stage & status based on review sequence
        $nextStage = $currentStage;
        $nextStatus = $pr->status;

        if ($action === 'approve') {
            switch ($currentStage) {
                case 'pr_division':
                    $nextStage = 'bac_twg';
                    $nextStatus = 'BAC_TWG_REVIEW';
                    $defaultRemark = "Approved by PR Division. Endorsed to BAC-TWG for technical evaluation.";
                    break;
                case 'bac_twg':
                    $nextStage = 'pr_control';
                    $nextStatus = 'PR_CONTROL_REVIEW';
                    $defaultRemark = "Technical specifications evaluated and approved by BAC-TWG. Forwarded to PR Division (Control).";
                    break;
                case 'pr_control':
                    $nextStage = 'approved';
                    $nextStatus = 'PR_APPROVED';
                    $defaultRemark = "PR control verification completed. Purchase Request officially APPROVED.";
                    break;
                default:
                    return response()->json(['message' => 'This Purchase Request is already completed.'], 400);
            }
        } else {
            // Return action
            $nextStage = $validated['return_to_stage'] ?? 'end_user';
            $nextStatus = 'RETURNED';
            $defaultRemark = "Returned from " . strtoupper(str_replace('_', ' ', $currentStage)) . " with feedback: {$remarks}";
        }

        $finalRemarks = $remarks ?: $defaultRemark;

        DB::transaction(function () use ($pr, $user, $currentStage, $nextStage, $nextStatus, $action, $finalRemarks, $validated) {
            $statusBefore = $pr->status;

            $updateData = [
                'current_stage' => $nextStage,
                'status' => $nextStatus,
                'remarks' => $finalRemarks,
            ];

            if (!empty($validated['assigned_pr_number'])) {
                $updateData['pr_number'] = trim($validated['assigned_pr_number']);
            }

            $pr->update($updateData);

            // Record routing history
            $pr->routes()->create([
                'from_user_id' => $user->id,
                'from_stage' => $currentStage,
                'to_stage' => $nextStage,
                'action' => $action,
                'status' => $nextStatus,
                'remarks' => $finalRemarks,
                'acted_at' => now(),
            ]);

            // If PR is approved, also update monitoring project step if present
            if ($nextStatus === 'PR_APPROVED' && $pr->monitoring_project_id) {
                $mp = MonitoringProject::find($pr->monitoring_project_id);
                if ($mp) {
                    $mp->steps()->where('division', 'pr_division')->update([
                        'status' => 'COMPLETED',
                        'completed_at' => now(),
                    ]);
                }
            }
        });

        AuditLog::log(
            'PURCHASE_REQUEST_REVIEWED',
            'purchase_requests',
            $pr->id,
            null,
            [
                'tracker_id' => $pr->tracker_id,
                'action' => $action,
                'from_stage' => $currentStage,
                'to_stage' => $nextStage,
                'remarks' => $finalRemarks,
            ],
            $user->id
        );

        return response()->json([
            'message' => $action === 'approve'
                ? "Purchase Request {$pr->tracker_id} successfully approved and forwarded to " . strtoupper(str_replace('_', ' ', $nextStage)) . "."
                : "Purchase Request {$pr->tracker_id} returned with remarks.",
            'purchase_request' => $pr->fresh(['items', 'routes.fromUser', 'office']),
        ]);
    }
}

