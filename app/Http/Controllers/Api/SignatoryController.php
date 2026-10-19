<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\PpmpSignatory;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SignatoryController extends Controller
{
    /**
     * Get all active signatories (public for authenticated users)
     */
    public function index(): JsonResponse
    {
        $signatories = PpmpSignatory::orderBy('signatory_type')->latest('id')->get();
        return response()->json($signatories);
    }

    /**
     * Store new signatory (Admin only)
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin()) {
            return response()->json(['message' => 'Only Administrators can configure official signatories.'], 403);
        }

        $validated = $request->validate([
            'signatory_type' => 'required|in:budget_requirement,pacco_requirement,bac_secretariat,approved_by,app_prepared_by,app_reviewed_by,app_recommending,app_approved_by',
            'name' => 'required|string|max:255',
            'position' => 'required|string|max:255',
            'is_active' => 'nullable|boolean',
        ]);

        $isActive = $request->boolean('is_active', true);

        // If this new one is active, deactivate others of the exact same type
        if ($isActive) {
            PpmpSignatory::where('signatory_type', $validated['signatory_type'])->update(['is_active' => false]);
        }

        $signatory = PpmpSignatory::create([
            'signatory_type' => $validated['signatory_type'],
            'name' => $validated['name'],
            'position' => $validated['position'],
            'is_active' => $isActive,
        ]);

        AuditLog::log('SIGNATORY_CREATED', 'ppmp_signatories', $signatory->id, null, $signatory->toArray(), $user->id);

        return response()->json([
            'message' => 'Official signatory added successfully.',
            'signatory' => $signatory,
        ], 201);
    }

    /**
     * Update signatory (Admin only)
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin()) {
            return response()->json(['message' => 'Only Administrators can configure official signatories.'], 403);
        }

        $signatory = PpmpSignatory::findOrFail($id);

        $validated = $request->validate([
            'signatory_type' => 'nullable|in:budget_requirement,pacco_requirement,bac_secretariat,approved_by,app_prepared_by,app_reviewed_by,app_recommending,app_approved_by',
            'name' => 'required|string|max:255',
            'position' => 'required|string|max:255',
            'is_active' => 'nullable|boolean',
        ]);

        $old = $signatory->toArray();
        $targetType = $validated['signatory_type'] ?? $signatory->signatory_type;

        if ($request->has('is_active') && $request->boolean('is_active')) {
            PpmpSignatory::where('signatory_type', $targetType)
                ->where('id', '!=', $signatory->id)
                ->update(['is_active' => false]);
        }

        $signatory->update($validated);

        AuditLog::log('SIGNATORY_UPDATED', 'ppmp_signatories', $signatory->id, $old, $signatory->toArray(), $user->id);

        return response()->json([
            'message' => 'Official signatory updated successfully.',
            'signatory' => $signatory,
        ]);
    }

    /**
     * Delete signatory (Admin only)
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isAdmin()) {
            return response()->json(['message' => 'Only Administrators can remove signatories.'], 403);
        }

        $signatory = PpmpSignatory::findOrFail($id);
        $old = $signatory->toArray();
        $signatory->delete();

        AuditLog::log('SIGNATORY_DELETED', 'ppmp_signatories', $id, $old, null, $user->id);

        return response()->json([
            'message' => 'Signatory removed successfully.',
        ]);
    }
}
