import React, { useState, useEffect } from 'react';
import {
    CheckCircle2,
    Clock,
    AlertTriangle,
    RotateCcw,
    Trash2,
    Edit3,
    Check,
    X,
    User,
    Calendar,
    Award,
    FileText,
    ShieldAlert,
    ChevronDown,
    ChevronUp,
    Sparkles,
    ArrowRight,
    ArrowUp,
    ArrowDown,
    ListChecks,
    Plus,
    Eye
} from 'lucide-react';
import { monitoringService } from '../../services/api';
import { showConfirm } from '../../utils/modalAlert';
import { getStatusConfig } from '../UI/StatusBadge';

export const MonitoringStepItem = ({
    step,
    index,
    projectId,
    isBacDecision = false,
    isTechnicalCb = false,
    canManage = true,
    isAdminOrSuperAdmin = false,
    isPimsReviewStep = false,
    isApprovePimsStep = false,
    pimsChecklist = null,
    adminOnlyNotice = false,
    isFirst = false,
    isLast = false,
    onMoveStep = null,
    onPreviewChecklistDoc = null,
    onStepUpdated,
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [isManagingCheckboxes, setIsManagingCheckboxes] = useState(false);
    const [loading, setLoading] = useState(false);

    const [status, setStatus] = useState(step.status || 'PENDING');
    const [decision, setDecision] = useState(step.decision || '');
    const [notes, setNotes] = useState(step.notes || '');
    const [handledBy, setHandledBy] = useState(step.handled_by || '');
    const [selectedDate, setSelectedDate] = useState(step.completed_at ? step.completed_at.split('T')[0] : '');

    const [prReviewerApproved, setPrReviewerApproved] = useState(Boolean(step.checklist_data?.pr_reviewer_approved));
    const [prReviewerApprovedDate, setPrReviewerApprovedDate] = useState(step.checklist_data?.pr_reviewer_approved_date || '');
    const [prControlled, setPrControlled] = useState(Boolean(step.checklist_data?.pr_controlled));
    const [prControlledDate, setPrControlledDate] = useState(step.checklist_data?.pr_controlled_date || '');
    const [customItems, setCustomItems] = useState(
        Array.isArray(step.checklist_data?.items) ? step.checklist_data.items : []
    );

    useEffect(() => {
        setStatus(step.status || 'PENDING');
        setDecision(step.decision || '');
        setNotes(step.notes || '');
        setHandledBy(step.handled_by || '');
        setSelectedDate(step.completed_at ? step.completed_at.split('T')[0] : '');
        setPrReviewerApproved(Boolean(step.checklist_data?.pr_reviewer_approved));
        setPrReviewerApprovedDate(step.checklist_data?.pr_reviewer_approved_date || '');
        setPrControlled(Boolean(step.checklist_data?.pr_controlled));
        setPrControlledDate(step.checklist_data?.pr_controlled_date || '');
        setCustomItems(Array.isArray(step.checklist_data?.items) ? step.checklist_data.items : []);
    }, [step]);

    const buildChecklistPayload = (overrideItems = null) => {
        const sourceItems = Array.isArray(overrideItems)
            ? overrideItems
            : (Array.isArray(customItems) ? customItems : []);
        const itemsToUse = sourceItems
            .map((item) => ({
                id: item.id,
                label: String(item.label || '').trim(),
                checked: Boolean(item.checked),
                date: item.checked ? (item.date || null) : null,
            }))
            .filter((item) => item.label.length > 0);

        if (isApprovePimsStep) {
            return {
                pr_reviewer_approved: prReviewerApproved,
                pr_reviewer_approved_date: prReviewerApproved ? (prReviewerApprovedDate || null) : null,
                pr_controlled: prControlled,
                pr_controlled_date: prControlled ? (prControlledDate || null) : null,
                ...(itemsToUse.length > 0 ? { items: itemsToUse } : { items: [] }),
            };
        }
        return { items: itemsToUse };
    };

    const handleSaveChecklist = async (overrideItems = null) => {
        setLoading(true);
        try {
            const res = await monitoringService.updateStep(step.id, {
                checklist_data: buildChecklistPayload(overrideItems),
            });
            setIsManagingCheckboxes(false);
            if (onStepUpdated) onStepUpdated(res.data.project);
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || 'Failed to save checklist.');
        } finally {
            setLoading(false);
        }
    };

    const handleAddCustomCheckbox = () => {
        setCustomItems((prev) => [
            ...prev,
            {
                id: `chk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                label: '',
                checked: false,
                date: null,
            },
        ]);
    };

    const handleMoveCustomCheckbox = (idx, direction) => {
        setCustomItems((prev) => {
            const targetIdx = idx + direction;
            if (targetIdx < 0 || targetIdx >= prev.length) return prev;
            const copy = [...prev];
            const [moved] = copy.splice(idx, 1);
            copy.splice(targetIdx, 0, moved);
            return copy;
        });
    };

    const handleRemoveCustomCheckbox = (idx) => {
        setCustomItems((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleSave = async () => {
        if (status !== 'PENDING' && !selectedDate) {
            alert('Please select a date. Date selection is required.');
            return;
        }
        setLoading(true);
        try {
            const payload = {
                status,
                decision: isBacDecision ? decision : step.decision,
                notes,
                handled_by: handledBy,
                completed_at: selectedDate || null,
            };
            if (isApprovePimsStep || customItems.length > 0) {
                payload.checklist_data = buildChecklistPayload();
            }
            const res = await monitoringService.updateStep(step.id, payload);
            setIsEditing(false);
            if (onStepUpdated) onStepUpdated(res.data.project);
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || 'Failed to update step.');
        } finally {
            setLoading(false);
        }
    };

    const handleQuickStatus = async (newStatus) => {
        if (newStatus !== 'PENDING' && !selectedDate) {
            alert('Please select a date first before marking this step as Done.');
            return;
        }
        setLoading(true);
        try {
            const res = await monitoringService.updateStep(step.id, {
                status: newStatus,
                completed_at: selectedDate,
            });
            setStatus(newStatus);
            if (onStepUpdated) onStepUpdated(res.data.project);
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || 'Failed to update status.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        const confirmed = await showConfirm({
            title: 'Delete Monitoring Step',
            message: `Are you sure you want to delete step: "${step.step_name}"?`,
            confirmText: 'Yes, Delete Step',
            cancelText: 'Cancel',
            type: 'danger',
        });
        if (!confirmed) return;
        setLoading(true);
        try {
            const res = await monitoringService.deleteStep(step.id);
            if (onStepUpdated) onStepUpdated(res.data.project);
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || 'Failed to delete step.');
        } finally {
            setLoading(false);
        }
    };

    const getStatusStyle = () => {
        switch (step.status) {
            case 'COMPLETED':
            case 'APPROVED':
                return {
                    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
                    bar: 'bg-emerald-500',
                };
            case 'IN_PROGRESS':
                return {
                    badge: 'bg-blue-100 text-blue-800 border-blue-200',
                    icon: <Clock className="w-4 h-4 text-blue-600 animate-pulse" />,
                    bar: 'bg-blue-500',
                };
            case 'SUSPENDED':
                return {
                    badge: 'bg-amber-100 text-amber-900 border-amber-300',
                    icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
                    bar: 'bg-amber-500',
                };
            case 'RETURNED':
                return {
                    badge: 'bg-rose-100 text-rose-800 border-rose-300',
                    icon: <RotateCcw className="w-4 h-4 text-rose-600" />,
                    bar: 'bg-rose-500',
                };
            default:
                return {
                    badge: 'bg-slate-100 text-slate-600 border-slate-200',
                    icon: <Clock className="w-4 h-4 text-slate-400" />,
                    bar: 'bg-slate-300',
                };
        }
    };

    const style = getStatusStyle();
    const areCustomItemsComplete = customItems.length === 0 || customItems.every((it) => Boolean(it.checked && it.date));
    const isApprovePimsChecklistComplete = Boolean(
        prReviewerApproved &&
        prReviewerApprovedDate &&
        prControlled &&
        prControlledDate &&
        areCustomItemsComplete
    );
    const hasIncompletePrereqs = Boolean(
        (isPimsReviewStep && pimsChecklist?.has_ppmp && !pimsChecklist?.all_approved) ||
        (isApprovePimsStep && !isApprovePimsChecklistComplete) ||
        (!isApprovePimsStep && customItems.length > 0 && !areCustomItemsComplete)
    );

    return (
        <div className="relative pl-7 pb-6 last:pb-1 group">

            <div className="absolute left-[11px] top-5 bottom-0 w-0.5 bg-slate-200 group-last:hidden" />

            <div
                className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-xs ${
                    step.status === 'COMPLETED' || step.status === 'APPROVED'
                        ? 'bg-emerald-600 text-white'
                        : step.status === 'IN_PROGRESS'
                        ? 'bg-blue-600 text-white'
                        : step.status === 'SUSPENDED'
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-200 text-slate-500'
                }`}
            >
                <span className="text-[10px] font-bold">{index + 1}</span>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition duration-150">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                                {step.step_name}
                            </span>
                            <span
                                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${style.badge}`}
                            >
                                {step.status}
                            </span>
                            {step.is_custom && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-purple-100 text-purple-700 border border-purple-200">
                                    Custom Step
                                </span>
                            )}
                            {isPimsReviewStep && (
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                    Admin / Super Admin Only (PIMS Review)
                                </span>
                            )}
                        </div>

                        {isPimsReviewStep && pimsChecklist?.has_ppmp && (
                            <div className={`mt-2 p-2.5 rounded-lg border text-[11px] space-y-1.5 ${
                                hasIncompletePrereqs
                                    ? 'bg-amber-50/80 border-amber-200 text-amber-950'
                                    : 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                            }`}>
                                <div className="font-bold flex flex-wrap items-center justify-between gap-2">
                                    <span>PIMS Pre-Approval Checklist (PPMP, APP, Attachment List, Market Scoping)</span>
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-extrabold ${
                                        hasIncompletePrereqs
                                            ? 'bg-amber-200/80 text-amber-900'
                                            : 'bg-emerald-200/80 text-emerald-900'
                                    }`}>
                                        {hasIncompletePrereqs ? 'INCOMPLETE — MUST STAY PENDING / SUSPENDED' : 'ALL VERIFIED'}
                                    </span>
                                </div>
                                {pimsChecklist.ppmp_status && (() => {
                                    const cfg = getStatusConfig(pimsChecklist.ppmp_status);
                                    return (
                                        <div className="flex flex-wrap items-center gap-2 bg-white/90 border border-slate-200 rounded-md px-2.5 py-1.5">
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                                PPMP/APP System Status:
                                            </span>
                                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold border ${cfg.bg}`}>
                                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                                <span>
                                                    {pimsChecklist.ppmp_is_under_review
                                                        ? `Under Review: ${cfg.label}`
                                                        : (pimsChecklist.ppmp_status_label || cfg.label)}
                                                </span>
                                            </span>
                                            {pimsChecklist.ppmp_is_under_review && pimsChecklist.ppmp_reviewer_name && (
                                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-indigo-800 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                                                    <User className="w-3 h-3 text-indigo-600" />
                                                    <span>Reviewer: {pimsChecklist.ppmp_reviewer_name}</span>
                                                </span>
                                            )}
                                        </div>
                                    );
                                })()}
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                    {[
                                        { label: 'PPMP Created & Approved', ok: pimsChecklist.ppmp_created_approved, docType: 'ppmp' },
                                        { label: 'APP Generated / Approved', ok: pimsChecklist.app_done, docType: 'app' },
                                        { label: 'List of Attachment Created', ok: pimsChecklist.attachment_list_done, docType: 'attachment_list' },
                                        { label: 'Market Scoping Approved', ok: pimsChecklist.market_scoping_approved, docType: 'market_scoping' },
                                    ].map((req) => (
                                        <button
                                            key={req.label}
                                            type="button"
                                            onClick={() => onPreviewChecklistDoc && onPreviewChecklistDoc(req.docType)}
                                            disabled={!onPreviewChecklistDoc}
                                            title={`Click to view ${req.label}`}
                                            className={`w-full text-left flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded border text-[10px] font-semibold transition ${
                                                onPreviewChecklistDoc ? 'cursor-pointer hover:shadow-xs hover:ring-1 hover:ring-blue-400' : ''
                                            } ${
                                                req.ok
                                                    ? 'bg-white border-emerald-200 text-emerald-800 hover:bg-emerald-50/50'
                                                    : 'bg-white border-amber-300 text-amber-900 hover:bg-amber-50/50'
                                            }`}
                                        >
                                            <span className="flex items-center gap-1.5 min-w-0">
                                                {req.ok ? (
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                ) : (
                                                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                                )}
                                                <span className="truncate">{req.label}</span>
                                            </span>
                                            {onPreviewChecklistDoc && (
                                                <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-blue-600 shrink-0">
                                                    <Eye className="w-3 h-3" />
                                                    <span>View</span>
                                                </span>
                                            )}
                                        </button>
                                    ))}
                                </div>
                                {adminOnlyNotice && (
                                    <div className="text-[10px] text-slate-600 font-medium pt-0.5">
                                        Note: This step is under PIMS reviewer verification and can only be updated by Admin or Super Admin.
                                    </div>
                                )}
                            </div>
                        )}
                        {isPimsReviewStep && !pimsChecklist?.has_ppmp && adminOnlyNotice && (
                            <div className="mt-1.5 text-[10px] text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1 font-medium">
                                Note: This step is under PIMS reviewer verification and can only be updated by Admin or Super Admin.
                            </div>
                        )}

                        {isApprovePimsStep && (
                            <div className={`mt-2 p-3 rounded-lg border text-[11px] space-y-2.5 ${
                                isApprovePimsChecklistComplete
                                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                                    : 'bg-blue-50/60 border-blue-200 text-slate-900'
                            }`}>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-bold text-slate-900">
                                        Approve PIMS Checklist (PR Reviewer & PR Controlled)
                                    </span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-extrabold ${
                                        isApprovePimsChecklistComplete
                                            ? 'bg-emerald-200/80 text-emerald-900'
                                            : 'bg-amber-100 text-amber-900 border border-amber-200'
                                    }`}>
                                        {isApprovePimsChecklistComplete ? 'ALL CHECKED & DATED' : 'PENDING CHECKLIST & DATES'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">

                                    <div className={`p-2.5 rounded-lg border bg-white space-y-1.5 ${
                                        prReviewerApproved && prReviewerApprovedDate ? 'border-emerald-300' : 'border-slate-200'
                                    }`}>
                                        <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                                            {canManage ? (
                                                <input
                                                    type="checkbox"
                                                    checked={prReviewerApproved}
                                                    onChange={(e) => {
                                                        const checked = e.target.checked;
                                                        setPrReviewerApproved(checked);
                                                        if (checked && !prReviewerApprovedDate) {
                                                            setPrReviewerApprovedDate(new Date().toISOString().split('T')[0]);
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                            ) : prReviewerApproved ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                            ) : (
                                                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                                            )}
                                            <span>PR Reviewer Approved</span>
                                        </label>

                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-semibold text-slate-500 shrink-0">Date:</span>
                                            {canManage ? (
                                                <input
                                                    type="date"
                                                    value={prReviewerApprovedDate}
                                                    disabled={!prReviewerApproved}
                                                    onChange={(e) => setPrReviewerApprovedDate(e.target.value)}
                                                    className="w-full text-[11px] px-2 py-1 border border-slate-300 rounded bg-white text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                                                />
                                            ) : (
                                                <span className="text-[11px] font-semibold text-slate-700">
                                                    {prReviewerApprovedDate
                                                        ? new Date(prReviewerApprovedDate).toLocaleDateString()
                                                        : 'Not set'}
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    <div className={`p-2.5 rounded-lg border bg-white space-y-1.5 ${
                                        prControlled && prControlledDate ? 'border-emerald-300' : 'border-slate-200'
                                    }`}>
                                        <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                                            {canManage ? (
                                                <input
                                                    type="checkbox"
                                                    checked={prControlled}
                                                    onChange={(e) => {
                                                        const checked = e.target.checked;
                                                        setPrControlled(checked);
                                                        if (checked && !prControlledDate) {
                                                            setPrControlledDate(new Date().toISOString().split('T')[0]);
                                                        }
                                                    }}
                                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                />
                                            ) : prControlled ? (
                                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                            ) : (
                                                <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                                            )}
                                            <span>PR Controlled</span>
                                        </label>

                                        <div className="flex items-center gap-2">
                                            <span className="text-[10px] font-semibold text-slate-500 shrink-0">Date:</span>
                                            {canManage ? (
                                                <input
                                                    type="date"
                                                    value={prControlledDate}
                                                    disabled={!prControlled}
                                                    onChange={(e) => setPrControlledDate(e.target.value)}
                                                    className="w-full text-[11px] px-2 py-1 border border-slate-300 rounded bg-white text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                                                />
                                            ) : (
                                                <span className="text-[11px] font-semibold text-slate-700">
                                                    {prControlledDate
                                                        ? new Date(prControlledDate).toLocaleDateString()
                                                        : 'Not set'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {canManage && (
                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            disabled={loading}
                                            onClick={() => handleSaveChecklist()}
                                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-md transition cursor-pointer disabled:opacity-50"
                                        >
                                            {loading ? 'Saving...' : 'Save Checklist & Dates'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {((!isApprovePimsStep && customItems.length > 0) || (isApprovePimsStep && customItems.length > 0)) && !isManagingCheckboxes && (
                            <div className={`mt-2 p-3 rounded-lg border text-[11px] space-y-2.5 ${
                                areCustomItemsComplete
                                    ? 'bg-emerald-50/70 border-emerald-200 text-emerald-950'
                                    : 'bg-blue-50/60 border-blue-200 text-slate-900'
                            }`}>
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                    <span className="font-bold text-slate-900">
                                        {isApprovePimsStep ? 'Additional Checklist Items' : 'Step Checklist'}
                                    </span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded font-extrabold ${
                                        areCustomItemsComplete
                                            ? 'bg-emerald-200/80 text-emerald-900'
                                            : 'bg-amber-100 text-amber-900 border border-amber-200'
                                    }`}>
                                        {areCustomItemsComplete ? 'ALL CHECKED & DATED' : 'PENDING CHECKLIST & DATES'}
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {customItems.map((cItem, cIdx) => (
                                        <div
                                            key={cItem.id || cIdx}
                                            className={`p-2.5 rounded-lg border bg-white space-y-1.5 ${
                                                cItem.checked && cItem.date ? 'border-emerald-300' : 'border-slate-200'
                                            }`}
                                        >
                                            <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                                                {canManage ? (
                                                    <input
                                                        type="checkbox"
                                                        checked={Boolean(cItem.checked)}
                                                        onChange={(e) => {
                                                            const checked = e.target.checked;
                                                            setCustomItems((prev) =>
                                                                prev.map((it, i) =>
                                                                    i === cIdx
                                                                        ? {
                                                                            ...it,
                                                                            checked,
                                                                            date: checked && !it.date
                                                                                ? new Date().toISOString().split('T')[0]
                                                                                : it.date,
                                                                        }
                                                                        : it
                                                                )
                                                            );
                                                        }}
                                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    />
                                                ) : cItem.checked ? (
                                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                                ) : (
                                                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                                                )}
                                                <span>{cItem.label}</span>
                                            </label>

                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] font-semibold text-slate-500 shrink-0">Date:</span>
                                                {canManage ? (
                                                    <input
                                                        type="date"
                                                        value={cItem.date || ''}
                                                        disabled={!cItem.checked}
                                                        onChange={(e) => {
                                                            const val = e.target.value;
                                                            setCustomItems((prev) =>
                                                                prev.map((it, i) => (i === cIdx ? { ...it, date: val } : it))
                                                            );
                                                        }}
                                                        className="w-full text-[11px] px-2 py-1 border border-slate-300 rounded bg-white text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                                                    />
                                                ) : (
                                                    <span className="text-[11px] font-semibold text-slate-700">
                                                        {cItem.date ? new Date(cItem.date).toLocaleDateString() : 'Not set'}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {canManage && !isApprovePimsStep && (
                                    <div className="flex justify-end">
                                        <button
                                            type="button"
                                            disabled={loading}
                                            onClick={() => handleSaveChecklist()}
                                            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold rounded-md transition cursor-pointer disabled:opacity-50"
                                        >
                                            {loading ? 'Saving...' : 'Save Checklist & Dates'}
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}

                        {isAdminOrSuperAdmin && isManagingCheckboxes && (
                            <div className="mt-2 p-3 rounded-lg border border-indigo-200 bg-indigo-50/60 text-[11px] space-y-2.5">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="font-bold text-indigo-950">
                                        Manage Step Checkboxes (Add / Rename / Rearrange Display)
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setIsManagingCheckboxes(false)}
                                        className="text-[10px] font-bold text-slate-500 hover:text-slate-800 cursor-pointer"
                                    >
                                        Close
                                    </button>
                                </div>

                                {customItems.length === 0 ? (
                                    <div className="text-[11px] text-slate-500 italic">
                                        No custom checkboxes yet. Click "+ Add Checkbox" below to add one.
                                    </div>
                                ) : (
                                    <div className="space-y-1.5">
                                        {customItems.map((cItem, cIdx) => (
                                            <div key={cItem.id || cIdx} className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-bold text-slate-400 w-4 text-center shrink-0">
                                                    {cIdx + 1}.
                                                </span>
                                                <input
                                                    type="text"
                                                    value={cItem.label}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setCustomItems((prev) =>
                                                            prev.map((it, i) => (i === cIdx ? { ...it, label: val } : it))
                                                        );
                                                    }}
                                                    placeholder={`Checkbox ${cIdx + 1} label`}
                                                    className="flex-1 text-xs p-1.5 bg-white border border-slate-300 rounded-md font-medium text-slate-900"
                                                />
                                                <button
                                                    type="button"
                                                    disabled={cIdx === 0}
                                                    onClick={() => handleMoveCustomCheckbox(cIdx, -1)}
                                                    title="Move Up"
                                                    className="p-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                                                >
                                                    <ArrowUp className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={cIdx === customItems.length - 1}
                                                    onClick={() => handleMoveCustomCheckbox(cIdx, 1)}
                                                    title="Move Down"
                                                    className="p-1 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                                                >
                                                    <ArrowDown className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveCustomCheckbox(cIdx)}
                                                    title="Remove Checkbox"
                                                    className="p-1 rounded border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 cursor-pointer"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={handleAddCustomCheckbox}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-indigo-700 bg-white border border-indigo-300 rounded-md hover:bg-indigo-50 cursor-pointer"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Add Checkbox</span>
                                    </button>
                                    <button
                                        type="button"
                                        disabled={loading}
                                        onClick={() => handleSaveChecklist()}
                                        className="px-3 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded-md transition cursor-pointer disabled:opacity-50"
                                    >
                                        {loading ? 'Saving...' : 'Save Checkbox Layout'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {(isTechnicalCb || step.special_badge) && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-[11px] font-semibold mt-1">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Note: For CB only Miss Sharia release the documents</span>
                            </div>
                        )}

                        {step.decision && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-900 text-[11px] font-bold mt-1">
                                <Award className="w-3.5 h-3.5 text-teal-600" />
                                <span>
                                    Decision: {step.decision === 'awarded' && 'Awarded (Release to TWG & Transmit to Contracting)'}
                                    {step.decision === 're_canvass_1st' && '1st Opening Re-canvass'}
                                    {step.decision === 're_canvass_2nd' && '2nd Opening For Mandatory'}
                                    {step.decision === 're_canvass_3rd' && '3rd Opening Returned to End-user'}
                                    {step.decision === 'approved' && 'Approved'}
                                    {step.decision === 'suspended' && 'Suspended / Hold'}
                                </span>
                            </div>
                        )}

                        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-1">
                            {step.handled_by && (
                                <span className="flex items-center gap-1">
                                    <User className="w-3 h-3 text-slate-400" />
                                    <span>Handled by: <strong className="text-slate-700 font-semibold">{step.handled_by}</strong></span>
                                </span>
                            )}
                            {canManage ? (
                                <label className="inline-flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                    <span className="font-semibold text-slate-700">
                                        Select Date <span className="text-rose-600">*</span>:
                                    </span>
                                    <input
                                        type="date"
                                        required
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        className={`text-[11px] px-2 py-0.5 border rounded bg-white text-slate-900 font-medium focus:ring-1 focus:ring-blue-500 focus:outline-none ${
                                            !selectedDate ? 'border-amber-400 bg-amber-50/40' : 'border-slate-300'
                                        }`}
                                    />
                                </label>
                            ) : (
                                step.completed_at && (
                                    <span className="text-emerald-700 font-medium">
                                        ✓ Date: {new Date(step.completed_at).toLocaleDateString()}
                                    </span>
                                )
                            )}
                            {canManage && step.completed_at && (
                                <span className="text-emerald-700 font-medium">
                                    ✓ Saved Date: {new Date(step.completed_at).toLocaleDateString()}
                                </span>
                            )}
                        </div>

                        {step.notes && (
                            <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 mt-2">
                                <span className="font-semibold text-slate-700">Remarks: </span>
                                {step.notes}
                            </div>
                        )}
                    </div>

                    {canManage && (
                        <div className="flex items-center gap-1 shrink-0 self-end sm:self-start">
                            {isAdminOrSuperAdmin && onMoveStep && (
                                <>
                                    <button
                                        type="button"
                                        disabled={loading || isFirst}
                                        onClick={() => onMoveStep(-1)}
                                        title="Move Step Up (Rearrange Display)"
                                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        disabled={loading || isLast}
                                        onClick={() => onMoveStep(1)}
                                        title="Move Step Down (Rearrange Display)"
                                        className="p-1.5 rounded-lg text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                </>
                            )}

                            {isAdminOrSuperAdmin && (
                                <button
                                    type="button"
                                    onClick={() => setIsManagingCheckboxes(!isManagingCheckboxes)}
                                    title="Manage Checkboxes (Add / Rename / Rearrange)"
                                    className={`p-1.5 rounded-lg transition cursor-pointer ${
                                        isManagingCheckboxes
                                            ? 'bg-indigo-100 text-indigo-700'
                                            : 'text-slate-500 hover:text-indigo-600 hover:bg-indigo-50'
                                    }`}
                                >
                                    <ListChecks className="w-3.5 h-3.5" />
                                </button>
                            )}

                            {step.status !== 'COMPLETED' && step.status !== 'APPROVED' && (
                                <button
                                    type="button"
                                    disabled={loading || hasIncompletePrereqs}
                                    onClick={() => handleQuickStatus('COMPLETED')}
                                    title={hasIncompletePrereqs
                                        ? 'Cannot mark Completed: PPMP, APP, List of Attachment, or Market Scoping is not yet approved/completed.'
                                        : 'Mark Completed / Approved'}
                                    className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <Check className="w-3.5 h-3.5" />
                                    <span className="hidden sm:inline">Done</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => setIsEditing(!isEditing)}
                                className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition cursor-pointer"
                                title="Edit Step Details"
                            >
                                <Edit3 className="w-3.5 h-3.5" />
                            </button>

                            <button
                                type="button"
                                disabled={loading}
                                onClick={handleDelete}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                title="Delete Step (Add/Delete supported across all divisions)"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    )}
                </div>

                {canManage && isEditing && (
                    <div className="mt-4 pt-4 border-t border-slate-100 bg-slate-50/80 -mx-4 -mb-4 p-4 rounded-b-xl space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                    Step Status
                                </label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    style={{ color: '#000000' }}
                                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-medium text-black"
                                >
                                    <option value="PENDING" style={{ color: '#000000' }}>Pending</option>
                                    <option value="IN_PROGRESS" style={{ color: '#000000' }}>In Progress</option>
                                    <option value="APPROVED" disabled={hasIncompletePrereqs} style={{ color: '#000000' }}>
                                        Approved {hasIncompletePrereqs ? '(Requires PPMP/APP/Attachments/Market Scoping)' : ''}
                                    </option>
                                    <option value="COMPLETED" disabled={hasIncompletePrereqs} style={{ color: '#000000' }}>
                                        Completed {hasIncompletePrereqs ? '(Requires PPMP/APP/Attachments/Market Scoping)' : ''}
                                    </option>
                                    <option value="SUSPENDED" style={{ color: '#000000' }}>Suspended / Need to Comply</option>
                                    <option value="RETURNED" style={{ color: '#000000' }}>Returned to End-user</option>
                                </select>
                            </div>

                            {isBacDecision ? (
                                <div>
                                    <label className="block text-[11px] font-bold text-indigo-700 uppercase mb-1">
                                        BAC Decision (Awarded / Re-canvass)
                                    </label>
                                    <select
                                        value={decision}
                                        onChange={(e) => {
                                            setDecision(e.target.value);
                                            if (e.target.value === 'awarded') {
                                                setStatus('COMPLETED');
                                            } else if (e.target.value === 're_canvass_3rd') {
                                                setStatus('RETURNED');
                                            } else if (e.target.value) {
                                                setStatus('IN_PROGRESS');
                                            }
                                        }}
                                        style={{ color: '#000000' }}
                                        className="w-full text-xs p-2 bg-indigo-50/60 border border-indigo-300 rounded-lg font-bold text-black"
                                    >
                                        <option value="" style={{ color: '#000000' }}>-- Select Decision --</option>
                                        <option value="awarded" style={{ color: '#000000' }}>Awarded (BAC Support received docs from TWG)</option>
                                        <option value="re_canvass_1st" style={{ color: '#000000' }}>1st Opening: Re-canvass</option>
                                        <option value="re_canvass_2nd" style={{ color: '#000000' }}>2nd Opening: For mandatory</option>
                                        <option value="re_canvass_3rd" style={{ color: '#000000' }}>3rd Opening: Returned to End-user</option>
                                    </select>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                        Select Date <span className="text-rose-600">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        style={{ color: '#000000' }}
                                        className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-medium text-black"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                    Assigned / Handled By
                                </label>
                                <input
                                    type="text"
                                    value={handledBy}
                                    onChange={(e) => setHandledBy(e.target.value)}
                                    placeholder="Name of personnel or unit"
                                    style={{ color: '#000000' }}
                                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-medium text-black placeholder:text-slate-400"
                                />
                            </div>

                            {isBacDecision && (
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                        Select Date <span className="text-rose-600">*</span>
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={selectedDate}
                                        onChange={(e) => setSelectedDate(e.target.value)}
                                        style={{ color: '#000000' }}
                                        className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-medium text-black"
                                    />
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                Notes & Compliance Remarks
                            </label>
                            <input
                                type="text"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Add notes, requirements to comply, or transmittal references..."
                                style={{ color: '#000000' }}
                                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-medium text-black placeholder:text-slate-400"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={loading}
                                onClick={handleSave}
                                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer shadow-xs"
                            >
                                {loading ? 'Saving...' : 'Save Step Details'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
