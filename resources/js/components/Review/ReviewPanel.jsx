import React, { useState } from 'react';
import { ppmpService } from '../../services/api';
import { isAwaitingReceive } from '../../utils/workflowHelpers';
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
}) => {
    const [actionLoading, setActionLoading] = useState(false);
    const [showRemarksModal, setShowRemarksModal] = useState(false);
    const [remarks, setRemarks] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    // Field-level correction state
    const [fieldModifications, setFieldModifications] = useState([]);

    // Check if document requires receiving before acting
    const awaitingReceive = user ? isAwaitingReceive(ppmp, user) : false;

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

    const canReview = Boolean(
        targetStageRole && (
            ((userRole === 'head' || userRole === 'authorized_staff') && ppmp.status === 'HEAD_PENDING' && (user?.office_id === ppmp.office_id || !ppmp.office_id)) ||
            (userRole === 'budget_officer' && ppmp.status === 'BUDGET_OFFICER_REVIEW') ||
            (userRole === 'pacco' && ppmp.status === 'PACCO_REVIEW') ||
            (userRole === 'oppmo' && ppmp.status === 'OPPMO_REVIEW') ||
            (userRole === 'twg' && ppmp.status === 'TWG_REVIEW') ||
            isAdmin
        )
    );

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
    const needsAppGeneration = isOppmoReviewer && isPostTwg && !hasApp;

    const handleApprove = async () => {
        let confirmText = 'Are you sure you want to APPROVE this PPMP?';
        if (effectiveRole === 'head') {
            confirmText = 'Are you sure you want to approve this PPMP? Official electronic signature indicator will be generated and this PPMP will be finalized and marked READY TO PRINT.';
        } else if (effectiveRole === 'budget_officer') {
            confirmText = 'Are you sure you want to certify budgetary requirements? Initial indicator will be affixed and this PPMP will automatically route to OPPMO.';
        } else if (effectiveRole === 'pacco') {
            confirmText = 'Are you sure you want to certify trust fund requirements? Initial indicator will be affixed and this PPMP will automatically route to OPPMO.';
        } else if (effectiveRole === 'oppmo') {
            if (isPostTwg) {
                if (!hasApp) {
                    alert('Annual Procurement Plan (APP) Required:\n\nPlease generate the Annual Procurement Plan (APP) using the "Generate APP Now" button before forwarding this PPMP to the Office Head.');
                    return;
                }
                confirmText = isTwgSkipped
                    ? 'Are you sure you want to approve this PPMP? BAC-TWG technical review is bypassed for this PPMP/APP amendment. The generated Annual Procurement Plan (APP) will be forwarded directly to the Office Head for final approval.'
                    : 'Are you sure you want to approve this PPMP? The generated Annual Procurement Plan (APP) will be forwarded to the Office Head for final approval.';
            } else {
                confirmText = 'Are you sure you want to approve this PPMP? Initial indicator will be affixed and this PPMP will automatically route to BAC-TWG for technical review.';
            }
        } else if (effectiveRole === 'twg') {
            confirmText = 'Are you sure you want to approve this PPMP? BAC-TWG technical review will be certified and this PPMP will route back to OPPMO to generate the Annual Procurement Plan (APP).';
        }

        if (!window.confirm(confirmText)) return;

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
            alert('A non-empty remark explaining the required correction is mandatory.');
            return;
        }

        setActionLoading(true);
        setErrorMessage('');

        try {
            const payload = {
                remarks: remarks.trim(),
                field_changes: fieldModifications,
            };

            if (effectiveRole === 'head') {
                await ppmpService.headReturn(ppmp.uuid, { remarks: remarks.trim() });
            } else if (effectiveRole === 'budget_officer') {
                await ppmpService.budgetReturn(ppmp.uuid, payload);
            } else if (effectiveRole === 'pacco') {
                await ppmpService.paccoReturn(ppmp.uuid, payload);
            } else if (effectiveRole === 'oppmo') {
                await ppmpService.oppmoReturn(ppmp.uuid, payload);
            } else if (effectiveRole === 'twg') {
                await ppmpService.twgReturn(ppmp.uuid, payload);
            }

            setShowRemarksModal(false);
            setRemarks('');
            if (onActionCompleted) onActionCompleted();
            window.dispatchEvent(new CustomEvent('notifications:reload'));
        } catch (err) {
            setErrorMessage(err.response?.data?.message || 'Return action failed.');
        } finally {
            setActionLoading(false);
        }
    };

    if (!canReview) {
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
                                {isTwgSkipped ? (
                                    <>This is an amended PPMP with scope <strong>PPMP/APP Only</strong> (BAC-TWG review is bypassed). As OPPMO Reviewer, you must generate the updated APP using the <strong>Generate APP Now</strong> button before forwarding approval to the Office Head.</>
                                ) : ppmp?.parent_id || ppmp?.amendment_type ? (
                                    <>Changes were made on this amended/supplemental PPMP. As OPPMO Reviewer, you must generate the updated APP using the <strong>Generate APP Now</strong> button before forwarding approval to the Office Head. The previous APP is safely preserved.</>
                                ) : (
                                    <>BAC-TWG technical review is complete. As OPPMO Reviewer, you must generate the official APP using the <strong>Create APP</strong> button on this page before granting approval to the Office Head.</>
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
                        onClick={() => setShowRemarksModal(true)}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-md text-xs font-bold uppercase tracking-wider shadow-sm transition disabled:opacity-50 cursor-pointer"
                    >
                        <RotateCcw className="w-4 h-4" />
                        Suspend / REMARKS
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
                            You are returning this PPMP to the End User. A specific remark detailing what needs correction or updating is required by government audit standards.
                        </p>

                        <form onSubmit={handleReturnSubmit}>
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    Reviewer Findings & Required Changes: <span className="text-rose-600">*</span>
                                </label>
                                <textarea
                                    required
                                    rows={4}
                                    value={remarks}
                                    onChange={(e) => setRemarks(e.target.value)}
                                    placeholder=""
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
                                    className="px-5 py-2 text-xs font-bold uppercase tracking-wider bg-rose-600 hover:bg-rose-700 text-white rounded-md shadow-sm transition disabled:opacity-50"
                                >
                                    {actionLoading ? 'Processing...' : 'Submit Remarks & Return'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
