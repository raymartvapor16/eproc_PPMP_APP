<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\OtherTerm;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class OtherTermController extends Controller
{

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $isAdmin = $user && $user->isAdmin();
        $activeOnly = $request->boolean('active_only') || !$isAdmin;

        $query = OtherTerm::query()->ordered();

        if ($activeOnly) {
            $query->active();
        }

        if ($request->filled('category')) {
            $query->where('category', $request->input('category'));
        }

        $terms = $query->get();

        return response()->json($terms);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $validated = $request->validate([
            'name'          => 'required|string|max:255|unique:other_terms,name',
            'category'      => 'nullable|string|max:100',
            'description'   => 'required|string',
            'is_active'     => 'boolean',
            'display_order' => 'integer|min:0',
        ]);

        $term = OtherTerm::create([
            'name'          => trim($validated['name']),
            'category'      => !empty($validated['category']) ? trim($validated['category']) : 'CSE',
            'description'   => trim($validated['description']),
            'is_active'     => $validated['is_active'] ?? true,
            'display_order' => $validated['display_order'] ?? 0,
        ]);

        AuditLog::log('OTHER_TERM_CREATED', 'other_terms', $term->id, null, $term->toArray(), $user->id);

        return response()->json([
            'message' => 'Other Term / Green Specification created successfully.',
            'term'    => $term,
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $term = OtherTerm::findOrFail($id);

        $validated = $request->validate([
            'name'          => 'required|string|max:255|unique:other_terms,name,' . $term->id,
            'category'      => 'nullable|string|max:100',
            'description'   => 'required|string',
            'is_active'     => 'boolean',
            'display_order' => 'integer|min:0',
        ]);

        $old = $term->toArray();

        $term->update([
            'name'          => trim($validated['name']),
            'category'      => !empty($validated['category']) ? trim($validated['category']) : $term->category,
            'description'   => trim($validated['description']),
            'is_active'     => $validated['is_active'] ?? $term->is_active,
            'display_order' => $validated['display_order'] ?? $term->display_order,
        ]);

        AuditLog::log('OTHER_TERM_UPDATED', 'other_terms', $term->id, $old, $term->toArray(), $user->id);

        return response()->json([
            'message' => 'Other Term / Green Specification updated successfully.',
            'term'    => $term,
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $term = OtherTerm::findOrFail($id);
        $old = $term->toArray();
        $term->delete();

        AuditLog::log('OTHER_TERM_DELETED', 'other_terms', $id, $old, null, $user->id);

        return response()->json([
            'message' => 'Other Term / Green Specification deleted successfully.',
        ]);
    }
}
