<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = AuditLog::with(['user.office'])
            ->orderByDesc('id');

        if ($search = $request->input('search')) {
            $q = '%' . $search . '%';
            $query->where(function ($sub) use ($q) {
                $sub->where('action', 'like', $q)
                    ->orWhere('entity_type', 'like', $q)
                    ->orWhere('ip_address', 'like', $q)
                    ->orWhere('new_values', 'like', $q)
                    ->orWhereHas('user', function ($u) use ($q) {
                        $u->where('name', 'like', $q)
                          ->orWhere('email', 'like', $q);
                    });
            });
        }

        if ($action = $request->input('action')) {
            $query->where('action', $action);
        }
        if ($entityType = $request->input('entity_type')) {
            $query->where('entity_type', $entityType);
        }
        if ($userId = $request->input('user_id')) {
            $query->where('user_id', $userId);
        }
        if ($from = $request->input('date_from')) {
            $query->whereDate('created_at', '>=', $from);
        }
        if ($to = $request->input('date_to')) {
            $query->whereDate('created_at', '<=', $to);
        }

        $perPage = min((int) $request->input('per_page', 50), 200);
        $logs = $query->paginate($perPage);

        $logs->getCollection()->transform(function (AuditLog $log) {
            $log->description = $log->humanDescription();
            $log->category    = $log->category();
            return $log;
        });

        $availableActions = AuditLog::select('action')
            ->groupBy('action')
            ->orderBy('action')
            ->pluck('action');

        return response()->json([
            'logs'              => $logs,
            'available_actions' => $availableActions,
        ]);
    }
}
