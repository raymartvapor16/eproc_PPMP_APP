<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PortalSystem;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PortalSystemController extends Controller
{
    /**
     * Public list of active systems for the landing page
     */
    public function publicIndex(): JsonResponse
    {
        $systems = PortalSystem::active()->get();
        return response()->json($systems);
    }

    /**
     * Super Admin list of all systems
     */
    public function index(Request $request): JsonResponse
    {
        $systems = PortalSystem::orderBy('sort_order', 'asc')->orderBy('id', 'asc')->get();
        return response()->json($systems);
    }

    /**
     * Normalize link URL and determine if it is external
     */
    protected function normalizeLinkData(array $data): array
    {
        if (isset($data['link_url'])) {
            $url = trim($data['link_url']);
            $isExternal = !empty($data['is_external']);

            // Detect external URL if starts with http://, https://, //, or looks like a web domain without leading /
            if (preg_match('#^(https?://|//)#i', $url)) {
                $isExternal = true;
            } elseif (!str_starts_with($url, '/') && !str_starts_with($url, '#') && str_contains($url, '.')) {
                $url = 'https://' . $url;
                $isExternal = true;
            } elseif ($isExternal && !str_starts_with($url, '/') && !preg_match('#^https?://#i', $url)) {
                $url = 'https://' . $url;
            }

            $data['link_url'] = $url;
            $data['is_external'] = $isExternal;
        }

        return $data;
    }

    /**
     * Super Admin create system
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'link_url' => 'required|string|max:500',
            'badge' => 'nullable|string|max:100',
            'icon' => 'nullable|string|max:100',
            'color' => 'nullable|string|max:50',
            'status' => 'required|in:active,inactive',
            'sort_order' => 'nullable|integer',
            'is_external' => 'nullable|boolean',
        ]);

        $validated = $this->normalizeLinkData($validated);

        $system = PortalSystem::create([
            'name' => $validated['name'],
            'description' => $validated['description'] ?? null,
            'link_url' => $validated['link_url'],
            'badge' => $validated['badge'] ?? null,
            'icon' => $validated['icon'] ?? 'FileSpreadsheet',
            'color' => $validated['color'] ?? 'blue',
            'status' => $validated['status'],
            'sort_order' => $validated['sort_order'] ?? (PortalSystem::max('sort_order') + 1),
            'is_external' => $validated['is_external'] ?? false,
        ]);

        return response()->json([
            'message' => 'Portal system created successfully.',
            'system' => $system,
        ], 201);
    }

    /**
     * Super Admin update system
     */
    public function update(Request $request, int $id): JsonResponse
    {
        $system = PortalSystem::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'link_url' => 'sometimes|required|string|max:500',
            'badge' => 'nullable|string|max:100',
            'icon' => 'nullable|string|max:100',
            'color' => 'nullable|string|max:50',
            'status' => 'sometimes|required|in:active,inactive',
            'sort_order' => 'nullable|integer',
            'is_external' => 'nullable|boolean',
        ]);

        $validated = $this->normalizeLinkData($validated);

        $system->update($validated);

        return response()->json([
            'message' => 'Portal system updated successfully.',
            'system' => $system,
        ]);
    }

    /**
     * Super Admin delete system
     */
    public function destroy(int $id): JsonResponse
    {
        $system = PortalSystem::findOrFail($id);
        $system->delete();

        return response()->json([
            'message' => 'Portal system deleted successfully.',
        ]);
    }

    /**
     * Super Admin toggle active status
     */
    public function toggleStatus(int $id): JsonResponse
    {
        $system = PortalSystem::findOrFail($id);
        $system->status = $system->status === 'active' ? 'inactive' : 'active';
        $system->save();

        return response()->json([
            'message' => "Portal system status updated to {$system->status}.",
            'system' => $system,
        ]);
    }
}
