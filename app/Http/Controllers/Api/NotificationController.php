<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Office;
use App\Models\Ppmp;
use App\Models\SystemNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    /**
     * Get user's notifications and unread count
     */
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        // If user is a Department/Office Head or Authorized Staff, ensure notifications are synced for their office
        if ($user && $user->isHead() && $user->office_id) {
            // Auto-heal office head_user_id link if needed
            Office::where('id', $user->office_id)
                ->whereNull('head_user_id')
                ->update(['head_user_id' => $user->id]);

            $officePpmps = Ppmp::where('office_id', $user->office_id)
                ->whereIn('status', [
                    'HEAD_PENDING',
                    'READY_TO_PRINT',
                    'HEAD_RETURNED',
                    'BUDGET_OFFICER_REVIEW',
                    'PACCO_REVIEW',
                    'OPPMO_REVIEW',
                    'TWG_REVIEW',
                ])
                ->latest('id')
                ->take(30)
                ->get();

            foreach ($officePpmps as $p) {
                $idLabel = $p->tracking_number ?: ($p->ppmp_number ? "PPMP {$p->ppmp_number}" : "PPMP #{$p->id}");

                if ($p->status === 'HEAD_PENDING') {
                    $exists = SystemNotification::where('user_id', $user->id)
                        ->where('ppmp_id', $p->id)
                        ->where('title', 'like', '%Approval%')
                        ->exists();

                    if (!$exists) {
                        SystemNotification::notify(
                            $user->id,
                            'PPMP Awaiting Office Head Approval',
                            "PPMP {$idLabel} ({$p->title}) is awaiting your official review and approval.",
                            $p->id,
                            'warning'
                        );
                    }
                } elseif ($p->status === 'READY_TO_PRINT') {
                    $exists = SystemNotification::where('user_id', $user->id)
                        ->where('ppmp_id', $p->id)
                        ->where(function ($q) {
                            $q->where('title', 'like', '%Approved%')
                              ->orWhere('title', 'like', '%Ready to Print%');
                        })
                        ->exists();

                    if (!$exists) {
                        SystemNotification::notify(
                            $user->id,
                            'PPMP Approved & Ready to Print',
                            "PPMP {$idLabel} ({$p->title}) has received all required endorsements and is now READY TO PRINT.",
                            $p->id,
                            'success'
                        );
                    }
                } elseif ($p->status === 'HEAD_RETURNED') {
                    $exists = SystemNotification::where('user_id', $user->id)
                        ->where('ppmp_id', $p->id)
                        ->where('title', 'like', '%Returned%')
                        ->exists();

                    if (!$exists) {
                        SystemNotification::notify(
                            $user->id,
                            'PPMP Returned to End-User',
                            "PPMP {$idLabel} ({$p->title}) was returned for revisions.",
                            $p->id,
                            'info'
                        );
                    }
                } elseif (in_array($p->status, ['BUDGET_OFFICER_REVIEW', 'PACCO_REVIEW', 'OPPMO_REVIEW', 'TWG_REVIEW'])) {
                    $stageName = match ($p->status) {
                        'BUDGET_OFFICER_REVIEW' => 'Provincial Budget Office (PBO)',
                        'PACCO_REVIEW' => 'Provincial Accounting Office (PACCO)',
                        'OPPMO_REVIEW' => 'OPPMO Review',
                        'TWG_REVIEW' => 'BAC-Technical Working Group (TWG)',
                        default => 'Review',
                    };

                    $exists = SystemNotification::where('user_id', $user->id)
                        ->where('ppmp_id', $p->id)
                        ->where('title', 'like', "%{$stageName}%")
                        ->exists();

                    if (!$exists) {
                        SystemNotification::notify(
                            $user->id,
                            "PPMP Under {$stageName}",
                            "PPMP {$idLabel} ({$p->title}) submitted by your office is currently undergoing review at {$stageName}.",
                            $p->id,
                            'info'
                        );
                    }
                }
            }
        }

        $query = SystemNotification::where('user_id', $user->id)
            ->with(['ppmp:id,uuid,tracking_number,ppmp_number,title,status,amendment_status,office_id,created_by,admin_received_at,head_received_at,budget_received_at,oppmo_received_at,twg_received_at,enduser_received_at'])
            ->latest('id');

        if ($request->boolean('all')) {
            $notifications = $query->take(100)->get();
        } else {
            $notifications = $query->take(20)->get();
        }

        $unreadCount = SystemNotification::where('user_id', $user->id)
            ->whereNull('read_at')
            ->count();

        return response()->json([
            'notifications' => $notifications,
            'unread_count' => $unreadCount,
        ]);
    }

    /**
     * Mark single notification as read
     */
    public function markAsRead(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $notification = SystemNotification::where('user_id', $user->id)
            ->where('id', $id)
            ->firstOrFail();

        $notification->update(['read_at' => now()]);

        return response()->json(['message' => 'Notification marked as read.']);
    }

    /**
     * Mark all as read
     */
    public function markAllAsRead(Request $request): JsonResponse
    {
        $user = $request->user();

        SystemNotification::where('user_id', $user->id)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json(['message' => 'All notifications marked as read.']);
    }

    /**
     * Delete / Dismiss single notification
     */
    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();

        $notification = SystemNotification::where('user_id', $user->id)
            ->where('id', $id)
            ->firstOrFail();

        $notification->delete();

        return response()->json(['message' => 'Notification dismissed.']);
    }

    /**
     * Clear all notifications for user
     */
    public function clearAll(Request $request): JsonResponse
    {
        $user = $request->user();

        SystemNotification::where('user_id', $user->id)->delete();

        return response()->json(['message' => 'All notifications cleared.']);
    }

    /**
     * List all offices (for forms/filters)
     */
    public function offices(): JsonResponse
    {
        return response()->json(Office::with('head')->get());
    }
}
