<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\FundSource;
use App\Models\Ppmp;
use App\Models\PpmpItem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class FundSourceController extends Controller
{
    /**
     * Determine if the authenticated user can manage (create, edit, delete, export) fund sources.
     * Allowed: Admin, Super Admin, Budget Officer, and PACCO Reviewer.
     */
    protected function canManage(Request $request): bool
    {
        $user = $request->user();
        return $user && ($user->isAdmin() || in_array($user->role, ['budget_officer', 'pacco'], true));
    }

    /**
     * List fund sources.
     * End-users receive active sources only. Admins, Budget Officers, and PACCO Reviewers view all with usage counts.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $canManage = $this->canManage($request);
        $activeOnly = $request->boolean('active_only') || !$canManage;

        $query = FundSource::query()->ordered();

        if ($activeOnly) {
            $query->active();
        }

        // Automatic role-based separation for PACCO Reviewer (Trust Funds only) and Budget Officer (General/Special only)
        if ($user && !$user->isAdmin()) {
            if ($user->role === 'pacco') {
                $query->where(function ($q) {
                    $q->where('workflow_route', 'pacco')
                      ->orWhere('category', 'Trust Fund');
                });
            } elseif ($user->role === 'budget_officer') {
                $query->where(function ($q) {
                    $q->where('workflow_route', 'budget')
                      ->where('category', '!=', 'Trust Fund');
                });
            }
        }

        if ($request->filled('category') && $request->category !== 'ALL') {
            $query->where('category', $request->category);
        }

        if ($request->filled('route') && $request->route !== 'ALL') {
            $query->where('workflow_route', $request->route);
        }

        if ($request->filled('search')) {
            $s = trim($request->search);
            $query->where(function ($q) use ($s) {
                $q->where('name', 'like', "%{$s}%")
                  ->orWhere('code', 'like', "%{$s}%")
                  ->orWhere('description', 'like', "%{$s}%");
            });
        }

        $fundSources = $query->get();

        // If privileged (Admin, Budget Officer, PACCO Reviewer), attach PPMP usage count to each source
        if ($canManage) {
            $usageByFk = Ppmp::select('fund_source_id', DB::raw('count(*) as count'))
                ->whereNotNull('fund_source_id')
                ->groupBy('fund_source_id')
                ->pluck('count', 'fund_source_id')
                ->toArray();

            $usageByName = Ppmp::select('source_of_fund', DB::raw('count(*) as count'))
                ->whereNotNull('source_of_fund')
                ->groupBy('source_of_fund')
                ->pluck('count', 'source_of_fund')
                ->toArray();

            $fundSources->transform(function ($item) use ($usageByFk, $usageByName) {
                $item->ppmps_count = ($usageByFk[$item->id] ?? 0) + ($usageByName[$item->name] ?? 0);
                return $item;
            });
        }

        return response()->json($fundSources);
    }

    /**
     * Create a new fund source (Admin, Budget Officer, and PACCO Reviewer).
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$this->canManage($request)) {
            return response()->json(['message' => 'Unauthorized. Admin, Budget Officer, or PACCO Reviewer access required.'], 403);
        }

        $validated = $request->validate([
            'name'           => 'required|string|max:255|unique:fund_sources,name',
            'code'           => 'nullable|string|max:50',
            'category'       => 'nullable|string|max:100',
            'workflow_route' => 'required|in:budget,pacco',
            'description'    => 'nullable|string',
            'is_active'      => 'boolean',
            'display_order'  => 'integer|min:0',
        ]);

        if ($user->role === 'pacco' && !$user->isAdmin()) {
            $validated['workflow_route'] = 'pacco';
            $validated['category'] = 'Trust Fund';
        } elseif ($user->role === 'budget_officer' && !$user->isAdmin()) {
            $validated['workflow_route'] = 'budget';
            if (($validated['category'] ?? '') === 'Trust Fund') {
                $validated['category'] = 'General Fund';
            }
        }

        $category = $validated['category'] ?? ($validated['workflow_route'] === 'pacco' ? 'Trust Fund' : 'General Fund');

        $fundSource = FundSource::create([
            'name'           => trim($validated['name']),
            'code'           => !empty($validated['code']) ? strtoupper(trim($validated['code'])) : null,
            'category'       => $category,
            'workflow_route' => $validated['workflow_route'],
            'description'    => $validated['description'] ?? null,
            'is_active'      => $validated['is_active'] ?? true,
            'display_order'  => $validated['display_order'] ?? 0,
        ]);

        AuditLog::log('FUND_SOURCE_CREATED', 'fund_sources', $fundSource->id, null, $fundSource->toArray(), $user->id);

        $fundSource->ppmps_count = 0;

        return response()->json([
            'message'     => 'Source of Fund created successfully.',
            'fund_source' => $fundSource,
        ], 201);
    }

    /**
     * Update an existing fund source (Admin, Budget Officer, and PACCO Reviewer).
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$this->canManage($request)) {
            return response()->json(['message' => 'Unauthorized. Admin, Budget Officer, or PACCO Reviewer access required.'], 403);
        }

        $fundSource = FundSource::findOrFail($id);

        $validated = $request->validate([
            'name'           => 'required|string|max:255|unique:fund_sources,name,' . $fundSource->id,
            'code'           => 'nullable|string|max:50',
            'category'       => 'nullable|string|max:100',
            'workflow_route' => 'required|in:budget,pacco',
            'description'    => 'nullable|string',
            'is_active'      => 'boolean',
            'display_order'  => 'integer|min:0',
        ]);

        $old = $fundSource->toArray();
        $oldName = $fundSource->name;
        $newName = trim($validated['name']);
        $category = $validated['category'] ?? $fundSource->category ?? ($validated['workflow_route'] === 'pacco' ? 'Trust Fund' : 'General Fund');

        $fundSource->update([
            'name'           => $newName,
            'code'           => !empty($validated['code']) ? strtoupper(trim($validated['code'])) : null,
            'category'       => $category,
            'workflow_route' => $validated['workflow_route'],
            'description'    => $validated['description'] ?? null,
            'is_active'      => $validated['is_active'] ?? $fundSource->is_active,
            'display_order'  => $validated['display_order'] ?? $fundSource->display_order,
        ]);

        // If the name changed, synchronize existing PPMPs that reference the old name
        if ($oldName !== $newName) {
            Ppmp::where('source_of_fund', $oldName)->update(['source_of_fund' => $newName]);
            PpmpItem::where('source_of_fund', $oldName)->update(['source_of_fund' => $newName]);
        }

        AuditLog::log('FUND_SOURCE_UPDATED', 'fund_sources', $fundSource->id, $old, $fundSource->toArray(), $user->id);

        $fundSource->ppmps_count = Ppmp::where('source_of_fund', $newName)
            ->orWhere('fund_source_id', $fundSource->id)
            ->count();

        return response()->json([
            'message'     => 'Source of Fund updated successfully.',
            'fund_source' => $fundSource,
        ]);
    }

    /**
     * Export all fund sources to Excel / CSV format (Admin, Budget Officer, and PACCO Reviewer).
     */
    public function export(Request $request)
    {
        $user = $request->user();
        if (!$this->canManage($request)) {
            return response()->json(['message' => 'Unauthorized. Admin, Budget Officer, or PACCO Reviewer access required.'], 403);
        }

        $query = FundSource::query()->ordered();

        if ($user && !$user->isAdmin()) {
            if ($user->role === 'pacco') {
                $query->where(function ($q) {
                    $q->where('workflow_route', 'pacco')
                      ->orWhere('category', 'Trust Fund');
                });
            } elseif ($user->role === 'budget_officer') {
                $query->where(function ($q) {
                    $q->where('workflow_route', 'budget')
                      ->where('category', '!=', 'Trust Fund');
                });
            }
        }

        if ($request->filled('category') && $request->category !== 'ALL') {
            $query->where('category', $request->category);
        }
        if ($request->filled('route') && $request->route !== 'ALL') {
            $query->where('workflow_route', $request->route);
        }

        $sources = $query->get();

        $usageByFk = Ppmp::select('fund_source_id', DB::raw('count(*) as count'))
            ->whereNotNull('fund_source_id')
            ->groupBy('fund_source_id')
            ->pluck('count', 'fund_source_id')
            ->toArray();

        $usageByName = Ppmp::select('source_of_fund', DB::raw('count(*) as count'))
            ->whereNotNull('source_of_fund')
            ->groupBy('source_of_fund')
            ->pluck('count', 'source_of_fund')
            ->toArray();

        $csvFileName = 'Fund_Sources_' . now()->format('Y-m-d_His') . '.csv';
        $headers = [
            'Content-Type' => 'text/csv; charset=UTF-8',
            'Content-Disposition' => "attachment; filename=\"{$csvFileName}\"",
            'Pragma' => 'no-cache',
            'Cache-Control' => 'must-revalidate, post-check=0, pre-check=0',
            'Expires' => '0',
        ];

        $callback = function () use ($sources, $usageByFk, $usageByName) {
            $output = fopen('php://output', 'w');
            fprintf($output, chr(0xEF).chr(0xBB).chr(0xBF)); // UTF-8 BOM for Excel
            fputcsv($output, ['ID', 'Source of Fund Name', 'Code', 'Category', 'Review Route', 'Status', 'PPMP Usage Count', 'Description', 'Display Order']);

            foreach ($sources as $s) {
                $count = ($usageByFk[$s->id] ?? 0) + ($usageByName[$s->name] ?? 0);
                fputcsv($output, [
                    $s->id,
                    $s->name,
                    $s->code ?? '',
                    $s->category ?? ($s->workflow_route === 'pacco' ? 'Trust Fund' : 'General Fund'),
                    $s->workflow_route === 'pacco' ? 'PACCO Reviewer' : 'Budget Officer',
                    $s->is_active ? 'Active' : 'Inactive',
                    $count,
                    $s->description ?? '',
                    $s->display_order,
                ]);
            }
            fclose($output);
        };

        return response()->stream($callback, 200, $headers);
    }

    /**
     * Delete a fund source (Admin, Budget Officer, and PACCO Reviewer).
     * Prevents deletion if existing PPMPs reference it.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$this->canManage($request)) {
            return response()->json(['message' => 'Unauthorized. Admin, Budget Officer, or PACCO Reviewer access required.'], 403);
        }

        $fundSource = FundSource::findOrFail($id);

        $ppmpsCount = Ppmp::where('source_of_fund', $fundSource->name)
            ->orWhere('fund_source_id', $fundSource->id)
            ->count();

        $itemsCount = PpmpItem::where('source_of_fund', $fundSource->name)
            ->orWhere('fund_source_id', $fundSource->id)
            ->count();

        $totalCount = $ppmpsCount + $itemsCount;

        if ($totalCount > 0) {
            return response()->json([
                'message' => "Cannot delete '{$fundSource->name}' because {$totalCount} record(s) are currently referencing it. You can deactivate it instead to hide it from new selections.",
            ], 422);
        }

        $old = $fundSource->toArray();
        $fundSource->delete();

        AuditLog::log('FUND_SOURCE_DELETED', 'fund_sources', $id, $old, null, $user->id);

        return response()->json([
            'message' => 'Source of Fund deleted successfully.',
        ]);
    }
}
