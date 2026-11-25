<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountCode;
use App\Models\AuditLog;
use App\Models\Office;
use App\Models\Ppmp;
use App\Models\PpmpAttachment;
use App\Models\PpmpChangeLog;
use App\Models\PpmpItem;
use App\Models\PpmpReview;
use App\Models\PpmpRoute;
use App\Models\PpmpSignature;
use App\Models\SystemNotification;
use App\Models\User;
use App\Support\ReviewHeadResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class PpmpWorkflowController extends Controller
{

    public function submitToHead(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        if ($ppmp->created_by !== $user->id && !$user->isAdmin()) {
            return response()->json(['message' => 'Only the creator of this PPMP can submit it to the Office Head.'], 403);
        }

        if ($err = $this->validateContinuationRequirements($ppmp)) {
            return $err;
        }

        if ($ppmp->status === 'DRAFT') {
            return $this->submitForReview($request, $uuid);
        }

        if (!in_array($ppmp->status, ['DRAFT', 'HEAD_RETURNED'])) {
            return response()->json(['message' => "Cannot submit to Head in current status: {$ppmp->status}."], 422);
        }

        $pendingHeadComments = $ppmp->cellComments()->where('status', 'pending')->count();
        if ($pendingHeadComments > 0) {
            return response()->json([
                'message' => "Cannot resubmit to Office Head. You have {$pendingHeadComments} pending reviewer comment(s) on the PPMP form cells that must be complied with first.",
                'pending_comments_count' => $pendingHeadComments,
            ], 422);
        }

        DB::transaction(function () use ($ppmp, $user) {
            $targetHeadUsers = $this->getTargetHeadUsers($ppmp->office_id);
            $primaryHeadId = $targetHeadUsers->first()?->id;

            $ppmp->update([
                'status' => 'HEAD_PENDING',
                'head_submitted_at' => now(),
                'head_received_at' => null,
            ]);

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $user->id,
                'to_user_id' => $primaryHeadId,
                'from_role' => 'end_user',
                'to_role' => 'head',
                'action' => 'SUBMITTED_TO_HEAD',
                'status' => 'HEAD_PENDING',
                'remarks' => 'Submitted to Office Head for approval and endorsement.',
                'submitted_at' => now(),
            ]);

            $idLabel = $this->getPpmpIdentifier($ppmp);

            foreach ($targetHeadUsers as $head) {
                SystemNotification::notify(
                    $head->id,
                    'PPMP Submitted for Endorsement',
                    "PPMP {$idLabel} ({$ppmp->title}) was submitted by {$user->name} for review.",
                    $ppmp->id,
                    'info'
                );
            }

            $authStaffUserIds = User::where('office_id', $ppmp->office_id)
                ->withRole('authorized_staff')
                ->where('is_active', true)
                ->whereNotIn('id', $targetHeadUsers->pluck('id'))
                ->pluck('id');

            foreach ($authStaffUserIds as $staffId) {
                SystemNotification::notify(
                    $staffId,
                    'PPMP Submitted for Endorsement (Acting Head)',
                    "PPMP {$idLabel} ({$ppmp->title}) was submitted by {$user->name} for endorsement on behalf of the Office Head.",
                    $ppmp->id,
                    'info'
                );
            }

            AuditLog::log('PPMP_SUBMITTED_TO_HEAD', 'ppmps', $ppmp->id, null, ['status' => 'HEAD_PENDING'], $user->id);
        });

        return response()->json([
            'message' => 'PPMP submitted to Office Head successfully.',
            'ppmp' => $ppmp->fresh(['office.head', 'creator', 'signatures.user', 'routes.fromUser', 'routes.toUser']),
        ]);
    }

    public function headApprove(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        if (!$user->isAdmin()) {
            if (!$user->isHead()) {
                return response()->json(['message' => 'Only the Office Head or Administrator can approve this PPMP.'], 403);
            }
            if ($user->office_id !== $ppmp->office_id) {
                return response()->json(['message' => 'Unauthorized. You may only approve PPMPs from your assigned office.'], 403);
            }
        }

        if ($ppmp->status !== 'HEAD_PENDING') {
            return response()->json(['message' => "PPMP is not awaiting Head approval (Current status: {$ppmp->status})."], 422);
        }

        DB::transaction(function () use ($ppmp, $user) {
            $now = now();
            $receivedAt = $ppmp->head_received_at ?? $now;

            $ppmp->update([
                'status' => 'READY_TO_PRINT',
                'head_approved_at' => $now,
                'head_received_at' => $receivedAt,
                'ready_to_print_at' => $now,
                'enduser_received_at' => null,
            ]);

            $this->markLatestPendingRouteReceived($ppmp->id, $receivedAt);

            PpmpSignature::updateOrCreate(
                ['ppmp_id' => $ppmp->id, 'role' => 'head'],
                [
                    'user_id' => $user->id,
                    'signature_type' => 'full_esignature',
                    'signature_indicator' => 'ESIG-HEAD-' . strtoupper(substr(md5($user->id . $ppmp->id . $now), 0, 8)),
                    'signer_name' => $user->name,
                    'signer_designation' => $user->designation ?? 'Head of Procuring Entity / Office Head',
                    'signed_at' => $now,
                ]
            );

            PpmpReview::create([
                'ppmp_id' => $ppmp->id,
                'reviewer_id' => $user->id,
                'reviewer_role' => 'head',
                'action' => 'approve',
                'remarks' => 'Office Head final approval granted. PPMP is approved and ready to print.',
                'status_before' => 'HEAD_PENDING',
                'status_after' => 'READY_TO_PRINT',
                'submitted_at' => $ppmp->head_submitted_at ?? $now,
                'received_at' => $receivedAt,
                'acted_at' => $now,
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ]);

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $user->id,
                'to_user_id' => $ppmp->created_by,
                'from_role' => 'head',
                'to_role' => 'end_user',
                'action' => 'READY_TO_PRINT',
                'status' => 'READY_TO_PRINT',
                'remarks' => 'All review approvals completed and Office Head approved. Document is ready to print.',
                'submitted_at' => $now,
                'acted_at' => $now,
            ]);

            $idLabel = $this->getPpmpIdentifier($ppmp);

            SystemNotification::notify(
                $ppmp->created_by,
                'PPMP Approved & Ready to Print',
                "Congratulations! PPMP {$idLabel} ({$ppmp->title}) has received final approval from Office Head {$user->name} and is now READY TO PRINT.",
                $ppmp->id,
                'success'
            );

            AuditLog::log('PPMP_HEAD_APPROVED', 'ppmps', $ppmp->id, null, ['status' => 'READY_TO_PRINT'], $user->id);
        });

        return response()->json([
            'message' => 'PPMP approved by Office Head and marked as READY TO PRINT.',
            'ppmp' => $ppmp->fresh(['office.head', 'creator', 'signatures.user', 'routes.fromUser', 'routes.toUser']),
        ]);
    }

    public function headReturn(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        if (!$user->isAdmin()) {
            if (!$user->isHead()) {
                return response()->json(['message' => 'Only the Office Head or Administrator can return this PPMP.'], 403);
            }
            if ($user->office_id !== $ppmp->office_id) {
                return response()->json(['message' => 'Unauthorized. You may only return PPMPs from your assigned office.'], 403);
            }
        }

        if ($ppmp->status !== 'HEAD_PENDING') {
            return response()->json(['message' => "PPMP is not awaiting Head action."], 422);
        }

        $validated = $request->validate([
            'remarks' => 'required|string|min:3',
            'field_changes' => 'nullable|array',
        ]);

        DB::transaction(function () use ($ppmp, $user, $validated) {
            $now = now();
            $receivedAt = $ppmp->head_received_at ?? $now;

            $ppmp->update([
                'status' => 'HEAD_RETURNED',
                'enduser_received_at' => null,
            ]);

            $this->markLatestPendingRouteReceived($ppmp->id, $receivedAt);

            $this->applyFieldModifications($ppmp, $validated['field_changes'] ?? [], $user, 'head');

            PpmpReview::create([
                'ppmp_id' => $ppmp->id,
                'reviewer_id' => $user->id,
                'reviewer_role' => 'head',
                'action' => 'return',
                'remarks' => $validated['remarks'],
                'status_before' => 'HEAD_PENDING',
                'status_after' => 'HEAD_RETURNED',
                'submitted_at' => $ppmp->head_submitted_at ?? $now,
                'received_at' => $receivedAt,
                'acted_at' => $now,
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ]);

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $user->id,
                'to_user_id' => $ppmp->created_by,
                'from_role' => 'head',
                'to_role' => 'end_user',
                'action' => 'HEAD_RETURNED',
                'status' => 'HEAD_RETURNED',
                'remarks' => $validated['remarks'],
                'submitted_at' => $now,
                'acted_at' => $now,
            ]);

            $idLabel = $this->getPpmpIdentifier($ppmp);

            SystemNotification::notify(
                $ppmp->created_by,
                'PPMP Returned by Office Head',
                "PPMP {$idLabel} was returned with comments: " . Str::limit($validated['remarks'], 100),
                $ppmp->id,
                'warning'
            );

            AuditLog::log('PPMP_HEAD_RETURNED', 'ppmps', $ppmp->id, null, ['remarks' => $validated['remarks']], $user->id);
        });

        return response()->json([
            'message' => 'PPMP returned to end-user for revision.',
            'ppmp' => $ppmp->fresh(['office.head', 'creator', 'signatures.user', 'routes.fromUser', 'routes.toUser']),
        ]);
    }

    public function getAvailableReviewers(Request $request, string $uuid): JsonResponse
    {
        $ppmp = Ppmp::with(['items', 'accountCodeRef'])->where('uuid', $uuid)->firstOrFail();

        $extractCodesFromText = function ($text) {
            if (!$text) return [];
            $found = [];
            if (preg_match_all('/\b\d+(?:-\d+)+\b/', (string)$text, $matches)) {
                $found = $matches[0];
            }
            return $found;
        };

        $ppmpAccountCodeIds = collect([$ppmp->account_code_id])
            ->filter()
            ->unique()
            ->values();

        $ppmpCodeStrings = collect();
        if ($ppmp->accountCodeRef?->code) {
            $ppmpCodeStrings->push($ppmp->accountCodeRef->code);
        }
        foreach ($extractCodesFromText($ppmp->account_code) as $c) {
            $ppmpCodeStrings->push($c);
        }
        foreach ($ppmp->items as $item) {
            foreach ($extractCodesFromText($item->description ?? null) as $c) {
                $ppmpCodeStrings->push($c);
            }
        }
        $ppmpCodeStrings = $ppmpCodeStrings->filter()->unique()->values();

        if ($ppmpCodeStrings->isNotEmpty()) {
            $lookupIds = AccountCode::whereIn('code', $ppmpCodeStrings)->pluck('id');
            $ppmpAccountCodeIds = $ppmpAccountCodeIds->merge($lookupIds)->unique()->values();
        }

        if ($ppmpAccountCodeIds->isNotEmpty()) {
            $lookupCodes = AccountCode::whereIn('id', $ppmpAccountCodeIds)->pluck('code');
            $ppmpCodeStrings = $ppmpCodeStrings->merge($lookupCodes)->unique()->values();
        }

        $twgUsers = User::with('accountCodes')
            ->withRole('twg')
            ->where('is_active', true)
            ->orderBy('name')
            ->get();

        $twgList = $twgUsers->map(function ($twg) use ($ppmpAccountCodeIds, $ppmpCodeStrings) {
            $matchingCodeObjs = $twg->accountCodes->filter(function ($ac) use ($ppmpAccountCodeIds, $ppmpCodeStrings) {
                return $ppmpAccountCodeIds->contains($ac->id) || $ppmpCodeStrings->contains($ac->code);
            });

            $hasMatch = $matchingCodeObjs->isNotEmpty();
            $matchingCodesList = $matchingCodeObjs->pluck('code')->unique()->values();

            return [
                'id' => $twg->id,
                'name' => $twg->name,
                'email' => $twg->email,
                'designation' => $twg->designation,
                'role' => 'twg',
                'roles' => $twg->available_roles,
                'profile_photo_path' => $twg->profile_photo_path,
                'profile_photo_url' => $twg->profile_photo_url,
                'account_codes' => $twg->accountCodes->map(fn($ac) => [
                    'id' => $ac->id,
                    'code' => $ac->code,
                    'name' => $ac->name,
                ]),
                'matches_ppmp_account_code' => $hasMatch,
                'matching_codes' => $matchingCodesList,
            ];
        })->sortByDesc('matches_ppmp_account_code')->values();

        $budgetList = User::withRole('budget_officer')
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'designation', 'role', 'roles', 'profile_photo_path']);

        $paccoList = User::withRole('pacco')
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'designation', 'role', 'roles', 'profile_photo_path']);

        $oppmoList = User::withRole('oppmo')
            ->where('is_active', true)
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'designation', 'role', 'roles', 'profile_photo_path']);

        $primaryCode = $ppmp->accountCodeRef?->code ?: ($ppmpCodeStrings->first() ?: $ppmp->account_code);
        $primaryName = $ppmp->accountCodeRef?->name ?: null;
        if (!$primaryName && $primaryCode) {
            $primaryName = AccountCode::where('code', $primaryCode)->value('name');
        }

        return response()->json([
            'is_trust_fund' => $ppmp->isTrustFund(),
            'source_of_fund' => $ppmp->source_of_fund,
            'ppmp_account_code' => $primaryCode,
            'ppmp_account_name' => $primaryName,
            'ppmp_program_name' => $ppmp->program_name ?: ($ppmp->programNameRef?->name ?: ''),
            'ppmp_matching_codes' => $ppmpCodeStrings,
            'twg_reviewers' => $twgList,
            'budget_reviewers' => $budgetList,
            'pacco_reviewers' => $paccoList,
            'oppmo_reviewers' => $oppmoList,
            'assigned_reviewers' => [
                'twg_reviewer_id' => $ppmp->twg_reviewer_id,
                'budget_reviewer_id' => $ppmp->budget_reviewer_id,
                'oppmo_reviewer_id' => $ppmp->oppmo_reviewer_id,
            ],
        ]);
    }

    public function reassignReviewers(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        $isCreator = $ppmp->created_by === $user->id;
        $isReviewer = in_array($user->role, ['twg', 'budget_officer', 'pacco', 'oppmo', 'head', 'authorized_staff']);
        $isAdmin = $user->isAdmin();

        if (!$isCreator && !$isReviewer && !$isAdmin) {
            return response()->json(['message' => 'Unauthorized. Only the PPMP preparer, reviewers, or administrators can reassign reviewers.'], 403);
        }

        if (in_array($ppmp->status, ['READY_TO_PRINT', 'APPROVED', 'HEAD_APPROVED', 'COMPLETED'])) {
            return response()->json(['message' => 'Cannot reassign reviewers. This PPMP has completed all reviews and is Ready to Print.'], 422);
        }

        if ($user->role === 'twg' && ($ppmp->twg_approved_at || in_array($ppmp->status, ['BUDGET_OFFICER_REVIEW', 'PACCO_REVIEW', 'OPPMO_REVIEW', 'READY_TO_PRINT', 'HEAD_APPROVED']))) {
            return response()->json(['message' => 'Unauthorized. BAC-TWG technical review has already been approved.'], 403);
        }
        if (in_array($user->role, ['budget_officer', 'pacco']) && ($ppmp->budget_approved_at || $ppmp->pacco_approved_at || in_array($ppmp->status, ['OPPMO_REVIEW', 'READY_TO_PRINT', 'HEAD_APPROVED']))) {
            return response()->json(['message' => 'Unauthorized. Budget certification review has already been approved.'], 403);
        }
        if ($user->role === 'oppmo' && ($ppmp->oppmo_approved_at || in_array($ppmp->status, ['READY_TO_PRINT', 'HEAD_APPROVED']))) {
            return response()->json(['message' => 'Unauthorized. OPPMO review has already been approved.'], 403);
        }

        $validated = $request->validate([
            'twg_reviewer_id' => 'nullable|integer|exists:users,id',
            'budget_reviewer_id' => 'nullable|integer|exists:users,id',
            'oppmo_reviewer_id' => 'nullable|integer|exists:users,id',
            'reason' => 'nullable|string|max:500',
        ]);

        $oldTwgId = $ppmp->twg_reviewer_id;
        $oldBudgetId = $ppmp->budget_reviewer_id;
        $oldOppmoId = $ppmp->oppmo_reviewer_id;

        $newTwgId = array_key_exists('twg_reviewer_id', $validated) ? $validated['twg_reviewer_id'] : $oldTwgId;
        $newBudgetId = array_key_exists('budget_reviewer_id', $validated) ? $validated['budget_reviewer_id'] : $oldBudgetId;
        $newOppmoId = array_key_exists('oppmo_reviewer_id', $validated) ? $validated['oppmo_reviewer_id'] : $oldOppmoId;
        $reason = trim($validated['reason'] ?? '');

        if (!$isAdmin && !$isCreator) {
            if ($user->role === 'twg') {
                if ($newBudgetId != $oldBudgetId || $newOppmoId != $oldOppmoId) {
                    return response()->json([
                        'message' => 'Unauthorized. As a BAC-TWG reviewer, you may only reassign to another BAC-TWG reviewer.'
                    ], 403);
                }
            } elseif (in_array($user->role, ['budget_officer', 'pacco'])) {
                if ($newTwgId != $oldTwgId || $newOppmoId != $oldOppmoId) {
                    return response()->json([
                        'message' => 'Unauthorized. As a Budget/PACCO reviewer, you may only reassign to another Budget/PACCO reviewer.'
                    ], 403);
                }
            } elseif ($user->role === 'oppmo') {
                if ($newTwgId != $oldTwgId || $newBudgetId != $oldBudgetId) {
                    return response()->json([
                        'message' => 'Unauthorized. As an OPPMO reviewer, you may only reassign to another OPPMO reviewer.'
                    ], 403);
                }
            }
        }

        if ($newTwgId != $oldTwgId) {
            if ($ppmp->twg_approved_at || in_array($ppmp->status, ['BUDGET_OFFICER_REVIEW', 'PACCO_REVIEW', 'OPPMO_REVIEW', 'READY_TO_PRINT', 'HEAD_APPROVED'])) {
                return response()->json(['message' => 'Cannot reassign BAC-TWG reviewer because BAC-TWG technical review has already been approved.'], 422);
            }
            if ($newTwgId) {
                $targetTwg = User::find($newTwgId);
                if (!$targetTwg || !$targetTwg->hasAssignedRole('twg')) {
                    return response()->json(['message' => 'Selected TWG reviewer must have the BAC-TWG Reviewer role.'], 422);
                }
            }
        }
        if ($newBudgetId != $oldBudgetId) {
            if ($ppmp->budget_approved_at || $ppmp->pacco_approved_at || in_array($ppmp->status, ['OPPMO_REVIEW', 'READY_TO_PRINT', 'HEAD_APPROVED'])) {
                return response()->json(['message' => 'Cannot reassign Budget/PACCO reviewer because budget certification has already been approved.'], 422);
            }
            if ($newBudgetId) {
                $targetBudget = User::find($newBudgetId);
                if (!$targetBudget || !$targetBudget->hasAnyAssignedRole(['budget_officer', 'pacco'])) {
                    return response()->json(['message' => 'Selected Budget reviewer must have the Budget Officer or PACCO role.'], 422);
                }
            }
        }
        if ($newOppmoId != $oldOppmoId) {
            if ($ppmp->oppmo_approved_at || in_array($ppmp->status, ['READY_TO_PRINT', 'HEAD_APPROVED'])) {
                return response()->json(['message' => 'Cannot reassign OPPMO reviewer because OPPMO review has already been approved.'], 422);
            }
            if ($newOppmoId) {
                $targetOppmo = User::find($newOppmoId);
                if (!$targetOppmo || !$targetOppmo->hasAssignedRole('oppmo')) {
                    return response()->json(['message' => 'Selected OPPMO reviewer must have the OPPMO Reviewer role.'], 422);
                }
            }
        }

        $now = now();
        $idLabel = $this->getPpmpIdentifier($ppmp);
        $reasonSuffix = $reason ? " (Reason: {$reason})" : '';
        $changes = [];

        if ($newTwgId != $oldTwgId) {
            $ppmp->twg_reviewer_id = $newTwgId;
            $newTwg = $newTwgId ? User::find($newTwgId) : null;
            $twgLabel = $newTwg ? $newTwg->name : 'All BAC-TWG Reviewers (Distributed)';
            $changes[] = 'TWG: ' . $twgLabel;

            if ($ppmp->status === 'TWG_REVIEW') {
                $ppmp->twg_received_at = null;

                PpmpRoute::where('ppmp_id', $ppmp->id)
                    ->where('to_role', 'twg')
                    ->whereNull('acted_at')
                    ->update([
                        'to_user_id' => $newTwgId,
                        'received_at' => null,
                    ]);

                PpmpRoute::create([
                    'ppmp_id' => $ppmp->id,
                    'from_user_id' => $user->id,
                    'to_user_id' => $newTwgId,
                    'from_role' => $user->role,
                    'to_role' => 'twg',
                    'action' => 'REASSIGNED',
                    'status' => 'TWG_REVIEW',
                    'remarks' => "PPMP reassigned to {$twgLabel} by {$user->name}." . ($reason ? " Reason: {$reason}" : ''),
                    'submitted_at' => $now,
                    'received_at' => null,
                ]);

                if ($newTwgId) {
                    SystemNotification::notify(
                        $newTwgId,
                        'PPMP Reassigned for Technical Review',
                        "PPMP {$idLabel} ({$ppmp->title}) was reassigned to you for BAC-TWG technical review by {$user->name}{$reasonSuffix}. Please receive the document to proceed.",
                        $ppmp->id,
                        'info'
                    );
                } else {
                    foreach (User::withRole('twg')->where('is_active', true)->get() as $twgUser) {
                        SystemNotification::notify(
                            $twgUser->id,
                            'PPMP Distributed for Technical Review',
                            "PPMP {$idLabel} ({$ppmp->title}) was distributed to all BAC-TWG reviewers by {$user->name}{$reasonSuffix}. Any BAC-TWG reviewer may receive and review this document.",
                            $ppmp->id,
                            'info'
                        );
                    }
                }
            }
        }

        if ($newBudgetId != $oldBudgetId) {
            $ppmp->budget_reviewer_id = $newBudgetId;
            $newBudget = $newBudgetId ? User::find($newBudgetId) : null;
            $budgetLabel = $newBudget ? $newBudget->name : ($ppmp->isTrustFund() ? 'All PACCO Reviewers (Distributed)' : 'All Budget Officers (Distributed)');
            $changes[] = 'Budget/PACCO: ' . $budgetLabel;

            if (in_array($ppmp->status, ['BUDGET_OFFICER_REVIEW', 'PACCO_REVIEW'])) {
                $targetRole = $ppmp->status === 'PACCO_REVIEW' ? 'pacco' : 'budget_officer';

                if ($ppmp->status === 'PACCO_REVIEW') {
                    $ppmp->pacco_received_at = null;
                } else {
                    $ppmp->budget_received_at = null;
                }

                PpmpRoute::where('ppmp_id', $ppmp->id)
                    ->where('to_role', $targetRole)
                    ->whereNull('acted_at')
                    ->update([
                        'to_user_id' => $newBudgetId,
                        'received_at' => null,
                    ]);

                PpmpRoute::create([
                    'ppmp_id' => $ppmp->id,
                    'from_user_id' => $user->id,
                    'to_user_id' => $newBudgetId,
                    'from_role' => $user->role,
                    'to_role' => $targetRole,
                    'action' => 'REASSIGNED',
                    'status' => $ppmp->status,
                    'remarks' => "PPMP reassigned to {$budgetLabel} by {$user->name}." . ($reason ? " Reason: {$reason}" : ''),
                    'submitted_at' => $now,
                    'received_at' => null,
                ]);

                if ($newBudgetId) {
                    SystemNotification::notify(
                        $newBudgetId,
                        'PPMP Reassigned for Review',
                        "PPMP {$idLabel} ({$ppmp->title}) was reassigned to you for review by {$user->name}{$reasonSuffix}. Please receive the document to proceed.",
                        $ppmp->id,
                        'info'
                    );
                } else {
                    foreach (User::withRole($targetRole)->where('is_active', true)->get() as $budgetUser) {
                        SystemNotification::notify(
                            $budgetUser->id,
                            'PPMP Distributed for Review',
                            "PPMP {$idLabel} ({$ppmp->title}) was distributed to all " . ($targetRole === 'pacco' ? 'PACCO' : 'Budget Officer') . " reviewers by {$user->name}{$reasonSuffix}.",
                            $ppmp->id,
                            'info'
                        );
                    }
                }
            }
        }

        if ($newOppmoId != $oldOppmoId) {
            $ppmp->oppmo_reviewer_id = $newOppmoId;
            $newOppmo = $newOppmoId ? User::find($newOppmoId) : null;
            $oppmoLabel = $newOppmo ? $newOppmo->name : 'All OPPMO Reviewers (Distributed)';
            $changes[] = 'OPPMO: ' . $oppmoLabel;

            if ($ppmp->status === 'OPPMO_REVIEW') {
                $ppmp->oppmo_received_at = null;

                PpmpRoute::where('ppmp_id', $ppmp->id)
                    ->where('to_role', 'oppmo')
                    ->whereNull('acted_at')
                    ->update([
                        'to_user_id' => $newOppmoId,
                        'received_at' => null,
                    ]);

                PpmpRoute::create([
                    'ppmp_id' => $ppmp->id,
                    'from_user_id' => $user->id,
                    'to_user_id' => $newOppmoId,
                    'from_role' => $user->role,
                    'to_role' => 'oppmo',
                    'action' => 'REASSIGNED',
                    'status' => 'OPPMO_REVIEW',
                    'remarks' => "PPMP reassigned to {$oppmoLabel} by {$user->name}." . ($reason ? " Reason: {$reason}" : ''),
                    'submitted_at' => $now,
                    'received_at' => null,
                ]);

                if ($newOppmoId) {
                    SystemNotification::notify(
                        $newOppmoId,
                        'PPMP Reassigned for Review',
                        "PPMP {$idLabel} ({$ppmp->title}) was reassigned to you for OPPMO evaluation by {$user->name}{$reasonSuffix}. Please receive the document to proceed.",
                        $ppmp->id,
                        'info'
                    );
                } else {
                    foreach (User::withRole('oppmo')->where('is_active', true)->get() as $oppmoUser) {
                        SystemNotification::notify(
                            $oppmoUser->id,
                            'PPMP Distributed for Review',
                            "PPMP {$idLabel} ({$ppmp->title}) was distributed to all OPPMO reviewers by {$user->name}{$reasonSuffix}. Any OPPMO reviewer may receive and review this document.",
                            $ppmp->id,
                            'info'
                        );
                    }
                }
            }
        }

        $ppmp->save();

        $changeDesc = implode(', ', $changes);

        AuditLog::log('PPMP_REVIEWERS_REASSIGNED', 'ppmps', $ppmp->id, null, [
            'changes' => $changes,
            'reason' => $reason,
            'twg_reviewer_id' => $newTwgId,
            'budget_reviewer_id' => $newBudgetId,
            'oppmo_reviewer_id' => $newOppmoId,
        ], $user->id);

        return response()->json([
            'message' => 'Assigned reviewers updated successfully.' . ($changes ? " ({$changeDesc})" : ''),
            'ppmp' => $ppmp->fresh([
                'office.head',
                'creator',
                'signatures.user',
                'routes.fromUser',
                'routes.toUser',
                'twgReviewer',
                'budgetReviewer',
                'oppmoReviewer',
            ]),
        ]);
    }

    public function submitForReview(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        if ($ppmp->created_by !== $user->id && !$user->isAdmin()) {
            return response()->json(['message' => 'Only the creator can submit this PPMP for review.'], 403);
        }

        $allowedStatuses = [
            'DRAFT',
            'HEAD_RETURNED',
            'BUDGET_OFFICER_RETURNED',
            'BUDGET_HEAD_RETURNED',
            'PACCO_RETURNED',
            'PACCO_HEAD_RETURNED',
            'OPPMO_RETURNED',
            'OPPMO_HEAD_RETURNED',
            'APP_PREPARER_RETURNED',
            'GOVERNOR_RETURNED',
            'TWG_RETURNED',
            'HEAD_APPROVED',
        ];

        if (!in_array($ppmp->status, $allowedStatuses)) {
            return response()->json(['message' => "PPMP cannot be submitted for review from status {$ppmp->status}."], 422);
        }

        $pendingCellComments = $ppmp->cellComments()->where('status', 'pending')->count();
        if ($pendingCellComments > 0) {
            return response()->json([
                'message' => "Cannot submit for review. You have {$pendingCellComments} pending reviewer comment(s) on the PPMP form cells that must be complied with first.",
                'pending_comments_count' => $pendingCellComments,
            ], 422);
        }

        if ($err = $this->validateContinuationRequirements($ppmp)) {
            return $err;
        }

        $validated = $request->validate([
            'twg_reviewer_id' => 'nullable|integer|exists:users,id',
            'budget_reviewer_id' => 'nullable|integer|exists:users,id',
            'oppmo_reviewer_id' => 'nullable|integer|exists:users,id',
        ]);

        $isPpmpAppOnlyAmendment = $ppmp->amendment_scope === 'PPMP_APP' && $ppmp->amendment_type !== 'SUPPLEMENTAL';

        if (array_key_exists('twg_reviewer_id', $validated)) {
            $ppmp->twg_reviewer_id = $isPpmpAppOnlyAmendment ? null : $validated['twg_reviewer_id'];
        }
        if ($isPpmpAppOnlyAmendment) {
            $ppmp->twg_reviewer_id = null;
        }
        if ($ppmp->amendment_scope === 'ATTACHMENT_LIST') {

        } else {
            if (array_key_exists('budget_reviewer_id', $validated)) {
                $ppmp->budget_reviewer_id = $validated['budget_reviewer_id'];
            }
            if (array_key_exists('oppmo_reviewer_id', $validated)) {
                $ppmp->oppmo_reviewer_id = $validated['oppmo_reviewer_id'];
            }
        }
        $ppmp->save();

        $missingRequirements = [];

        if (!$ppmp->hasAttachmentListGenerated()) {
            $missingRequirements[] = 'Detailed Specifications must be generated';
        }

        if (!$ppmp->hasMarketScopingPdf()) {
            $missingRequirements[] = 'Market Scoping Checklist must be created';
        }

        if (!empty($missingRequirements)) {
            return response()->json([
                'message' => 'Cannot submit for review. The following requirements must be completed first: ' . implode('; ', $missingRequirements) . '.',
                'missing_requirements' => $missingRequirements,
                'checks' => $ppmp->pre_submission_checks,
            ], 422);
        }

        $isAttachmentOnly = $ppmp->amendment_scope === 'ATTACHMENT_LIST';
        $isPpmpAppOnly = $ppmp->amendment_scope === 'PPMP_APP' && $ppmp->amendment_type !== 'SUPPLEMENTAL';

        if ($isAttachmentOnly) {
            if ($ppmp->status === 'HEAD_RETURNED') {
                $endUserHead = ReviewHeadResolver::resolveEndUserOfficeHead($ppmp);
                if (ReviewHeadResolver::requiresHeadEsignReview($endUserHead)) {
                    $nextStatus = 'HEAD_PENDING';
                    $nextRole = 'head';
                } else {
                    $nextStatus = 'TWG_REVIEW';
                    $nextRole = 'twg';
                }
            } else {
                $nextStatus = 'TWG_REVIEW';
                $nextRole = 'twg';
            }
        } else {

            $initialStatus = $isPpmpAppOnly
                ? ($ppmp->isTrustFund() ? 'PACCO_REVIEW' : 'BUDGET_OFFICER_REVIEW')
                : 'TWG_REVIEW';

            $pnpkiEnabled = \App\Models\SystemSetting::isPnpkiEnabled();

            $nextStatus = match ($ppmp->status) {
                'PACCO_RETURNED' => 'PACCO_REVIEW',
                'PACCO_HEAD_RETURNED' => $pnpkiEnabled ? 'PACCO_HEAD_REVIEW' : 'OPPMO_REVIEW',
                'OPPMO_RETURNED' => 'OPPMO_REVIEW',
                'OPPMO_HEAD_RETURNED' => $pnpkiEnabled ? 'OPPMO_HEAD_REVIEW' : 'OPPMO_REVIEW',
                'APP_PREPARER_RETURNED' => $pnpkiEnabled ? 'APP_PREPARER_REVIEW' : 'OPPMO_REVIEW',
                'GOVERNOR_RETURNED' => $pnpkiEnabled ? 'GOVERNOR_REVIEW' : 'OPPMO_REVIEW',
                'TWG_RETURNED' => $isPpmpAppOnly ? ($ppmp->isTrustFund() ? 'PACCO_REVIEW' : 'BUDGET_OFFICER_REVIEW') : 'TWG_REVIEW',
                'BUDGET_OFFICER_RETURNED' => 'BUDGET_OFFICER_REVIEW',
                'BUDGET_HEAD_RETURNED' => $pnpkiEnabled ? 'BUDGET_HEAD_REVIEW' : 'OPPMO_REVIEW',
                'HEAD_RETURNED' => $pnpkiEnabled ? 'HEAD_PENDING' : 'OPPMO_REVIEW',
                default => $initialStatus,
            };

            $nextRole = match ($nextStatus) {
                'PACCO_REVIEW' => 'pacco',
                'PACCO_HEAD_REVIEW' => 'pacco_head',
                'OPPMO_REVIEW' => 'oppmo',
                'OPPMO_HEAD_REVIEW' => 'oppmo_head',
                'APP_PREPARER_REVIEW' => 'app_preparer',
                'GOVERNOR_REVIEW' => 'governor',
                'BUDGET_OFFICER_REVIEW' => 'budget_officer',
                'BUDGET_HEAD_REVIEW' => 'budget_head',
                'TWG_REVIEW' => 'twg',
                'HEAD_PENDING' => 'head',
                default => 'twg',
            };
        }

        DB::transaction(function () use ($ppmp, $user, $nextStatus, $nextRole) {
            $now = now();
            $previousStatus = $ppmp->status;
            $isResubmission = in_array($previousStatus, [
                'TWG_RETURNED',
                'BUDGET_OFFICER_RETURNED',
                'PACCO_RETURNED',
                'OPPMO_RETURNED',
                'HEAD_RETURNED',
            ]) || str_ends_with((string)$previousStatus, '_RETURNED');
            $receivedAt = $ppmp->enduser_received_at ?? $now;

            $this->markLatestPendingRouteReceived($ppmp->id, $receivedAt);

            $updateData = [
                'status' => $nextStatus,
                'review_submitted_at' => $now,
            ];

            if ($nextStatus === 'BUDGET_OFFICER_REVIEW') {
                $updateData['budget_received_at'] = null;
            } elseif ($nextStatus === 'BUDGET_HEAD_REVIEW') {
                $updateData['budget_head_received_at'] = null;
            } elseif ($nextStatus === 'PACCO_REVIEW') {
                $updateData['pacco_received_at'] = null;
            } elseif ($nextStatus === 'PACCO_HEAD_REVIEW') {
                $updateData['pacco_head_received_at'] = null;
            } elseif ($nextStatus === 'OPPMO_REVIEW') {
                $updateData['oppmo_received_at'] = null;
            } elseif ($nextStatus === 'OPPMO_HEAD_REVIEW') {
                $updateData['oppmo_head_received_at'] = null;
            } elseif ($nextStatus === 'APP_PREPARER_REVIEW') {
                $updateData['app_preparer_received_at'] = null;
            } elseif ($nextStatus === 'GOVERNOR_REVIEW') {
                $updateData['governor_received_at'] = null;
            } elseif ($nextStatus === 'TWG_REVIEW') {
                $updateData['twg_received_at'] = null;
            } elseif ($nextStatus === 'HEAD_PENDING') {
                $updateData['head_received_at'] = null;
                $updateData['head_submitted_at'] = $now;
            }

            $ppmp->update($updateData);

            $idLabel = $this->getPpmpIdentifier($ppmp);

            if ($nextRole === 'head') {
                $targetHeadUsers = $this->getTargetHeadUsers($ppmp->office_id);
                $primaryHeadId = $targetHeadUsers->first()?->id;

                PpmpRoute::create([
                    'ppmp_id' => $ppmp->id,
                    'from_user_id' => $user->id,
                    'to_user_id' => $primaryHeadId,
                    'from_role' => 'end_user',
                    'to_role' => 'head',
                    'action' => 'SUBMITTED_FOR_REVIEW',
                    'status' => 'HEAD_PENDING',
                    'remarks' => 'Resubmitted to Office Head for approval.',
                    'submitted_at' => $now,
                ]);

                foreach ($targetHeadUsers as $head) {
                    SystemNotification::notify(
                        $head->id,
                        'PPMP Resubmitted for Approval',
                        "PPMP {$idLabel} ({$ppmp->title}) was resubmitted by {$user->name} for approval.",
                        $ppmp->id,
                        'info'
                    );
                }

                $authStaffUserIds = User::where('office_id', $ppmp->office_id)
                    ->withRole('authorized_staff')
                    ->where('is_active', true)
                    ->whereNotIn('id', $targetHeadUsers->pluck('id'))
                    ->pluck('id');

                foreach ($authStaffUserIds as $staffId) {
                    SystemNotification::notify(
                        $staffId,
                        'PPMP Resubmitted for Approval (Acting Head)',
                        "PPMP {$idLabel} ({$ppmp->title}) was resubmitted by {$user->name} for approval on behalf of the Office Head.",
                        $ppmp->id,
                        'info'
                    );
                }
            } else {
                $targetReviewerId = null;
                if ($nextRole === 'twg' && $ppmp->twg_reviewer_id) {
                    $targetReviewerId = $ppmp->twg_reviewer_id;
                    $targetReviewers = User::where('id', $targetReviewerId)->where('is_active', true)->get();
                } elseif (in_array($nextRole, ['budget_officer', 'pacco']) && $ppmp->budget_reviewer_id) {
                    $targetReviewerId = $ppmp->budget_reviewer_id;
                    $targetReviewers = User::where('id', $targetReviewerId)->where('is_active', true)->get();
                } elseif ($nextRole === 'oppmo' && $ppmp->oppmo_reviewer_id) {
                    $targetReviewerId = $ppmp->oppmo_reviewer_id;
                    $targetReviewers = User::where('id', $targetReviewerId)->where('is_active', true)->get();
                } else {
                    $targetReviewers = User::withRole($nextRole)->where('is_active', true)->get();
                    $targetReviewerId = $targetReviewers->first()?->id;
                }

                PpmpRoute::create([
                    'ppmp_id' => $ppmp->id,
                    'from_user_id' => $user->id,
                    'to_user_id' => $targetReviewerId,
                    'from_role' => 'end_user',
                    'to_role' => $nextRole,
                    'action' => 'SUBMITTED_FOR_REVIEW',
                    'status' => $nextStatus,
                    'remarks' => $isResubmission
                        ? "Resubmitted for {$nextRole} review following compliance."
                        : ($nextStatus === 'TWG_REVIEW'
                            ? 'Submitted for BAC-TWG technical review.'
                            : "Resubmitted for review to {$nextRole}."),
                    'submitted_at' => $now,
                ]);

                $notifTitle = $isResubmission ? 'PPMP Resubmitted for Review' : 'PPMP Submitted for Review';
                $notifMsg = $isResubmission
                    ? "PPMP {$idLabel} ({$ppmp->title}) was resubmitted by {$user->name} following compliance."
                    : "PPMP {$idLabel} ({$ppmp->title}) is ready for your review.";

                foreach ($targetReviewers as $rev) {
                    SystemNotification::notify(
                        $rev->id,
                        $notifTitle,
                        $notifMsg,
                        $ppmp->id,
                        'info'
                    );
                }
            }

            AuditLog::log('PPMP_SUBMITTED_FOR_REVIEW', 'ppmps', $ppmp->id, null, ['target' => $nextStatus], $user->id);
        });

        return response()->json([
            'message' => 'PPMP submitted for formal review successfully.',
            'ppmp' => $ppmp->fresh([
                'office.head',
                'creator',
                'signatures.user',
                'routes.fromUser',
                'routes.toUser',
                'twgReviewer',
                'budgetReviewer',
                'oppmoReviewer',
            ]),
        ]);
    }

    public function budgetApprove(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        if (!$user->isBudgetOfficer() && !$user->isAdmin()) {
            return response()->json(['message' => 'Only the Provincial Budget Officer or Admin can certify budget.'], 403);
        }

        if ($user->isBudgetOfficer() && $ppmp->budget_reviewer_id && $ppmp->budget_reviewer_id !== $user->id && !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. This PPMP is assigned to a different Budget Officer.'], 403);
        }

        if ($ppmp->status !== 'BUDGET_OFFICER_REVIEW') {
            return response()->json(['message' => "PPMP is not awaiting budget officer review."], 422);
        }

        DB::transaction(function () use ($ppmp, $user) {
            $now = now();
            $receivedAt = $ppmp->budget_received_at ?? $now;

            $budgetUpdate = [
                'status' => 'OPPMO_REVIEW',
                'budget_approved_at' => $now,
                'budget_received_at' => $receivedAt,
                'oppmo_received_at' => null,
            ];
            if (!$ppmp->budget_reviewer_id) {
                $budgetUpdate['budget_reviewer_id'] = $user->id;
            }
            $ppmp->update($budgetUpdate);

            $this->markLatestPendingRouteReceived($ppmp->id, $receivedAt);

            PpmpSignature::updateOrCreate(
                ['ppmp_id' => $ppmp->id, 'role' => 'budget_officer'],
                [
                    'user_id' => $user->id,
                    'signature_type' => 'initial_indicator',
                    'signature_indicator' => 'INIT-PBO-' . strtoupper(substr(md5($user->id . $ppmp->id . $now), 0, 8)),
                    'signer_name' => $user->name,
                    'signer_designation' => $user->designation ?? 'Provincial Budget Officer',
                    'signed_at' => $now,
                ]
            );

            PpmpReview::create([
                'ppmp_id' => $ppmp->id,
                'reviewer_id' => $user->id,
                'reviewer_role' => 'budget_officer',
                'action' => 'approve',
                'remarks' => 'Budget requirements certified and verified.',
                'status_before' => 'BUDGET_OFFICER_REVIEW',
                'status_after' => 'OPPMO_REVIEW',
                'submitted_at' => $ppmp->review_submitted_at ?? $now,
                'received_at' => $receivedAt,
                'acted_at' => $now,
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ]);

            $targetOppmoId = null;
            if ($ppmp->oppmo_reviewer_id && User::where('id', $ppmp->oppmo_reviewer_id)->where('is_active', true)->exists()) {
                $targetOppmoId = $ppmp->oppmo_reviewer_id;
                $oppmoUsers = User::where('id', $targetOppmoId)->get();
            } else {
                $oppmoUsers = User::withRole('oppmo')->where('is_active', true)->get();
                $targetOppmoId = $oppmoUsers->first()?->id;
            }

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $user->id,
                'to_user_id' => $targetOppmoId,
                'from_role' => 'budget_officer',
                'to_role' => 'oppmo',
                'action' => 'BUDGET_APPROVED',
                'status' => 'OPPMO_REVIEW',
                'remarks' => 'Certified budgetary requirement. Routed to OPPMO.',
                'submitted_at' => $now,
                'acted_at' => $now,
            ]);

            $idLabel = $this->getPpmpIdentifier($ppmp);
            foreach ($oppmoUsers as $oppmo) {
                SystemNotification::notify(
                    $oppmo->id,
                    'PPMP Awaiting OPPMO Review',
                    "PPMP {$idLabel} was certified by Budget Office and routed to OPPMO.",
                    $ppmp->id,
                    'info'
                );
            }

            AuditLog::log('PPMP_BUDGET_APPROVED', 'ppmps', $ppmp->id, null, ['status' => 'OPPMO_REVIEW'], $user->id);
        });

        return response()->json([
            'message' => 'PPMP certified by Budget Officer and forwarded to OPPMO.',
            'ppmp' => $ppmp->fresh(['office.head', 'creator', 'signatures.user', 'routes.fromUser', 'routes.toUser']),
        ]);
    }

    public function returnReview(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();
        $isAdmin = $user->isAdmin();

        $allowedStatuses = [
            'TWG_REVIEW',
            'BUDGET_OFFICER_REVIEW',
            'BUDGET_HEAD_REVIEW',
            'PACCO_REVIEW',
            'PACCO_HEAD_REVIEW',
            'OPPMO_REVIEW',
            'OPPMO_HEAD_REVIEW',
            'APP_PREPARER_REVIEW',
            'GOVERNOR_REVIEW',
            'HEAD_PENDING',
        ];
        if (!in_array($ppmp->status, $allowedStatuses, true) && !$isAdmin) {
            return response()->json(['message' => "PPMP cannot be returned in its current status: {$ppmp->status}."], 422);
        }

        if ($ppmp->status === 'TWG_REVIEW') {
            if (!$user->isTwg() && !$isAdmin) {
                return response()->json(['message' => 'Only BAC-TWG or Admin can return this PPMP.'], 403);
            }
            if ($user->isTwg() && $ppmp->twg_reviewer_id && $ppmp->twg_reviewer_id !== $user->id && !$isAdmin) {
                return response()->json(['message' => 'Unauthorized. This PPMP is assigned to a different BAC-TWG reviewer.'], 403);
            }
        } elseif ($ppmp->status === 'BUDGET_OFFICER_REVIEW') {
            if (!$user->isBudgetOfficer() && !$isAdmin) {
                return response()->json(['message' => 'Only the Budget Officer or Admin can return this PPMP.'], 403);
            }
            if ($user->isBudgetOfficer() && $ppmp->budget_reviewer_id && $ppmp->budget_reviewer_id !== $user->id && !$isAdmin) {
                return response()->json(['message' => 'Unauthorized. This PPMP is assigned to a different Budget Officer.'], 403);
            }
        } elseif ($ppmp->status === 'PACCO_REVIEW') {
            if (!$user->isPacco() && !$isAdmin) {
                return response()->json(['message' => 'Only the PACCO Reviewer or Admin can return this PPMP.'], 403);
            }
            if ($user->isPacco() && $ppmp->budget_reviewer_id && $ppmp->budget_reviewer_id !== $user->id && !$isAdmin) {
                return response()->json(['message' => 'Unauthorized. This PPMP is assigned to a different PACCO reviewer.'], 403);
            }
        } elseif ($ppmp->status === 'OPPMO_REVIEW') {
            if (!$user->isOppmo() && !$isAdmin) {
                return response()->json(['message' => 'Only OPPMO or Admin can return this PPMP.'], 403);
            }
            if ($user->isOppmo() && $ppmp->oppmo_reviewer_id && $ppmp->oppmo_reviewer_id !== $user->id && !$isAdmin) {
                return response()->json(['message' => 'Unauthorized. This PPMP is assigned to a different OPPMO reviewer.'], 403);
            }
        } elseif (in_array($ppmp->status, ['BUDGET_HEAD_REVIEW', 'PACCO_HEAD_REVIEW', 'OPPMO_HEAD_REVIEW', 'APP_PREPARER_REVIEW', 'GOVERNOR_REVIEW'], true)) {
            $headStage = ReviewHeadResolver::stageForStatus($ppmp->status);
            if (in_array($headStage, ['app_preparer', 'governor'], true)) {
                $expectedUser = ReviewHeadResolver::resolveAppSignatoryUser($headStage);
                if (!$isAdmin && (!$expectedUser || (int) $user->id !== (int) $expectedUser->id)) {
                    return response()->json(['message' => 'Unauthorized. This PPMP is awaiting another signatory.'], 403);
                }
            } else {
                $expectedOfficeId = $headStage ? ReviewHeadResolver::resolveOfficeIdForStage($headStage, $ppmp) : null;
                if (!$user->isHead() && !$isAdmin) {
                    return response()->json(['message' => 'Only the reviewing Office Head or Admin can return this PPMP.'], 403);
                }
                if ($user->isHead() && (!$expectedOfficeId || (int) $user->office_id !== $expectedOfficeId)) {
                    return response()->json(['message' => 'Unauthorized. This PPMP is awaiting another Office Head.'], 403);
                }
            }
        }

        $validated = $request->validate([
            'target' => 'nullable|string|in:end_user,twg,budget,pacco,oppmo',
            'return_target' => 'nullable|string|in:end_user,twg,budget,pacco,oppmo',
            'target_reviewer_id' => 'nullable|exists:users,id',
            'remarks' => 'required|string|min:3',
            'field_changes' => 'nullable|array',
        ]);

        $target = $validated['target'] ?? $validated['return_target'] ?? 'end_user';
        $remarks = trim($validated['remarks']);
        $now = now();
        $idLabel = $this->getPpmpIdentifier($ppmp);

        return DB::transaction(function () use ($ppmp, $user, $target, $remarks, $validated, $now, $idLabel) {
            $isTrustFund = $ppmp->isTrustFund();
            $statusBefore = $ppmp->status;

            if ($target === 'twg') {
                $targetUser = null;
                if (!empty($validated['target_reviewer_id'])) {
                    $targetUser = User::find($validated['target_reviewer_id']);
                }
                if (!$targetUser && $ppmp->twg_reviewer_id) {
                    $targetUser = $ppmp->twgReviewer ?: User::find($ppmp->twg_reviewer_id);
                }
                if (!$targetUser) {
                    $targetUser = User::withRole('twg')->where('is_active', true)->first();
                }

                if (!$targetUser) {
                    return response()->json(['message' => 'No active BAC-TWG reviewer found to return this PPMP to.'], 422);
                }

                $ppmp->update([
                    'status' => 'TWG_REVIEW',
                    'twg_received_at' => null,
                    'twg_reviewer_id' => $targetUser->id,
                ]);

                $ppmp->milestones()->update([
                    'twg_approved_at' => null,
                    'budget_approved_at' => null,
                    'pacco_approved_at' => null,
                    'oppmo_approved_at' => null,
                ]);

                $this->applyFieldModifications($ppmp, $validated['field_changes'] ?? [], $user, $user->role);
                $this->markLatestPendingRouteReceived($ppmp->id, $now);

                PpmpReview::create([
                    'ppmp_id' => $ppmp->id,
                    'reviewer_id' => $user->id,
                    'reviewer_role' => $user->role,
                    'action' => 'return',
                    'remarks' => "[Returned to BAC-TWG Reviewer {$targetUser->name}]: {$remarks}",
                    'status_before' => $statusBefore,
                    'status_after' => 'TWG_REVIEW',
                    'submitted_at' => $now,
                    'received_at' => $now,
                    'acted_at' => $now,
                    'ip_address' => request()->ip(),
                    'user_agent' => request()->userAgent(),
                ]);

                PpmpRoute::create([
                    'ppmp_id' => $ppmp->id,
                    'from_user_id' => $user->id,
                    'to_user_id' => $targetUser->id,
                    'from_role' => $user->role,
                    'to_role' => 'twg',
                    'action' => 'RETURNED_TO_TWG',
                    'status' => 'TWG_REVIEW',
                    'remarks' => $remarks,
                    'submitted_at' => $now,
                    'acted_at' => $now,
                ]);

                SystemNotification::notify(
                    $targetUser->id,
                    'PPMP Returned for Technical Re-evaluation',
                    "PPMP {$idLabel} has been returned to you by {$user->name} ({$user->role}) with remarks: " . Str::limit($remarks, 120),
                    $ppmp->id,
                    'warning'
                );

                AuditLog::log('PPMP_RETURNED_TO_TWG', 'ppmps', $ppmp->id, null, [
                    'returned_by' => $user->id,
                    'target_twg_id' => $targetUser->id,
                    'remarks' => $remarks,
                ], $user->id);

                return response()->json([
                    'message' => "PPMP returned to BAC-TWG Reviewer ({$targetUser->name}) for re-evaluation.",
                    'ppmp' => $ppmp->fresh(['office.head', 'creator', 'signatures.user', 'routes.fromUser', 'routes.toUser', 'twgReviewer', 'budgetReviewer', 'oppmoReviewer']),
                ]);
            }

            if ($target === 'budget' || $target === 'pacco') {
                $targetRole = ($target === 'pacco' || $isTrustFund) ? 'pacco' : 'budget_officer';
                $targetStatus = $targetRole === 'pacco' ? 'PACCO_REVIEW' : 'BUDGET_OFFICER_REVIEW';

                $targetUser = null;
                if (!empty($validated['target_reviewer_id'])) {
                    $targetUser = User::find($validated['target_reviewer_id']);
                }
                if (!$targetUser && $ppmp->budget_reviewer_id) {
                    $targetUser = $ppmp->budgetReviewer ?: User::find($ppmp->budget_reviewer_id);
                }
                if (!$targetUser) {
                    $targetUser = User::withRole($targetRole)->where('is_active', true)->first();
                }

                if (!$targetUser) {
                    return response()->json(['message' => "No active {$targetRole} reviewer found to return this PPMP to."], 422);
                }

                $ppmp->update([
                    'status' => $targetStatus,
                    'budget_received_at' => null,
                    'pacco_received_at' => null,
                    'budget_reviewer_id' => $targetUser->id,
                ]);

                $ppmp->milestones()->update([
                    'budget_approved_at' => null,
                    'pacco_approved_at' => null,
                    'oppmo_approved_at' => null,
                ]);

                $this->applyFieldModifications($ppmp, $validated['field_changes'] ?? [], $user, $user->role);
                $this->markLatestPendingRouteReceived($ppmp->id, $now);

                $targetLabel = $targetRole === 'pacco' ? 'PACCO Reviewer' : 'Budget Officer';

                PpmpReview::create([
                    'ppmp_id' => $ppmp->id,
                    'reviewer_id' => $user->id,
                    'reviewer_role' => $user->role,
                    'action' => 'return',
                    'remarks' => "[Returned to {$targetLabel} {$targetUser->name}]: {$remarks}",
                    'status_before' => $statusBefore,
                    'status_after' => $targetStatus,
                    'submitted_at' => $now,
                    'received_at' => $now,
                    'acted_at' => $now,
                    'ip_address' => request()->ip(),
                    'user_agent' => request()->userAgent(),
                ]);

                PpmpRoute::create([
                    'ppmp_id' => $ppmp->id,
                    'from_user_id' => $user->id,
                    'to_user_id' => $targetUser->id,
                    'from_role' => $user->role,
                    'to_role' => $targetRole,
                    'action' => 'RETURNED_TO_' . strtoupper($targetRole),
                    'status' => $targetStatus,
                    'remarks' => $remarks,
                    'submitted_at' => $now,
                    'acted_at' => $now,
                ]);

                SystemNotification::notify(
                    $targetUser->id,
                    "PPMP Returned for {$targetLabel} Review",
                    "PPMP {$idLabel} has been returned to you by {$user->name} ({$user->role}) with remarks: " . Str::limit($remarks, 120),
                    $ppmp->id,
                    'warning'
                );

                AuditLog::log('PPMP_RETURNED_TO_' . strtoupper($targetRole), 'ppmps', $ppmp->id, null, [
                    'returned_by' => $user->id,
                    'target_user_id' => $targetUser->id,
                    'remarks' => $remarks,
                ], $user->id);

                return response()->json([
                    'message' => "PPMP returned to {$targetLabel} ({$targetUser->name}) for re-evaluation.",
                    'ppmp' => $ppmp->fresh(['office.head', 'creator', 'signatures.user', 'routes.fromUser', 'routes.toUser', 'twgReviewer', 'budgetReviewer', 'oppmoReviewer']),
                ]);
            }

            $returnedStatus = match ($ppmp->status) {
                'TWG_REVIEW' => 'TWG_RETURNED',
                'BUDGET_OFFICER_REVIEW' => 'BUDGET_OFFICER_RETURNED',
                'BUDGET_HEAD_REVIEW' => 'BUDGET_HEAD_RETURNED',
                'PACCO_REVIEW' => 'PACCO_RETURNED',
                'PACCO_HEAD_REVIEW' => 'PACCO_HEAD_RETURNED',
                'OPPMO_REVIEW' => 'OPPMO_RETURNED',
                'OPPMO_HEAD_REVIEW' => 'OPPMO_HEAD_RETURNED',
                'APP_PREPARER_REVIEW' => 'APP_PREPARER_RETURNED',
                'GOVERNOR_REVIEW' => 'GOVERNOR_RETURNED',
                'HEAD_PENDING' => 'HEAD_RETURNED',
                default => 'TWG_RETURNED',
            };

            $ppmp->update([
                'status' => $returnedStatus,
                'enduser_received_at' => null,
            ]);

            $this->applyFieldModifications($ppmp, $validated['field_changes'] ?? [], $user, $user->role);
            $this->markLatestPendingRouteReceived($ppmp->id, $now);

            PpmpReview::create([
                'ppmp_id' => $ppmp->id,
                'reviewer_id' => $user->id,
                'reviewer_role' => $user->role,
                'action' => 'return',
                'remarks' => $remarks,
                'status_before' => $statusBefore,
                'status_after' => $returnedStatus,
                'submitted_at' => $now,
                'received_at' => $now,
                'acted_at' => $now,
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ]);

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $user->id,
                'to_user_id' => $ppmp->created_by,
                'from_role' => $user->role,
                'to_role' => 'end_user',
                'action' => $returnedStatus,
                'status' => $returnedStatus,
                'remarks' => $remarks,
                'submitted_at' => $now,
                'acted_at' => $now,
            ]);

            SystemNotification::notify(
                $ppmp->created_by,
                "PPMP Returned by Reviewer ({$user->name})",
                "PPMP {$idLabel} returned: " . Str::limit($remarks, 100),
                $ppmp->id,
                'warning'
            );

            AuditLog::log('PPMP_RETURNED_TO_END_USER', 'ppmps', $ppmp->id, null, ['remarks' => $remarks], $user->id);

            return response()->json([
                'message' => 'PPMP returned to End User for correction.',
                'ppmp' => $ppmp->fresh(['office.head', 'creator', 'signatures.user', 'routes.fromUser', 'routes.toUser', 'twgReviewer', 'budgetReviewer', 'oppmoReviewer']),
            ]);
        });
    }

    public function budgetReturn(Request $request, string $uuid): JsonResponse
    {
        return $this->returnReview($request, $uuid);
    }

    public function paccoApprove(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        if (!$user->isPacco() && !$user->isAdmin()) {
            return response()->json(['message' => 'Only the PACCO Reviewer or Admin can certify trust funds.'], 403);
        }

        if ($user->isPacco() && $ppmp->budget_reviewer_id && $ppmp->budget_reviewer_id !== $user->id && !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. This PPMP is assigned to a different PACCO reviewer.'], 403);
        }

        if ($ppmp->status !== 'PACCO_REVIEW') {
            return response()->json(['message' => "PPMP is not awaiting PACCO review."], 422);
        }

        DB::transaction(function () use ($ppmp, $user) {
            $now = now();
            $receivedAt = $ppmp->pacco_received_at ?? $now;

            $paccoUpdate = [
                'status' => 'OPPMO_REVIEW',
                'pacco_approved_at' => $now,
                'pacco_received_at' => $receivedAt,
                'oppmo_received_at' => null,
            ];
            if (!$ppmp->budget_reviewer_id) {
                $paccoUpdate['budget_reviewer_id'] = $user->id;
            }
            $ppmp->update($paccoUpdate);

            $this->markLatestPendingRouteReceived($ppmp->id, $receivedAt);

            $paccoOfficial = \App\Models\PpmpSignatory::where('signatory_type', 'pacco_requirement')->where('is_active', true)->first();
            $signerName = $paccoOfficial?->name ?? ($user->name !== 'PACCO Reviewer' ? $user->name : 'MAY FERNANDO-UY, CPA');
            $signerDesignation = $paccoOfficial?->position ?? ($user->designation !== 'Provincial Accounting Reviewer' ? $user->designation : 'Provincial Accountant');

            PpmpSignature::updateOrCreate(
                ['ppmp_id' => $ppmp->id, 'role' => 'pacco'],
                [
                    'user_id' => $user->id,
                    'signature_type' => 'initial_indicator',
                    'signature_indicator' => 'INIT-PACCO-' . strtoupper(substr(md5($user->id . $ppmp->id . $now), 0, 8)),
                    'signer_name' => $signerName,
                    'signer_designation' => $signerDesignation,
                    'signed_at' => $now,
                ]
            );

            PpmpReview::create([
                'ppmp_id' => $ppmp->id,
                'reviewer_id' => $user->id,
                'reviewer_role' => 'pacco',
                'action' => 'approve',
                'remarks' => 'Trust Fund requirements certified and verified by PACCO.',
                'status_before' => 'PACCO_REVIEW',
                'status_after' => 'OPPMO_REVIEW',
                'submitted_at' => $ppmp->review_submitted_at ?? $now,
                'received_at' => $receivedAt,
                'acted_at' => $now,
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ]);

            $targetOppmoId = null;
            if ($ppmp->oppmo_reviewer_id && User::where('id', $ppmp->oppmo_reviewer_id)->where('is_active', true)->exists()) {
                $targetOppmoId = $ppmp->oppmo_reviewer_id;
                $oppmoUsers = User::where('id', $targetOppmoId)->get();
            } else {
                $oppmoUsers = User::withRole('oppmo')->where('is_active', true)->get();
                $targetOppmoId = $oppmoUsers->first()?->id;
            }

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $user->id,
                'to_user_id' => $targetOppmoId,
                'from_role' => 'pacco',
                'to_role' => 'oppmo',
                'action' => 'PACCO_APPROVED',
                'status' => 'OPPMO_REVIEW',
                'remarks' => 'Certified Trust Fund requirement. Routed to OPPMO.',
                'submitted_at' => $now,
                'acted_at' => $now,
            ]);

            $idLabel = $this->getPpmpIdentifier($ppmp);
            foreach ($oppmoUsers as $oppmo) {
                SystemNotification::notify(
                    $oppmo->id,
                    'PPMP Awaiting OPPMO Review',
                    "PPMP {$idLabel} (Trust Fund) was certified by PACCO and routed to OPPMO.",
                    $ppmp->id,
                    'info'
                );
            }

            AuditLog::log('PPMP_PACCO_APPROVED', 'ppmps', $ppmp->id, null, ['status' => 'OPPMO_REVIEW'], $user->id);
        });

        return response()->json([
            'message' => 'PPMP certified by PACCO Reviewer and forwarded to OPPMO.',
            'ppmp' => $ppmp->fresh(['office.head', 'creator', 'signatures.user', 'routes.fromUser', 'routes.toUser']),
        ]);
    }

    public function paccoReturn(Request $request, string $uuid): JsonResponse
    {
        return $this->returnReview($request, $uuid);
    }

    public function oppmoApprove(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        if (!$user->isOppmo() && !$user->isAdmin()) {
            return response()->json(['message' => 'Only OPPMO or Admin can approve this stage.'], 403);
        }

        if ($user->isOppmo() && $ppmp->oppmo_reviewer_id && $ppmp->oppmo_reviewer_id !== $user->id && !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. This PPMP is assigned to a different OPPMO reviewer.'], 403);
        }

        if ($ppmp->status !== 'OPPMO_REVIEW') {
            return response()->json(['message' => "PPMP is not awaiting OPPMO review."], 422);
        }

        if (!$ppmp->hasAppGenerated()) {
            return response()->json([
                'message' => 'Please generate or regenerate the Annual Procurement Plan (APP) before granting final approval.'
            ], 422);
        }

        $budgetaryStage = $ppmp->isTrustFund() ? 'pacco' : 'budget';
        $nextStep = ReviewHeadResolver::resolveNextPostOppmoStep(
            $ppmp,
            [$budgetaryStage, 'oppmo', 'app_preparer', 'governor'],
            $user
        );

        $nextStatus = $nextStep['status'] ?? 'READY_TO_PRINT';
        $nextHeadUser = $nextStep['user'] ?? null;
        $nextHeadRole = $nextStep['role'] ?? null;
        $nextHeadLabel = $nextStep['label'] ?? null;

        DB::transaction(function () use ($ppmp, $user, $nextStatus, $nextHeadUser, $nextHeadRole, $nextHeadLabel) {
            $now = now();
            $receivedAt = $ppmp->oppmo_received_at ?? $now;

            $appData = is_array($ppmp->app_data) ? $ppmp->app_data : [];
            $appData['is_oppmo_approved'] = true;
            $appData['oppmo_approved_at'] = $now->toIso8601String();
            $appData['oppmo_approved_by_id'] = $user->id;
            $appData['oppmo_approved_by_name'] = $user->name;

            $updateData = [
                'status' => $nextStatus,
                'app_data' => $appData,
                'oppmo_approved_at' => $now,
                'oppmo_app_approved_at' => $now,
                'oppmo_received_at' => $receivedAt,
            ];
            if (!$ppmp->oppmo_reviewer_id) {
                $updateData['oppmo_reviewer_id'] = $user->id;
            }

            if ($nextStatus === 'BUDGET_HEAD_REVIEW') {
                $updateData['budget_head_received_at'] = null;
            } elseif ($nextStatus === 'PACCO_HEAD_REVIEW') {
                $updateData['pacco_head_received_at'] = null;
            } elseif ($nextStatus === 'OPPMO_HEAD_REVIEW') {
                $updateData['oppmo_head_received_at'] = null;
            } elseif ($nextStatus === 'APP_PREPARER_REVIEW') {
                $updateData['app_preparer_received_at'] = null;
            } elseif ($nextStatus === 'GOVERNOR_REVIEW') {
                $updateData['governor_received_at'] = null;
            } else {
                $updateData['ready_to_print_at'] = $now;
                $updateData['enduser_received_at'] = null;
            }

            $ppmp->update($updateData);

            $this->markLatestPendingRouteReceived($ppmp->id, $receivedAt);

            PpmpSignature::updateOrCreate(
                ['ppmp_id' => $ppmp->id, 'role' => 'oppmo'],
                [
                    'user_id' => $user->id,
                    'signature_type' => 'initial_indicator',
                    'signature_indicator' => 'INIT-OPPMO-' . strtoupper(substr(md5($user->id . $ppmp->id . $now), 0, 8)),
                    'signer_name' => $user->name,
                    'signer_designation' => $user->designation ?? 'OPPMO Officer',
                    'signed_at' => $now,
                ]
            );

            $reviewRemarks = $nextHeadUser
                ? "Annual Procurement Plan (APP) generated and verified. Routed to {$nextHeadLabel} ({$nextHeadUser->name}) for review and PNPKI e-signature."
                : 'Annual Procurement Plan (APP) generated and verified. PPMP finalized and approved READY TO PRINT.';

            PpmpReview::create([
                'ppmp_id' => $ppmp->id,
                'reviewer_id' => $user->id,
                'reviewer_role' => 'oppmo',
                'action' => 'approve',
                'remarks' => $reviewRemarks,
                'status_before' => 'OPPMO_REVIEW',
                'status_after' => $nextStatus,
                'submitted_at' => $ppmp->budget_approved_at ?? ($ppmp->pacco_approved_at ?? $now),
                'received_at' => $receivedAt,
                'acted_at' => $now,
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ]);

            $idLabel = $this->getPpmpIdentifier($ppmp);

            if ($nextHeadUser && $nextHeadRole) {
                PpmpRoute::create([
                    'ppmp_id' => $ppmp->id,
                    'from_user_id' => $user->id,
                    'to_user_id' => $nextHeadUser->id,
                    'from_role' => 'oppmo',
                    'to_role' => $nextHeadRole,
                    'action' => 'OPPMO_APPROVED_APP',
                    'status' => $nextStatus,
                    'remarks' => $reviewRemarks,
                    'submitted_at' => $now,
                    'acted_at' => $now,
                ]);

                SystemNotification::notify(
                    $nextHeadUser->id,
                    "PPMP Awaiting {$nextHeadLabel} Review & E-Signature",
                    "PPMP {$idLabel} ({$ppmp->title}) was verified by OPPMO Reviewer with APP generated and awaits your review and PNPKI e-signature.",
                    $ppmp->id,
                    'info'
                );
            } else {
                PpmpRoute::create([
                    'ppmp_id' => $ppmp->id,
                    'from_user_id' => $user->id,
                    'to_user_id' => $ppmp->created_by,
                    'from_role' => 'oppmo',
                    'to_role' => 'end_user',
                    'action' => 'OPPMO_APPROVED_APP',
                    'status' => 'READY_TO_PRINT',
                    'remarks' => 'Annual Procurement Plan (APP) generated and verified. PPMP is officially approved and READY TO PRINT.',
                    'submitted_at' => $now,
                    'acted_at' => $now,
                ]);

                SystemNotification::notify(
                    $ppmp->created_by,
                    'PPMP Approved & Ready to Print',
                    "Congratulations! PPMP {$idLabel} ({$ppmp->title}) was approved by OPPMO with Annual Procurement Plan (APP) generated and is now READY TO PRINT.",
                    $ppmp->id,
                    'success'
                );
            }

            AuditLog::log('PPMP_OPPMO_APP_APPROVED', 'ppmps', $ppmp->id, null, ['status' => $nextStatus], $user->id);
        });

        return response()->json([
            'message' => $nextHeadUser
                ? "Annual Procurement Plan (APP) generated and PPMP forwarded to {$nextHeadLabel} ({$nextHeadUser->name}) for review & PNPKI e-signature."
                : 'Annual Procurement Plan (APP) generated and PPMP approved. Document is now READY TO PRINT.',
            'ppmp' => $ppmp->fresh(['office.head', 'creator', 'signatures.user', 'routes.fromUser', 'routes.toUser']),
        ]);
    }

    public function budgetHeadApprove(Request $request, string $uuid): JsonResponse
    {
        return $this->approveReviewHead($request, $uuid, 'budget');
    }

    public function paccoHeadApprove(Request $request, string $uuid): JsonResponse
    {
        return $this->approveReviewHead($request, $uuid, 'pacco');
    }

    public function oppmoHeadApprove(Request $request, string $uuid): JsonResponse
    {
        return $this->approveReviewHead($request, $uuid, 'oppmo');
    }

    public function appPreparerApprove(Request $request, string $uuid): JsonResponse
    {
        return $this->approveReviewHead($request, $uuid, 'app_preparer');
    }

    public function governorApprove(Request $request, string $uuid): JsonResponse
    {
        return $this->approveReviewHead($request, $uuid, 'governor');
    }

    protected function approveReviewHead(Request $request, string $uuid, string $stage): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        $expectedStatus = match ($stage) {
            'budget' => 'BUDGET_HEAD_REVIEW',
            'pacco' => 'PACCO_HEAD_REVIEW',
            'oppmo' => 'OPPMO_HEAD_REVIEW',
            'app_preparer' => 'APP_PREPARER_REVIEW',
            'governor' => 'GOVERNOR_REVIEW',
        };

        $officeLabel = match ($stage) {
            'budget' => 'Budget Office Head',
            'pacco' => 'PACCO Head',
            'oppmo' => 'OPPMO Head',
            'app_preparer' => 'APP Preparer',
            'governor' => 'Provincial Governor',
        };

        $isAppSignatoryStage = in_array($stage, ['app_preparer', 'governor'], true);
        if ($isAppSignatoryStage) {
            $expectedUser = ReviewHeadResolver::resolveAppSignatoryUser($stage);
            if (!$user->isAdmin() && (!$expectedUser || (int) $user->id !== (int) $expectedUser->id)) {
                return response()->json(['message' => "Unauthorized. This PPMP is awaiting {$officeLabel} approval."], 403);
            }
        } else {
            if (!$user->isHead() && !$user->isAdmin()) {
                return response()->json(['message' => "Only the {$officeLabel} or Admin can approve this stage."], 403);
            }

            if ($user->isHead()) {
                $expectedOfficeId = ReviewHeadResolver::resolveOfficeIdForStage($stage, $ppmp);
                if (!$expectedOfficeId || (int) $user->office_id !== $expectedOfficeId) {
                    return response()->json(['message' => "Unauthorized. This PPMP is awaiting {$officeLabel} approval."], 403);
                }
            }
        }

        if ($ppmp->status !== $expectedStatus) {
            return response()->json(['message' => "PPMP is not awaiting {$officeLabel} review."], 422);
        }

        $remainingCandidates = match ($stage) {
            'budget', 'pacco' => ['oppmo', 'app_preparer', 'governor'],
            'oppmo' => ['app_preparer', 'governor'],
            'app_preparer' => ['governor'],
            'governor' => [],
        };

        $nextStep = ReviewHeadResolver::resolveNextPostOppmoStep($ppmp, $remainingCandidates);
        $nextStatus = $nextStep['status'] ?? 'READY_TO_PRINT';
        $nextUser = $nextStep['user'] ?? null;
        $nextRole = $nextStep['role'] ?? null;
        $nextLabel = $nextStep['label'] ?? null;

        DB::transaction(function () use ($ppmp, $user, $stage, $expectedStatus, $nextStatus, $officeLabel, $nextUser, $nextRole, $nextLabel) {
            $now = now();
            $fieldPrefix = match ($stage) {
                'app_preparer' => 'app_preparer',
                'governor' => 'governor',
                default => "{$stage}_head",
            };
            $receivedField = "{$fieldPrefix}_received_at";
            $approvedField = "{$fieldPrefix}_approved_at";
            $receivedAt = $ppmp->{$receivedField} ?? $now;

            $updateData = [
                'status' => $nextStatus,
                $receivedField => $receivedAt,
                $approvedField => $now,
            ];

            if ($nextStatus === 'OPPMO_HEAD_REVIEW') {
                $updateData['oppmo_head_received_at'] = null;
            } elseif ($nextStatus === 'APP_PREPARER_REVIEW') {
                $updateData['app_preparer_received_at'] = null;
            } elseif ($nextStatus === 'GOVERNOR_REVIEW') {
                $updateData['governor_received_at'] = null;
            } else {
                $updateData['ready_to_print_at'] = $now;
                $updateData['enduser_received_at'] = null;
            }

            $ppmp->update($updateData);
            $this->markLatestPendingRouteReceived($ppmp->id, $receivedAt);

            $sigRole = match ($stage) {
                'app_preparer' => 'app_preparer',
                'governor' => 'governor',
                default => "{$stage}_head",
            };
            $sigPrefix = 'ESIG-' . strtoupper(str_replace('_', '-', $sigRole)) . '-';
            PpmpSignature::updateOrCreate(
                ['ppmp_id' => $ppmp->id, 'role' => $sigRole],
                [
                    'user_id' => $user->id,
                    'signature_type' => 'full_esignature',
                    'signature_indicator' => $sigPrefix . strtoupper(substr(md5($user->id . $ppmp->id . $now), 0, 8)),
                    'signer_name' => $user->name,
                    'signer_designation' => $user->designation ?? $officeLabel,
                    'signed_at' => $now,
                ]
            );

            $remarks = $nextStatus === 'READY_TO_PRINT'
                ? "Reviewed and digitally signed by {$officeLabel} (PNPKI). PPMP is officially approved and READY TO PRINT."
                : "Reviewed and digitally signed by {$officeLabel} (PNPKI). Routed to {$nextLabel} ({$nextUser?->name}) for PNPKI e-signature.";

            PpmpReview::create([
                'ppmp_id' => $ppmp->id,
                'reviewer_id' => $user->id,
                'reviewer_role' => $sigRole,
                'action' => 'approve',
                'remarks' => $remarks,
                'status_before' => $expectedStatus,
                'status_after' => $nextStatus,
                'submitted_at' => $ppmp->review_submitted_at ?? $now,
                'received_at' => $receivedAt,
                'acted_at' => $now,
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ]);

            $idLabel = $this->getPpmpIdentifier($ppmp);
            $actionCode = strtoupper($sigRole) . '_APPROVED';

            if ($nextStatus === 'READY_TO_PRINT') {
                PpmpRoute::create([
                    'ppmp_id' => $ppmp->id,
                    'from_user_id' => $user->id,
                    'to_user_id' => $ppmp->created_by,
                    'from_role' => $sigRole,
                    'to_role' => 'end_user',
                    'action' => $actionCode,
                    'status' => 'READY_TO_PRINT',
                    'remarks' => $remarks,
                    'submitted_at' => $now,
                    'acted_at' => $now,
                ]);

                SystemNotification::notify(
                    $ppmp->created_by,
                    'PPMP Approved & Ready to Print',
                    "Congratulations! PPMP {$idLabel} ({$ppmp->title}) was reviewed and digitally signed by {$officeLabel} ({$user->name}) and is now READY TO PRINT.",
                    $ppmp->id,
                    'success'
                );
            } else {
                PpmpRoute::create([
                    'ppmp_id' => $ppmp->id,
                    'from_user_id' => $user->id,
                    'to_user_id' => $nextUser->id,
                    'from_role' => $sigRole,
                    'to_role' => $nextRole,
                    'action' => $actionCode,
                    'status' => $nextStatus,
                    'remarks' => $remarks,
                    'submitted_at' => $now,
                    'acted_at' => $now,
                ]);

                SystemNotification::notify(
                    $nextUser->id,
                    "PPMP Awaiting {$nextLabel} Review & E-Signature",
                    "PPMP {$idLabel} ({$ppmp->title}) was reviewed and digitally signed by {$officeLabel} ({$user->name}) and awaits your review and PNPKI e-signature.",
                    $ppmp->id,
                    'info'
                );
            }

            AuditLog::log('PPMP_' . $actionCode, 'ppmps', $ppmp->id, null, ['status' => $nextStatus], $user->id);
        });

        return response()->json([
            'message' => $nextStatus === 'READY_TO_PRINT'
                ? "PPMP approved and digitally signed by {$officeLabel}. Document is now READY TO PRINT."
                : "PPMP approved and digitally signed by {$officeLabel} and forwarded to {$nextLabel} ({$nextUser?->name}) for PNPKI e-signature.",
            'ppmp' => $ppmp->fresh(['office.head', 'creator', 'signatures.user', 'routes.fromUser', 'routes.toUser']),
        ]);
    }

    public function oppmoReturn(Request $request, string $uuid): JsonResponse
    {
        return $this->returnReview($request, $uuid);
    }

    public function twgApprove(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        if (!$user->isTwg() && !$user->isAdmin()) {
            return response()->json(['message' => 'Only BAC-TWG or Admin can approve this stage.'], 403);
        }

        if ($user->isTwg() && $ppmp->twg_reviewer_id && $ppmp->twg_reviewer_id !== $user->id && !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. This PPMP is assigned to a different BAC-TWG reviewer.'], 403);
        }

        if ($ppmp->status !== 'TWG_REVIEW') {
            return response()->json(['message' => "PPMP is not awaiting TWG review."], 422);
        }

        if ($ppmp->amendment_scope === 'PPMP_APP' && $ppmp->amendment_type !== 'SUPPLEMENTAL') {
            return response()->json(['message' => 'BAC-TWG review is not applicable for this PPMP revision because the amendment scope is restricted to PPMP/APP only.'], 422);
        }

        DB::transaction(function () use ($ppmp, $user) {
            $now = now();
            $receivedAt = $ppmp->twg_received_at ?? $now;
            $isAttachOnly = $ppmp->amendment_scope === 'ATTACHMENT_LIST';
            $isTrust = $ppmp->isTrustFund();

            $endUserHead = null;
            $requiresEndUserHead = false;
            if ($isAttachOnly) {
                $endUserHead = ReviewHeadResolver::resolveEndUserOfficeHead($ppmp);
                $requiresEndUserHead = ReviewHeadResolver::requiresHeadEsignReview($endUserHead);
            }

            $nextStatus = $isAttachOnly
                ? ($requiresEndUserHead ? 'HEAD_PENDING' : 'READY_TO_PRINT')
                : ($isTrust ? 'PACCO_REVIEW' : 'BUDGET_OFFICER_REVIEW');
            $nextRole = $isAttachOnly
                ? ($requiresEndUserHead ? 'head' : 'end_user')
                : ($isTrust ? 'pacco' : 'budget_officer');

            $updateData = [
                'status' => $nextStatus,
                'twg_approved_at' => $now,
                'twg_received_at' => $receivedAt,
            ];
            if (!$ppmp->twg_reviewer_id) {
                $updateData['twg_reviewer_id'] = $user->id;
            }
            if ($isAttachOnly) {
                if ($requiresEndUserHead) {
                    $updateData['head_submitted_at'] = $now;
                    $updateData['head_received_at'] = null;
                } else {
                    $updateData['ready_to_print_at'] = $now;
                    $updateData['enduser_received_at'] = null;
                }
            } elseif ($isTrust) {
                $updateData['pacco_received_at'] = null;
            } else {
                $updateData['budget_received_at'] = null;
            }
            $ppmp->update($updateData);

            $this->markLatestPendingRouteReceived($ppmp->id, $receivedAt);

            PpmpSignature::updateOrCreate(
                ['ppmp_id' => $ppmp->id, 'role' => 'twg'],
                [
                    'user_id' => $user->id,
                    'signature_type' => 'full_esignature',
                    'signature_indicator' => 'ESIG-TWG-' . strtoupper(substr(md5($user->id . $ppmp->id . $now), 0, 8)),
                    'signer_name' => $user->name,
                    'signer_designation' => $user->designation ?? 'BAC Technical Working Group (TWG) Member',
                    'signed_at' => $now,
                ]
            );

            if (!empty($ppmp->attachment_list_data) && is_array($ppmp->attachment_list_data)) {
                $attData = $ppmp->attachment_list_data;
                $attData['approved_by_name'] = $user->name;
                $attData['approved_by_position'] = $user->designation ?: 'BAC Technical Working Group (TWG) Member';
                $ppmp->update(['attachment_list_data' => $attData]);
            }

            PpmpReview::create([
                'ppmp_id' => $ppmp->id,
                'reviewer_id' => $user->id,
                'reviewer_role' => 'twg',
                'action' => 'approve',
                'remarks' => $isAttachOnly
                    ? ($requiresEndUserHead
                        ? "Detailed Specifications verified and approved by BAC-TWG. Routed to Office Head ({$endUserHead?->name}) for review and PNPKI e-signature."
                        : 'Detailed Specifications verified and approved by BAC-TWG. Document is now READY TO PRINT.')
                    : 'BAC-TWG technical review approved. Routed to ' . ($isTrust ? 'PACCO' : 'Provincial Budget Office') . ' for budget certification.',
                'status_before' => 'TWG_REVIEW',
                'status_after' => $nextStatus,
                'submitted_at' => $ppmp->review_submitted_at ?? $now,
                'received_at' => $receivedAt,
                'acted_at' => $now,
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ]);

            $idLabel = $this->getPpmpIdentifier($ppmp);

            if ($isAttachOnly) {
                if ($requiresEndUserHead && $endUserHead) {
                    PpmpRoute::create([
                        'ppmp_id' => $ppmp->id,
                        'from_user_id' => $user->id,
                        'to_user_id' => $endUserHead->id,
                        'from_role' => 'twg',
                        'to_role' => 'head',
                        'action' => 'TWG_APPROVED_ATTACHMENT_LIST',
                        'status' => 'HEAD_PENDING',
                        'remarks' => "Updated Detailed Specifications evaluated and approved by BAC-TWG. Routed to Office Head ({$endUserHead->name}) for review and PNPKI e-signature.",
                        'submitted_at' => $now,
                        'acted_at' => $now,
                    ]);

                    SystemNotification::notify(
                        $endUserHead->id,
                        'Detailed Specifications Awaiting Office Head Approval',
                        "Updated Detailed Specifications for PPMP {$idLabel} ({$ppmp->title}) was approved by BAC-TWG ({$user->name}) and awaits your Office Head approval and PNPKI e-signature.",
                        $ppmp->id,
                        'info'
                    );

                    AuditLog::log('PPMP_TWG_APPROVED_ATTACHMENT_LIST', 'ppmps', $ppmp->id, null, ['target' => 'HEAD_PENDING'], $user->id);
                } else {
                    PpmpRoute::create([
                        'ppmp_id' => $ppmp->id,
                        'from_user_id' => $user->id,
                        'to_user_id' => $ppmp->created_by,
                        'from_role' => 'twg',
                        'to_role' => 'end_user',
                        'action' => 'TWG_APPROVED_ATTACHMENT_LIST',
                        'status' => 'READY_TO_PRINT',
                        'remarks' => 'Updated Detailed Specifications evaluated and approved by BAC-TWG. Document is now READY TO PRINT.',
                        'submitted_at' => $now,
                        'acted_at' => $now,
                    ]);

                    SystemNotification::notify(
                        $ppmp->created_by,
                        'PPMP Approved & Ready to Print',
                        "Congratulations! The updated Detailed Specifications for PPMP {$idLabel} ({$ppmp->title}) was approved by BAC-TWG ({$user->name}) and is now READY TO PRINT.",
                        $ppmp->id,
                        'success'
                    );

                    AuditLog::log('PPMP_TWG_APPROVED_ATTACHMENT_LIST', 'ppmps', $ppmp->id, null, ['target' => 'READY_TO_PRINT'], $user->id);
                }
            } else {
                $targetReviewerId = null;
                if ($ppmp->budget_reviewer_id && User::where('id', $ppmp->budget_reviewer_id)->where('is_active', true)->exists()) {
                    $targetReviewerId = $ppmp->budget_reviewer_id;
                    $targetReviewers = User::where('id', $targetReviewerId)->get();
                } else {
                    $targetReviewers = User::withRole($nextRole)->where('is_active', true)->get();
                    $targetReviewerId = $targetReviewers->first()?->id;
                }

                PpmpRoute::create([
                    'ppmp_id' => $ppmp->id,
                    'from_user_id' => $user->id,
                    'to_user_id' => $targetReviewerId,
                    'from_role' => 'twg',
                    'to_role' => $nextRole,
                    'action' => 'TWG_APPROVED',
                    'status' => $nextStatus,
                    'remarks' => 'BAC-TWG technical review approved. Routed to ' . ($isTrust ? 'PACCO' : 'Provincial Budget Office') . ' for budget certification.',
                    'submitted_at' => $now,
                    'acted_at' => $now,
                ]);

                foreach ($targetReviewers as $targetUser) {
                    SystemNotification::notify(
                        $targetUser->id,
                        'PPMP Awaiting Review',
                        "PPMP {$idLabel} ({$ppmp->title}) was approved by BAC-TWG and is now awaiting your review.",
                        $ppmp->id,
                        'info'
                    );
                }

                AuditLog::log('PPMP_TWG_APPROVED', 'ppmps', $ppmp->id, null, ['status' => $nextStatus], $user->id);
            }
        });

        $freshPpmp = $ppmp->fresh(['office.head', 'creator', 'signatures.user', 'routes.fromUser', 'routes.toUser']);
        return response()->json([
            'message' => $freshPpmp->status === 'READY_TO_PRINT'
                ? 'Detailed Specifications approved by BAC-TWG. Document is now READY TO PRINT.'
                : ($freshPpmp->status === 'HEAD_PENDING'
                    ? 'Detailed Specifications approved by BAC-TWG and forwarded to the Office Head for review & PNPKI e-signature.'
                    : ('PPMP approved by BAC-TWG and routed to ' . ($ppmp->isTrustFund() ? 'PACCO' : 'Provincial Budget Office') . ' for budget review.')),
            'ppmp' => $freshPpmp,
        ]);
    }

    public function twgReturn(Request $request, string $uuid): JsonResponse
    {
        return $this->returnReview($request, $uuid);
    }

    public function receive(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();
        $now = now();

        $updated = false;

        if ($ppmp->amendment_status === 'PENDING_APPROVAL' && ($user->isAdmin() || $user->role === 'admin')) {
            $ppmp->update(['admin_received_at' => $now]);
            $updated = true;

            $this->markLatestPendingRouteReceived($ppmp->id, $now);

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $user->id,
                'to_user_id' => $ppmp->created_by,
                'from_role' => 'admin',
                'to_role' => 'end_user',
                'action' => 'ADMIN_RECEIVED_REQUEST',
                'status' => $ppmp->status,
                'remarks' => 'Supplemental/Amendment request formally received by Administrator.',
                'submitted_at' => $now,
                'received_at' => $now,
                'acted_at' => $now,
            ]);
        } elseif ($user->isAdmin()) {
            return response()->json([
                'message' => 'Administrators and Super Administrators only need to receive Supplemental or Amendment requests.',
            ], 422);
        } elseif ($ppmp->status === 'HEAD_PENDING' && ($user->isHead() && $user->office_id === $ppmp->office_id)) {
            $ppmp->update(['head_received_at' => $now]);
            $this->markLatestPendingRouteReceived($ppmp->id, $now);

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $user->id,
                'to_user_id' => $ppmp->created_by,
                'from_role' => 'head',
                'to_role' => 'end_user',
                'action' => 'HEAD_RECEIVED',
                'status' => 'HEAD_PENDING',
                'remarks' => 'PPMP document received and under Office Head review.',
                'submitted_at' => $now,
                'received_at' => $now,
                'acted_at' => $now,
            ]);
            $updated = true;
        } elseif ($ppmp->status === 'BUDGET_OFFICER_REVIEW' && ($user->isBudgetOfficer() || $user->isAdmin())) {
            if ($user->isBudgetOfficer() && $ppmp->budget_reviewer_id && $ppmp->budget_reviewer_id !== $user->id && !$user->isAdmin()) {
                return response()->json(['message' => 'Unauthorized. This PPMP is assigned to a different Budget Officer.'], 403);
            }
            $ppmp->update(['budget_received_at' => $now]);
            $this->markLatestPendingRouteReceived($ppmp->id, $now);

            $targetOppmoId = $ppmp->oppmo_reviewer_id ?: User::withRole('oppmo')->where('is_active', true)->first()?->id;

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $user->id,
                'to_user_id' => $targetOppmoId,
                'from_role' => 'budget_officer',
                'to_role' => 'oppmo',
                'action' => 'BUDGET_RECEIVED',
                'status' => 'BUDGET_OFFICER_REVIEW',
                'remarks' => 'PPMP document received and under Provincial Budget Officer review.',
                'submitted_at' => $now,
                'received_at' => $now,
                'acted_at' => $now,
            ]);
            $updated = true;
        } elseif ($ppmp->status === 'PACCO_REVIEW' && ($user->isPacco() || $user->isAdmin())) {
            if ($user->isPacco() && $ppmp->budget_reviewer_id && $ppmp->budget_reviewer_id !== $user->id && !$user->isAdmin()) {
                return response()->json(['message' => 'Unauthorized. This PPMP is assigned to a different PACCO reviewer.'], 403);
            }
            $ppmp->update(['pacco_received_at' => $now]);
            $this->markLatestPendingRouteReceived($ppmp->id, $now);

            $targetOppmoId = $ppmp->oppmo_reviewer_id ?: User::withRole('oppmo')->where('is_active', true)->first()?->id;

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $user->id,
                'to_user_id' => $targetOppmoId,
                'from_role' => 'pacco',
                'to_role' => 'oppmo',
                'action' => 'PACCO_RECEIVED',
                'status' => 'PACCO_REVIEW',
                'remarks' => 'PPMP document received and under PACCO review.',
                'submitted_at' => $now,
                'received_at' => $now,
                'acted_at' => $now,
            ]);
            $updated = true;
        } elseif ($ppmp->status === 'OPPMO_REVIEW' && ($user->isOppmo() || $user->isAdmin())) {
            if ($user->isOppmo() && $ppmp->oppmo_reviewer_id && $ppmp->oppmo_reviewer_id !== $user->id && !$user->isAdmin()) {
                return response()->json(['message' => 'Unauthorized. This PPMP is assigned to a different OPPMO reviewer.'], 403);
            }
            $ppmp->update(['oppmo_received_at' => $now]);
            $this->markLatestPendingRouteReceived($ppmp->id, $now);

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $user->id,
                'to_user_id' => $ppmp->created_by,
                'from_role' => 'oppmo',
                'to_role' => 'end_user',
                'action' => 'OPPMO_RECEIVED',
                'status' => 'OPPMO_REVIEW',
                'remarks' => 'PPMP document received and under OPPMO review for Annual Procurement Plan (APP) generation.',
                'submitted_at' => $now,
                'received_at' => $now,
                'acted_at' => $now,
            ]);
            $updated = true;
        } elseif (in_array($ppmp->status, ['BUDGET_HEAD_REVIEW', 'PACCO_HEAD_REVIEW', 'OPPMO_HEAD_REVIEW'], true) && ($user->isHead() || $user->isAdmin())) {
            $headStage = ReviewHeadResolver::stageForStatus($ppmp->status);
            $expectedOfficeId = $headStage ? ReviewHeadResolver::resolveOfficeIdForStage($headStage, $ppmp) : null;
            if ($user->isHead() && (!$expectedOfficeId || (int) $user->office_id !== $expectedOfficeId)) {
                return response()->json(['message' => 'Unauthorized. This PPMP is awaiting another Office Head.'], 403);
            }
            $receivedField = "{$headStage}_head_received_at";
            $ppmp->update([$receivedField => $now]);
            $this->markLatestPendingRouteReceived($ppmp->id, $now);

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $user->id,
                'to_user_id' => $ppmp->created_by,
                'from_role' => "{$headStage}_head",
                'to_role' => 'end_user',
                'action' => strtoupper($headStage) . '_HEAD_RECEIVED',
                'status' => $ppmp->status,
                'remarks' => 'PPMP document received and under ' . strtoupper($headStage) . ' Head review.',
                'submitted_at' => $now,
                'received_at' => $now,
                'acted_at' => $now,
            ]);
            $updated = true;
        } elseif (in_array($ppmp->status, ['APP_PREPARER_REVIEW', 'GOVERNOR_REVIEW'], true)) {
            $appStage = ReviewHeadResolver::stageForStatus($ppmp->status);
            $expectedUser = $appStage ? ReviewHeadResolver::resolveAppSignatoryUser($appStage) : null;
            if (!$user->isAdmin() && (!$expectedUser || (int) $user->id !== (int) $expectedUser->id)) {
                return response()->json(['message' => 'Unauthorized. This PPMP is awaiting another signatory.'], 403);
            }
            $receivedField = "{$appStage}_received_at";
            $ppmp->update([$receivedField => $now]);
            $this->markLatestPendingRouteReceived($ppmp->id, $now);

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $user->id,
                'to_user_id' => $ppmp->created_by,
                'from_role' => $appStage,
                'to_role' => 'end_user',
                'action' => strtoupper($appStage) . '_RECEIVED',
                'status' => $ppmp->status,
                'remarks' => 'PPMP/APP document received for signatory review.',
                'submitted_at' => $now,
                'received_at' => $now,
                'acted_at' => $now,
            ]);
            $updated = true;
        } elseif ($ppmp->status === 'TWG_REVIEW' && ($user->isTwg() || $user->isAdmin())) {
            if ($user->isTwg() && $ppmp->twg_reviewer_id && $ppmp->twg_reviewer_id !== $user->id && !$user->isAdmin()) {
                return response()->json(['message' => 'Unauthorized. This PPMP is assigned to a different BAC-TWG reviewer.'], 403);
            }
            $ppmp->update(['twg_received_at' => $now]);
            $this->markLatestPendingRouteReceived($ppmp->id, $now);

            $targetRole = $ppmp->isTrustFund() ? 'pacco' : 'budget_officer';
            $targetUserId = $ppmp->budget_reviewer_id ?: User::withRole($targetRole)->where('is_active', true)->first()?->id;

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $user->id,
                'to_user_id' => $targetUserId,
                'from_role' => 'twg',
                'to_role' => $targetRole,
                'action' => 'TWG_RECEIVED',
                'status' => 'TWG_REVIEW',
                'remarks' => 'PPMP document received and under BAC-TWG technical review.',
                'submitted_at' => $now,
                'received_at' => $now,
                'acted_at' => $now,
            ]);
            $updated = true;
        } elseif (in_array($ppmp->status, [
            'HEAD_APPROVED',
            'READY_TO_PRINT',
            'HEAD_RETURNED',
            'BUDGET_OFFICER_RETURNED',
            'PACCO_RETURNED',
            'OPPMO_RETURNED',
            'TWG_RETURNED'
        ]) && ($ppmp->created_by === $user->id || $user->isAdmin())) {
            $ppmp->update(['enduser_received_at' => $now]);
            $this->markLatestPendingRouteReceived($ppmp->id, $now);

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $user->id,
                'to_user_id' => $user->id,
                'from_role' => 'end_user',
                'to_role' => 'end_user',
                'action' => 'END_USER_RECEIVED',
                'status' => $ppmp->status,
                'remarks' => 'PPMP document acknowledged and received by Implementing Unit.',
                'submitted_at' => $now,
                'received_at' => $now,
                'acted_at' => $now,
            ]);
            $updated = true;
        }

        if (!$updated) {
            return response()->json(['message' => 'No pending receipt action found for your account on this document.'], 400);
        }

        AuditLog::log('PPMP_RECEIVED', 'ppmps', $ppmp->id, null, ['status' => $ppmp->status, 'role' => $user->role], $user->id);

        return response()->json([
            'message' => 'Document received successfully.',
            'ppmp' => $ppmp->fresh(['office.head', 'creator', 'signatures.user', 'routes.fromUser', 'routes.toUser']),
        ]);
    }

    private function markLatestPendingRouteReceived(int $ppmpId, $timestamp = null): void
    {
        $timestamp = $timestamp ?? now();
        $pendingRoute = PpmpRoute::where('ppmp_id', $ppmpId)
            ->whereNull('received_at')
            ->latest('id')
            ->first();

        if ($pendingRoute) {
            $pendingRoute->update(['received_at' => $timestamp]);
        }
    }

    public function requestAmendmentOrSupplemental(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        if ($ppmp->created_by !== $user->id && !$user->isAdmin()) {
            return response()->json(['message' => 'Only the owner of this PPMP can request a Supplemental or Amendment.'], 403);
        }

        if ($ppmp->status !== 'READY_TO_PRINT') {
            return response()->json(['message' => 'Only fully approved PPMPs (Ready to Print) can request Supplemental or Amendment.'], 422);
        }

        if ($ppmp->amendment_status === 'PENDING_APPROVAL') {
            return response()->json(['message' => 'An amendment or supplemental request is already pending administrator approval.'], 422);
        }

        if ($ppmp->children()->exists()) {
            return response()->json(['message' => 'This PPMP already has a newer Supplemental or Amendment revision. Please use the latest revision instead.'], 422);
        }

        $validated = $request->validate([
            'request_scope' => 'nullable|in:PPMP_APP,ATTACHMENT_LIST,ALL',
            'request_type' => 'nullable|in:SUPPLEMENTAL,AMENDMENT,ATTACHMENT_LIST',
            'supplemental_purpose' => 'nullable|in:CONTINUATION,OTHER',
            'supplemental_specify' => 'nullable|string|max:1000',
            'reason' => 'required|string|min:5|max:2000',
            'letter_file' => 'required|file|mimes:pdf|max:5120',
        ]);

        $scope = $validated['request_scope'] ?? 'PPMP_APP';
        $type = $validated['request_type'] ?? ($scope === 'ATTACHMENT_LIST' ? 'ATTACHMENT_LIST' : 'SUPPLEMENTAL');

        $suppPurpose = null;
        $suppSpecify = null;
        if ($type === 'SUPPLEMENTAL') {
            $suppPurpose = $validated['supplemental_purpose'] ?? 'CONTINUATION';
            if ($suppPurpose === 'OTHER') {
                $suppSpecify = trim($validated['supplemental_specify'] ?? '');
                if (empty($suppSpecify)) {
                    return response()->json(['message' => 'Please specify the details/justification for Other supplemental request.'], 422);
                }
            }
        }

        $uploadedFile = $request->file('letter_file');

        $clientExt = strtolower($uploadedFile->getClientOriginalExtension());
        if ($clientExt !== 'pdf') {
            return response()->json(['message' => 'Security Error: Only official PDF files (.pdf) are accepted for the Letter of Request.'], 422);
        }

        $clientName = $uploadedFile->getClientOriginalName();
        if (preg_match('/\.(php|exe|bat|cmd|sh|vbs|js|jar|py|pl|url|lnk)\.pdf$/i', $clientName)) {
            return response()->json(['message' => 'Security Error: Suspicious disguised multi-extension filename detected.'], 422);
        }

        $handle = fopen($uploadedFile->getRealPath(), 'rb');
        $header = fread($handle, 5);
        fclose($handle);
        if ($header !== '%PDF-') {
            return response()->json(['message' => 'Security Error: Invalid file content. The uploaded document does not have a genuine PDF header.'], 422);
        }

        $sampleContent = file_get_contents($uploadedFile->getRealPath(), false, null, 0, 50000);
        if (preg_match('/\/Launch|\/EmbeddedFiles|\/JavaScript|\/JS\s*\(/i', $sampleContent)) {
            return response()->json(['message' => 'Security Error: PDF contains active executable scripts or launch actions, which are restricted for security.'], 422);
        }

        $safeOriginalName = preg_replace('/[^a-zA-Z0-9_\-\. ]/', '_', basename($uploadedFile->getClientOriginalName()));
        if (!str_ends_with(strtolower($safeOriginalName), '.pdf')) {
            $safeOriginalName .= '.pdf';
        }

        $now = now();

        $ppmp = DB::transaction(function () use ($ppmp, $user, $validated, $uploadedFile, $safeOriginalName, $scope, $type, $suppPurpose, $suppSpecify, $now) {

            $internalFilename = (string) Str::uuid() . '.pdf';
            $directory = 'ppmp/' . $ppmp->id;
            $path = $uploadedFile->storeAs($directory, $internalFilename, 'local');

            $attachment = PpmpAttachment::create([
                'uuid' => (string) Str::uuid(),
                'ppmp_id' => $ppmp->id,
                'uploaded_by' => $user->id,
                'original_filename' => $safeOriginalName,
                'stored_filename' => $internalFilename,
                'storage_path' => $path,
                'mime_type' => 'application/pdf',
                'attachment_type' => 'REQUEST_LETTER',
                'file_size' => $uploadedFile->getSize(),
            ]);

            $ppmp->update([
                'amendment_status' => 'PENDING_APPROVAL',
                'amendment_type' => $type,
                'amendment_scope' => $scope,
                'amendment_reason' => $validated['reason'],
                'requested_amendment_type' => $type,
                'requested_amendment_scope' => $scope,
                'requested_amendment_reason' => $validated['reason'],
                'requested_supplemental_purpose' => $suppPurpose,
                'requested_supplemental_specify' => $suppSpecify,
                'supplemental_purpose' => $suppPurpose,
                'supplemental_purpose_specify' => $suppSpecify,
                'amendment_requested_at' => $now,
                'admin_received_at' => null,
            ]);

            $scopeLabel = match ($scope) {
                'PPMP_APP' => 'PPMP / APP Only',
                'ATTACHMENT_LIST' => 'Detailed Specifications Only',
                default => 'PPMP / APP & Detailed Specifications',
            };
            $typeLabel = match ($type) {
                'SUPPLEMENTAL' => 'Supplemental',
                'AMENDMENT' => 'Amendment',
                default => 'Detailed Specifications Update',
            };

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $user->id,
                'to_user_id' => null,
                'from_role' => 'end_user',
                'to_role' => 'admin',
                'action' => 'REQUESTED_' . $type,
                'status' => $ppmp->status,
                'remarks' => "Requested {$typeLabel} [Scope: {$scopeLabel}]: {$validated['reason']}\nAttached Letter: {$attachment->original_filename}",
                'submitted_at' => $now,
            ]);

            $admins = User::withAnyRole(['admin', 'super_admin'])->where('is_active', true)->get();
            $idLabel = $this->getPpmpIdentifier($ppmp);
            foreach ($admins as $admin) {
                SystemNotification::notify(
                    $admin->id,
                    "New {$typeLabel} Request",
                    "Office '{$ppmp->office?->name}' requested a {$typeLabel} ({$scopeLabel}) for PPMP {$idLabel}.",
                    $ppmp->id,
                    'info'
                );
            }

            AuditLog::log('PPMP_AMENDMENT_REQUESTED', 'ppmps', $ppmp->id, null, [
                'type' => $type,
                'scope' => $scope,
                'reason' => $validated['reason'],
                'attachment_id' => $attachment->id,
            ], $user->id);

            return $ppmp;
        });

        return response()->json([
            'message' => 'Request submitted successfully and is awaiting Administrator approval.',
            'ppmp' => $ppmp->fresh(['office.head', 'creator', 'signatures.user', 'routes.fromUser', 'routes.toUser', 'attachments']),
        ]);
    }

    public function approveAmendmentRequest(Request $request, string $uuid): JsonResponse
    {
        $admin = $request->user();
        if (!$admin->isAdmin()) {
            return response()->json(['message' => 'Only Administrators can approve amendment requests.'], 403);
        }

        $ppmp = Ppmp::with(['items', 'signatures', 'attachments'])->where('uuid', $uuid)->firstOrFail();

        if ($ppmp->amendment_status !== 'PENDING_APPROVAL') {
            return response()->json(['message' => 'This PPMP does not have a pending amendment/supplemental request.'], 422);
        }

        $type = $ppmp->requested_amendment_type ?: $ppmp->amendment_type ?: 'SUPPLEMENTAL';
        $scope = $ppmp->requested_amendment_scope ?: $ppmp->amendment_scope ?: 'ALL';
        $reason = $ppmp->requested_amendment_reason ?: $ppmp->amendment_reason;
        $suppPurpose = $ppmp->requested_supplemental_purpose ?: $ppmp->supplemental_purpose ?: 'CONTINUATION';
        $suppSpecify = $ppmp->requested_supplemental_specify ?: $ppmp->supplemental_purpose_specify;
        $isContinuation = ($type === 'SUPPLEMENTAL' && $suppPurpose === 'CONTINUATION');

        $rootAnnual = $ppmp->getRootAnnualPpmp();
        $baselineAnnualBudget = (float) ($rootAnnual->total_budget ?: $rootAnnual->items()->sum('estimated_budget'));
        $childFiscalYear = $isContinuation ? (string) date('Y') : $ppmp->fiscal_year;

        $now = now();

        if ($scope === 'ATTACHMENT_LIST') {
            $updatedPpmp = DB::transaction(function () use ($ppmp, $admin, $type, $scope, $reason, $now) {

                PpmpSignature::where('ppmp_id', $ppmp->id)->whereIn('role', ['twg', 'head'])->delete();

                if (!empty($ppmp->attachment_list_data) && is_array($ppmp->attachment_list_data)) {
                    $attData = $ppmp->attachment_list_data;
                    unset($attData['approved_by_name'], $attData['approved_by_position']);
                    $ppmp->attachment_list_data = $attData;
                }

                $ppmp->update([
                    'status' => 'DRAFT',
                    'amendment_status' => 'APPROVED',
                    'amendment_type' => $type,
                    'amendment_scope' => 'ATTACHMENT_LIST',
                    'amendment_reason' => $reason,
                    'amendment_approved_at' => $now,
                    'twg_approved_at' => null,
                    'twg_received_at' => null,
                    'head_approved_at' => null,
                    'head_received_at' => null,
                    'head_submitted_at' => null,
                    'ready_to_print_at' => null,
                    'enduser_received_at' => null,
                    'attachment_list_data' => $ppmp->attachment_list_data,
                ]);

                $this->markLatestPendingRouteReceived($ppmp->id, $ppmp->admin_received_at ?? $now);

                PpmpRoute::create([
                    'ppmp_id' => $ppmp->id,
                    'from_user_id' => $admin->id,
                    'to_user_id' => $ppmp->created_by,
                    'from_role' => 'admin',
                    'to_role' => 'end_user',
                    'action' => 'ADMIN_APPROVED_' . $type,
                    'status' => 'DRAFT',
                    'remarks' => "{$type} (Detailed Specifications Only) approved by Administrator. Reopened in DRAFT for editing Detailed Specifications.",
                    'submitted_at' => $now,
                    'acted_at' => $now,
                ]);

                $idLabel = $this->getPpmpIdentifier($ppmp);
                SystemNotification::notify(
                    $ppmp->created_by,
                    "{$type} Request Approved",
                    "Your {$type} request (Detailed Specifications Only) for PPMP {$idLabel} was approved! You can now update the Detailed Specifications and submit for BAC-TWG review.",
                    $ppmp->id,
                    'success'
                );

                AuditLog::log('PPMP_AMENDMENT_APPROVED', 'ppmps', $ppmp->id, null, [
                    'ppmp_id' => $ppmp->id,
                    'scope' => 'ATTACHMENT_LIST',
                    'type' => $type,
                ], $admin->id);

                return $ppmp;
            });

            return response()->json([
                'message' => "{$type} request approved. Detailed Specifications reopened in DRAFT for editing.",
                'ppmp' => $updatedPpmp->fresh(['office.head', 'creator', 'signatures.user', 'routes.fromUser', 'routes.toUser', 'parent']),
            ]);
        }

        $newPpmp = DB::transaction(function () use ($ppmp, $admin, $type, $scope, $reason, $now, $childFiscalYear, $isContinuation, $baselineAnnualBudget, $suppPurpose, $suppSpecify) {

            $ppmp->update([
                'amendment_status' => 'APPROVED',
                'amendment_approved_at' => $now,
                'is_annual' => empty($ppmp->parent_id),
            ]);

            $ppmpNumber = $ppmp->ppmp_number;

            $trackingNumber = $ppmp->tracking_number;

            $childPpmp = Ppmp::create([
                'uuid' => (string) Str::uuid(),
                'parent_id' => $ppmp->id,
                'tracking_number' => $trackingNumber,
                'ppmp_number' => $ppmpNumber,
                'office_id' => $ppmp->office_id,
                'implementing_unit' => $ppmp->implementing_unit,
                'program_name' => $ppmp->program_name,
                'program_name_id' => $ppmp->program_name_id,
                'created_by' => $ppmp->created_by,
                'title' => $ppmp->title,
                'account_code' => $ppmp->account_code,
                'account_code_id' => $ppmp->account_code_id,
                'fiscal_year' => $childFiscalYear,
                'plan_type' => $ppmp->plan_type,
                'source_of_fund' => $ppmp->source_of_fund,
                'fund_source_id' => $ppmp->fund_source_id,
                'is_annual' => false,
                'is_continuation' => $isContinuation,
                'baseline_annual_budget' => $isContinuation ? $baselineAnnualBudget : null,
                'delivery_period' => $isContinuation ? null : $ppmp->delivery_period,
                'place_of_delivery' => $ppmp->place_of_delivery,
                'payment_method' => $ppmp->payment_method,
                'warranty_and_other_terms' => $ppmp->warranty_and_other_terms,
                'attachment_list_data' => $isContinuation ? null : $ppmp->attachment_list_data,
                'app_data' => [
                    'needs_regeneration' => true,
                    'is_generated' => false,
                    'old_app' => $ppmp->app_data,
                ],
                'total_budget' => $isContinuation ? 0.00 : $ppmp->total_budget,
                'status' => 'DRAFT',
                'amendment_status' => null,
                'amendment_type' => $type,
                'amendment_scope' => $scope,
                'amendment_reason' => $reason,
                'supplemental_purpose' => $type === 'SUPPLEMENTAL' ? $suppPurpose : null,
                'supplemental_purpose_specify' => ($type === 'SUPPLEMENTAL' && $suppPurpose === 'OTHER') ? $suppSpecify : null,
                'prepared_at' => $now,
            ]);

            $createdChildItems = [];
            foreach ($ppmp->items as $item) {
                $childItem = PpmpItem::create([
                    'ppmp_id' => $childPpmp->id,
                    'item_no' => $item->item_no,
                    'description' => $item->description,
                    'is_retention' => (bool) ($item->is_retention ?? false),
                    'retention_percentage' => $item->retention_percentage,
                    'project_type' => $item->project_type,
                    'quantity_size' => $item->quantity_size,
                    'procurement_mode' => $item->procurement_mode,
                    'pre_proc_conference' => $item->pre_proc_conference,
                    'start_date' => $isContinuation ? null : $item->start_date,
                    'end_date' => $isContinuation ? null : $item->end_date,
                    'delivery_period' => $isContinuation ? null : $item->delivery_period,
                    'source_of_fund' => $item->source_of_fund,
                    'fund_source_id' => $item->fund_source_id,
                    'estimated_budget' => $isContinuation ? null : $item->estimated_budget,
                    'supporting_docs_text' => $item->supporting_docs_text,
                    'remarks' => $item->remarks,
                ]);
                $createdChildItems[$item->id] = $childItem->id;
            }

            if (!$isContinuation && !empty($childPpmp->attachment_list_data) && is_array($childPpmp->attachment_list_data)) {
                $attData = $childPpmp->attachment_list_data;
                if (!empty($attData['attachment_lists']) && is_array($attData['attachment_lists'])) {
                    $remappedLists = [];
                    foreach ($attData['attachment_lists'] as $oldKey => $list) {
                        $newKey = (is_numeric($oldKey) && isset($createdChildItems[(int) $oldKey]))
                            ? (string) $createdChildItems[(int) $oldKey]
                            : (string) $oldKey;
                        if (is_array($list)) {
                            $list['itemId'] = is_numeric($newKey) ? (int) $newKey : ($list['itemId'] ?? null);
                        }
                        $remappedLists[$newKey] = $list;
                    }
                    $attData['attachment_lists'] = $remappedLists;
                }
                if (!empty($attData['active_item_id']) && isset($createdChildItems[(int) $attData['active_item_id']])) {
                    $attData['active_item_id'] = $createdChildItems[(int) $attData['active_item_id']];
                }
                $childPpmp->update(['attachment_list_data' => $attData]);
                $childPpmp->syncAttachmentLists($attData);
            }

            foreach ($ppmp->attachments as $att) {
                if ($isContinuation && (
                    in_array($att->attachment_type, ['MARKET_SCOPING', 'ATTACHMENT_LIST_DOC'], true) ||
                    str_contains(strtolower((string) ($att->original_filename ?? '')), 'market') ||
                    str_contains(strtolower((string) ($att->original_filename ?? '')), 'scoping')
                )) {
                    continue;
                }
                if (Storage::disk('local')->exists($att->storage_path)) {
                    $newExt = pathinfo($att->stored_filename, PATHINFO_EXTENSION);
                    $newFilename = (string) Str::uuid() . '.' . $newExt;
                    $newDirectory = 'ppmp/' . $childPpmp->id;
                    $newPath = $newDirectory . '/' . $newFilename;

                    Storage::disk('local')->copy($att->storage_path, $newPath);

                    PpmpAttachment::create([
                        'uuid' => (string) Str::uuid(),
                        'ppmp_id' => $childPpmp->id,
                        'uploaded_by' => $att->uploaded_by,
                        'original_filename' => $att->original_filename,
                        'stored_filename' => $newFilename,
                        'storage_path' => $newPath,
                        'mime_type' => $att->mime_type,
                        'attachment_type' => $att->attachment_type,
                        'file_size' => $att->file_size,
                    ]);
                }
            }

            foreach ($ppmp->signatures as $sig) {
                if ($sig->role === 'end_user') {
                    $newSig = $sig->replicate();
                    $newSig->ppmp_id = $childPpmp->id;
                    $newSig->save();
                }
            }

            $scopeLabel = match ($scope) {
                'PPMP_APP' => 'PPMP/APP Only',
                'ATTACHMENT_LIST' => 'Detailed Specifications Only',
                default => 'PPMP/APP & Detailed Specifications',
            };

            $this->markLatestPendingRouteReceived($ppmp->id, $ppmp->admin_received_at ?? $now);

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $admin->id,
                'to_user_id' => $ppmp->created_by,
                'from_role' => 'admin',
                'to_role' => 'end_user',
                'action' => 'ADMIN_APPROVED_' . $type,
                'status' => $ppmp->status,
                'remarks' => "{$type} ({$scopeLabel}) approved by Administrator. Created revision in DRAFT.",
                'submitted_at' => $now,
                'acted_at' => $now,
            ]);

            PpmpRoute::create([
                'ppmp_id' => $childPpmp->id,
                'from_user_id' => $admin->id,
                'to_user_id' => $ppmp->created_by,
                'from_role' => 'admin',
                'to_role' => 'end_user',
                'action' => 'DRAFT_CREATED',
                'status' => 'DRAFT',
                'remarks' => "Created from approved {$type} request [Scope: {$scopeLabel}] (Previous Baseline: PPMP No. {$ppmp->ppmp_number}).",
                'submitted_at' => $now,
                'received_at' => $now,
                'acted_at' => $now,
            ]);

            $idLabel = $this->getPpmpIdentifier($ppmp);
            SystemNotification::notify(
                $ppmp->created_by,
                "{$type} Request Approved",
                "Your {$type} request ({$scopeLabel}) for PPMP {$idLabel} was approved! A revision has been reopened in DRAFT for you to edit.",
                $childPpmp->id,
                'success'
            );

            AuditLog::log('PPMP_AMENDMENT_APPROVED', 'ppmps', $ppmp->id, null, [
                'parent_id' => $ppmp->id,
                'new_ppmp_id' => $childPpmp->id,
                'type' => $type,
            ], $admin->id);

            return $childPpmp;
        });

        return response()->json([
            'message' => "{$type} request approved. New PPMP No. {$newPpmp->ppmp_number} initialized in DRAFT.",
            'ppmp' => $newPpmp->fresh(['office.head', 'creator', 'signatures.user', 'routes.fromUser', 'routes.toUser', 'parent']),
        ]);
    }

    public function rejectAmendmentRequest(Request $request, string $uuid): JsonResponse
    {
        $admin = $request->user();
        if (!$admin->isAdmin()) {
            return response()->json(['message' => 'Only Administrators can disapprove amendment requests.'], 403);
        }

        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        if ($ppmp->amendment_status !== 'PENDING_APPROVAL') {
            return response()->json(['message' => 'This PPMP does not have a pending amendment/supplemental request.'], 422);
        }

        $validated = $request->validate([
            'remarks' => 'required|string|min:3',
        ]);

        $now = now();
        $type = $ppmp->requested_amendment_type ?: $ppmp->amendment_type ?: 'Request';

        DB::transaction(function () use ($ppmp, $admin, $validated, $now, $type) {
            $this->markLatestPendingRouteReceived($ppmp->id, $ppmp->admin_received_at ?? $now);

            $ppmp->update([
                'amendment_status' => 'REJECTED',
            ]);

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $admin->id,
                'to_user_id' => $ppmp->created_by,
                'from_role' => 'admin',
                'to_role' => 'end_user',
                'action' => 'ADMIN_REJECTED_' . strtoupper($type),
                'status' => $ppmp->status,
                'remarks' => "Disapproved by Administrator: {$validated['remarks']}",
                'submitted_at' => $now,
                'acted_at' => $now,
            ]);

            $idLabel = $this->getPpmpIdentifier($ppmp);
            SystemNotification::notify(
                $ppmp->created_by,
                "{$type} Request Disapproved",
                "Your {$type} request for PPMP {$idLabel} was disapproved by Administrator: {$validated['remarks']}",
                $ppmp->id,
                'warning'
            );

            AuditLog::log('PPMP_AMENDMENT_REJECTED', 'ppmps', $ppmp->id, null, [
                'remarks' => $validated['remarks'],
            ], $admin->id);
        });

        return response()->json([
            'message' => 'Request disapproved.',
            'ppmp' => $ppmp->fresh(['office.head', 'creator', 'signatures.user', 'routes.fromUser', 'routes.toUser']),
        ]);
    }

    public function adminUpdateStatus(Request $request, string $uuid): JsonResponse
    {
        $admin = $request->user();
        if (!$admin || !$admin->isAdmin()) {
            return response()->json(['message' => 'Only Administrators and Super Administrators can edit the PPMP status.'], 403);
        }

        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        $allowedStatuses = [
            'DRAFT',
            'HEAD_PENDING',
            'HEAD_RETURNED',
            'HEAD_APPROVED',
            'TWG_REVIEW',
            'TWG_RETURNED',
            'BUDGET_OFFICER_REVIEW',
            'BUDGET_OFFICER_RETURNED',
            'BUDGET_HEAD_REVIEW',
            'BUDGET_HEAD_RETURNED',
            'PACCO_REVIEW',
            'PACCO_RETURNED',
            'PACCO_HEAD_REVIEW',
            'PACCO_HEAD_RETURNED',
            'PACCO_APPROVED',
            'OPPMO_REVIEW',
            'OPPMO_RETURNED',
            'OPPMO_HEAD_REVIEW',
            'OPPMO_HEAD_RETURNED',
            'APP_PREPARER_REVIEW',
            'APP_PREPARER_RETURNED',
            'GOVERNOR_REVIEW',
            'GOVERNOR_RETURNED',
            'READY_TO_PRINT',
        ];

        $validated = $request->validate([
            'status' => ['required', 'string', 'in:' . implode(',', $allowedStatuses)],
            'remarks' => ['nullable', 'string', 'max:1000'],
        ]);

        $newStatus = $validated['status'];
        $oldStatus = $ppmp->status;
        $remarks = trim((string) ($validated['remarks'] ?? ''));

        if ($newStatus === $oldStatus) {
            return response()->json([
                'message' => "PPMP status is already set to {$newStatus}.",
                'ppmp' => $ppmp->fresh(['office.head', 'creator', 'signatures.user', 'routes.fromUser', 'routes.toUser']),
            ]);
        }

        $now = now();

        DB::transaction(function () use ($ppmp, $admin, $oldStatus, $newStatus, $remarks, $now) {
            $updates = ['status' => $newStatus];

            switch ($newStatus) {
                case 'DRAFT':
                    $updates['enduser_received_at'] = $now;
                    break;
                case 'HEAD_PENDING':
                    $updates['head_submitted_at'] = $ppmp->head_submitted_at ?? $now;
                    $updates['head_received_at'] = null;
                    break;
                case 'TWG_REVIEW':
                    $updates['review_submitted_at'] = $ppmp->review_submitted_at ?? $now;
                    $updates['twg_received_at'] = null;
                    break;
                case 'BUDGET_OFFICER_REVIEW':
                    $updates['review_submitted_at'] = $ppmp->review_submitted_at ?? $now;
                    $updates['budget_received_at'] = null;
                    break;
                case 'BUDGET_HEAD_REVIEW':
                    $updates['budget_head_received_at'] = null;
                    break;
                case 'PACCO_REVIEW':
                    $updates['review_submitted_at'] = $ppmp->review_submitted_at ?? $now;
                    $updates['pacco_received_at'] = null;
                    break;
                case 'PACCO_HEAD_REVIEW':
                    $updates['pacco_head_received_at'] = null;
                    break;
                case 'OPPMO_REVIEW':
                    $updates['review_submitted_at'] = $ppmp->review_submitted_at ?? $now;
                    $updates['oppmo_received_at'] = null;
                    break;
                case 'OPPMO_HEAD_REVIEW':
                    $updates['oppmo_head_received_at'] = null;
                    break;
                case 'APP_PREPARER_REVIEW':
                    $updates['app_preparer_received_at'] = null;
                    break;
                case 'GOVERNOR_REVIEW':
                    $updates['governor_received_at'] = null;
                    break;
                case 'READY_TO_PRINT':
                    $updates['ready_to_print_at'] = $ppmp->ready_to_print_at ?? $now;
                    $updates['enduser_received_at'] = null;
                    break;
                default:
                    if (str_ends_with($newStatus, '_RETURNED') || $newStatus === 'HEAD_APPROVED') {
                        $updates['enduser_received_at'] = null;
                    }
                    break;
            }

            $ppmp->update($updates);

            $routeRemark = "Status manually updated by {$admin->name} (" . strtoupper(str_replace('_', ' ', $admin->role)) . ") from {$oldStatus} to {$newStatus}."
                . ($remarks !== '' ? " Reason/Remarks: {$remarks}" : '');

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $admin->id,
                'to_user_id' => $ppmp->created_by,
                'from_role' => $admin->role,
                'to_role' => 'end_user',
                'action' => 'ADMIN_STATUS_OVERRIDE',
                'status' => $newStatus,
                'remarks' => $routeRemark,
                'submitted_at' => $now,
                'received_at' => $now,
                'acted_at' => $now,
            ]);

            if ($remarks !== '' && str_ends_with($newStatus, '_RETURNED')) {
                PpmpReview::create([
                    'ppmp_id' => $ppmp->id,
                    'reviewer_id' => $admin->id,
                    'reviewer_role' => $admin->role,
                    'action' => 'return',
                    'status_before' => $oldStatus,
                    'status_after' => $newStatus,
                    'remarks' => $remarks,
                    'acted_at' => $now,
                ]);
            }

            PpmpChangeLog::create([
                'ppmp_id' => $ppmp->id,
                'user_id' => $admin->id,
                'role' => $admin->role,
                'field_name' => 'Status',
                'old_value' => $oldStatus,
                'new_value' => $newStatus,
                'action' => $remarks !== '' ? "Admin status update: {$remarks}" : 'Admin status update',
            ]);

            $idLabel = $this->getPpmpIdentifier($ppmp);
            if ($ppmp->created_by && (int) $ppmp->created_by !== (int) $admin->id) {
                SystemNotification::notify(
                    $ppmp->created_by,
                    'PPMP Status Updated by Administrator',
                    "The status of PPMP {$idLabel} ({$ppmp->title}) was updated from {$oldStatus} to {$newStatus} by {$admin->name}."
                        . ($remarks !== '' ? " Remarks: {$remarks}" : ''),
                    $ppmp->id,
                    'info'
                );
            }

            AuditLog::log(
                'PPMP_STATUS_UPDATED_BY_ADMIN',
                'ppmps',
                $ppmp->id,
                ['status' => $oldStatus],
                ['status' => $newStatus, 'remarks' => $remarks],
                $admin->id
            );
        });

        return response()->json([
            'message' => "PPMP status updated from {$oldStatus} to {$newStatus} successfully.",
            'ppmp' => $ppmp->fresh([
                'office.head',
                'creator.office.head',
                'items.fundSource',
                'fundSourceRef',
                'attachments.uploader',
                'reviews.reviewer',
                'signatures.user',
                'routes.fromUser',
                'routes.toUser',
                'changeLogs.user',
                'monitoringProjects',
                'cellComments.reviewer',
                'cellComments.compliedByUser',
                'accountCodeRef',
                'programNameRef',
                'twgReviewer',
                'budgetReviewer',
                'oppmoReviewer',
            ]),
        ]);
    }

    private function applyFieldModifications(Ppmp $ppmp, array $fieldChanges, User $user, string $role): void
    {
        if (empty($fieldChanges)) {
            return;
        }

        foreach ($fieldChanges as $change) {
            $itemId = $change['item_id'] ?? null;
            $fieldName = $change['field_name'] ?? '';
            $oldVal = $change['old_value'] ?? '';
            $newVal = $change['new_value'] ?? '';

            $item = null;
            if ($itemId) {
                $item = PpmpItem::where('ppmp_id', $ppmp->id)->where('id', $itemId)->first();
            }

            if ($item && in_array($fieldName, ['estimated_budget', 'description', 'procurement_mode', 'quantity_size'])) {
                $item->update([$fieldName => $newVal]);

                if ($fieldName === 'estimated_budget') {
                    $ppmp->update([
                        'total_budget' => $ppmp->items()->sum('estimated_budget'),
                    ]);
                }
            }

            PpmpChangeLog::create([
                'ppmp_id' => $ppmp->id,
                'user_id' => $user->id,
                'role' => $role,
                'field_name' => $fieldName,
                'old_value' => (string) $oldVal,
                'new_value' => (string) $newVal,
                'action' => $item ? "Item #{$item->item_no} field correction" : 'field_correction',
            ]);
        }

        $isAmendedOrSupplemental = !empty($ppmp->parent_id) || in_array($ppmp->amendment_type, ['AMENDMENT', 'SUPPLEMENTAL'], true);
        if ($isAmendedOrSupplemental) {
            $existingApp = $ppmp->app_data;
            $oldApp = $existingApp['old_app'] ?? ((!empty($existingApp['rows']) && is_array($existingApp['rows'])) ? $existingApp : null) ?? $ppmp->parent?->app_data;
            $ppmp->update([
                'app_data' => [
                    'needs_regeneration' => true,
                    'is_generated' => false,
                    'old_app' => $oldApp,
                    'invalidated_at' => now()->toIso8601String(),
                    'invalidated_by' => $user->name,
                    'invalidated_by_role' => $role,
                ],
            ]);
        }
    }

    protected function validateContinuationRequirements(Ppmp $ppmp): ?JsonResponse
    {
        if (!$ppmp->is_continuation) {
            return null;
        }

        $rootAnnual = $ppmp->getRootAnnualPpmp();
        $annualCeiling = (float) ($ppmp->baseline_annual_budget ?? ($rootAnnual ? ($rootAnnual->total_budget ?: $rootAnnual->items()->sum('estimated_budget')) : 0));
        $currentTotalBudget = (float) ($ppmp->total_budget ?: $ppmp->items()->sum('estimated_budget'));

        if ($annualCeiling > 0 && $currentTotalBudget > ($annualCeiling + 0.01)) {
            return response()->json([
                'message' => "Cannot submit for review. The estimated budget of ₱" . number_format($currentTotalBudget, 2) . " exceeds the baseline annual PPMP budgetary allocation of ₱" . number_format($annualCeiling, 2) . ".",
            ], 422);
        }

        $items = $ppmp->items;
        if ($items->isEmpty()) {
            return response()->json([
                'message' => 'Cannot submit for review. Supplemental continuation PPMP must have at least one procurement item.',
            ], 422);
        }

        $emptyCells = [];
        foreach ($items as $idx => $it) {
            $rowNo = $it->item_no ?: ($idx + 1);
            if (empty(trim((string) $it->start_date))) {
                $emptyCells[] = "Item #{$rowNo}: Start of Procurement Activity";
            }
            if (empty(trim((string) $it->end_date))) {
                $emptyCells[] = "Item #{$rowNo}: End of Procurement Activity";
            }
            if (empty(trim((string) $it->delivery_period))) {
                $emptyCells[] = "Item #{$rowNo}: Expected Delivery / Implementation Period";
            }
            if ($it->estimated_budget === null || (float) $it->estimated_budget <= 0) {
                $emptyCells[] = "Item #{$rowNo}: Estimated Budget / Budgetary Allocation";
            }
            if (empty(trim((string) $it->description))) {
                $emptyCells[] = "Item #{$rowNo}: Item Description";
            }
            if (empty(trim((string) $it->procurement_mode))) {
                $emptyCells[] = "Item #{$rowNo}: Procurement Mode";
            }
        }

        if (!empty($emptyCells)) {
            return response()->json([
                'message' => "Cannot submit for review. For supplemental continuation, all item cells must be completely filled out before submitting to reviewers: " . implode('; ', $emptyCells) . ".",
                'unfilled_cells' => $emptyCells,
            ], 422);
        }

        return null;
    }

    protected function getTargetHeadUsers(int $officeId)
    {
        $office = Office::find($officeId);
        if (!$office) {
            return collect();
        }

        $heads = User::where('office_id', $officeId)
            ->withRole('head')
            ->where('is_active', true)
            ->get();

        if ($office->head_user_id) {
            $userById = User::find($office->head_user_id);
            if ($userById && $userById->is_active && !$heads->contains('id', $userById->id)) {
                $heads->push($userById);
            }
        }

        if ($heads->isEmpty() && !empty($office->head_name)) {
            $userByName = User::where('name', $office->head_name)
                ->where('is_active', true)
                ->first();
            if ($userByName) {
                $heads->push($userByName);
                $office->updateQuietly(['head_user_id' => $userByName->id]);
            }
        }

        if (!$office->head_user_id && $heads->isNotEmpty()) {
            $office->updateQuietly(['head_user_id' => $heads->first()->id]);
        }

        return $heads;
    }

    private function getPpmpIdentifier(Ppmp $ppmp): string
    {
        return $ppmp->tracking_number ?: "PPMP No. {$ppmp->ppmp_number}";
    }
}
