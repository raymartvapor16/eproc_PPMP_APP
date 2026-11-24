<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\ProcurementCondition;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ProcurementConditionController extends Controller
{

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $isAdmin = $user && $user->isAdmin();
        $activeOnly = $request->boolean('active_only') || !$isAdmin;

        $query = ProcurementCondition::query()->ordered();

        if ($activeOnly) {
            $query->active();
        }

        $conditions = $query->get();

        if ($request->boolean('with_options')) {
            $allActive = ProcurementCondition::active()->ordered()->get();
            $deliveryPeriods = $allActive->pluck('delivery_period')->filter()->unique()->values();
            $placesOfDelivery = $allActive->pluck('place_of_delivery')->filter()->unique()->values();
            $paymentMethods = $allActive->pluck('payment_method')->filter()->unique()->values();

            return response()->json([
                'conditions' => $conditions,
                'delivery_periods' => $deliveryPeriods,
                'places_of_delivery' => $placesOfDelivery,
                'payment_methods' => $paymentMethods,
            ]);
        }

        return response()->json($conditions);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $validated = $request->validate([
            'name'              => 'required|string|max:255|unique:procurement_conditions,name',
            'place_of_delivery' => 'nullable|string',
            'delivery_period'   => 'nullable|string',
            'payment_method'    => 'nullable|string',
            'other_terms'       => 'nullable|string',
            'is_active'         => 'boolean',
            'display_order'     => 'integer|min:0',
        ]);

        $condition = ProcurementCondition::create([
            'name'              => trim($validated['name']),
            'place_of_delivery' => $validated['place_of_delivery'] ?? null,
            'delivery_period'   => $validated['delivery_period'] ?? null,
            'payment_method'    => $validated['payment_method'] ?? null,
            'other_terms'       => $validated['other_terms'] ?? null,
            'is_active'         => $validated['is_active'] ?? true,
            'display_order'     => $validated['display_order'] ?? 0,
        ]);

        AuditLog::log('CONDITION_CREATED', 'procurement_conditions', $condition->id, null, $condition->toArray(), $user->id);

        return response()->json([
            'message'   => 'Procurement Condition created successfully.',
            'condition' => $condition,
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $condition = ProcurementCondition::findOrFail($id);

        $validated = $request->validate([
            'name'              => 'required|string|max:255|unique:procurement_conditions,name,' . $condition->id,
            'place_of_delivery' => 'nullable|string',
            'delivery_period'   => 'nullable|string',
            'payment_method'    => 'nullable|string',
            'other_terms'       => 'nullable|string',
            'is_active'         => 'boolean',
            'display_order'     => 'integer|min:0',
        ]);

        $old = $condition->toArray();

        $condition->update([
            'name'              => trim($validated['name']),
            'place_of_delivery' => $validated['place_of_delivery'] ?? $condition->place_of_delivery,
            'delivery_period'   => $validated['delivery_period'] ?? $condition->delivery_period,
            'payment_method'    => $validated['payment_method'] ?? $condition->payment_method,
            'other_terms'       => array_key_exists('other_terms', $validated) ? $validated['other_terms'] : $condition->other_terms,
            'is_active'         => $validated['is_active'] ?? $condition->is_active,
            'display_order'     => $validated['display_order'] ?? $condition->display_order,
        ]);

        AuditLog::log('CONDITION_UPDATED', 'procurement_conditions', $condition->id, $old, $condition->toArray(), $user->id);

        return response()->json([
            'message'   => 'Procurement Condition updated successfully.',
            'condition' => $condition,
        ]);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        if (!$user || !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Admin access required.'], 403);
        }

        $condition = ProcurementCondition::findOrFail($id);
        $old = $condition->toArray();
        $condition->delete();

        AuditLog::log('CONDITION_DELETED', 'procurement_conditions', $id, $old, null, $user->id);

        return response()->json([
            'message' => 'Procurement Condition deleted successfully.',
        ]);
    }
}
