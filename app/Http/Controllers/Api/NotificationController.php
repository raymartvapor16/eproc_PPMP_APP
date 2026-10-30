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
            // Auto-heal office head_user_id link if needed (only write when head_user_id is actually null)
            if (!$user->relationLoaded('office') || !$user->office || $user->office->head_user_id === null) {
                Office::where('id', $user->office_id)
                    ->whereNull('head_user_id')
                    ->update(['head_user_id' => $user->id]);
            }

            $officePpmps = Ppmp::without(['milestones', 'amendment'])
                ->select(['id', 'uuid', 'tracking_number', 'ppmp_number', 'title', 'status', 'office_id'])
                ->where('office_id', $user->office_id)
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

            if ($officePpmps->isNotEmpty()) {
                // Batch-fetch existing notifications for these PPMPs in a single query to avoid N+1 loop
                $existingByPpmp = SystemNotification::where('user_id', $user->id)
                    ->whereIn('ppmp_id', $officePpmps->pluck('id'))
                    ->select(['ppmp_id', 'title'])
                    ->get()
                    ->groupBy('ppmp_id');

                foreach ($officePpmps as $p) {
                    $idLabel = $p->tracking_number ?: ($p->ppmp_number ? "PPMP {$p->ppmp_number}" : "PPMP #{$p->id}");
                    $existingTitles = ($existingByPpmp->get($p->id) ?? collect())->pluck('title');

                    if ($p->status === 'HEAD_PENDING') {
                        $exists = $existingTitles->contains(fn ($t) => stripos((string) $t, 'Approval') !== false);

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
                        $exists = $existingTitles->contains(
                            fn ($t) => stripos((string) $t, 'Approved') !== false || stripos((string) $t, 'Ready to Print') !== false
                        );

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
                        $exists = $existingTitles->contains(fn ($t) => stripos((string) $t, 'Returned') !== false);

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

                        $exists = $existingTitles->contains(fn ($t) => stripos((string) $t, $stageName) !== false);

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
        }

        // If user is a PACCO Reviewer, ensure notifications are synced for Trust Fund & PACCO review items
        if ($user && $user->isPacco()) {
            $paccoPpmps = Ppmp::without(['milestones', 'amendment'])
                ->select(['id', 'uuid', 'tracking_number', 'ppmp_number', 'title', 'status', 'office_id', 'source_of_fund'])
                ->whereDoesntHave('children')
                ->where(function ($q) {
                    $q->whereIn('status', ['PACCO_REVIEW', 'PACCO_RETURNED'])
                        ->orWhere('source_of_fund', 'like', '%trust%')
                        ->orWhereHas('milestones', fn($mq) => $mq->whereNotNull('pacco_approved_at'));
                })
                ->latest('id')
                ->take(30)
                ->get();

            if ($paccoPpmps->isNotEmpty()) {
                $existingByPpmp = SystemNotification::where('user_id', $user->id)
                    ->whereIn('ppmp_id', $paccoPpmps->pluck('id'))
                    ->select(['ppmp_id', 'title'])
                    ->get()
                    ->groupBy('ppmp_id');

                foreach ($paccoPpmps as $p) {
                    $idLabel = $p->tracking_number ?: ($p->ppmp_number ? "PPMP {$p->ppmp_number}" : "PPMP #{$p->id}");
                    $existingTitles = ($existingByPpmp->get($p->id) ?? collect())->pluck('title');

                    if ($p->status === 'PACCO_REVIEW') {
                        $exists = $existingTitles->contains(fn ($t) => stripos((string) $t, 'PACCO') !== false || stripos((string) $t, 'Review') !== false);
                        if (!$exists) {
                            SystemNotification::notify(
                                $user->id,
                                'PPMP Awaiting PACCO Review',
                                "PPMP {$idLabel} ({$p->title}) is awaiting your official review and certification.",
                                $p->id,
                                'warning'
                            );
                        }
                    } elseif ($p->status === 'PACCO_RETURNED') {
                        $exists = $existingTitles->contains(fn ($t) => stripos((string) $t, 'Returned') !== false);
                        if (!$exists) {
                            SystemNotification::notify(
                                $user->id,
                                'PPMP Returned by PACCO',
                                "PPMP {$idLabel} ({$p->title}) was returned for revisions.",
                                $p->id,
                                'info'
                            );
                        }
                    } elseif ($p->status === 'READY_TO_PRINT') {
                        $exists = $existingTitles->contains(fn ($t) => stripos((string) $t, 'Approved') !== false || stripos((string) $t, 'Ready to Print') !== false);
                        if (!$exists) {
                            SystemNotification::notify(
                                $user->id,
                                'PPMP Approved & Ready to Print',
                                "PPMP {$idLabel} ({$p->title}) has received all required endorsements and is now READY TO PRINT.",
                                $p->id,
                                'success'
                            );
                        }
                    } else {
                        // Submitted for review or progressing through subsequent pipeline
                        $exists = $existingTitles->contains(fn ($t) => stripos((string) $t, 'Review') !== false || stripos((string) $t, 'Submitted') !== false);
                        if (!$exists) {
                            SystemNotification::notify(
                                $user->id,
                                'PPMP Submitted for Review',
                                "PPMP {$idLabel} ({$p->title}) is under PACCO review pipeline.",
                                $p->id,
                                'info'
                            );
                        }
                    }
                }
            }
        }

        // If user is a Budget Officer, ensure notifications are synced for General Fund & Budget review items
        if ($user && $user->isBudgetOfficer()) {
            $budgetPpmps = Ppmp::without(['milestones', 'amendment'])
                ->select(['id', 'uuid', 'tracking_number', 'ppmp_number', 'title', 'status', 'office_id', 'source_of_fund'])
                ->whereDoesntHave('children')
                ->where(function ($q) {
                    $q->whereIn('status', ['BUDGET_OFFICER_REVIEW', 'BUDGET_OFFICER_RETURNED'])
                        ->orWhereHas('milestones', fn($mq) => $mq->whereNotNull('budget_approved_at'));
                })
                ->latest('id')
                ->take(30)
                ->get();

            if ($budgetPpmps->isNotEmpty()) {
                $existingByPpmp = SystemNotification::where('user_id', $user->id)
                    ->whereIn('ppmp_id', $budgetPpmps->pluck('id'))
                    ->select(['ppmp_id', 'title'])
                    ->get()
                    ->groupBy('ppmp_id');

                foreach ($budgetPpmps as $p) {
                    $idLabel = $p->tracking_number ?: ($p->ppmp_number ? "PPMP {$p->ppmp_number}" : "PPMP #{$p->id}");
                    $existingTitles = ($existingByPpmp->get($p->id) ?? collect())->pluck('title');

                    if ($p->status === 'BUDGET_OFFICER_REVIEW') {
                        $exists = $existingTitles->contains(fn ($t) => stripos((string) $t, 'Budget') !== false || stripos((string) $t, 'Review') !== false);
                        if (!$exists) {
                            SystemNotification::notify(
                                $user->id,
                                'PPMP Awaiting Budget Officer Review',
                                "PPMP {$idLabel} ({$p->title}) is awaiting your official review and budget evaluation.",
                                $p->id,
                                'warning'
                            );
                        }
                    } elseif ($p->status === 'BUDGET_OFFICER_RETURNED') {
                        $exists = $existingTitles->contains(fn ($t) => stripos((string) $t, 'Returned') !== false);
                        if (!$exists) {
                            SystemNotification::notify(
                                $user->id,
                                'PPMP Returned by Budget Officer',
                                "PPMP {$idLabel} ({$p->title}) was returned for revisions.",
                                $p->id,
                                'info'
                            );
                        }
                    } elseif ($p->status === 'READY_TO_PRINT') {
                        $exists = $existingTitles->contains(fn ($t) => stripos((string) $t, 'Approved') !== false || stripos((string) $t, 'Ready to Print') !== false);
                        if (!$exists) {
                            SystemNotification::notify(
                                $user->id,
                                'PPMP Approved & Ready to Print',
                                "PPMP {$idLabel} ({$p->title}) has received all required endorsements and is now READY TO PRINT.",
                                $p->id,
                                'success'
                            );
                        }
                    } else {
                        $exists = $existingTitles->contains(fn ($t) => stripos((string) $t, 'Review') !== false || stripos((string) $t, 'Submitted') !== false);
                        if (!$exists) {
                            SystemNotification::notify(
                                $user->id,
                                'PPMP Submitted for Review',
                                "PPMP {$idLabel} ({$p->title}) is under Provincial Budget Office review pipeline.",
                                $p->id,
                                'info'
                            );
                        }
                    }
                }
            }
        }

        // If user is OPPMO / BAC Secretariat
        if ($user && $user->isOppmo()) {
            $oppmoPpmps = Ppmp::without(['milestones', 'amendment'])
                ->select(['id', 'uuid', 'tracking_number', 'ppmp_number', 'title', 'status', 'office_id'])
                ->whereIn('status', ['OPPMO_REVIEW', 'OPPMO_RETURNED', 'READY_TO_PRINT'])
                ->whereDoesntHave('children')
                ->latest('id')
                ->take(30)
                ->get();

            if ($oppmoPpmps->isNotEmpty()) {
                $existingByPpmp = SystemNotification::where('user_id', $user->id)
                    ->whereIn('ppmp_id', $oppmoPpmps->pluck('id'))
                    ->select(['ppmp_id', 'title'])
                    ->get()
                    ->groupBy('ppmp_id');

                foreach ($oppmoPpmps as $p) {
                    $idLabel = $p->tracking_number ?: ($p->ppmp_number ? "PPMP {$p->ppmp_number}" : "PPMP #{$p->id}");
                    $existingTitles = ($existingByPpmp->get($p->id) ?? collect())->pluck('title');

                    if ($p->status === 'OPPMO_REVIEW') {
                        $exists = $existingTitles->contains(fn ($t) => stripos((string) $t, 'OPPMO') !== false || stripos((string) $t, 'Review') !== false);
                        if (!$exists) {
                            SystemNotification::notify(
                                $user->id,
                                'PPMP Awaiting OPPMO Review',
                                "PPMP {$idLabel} ({$p->title}) is awaiting your official review.",
                                $p->id,
                                'warning'
                            );
                        }
                    } elseif ($p->status === 'OPPMO_RETURNED') {
                        $exists = $existingTitles->contains(fn ($t) => stripos((string) $t, 'Returned') !== false);
                        if (!$exists) {
                            SystemNotification::notify(
                                $user->id,
                                'PPMP Returned by OPPMO',
                                "PPMP {$idLabel} ({$p->title}) was returned for revisions.",
                                $p->id,
                                'info'
                            );
                        }
                    } elseif ($p->status === 'READY_TO_PRINT') {
                        $exists = $existingTitles->contains(fn ($t) => stripos((string) $t, 'Approved') !== false || stripos((string) $t, 'Ready to Print') !== false);
                        if (!$exists) {
                            SystemNotification::notify(
                                $user->id,
                                'PPMP Approved & Ready to Print',
                                "PPMP {$idLabel} ({$p->title}) has received all required endorsements and is now READY TO PRINT.",
                                $p->id,
                                'success'
                            );
                        }
                    }
                }
            }
        }

        // If user is TWG Reviewer
        if ($user && $user->isTwg()) {
            $twgPpmps = Ppmp::without(['milestones', 'amendment'])
                ->select(['id', 'uuid', 'tracking_number', 'ppmp_number', 'title', 'status', 'office_id'])
                ->whereIn('status', ['TWG_REVIEW', 'TWG_RETURNED', 'READY_TO_PRINT'])
                ->whereDoesntHave('children')
                ->latest('id')
                ->take(30)
                ->get();

            if ($twgPpmps->isNotEmpty()) {
                $existingByPpmp = SystemNotification::where('user_id', $user->id)
                    ->whereIn('ppmp_id', $twgPpmps->pluck('id'))
                    ->select(['ppmp_id', 'title'])
                    ->get()
                    ->groupBy('ppmp_id');

                foreach ($twgPpmps as $p) {
                    $idLabel = $p->tracking_number ?: ($p->ppmp_number ? "PPMP {$p->ppmp_number}" : "PPMP #{$p->id}");
                    $existingTitles = ($existingByPpmp->get($p->id) ?? collect())->pluck('title');

                    if ($p->status === 'TWG_REVIEW') {
                        $exists = $existingTitles->contains(fn ($t) => stripos((string) $t, 'TWG') !== false || stripos((string) $t, 'Review') !== false);
                        if (!$exists) {
                            SystemNotification::notify(
                                $user->id,
                                'PPMP Awaiting BAC-TWG Review',
                                "PPMP {$idLabel} ({$p->title}) is awaiting your technical review and evaluation.",
                                $p->id,
                                'warning'
                            );
                        }
                    } elseif ($p->status === 'TWG_RETURNED') {
                        $exists = $existingTitles->contains(fn ($t) => stripos((string) $t, 'Returned') !== false);
                        if (!$exists) {
                            SystemNotification::notify(
                                $user->id,
                                'PPMP Returned by BAC-TWG',
                                "PPMP {$idLabel} ({$p->title}) was returned for revisions.",
                                $p->id,
                                'info'
                            );
                        }
                    } elseif ($p->status === 'READY_TO_PRINT') {
                        $exists = $existingTitles->contains(fn ($t) => stripos((string) $t, 'Approved') !== false || stripos((string) $t, 'Ready to Print') !== false);
                        if (!$exists) {
                            SystemNotification::notify(
                                $user->id,
                                'PPMP Approved & Ready to Print',
                                "PPMP {$idLabel} ({$p->title}) has received all required endorsements and is now READY TO PRINT.",
                                $p->id,
                                'success'
                            );
                        }
                    }
                }
            }
        }

        // If user is an End User, ensure notifications are synced for their PPMPs
        if ($user && $user->isEndUser()) {
            $endUserPpmps = Ppmp::without(['milestones', 'amendment'])
                ->select(['id', 'uuid', 'tracking_number', 'ppmp_number', 'title', 'status', 'office_id'])
                ->where('created_by', $user->id)
                ->whereDoesntHave('children')
                ->where(function ($q) {
                    $q->where('status', 'READY_TO_PRINT')
                        ->orWhere('status', 'like', '%_RETURNED');
                })
                ->latest('id')
                ->take(30)
                ->get();

            if ($endUserPpmps->isNotEmpty()) {
                $existingByPpmp = SystemNotification::where('user_id', $user->id)
                    ->whereIn('ppmp_id', $endUserPpmps->pluck('id'))
                    ->select(['ppmp_id', 'title'])
                    ->get()
                    ->groupBy('ppmp_id');

                foreach ($endUserPpmps as $p) {
                    $idLabel = $p->tracking_number ?: ($p->ppmp_number ? "PPMP {$p->ppmp_number}" : "PPMP #{$p->id}");
                    $existingTitles = ($existingByPpmp->get($p->id) ?? collect())->pluck('title');

                    if ($p->status === 'READY_TO_PRINT') {
                        $exists = $existingTitles->contains(fn ($t) => stripos((string) $t, 'Approved') !== false || stripos((string) $t, 'Ready to Print') !== false);
                        if (!$exists) {
                            SystemNotification::notify(
                                $user->id,
                                'PPMP Approved & Ready to Print',
                                "Congratulations! PPMP {$idLabel} ({$p->title}) has received all required endorsements and is now READY TO PRINT.",
                                $p->id,
                                'success'
                            );
                        }
                    } elseif (str_ends_with($p->status, '_RETURNED')) {
                        $exists = $existingTitles->contains(fn ($t) => stripos((string) $t, 'Returned') !== false);
                        if (!$exists) {
                            SystemNotification::notify(
                                $user->id,
                                'PPMP Returned for Revisions',
                                "PPMP {$idLabel} ({$p->title}) was returned for revisions. Please check the remarks and resubmit.",
                                $p->id,
                                'warning'
                            );
                        }
                    }
                }
            }
        }

        $query = SystemNotification::where('user_id', $user->id)
            ->with([
                'ppmp:id,uuid,tracking_number,ppmp_number,title,status,office_id,implementing_unit,program_name,created_by,source_of_fund,attachment_list_data,app_data',
                'ppmp.milestones',
                'ppmp.amendment',
                'ppmp.attachments',
                'ppmp.monitoringProjects',
            ])
            ->latest('id');

        if ($request->boolean('all')) {
            $notifications = $query->take(100)->get();
        } else {
            $notifications = $query->take(20)->get();
        }

        $returnedNotifPpmps = $notifications
            ->pluck('ppmp')
            ->filter(fn ($p) => $p && str_ends_with($p->status ?? '', '_RETURNED'))
            ->unique('id')
            ->values();
        if ($returnedNotifPpmps->isNotEmpty()) {
            \Illuminate\Database\Eloquent\Collection::make($returnedNotifPpmps->all())->load(['reviews.reviewer', 'routes.fromUser']);
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
