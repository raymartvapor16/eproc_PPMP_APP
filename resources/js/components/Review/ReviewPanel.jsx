import React, { useState } from 'react';
import { ppmpService } from '../../services/api';
import { isAwaitingReceive } from '../../utils/workflowHelpers';
import { showConfirm } from '../../utils/modalAlert';
import { CheckCircle2, RotateCcw, Edit3, AlertCircle, Maximize2, Inbox, Loader2 } from 'lucide-react';

export const ReviewPanel = ({
    ppmp,
    user = null,
    userRole,
    onActionCompleted,
    onReceiveDocument = null,
    isReceiving = false,
    isUpdatingAllowed = true,
    onEdit = null,
    onOpenItemsModal = null,
    onOpenApp = null,
    cellComments = [],
}) => {
    const [actionLoading, setActionLoading] = useState(false);
    const [showRemarksModal, setShowRemarksModal] = useState(false);
    const [remarks, setRemarks] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const pendingCellComments = React.useMemo(() => {
        return (cellComments || []).filter(c => c.status === 'pending');
    }, [cellComments]);

    const buildCellCommentsSummary = () => {
        if (!pendingCellComments || pendingCellComments.length === 0) return '';
        return pendingCellComments.map(c => {
            const itemLabel = c.item_no ? `[Item #${c.item_no} — ${c.field_label || c.field_key}]` : `[${c.field_label || c.field_key}]`;
            return `${itemLabel}: ${c.comment}`;
        }).join('\n\n');
    };

    const handleOpenRemarksModal = () => {
        if (!remarks.trim() && pendingCellComments.length > 0) {
            setRemarks(buildCellCommentsSummary());
        }
        setShowRemarksModal(true);
    };

    // Field-level correction state
    const [fieldModifications, setFieldModifications] = useState([]);
    const [returnTarget, setReturnTarget] = useState('end_user');

    // Determine target reviewer role for current PPMP status
    const targetStageRole = (
        ppmp.status === 'HEAD_PENDING' ? 'head' :
        ppmp.status === 'BUDGET_OFFICER_REVIEW' ? 'budget_officer' :
        ppmp.status === 'PACCO_REVIEW' ? 'pacco' :
        ppmp.status === 'OPPMO_REVIEW' ? 'oppmo' :
        ppmp.status === 'TWG_REVIEW' ? 'twg' : null
    );

    const isAdmin = ['admin', 'super_admin'].includes(userRole) || ['admin', 'super_admin'].includes(user?.role);
    let effectiveRole = isAdmin && targetStageRole ? targetStageRole : userRole;
    if (effectiveRole === 'authorized_staff') {
        effectiveRole = 'head';
    }

    const isAssignedReviewer = Boolean(
        isAdmin ||
        (userRole === 'twg' && (!ppmp.twg_reviewer_id || ppmp.twg_reviewer_id === user?.id)) ||
        ((userRole === 'budget_officer' || userRole === 'pacco') && (!ppmp.budget_reviewer_id || ppmp.budget_reviewer_id === user?.id)) ||
        (userRole === 'oppmo' && (!ppmp.oppmo_reviewer_id || ppmp.oppmo_reviewer_id === user?.id)) ||
        ((userRole === 'head' || userRole === 'authorized_staff') && (user?.office_id === ppmp.office_id || !ppmp.office_id))
    );

    const isUnassignedReviewerForCurrentStage = Boolean(
        !isAdmin && targetStageRole && (
            (userRole === 'twg' && ppmp.status === 'TWG_REVIEW' && ppmp.twg_reviewer_id && ppmp.twg_reviewer_id !== user?.id) ||
            (userRole === 'budget_officer' && ppmp.status === 'BUDGET_OFFICER_REVIEW' && ppmp.budget_reviewer_id && ppmp.budget_reviewer_id !== user?.id) ||
            (userRole === 'pacco' && ppmp.status === 'PACCO_REVIEW' && ppmp.budget_reviewer_id && ppmp.budget_reviewer_id !== user?.id) ||
            (userRole === 'oppmo' && ppmp.status === 'OPPMO_REVIEW' && ppmp.oppmo_reviewer_id && ppmp.oppmo_reviewer_id !== user?.id)
        )
    );

    const currentStageAssignedName = (
        ppmp.status === 'TWG_REVIEW' ? (ppmp.twg_reviewer?.name || ppmp.twgReviewer?.name) :
        (ppmp.status === 'BUDGET_OFFICER_REVIEW' || ppmp.status === 'PACCO_REVIEW') ? (ppmp.budget_reviewer?.name || ppmp.budgetReviewer?.name) :
        ppmp.status === 'OPPMO_REVIEW' ? (ppmp.oppmo_reviewer?.name || ppmp.oppmoReviewer?.name) : null
    );

    const canReview = Boolean(
        targetStageRole && isAssignedReviewer && (
            ((userRole === 'head' || userRole === 'authorized_staff') && ppmp.status === 'HEAD_PENDING' && (user?.office_id === ppmp.office_id || !ppmp.office_id)) ||
            (userRole === 'budget_officer' && ppmp.status === 'BUDGET_OFFICER_REVIEW') ||
            (userRole === 'pacco' && ppmp.status === 'PACCO_REVIEW') ||
            (userRole === 'oppmo' && ppmp.status === 'OPPMO_REVIEW') ||
            (userRole === 'twg' && ppmp.status === 'TWG_REVIEW') ||
            isAdmin
        )
    );

    const isTrustFund = Boolean(
        (ppmp?.source_of_fund && ppmp.source_of_fund.toLowerCase().includes('trust')) ||
        ppmp?.items?.some(i => i.source_of_fund && i.source_of_fund.toLowerCase().includes('trust'))
    );

    // Compute available return destinations based on current status and assigned reviewers
    const returnDestinations = React.useMemo(() => {
        const list = [
            {
                id: 'end_user',
                label: `End User (Preparer) — ${ppmp.creator?.name || 'Preparer'}`,
                subLabel: 'Return document to End User to correct errors, comply with cell comments, or re-upload scoping PDFs.',
                badge: 'Preparer',
                badgeColor: 'bg-slate-100 text-slate-700 border-slate-300',
            }
        ];

        // If at Budget/PACCO review or OPPMO review or Admin: can return to BAC-TWG reviewer
        if (['BUDGET_OFFICER_REVIEW', 'PACCO_REVIEW', 'OPPMO_REVIEW'].includes(ppmp.status) || isAdmin) {
            const twgName = ppmp.twg_reviewer?.name || ppmp.twgReviewer?.name || (ppmp.twg_reviewer_id ? `Assigned TWG (#${ppmp.twg_reviewer_id})` : 'Assigned BAC-TWG Reviewer');
            list.push({
                id: 'twg',
                label: `BAC-TWG Reviewer — ${twgName}`,
                subLabel: 'Return to Technical Working Group (TWG) reviewer for specification correction or technical re-evaluation.',
                badge: '1st Reviewer (TWG)',
                badgeColor: 'bg-purple-100 text-purple-800 border-purple-300',
            });
        }

        // If at OPPMO review or Admin: can return to Budget Officer / PACCO
        if (ppmp.status === 'OPPMO_REVIEW' || isAdmin) {
            const budgetRoleLabel = isTrustFund ? 'PACCO Reviewer' : 'Budget Officer';
            const budgetName = ppmp.budget_reviewer?.name || ppmp.budgetReviewer?.name || (ppmp.budget_reviewer_id ? `Assigned Reviewer (#${ppmp.budget_reviewer_id})` : `Assigned ${budgetRoleLabel}`);
            list.push({
                id: isTrustFund ? 'pacco' : 'budget',
                label: `${budgetRoleLabel} — ${budgetName}`,
                subLabel: `Return to ${budgetRoleLabel} for budgetary certification or funding allocation re-evaluation.`,
                badge: '2nd Reviewer (Budget)',
                badgeColor: 'bg-blue-100 text-blue-800 border-blue-300',
            });
        }

        return list;
    }, [ppmp, isAdmin, isTrustFund]);

    // Check if document requires receiving before acting
    const awaitingReceive = user ? isAwaitingReceive(ppmp, user) : false;

    const isTwgSkipped = Boolean(
        (ppmp?.amendment_type === 'AMENDMENT' || ppmp?.amendment?.amendment_type === 'AMENDMENT') &&
        (ppmp?.amendment_scope === 'PPMP_APP' || ppmp?.amendment?.amendment_scope === 'PPMP_APP')
    );
    const isPostTwg = Boolean(isTwgSkipped || ppmp?.twg_approved_at || ppmp?.signatures?.some(s => s.role === 'twg'));
    const isOppmoReviewer = effectiveRole === 'oppmo';
    const hasApp = Boolean(
        !ppmp?.app_data?.needs_regeneration && (
            ppmp?.app_data?.is_generated ||
            (Array.isArray(ppmp?.app_data?.rows) && ppmp?.app_data?.rows.length > 0)
        )
    );
    const needsAppGeneration = isOppmoReviewer && ppmp?.status === 'OPPMO_REVIEW' && !hasApp;

    const handleApprove = async () => {
        let confirmText = 'Are you sure you want to APPROVE this PPMP?';
        if (effectiveRole === 'head') {
            confirmText = 'Are you sure you want to approve this PPMP? Official electronic signature indicator will be generated and this PPMP will be finalized and marked READY TO PRINT.';
        } else if (effectiveRole === 'budget_officer') {
            confirmText = 'Are you sure you want to certify budgetary requirements? Initial indicator will be affixed and this PPMP will automatically route to OPPMO for APP generation and final review.';
        } else if (effectiveRole === 'pacco') {
            confirmText = 'Are you sure you want to certify trust fund requirements? Initial indicator will be affixed and this PPMP will automatically route to OPPMO for APP generation and final review.';
        } else if (effectiveRole === 'oppmo') {
            if (!hasApp) {
                alert('Annual Procurement Plan (APP) Required:\n\nPlease generate or regenerate the Annual Procurement Plan (APP) using the "Generate APP Now" button before approving.');
                return;
            }
            confirmText = 'Are you sure you want to approve this PPMP? The generated Annual Procurement Plan (APP) will be approved and this PPMP will be finalized and marked READY TO PRINT.';
        } else if (effectiveRole === 'twg') {
            const isTrustFund = Boolean(
                (ppmp?.source_of_fund && ppmp.source_of_fund.toLowerCase().includes('trust')) ||
                ppmp?.items?.some(i => i.source_of_fund && i.source_of_fund.toLowerCase().includes('trust'))
            );
            const isScopeAttachmentOnly = ppmp?.amendment_scope === 'ATTACHMENT_LIST';
            confirmText = isScopeAttachmentOnly
                ? 'Are you sure you want to approve this PPMP? The updated Detailed Specifications will be approved and marked READY TO PRINT.'
                : (isTrustFund
                    ? 'Are you sure you want to approve this PPMP? BAC-TWG technical review will be certified and this PPMP will automatically route to PACCO for trust fund certification.'
                    : 'Are you sure you want to approve this PPMP? BAC-TWG technical review will be certified and this PPMP will automatically route to the Provincial Budget Office for budget certification.');
        }

        const confirmed = await showConfirm({
            title: 'Confirm PPMP Approval',
            message: confirmText,
            confirmText: 'Yes, Approve PPMP',
            cancelText: 'Cancel',
            type: 'success',
        });
        if (!confirmed) return;

        setActionLoading(true);
        setErrorMessage('');

        try {
            if (effectiveRole === 'head') {
                await ppmpService.headApprove(ppmp.uuid);
            } else if (effectiveRole === 'budget_officer') {
                await ppmpService.budgetApprove(ppmp.uuid);
            } else if (effectiveRole === 'pacco') {
                await ppmpService.paccoApprove(ppmp.uuid);
            } else if (effectiveRole === 'oppmo') {
                await ppmpService.oppmoApprove(ppmp.uuid);
            } else if (effectiveRole === 'twg') {
                await ppmpService.twgApprove(ppmp.uuid);
            }

            if (onActionCompleted) onActionCompleted();
            window.dispatchEvent(new CustomEvent('notifications:reload'));
        } catch (err) {
            setErrorMessage(err.response?.data?.message || 'Approval action failed.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleReturnSubmit = async (e) => {
        e.preventDefault();

        if (!remarks.trim()) {
            alert('A non-empty remark explaining why this PPMP is being returned is mandatory.');
            return;
        }

        setActionLoading(true);
        setErrorMessage('');

        try {
            const payload = {
                target: returnTarget,
                return_target: returnTarget,
                remarks: remarks.trim(),
                field_changes: fieldModifications,
            };

            if (effectiveRole === 'head') {
                await ppmpService.headReturn(ppmp.uuid, { remarks: remarks.trim() });
            } else {
                await ppmpService.returnReview(ppmp.uuid, payload);
            }

            setShowRemarksModal(false);
            setRemarks('');
            setReturnTarget('end_user');
            if (onActionCompleted) onActionCompleted();
            window.dispatchEvent(new CustomEvent('notifications:reload'));
        } catch (err) {
            setErrorMessage(err.response?.data?.message || 'Return action failed.');
        } finally {
            setActionLoading(false);
        }
    };

    if (!canReview) {
        if (isUnassignedReviewerForCurrentStage) {
            return (
                <div className="bg-amber-50/90 border border-amber-200 rounded-lg p-4 text-xs text-amber-900 shadow-2xs">
                    <div className="flex items-center gap-2 font-bold mb-1 text-amber-950">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        <span>Review Actions Assigned to Another Specialist</span>
                    </div>
                    <p className="leading-relaxed">
                        This PPMP is currently assigned to <strong className="font-semibold underline">{currentStageAssignedName || 'another designated reviewer'}</strong> for this review stage.
                        Only the selected reviewer (or Administrator) can receive, edit, comment, or approve this PPMP.
                    </p>
                </div>
            );
        }

        return (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs text-slate-500 italic">
                You do not have active review actions for this PPMP in its current workflow state ({ppmp.status}).
            </div>
        );
    }

    return (
        <div className="bg-white border-2 border-indigo-200 rounded-lg shadow-md p-5">
            <div className="flex items-center gap-2 pb-3 border-b border-indigo-100 mb-4">
                <Edit3 className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold text-sm text-indigo-950 uppercase tracking-wide">
                    Reviewer Action Center ({effectiveRole.toUpperCase().replace(/_/g, ' ')}{isAdmin ? ' - ADMIN MODE' : ''})
                </h3>
            </div>

            {errorMessage && (
                <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded text-xs text-rose-700 font-medium">
                    <p>{errorMessage}</p>
                    {(errorMessage.toLowerCase().includes('annual procurement plan') || errorMessage.toLowerCase().includes('app')) && onOpenApp && (
                        <div className="mt-2.5 pt-2 border-t border-rose-200 flex justify-end">
                            <button
                                type="button"
                                onClick={onOpenApp}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-bold uppercase tracking-wider transition shadow-2xs cursor-pointer"
                            >
                                <span>Generate Annual Procurement Plan (APP) Now</span>
                            </button>
                        </div>
                    )}
                </div>
            )}

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
                Please examine all PPMP items, estimated budgets, schedule timelines, and attached PDF requirement documents before executing an official decision.
            </p>

            {awaitingReceive ? (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4 text-center">
                    <div className="flex items-center justify-center gap-1.5 text-amber-900 font-bold text-xs mb-1.5">
                        <Inbox className="w-4 h-4 text-amber-600" />
                        Awaiting Official Document Receipt
                    </div>
                    <p className="text-[11px] text-amber-800 mb-3 leading-relaxed">
                        You must officially receive this document before performing approval or update/remarks.
                    </p>
                    {onReceiveDocument && (
                        <button
                            type="button"
                            disabled={isReceiving}
                            onClick={onReceiveDocument}
                            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold uppercase tracking-wider shadow-sm transition disabled:opacity-50 cursor-pointer"
                        >
                            {isReceiving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Receiving Document...</span>
                                </>
                            ) : (
                                <>
                                    <Inbox className="w-4 h-4" />
                                    <span>Receive Document</span>
                                </>
                            )}
                        </button>
                    )}
                </div>
            ) : (
                <>
                    {needsAppGeneration && (
                        <div className="mb-3 p-3 bg-amber-50 border border-amber-300 rounded-lg text-amber-900 text-xs">
                            <p className="font-bold flex items-center gap-1.5 text-amber-800">
                                <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
                                Annual Procurement Plan (APP) Generation Required
                            </p>
                            <p className="mt-1 text-[11px] text-amber-700 leading-relaxed">
                                {ppmp?.parent_id || ppmp?.amendment_type ? (
                                    <>Changes were made on this amended/supplemental PPMP. As OPPMO Reviewer, you must generate or regenerate the updated APP using the <strong>Generate APP Now</strong> button before granting final approval. The previous APP is safely preserved.</>
                                ) : (
                                    <>Budget certification is complete. As OPPMO Reviewer, you must generate or regenerate the official APP using the <strong>Generate APP Now</strong> button before granting final approval to make this PPMP Ready to Print.</>
                                )}
                            </p>
                            {onOpenApp && (
                                <button
                                    type="button"
                                    onClick={onOpenApp}
                                    className="mt-2.5 inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded text-xs font-bold uppercase tracking-wider transition shadow-2xs cursor-pointer"
                                    title="Open and generate Annual Procurement Plan"
                                >
                                    <span>Generate APP Now</span>
                                </button>
                            )}
                        </div>
                    )}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                    <button
                        type="button"
                        disabled={actionLoading}
                        onClick={handleApprove}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-xs font-bold uppercase tracking-wider shadow-sm transition disabled:opacity-50 cursor-pointer"
                    >
                        {actionLoading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span>APPROVING...</span>
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="w-4 h-4" />
                                <span>APPROVE</span>
                            </>
                        )}
                    </button>

                    <button
                        type="button"
                        disabled={actionLoading}
                        onClick={handleOpenRemarksModal}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-bold uppercase tracking-wider shadow-sm transition disabled:opacity-50 cursor-pointer"
                    >
                        <RotateCcw className="w-4 h-4" />
                        <span>Suspend / REMARKS</span>
                        {pendingCellComments.length > 0 && (
                            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-white text-rose-700 text-[10px] font-black shadow-xs">
                                {pendingCellComments.length}
                            </span>
                        )}
                    </button>
                </div>
                </>
            )}

            <div className="space-y-2">
                {onEdit && (
                    <button
                        type="button"
                        onClick={onEdit}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-300 rounded-md text-xs font-bold uppercase tracking-wider transition shadow-2xs cursor-pointer"
                    >
                        <Edit3 className="w-4 h-4" />
                        EDIT PPMP FIELDS / ITEMS
                    </button>
                )}
            </div>

            {/* Modal for UPDATE / REMARKS */}
            {showRemarksModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center gap-2 text-rose-600 font-bold text-base mb-2">
                            <AlertCircle className="w-5 h-5" />
                            <span>Return PPMP with Mandatory Remarks</span>
                        </div>
                        <p className="text-xs text-slate-600 mb-4">
                            Select who you are returning this PPMP to. A specific remark detailing why it should return for correction or re-evaluation is required.
                        </p>

                        <form onSubmit={handleReturnSubmit}>
                            {/* Destination Selection if multiple destinations available */}
                            {returnDestinations.length > 1 && (
                                <div className="mb-4">
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1.5">
                                        Return Destination: <span className="text-rose-600">*</span>
                                    </label>
                                    <div className="space-y-2">
                                        {returnDestinations.map((dest) => {
                                            const isSelected = returnTarget === dest.id;
                                            return (
                                                <div
                                                    key={dest.id}
                                                    onClick={() => setReturnTarget(dest.id)}
                                                    className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                                                        isSelected
                                                            ? 'border-rose-500 bg-rose-50/50 shadow-xs'
                                                            : 'border-slate-200 hover:border-slate-300 bg-white'
                                                    }`}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-2">
                                                            <input
                                                                type="radio"
                                                                name="return_destination"
                                                                checked={isSelected}
                                                                onChange={() => setReturnTarget(dest.id)}
                                                                className="text-rose-600 focus:ring-rose-500 cursor-pointer"
                                                            />
                                                            <span className="font-bold text-xs text-slate-800">
                                                                {dest.label}
                                                            </span>
                                                        </div>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${dest.badgeColor}`}>
                                                            {dest.badge}
                                                        </span>
                                                    </div>
                                                    <p className="text-[11px] text-slate-500 mt-1 pl-5">
                                                        {dest.subLabel}
                                                    </p>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {pendingCellComments.length > 0 && (
                                <div className="mb-4 p-3 bg-amber-50/90 border border-amber-200 rounded-lg text-xs">
                                    <div className="flex items-center justify-between font-bold text-amber-900 mb-1">
                                        <span className="flex items-center gap-1.5">
                                            <span>💬</span>
                                            <span>{pendingCellComments.length} Cell Comment{pendingCellComments.length > 1 ? 's' : ''} Attached</span>
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setRemarks(buildCellCommentsSummary())}
                                            className="text-[11px] font-bold text-amber-800 underline hover:text-amber-950 cursor-pointer"
                                        >
                                            Reset to Cell Comments
                                        </button>
                                    </div>
                                    <p className="text-[11px] text-amber-800 leading-relaxed">
                                        These cell comments will serve as the audit suspension remarks.
                                    </p>
                                </div>
                            )}

                            <div className="mb-4">
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    {returnTarget === 'end_user'
                                        ? 'Reviewer Findings & Required Corrections:'
                                        : `Remarks / Reason for Returning to ${returnDestinations.find(d => d.id === returnTarget)?.badge || 'Reviewer'}:`}
                                    <span className="text-rose-600"> *</span>
                                </label>
                                <textarea
                                    required
                                    rows={4}
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    placeholder={
                                        returnTarget === 'end_user'
                                            ? 'Explain the required corrections, modifications, or compliance items needed from the preparer...'
                                            : 'Explain why this PPMP is being returned to this reviewer (e.g., technical specification mismatch, account code discrepancy, budget adjustment)...'
                                    }
                                    className="w-full text-xs p-3 border border-slate-300 rounded-md focus:ring-2 focus:ring-rose-500 focus:outline-none"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setShowRemarksModal(false)}
                                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={actionLoading}
                                    className="px-5 py-2 text-xs font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white rounded-md shadow-sm transition disabled:opacity-50 cursor-pointer"
                                >
                                    {actionLoading ? 'Processing...' : (
                                        returnTarget === 'end_user'
                                            ? 'Submit Remarks & Return to End User'
                                            : `Submit Remarks & Return to ${returnDestinations.find(d => d.id === returnTarget)?.badge || 'Reviewer'}`
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
