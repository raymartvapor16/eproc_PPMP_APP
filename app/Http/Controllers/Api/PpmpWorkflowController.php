<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
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
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class PpmpWorkflowController extends Controller
{
    /**
     * 1. Submit PPMP to Office Head for endorsement (End User only)
     * DRAFT / HEAD_RETURNED -> HEAD_PENDING
     */
    public function submitToHead(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        if ($ppmp->created_by !== $user->id && !$user->isAdmin()) {
            return response()->json(['message' => 'Only the creator of this PPMP can submit it to the Office Head.'], 403);
        }

        if ($ppmp->status === 'DRAFT') {
            return $this->submitForReview($request, $uuid);
        }

        if (!in_array($ppmp->status, ['DRAFT', 'HEAD_RETURNED'])) {
            return response()->json(['message' => "Cannot submit to Head in current status: {$ppmp->status}."], 422);
        }

        DB::transaction(function () use ($ppmp, $user) {
            $targetHeadUsers = $this->getTargetHeadUsers($ppmp->office_id);
            $primaryHeadId = $targetHeadUsers->first()?->id;

            $ppmp->update([
                'status' => 'HEAD_PENDING',
                'head_submitted_at' => now(),
                'head_received_at' => null, // requires Head to click Receive
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

            // Also notify any active Authorized Staff of this office
            $authStaffUserIds = User::where('office_id', $ppmp->office_id)
                ->where('role', 'authorized_staff')
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

    /**
     * 2a. Head Approves PPMP
     * HEAD_PENDING -> READY_TO_PRINT
     */
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
                'enduser_received_at' => null, // Creator receives notification and document
            ]);

            // Mark the incoming submission route as received
            $this->markLatestPendingRouteReceived($ppmp->id, $receivedAt);

            // Create Head Electronic Signature Indicator
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

            // Log Review
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

            // Route back to End User
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

    /**
     * 2b. Head Returns PPMP with corrections
     * HEAD_PENDING -> HEAD_RETURNED
     */
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

            // Mark the incoming route as received
            $this->markLatestPendingRouteReceived($ppmp->id, $receivedAt);

            // Save any field modifications
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

    /**
     * 3. Submit PPMP for formal government review
     * HEAD_APPROVED / RETURNED -> BUDGET_OFFICER_REVIEW (or appropriate reviewer)
     */
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
            'PACCO_RETURNED',
            'OPPMO_RETURNED',
            'TWG_RETURNED',
            'HEAD_APPROVED',
        ];

        if (!in_array($ppmp->status, $allowedStatuses)) {
            return response()->json(['message' => "PPMP cannot be submitted for review from status {$ppmp->status}."], 422);
        }

        // Before submitting for review: PPMP List of Attachment and Market Scoping PDF must be generated and attached
        // Note: Annual Procurement Plan (APP) is generated exclusively by OPPMO after BAC-TWG technical review
        $missingRequirements = [];

        if (!$ppmp->hasAttachmentListGenerated()) {
            $missingRequirements[] = 'PPMP List of Attachment must be generated';
        }

        if (!$ppmp->hasMarketScopingPdf()) {
            $missingRequirements[] = 'Market Scoping PDF document must be uploaded and attached';
        }

        if (!empty($missingRequirements)) {
            return response()->json([
                'message' => 'Cannot submit for review. The following requirements must be completed first: ' . implode('; ', $missingRequirements) . '.',
                'missing_requirements' => $missingRequirements,
                'checks' => $ppmp->pre_submission_checks,
            ], 422);
        }

        // Determine destination:
        // If scope is ATTACHMENT_LIST only, TWG is the only reviewer (Budget Officer and OPPMO are skipped).
        $isAttachmentOnly = $ppmp->amendment_scope === 'ATTACHMENT_LIST';

        if ($isAttachmentOnly) {
            $nextStatus = 'TWG_REVIEW';
            $nextRole = 'twg';
        } else {
            $isTrust = $ppmp->isTrustFund();

            // Determine destination: if returned by a reviewer, route back directly;
            // Otherwise if from DRAFT/initial: Trust Fund routes to PACCO, General Fund routes to Budget Officer.
            $nextStatus = match ($ppmp->status) {
                'PACCO_RETURNED' => 'PACCO_REVIEW',
                'OPPMO_RETURNED' => 'OPPMO_REVIEW',
                'TWG_RETURNED' => 'TWG_REVIEW',
                'BUDGET_OFFICER_RETURNED' => 'BUDGET_OFFICER_REVIEW',
                'HEAD_RETURNED' => 'HEAD_PENDING',
                default => $isTrust ? 'PACCO_REVIEW' : 'BUDGET_OFFICER_REVIEW',
            };

            $nextRole = match ($nextStatus) {
                'PACCO_REVIEW' => 'pacco',
                'OPPMO_REVIEW' => 'oppmo',
                'TWG_REVIEW' => 'twg',
                'HEAD_PENDING' => 'head',
                default => 'budget_officer',
            };
        }

        DB::transaction(function () use ($ppmp, $user, $nextStatus, $nextRole) {
            $now = now();
            $receivedAt = $ppmp->enduser_received_at ?? $now;

            // Mark the returned / head approved route to end_user as received
            $this->markLatestPendingRouteReceived($ppmp->id, $receivedAt);

            $updateData = [
                'status' => $nextStatus,
                'review_submitted_at' => $now,
            ];

            if ($nextStatus === 'BUDGET_OFFICER_REVIEW') {
                $updateData['budget_received_at'] = null;
            } elseif ($nextStatus === 'PACCO_REVIEW') {
                $updateData['pacco_received_at'] = null;
            } elseif ($nextStatus === 'OPPMO_REVIEW') {
                $updateData['oppmo_received_at'] = null;
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
                    ->where('role', 'authorized_staff')
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
                $targetReviewers = User::where('role', $nextRole)->where('is_active', true)->get();

                PpmpRoute::create([
                    'ppmp_id' => $ppmp->id,
                    'from_user_id' => $user->id,
                    'to_user_id' => $targetReviewers->first()?->id,
                    'from_role' => 'end_user',
                    'to_role' => $nextRole,
                    'action' => 'SUBMITTED_FOR_REVIEW',
                    'status' => $nextStatus,
                    'remarks' => "Submitted for review to {$nextRole}.",
                    'submitted_at' => $now,
                ]);

                foreach ($targetReviewers as $rev) {
                    SystemNotification::notify(
                        $rev->id,
                        'PPMP Submitted for Review',
                        "PPMP {$idLabel} ({$ppmp->title}) is ready for your review.",
                        $ppmp->id,
                        'info'
                    );
                }
            }

            AuditLog::log('PPMP_SUBMITTED_FOR_REVIEW', 'ppmps', $ppmp->id, null, ['target' => $nextStatus], $user->id);
        });

        return response()->json([
            'message' => 'PPMP submitted for formal review successfully.',
            'ppmp' => $ppmp->fresh(['office.head', 'creator', 'signatures.user', 'routes.fromUser', 'routes.toUser']),
        ]);
    }

    /**
     * 4a. Budget Officer Approves
     * BUDGET_OFFICER_REVIEW -> OPPMO_REVIEW
     */
    public function budgetApprove(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        if (!$user->isBudgetOfficer() && !$user->isAdmin()) {
            return response()->json(['message' => 'Only the Provincial Budget Officer or Admin can certify budget.'], 403);
        }

        if ($ppmp->status !== 'BUDGET_OFFICER_REVIEW') {
            return response()->json(['message' => "PPMP is not awaiting budget officer review."], 422);
        }

        DB::transaction(function () use ($ppmp, $user) {
            $now = now();
            $receivedAt = $ppmp->budget_received_at ?? $now;

            $ppmp->update([
                'status' => 'OPPMO_REVIEW',
                'budget_approved_at' => $now,
                'budget_received_at' => $receivedAt,
                'oppmo_received_at' => null, // Next reviewer must receive
            ]);

            // Mark the incoming submission route as received
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

            $oppmoUsers = User::where('role', 'oppmo')->where('is_active', true)->get();

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $user->id,
                'to_user_id' => $oppmoUsers->first()?->id,
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

    /**
     * 4b. Budget Officer Returns
     * BUDGET_OFFICER_REVIEW -> BUDGET_OFFICER_RETURNED
     */
    public function budgetReturn(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        if (!$user->isBudgetOfficer() && !$user->isAdmin()) {
            return response()->json(['message' => 'Only the Budget Officer or Admin can perform this action.'], 403);
        }

        if ($ppmp->status !== 'BUDGET_OFFICER_REVIEW') {
            return response()->json(['message' => "PPMP is not awaiting budget officer review."], 422);
        }

        $validated = $request->validate([
            'remarks' => 'required|string|min:3',
            'field_changes' => 'nullable|array',
        ]);

        DB::transaction(function () use ($ppmp, $user, $validated) {
            $now = now();
            $receivedAt = $ppmp->budget_received_at ?? $now;

            $ppmp->update([
                'status' => 'BUDGET_OFFICER_RETURNED',
                'enduser_received_at' => null,
            ]);

            // Mark incoming route as received
            $this->markLatestPendingRouteReceived($ppmp->id, $receivedAt);

            $this->applyFieldModifications($ppmp, $validated['field_changes'] ?? [], $user, 'budget_officer');

            PpmpReview::create([
                'ppmp_id' => $ppmp->id,
                'reviewer_id' => $user->id,
                'reviewer_role' => 'budget_officer',
                'action' => 'return',
                'remarks' => $validated['remarks'],
                'status_before' => 'BUDGET_OFFICER_REVIEW',
                'status_after' => 'BUDGET_OFFICER_RETURNED',
                'submitted_at' => $ppmp->review_submitted_at ?? $now,
                'received_at' => $receivedAt,
                'acted_at' => $now,
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ]);

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $user->id,
                'to_user_id' => $ppmp->created_by,
                'from_role' => 'budget_officer',
                'to_role' => 'end_user',
                'action' => 'BUDGET_RETURNED',
                'status' => 'BUDGET_OFFICER_RETURNED',
                'remarks' => $validated['remarks'],
                'submitted_at' => $now,
                'acted_at' => $now,
            ]);

            $idLabel = $this->getPpmpIdentifier($ppmp);

            SystemNotification::notify(
                $ppmp->created_by,
                'PPMP Returned by Budget Officer',
                "PPMP {$idLabel} returned: " . Str::limit($validated['remarks'], 100),
                $ppmp->id,
                'warning'
            );

            AuditLog::log('PPMP_BUDGET_RETURNED', 'ppmps', $ppmp->id, null, ['remarks' => $validated['remarks']], $user->id);
        });

        return response()->json([
            'message' => 'PPMP returned by Budget Officer.',
            'ppmp' => $ppmp->fresh(['office.head', 'creator', 'signatures.user', 'routes.fromUser', 'routes.toUser']),
        ]);
    }

    /**
     * 4c. PACCO Reviewer Approves (Trust Fund PPMP)
     * PACCO_REVIEW -> OPPMO_REVIEW
     */
    public function paccoApprove(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        if (!$user->isPacco() && !$user->isAdmin()) {
            return response()->json(['message' => 'Only the PACCO Reviewer or Admin can certify trust funds.'], 403);
        }

        if ($ppmp->status !== 'PACCO_REVIEW') {
            return response()->json(['message' => "PPMP is not awaiting PACCO review."], 422);
        }

        DB::transaction(function () use ($ppmp, $user) {
            $now = now();
            $receivedAt = $ppmp->pacco_received_at ?? $now;

            $ppmp->update([
                'status' => 'OPPMO_REVIEW',
                'pacco_approved_at' => $now,
                'pacco_received_at' => $receivedAt,
                'oppmo_received_at' => null, // Next reviewer must receive
            ]);

            // Mark the incoming submission route as received
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

            $oppmoUsers = User::where('role', 'oppmo')->where('is_active', true)->get();

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $user->id,
                'to_user_id' => $oppmoUsers->first()?->id,
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

    /**
     * 4d. PACCO Reviewer Returns (Trust Fund PPMP)
     * PACCO_REVIEW -> PACCO_RETURNED
     */
    public function paccoReturn(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        if (!$user->isPacco() && !$user->isAdmin()) {
            return response()->json(['message' => 'Only the PACCO Reviewer or Admin can perform this action.'], 403);
        }

        if ($ppmp->status !== 'PACCO_REVIEW') {
            return response()->json(['message' => "PPMP is not awaiting PACCO review."], 422);
        }

        $validated = $request->validate([
            'remarks' => 'required|string|min:3',
            'field_changes' => 'nullable|array',
        ]);

        DB::transaction(function () use ($ppmp, $user, $validated) {
            $now = now();
            $receivedAt = $ppmp->pacco_received_at ?? $now;

            $ppmp->update([
                'status' => 'PACCO_RETURNED',
                'enduser_received_at' => null,
            ]);

            // Mark incoming route as received
            $this->markLatestPendingRouteReceived($ppmp->id, $receivedAt);

            $this->applyFieldModifications($ppmp, $validated['field_changes'] ?? [], $user, 'pacco');

            PpmpReview::create([
                'ppmp_id' => $ppmp->id,
                'reviewer_id' => $user->id,
                'reviewer_role' => 'pacco',
                'action' => 'return',
                'remarks' => $validated['remarks'],
                'status_before' => 'PACCO_REVIEW',
                'status_after' => 'PACCO_RETURNED',
                'submitted_at' => $ppmp->review_submitted_at ?? $now,
                'received_at' => $receivedAt,
                'acted_at' => $now,
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ]);

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $user->id,
                'to_user_id' => $ppmp->created_by,
                'from_role' => 'pacco',
                'to_role' => 'end_user',
                'action' => 'PACCO_RETURNED',
                'status' => 'PACCO_RETURNED',
                'remarks' => $validated['remarks'],
                'submitted_at' => $now,
                'acted_at' => $now,
            ]);

            $idLabel = $this->getPpmpIdentifier($ppmp);

            SystemNotification::notify(
                $ppmp->created_by,
                'PPMP Returned by PACCO Reviewer',
                "PPMP {$idLabel} returned: " . Str::limit($validated['remarks'], 100),
                $ppmp->id,
                'warning'
            );

            AuditLog::log('PPMP_PACCO_RETURNED', 'ppmps', $ppmp->id, null, ['remarks' => $validated['remarks']], $user->id);
        });

        return response()->json([
            'message' => 'PPMP returned by PACCO Reviewer.',
            'ppmp' => $ppmp->fresh(['office.head', 'creator', 'signatures.user', 'routes.fromUser', 'routes.toUser']),
        ]);
    }

    /**
     * 5a. OPPMO Approves
     * OPPMO_REVIEW -> TWG_REVIEW
     */
    public function oppmoApprove(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        if (!$user->isOppmo() && !$user->isAdmin()) {
            return response()->json(['message' => 'Only OPPMO or Admin can approve this stage.'], 403);
        }

        if ($ppmp->status !== 'OPPMO_REVIEW') {
            return response()->json(['message' => "PPMP is not awaiting OPPMO review."], 422);
        }

        $isTwgSkipped = ($ppmp->amendment_scope === 'PPMP_APP');
        $isPostTwg = $isTwgSkipped || $ppmp->twg_approved_at !== null || $ppmp->signatures()->where('role', 'twg')->exists();

        if ($isPostTwg) {
            // Must have generated the APP before forwarding to Head
            if (!$ppmp->hasAppGenerated()) {
                return response()->json([
                    'message' => 'Please generate the Annual Procurement Plan (APP) before forwarding to the Office Head.'
                ], 422);
            }

            $nextStatus = 'HEAD_PENDING';
            $nextRole = 'head';
        } else {
            $nextStatus = 'TWG_REVIEW';
            $nextRole = 'twg';
        }

        DB::transaction(function () use ($ppmp, $user, $isPostTwg, $isTwgSkipped, $nextStatus, $nextRole) {
            $now = now();
            $receivedAt = $ppmp->oppmo_received_at ?? $now;

            if ($isPostTwg) {
                $targetHeadUsers = $this->getTargetHeadUsers($ppmp->office_id);
                $primaryHeadId = $targetHeadUsers->first()?->id;

                $appData = is_array($ppmp->app_data) ? $ppmp->app_data : [];
                $appData['is_oppmo_approved'] = true;
                $appData['oppmo_approved_at'] = $now->toIso8601String();
                $appData['oppmo_approved_by_id'] = $user->id;
                $appData['oppmo_approved_by_name'] = $user->name;

                $updateData = [
                    'status' => 'HEAD_PENDING',
                    'app_data' => $appData,
                    'oppmo_app_approved_at' => $now,
                    'oppmo_received_at' => $receivedAt,
                    'head_submitted_at' => $now,
                    'head_received_at' => null, // requires Head to click Receive
                ];

                $ppmp->update($updateData);

                // Mark incoming route as received
                $this->markLatestPendingRouteReceived($ppmp->id, $receivedAt);

                PpmpReview::create([
                    'ppmp_id' => $ppmp->id,
                    'reviewer_id' => $user->id,
                    'reviewer_role' => 'oppmo',
                    'action' => 'approve',
                    'remarks' => 'Annual Procurement Plan (APP) generated and verified. Forwarded to Office Head for approval.',
                    'status_before' => 'OPPMO_REVIEW',
                    'status_after' => 'HEAD_PENDING',
                    'submitted_at' => $ppmp->twg_approved_at ?? $now,
                    'received_at' => $receivedAt,
                    'acted_at' => $now,
                    'ip_address' => request()->ip(),
                    'user_agent' => request()->userAgent(),
                ]);

                $oppmoRouteRemarks = $isTwgSkipped
                    ? 'Annual Procurement Plan (APP) generated and verified. BAC-TWG technical review bypassed (Amendment: PPMP/APP Only). Forwarded to Office Head for approval.'
                    : 'Annual Procurement Plan (APP) generated. Forwarded to Office Head for approval.';

                PpmpRoute::create([
                    'ppmp_id' => $ppmp->id,
                    'from_user_id' => $user->id,
                    'to_user_id' => $primaryHeadId,
                    'from_role' => 'oppmo',
                    'to_role' => 'head',
                    'action' => 'OPPMO_APP_GENERATED',
                    'status' => 'HEAD_PENDING',
                    'remarks' => $oppmoRouteRemarks,
                    'submitted_at' => $now,
                    'acted_at' => $now,
                ]);

                $idLabel = $this->getPpmpIdentifier($ppmp);
                foreach ($targetHeadUsers as $head) {
                    SystemNotification::notify(
                        $head->id,
                        'PPMP Awaiting Office Head Approval',
                        "PPMP {$idLabel} ({$ppmp->title}) has completed OPPMO APP generation and requires your approval.",
                        $ppmp->id,
                        'info'
                    );
                }

                $authStaffUserIds = User::where('office_id', $ppmp->office_id)
                    ->where('role', 'authorized_staff')
                    ->where('is_active', true)
                    ->whereNotIn('id', $targetHeadUsers->pluck('id'))
                    ->pluck('id');

                foreach ($authStaffUserIds as $staffId) {
                    SystemNotification::notify(
                        $staffId,
                        'PPMP Awaiting Office Head Approval (Acting Head)',
                        "PPMP {$idLabel} ({$ppmp->title}) has completed OPPMO APP generation and requires your approval on behalf of the Office Head.",
                        $ppmp->id,
                        'info'
                    );
                }

                AuditLog::log('PPMP_OPPMO_APP_APPROVED', 'ppmps', $ppmp->id, null, ['status' => 'HEAD_PENDING'], $user->id);
            } else {
                $updateData = [
                    'status' => 'TWG_REVIEW',
                    'oppmo_approved_at' => $now,
                    'oppmo_received_at' => $receivedAt,
                    'twg_received_at' => null,
                ];

                $ppmp->update($updateData);

                // Mark incoming route as received
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

                PpmpReview::create([
                    'ppmp_id' => $ppmp->id,
                    'reviewer_id' => $user->id,
                    'reviewer_role' => 'oppmo',
                    'action' => 'approve',
                    'remarks' => 'Procurement management review approved. Forwarded to BAC-TWG.',
                    'status_before' => 'OPPMO_REVIEW',
                    'status_after' => 'TWG_REVIEW',
                    'submitted_at' => $ppmp->budget_approved_at ?? ($ppmp->pacco_approved_at ?? $now),
                    'received_at' => $receivedAt,
                    'acted_at' => $now,
                    'ip_address' => request()->ip(),
                    'user_agent' => request()->userAgent(),
                ]);

                $twgUsers = User::where('role', 'twg')->where('is_active', true)->get();

                PpmpRoute::create([
                    'ppmp_id' => $ppmp->id,
                    'from_user_id' => $user->id,
                    'to_user_id' => $twgUsers->first()?->id,
                    'from_role' => 'oppmo',
                    'to_role' => 'twg',
                    'action' => 'OPPMO_APPROVED',
                    'status' => 'TWG_REVIEW',
                    'remarks' => 'Approved by OPPMO. Forwarded to BAC-TWG.',
                    'submitted_at' => $now,
                    'acted_at' => $now,
                ]);

                $idLabel = $this->getPpmpIdentifier($ppmp);
                foreach ($twgUsers as $twg) {
                    SystemNotification::notify(
                        $twg->id,
                        'PPMP Awaiting TWG Review',
                        "PPMP {$idLabel} was approved by OPPMO and is now awaiting BAC-TWG review.",
                        $ppmp->id,
                        'info'
                    );
                }

                AuditLog::log('PPMP_OPPMO_APPROVED', 'ppmps', $ppmp->id, null, ['status' => 'TWG_REVIEW'], $user->id);
            }
        });

        $returnMessage = $isPostTwg
            ? ($isTwgSkipped
                ? 'Annual Procurement Plan (APP) generated and verified. Forwarded to Office Head for approval (BAC-TWG review bypassed).'
                : 'Annual Procurement Plan (APP) verified and forwarded to Office Head for approval.')
            : 'PPMP approved by OPPMO and forwarded to BAC-TWG.';

        return response()->json([
            'message' => $returnMessage,
            'ppmp' => $ppmp->fresh(['office.head', 'creator', 'signatures.user', 'routes.fromUser', 'routes.toUser']),
        ]);
    }

    /**
     * 5b. OPPMO Returns
     * OPPMO_REVIEW -> OPPMO_RETURNED
     */
    public function oppmoReturn(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        if (!$user->isOppmo() && !$user->isAdmin()) {
            return response()->json(['message' => 'Only OPPMO or Admin can return this PPMP.'], 403);
        }

        if ($ppmp->status !== 'OPPMO_REVIEW') {
            return response()->json(['message' => "PPMP is not awaiting OPPMO review."], 422);
        }

        $validated = $request->validate([
            'remarks' => 'required|string|min:3',
            'field_changes' => 'nullable|array',
        ]);

        DB::transaction(function () use ($ppmp, $user, $validated) {
            $now = now();
            $receivedAt = $ppmp->oppmo_received_at ?? $now;

            $ppmp->update([
                'status' => 'OPPMO_RETURNED',
                'enduser_received_at' => null,
            ]);

            // Mark incoming route as received
            $this->markLatestPendingRouteReceived($ppmp->id, $receivedAt);

            $this->applyFieldModifications($ppmp, $validated['field_changes'] ?? [], $user, 'oppmo');

            PpmpReview::create([
                'ppmp_id' => $ppmp->id,
                'reviewer_id' => $user->id,
                'reviewer_role' => 'oppmo',
                'action' => 'return',
                'remarks' => $validated['remarks'],
                'status_before' => 'OPPMO_REVIEW',
                'status_after' => 'OPPMO_RETURNED',
                'submitted_at' => $ppmp->budget_approved_at ?? $now,
                'received_at' => $receivedAt,
                'acted_at' => $now,
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ]);

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $user->id,
                'to_user_id' => $ppmp->created_by,
                'from_role' => 'oppmo',
                'to_role' => 'end_user',
                'action' => 'OPPMO_RETURNED',
                'status' => 'OPPMO_RETURNED',
                'remarks' => $validated['remarks'],
                'submitted_at' => $now,
                'acted_at' => $now,
            ]);

            $idLabel = $this->getPpmpIdentifier($ppmp);

            SystemNotification::notify(
                $ppmp->created_by,
                'PPMP Returned by OPPMO',
                "PPMP {$idLabel} returned: " . Str::limit($validated['remarks'], 100),
                $ppmp->id,
                'warning'
            );

            AuditLog::log('PPMP_OPPMO_RETURNED', 'ppmps', $ppmp->id, null, ['remarks' => $validated['remarks']], $user->id);
        });

        return response()->json([
            'message' => 'PPMP returned by OPPMO.',
            'ppmp' => $ppmp->fresh(['office.head', 'creator', 'signatures.user', 'routes.fromUser', 'routes.toUser']),
        ]);
    }

    /**
     * 6a. TWG Approves (Final Technical Review)
     * TWG_REVIEW -> HEAD_PENDING (Office Head final approval before READY_TO_PRINT)
     */
    public function twgApprove(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        if (!$user->isTwg() && !$user->isAdmin()) {
            return response()->json(['message' => 'Only BAC-TWG or Admin can approve this stage.'], 403);
        }

        if ($ppmp->status !== 'TWG_REVIEW') {
            return response()->json(['message' => "PPMP is not awaiting TWG review."], 422);
        }

        if ($ppmp->amendment_scope === 'PPMP_APP') {
            return response()->json(['message' => 'BAC-TWG review is not applicable for this PPMP revision because the amendment scope is restricted to PPMP/APP only.'], 422);
        }

        DB::transaction(function () use ($ppmp, $user) {
            $now = now();
            $receivedAt = $ppmp->twg_received_at ?? $now;
            $isAttachOnly = $ppmp->amendment_scope === 'ATTACHMENT_LIST';
            $nextStatus = $isAttachOnly ? 'READY_TO_PRINT' : 'OPPMO_REVIEW';

            $updateData = [
                'status' => $nextStatus,
                'twg_approved_at' => $now,
                'twg_received_at' => $receivedAt,
            ];
            if ($isAttachOnly) {
                $updateData['ready_to_print_at'] = $now;
                $updateData['enduser_received_at'] = null;
            } else {
                $updateData['oppmo_received_at'] = null;
            }
            $ppmp->update($updateData);

            // Mark incoming route as received
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

            // Synchronize the approving TWG reviewer's name & designation into the PPMP list of attachment data
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
                    ? 'PPMP List of Attachment specifications verified and approved by BAC-TWG.'
                    : 'BAC-TWG technical review approved. Routed back to OPPMO for APP generation.',
                'status_before' => 'TWG_REVIEW',
                'status_after' => $nextStatus,
                'submitted_at' => $ppmp->oppmo_approved_at ?? $now,
                'received_at' => $receivedAt,
                'acted_at' => $now,
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ]);

            $idLabel = $this->getPpmpIdentifier($ppmp);

            if ($isAttachOnly) {
                PpmpRoute::create([
                    'ppmp_id' => $ppmp->id,
                    'from_user_id' => $user->id,
                    'to_user_id' => $ppmp->created_by,
                    'from_role' => 'twg',
                    'to_role' => 'end_user',
                    'action' => 'TWG_APPROVED_ATTACHMENT_LIST',
                    'status' => 'READY_TO_PRINT',
                    'remarks' => 'Updated PPMP List of Attachment evaluated and approved by BAC-TWG. Document is now READY TO PRINT.',
                    'submitted_at' => $now,
                    'acted_at' => $now,
                ]);

                SystemNotification::notify(
                    $ppmp->created_by,
                    'PPMP Approved & Ready to Print',
                    "Congratulations! The updated List of Attachment for PPMP {$idLabel} ({$ppmp->title}) was approved by BAC-TWG ({$user->name}) and is now READY TO PRINT.",
                    $ppmp->id,
                    'success'
                );

                AuditLog::log('PPMP_TWG_APPROVED_ATTACHMENT_LIST', 'ppmps', $ppmp->id, null, ['target' => 'READY_TO_PRINT'], $user->id);
            } else {
                $oppmoUsers = User::where('role', 'oppmo')->where('is_active', true)->get();

                PpmpRoute::create([
                    'ppmp_id' => $ppmp->id,
                    'from_user_id' => $user->id,
                    'to_user_id' => $oppmoUsers->first()?->id,
                    'from_role' => 'twg',
                    'to_role' => 'oppmo',
                    'action' => 'TWG_APPROVED',
                    'status' => 'OPPMO_REVIEW',
                    'remarks' => 'BAC-TWG technical review approved. Routed back to OPPMO to generate Annual Procurement Plan (APP).',
                    'submitted_at' => $now,
                    'acted_at' => $now,
                ]);

                foreach ($oppmoUsers as $oppmo) {
                    SystemNotification::notify(
                        $oppmo->id,
                        'PPMP Awaiting APP Generation',
                        "PPMP {$idLabel} ({$ppmp->title}) has completed BAC-TWG technical review and was routed back to OPPMO for Annual Procurement Plan (APP) generation.",
                        $ppmp->id,
                        'info'
                    );
                }

                AuditLog::log('PPMP_TWG_APPROVED', 'ppmps', $ppmp->id, null, ['status' => 'OPPMO_REVIEW'], $user->id);
            }
        });

        return response()->json([
            'message' => $ppmp->fresh()->status === 'READY_TO_PRINT'
                ? 'PPMP List of Attachment approved by BAC-TWG. Document is now READY TO PRINT.'
                : 'PPMP approved by BAC-TWG and routed back to OPPMO for APP generation.',
            'ppmp' => $ppmp->fresh(['office.head', 'creator', 'signatures.user', 'routes.fromUser', 'routes.toUser']),
        ]);
    }

    /**
     * 6b. TWG Returns
     * TWG_REVIEW -> TWG_RETURNED
     */
    public function twgReturn(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        if (!$user->isTwg() && !$user->isAdmin()) {
            return response()->json(['message' => 'Only BAC-TWG or Admin can return this PPMP.'], 403);
        }

        if ($ppmp->status !== 'TWG_REVIEW') {
            return response()->json(['message' => "PPMP is not awaiting TWG review."], 422);
        }

        if ($ppmp->amendment_scope === 'PPMP_APP') {
            return response()->json(['message' => 'BAC-TWG review is not applicable for this PPMP revision because the amendment scope is restricted to PPMP/APP only.'], 422);
        }

        $validated = $request->validate([
            'remarks' => 'required|string|min:3',
            'field_changes' => 'nullable|array',
        ]);

        DB::transaction(function () use ($ppmp, $user, $validated) {
            $now = now();
            $receivedAt = $ppmp->twg_received_at ?? $now;

            $ppmp->update([
                'status' => 'TWG_RETURNED',
                'enduser_received_at' => null,
            ]);

            // Mark incoming route as received
            $this->markLatestPendingRouteReceived($ppmp->id, $receivedAt);

            $this->applyFieldModifications($ppmp, $validated['field_changes'] ?? [], $user, 'twg');

            PpmpReview::create([
                'ppmp_id' => $ppmp->id,
                'reviewer_id' => $user->id,
                'reviewer_role' => 'twg',
                'action' => 'return',
                'remarks' => $validated['remarks'],
                'status_before' => 'TWG_REVIEW',
                'status_after' => 'TWG_RETURNED',
                'submitted_at' => $ppmp->oppmo_approved_at ?? $now,
                'received_at' => $receivedAt,
                'acted_at' => $now,
                'ip_address' => request()->ip(),
                'user_agent' => request()->userAgent(),
            ]);

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $user->id,
                'to_user_id' => $ppmp->created_by,
                'from_role' => 'twg',
                'to_role' => 'end_user',
                'action' => 'TWG_RETURNED',
                'status' => 'TWG_RETURNED',
                'remarks' => $validated['remarks'],
                'submitted_at' => $now,
                'acted_at' => $now,
            ]);

            $idLabel = $this->getPpmpIdentifier($ppmp);

            SystemNotification::notify(
                $ppmp->created_by,
                'PPMP Returned by BAC-TWG',
                "PPMP {$idLabel} returned: " . Str::limit($validated['remarks'], 100),
                $ppmp->id,
                'warning'
            );

            AuditLog::log('PPMP_TWG_RETURNED', 'ppmps', $ppmp->id, null, ['remarks' => $validated['remarks']], $user->id);
        });

        return response()->json([
            'message' => 'PPMP returned by BAC-TWG.',
            'ppmp' => $ppmp->fresh(['office.head', 'creator', 'signatures.user', 'routes.fromUser', 'routes.toUser']),
        ]);
    }

    /**
     * 7. Explicit Receive Document in current workflow stage
     */
    public function receive(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();
        $now = now();

        $updated = false;

        // Admin receiving an amendment / supplemental request
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
        } elseif ($ppmp->status === 'HEAD_PENDING' && (($user->isHead() && $user->office_id === $ppmp->office_id) || $user->isAdmin())) {
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
            $ppmp->update(['budget_received_at' => $now]);
            $this->markLatestPendingRouteReceived($ppmp->id, $now);

            $oppmoUser = User::where('role', 'oppmo')->where('is_active', true)->first();

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $user->id,
                'to_user_id' => $oppmoUser?->id,
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
            $ppmp->update(['pacco_received_at' => $now]);
            $this->markLatestPendingRouteReceived($ppmp->id, $now);

            $oppmoUser = User::where('role', 'oppmo')->where('is_active', true)->first();

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $user->id,
                'to_user_id' => $oppmoUser?->id,
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
            $ppmp->update(['oppmo_received_at' => $now]);
            $this->markLatestPendingRouteReceived($ppmp->id, $now);

            $isTwgSkipped = ($ppmp->amendment_scope === 'PPMP_APP');
            $isPostTwg = $isTwgSkipped || $ppmp->twg_approved_at !== null || $ppmp->signatures()->where('role', 'twg')->exists();
            $twgUser = User::where('role', 'twg')->where('is_active', true)->first();
            $headUser = $this->getTargetHeadUsers($ppmp->office_id)->first();

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $user->id,
                'to_user_id' => $isPostTwg ? $headUser?->id : $twgUser?->id,
                'from_role' => 'oppmo',
                'to_role' => $isPostTwg ? 'head' : 'twg',
                'action' => 'OPPMO_RECEIVED',
                'status' => 'OPPMO_REVIEW',
                'remarks' => $isPostTwg
                    ? 'PPMP document received and under OPPMO review for Annual Procurement Plan (APP) generation.'
                    : 'PPMP document received and under OPPMO review.',
                'submitted_at' => $now,
                'received_at' => $now,
                'acted_at' => $now,
            ]);
            $updated = true;
        } elseif ($ppmp->status === 'TWG_REVIEW' && ($user->isTwg() || $user->isAdmin())) {
            $ppmp->update(['twg_received_at' => $now]);
            $this->markLatestPendingRouteReceived($ppmp->id, $now);

            $oppmoUser = User::where('role', 'oppmo')->where('is_active', true)->first();

            PpmpRoute::create([
                'ppmp_id' => $ppmp->id,
                'from_user_id' => $user->id,
                'to_user_id' => $oppmoUser?->id,
                'from_role' => 'twg',
                'to_role' => 'oppmo',
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

    /**
     * Mark the most recent route awaiting receipt for a PPMP as received
     */
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

    /**
     * 8a. Request Supplemental or Amendment (End User when READY_TO_PRINT)
     */
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

        $validated = $request->validate([
            'request_scope' => 'nullable|in:PPMP_APP,ATTACHMENT_LIST,ALL',
            'request_type' => 'nullable|in:SUPPLEMENTAL,AMENDMENT,ATTACHMENT_LIST',
            'reason' => 'required|string|min:5|max:2000',
            'letter_file' => 'required|file|mimes:pdf|max:20480',
        ]);

        $scope = $validated['request_scope'] ?? 'PPMP_APP';
        $type = $validated['request_type'] ?? ($scope === 'ATTACHMENT_LIST' ? 'ATTACHMENT_LIST' : 'SUPPLEMENTAL');

        $uploadedFile = $request->file('letter_file');
        
        // Validate %PDF- magic bytes header to prevent malicious or disguised executable uploads
        $handle = fopen($uploadedFile->getRealPath(), 'rb');
        $header = fread($handle, 5);
        fclose($handle);
        if ($header !== '%PDF-') {
            return response()->json(['message' => 'Invalid file content. Must be a valid PDF document.'], 422);
        }

        $now = now();

        $ppmp = DB::transaction(function () use ($ppmp, $user, $validated, $uploadedFile, $scope, $type, $now) {
            // Save request letter in private disk
            $internalFilename = (string) Str::uuid() . '.pdf';
            $directory = 'ppmp/' . $ppmp->id;
            $path = $uploadedFile->storeAs($directory, $internalFilename, 'local');

            $attachment = PpmpAttachment::create([
                'uuid' => (string) Str::uuid(),
                'ppmp_id' => $ppmp->id,
                'uploaded_by' => $user->id,
                'original_filename' => basename($uploadedFile->getClientOriginalName()),
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
                'amendment_requested_at' => $now,
                'admin_received_at' => null, // Admin needs to receive request
            ]);

            $scopeLabel = match ($scope) {
                'PPMP_APP' => 'PPMP / APP Only',
                'ATTACHMENT_LIST' => 'PPMP List of Attachment Only',
                default => 'PPMP / APP & List of Attachment',
            };
            $typeLabel = match ($type) {
                'SUPPLEMENTAL' => 'Supplemental',
                'AMENDMENT' => 'Amendment',
                default => 'List of Attachment Update',
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

            // Notify Admins & Super Admins
            $admins = User::whereIn('role', ['admin', 'super_admin'])->where('is_active', true)->get();
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

    /**
     * 8b. Admin Approves Amendment / Supplemental Request
     * Marks baseline as Annual PPMP, forks a child PPMP with incremented ppmp_number, sets to DRAFT
     */
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
        $now = now();

        // Scope: ATTACHMENT_LIST only
        // Does NOT create a new PPMP child in DRAFT because changes are strictly on the List of Attachment.
        // The existing PPMP is reopened in DRAFT status so only the attachment list can be edited and submitted to BAC-TWG.
        if ($scope === 'ATTACHMENT_LIST') {
            $updatedPpmp = DB::transaction(function () use ($ppmp, $admin, $type, $scope, $reason, $now) {
                // Clear existing BAC-TWG signature so TWG must re-evaluate and re-sign
                PpmpSignature::where('ppmp_id', $ppmp->id)->where('role', 'twg')->delete();

                // Clear approving TWG fields from attachment_list_data so TWG details will re-populate upon approval
                if (!empty($ppmp->attachment_list_data) && is_array($ppmp->attachment_list_data)) {
                    $attData = $ppmp->attachment_list_data;
                    unset($attData['approved_by_name'], $attData['approved_by_position']);
                    $ppmp->attachment_list_data = $attData;
                }

                // Update PPMP to DRAFT to allow List of Attachment edits
                $ppmp->update([
                    'status' => 'DRAFT',
                    'amendment_status' => 'APPROVED',
                    'amendment_type' => $type,
                    'amendment_scope' => 'ATTACHMENT_LIST',
                    'amendment_reason' => $reason,
                    'amendment_approved_at' => $now,
                    'twg_approved_at' => null,
                    'twg_received_at' => null,
                    'ready_to_print_at' => null,
                    'enduser_received_at' => null,
                    'attachment_list_data' => $ppmp->attachment_list_data,
                ]);

                // Mark incoming route as received
                $this->markLatestPendingRouteReceived($ppmp->id, $ppmp->admin_received_at ?? $now);

                // Log route to End User
                PpmpRoute::create([
                    'ppmp_id' => $ppmp->id,
                    'from_user_id' => $admin->id,
                    'to_user_id' => $ppmp->created_by,
                    'from_role' => 'admin',
                    'to_role' => 'end_user',
                    'action' => 'ADMIN_APPROVED_' . $type,
                    'status' => 'DRAFT',
                    'remarks' => "{$type} (PPMP List of Attachment Only) approved by Administrator. Reopened in DRAFT for editing List of Attachment.",
                    'submitted_at' => $now,
                    'acted_at' => $now,
                ]);

                // Notify Creator
                $idLabel = $this->getPpmpIdentifier($ppmp);
                SystemNotification::notify(
                    $ppmp->created_by,
                    "{$type} Request Approved",
                    "Your {$type} request (PPMP List of Attachment Only) for PPMP {$idLabel} was approved! You can now update the List of Attachment and submit for BAC-TWG review.",
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
                'message' => "{$type} request approved. PPMP List of Attachment reopened in DRAFT for editing.",
                'ppmp' => $updatedPpmp->fresh(['office.head', 'creator', 'signatures.user', 'routes.fromUser', 'routes.toUser', 'parent']),
            ]);
        }

        $newPpmp = DB::transaction(function () use ($ppmp, $admin, $type, $scope, $reason, $now) {
            // Update amendment status on the baseline PPMP (only the root PPMP with no parent_id is the Annual PPMP)
            $ppmp->update([
                'amendment_status' => 'APPROVED',
                'amendment_approved_at' => $now,
                'is_annual' => empty($ppmp->parent_id),
            ]);

            // Preserve the existing PPMP number without auto-incrementing (+1); end user will manually edit PPMP No. if needed
            $ppmpNumber = $ppmp->ppmp_number;

            // Keep the exact same tracker number across amendments/supplementals
            $trackingNumber = $ppmp->tracking_number;

            $childPpmp = Ppmp::create([
                'uuid' => (string) Str::uuid(),
                'parent_id' => $ppmp->id,
                'tracking_number' => $trackingNumber,
                'ppmp_number' => $ppmpNumber,
                'office_id' => $ppmp->office_id,
                'implementing_unit' => $ppmp->implementing_unit,
                'program_name' => $ppmp->program_name,
                'created_by' => $ppmp->created_by,
                'title' => $ppmp->title,
                'account_code' => $ppmp->account_code,
                'fiscal_year' => $ppmp->fiscal_year,
                'plan_type' => $ppmp->plan_type,
                'is_annual' => false,
                'delivery_period' => $ppmp->delivery_period,
                'place_of_delivery' => $ppmp->place_of_delivery,
                'payment_method' => $ppmp->payment_method,
                'warranty_and_other_terms' => $ppmp->warranty_and_other_terms,
                'attachment_list_data' => $ppmp->attachment_list_data,
                'app_data' => [
                    'needs_regeneration' => true,
                    'is_generated' => false,
                    'old_app' => $ppmp->app_data,
                ],
                'total_budget' => $ppmp->total_budget,
                'status' => 'DRAFT',
                'amendment_status' => null,
                'amendment_type' => $type,
                'amendment_scope' => $scope,
                'amendment_reason' => $reason,
                'prepared_at' => $now,
            ]);

            // Replicate line items
            foreach ($ppmp->items as $item) {
                PpmpItem::create([
                    'ppmp_id' => $childPpmp->id,
                    'item_no' => $item->item_no,
                    'description' => $item->description,
                    'project_type' => $item->project_type,
                    'quantity_size' => $item->quantity_size,
                    'procurement_mode' => $item->procurement_mode,
                    'pre_proc_conference' => $item->pre_proc_conference,
                    'start_date' => $item->start_date,
                    'end_date' => $item->end_date,
                    'delivery_period' => $item->delivery_period,
                    'source_of_fund' => $item->source_of_fund,
                    'estimated_budget' => $item->estimated_budget,
                    'supporting_docs_text' => $item->supporting_docs_text,
                    'remarks' => $item->remarks,
                ]);
            }

            // Copy non-letter attachments or link them
            foreach ($ppmp->attachments as $att) {
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

            // For amended or supplemental PPMPs, reviewer signatures (budget_officer, oppmo, twg)
            // and head signature must NOT be copied from parent.
            // The new revision starts in DRAFT and must proceed through the review workflow before reviewer signatures/initials are inserted.
            // Only the end_user (creator) signature is preserved.
            foreach ($ppmp->signatures as $sig) {
                if ($sig->role === 'end_user') {
                    $newSig = $sig->replicate();
                    $newSig->ppmp_id = $childPpmp->id;
                    $newSig->save();
                }
            }

            $scopeLabel = match ($scope) {
                'PPMP_APP' => 'PPMP/APP Only',
                'ATTACHMENT_LIST' => 'List of Attachment Only',
                default => 'PPMP/APP & List of Attachment',
            };

            // Route log on parent
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

            // Initial route log on child
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

            // Notify Creator
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

    /**
     * 8c. Admin Rejects Amendment / Supplemental Request
     */
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

    /**
     * Apply reviewer field modifications and record change logs
     */
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

                // If budget changed, update ppmp total_budget
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

        // If this is an amended or supplemental PPMP, invalidate APP so OPPMO generates it again
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

    /**
     * Resolve target head users for an office
     */
    protected function getTargetHeadUsers(int $officeId)
    {
        $office = Office::find($officeId);
        if (!$office) {
            return collect();
        }

        $heads = User::where('office_id', $officeId)
            ->where('role', 'head')
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

    /**
     * Get user-friendly PPMP identifier (Tracking number preferred over raw 0)
     */
    private function getPpmpIdentifier(Ppmp $ppmp): string
    {
        return $ppmp->tracking_number ?: "PPMP No. {$ppmp->ppmp_number}";
    }
}
