<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\SupportingDocument;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SupportingDocumentController extends Controller
{
    /**
     * List supporting documents.
     * End-users receive active documents only. Admins can view all.
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $isAdmin = $user && $user->isAdmin();
        $activeOnly = $request->boolean('active_only') || !$isAdmin;

        $query = SupportingDocument::query()->ordered();

        if ($activeOnly) {
            $query->active();
        }

        $documents = $query->get();

        return response()->json($documents);
    }

    /**
     * Create a new supporting document (Admin only).
     */
    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $validated = $request->validate([
            'name'          => 'required|string|max:255|unique:supporting_documents,name',
            'description'   => 'nullable|string',
            'is_active'     => 'boolean',
            'display_order' => 'integer|min:0',
        ]);

        $doc = SupportingDocument::create([
            'name'          => trim($validated['name']),
            'description'   => isset($validated['description']) ? trim($validated['description']) : null,
            'is_active'     => $validated['is_active'] ?? true,
            'display_order' => $validated['display_order'] ?? 0,
        ]);

        AuditLog::log('SUPPORTING_DOCUMENT_CREATED', 'supporting_documents', $doc->id, null, $doc->toArray(), $user->id);

        return response()->json([
            'message'  => 'Supporting document created successfully.',
            'document' => $doc,
        ], 201);
    }

    /**
     * Update an existing supporting document (Admin only).
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $doc = SupportingDocument::findOrFail($id);

        $validated = $request->validate([
            'name'          => 'required|string|max:255|unique:supporting_documents,name,' . $doc->id,
            'description'   => 'nullable|string',
            'is_active'     => 'boolean',
            'display_order' => 'integer|min:0',
        ]);

        $old = $doc->toArray();

        $doc->update([
            'name'          => trim($validated['name']),
            'description'   => array_key_exists('description', $validated) ? ($validated['description'] !== null ? trim($validated['description']) : null) : $doc->description,
            'is_active'     => $validated['is_active'] ?? $doc->is_active,
            'display_order' => $validated['display_order'] ?? $doc->display_order,
        ]);

        AuditLog::log('SUPPORTING_DOCUMENT_UPDATED', 'supporting_documents', $doc->id, $old, $doc->toArray(), $user->id);

        return response()->json([
            'message'  => 'Supporting document updated successfully.',
            'document' => $doc,
        ]);
    }

    /**
     * Delete a supporting document (Admin only).
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $doc = SupportingDocument::findOrFail($id);
        $old = $doc->toArray();
        $doc->delete();

        AuditLog::log('SUPPORTING_DOCUMENT_DELETED', 'supporting_documents', $id, $old, null, $user->id);

        return response()->json([
            'message' => 'Supporting document deleted successfully.',
        ]);
    }
}
