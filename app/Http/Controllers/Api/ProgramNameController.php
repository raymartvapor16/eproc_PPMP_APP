<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\ProgramName;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class ProgramNameController extends Controller
{

    public function index(Request $request): JsonResponse
    {

        if ($request->boolean('dropdown') || $request->boolean('all')) {
            $query = ProgramName::query();

            if (!$request->has('include_inactive')) {
                $query->active();
            }

            if ($request->filled('search')) {
                $query->filter(['search' => $request->query('search')]);
            }

            if ($request->filled('sector') && $request->query('sector') !== 'ALL') {
                $query->where('sector', $request->query('sector'));
            }

            $programs = $query->orderBy('sector', 'asc')
                ->orderBy('display_order', 'asc')
                ->orderBy('name', 'asc')
                ->get(['id', 'name', 'responsibility_center', 'sector', 'is_active']);

            return response()->json($programs);
        }

        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $perPage = (int) $request->query('per_page', 25);
        if ($perPage < 5) $perPage = 15;
        if ($perPage > 100) $perPage = 100;

        $query = ProgramName::query()
            ->withCount('ppmps')
            ->filter([
                'search' => $request->query('search'),
                'sector' => $request->query('sector'),
                'status' => $request->query('status', 'all'),
            ]);

        $sortBy = $request->query('sort_by', 'display_order');
        $sortDir = strtolower($request->query('sort_dir', 'asc')) === 'desc' ? 'desc' : 'asc';
        $allowedSorts = ['id', 'name', 'responsibility_center', 'sector', 'is_active', 'display_order', 'ppmps_count', 'created_at'];

        if (in_array($sortBy, $allowedSorts, true)) {
            $query->orderBy($sortBy, $sortDir);
        } else {
            $query->orderBy('display_order', 'asc')->orderBy('name', 'asc');
        }

        $paginated = $query->paginate($perPage);

        return response()->json($paginated);
    }

    public function stats(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $total = ProgramName::count();
        $active = ProgramName::where('is_active', true)->count();
        $inactive = $total - $active;

        $sectors = ProgramName::select('sector', DB::raw('count(*) as count'))
            ->groupBy('sector')
            ->orderBy('sector', 'asc')
            ->get();

        $totalPpmpsLinked = DB::table('ppmps')
            ->whereNotNull('program_name_id')
            ->count();

        return response()->json([
            'total' => $total,
            'active' => $active,
            'inactive' => $inactive,
            'sectors' => $sectors,
            'total_ppmps_linked' => $totalPpmpsLinked,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:500',
                Rule::unique('program_names')->where(function ($query) use ($request) {
                    return $query->where('name', trim($request->input('name')))
                        ->where('responsibility_center', trim($request->input('responsibility_center') ?? ''));
                }),
            ],
            'responsibility_center' => 'nullable|string|max:100',
            'sector' => 'nullable|string|max:150',
            'is_active' => 'nullable|boolean',
            'display_order' => 'nullable|integer',
        ], [
            'name.unique' => 'A program with this exact name and responsibility center already exists.',
        ]);

        $program = ProgramName::create([
            'name' => trim($validated['name']),
            'responsibility_center' => !empty($validated['responsibility_center']) ? trim($validated['responsibility_center']) : null,
            'sector' => !empty($validated['sector']) ? trim($validated['sector']) : 'I. GENERAL PUBLIC SERVICES',
            'is_active' => $validated['is_active'] ?? true,
            'display_order' => $validated['display_order'] ?? 0,
        ]);

        if (class_exists(AuditLog::class)) {
            AuditLog::log(
                'PROGRAM_NAME_CREATED',
                'program_names',
                $program->id,
                null,
                ['name' => $program->name, 'responsibility_center' => $program->responsibility_center],
                $user->id
            );
        }

        return response()->json([
            'message' => 'Program name created successfully.',
            'data' => $program,
        ], 201);
    }

    public function show(Request $request, int $id): JsonResponse
    {
        $program = ProgramName::withCount('ppmps')->findOrFail($id);
        return response()->json(['data' => $program]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $program = ProgramName::findOrFail($id);

        $validated = $request->validate([
            'name' => [
                'required',
                'string',
                'max:500',
                Rule::unique('program_names')->ignore($id)->where(function ($query) use ($request) {
                    return $query->where('name', trim($request->input('name')))
                        ->where('responsibility_center', trim($request->input('responsibility_center') ?? ''));
                }),
            ],
            'responsibility_center' => 'nullable|string|max:100',
            'sector' => 'nullable|string|max:150',
            'is_active' => 'nullable|boolean',
            'display_order' => 'nullable|integer',
        ], [
            'name.unique' => 'Another program with this exact name and responsibility center already exists.',
        ]);

        $oldValues = [
            'name' => $program->name,
            'responsibility_center' => $program->responsibility_center,
            'sector' => $program->sector,
            'is_active' => $program->is_active,
        ];

        $program->update([
            'name' => trim($validated['name']),
            'responsibility_center' => !empty($validated['responsibility_center']) ? trim($validated['responsibility_center']) : null,
            'sector' => !empty($validated['sector']) ? trim($validated['sector']) : $program->sector,
            'is_active' => $validated['is_active'] ?? $program->is_active,
            'display_order' => $validated['display_order'] ?? $program->display_order,
        ]);

        if (class_exists(AuditLog::class)) {
            AuditLog::log(
                'PROGRAM_NAME_UPDATED',
                'program_names',
                $program->id,
                $oldValues,
                ['name' => $program->name, 'responsibility_center' => $program->responsibility_center],
                $user->id
            );
        }

        return response()->json([
            'message' => 'Program name updated successfully.',
            'data' => $program->fresh()->loadCount('ppmps'),
        ]);
    }

    public function toggleStatus(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $program = ProgramName::findOrFail($id);
        $program->is_active = !$program->is_active;
        $program->save();

        if (class_exists(AuditLog::class)) {
            AuditLog::log(
                'PROGRAM_NAME_TOGGLED',
                'program_names',
                $program->id,
                ['is_active' => !$program->is_active],
                ['is_active' => $program->is_active],
                $user->id
            );
        }

        return response()->json([
            'message' => 'Program marked as ' . ($program->is_active ? 'active' : 'inactive') . '.',
            'data' => $program->loadCount('ppmps'),
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $program = ProgramName::withCount('ppmps')->findOrFail($id);

        if ($program->ppmps_count > 0) {
            return response()->json([
                'message' => "Cannot delete program \"{$program->name}\" because it is currently linked to {$program->ppmps_count} PPMP record(s). You can deactivate it instead to prevent new selections."
            ], 422);
        }

        $backupInfo = [
            'id' => $program->id,
            'name' => $program->name,
            'responsibility_center' => $program->responsibility_center,
        ];

        $program->delete();

        if (class_exists(AuditLog::class)) {
            AuditLog::log(
                'PROGRAM_NAME_DELETED',
                'program_names',
                $program->id,
                $backupInfo,
                null,
                $user->id
            );
        }

        return response()->json([
            'message' => 'Program name deleted successfully.'
        ]);
    }
}
