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
use App\Support\ReviewHeadResolver;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PpmpCellCommentController extends Controller
{
    public const MAX_COMMENT_WORDS = 1000;

    protected function countWords(?string $text): int
    {
        $trimmed = trim((string) $text);
        if ($trimmed === '') {
            return 0;
        }
        $words = preg_split('/\s+/u', $trimmed, -1, PREG_SPLIT_NO_EMPTY);
        return is_array($words) ? count($words) : 0;
    }

    public function index(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        $isSuspended = str_ends_with($ppmp->status, '_RETURNED');
        $isReviewerOrAdmin = ($user && $user->hasAnyAssignedRole(['head', 'authorized_staff', 'budget_officer', 'pacco', 'oppmo', 'twg', 'admin', 'super_admin'])) || ($user && $user->isAdmin());

        $query = $ppmp->cellComments()
            ->with(['reviewer', 'compliedByUser'])
            ->orderBy('created_at', 'asc');

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

    public function store(Request $request, string $uuid): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();

        $allowedReviewerRoles = ['head', 'budget_officer', 'pacco', 'oppmo', 'twg', 'admin', 'super_admin'];
        if (!$user->hasAnyAssignedRole($allowedReviewerRoles) && !$user->isAdmin()) {
            return response()->json(['message' => 'Only authorized reviewers and administrators can add review comments.'], 403);
        }

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
                $headStage = ReviewHeadResolver::stageForStatus($ppmp->status);
                $expectedOfficeId = $headStage ? ReviewHeadResolver::resolveOfficeIdForStage($headStage, $ppmp) : null;
                if (!$expectedOfficeId || (int) $user->office_id !== $expectedOfficeId) {
                    return response()->json(['message' => 'Unauthorized. You may only comment on PPMPs from your assigned office.'], 403);
                }
            }
        }

        $rawCellValue = $request->input('cell_value');
        if ($rawCellValue !== null && !is_string($rawCellValue)) {
            $rawCellValue = is_scalar($rawCellValue) ? (string) $rawCellValue : json_encode($rawCellValue);
        }
        $rawItemNo = $request->input('item_no');
        $normalizedItemNo = ($rawItemNo !== null && $rawItemNo !== '' && is_numeric($rawItemNo))
            ? (int) $rawItemNo
            : null;
        $rawItemId = $request->input('item_id');
        $normalizedItemId = ($rawItemId !== null && $rawItemId !== '' && is_numeric($rawItemId) && PpmpItem::where('id', (int) $rawItemId)->exists())
            ? (int) $rawItemId
            : null;

        $request->merge([
            'item_id' => $normalizedItemId,
            'item_no' => $normalizedItemNo,
            'field_key' => Str::limit(trim((string) $request->input('field_key', '')), 60, ''),
            'field_label' => $request->filled('field_label')
                ? Str::limit(trim((string) $request->input('field_label')), 100, '')
                : null,
            'cell_value' => $rawCellValue,
        ]);

        $validated = $request->validate([
            'item_id' => 'nullable|integer',
            'item_no' => 'nullable|integer',
            'field_key' => 'required|string|max:60',
            'field_label' => 'nullable|string|max:100',
            'cell_value' => 'nullable|string',
            'comment' => [
                'required',
                'string',
                'min:1',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    $wordCount = $this->countWords(is_string($value) ? $value : (string) $value);
                    if ($wordCount > self::MAX_COMMENT_WORDS) {
                        $fail('The comment must not exceed ' . number_format(self::MAX_COMMENT_WORDS) . " words (currently {$wordCount} words).");
                    }
                },
            ],
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

    public function destroy(Request $request, string $uuid, int $commentId): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();
        $comment = PpmpCellComment::where('ppmp_id', $ppmp->id)->where('id', $commentId)->firstOrFail();

        if (!$user->isAdmin()) {
            return response()->json(['message' => 'Unauthorized. Only Admin and Super Admin can delete reviewer comments.'], 403);
        }

        $comment->delete();

        return response()->json(['message' => 'Review comment removed.']);
    }

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
            'BUDGET_HEAD_RETURNED',
            'PACCO_RETURNED',
            'PACCO_HEAD_RETURNED',
            'OPPMO_RETURNED',
            'OPPMO_HEAD_RETURNED',
            'TWG_RETURNED'
        ], true)) {
            return true;
        }

        $headStage = ReviewHeadResolver::stageForStatus($ppmp->status);
        $isReviewOfficeHead = $user->isHead() && $headStage && (int) $user->office_id === ReviewHeadResolver::resolveOfficeIdForStage($headStage, $ppmp);

        $isReviewer = (
            ($user->isHead() && in_array($ppmp->status, ['HEAD_PENDING', 'HEAD_APPROVED']) && $user->office_id === $ppmp->office_id) ||
            $isReviewOfficeHead ||
            ($user->isBudgetOfficer() && $ppmp->status === 'BUDGET_OFFICER_REVIEW' && (!$ppmp->budget_reviewer_id || $ppmp->budget_reviewer_id === $user->id)) ||
            ($user->isPacco() && $ppmp->status === 'PACCO_REVIEW' && (!$ppmp->budget_reviewer_id || $ppmp->budget_reviewer_id === $user->id)) ||
            ($user->isOppmo() && $ppmp->status === 'OPPMO_REVIEW' && (!$ppmp->oppmo_reviewer_id || $ppmp->oppmo_reviewer_id === $user->id)) ||
            ($user->isTwg() && $ppmp->status === 'TWG_REVIEW' && (!$ppmp->twg_reviewer_id || $ppmp->twg_reviewer_id === $user->id))
        );

        return (bool) $isReviewer;
    }

    protected function applyCellUpdate(Ppmp $ppmp, User $user, string $fieldKey, ?string $fieldLabel, mixed $newValue, ?int $itemId = null, ?int $itemNo = null): array
    {
        $changeLogsCreated = [];
        $fk = strtolower(trim($fieldKey));
        $fl = trim((string)$fieldLabel);

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

        if (str_starts_with($fk, 'att_')) {
            $attData = $ppmp->attachment_list_data;
            if (!is_array($attData)) {
                $attData = [];
            }

            $findMatchingListKeys = function (array $listsMap) use ($itemId, $itemNo): array {
                if (empty($listsMap)) return [];
                $matched = [];
                foreach ($listsMap as $k => $v) {
                    $kStr = (string) $k;
                    if ($itemId && ($kStr === (string) $itemId || str_contains($kStr, (string) $itemId))) {
                        $matched[] = $k;
                    } elseif ($itemNo && ($kStr === "item_{$itemNo}" || $kStr === (string) ($itemNo - 1))) {
                        $matched[] = $k;
                    }
                }
                if (empty($matched) && $itemNo && $itemNo > 0) {
                    $keys = array_keys($listsMap);
                    if (isset($keys[$itemNo - 1])) {
                        $matched[] = $keys[$itemNo - 1];
                    }
                }
                if (empty($matched) && count($listsMap) === 1) {
                    $matched[] = array_key_first($listsMap);
                }
                return array_values(array_unique($matched));
            };

            if (preg_match('/^att_r(\d+)_(.+)$/', $fk, $matches)) {
                $rowNum = (int) $matches[1];
                $subField = $matches[2];
                $targetKey = $subField === 'unit_cost' ? 'unitCost' : ($subField === 'item_no' ? 'itemNo' : ($subField === 'total_cost' ? 'totalCost' : $subField));

                $oldRVal = '';
                $updatedAny = false;

                if (isset($attData['attachment_lists']) && is_array($attData['attachment_lists'])) {
                    $matchedKeys = $findMatchingListKeys($attData['attachment_lists']);
                    foreach ($matchedKeys as $mKey) {
                        $listRows = $attData['attachment_lists'][$mKey]['rows'] ?? [];
                        $foundIdx = -1;
                        foreach ($listRows as $idx => $r) {
                            if (($r['itemNo'] ?? ($r['id'] ?? null)) == $rowNum) {
                                $foundIdx = $idx;
                                break;
                            }
                        }
                        if ($foundIdx === -1 && isset($listRows[$rowNum - 1])) {
                            $foundIdx = $rowNum - 1;
                        }
                        if ($foundIdx !== -1) {
                            $oldRVal = $listRows[$foundIdx][$targetKey] ?? '';
                            $listRows[$foundIdx][$targetKey] = (string) $newValue;

                            if (in_array($targetKey, ['qty', 'unitCost'], true)) {
                                $q = (float) ($listRows[$foundIdx]['qty'] ?? 0);
                                $c = (float) ($listRows[$foundIdx]['unitCost'] ?? 0);
                                $listRows[$foundIdx]['totalCost'] = ($q > 0 && $c > 0) ? (string) round($q * $c, 2) : '';
                            }

                            $attData['attachment_lists'][$mKey]['rows'] = $listRows;
                            $listTotal = 0.0;
                            foreach ($listRows as $lr) {
                                $listTotal += (float) ($lr['totalCost'] ?? 0);
                            }
                            if ($listTotal > 0) {
                                $attData['attachment_lists'][$mKey]['total_budget'] = round($listTotal, 2);
                            }
                            $updatedAny = true;
                        }
                    }
                }

                $rows = $attData['rows'] ?? [];
                if (is_array($rows) && !empty($rows) && (!$itemNo || $itemNo === 1 || empty($attData['attachment_lists']))) {
                    $foundIdx = -1;
                    foreach ($rows as $idx => $r) {
                        if (($r['itemNo'] ?? ($r['id'] ?? null)) == $rowNum) {
                            $foundIdx = $idx;
                            break;
                        }
                    }
                    if ($foundIdx === -1 && isset($rows[$rowNum - 1])) {
                        $foundIdx = $rowNum - 1;
                    }

                    if ($foundIdx !== -1) {
                        if ($oldRVal === '' && !$updatedAny) {
                            $oldRVal = $rows[$foundIdx][$targetKey] ?? '';
                        }
                        $rows[$foundIdx][$targetKey] = (string) $newValue;

                        if (in_array($targetKey, ['qty', 'unitCost'], true)) {
                            $q = (float) ($rows[$foundIdx]['qty'] ?? 0);
                            $c = (float) ($rows[$foundIdx]['unitCost'] ?? 0);
                            $rows[$foundIdx]['totalCost'] = ($q > 0 && $c > 0) ? (string) round($q * $c, 2) : '';
                        }

                        $attData['rows'] = $rows;
                        $updatedAny = true;
                    }
                }

                if ($updatedAny) {
                    $ppmp->update(['attachment_list_data' => $attData]);

                    if (trim((string) $oldRVal) !== trim((string) $newValue)) {
                        $specPrefix = $itemNo ? "Detailed Specifications #{$itemNo} • " : "Detailed Specifications • ";
                        $log = PpmpChangeLog::create([
                            'ppmp_id' => $ppmp->id,
                            'user_id' => $user->id,
                            'role' => $user->role,
                            'field_name' => "{$specPrefix}Row #{$rowNum} " . ucwords(str_replace('_', ' ', $subField)),
                            'old_value' => (string) $oldRVal !== '' ? (string) $oldRVal : '(empty)',
                            'new_value' => (string) $newValue !== '' ? (string) $newValue : '(empty)',
                            'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                        ]);
                        $changeLogsCreated[] = $log;
                    }
                }
            } elseif ($fk === 'att_fiscal_year') {
                $oldFy = $ppmp->fiscal_year ?? '';
                $cleanFy = preg_replace('/^CY\s*/i', '', trim((string) $newValue));
                $ppmp->update(['fiscal_year' => $cleanFy]);
                if ((string) $oldFy !== (string) $cleanFy) {
                    $changeLogsCreated[] = PpmpChangeLog::create([
                        'ppmp_id' => $ppmp->id,
                        'user_id' => $user->id,
                        'role' => $user->role,
                        'field_name' => $fl ?: 'Detailed Specifications • Fiscal Year',
                        'old_value' => (string) $oldFy ?: '(empty)',
                        'new_value' => (string) $cleanFy ?: '(empty)',
                        'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                    ]);
                }
            } else {
                $hdrMap = [
                    'att_office_name' => 'office_name',
                    'att_project_title' => 'project_title',
                    'att_charges' => 'charges',
                    'att_total_budget' => 'total_budget',
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
                    $valToStore = $hKey === 'total_budget'
                        ? (float) preg_replace('/[^0-9.]/', '', (string) $newValue)
                        : (string) $newValue;
                    $attData[$hKey] = $valToStore;

                    if (isset($attData['attachment_lists']) && is_array($attData['attachment_lists'])) {
                        $matchedKeys = $findMatchingListKeys($attData['attachment_lists']);
                        foreach ($matchedKeys as $mKey) {
                            if (isset($attData['attachment_lists'][$mKey][$hKey]) && $oldHVal === '') {
                                $oldHVal = $attData['attachment_lists'][$mKey][$hKey];
                            }
                            $attData['attachment_lists'][$mKey][$hKey] = $valToStore;
                        }
                    }

                    $ppmpUpdates = ['attachment_list_data' => $attData];
                    if (in_array($hKey, ['warranty_and_other_terms', 'additional_condition', 'place_of_delivery', 'payment_method', 'delivery_period'])) {
                        $ppmpUpdates[$hKey] = (string) $newValue;
                    }
                    $ppmp->update($ppmpUpdates);

                    if (trim((string)$oldHVal) !== trim((string)$newValue)) {
                        $log = PpmpChangeLog::create([
                            'ppmp_id' => $ppmp->id,
                            'user_id' => $user->id,
                            'role' => $user->role,
                            'field_name' => $fl ?: ucwords(str_replace(['att_', '_'], ['', ' '], $fk)),
                            'old_value' => (string)$oldHVal !== '' ? (string)$oldHVal : '(empty)',
                            'new_value' => (string)$newValue !== '' ? (string)$newValue : '(empty)',
                            'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                        ]);
                        $changeLogsCreated[] = $log;
                    }
                }
            }

            return ['type' => 'attachment', 'attachment_data' => $attData, 'ppmp' => $ppmp->fresh(['items']), 'logs' => $changeLogsCreated];
        }

        $isCombinedCategoryField = $fk === 'category' ||
            ($fk === 'program_name' && (str_contains((string)$newValue, '•') || str_contains(strtolower((string)$fl), 'account code')));

        if ($isCombinedCategoryField) {
            $parts = explode('•', (string)$newValue);
            if (count($parts) > 1) {
                $newProg = trim($parts[0]);
                $newAcct = trim($parts[1]);
            } else {

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

        $ppmpFieldMap = [
            'tracking_number' => 'tracking_number',
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
            if ($col === 'tracking_number') {
                $normalizedTracker = Ppmp::normalizeTrackingNumber((string) $newValue);
                if ($normalizedTracker === '') {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'tracking_number' => ['Tracker No. cannot be empty.'],
                    ]);
                }
                $familyIds = $ppmp->getFamilyIds();
                if (Ppmp::isTrackingNumberTaken($normalizedTracker, $familyIds)) {
                    throw \Illuminate\Validation\ValidationException::withMessages([
                        'tracking_number' => ["Tracker No. \"{$normalizedTracker}\" already exists. Duplicate tracker numbers are not allowed."],
                    ]);
                }
                $newValue = $normalizedTracker;
                $otherFamilyIds = array_values(array_diff($familyIds, [$ppmp->id]));
                if (!empty($otherFamilyIds)) {
                    Ppmp::whereIn('id', $otherFamilyIds)->update(['tracking_number' => $normalizedTracker]);
                }
                \App\Models\MonitoringProject::whereIn('ppmp_id', $familyIds)->update(['pr_number' => $normalizedTracker]);
                \App\Models\PurchaseRequest::whereIn('ppmp_id', $familyIds)->update(['tracker_id' => $normalizedTracker]);
                \App\Models\MonitoringProject::flushCache();
            }
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

        if (str_starts_with($fk, 'ms_')) {
            $scoping = \App\Models\PpmpMarketScoping::firstOrCreate(
                ['ppmp_id' => $ppmp->id],
                [
                    'procuring_entity' => 'PROVINCIAL GOVERNMENT OF DAVAO DEL SUR',
                    'implementing_unit' => $ppmp->implementing_unit ?: $ppmp->office?->name,
                    'project_name' => $ppmp->title,
                    'estimated_budget' => (float) ($ppmp->total_budget ?? 0),
                    'created_by' => $user->id,
                    'updated_by' => $user->id,
                ]
            );

            $headerMap = [
                'ms_procuring_entity' => 'procuring_entity',
                'ms_implementing_unit' => 'implementing_unit',
                'ms_representative' => 'representative_name_designation',
                'ms_project_name' => 'project_name',
                'ms_estimated_budget' => 'estimated_budget',
                'ms_expected_delivery' => 'expected_delivery_date',
                'ms_prepared_by_name' => 'prepared_by_name',
                'ms_prepared_by_position' => 'prepared_by_position',
                'ms_prepared_by_date' => 'prepared_by_date',
                'ms_approved_by_name' => 'approved_by_name',
                'ms_approved_by_position' => 'approved_by_position',
                'ms_approved_by_date' => 'approved_by_date',
            ];

            if (isset($headerMap[$fk])) {
                $col = $headerMap[$fk];
                $oldVal = (string) ($scoping->$col ?? '');
                $cleanVal = $col === 'estimated_budget'
                    ? (is_numeric(str_replace([',', '₱', ' '], '', (string) $newValue)) ? (float) str_replace([',', '₱', ' '], '', (string) $newValue) : $scoping->$col)
                    : trim((string) $newValue);
                $scoping->update([$col => $cleanVal, 'updated_by' => $user->id]);

                $changeLogsCreated[] = PpmpChangeLog::create([
                    'ppmp_id' => $ppmp->id,
                    'user_id' => $user->id,
                    'role' => $user->role,
                    'field_name' => $fl ?: 'Market Scoping Field',
                    'old_value' => $oldVal,
                    'new_value' => (string) $cleanVal,
                    'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                ]);
            } elseif ($fk === 'ms_scoping_period') {
                $oldVal = trim("{$scoping->scoping_period_from} - {$scoping->scoping_period_to}", ' -');
                $rawPeriod = trim((string) $newValue);
                if (preg_match('/from\s+([^\s]+)\s+to\s+([^\s]+)/i', $rawPeriod, $pm)) {
                    $fromPart = trim($pm[1], '_ ');
                    $toPart = trim($pm[2], '_ ');
                } else {
                    $parts = preg_split('/\s+(?:to|-)\s+/i', $rawPeriod, 2);
                    $fromPart = trim(preg_replace('/^from\s+/i', '', $parts[0] ?? ''), '_ ');
                    $toPart = trim($parts[1] ?? $fromPart, '_ ');
                }
                $scoping->update([
                    'scoping_period_from' => $fromPart,
                    'scoping_period_to' => $toPart,
                    'updated_by' => $user->id,
                ]);
                $changeLogsCreated[] = PpmpChangeLog::create([
                    'ppmp_id' => $ppmp->id,
                    'user_id' => $user->id,
                    'role' => $user->role,
                    'field_name' => $fl ?: 'Period of Market Scoping',
                    'old_value' => $oldVal ?: '(empty)',
                    'new_value' => $rawPeriod ?: '(empty)',
                    'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                ]);
            } elseif (preg_match('/^ms_activity_([a-z0-9_]+?)(?:_(custom_text|documentation))?$/', $fk, $am)) {
                $actCode = $am[1];
                $actSub = $am[2] ?? 'is_checked';
                $actRow = \App\Models\PpmpMarketScopingActivity::firstOrCreate(
                    ['market_scoping_id' => $scoping->id, 'activity_code' => $actCode],
                    ['is_checked' => false]
                );

                if ($actSub === 'custom_text') {
                    $oldVal = (string) ($actRow->custom_activity_text ?? '');
                    $cleanText = trim((string) $newValue);
                    $updates = ['custom_activity_text' => $cleanText];
                    if ($cleanText !== '') {
                        $updates['is_checked'] = true;
                    }
                    $actRow->update($updates);
                    $newDisplay = $cleanText;
                } elseif ($actSub === 'documentation') {
                    $oldVal = (string) ($actRow->documentation_notes ?? '');
                    $cleanDoc = trim((string) $newValue);
                    $actRow->update(['documentation_notes' => $cleanDoc]);
                    $newDisplay = $cleanDoc;
                } else {
                    $oldVal = $actRow->is_checked ? 'Checked' : 'Unchecked';
                    $parsedJson = is_string($newValue) && str_starts_with(trim($newValue), '{')
                        ? json_decode($newValue, true)
                        : (is_array($newValue) ? $newValue : null);

                    if (is_array($parsedJson)) {
                        $isChecked = in_array(strtoupper(trim((string) ($parsedJson['is_checked'] ?? ''))), ['CHECKED', 'YES', '1', 'TRUE'], true) || ($parsedJson['is_checked'] ?? false) === true;
                        $updates = ['is_checked' => $isChecked];
                        if (array_key_exists('custom_activity_text', $parsedJson)) {
                            $updates['custom_activity_text'] = trim((string) $parsedJson['custom_activity_text']);
                        }
                        if (array_key_exists('documentation_notes', $parsedJson)) {
                            $updates['documentation_notes'] = trim((string) $parsedJson['documentation_notes']);
                        }
                        $actRow->update($updates);
                        $newDisplay = $isChecked ? 'Checked' : 'Unchecked';
                    } else {
                        $norm = strtoupper(trim((string) $newValue));
                        $isChecked = in_array($norm, ['CHECKED', 'YES', '1', 'TRUE', '✓'], true) || $newValue === true;
                        $actRow->update(['is_checked' => $isChecked]);
                        $newDisplay = $isChecked ? 'Checked' : 'Unchecked';
                    }
                }

                $scoping->update(['updated_by' => $user->id]);

                if ($oldVal !== $newDisplay) {
                    $changeLogsCreated[] = PpmpChangeLog::create([
                        'ppmp_id' => $ppmp->id,
                        'user_id' => $user->id,
                        'role' => $user->role,
                        'field_name' => $fl ?: "Market Scoping Activity ({$actCode})",
                        'old_value' => $oldVal !== '' ? $oldVal : '(empty)',
                        'new_value' => $newDisplay !== '' ? $newDisplay : '(empty)',
                        'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                    ]);
                }
            } elseif (preg_match('/^ms_result_([a-z_]+)_(considered|recommendations)$/', $fk, $m)) {
                $paramCode = $m[1];
                $subCol = $m[2];
                $resultRow = \App\Models\PpmpMarketScopingResult::firstOrCreate(
                    ['market_scoping_id' => $scoping->id, 'parameter_code' => $paramCode]
                );
                $oldVal = (string) ($resultRow->$subCol ?? '');
                $resultRow->update([$subCol => trim((string) $newValue)]);
                $changeLogsCreated[] = PpmpChangeLog::create([
                    'ppmp_id' => $ppmp->id,
                    'user_id' => $user->id,
                    'role' => $user->role,
                    'field_name' => $fl ?: "Market Scoping ({$paramCode})",
                    'old_value' => $oldVal,
                    'new_value' => trim((string) $newValue),
                    'action' => $user->isEndUser() ? 'end_user_edit' : 'reviewer_edit',
                ]);
            }

            return ['type' => 'market_scoping', 'ppmp' => $ppmp->fresh(['marketScoping.activities', 'marketScoping.results']), 'logs' => $changeLogsCreated];
        }

        return ['type' => 'unknown', 'logs' => $changeLogsCreated];
    }

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
            'marketScoping.activities',
            'marketScoping.results',
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

    public function comply(Request $request, string $uuid, int $commentId): JsonResponse
    {
        $user = $request->user();
        $ppmp = Ppmp::where('uuid', $uuid)->firstOrFail();
        $comment = PpmpCellComment::where('ppmp_id', $ppmp->id)->where('id', $commentId)->firstOrFail();

        $rawComplianceNote = $request->input('compliance_note');
        if ($rawComplianceNote !== null && !is_string($rawComplianceNote)) {
            $request->merge([
                'compliance_note' => is_scalar($rawComplianceNote) ? (string) $rawComplianceNote : json_encode($rawComplianceNote),
            ]);
        }

        $validated = $request->validate([
            'compliance_note' => [
                'nullable',
                'string',
                function (string $attribute, mixed $value, \Closure $fail): void {
                    if ($value === null) {
                        return;
                    }
                    $wordCount = $this->countWords(is_string($value) ? $value : (string) $value);
                    if ($wordCount > self::MAX_COMMENT_WORDS) {
                        $fail('The compliance note must not exceed ' . number_format(self::MAX_COMMENT_WORDS) . " words (currently {$wordCount} words).");
                    }
                },
            ],
            'updated_cell_value' => 'nullable',
        ]);

        if ($request->has('updated_cell_value')) {
            if (!$this->checkCanEditCell($ppmp, $user)) {
                return response()->json([
                    'message' => "You do not have permission to modify cells on this PPMP in its current status: {$ppmp->status}.",
                ], 403);
            }
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
            'marketScoping.activities',
            'marketScoping.results',
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
            'marketScoping.activities',
            'marketScoping.results',
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
