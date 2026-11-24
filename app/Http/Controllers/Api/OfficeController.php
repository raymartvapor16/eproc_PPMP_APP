<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Office;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class OfficeController extends Controller
{

    public function index(): JsonResponse
    {
        $offices = Office::with(['head:id,name,designation'])->orderBy('name')->get();
        return response()->json($offices);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized. Super Admin access required.'], 403);
        }

        $validated = $request->validate([
            'office_name' => 'required|string|max:255',
            'abbreviation' => 'required|string|max:50|unique:offices,code',
            'head_name' => 'nullable|string|max:255',
            'designation' => 'nullable|string|max:255',
            'responsibility_number' => 'nullable|string|max:100',
        ]);

        $office = Office::create([
            'name' => $validated['office_name'],
            'code' => strtoupper(trim($validated['abbreviation'])),
            'head_name' => $validated['head_name'] ?? null,
            'designation' => $validated['designation'] ?? null,
            'responsibility_number' => $validated['responsibility_number'] ?? null,
        ]);

        AuditLog::log('OFFICE_CREATED', 'offices', $office->id, null, $office->toArray(), $user->id);

        return response()->json([
            'message' => 'Office created successfully.',
            'office' => $office,
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized. Super Admin access required.'], 403);
        }

        $office = Office::findOrFail($id);

        $validated = $request->validate([
            'office_name' => 'required|string|max:255',
            'abbreviation' => 'required|string|max:50|unique:offices,code,' . $office->id,
            'head_name' => 'nullable|string|max:255',
            'designation' => 'nullable|string|max:255',
            'responsibility_number' => 'nullable|string|max:100',
        ]);

        $old = $office->toArray();

        $office->update([
            'name' => $validated['office_name'],
            'code' => strtoupper(trim($validated['abbreviation'])),
            'head_name' => $validated['head_name'] ?? null,
            'designation' => $validated['designation'] ?? null,
            'responsibility_number' => $validated['responsibility_number'] ?? null,
        ]);

        AuditLog::log('OFFICE_UPDATED', 'offices', $office->id, $old, $office->toArray(), $user->id);

        return response()->json([
            'message' => 'Office updated successfully.',
            'office' => $office,
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized. Super Admin access required.'], 403);
        }

        $office = Office::withCount(['users', 'ppmps'])->findOrFail($id);

        if ($office->users_count > 0 || $office->ppmps_count > 0) {
            return response()->json([
                'message' => 'Cannot delete this office because active users or PPMPs are linked to it.',
            ], 422);
        }

        $old = $office->toArray();
        $office->delete();

        AuditLog::log('OFFICE_DELETED', 'offices', $id, $old, null, $user->id);

        return response()->json([
            'message' => 'Office deleted successfully.',
        ]);
    }

    public function import(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user->isSuperAdmin()) {
            return response()->json(['message' => 'Unauthorized. Super Admin access required.'], 403);
        }

        $request->validate([
            'rows' => 'required|array|min:1',
            'rows.*.abbreviation' => 'required|string',
            'rows.*.office_name' => 'required|string',
            'rows.*.head_name' => 'nullable|string',
            'rows.*.designation' => 'nullable|string',
            'rows.*.responsibility_number' => 'nullable|string',
        ]);

        $rows = $request->input('rows');
        $importedCount = 0;
        $updatedCount = 0;
        $skippedCount = 0;

        DB::transaction(function () use ($rows, &$importedCount, &$updatedCount, &$skippedCount, $user) {
            foreach ($rows as $row) {
                $code = strtoupper(trim($row['abbreviation'] ?? ''));
                $name = trim($row['office_name'] ?? '');

                if (empty($code) || empty($name)) {
                    $skippedCount++;
                    continue;
                }

                $headName = isset($row['head_name']) && trim($row['head_name']) !== '' ? trim($row['head_name']) : null;
                $designation = isset($row['designation']) && trim($row['designation']) !== '' ? trim($row['designation']) : null;
                $respNo = isset($row['responsibility_number']) && trim((string)$row['responsibility_number']) !== '' ? trim((string)$row['responsibility_number']) : null;

                $existing = Office::where('code', $code)->first();

                if ($existing) {
                    $existing->update([
                        'name' => $name,
                        'head_name' => $headName,
                        'designation' => $designation,
                        'responsibility_number' => $respNo,
                    ]);
                    $updatedCount++;
                } else {
                    Office::create([
                        'code' => $code,
                        'name' => $name,
                        'head_name' => $headName,
                        'designation' => $designation,
                        'responsibility_number' => $respNo,
                    ]);
                    $importedCount++;
                }
            }

            AuditLog::log('OFFICES_BATCH_IMPORTED', 'offices', null, null, [
                'imported_new' => $importedCount,
                'updated' => $updatedCount,
                'skipped' => $skippedCount,
            ], $user->id);
        });

        return response()->json([
            'message' => "Import complete: {$importedCount} new offices added, {$updatedCount} updated.",
            'imported' => $importedCount,
            'updated' => $updatedCount,
            'skipped' => $skippedCount,
            'offices' => Office::with('head')->orderBy('name')->get(),
        ]);
    }
}
