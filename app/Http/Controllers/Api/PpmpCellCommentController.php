<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AccountCode;
use App\Models\ProgramName;
use App\Models\Ppmp;
use App\Models\PpmpItem;
use App\Models\PpmpChangeLog;
use App\Models\PpmpCellComment;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PpmpCellCommentController extends Controller
{
    /**
     * Get all cell comments for a PPMP.
     */
    public function index(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        $isSuspended = str_ends_with($ppmp->status, '_RETURNED');
        $isReviewerOrAdmin = in_array($user?->role, ['head', 'authorized_staff', 'budget_officer', 'pacco', 'oppmo', 'twg', 'admin', 'super_admin']) || ($user && $user->isAdmin());

        $query = $ppmp->cellComments()
            ->with(['reviewer', 'compliedByUser'])
            ->orderBy('created_at', 'asc');

        // For end-users when PPMP is NOT currently suspended/returned:
        // Hide unreleased reviewer draft comments (pending), but ALWAYS allow end-users
        // to view all comments they have already complied with, even after resubmitting to the reviewer.
        if (!$isReviewerOrAdmin && !$isSuspended) {
            $query->where('status', 'complied');
        }

        $comments = $query->get();

        return response()->json([
            'data' => $comments,
            'pending_count' => $comments->where('status', 'pending')->count(),
            'complied_count' => $comments->where('status', 'complied')->count(),
        ]);
    }

    /**
     * Reviewer adds a comment to a specific cell in the PPMP.
     */
    public function store(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        // Ensure user is an authorized reviewer or admin
        $allowedReviewerRoles = ['head', 'budget_officer', 'pacco', 'oppmo', 'twg', 'admin', 'super_admin'];
        if (!in_array($user->role, $allowedReviewerRoles) && !$user->isAdmin()) {
            return response()->json(['message' => 'Only authorized reviewers and administrators can add review comments.'], 403);
        }

        // Enforce reviewer assignment restrictions
        if (!$user->isAdmin()) {
            if ($user->isTwg() && $ppmp->twg_reviewer_id && $ppmp->twg_reviewer_id !== $user->id) {
                return response()->json(['message' => 'Unauthorized. This PPMP is assigned to a different BAC-TWG reviewer.'], 403);
            }
            if (($user->isBudgetOfficer() || $user->isPacco()) && $ppmp->budget_reviewer_id && $ppmp->budget_reviewer_id !== $user->id) {
                return response()->json(['message' => 'Unauthorized. This PPMP is assigned to a different Budget/PACCO reviewer.'], 403);
            }
            if ($user->isOppmo() && $ppmp->oppmo_reviewer_id && $ppmp->oppmo_reviewer_id !== $user->id) {
                return response()->json(['message' => 'Unauthorized. This PPMP is assigned to a different OPPMO reviewer.'], 403);
            }
            if ($user->isHead() && $ppmp->office_id && $ppmp->office_id !== $user->office_id) {
                return response()->json(['message' => 'Unauthorized. You may only comment on PPMPs from your assigned office.'], 403);
            }
        }

        $validated = $request->validate([
            'item_id' => 'nullable|exists:ppmp_items,id',
            'item_no' => 'nullable|integer',
            'field_key' => 'required|string|max:60',
            'field_label' => 'nullable|string|max:100',
            'cell_value' => 'nullable|string',
            'comment' => 'required|string|min:2',
        ]);

        $roleLabel = match ($user->role) {
            'head' => 'Department / Office Head',
            'budget_officer' => 'Provincial Budget Officer',
            'pacco' => 'Provincial Accountant (PACCO)',
            'oppmo' => 'OPPMO / BAC Secretariat',
            'twg' => 'BAC-TWG Evaluator',
            'admin', 'super_admin' => 'Administrator',
            default => 'Reviewer'
        };

        $cellComment = PpmpCellComment::create([
            'ppmp_id' => $ppmp->id,
            'item_id' => $validated['item_id'] ?? null,
            'item_no' => $validated['item_no'] ?? null,
            'field_key' => $validated['field_key'],
            'field_label' => $validated['field_label'] ?? ucwords(str_replace('_', ' ', $validated['field_key'])),
            'cell_value' => $validated['cell_value'] ?? null,
            'comment' => trim($validated['comment']),
            'reviewer_id' => $user->id,
            'reviewer_name' => $user->name,
            'reviewer_role' => $roleLabel,
            'status' => 'pending',
        ]);

        $cellComment->load(['reviewer', 'compliedByUser']);

        return response()->json([
            'message' => 'Reviewer comment added to cell.',
            'data' => $cellComment,
        ], 201);
    }

    /**
     * Reviewer or admin deletes a cell comment.
     */
    public function destroy(Request $request, string $uuid, int $commentId): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();
        $comment = PpmpCellComment::where('ppmp_id', $ppmp->id)->where('id', $commentId)->firstOrFail();

        // Only author or admin can delete
        if ($comment->reviewer_id !== $user->id && !$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. You may only remove comments you authored.'], 403);
        }

        $comment->delete();

        return response()->json(['message' => 'Review comment removed.']);
    }

    /**
     * Check if a user can edit/comply cell values on this PPMP.
     */
    protected function checkCanEditCell(Ppmp $ppmp, ?User $user): bool
    {
        if (!$user) return false;
        if ($user->isAdmin()) return true;

        $isCreator = ($ppmp->created_by === $user->id);
        if ($isCreator && in_array($ppmp->status, [
            'DRAFT',
            'HEAD_PENDING',
            'HEAD_APPROVED',
            'HEAD_RETURNED',
            'BUDGET_OFFICER_RETURNED',
            'PACCO_RETURNED',
            'OPPMO_RETURNED',
            'TWG_RETURNED'
        ], true)) {
            return true;
        }

        $isReviewer = (
            ($user->isHead() && in_array($ppmp->status, ['HEAD_PENDING', 'HEAD_APPROVED']) && $user->office_id === $ppmp->office_id) ||
            ($user->isBudgetOfficer() && $ppmp->status === 'BUDGET_OFFICER_REVIEW' && (!$ppmp->budget_reviewer_id || $ppmp->budget_reviewer_id === $user->id)) ||
            ($user->isPacco() && $ppmp->status === 'PACCO_REVIEW' && (!$ppmp->budget_reviewer_id || $ppmp->budget_reviewer_id === $user->id)) ||
            ($user->isOppmo() && $ppmp->status === 'OPPMO_REVIEW' && (!$ppmp->oppmo_reviewer_id || $ppmp->oppmo_reviewer_id === $user->id)) ||
            ($user->isTwg() && $ppmp->status === 'TWG_REVIEW' && (!$ppmp->twg_reviewer_id || $ppmp->twg_reviewer_id === $user->id))
        );

        return (bool) $isReviewer;
    }

    /**
     * Apply a cell value update to the PPMP database records and record audit trail in ppmp_change_logs.
     */
    protected function applyCellUpdate(Ppmp $ppmp, User $user, string $fieldKey, ?string $fieldLabel, mixed $newValue, ?int $itemId = null, ?int $itemNo = null): array
    {
        $changeLogsCreated = [];
        $fk = strtolower(trim($fieldKey));
        $fl = trim((string)$fieldLabel);

        // 1. PPMP Item Field
        $item = null;
        if ($itemId) {
            $item = PpmpItem::where('ppmp_id', $ppmp->id)->where('id', $itemId)->first();
        }
        if (!$item && $itemNo) {
            $item = PpmpItem::where('ppmp_id', $ppmp->id)->where('item_no', $itemNo)->first();
            if (!$item && $itemNo > 0) {
                $item = PpmpItem::where('ppmp_id', $ppmp->id)->orderBy('id')->skip($itemNo - 1)->first();
            }
        }

        $itemFieldMap = [
            'procurement_mode' => 'procurement_mode',
            'mode_of_procurement' => 'procurement_mode',
            'recommended_mode_of_procurement' => 'procurement_mode',
            'pre_proc_conference' => 'pre_proc_conference',
            'project_type' => 'project_type',
            'quantity_size' => 'quantity_size',
            'quantity' => 'quantity_size',
            'description' => 'description',
            'general_description' => 'description',
            'source_of_fund' => 'source_of_fund',
            'estimated_budget' => 'estimated_budget',
            'budget' => 'estimated_budget',
            'start_date' => 'start_date',
            'end_date' => 'end_date',
            'delivery_period' => 'delivery_period',
            'remarks' => 'remarks',
            'supporting_docs_text' => 'supporting_docs_text',
        ];

        if ($item && array_key_exists($fk, $itemFieldMap)) {
            $col = $itemFieldMap[$fk];
            $oldVal = $item->{$col};

            if ($col === 'pre_proc_conference') {
                $formattedNewVal = in_array(strtoupper(trim((string)$newValue)), ['YES', '1', 'TRUE'], true);
                $item->update([$col => $formattedNewVal]);
                $oldDisplay = $oldVal ? 'YES' : 'NO';
                $newDisplay = $formattedNewVal ? 'YES' : 'NO';
            } elseif ($col === 'estimated_budget') {
                $cleanNum = (float) preg_replace('/[^0-9.]/', '', (string)$newValue);
                $item->update([$col => $cleanNum]);
                $oldDisplay = '₱' . number_format((float)$oldVal, 2);
                $newDisplay = '₱' . number_format($cleanNum, 2);
                $ppmp->update(['total_budget' => $ppmp->items()->sum('estimated_budget')]);
            } else {
                $formattedNewVal = (string) $newValue;
                $item->update([$col => $formattedNewVal]);
                $oldDisplay = $oldVal !== null && $oldVal !== '' ? (string)$oldVal : '(empty)';
                $newDisplay = $formattedNewVal !== '' ? $formattedNewVal : '(empty)';
            }

            $logField = "Item #{$item->item_no} " . ($fl ?: ucwords(str_replace('_', ' ', $col)));
            if ($oldDisplay !== $newDisplay) {
                $log = PpmpChangeLog::create([
                    'ppmp_id' => $ppmp->id,
                    'user_id' => $user->id,
                    'role' => $user->role,
                    'field_name' => $logField,
                    'old_value' => $oldDisplay,
                    'new_value' => $newDisplay,
                    'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                ]);
                $changeLogsCreated[] = $log;
            }

            return ['type' => 'item', 'item' => $item->fresh(), 'logs' => $changeLogsCreated];
        }

        // 2. Attachment List Field
        if (str_starts_with($fk, 'att_')) {
            $attData = $ppmp->attachment_list_data;
            if (!is_array($attData)) {
                $attData = [];
            }

            if (preg_match('/^att_r(\d+)_(.+)$/', $fk, $matches)) {
                $rowNum = (int) $matches[1];
                $subField = $matches[2];
                $targetKey = $subField === 'unit_cost' ? 'unitCost' : ($subField === 'item_no' ? 'itemNo' : ($subField === 'total_cost' ? 'totalCost' : $subField));

                $rows = $attData['rows'] ?? [];
                $foundIdx = -1;
                foreach ($rows as $idx => $r) {
                    if (($r['itemNo'] ?? ($r['id'] ?? null)) == $rowNum) {
                        $foundIdx = $idx;
                        break;
                    }
                }

                if ($foundIdx !== -1) {
                    $oldRVal = $rows[$foundIdx][$targetKey] ?? '';
                    $rows[$foundIdx][$targetKey] = (string)$newValue;

                    if (in_array($targetKey, ['qty', 'unitCost'])) {
                        $q = (float)($rows[$foundIdx]['qty'] ?? 0);
                        $c = (float)($rows[$foundIdx]['unitCost'] ?? 0);
                        $rows[$foundIdx]['totalCost'] = ($q > 0 && $c > 0) ? (string)($q * $c) : '';
                    }

                    $attData['rows'] = $rows;
                    $ppmp->update(['attachment_list_data' => $attData]);

                    $log = PpmpChangeLog::create([
                        'ppmp_id' => $ppmp->id,
                        'user_id' => $user->id,
                        'role' => $user->role,
                        'field_name' => "Attachment List • Row #{$rowNum} " . ucwords($subField),
                        'old_value' => (string)$oldRVal ?: '(empty)',
                        'new_value' => (string)$newValue ?: '(empty)',
                        'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                    ]);
                    $changeLogsCreated[] = $log;
                }
            } else {
                $hdrMap = [
                    'att_office_name' => 'office_name',
                    'att_project_title' => 'project_title',
                    'att_warranty_terms' => 'other_terms',
                    'att_other_terms' => 'other_terms',
                    'att_additional_condition' => 'additional_condition',
                    'att_place_of_delivery' => 'place_of_delivery',
                    'att_payment_method' => 'payment_method',
                    'att_delivery_period' => 'delivery_period',
                ];
                if (array_key_exists($fk, $hdrMap)) {
                    $parsed = null;
                    if (is_string($newValue)) {
                        $parsed = json_decode($newValue, true);
                    } elseif (is_array($newValue)) {
                        $parsed = $newValue;
                    }

                    if (in_array($fk, ['att_other_terms', 'att_warranty_terms']) && is_array($parsed) && (isset($parsed['other_terms']) || isset($parsed['place_of_delivery']) || isset($parsed['payment_method']) || isset($parsed['delivery_period']))) {
                        $newOt = $parsed['other_terms'] ?? ($parsed['otherTerms'] ?? null);
                        $newPod = $parsed['place_of_delivery'] ?? ($parsed['placeOfDelivery'] ?? null);
                        $newPm = $parsed['payment_method'] ?? ($parsed['paymentMethod'] ?? null);
                        $newDp = $parsed['delivery_period'] ?? ($parsed['deliveryPeriod'] ?? null);

                        $oldOt = $attData['other_terms'] ?? '';
                        $oldPod = $attData['place_of_delivery'] ?? ($ppmp->place_of_delivery ?? '');
                        $oldPm = $attData['payment_method'] ?? ($ppmp->payment_method ?? '');
                        $oldDp = $attData['delivery_period'] ?? ($ppmp->delivery_period ?? '');

                        $ppmpUpdates = [];
                        if ($newOt !== null) {
                            $attData['other_terms'] = (string)$newOt;
                            $ppmpUpdates['warranty_and_other_terms'] = (string)$newOt;
                        }
                        if ($newPod !== null) {
                            $attData['place_of_delivery'] = (string)$newPod;
                            $ppmpUpdates['place_of_delivery'] = (string)$newPod;
                        }
                        if ($newPm !== null) {
                            $attData['payment_method'] = (string)$newPm;
                            $ppmpUpdates['payment_method'] = (string)$newPm;
                        }
                        if ($newDp !== null) {
                            $attData['delivery_period'] = (string)$newDp;
                            $ppmpUpdates['delivery_period'] = (string)$newDp;
                        }

                        if (isset($attData['attachment_lists']) && is_array($attData['attachment_lists'])) {
                            foreach ($attData['attachment_lists'] as $itemK => $iList) {
                                $matchesItem = false;
                                if ($itemId && str_contains($itemK, (string)$itemId)) $matchesItem = true;
                                if ($itemNo && str_contains($itemK, "item_{$itemNo}")) $matchesItem = true;
                                if (count($attData['attachment_lists']) === 1) $matchesItem = true;

                                if ($matchesItem) {
                                    if ($newOt !== null) $attData['attachment_lists'][$itemK]['other_terms'] = (string)$newOt;
                                    if ($newPod !== null) $attData['attachment_lists'][$itemK]['place_of_delivery'] = (string)$newPod;
                                    if ($newPm !== null) $attData['attachment_lists'][$itemK]['payment_method'] = (string)$newPm;
                                    if ($newDp !== null) $attData['attachment_lists'][$itemK]['delivery_period'] = (string)$newDp;
                                }
                            }
                        }

                        $ppmpUpdates['attachment_list_data'] = $attData;
                        $ppmp->update($ppmpUpdates);

                        $itemPrefix = $itemNo ? "Attachment List #{$itemNo} • " : "Attachment List • ";
                        if ($newOt !== null && $oldOt !== (string)$newOt) {
                            $changeLogsCreated[] = PpmpChangeLog::create([
                                'ppmp_id' => $ppmp->id,
                                'user_id' => $user->id,
                                'role' => $user->role,
                                'field_name' => "{$itemPrefix}Other Terms / Green Specs",
                                'old_value' => (string)$oldOt ?: '(empty)',
                                'new_value' => (string)$newOt ?: '(empty)',
                                'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                            ]);
                        }
                        if ($newPod !== null && $oldPod !== (string)$newPod) {
                            $changeLogsCreated[] = PpmpChangeLog::create([
                                'ppmp_id' => $ppmp->id,
                                'user_id' => $user->id,
                                'role' => $user->role,
                                'field_name' => "{$itemPrefix}Place of Delivery",
                                'old_value' => (string)$oldPod ?: '(empty)',
                                'new_value' => (string)$newPod ?: '(empty)',
                                'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                            ]);
                        }
                        if ($newPm !== null && $oldPm !== (string)$newPm) {
                            $changeLogsCreated[] = PpmpChangeLog::create([
                                'ppmp_id' => $ppmp->id,
                                'user_id' => $user->id,
                                'role' => $user->role,
                                'field_name' => "{$itemPrefix}Payment Method",
                                'old_value' => (string)$oldPm ?: '(empty)',
                                'new_value' => (string)$newPm ?: '(empty)',
                                'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                            ]);
                        }
                        if ($newDp !== null && $oldDp !== (string)$newDp) {
                            $changeLogsCreated[] = PpmpChangeLog::create([
                                'ppmp_id' => $ppmp->id,
                                'user_id' => $user->id,
                                'role' => $user->role,
                                'field_name' => "{$itemPrefix}Delivery Period",
                                'old_value' => (string)$oldDp ?: '(empty)',
                                'new_value' => (string)$newDp ?: '(empty)',
                                'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                            ]);
                        }

                        return ['type' => 'attachment', 'attachment_data' => $attData, 'ppmp' => $ppmp->fresh(), 'logs' => $changeLogsCreated];
                    }

                    $hKey = $hdrMap[$fk];
                    $oldHVal = $attData[$hKey] ?? '';
                    $attData[$hKey] = (string)$newValue;
                    $ppmpUpdates = ['attachment_list_data' => $attData];
                    if (in_array($hKey, ['warranty_and_other_terms', 'additional_condition', 'place_of_delivery', 'payment_method', 'delivery_period'])) {
                        $ppmpUpdates[$hKey] = (string)$newValue;
                    }
                    $ppmp->update($ppmpUpdates);

                    $log = PpmpChangeLog::create([
                        'ppmp_id' => $ppmp->id,
                        'user_id' => $user->id,
                        'role' => $user->role,
                        'field_name' => $fl ?: ucwords(str_replace(['att_', '_'], ['', ' '], $fk)),
                        'old_value' => (string)$oldHVal ?: '(empty)',
                        'new_value' => (string)$newValue ?: '(empty)',
                        'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                    ]);
                    $changeLogsCreated[] = $log;
                }
            }

            return ['type' => 'attachment', 'attachment_data' => $attData, 'logs' => $changeLogsCreated];
        }

        // 3. PPMP Category / Program Name & Account Code
        $isCombinedCategoryField = $fk === 'category' ||
            ($fk === 'program_name' && (str_contains((string)$newValue, '•') || str_contains(strtolower((string)$fl), 'account code')));

        if ($isCombinedCategoryField) {
            $parts = explode('•', (string)$newValue);
            if (count($parts) > 1) {
                $newProg = trim($parts[0]);
                $newAcct = trim($parts[1]);
            } else {
                // If single string, check whether it is an account code or program name
                if (preg_match('/[0-9]-[0-9]{2}-[0-9]{2}-[0-9]{3}/', (string)$newValue)) {
                    $newProg = '';
                    $newAcct = trim((string)$newValue);
                } else {
                    $newProg = trim((string)$newValue);
                    $newAcct = '';
                }
            }

            $oldDisplay = trim(($ppmp->program_name ?? '') . ($ppmp->account_code ? ' • ' . $ppmp->account_code : ''));
            $newDisplay = (string)$newValue;

            $updateData = [];
            if ($newProg !== '') {
                $updateData['program_name'] = $newProg;
                $prog = ProgramName::where('name', $newProg)->first();
                $updateData['program_name_id'] = $prog?->id;
            } elseif (count($parts) > 1 && $newProg === '') {
                $updateData['program_name'] = null;
                $updateData['program_name_id'] = null;
            }

            if ($newAcct !== '') {
                $updateData['account_code'] = $newAcct;
                if (preg_match('/[0-9]-[0-9]{2}-[0-9]{2}-[0-9]{3}/', $newAcct, $m)) {
                    $ac = AccountCode::where('code', $m[0])->first();
                    $updateData['account_code_id'] = $ac?->id;
                }
            } elseif (count($parts) > 1 && $newAcct === '') {
                $updateData['account_code'] = null;
                $updateData['account_code_id'] = null;
            }

            if (empty($updateData) && $newDisplay !== '') {
                $updateData['program_name'] = $newDisplay;
            }

            if (!empty($updateData)) {
                $ppmp->update($updateData);
            }

            if ($oldDisplay !== $newDisplay) {
                $log = PpmpChangeLog::create([
                    'ppmp_id' => $ppmp->id,
                    'user_id' => $user->id,
                    'role' => $user->role,
                    'field_name' => $fl ?: 'Category / Program Name & Account Code',
                    'old_value' => $oldDisplay ?: '(empty)',
                    'new_value' => $newDisplay ?: '(empty)',
                    'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                ]);
                $changeLogsCreated[] = $log;
            }

            return ['type' => 'category', 'ppmp' => $ppmp->fresh(['items']), 'logs' => $changeLogsCreated];
        }

        // 4. PPMP Header Field
        $ppmpFieldMap = [
            'title' => 'title',
            'ppmp_number' => 'ppmp_number',
            'source_of_fund' => 'source_of_fund',
            'account_code' => 'account_code',
            'fiscal_year' => 'fiscal_year',
            'plan_type' => 'plan_type',
            'implementing_unit' => 'implementing_unit',
            'program_name' => 'program_name',
            'delivery_period' => 'delivery_period',
            'place_of_delivery' => 'place_of_delivery',
            'payment_method' => 'payment_method',
            'warranty_and_other_terms' => 'warranty_and_other_terms',
            'additional_condition' => 'additional_condition',
        ];

        if (array_key_exists($fk, $ppmpFieldMap)) {
            $col = $ppmpFieldMap[$fk];
            $oldVal = $ppmp->{$col};
            $updatePayload = [$col => (string)$newValue];
            if ($col === 'account_code') {
                if (preg_match('/[0-9]-[0-9]{2}-[0-9]{2}-[0-9]{3}/', (string)$newValue, $m)) {
                    $ac = AccountCode::where('code', $m[0])->first();
                    if ($ac) $updatePayload['account_code_id'] = $ac->id;
                }
            } elseif ($col === 'program_name') {
                $prog = ProgramName::where('name', trim((string)$newValue))->first();
                if ($prog) $updatePayload['program_name_id'] = $prog->id;
            }
            $ppmp->update($updatePayload);

            $oldDisplay = $oldVal !== null && $oldVal !== '' ? (string)$oldVal : '(empty)';
            $newDisplay = (string)$newValue !== '' ? (string)$newValue : '(empty)';

            if ($oldDisplay !== $newDisplay) {
                $log = PpmpChangeLog::create([
                    'ppmp_id' => $ppmp->id,
                    'user_id' => $user->id,
                    'role' => $user->role,
                    'field_name' => $fl ?: ucwords(str_replace('_', ' ', $col)),
                    'old_value' => $oldDisplay,
                    'new_value' => $newDisplay,
                    'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                ]);
                $changeLogsCreated[] = $log;
            }

            return ['type' => 'header', 'ppmp' => $ppmp->fresh(), 'logs' => $changeLogsCreated];
        }

        return ['type' => 'unknown', 'logs' => $changeLogsCreated];
    }

    /**
     * Direct API endpoint to update a cell value on the PPMP and log changes.
     */
    public function updateCell(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        if (!$this->checkCanEditCell($ppmp, $user)) {
            return response()->json([
                'message' => "You do not have permission to modify cells on this PPMP in its current status: {$ppmp->status}."
            ], 403);
        }

        $validated = $request->validate([
            'field_key' => 'required|string',
            'field_label' => 'nullable|string',
            'value' => 'nullable',
            'item_id' => 'nullable|integer',
            'item_no' => 'nullable|integer',
        ]);

        $res = $this->applyCellUpdate(
            $ppmp,
            $user,
            $validated['field_key'],
            $validated['field_label'] ?? null,
            $validated['value'] ?? '',
            $validated['item_id'] ?? null,
            $validated['item_no'] ?? null
        );

        $freshPpmp = $ppmp->fresh([
            'office.head',
            'creator.office.head',
            'items',
            'signatures.user',
            'attachments',
            'routes',
            'changeLogs.user',
            'cellComments.reviewer',
            'cellComments.compliedByUser',
        ]);

        return response()->json([
            'message' => 'Cell updated successfully.',
            'ppmp' => $freshPpmp,
            'result' => $res,
        ]);
    }

    /**
     * End user marks a cell comment as complied.
     */
    public function comply(Request $request, string $uuid, int $commentId): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();
        $comment = PpmpCellComment::where('ppmp_id', $ppmp->id)->where('id', $commentId)->firstOrFail();

        $validated = $request->validate([
            'compliance_note' => 'nullable|string|max:1000',
            'updated_cell_value' => 'nullable',
        ]);

        // If updated_cell_value is provided, persist it to the cell and log audit trail
        if ($request->has('updated_cell_value') && $this->checkCanEditCell($ppmp, $user)) {
            $this->applyCellUpdate(
                $ppmp,
                $user,
                $comment->field_key,
                $comment->field_label,
                $request->input('updated_cell_value'),
                $comment->item_id,
                $comment->item_no
            );
        }

        $comment->update([
            'status' => 'complied',
            'compliance_note' => $validated['compliance_note'] ?? 'Complied and updated by End-User.',
            'complied_by' => $user->id,
            'complied_at' => now(),
        ]);

        $comment->load(['reviewer', 'compliedByUser']);

        $freshPpmp = $ppmp->fresh([
            'office.head',
            'creator.office.head',
            'items',
            'signatures.user',
            'attachments',
            'routes',
            'changeLogs.user',
            'cellComments.reviewer',
            'cellComments.compliedByUser',
        ]);

        return response()->json([
            'message' => 'Comment marked as complied.',
            'data' => $comment,
            'ppmp' => $freshPpmp,
            'pending_count' => $ppmp->cellComments()->where('status', 'pending')->count(),
        ]);
    }

    /**
     * Uncomply / Reopen a cell comment.
     */
    public function uncomply(Request $request, string $uuid, int $commentId): JsonResponse
    {
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();
        $comment = PpmpCellComment::where('ppmp_id', $ppmp->id)->where('id', $commentId)->firstOrFail();

        $comment->update([
            'status' => 'pending',
            'compliance_note' => null,
            'complied_by' => null,
            'complied_at' => null,
        ]);

        $comment->load(['reviewer', 'compliedByUser']);

        $freshPpmp = $ppmp->fresh([
            'office.head',
            'creator.office.head',
            'items',
            'signatures.user',
            'attachments',
            'routes',
            'changeLogs.user',
            'cellComments.reviewer',
            'cellComments.compliedByUser',
        ]);

        return response()->json([
            'message' => 'Comment reopened as pending compliance.',
            'data' => $comment,
            'ppmp' => $freshPpmp,
            'pending_count' => $ppmp->cellComments()->where('status', 'pending')->count(),
        ]);
    }
}

