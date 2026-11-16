<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountCode;
use App\Models\AuditLog;
use App\Models\Ppmp;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AccountCodeController extends Controller
{
    /**
     * Public active account codes for registration dropdown/checkboxes.
     */
    public function publicDropdown(Request $request): JsonResponse
    {
        $codes = AccountCode::where('is_active', true)
            ->select(['id', 'code', 'name', 'account_class', 'parent_name'])
            ->orderBy('display_order', 'asc')
            ->orderBy('code', 'asc')
            ->get();

        return response()->json($codes);
    }

    /**
     * List account codes.
     * Supports:
     *  - Paginated list with filtering for Admin management (avoiding any UI/system lag)
     *  - Fast dropdown list for PPMP create/edit forms (active only, optimized fields)
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $isAdmin = $user && $user->isAdmin();

        $query = AccountCode::query();

        // 1. Status Filter
        $status = strtolower($request->input('status', ''));
        if ($status === 'active' || (!$isAdmin && !$request->has('status'))) {
            $query->where('is_active', true);
        } elseif ($status === 'inactive') {
            $query->where('is_active', false);
        }

        // 2. Class Filter (Expenses, Assets, Liabilities, Equity, Income)
        $accountClass = $request->input('account_class', $request->input('class'));
        if (!empty($accountClass) && $accountClass !== 'ALL') {
            $query->where('account_class', $accountClass);
        }

        // 3. Search query filter
        $search = trim((string) $request->input('search', $request->input('q', '')));
        if (!empty($search)) {
            $query->where(function ($q) use ($search) {
                $q->where('code', 'like', "%{$search}%")
                    ->orWhere('name', 'like', "%{$search}%")
                    ->orWhere('sub_code', 'like', "%{$search}%")
                    ->orWhere('parent_name', 'like', "%{$search}%")
                    ->orWhere('full_description', 'like', "%{$search}%");
            });
        }

        // Fast Dropdown Mode: If all=1 or dropdown=1
        if ($request->boolean('all') || $request->boolean('dropdown')) {
            $limit = $request->integer('limit', 0);
            $codesQuery = $query->select([
                'id',
                'code',
                'name',
                'sub_code',
                'parent_name',
                'account_class',
                'full_description',
                'is_active',
            ])->orderBy('display_order', 'asc')->orderBy('code', 'asc');

            if ($limit > 0) {
                $codesQuery->limit($limit);
            }

            return response()->json($codesQuery->get());
        }

        // Paginated Admin Mode
        $perPage = max(10, min(100, $request->integer('per_page', 20)));

        $query->withCount('ppmps')
            ->orderBy('display_order', 'asc')
            ->orderBy('code', 'asc');

        $paginated = $query->paginate($perPage);

        return response()->json($paginated);
    }

    /**
     * Statistics summary for Admin Management Dashboard.
     */
    public function stats(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $total = AccountCode::count();
        $active = AccountCode::where('is_active', true)->count();
        $inactive = $total - $active;

        $classCounts = AccountCode::select('account_class', DB::raw('count(*) as count'))
            ->groupBy('account_class')
            ->pluck('count', 'account_class')
            ->toArray();

        $totalPpmpUsage = Ppmp::whereNotNull('account_code_id')->count();

        return response()->json([
            'total' => $total,
            'active' => $active,
            'inactive' => $inactive,
            'classes' => [
                'Expenses' => $classCounts['Expenses'] ?? 0,
                'Assets' => $classCounts['Assets'] ?? 0,
                'Liabilities' => $classCounts['Liabilities'] ?? 0,
                'Income' => $classCounts['Income'] ?? 0,
                'Equity' => $classCounts['Equity'] ?? 0,
                'Other' => $classCounts['Other'] ?? 0,
            ],
            'total_ppmps_linked' => $totalPpmpUsage,
        ]);
    }

    /**
     * Store a new account code (Admin and Super Admin only).
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $validated = $request->validate([
            'code' => 'nullable|string|max:50',
            'name' => 'required|string|max:255',
            'sub_code' => 'nullable|string|max:50',
            'parent_name' => 'nullable|string|max:255',
            'account_class' => 'nullable|string|max:50',
            'full_description' => 'nullable|string',
            'is_active' => 'boolean',
            'display_order' => 'integer|min:0',
        ]);

        $code = !empty($validated['code']) ? trim($validated['code']) : null;
        $name = trim($validated['name']);

        // Check for duplicates
        $duplicate = AccountCode::where('code', $code)->where('name', $name)->first();
        if ($duplicate) {
            return response()->json([
                'message' => 'An account code with this exact code and name already exists.',
                'errors' => ['name' => ['This code and account title is already registered in the Chart of Accounts.']]
            ], 422);
        }

        $accountClass = $validated['account_class'] ?? AccountCode::deriveAccountClass($code);

        $fullDescription = $validated['full_description'] ?? null;
        if (empty($fullDescription)) {
            $fullDescription = $code ? "{$code} • {$name}" : $name;
        }

        $accountCode = AccountCode::create([
            'code' => $code,
            'name' => $name,
            'sub_code' => $validated['sub_code'] ?? null,
            'parent_name' => $validated['parent_name'] ?? null,
            'account_class' => $accountClass,
            'full_description' => $fullDescription,
            'is_active' => $validated['is_active'] ?? true,
            'display_order' => $validated['display_order'] ?? 0,
        ]);

        if (class_exists(AuditLog::class)) {
            AuditLog::log(
                'ACCOUNT_CODE_CREATED',
                'account_codes',
                $accountCode->id,
                null,
                ['code' => $accountCode->code, 'name' => $accountCode->name],
                $user->id
            );
        }

        return response()->json([
            'message' => 'Account code created successfully.',
            'data' => $accountCode,
        ], 201);
    }

    /**
     * Display the specified account code.
     */
    public function show(int $id): JsonResponse
    {
        $accountCode = AccountCode::withCount('ppmps')->findOrFail($id);
        return response()->json($accountCode);
    }

    /**
     * Update the specified account code (Admin only).
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $accountCode = AccountCode::findOrFail($id);

        $validated = $request->validate([
            'code' => 'nullable|string|max:50',
            'name' => 'required|string|max:255',
            'sub_code' => 'nullable|string|max:50',
            'parent_name' => 'nullable|string|max:255',
            'account_class' => 'nullable|string|max:50',
            'full_description' => 'nullable|string',
            'is_active' => 'boolean',
            'display_order' => 'integer|min:0',
        ]);

        $code = !empty($validated['code']) ? trim($validated['code']) : null;
        $name = trim($validated['name']);

        // Check for duplicate with different ID
        $duplicate = AccountCode::where('code', $code)
            ->where('name', $name)
            ->where('id', '!=', $id)
            ->first();

        if ($duplicate) {
            return response()->json([
                'message' => 'An account code with this exact code and name already exists.',
                'errors' => ['name' => ['This code and account title already belongs to another entry in the Chart of Accounts.']]
            ], 422);
        }

        $accountClass = $validated['account_class'] ?? AccountCode::deriveAccountClass($code);

        $fullDescription = $validated['full_description'] ?? null;
        if (empty($fullDescription)) {
            $fullDescription = $code ? "{$code} • {$name}" : $name;
        }

        $accountCode->update([
            'code' => $code,
            'name' => $name,
            'sub_code' => $validated['sub_code'] ?? null,
            'parent_name' => $validated['parent_name'] ?? null,
            'account_class' => $accountClass,
            'full_description' => $fullDescription,
            'is_active' => $validated['is_active'] ?? $accountCode->is_active,
            'display_order' => $validated['display_order'] ?? $accountCode->display_order,
        ]);

        if (class_exists(AuditLog::class)) {
            AuditLog::log(
                'ACCOUNT_CODE_UPDATED',
                'account_codes',
                $accountCode->id,
                ['code' => $accountCode->getOriginal('code'), 'name' => $accountCode->getOriginal('name')],
                ['code' => $accountCode->code, 'name' => $accountCode->name],
                $user->id
            );
        }

        return response()->json([
            'message' => 'Account code updated successfully.',
            'data' => $accountCode->fresh()->loadCount('ppmps'),
        ]);
    }

    /**
     * Toggle active/inactive status (Admin only).
     */
    public function toggleStatus(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $accountCode = AccountCode::findOrFail($id);
        $accountCode->is_active = !$accountCode->is_active;
        $accountCode->save();

        if (class_exists(AuditLog::class)) {
            AuditLog::log(
                'ACCOUNT_CODE_TOGGLED',
                'account_codes',
                $accountCode->id,
                ['is_active' => !$accountCode->is_active],
                ['is_active' => $accountCode->is_active],
                $user->id
            );
        }

        return response()->json([
            'message' => "Account code marked as " . ($accountCode->is_active ? 'active' : 'inactive') . ".",
            'data' => $accountCode->loadCount('ppmps'),
        ]);
    }

    /**
     * Delete an account code (Admin only).
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $accountCode = AccountCode::withCount('ppmps')->findOrFail($id);

        if ($accountCode->ppmps_count > 0) {
            return response()->json([
                'message' => "Cannot delete account code [{$accountCode->code}] {$accountCode->name} because it is currently linked to {$accountCode->ppmps_count} PPMP record(s). You can deactivate it instead to prevent new selections."
            ], 422);
        }

        $backupInfo = [
            'id' => $accountCode->id,
            'code' => $accountCode->code,
            'name' => $accountCode->name,
        ];

        $accountCode->delete();

        if (class_exists(AuditLog::class)) {
            AuditLog::log(
                'ACCOUNT_CODE_DELETED',
                'account_codes',
                $accountCode->id,
                $backupInfo,
                null,
                $user->id
            );
        }

        return response()->json([
            'message' => 'Account code deleted successfully.'
        ]);
    }
}
