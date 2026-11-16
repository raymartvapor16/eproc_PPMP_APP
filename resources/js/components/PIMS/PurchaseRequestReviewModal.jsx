import React, { useState } from 'react';
import {
    X,
    CheckCircle2,
    RotateCcw,
    ShieldCheck,
    MessageSquare,
    Clock,
    User,
    ArrowRight,
    Loader2,
    AlertCircle,
    Hash,
} from 'lucide-react';
import { pimsService } from '../../services/api';
import { formatCurrency, formatDate } from '../UI/StatusBadge';

export const PurchaseRequestReviewModal = ({
    isOpen,
    onClose,
    purchaseRequest,
    onSuccess,
}) => {
    const pr = purchaseRequest || {};
    const [action, setAction] = useState('approve'); // 'approve' | 'return'
    const [remarks, setRemarks] = useState('');
    const [returnToStage, setReturnToStage] = useState('end_user');
    const [assignedPrNumber, setAssignedPrNumber] = useState(pr.pr_number || '');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    if (!isOpen || !purchaseRequest) return null;

    const getStageName = (stage) => {
        switch (stage) {
            case 'pr_division': return 'PR Division';
            case 'bac_twg': return 'BAC - Technical Working Group (TWG)';
            case 'pr_control': return 'PR Division (Control)';
            case 'approved': return 'PR Approved';
            case 'end_user': return 'End-User / Originating Office';
            default: return stage ? stage.replace(/_/g, ' ').toUpperCase() : 'Unknown';
        }
    };

    const getNextStageName = (currentStage) => {
        switch (currentStage) {
            case 'pr_division': return 'BAC-TWG Evaluation';
            case 'bac_twg': return 'PR Division (Control)';
            case 'pr_control': return 'Official PR Approval';
            default: return 'Completed';
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (action === 'return' && !remarks.trim()) {
            setError('Please enter remarks/comments explaining why the PR is being returned.');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                action,
                remarks: remarks.trim(),
                return_to_stage: returnToStage,
                assigned_pr_number: assignedPrNumber.trim(),
            };

            const res = await pimsService.reviewPurchaseRequest(pr.id || pr.uuid, payload);
            window.dispatchEvent(new CustomEvent('pims:pr_updated', { detail: res.data.purchase_request }));

            if (onSuccess) {
                onSuccess(res.data.purchase_request);
            }
            onClose();
        } catch (err) {
            console.error('Failed to review PR', err);
            setError(err.response?.data?.message || 'Failed to submit review action.');
        } finally {
            setSubmitting(false);
        }
    };

    const routes = pr.routes || [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
                            <ShieldCheck className="w-5 h-5 text-amber-300" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white tracking-tight">
                                Purchase Request Review & Routing
                            </h2>
                            <p className="text-xs text-blue-200">
                                Current Stage: <span className="font-bold underline text-amber-300">{getStageName(pr.current_stage)}</span> &bull; {pr.tracker_id}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">
                    {/* PR Snapshot */}
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between text-xs">
                        <div className="min-w-0 flex-1 pr-4">
                            <div className="font-bold text-slate-900 truncate text-sm">{pr.purpose}</div>
                            <div className="text-slate-500 mt-0.5">{pr.department} &bull; {pr.source || 'PPMP'}</div>
                        </div>
                        <div className="text-right shrink-0">
                            <div className="text-[10px] text-slate-500 uppercase font-semibold">Total Cost</div>
                            <div className="text-sm font-extrabold text-blue-700">{formatCurrency(pr.total_cost)}</div>
                        </div>
                    </div>

                    {/* Routing History Timeline */}
                    {routes.length > 0 && (
                        <div className="space-y-2">
                            <div className="text-xs font-bold text-slate-700 uppercase tracking-wide flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-blue-600" />
                                <span>Routing & Evaluation History</span>
                            </div>
                            <div className="space-y-2 max-h-48 overflow-y-auto border border-slate-200 rounded-xl p-3 bg-slate-50/50 divide-y divide-slate-100">
                                {routes.map((rt) => (
                                    <div key={rt.id} className="pt-2 first:pt-0 text-xs">
                                        <div className="flex items-center justify-between text-[11px] mb-1">
                                            <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                                <span>{getStageName(rt.from_stage)}</span>
                                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                                <span className="text-blue-600">{getStageName(rt.to_stage)}</span>
                                            </div>
                                            <span className="text-[10px] text-slate-400">
                                                {rt.acted_at ? formatDate(rt.acted_at) : ''}
                                            </span>
                                        </div>
                                        <div className="text-slate-600 pl-2 border-l-2 border-blue-400 text-[11px] leading-relaxed">
                                            {rt.remarks || 'No remarks provided.'}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Review Form */}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {error && (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Action Selection */}
                        <div>
                            <label className="block text-xs font-bold text-slate-800 mb-2">Select Action</label>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    type="button"
                                    onClick={() => setAction('approve')}
                                    className={`p-3 rounded-xl border text-left flex items-start gap-3 transition cursor-pointer ${
                                        action === 'approve'
                                            ? 'bg-emerald-50 border-emerald-500 ring-2 ring-emerald-500/20 text-emerald-900'
                                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                                    }`}
                                >
                                    <CheckCircle2 className={`w-5 h-5 shrink-0 mt-0.5 ${action === 'approve' ? 'text-emerald-600' : 'text-slate-400'}`} />
                                    <div>
                                        <div className="font-bold text-xs">Approve & Forward</div>
                                        <div className="text-[11px] text-slate-500 mt-0.5">
                                            Endorse to <strong className="text-emerald-700">{getNextStageName(pr.current_stage)}</strong>
                                        </div>
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setAction('return')}
                                    className={`p-3 rounded-xl border text-left flex items-start gap-3 transition cursor-pointer ${
                                        action === 'return'
                                            ? 'bg-rose-50 border-rose-500 ring-2 ring-rose-500/20 text-rose-900'
                                            : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-700'
                                    }`}
                                >
                                    <RotateCcw className={`w-5 h-5 shrink-0 mt-0.5 ${action === 'return' ? 'text-rose-600' : 'text-slate-400'}`} />
                                    <div>
                                        <div className="font-bold text-xs">Return for Revision</div>
                                        <div className="text-[11px] text-slate-500 mt-0.5">
                                            Send back with feedback & comments
                                        </div>
                                    </div>
                                </button>
                            </div>
                        </div>

                        {/* Return Stage Options */}
                        {action === 'return' && (
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                    Return Destination Stage
                                </label>
                                <select
                                    value={returnToStage}
                                    onChange={(e) => setReturnToStage(e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="end_user">End-User / Originating Office</option>
                                    {pr.current_stage !== 'pr_division' && <option value="pr_division">PR Division</option>}
                                    {pr.current_stage === 'pr_control' && <option value="bac_twg">BAC - Technical Working Group (TWG)</option>}
                                </select>
                            </div>
                        )}

                        {/* Assign PR Number during PR Control stage */}
                        {pr.current_stage === 'pr_control' && action === 'approve' && (
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 mb-1 flex items-center gap-1.5">
                                    <Hash className="w-3.5 h-3.5 text-blue-600" />
                                    <span>Official Assigned P.R No.</span>
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. PR-2026-1234"
                                    value={assignedPrNumber}
                                    onChange={(e) => setAssignedPrNumber(e.target.value)}
                                    className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-[10px] text-slate-500 mt-0.5">Assigned by PR Division (Control) before final approval.</p>
                            </div>
                        )}

                        {/* Remarks / Comments */}
                        <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                                Review Remarks / Comments {action === 'return' && <span className="text-rose-500">*</span>}
                            </label>
                            <textarea
                                rows={3}
                                placeholder={action === 'return' ? 'Specify the exact items or specifications that require compliance...' : 'Optional approval notes or endorsements...'}
                                value={remarks}
                                onChange={(e) => setRemarks(e.target.value)}
                                className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500"
                                required={action === 'return'}
                            />
                        </div>

                        {/* Submit */}
                        <div className="pt-2 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                                disabled={submitting}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={submitting}
                                className={`px-5 py-2 text-xs font-bold text-white rounded-xl shadow-md flex items-center gap-2 transition cursor-pointer disabled:opacity-50 ${
                                    action === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                                }`}
                            >
                                {submitting ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        <span>Saving Action...</span>
                                    </>
                                ) : (
                                    <>
                                        {action === 'approve' ? <CheckCircle2 className="w-4 h-4" /> : <RotateCcw className="w-4 h-4" />}
                                        <span>Confirm {action === 'approve' ? 'Approval' : 'Return'}</span>
                                    </>
                                )}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
};

