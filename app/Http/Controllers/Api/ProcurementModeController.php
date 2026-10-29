<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\MonitoringProject;
use App\Models\PpmpItem;
use App\Models\ProcurementMode;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProcurementModeController extends Controller
{
    /**
     * List procurement modes.
     * End-users / general callers receive active modes only.
     * Admins can view all modes with PPMP item and Monitoring project usage counts.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $isAdmin = $user && $user->isAdmin();
        $activeOnly = $request->boolean('active_only') || !$isAdmin;

        $query = ProcurementMode::query()->ordered();

        if ($activeOnly) {
            $query->active();
        }

        $modes = $query->get();

        // If admin viewing all, calculate usage counts from PPMP items and Monitoring projects
        if ($isAdmin && !$activeOnly) {
            $ppmpItemCounts = PpmpItem::select('procurement_mode', DB::raw('count(*) as count'))
                ->whereNotNull('procurement_mode')
                ->groupBy('procurement_mode')
                ->pluck('count', 'procurement_mode')
                ->toArray();

            $monitoringCounts = MonitoringProject::select('procurement_mode', DB::raw('count(*) as count'))
                ->whereNotNull('procurement_mode')
                ->groupBy('procurement_mode')
                ->pluck('count', 'procurement_mode')
                ->toArray();

            $modes->transform(function ($item) use ($ppmpItemCounts, $monitoringCounts) {
                $name = $item->name;
                $code = $item->code;

                $itemCount = ($ppmpItemCounts[$name] ?? 0) + ($code ? ($ppmpItemCounts[$code] ?? 0) : 0);
                $projectCount = ($monitoringCounts[$name] ?? 0) + ($code ? ($monitoringCounts[$code] ?? 0) : 0);

                $item->ppmp_items_count = $itemCount;
                $item->monitoring_projects_count = $projectCount;
                $item->usage_count = $itemCount + $projectCount;

                return $item;
            });
        }

        return response()->json($modes);
    }

    /**
     * Create a new mode of procurement (Admin only).
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $validated = $request->validate([
            'name'          => 'required|string|max:255|unique:procurement_modes,name',
            'code'          => 'nullable|string|max:50',
            'description'   => 'nullable|string',
            'is_active'     => 'boolean',
            'display_order' => 'integer|min:0',
        ]);

        $mode = ProcurementMode::create([
            'name'          => trim($validated['name']),
            'code'          => !empty($validated['code']) ? strtoupper(trim($validated['code'])) : null,
            'description'   => $validated['description'] ?? null,
            'is_active'     => $validated['is_active'] ?? true,
            'display_order' => $validated['display_order'] ?? 0,
        ]);

        AuditLog::log('PROCUREMENT_MODE_CREATED', 'procurement_modes', $mode->id, null, $mode->toArray(), $user->id);

        $mode->ppmp_items_count = 0;
        $mode->monitoring_projects_count = 0;
        $mode->usage_count = 0;

        return response()->json([
            'message'          => 'Mode of Procurement created successfully.',
            'procurement_mode' => $mode,
        ], 201);
    }

    /**
     * Update an existing mode of procurement (Admin only).
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $mode = ProcurementMode::findOrFail($id);

        $validated = $request->validate([
            'name'          => 'required|string|max:255|unique:procurement_modes,name,' . $mode->id,
            'code'          => 'nullable|string|max:50',
            'description'   => 'nullable|string',
            'is_active'     => 'boolean',
            'display_order' => 'integer|min:0',
        ]);

        $old = $mode->toArray();
        $oldName = $mode->name;
        $newName = trim($validated['name']);

        $mode->update([
            'name'          => $newName,
            'code'          => !empty($validated['code']) ? strtoupper(trim($validated['code'])) : null,
            'description'   => $validated['description'] ?? null,
            'is_active'     => $validated['is_active'] ?? $mode->is_active,
            'display_order' => $validated['display_order'] ?? $mode->display_order,
        ]);

        // If the name changed, keep data integrity by updating existing PPMP items & monitoring projects referencing old name
        if ($oldName !== $newName) {
            PpmpItem::where('procurement_mode', $oldName)->update(['procurement_mode' => $newName]);
            MonitoringProject::where('procurement_mode', $oldName)->update(['procurement_mode' => $newName]);
        }

        AuditLog::log('PROCUREMENT_MODE_UPDATED', 'procurement_modes', $mode->id, $old, $mode->toArray(), $user->id);

        $code = $mode->code;
        $itemCount = PpmpItem::where('procurement_mode', $newName)->orWhere(function ($q) use ($code) {
            if ($code) $q->where('procurement_mode', $code);
        })->count();
        $projectCount = MonitoringProject::where('procurement_mode', $newName)->orWhere(function ($q) use ($code) {
            if ($code) $q->where('procurement_mode', $code);
        })->count();

        $mode->ppmp_items_count = $itemCount;
        $mode->monitoring_projects_count = $projectCount;
        $mode->usage_count = $itemCount + $projectCount;

        return response()->json([
            'message'          => 'Mode of Procurement updated successfully.',
            'procurement_mode' => $mode,
        ]);
    }

    /**
     * Toggle the active status of a mode of procurement (Admin only).
     */
    public function toggleStatus(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $mode = ProcurementMode::findOrFail($id);
        $old = $mode->toArray();

        $mode->is_active = !$mode->is_active;
        $mode->save();

        AuditLog::log('PROCUREMENT_MODE_TOGGLED', 'procurement_modes', $mode->id, $old, $mode->toArray(), $user->id);

        return response()->json([
            'message'          => 'Mode status updated to ' . ($mode->is_active ? 'Active' : 'Inactive') . '.',
            'procurement_mode' => $mode,
        ]);
    }

    /**
     * Delete a mode of procurement (Admin only).
     * Prevents deletion if existing PPMP items or Monitoring projects reference it.
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $mode = ProcurementMode::findOrFail($id);

        $name = $mode->name;
        $code = $mode->code;

        $itemsCount = PpmpItem::where('procurement_mode', $name)
            ->when($code, fn($q) => $q->orWhere('procurement_mode', $code))
            ->count();

        $projectsCount = MonitoringProject::where('procurement_mode', $name)
            ->when($code, fn($q) => $q->orWhere('procurement_mode', $code))
            ->count();

        if ($itemsCount > 0 || $projectsCount > 0) {
            $parts = [];
            if ($itemsCount > 0) $parts[] = "{$itemsCount} PPMP item(s)";
            if ($projectsCount > 0) $parts[] = "{$projectsCount} Monitoring project(s)";
            $usageStr = implode(' and ', $parts);

            return response()->json([
                'message' => "Cannot delete '{$mode->name}' because {$usageStr} are currently referencing it. You can deactivate it instead to hide it from future dropdown selections.",
            ], 422);
        }

        $old = $mode->toArray();
        $mode->delete();

        AuditLog::log('PROCUREMENT_MODE_DELETED', 'procurement_modes', $id, $old, null, $user->id);

        return response()->json([
            'message' => 'Mode of Procurement deleted successfully.',
        ]);
    }
}
