import React, { useState, useEffect } from 'react';
import {
    X,
    CheckCircle2,
    AlertTriangle,
    FileText,
    Upload,
    Trash2,
    RotateCcw,
    Search,
    Plus,
    Edit3,
    Eye,
    Printer,
    Download,
    CheckSquare,
    Clock,
    ShieldCheck,
    Building2,
    History,
    Loader2,
    ExternalLink,
} from 'lucide-react';
import { supplierEvaluationService } from '../../services/api';
import {
    CRITERIA_WEIGHT_MAP,
    RATING_DESCRIPTIONS,
    CRITERIA_LABELS,
    formatPhDateTime,
    getNowPhDateTime,
} from './SupplierEvaluationPrintTemplates';
import { PaginationControl } from '../../components/UI/PaginationControl';

/**
 * 1. View / Evaluate / Update / Approve Evaluation Modal
 */
export function EvaluateOrViewModal({
    evaluation,
    mode = 'view', // 'view' | 'evaluate' | 'edit'
    effectiveRole,
    user,
    offices = [],
    approvedPdfs = [],
    onClose,
    onSuccess,
    onOpenPrint,
}) {
    const [ratings, setRatings] = useState({ 1: '', 2: '', 3: '', 4: '' });
    const [remarks, setRemarks] = useState({ 1: '', 2: '', 3: '', 4: '' });
    const [supplierName, setSupplierName] = useState('');
    const [poNo, setPoNo] = useState('');
    const [dateEvaluation, setDateEvaluation] = useState('');
    const [coveredPeriod, setCoveredPeriod] = useState('');
    const [officeId, setOfficeId] = useState('');
    const [selectedPdfId, setSelectedPdfId] = useState('');
    const [approveAsHead, setApproveAsHead] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!evaluation) return;
        const nextRatings = { 1: '', 2: '', 3: '', 4: '' };
        const nextRemarks = { 1: '', 2: '', 3: '', 4: '' };
        (evaluation.criteria_scores || []).forEach((s) => {
            nextRatings[s.criteria_id] = s.number_rating ? String(s.number_rating) : '';
            nextRemarks[s.criteria_id] = s.remarks || '';
        });
        setRatings(nextRatings);
        setRemarks(nextRemarks);
        setSupplierName(evaluation.supplier_name || '');
        setPoNo(evaluation.po_no || '');
        setDateEvaluation(
            evaluation.date_evaluation ? String(evaluation.date_evaluation).slice(0, 10) : new Date().toISOString().slice(0, 10)
        );
        setCoveredPeriod(evaluation.covered_period || `CY ${new Date().getFullYear()}`);
        setOfficeId(evaluation.office_id ? String(evaluation.office_id) : '');
        if (approvedPdfs.length > 0) {
            setSelectedPdfId(String(approvedPdfs[0].id));
        }
    }, [evaluation, approvedPdfs]);

    if (!evaluation) return null;

    const isReadOnly = mode === 'view';
    const isHeadReviewApproval =
        mode === 'evaluate' &&
        evaluation.status === 'head review' &&
        (effectiveRole === 'head' || effectiveRole === 'presentative_staff');

    const canEditHeader =
        !isReadOnly && (effectiveRole === 'administrator' || effectiveRole === 'pgso');

    let totalWeighted = 0;
    [1, 2, 3, 4].forEach((cId) => {
        const r = Number(ratings[cId] || 0);
        if (CRITERIA_WEIGHT_MAP[cId]?.[r]) {
            totalWeighted += CRITERIA_WEIGHT_MAP[cId][r];
        }
    });

    const approvals = evaluation.digital_approvals || [];
    const preparedBy = approvals.find((a) => (a.role || '').toLowerCase() === 'prepared by');
    const headApproval = approvals.find((a) => ['head', 'office head'].includes((a.role || '').toLowerCase().trim()));
    const repApproval = approvals.find((a) =>
        ['presentative_staff', 'representative_staff', 'representative staff', 'presentative staff'].includes(
            (a.role || '').toLowerCase().trim()
        )
    );

    // Live Asia/Manila (Philippines timezone) clock during active evaluation / signing
    const [livePhTime, setLivePhTime] = useState(() => getNowPhDateTime());
    useEffect(() => {
        const timer = setInterval(() => {
            setLivePhTime(getNowPhDateTime());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    // Formatted timestamps in Asia/Manila (PHT) timezone
    const preparedDateStr = formatPhDateTime(preparedBy?.updated_at || preparedBy?.created_at);
    const headDateStr = formatPhDateTime(
        headApproval?.updated_at ||
        headApproval?.created_at ||
        (evaluation.status === 'submitted' && !repApproval ? evaluation.updated_at : null)
    );
    const repDateStr = formatPhDateTime(repApproval?.updated_at || repApproval?.created_at);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        // Require all 4 criteria ratings when evaluating
        if (!isHeadReviewApproval) {
            const missing = [1, 2, 3, 4].filter((cId) => !ratings[cId]);
            if (missing.length > 0) {
                setError('Please select a rating (1 to 4) for all four evaluation criteria.');
                return;
            }
        }

        setSubmitting(true);
        try {
            const payload = {
                rating: ratings,
                remarks,
                supplier_name: supplierName,
                po_no: poNo,
                date_evaluation: dateEvaluation,
                covered_period: coveredPeriod,
                office_id: officeId || evaluation.office_id,
                pdf_id: selectedPdfId || null,
                approve_as_head: approveAsHead,
            };
            const res = await supplierEvaluationService.evaluateOrUpdate(evaluation.id, payload);
            if (onSuccess) onSuccess(res.data);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save evaluation.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-600 px-6 py-4 text-white flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-lg font-black tracking-tight flex items-center gap-2">
                            <ShieldCheck className="w-5 h-5" />
                            <span>
                                {mode === 'view' && "Supplier's Evaluation Form (View Mode)"}
                                {mode === 'evaluate' &&
                                    (isHeadReviewApproval
                                        ? 'Head / Representative Digital Review & Approval'
                                        : 'Evaluate Supplier Performance')}
                                {mode === 'edit' && 'Update Supplier Evaluation'}
                            </span>
                        </h2>
                        <p className="text-xs text-orange-100 mt-0.5">
                            P.O. No. {evaluation.po_no} • {evaluation.supplier_name} • Status:{' '}
                            <span className="uppercase font-bold">{evaluation.status}</span>
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {onOpenPrint && (
                            <button
                                type="button"
                                onClick={() => onOpenPrint(evaluation)}
                                className="px-3.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                            >
                                <Printer className="w-4 h-4" />
                                <span>Print / PDF</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-9 h-9 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white transition cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Form / Body */}
                <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-6">
                    {error && (
                        <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {/* Section 1: Evaluation Details */}
                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                                Evaluation & Purchase Order Details
                            </h3>
                            {evaluation.po_record?.has_pdf && (
                                <a
                                    href={evaluation.po_record.pdf_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs"
                                >
                                    <FileText className="w-3.5 h-3.5" />
                                    <span>View Purchase Order PDF</span>
                                    <ExternalLink className="w-3 h-3" />
                                </a>
                            )}
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                            <div>
                                <label className="block font-bold text-slate-600 mb-1">Name of Supplier</label>
                                <input
                                    type="text"
                                    value={supplierName}
                                    onChange={(e) => setSupplierName(e.target.value)}
                                    readOnly={!canEditHeader}
                                    className={`w-full rounded-xl border px-3 py-2 font-semibold ${
                                        canEditHeader
                                            ? 'bg-white border-orange-300'
                                            : 'bg-slate-100 border-slate-200 text-slate-700'
                                    }`}
                                />
                            </div>
                            <div>
                                <label className="block font-bold text-slate-600 mb-1">
                                    Purchase Order / Contract No.
                                </label>
                                <input
                                    type="text"
                                    value={poNo}
                                    onChange={(e) => setPoNo(e.target.value)}
                                    readOnly={!canEditHeader}
                                    className={`w-full rounded-xl border px-3 py-2 font-mono font-bold ${
                                        canEditHeader
                                            ? 'bg-white border-orange-300'
                                            : 'bg-slate-100 border-slate-200 text-slate-700'
                                    }`}
                                />
                            </div>
                            <div>
                                <label className="block font-bold text-slate-600 mb-1">Covered Period (CY)</label>
                                <input
                                    type="text"
                                    value={coveredPeriod}
                                    onChange={(e) => setCoveredPeriod(e.target.value)}
                                    readOnly={isReadOnly}
                                    className={`w-full rounded-xl border px-3 py-2 ${
                                        !isReadOnly
                                            ? 'bg-white border-orange-300'
                                            : 'bg-slate-100 border-slate-200 text-slate-700'
                                    }`}
                                />
                            </div>
                            <div>
                                <label className="block font-bold text-slate-600 mb-1">Date of Evaluation</label>
                                <input
                                    type="date"
                                    value={dateEvaluation}
                                    onChange={(e) => setDateEvaluation(e.target.value)}
                                    readOnly={isReadOnly}
                                    className={`w-full rounded-xl border px-3 py-2 ${
                                        !isReadOnly
                                            ? 'bg-white border-orange-300'
                                            : 'bg-slate-100 border-slate-200 text-slate-700'
                                    }`}
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block font-bold text-slate-600 mb-1">Evaluated By (Office)</label>
                                {canEditHeader ? (
                                    <select
                                        value={officeId}
                                        onChange={(e) => setOfficeId(e.target.value)}
                                        className="w-full rounded-xl border border-orange-300 bg-white px-3 py-2"
                                    >
                                        {offices.map((o) => (
                                            <option key={o.id} value={o.id}>
                                                {o.code ? `${o.code} — ${o.name}` : o.name}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        readOnly
                                        value={evaluation.office?.name || evaluation.office_name || 'N/A'}
                                        className="w-full rounded-xl border border-slate-200 bg-slate-100 px-3 py-2 text-slate-700 font-medium"
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Section 2: 4 Evaluation Criteria Matrix */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700">
                                Evaluation Criteria & Performance Rating
                            </h3>
                            <div
                                className={`px-4 py-1.5 rounded-full text-xs font-black border ${
                                    totalWeighted >= 90
                                        ? 'bg-emerald-100 border-emerald-300 text-emerald-800'
                                        : totalWeighted >= 75
                                        ? 'bg-blue-100 border-blue-300 text-blue-800'
                                        : totalWeighted >= 60
                                        ? 'bg-amber-100 border-amber-300 text-amber-800'
                                        : 'bg-rose-100 border-rose-300 text-rose-800'
                                }`}
                            >
                                Overall Rating: {totalWeighted.toFixed(2)}% —{' '}
                                {totalWeighted >= 60 ? 'PASSED (≥60%)' : 'FAILED (<60%)'}
                            </div>
                        </div>

                        {[1, 2, 3, 4].map((cId) => {
                            const currentRating = Number(ratings[cId] || 0);
                            const currentWeighted = CRITERIA_WEIGHT_MAP[cId]?.[currentRating] || 0;

                            return (
                                <div
                                    key={cId}
                                    className="border border-slate-200 rounded-2xl overflow-hidden bg-white shadow-2xs"
                                >
                                    <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                                        <span className="font-black text-xs text-slate-800">
                                            {CRITERIA_LABELS[cId].name} ({CRITERIA_LABELS[cId].maxWeight}%)
                                        </span>
                                        <span className="text-xs font-bold text-orange-700 bg-orange-100 px-2.5 py-0.5 rounded-full">
                                            Weighted Score: {currentWeighted.toFixed(2)}%
                                        </span>
                                    </div>

                                    <div className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-4">
                                        {/* Rating Options (4 to 1) */}
                                        <div className="lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                            {[4, 3, 2, 1].map((rVal) => {
                                                const isSelected = Number(ratings[cId]) === rVal;
                                                const wVal = CRITERIA_WEIGHT_MAP[cId][rVal];
                                                return (
                                                    <label
                                                        key={rVal}
                                                        className={`flex items-start gap-2.5 p-3 rounded-xl border text-xs transition ${
                                                            isReadOnly ? 'cursor-default' : 'cursor-pointer'
                                                        } ${
                                                            isSelected
                                                                ? 'border-orange-500 bg-orange-50/80 ring-2 ring-orange-200'
                                                                : 'border-slate-200 hover:bg-slate-50'
                                                        }`}
                                                    >
                                                        <input
                                                            type="radio"
                                                            name={`criteria_${cId}`}
                                                            value={rVal}
                                                            checked={isSelected}
                                                            disabled={isReadOnly}
                                                            onChange={() =>
                                                                !isReadOnly &&
                                                                setRatings((prev) => ({
                                                                    ...prev,
                                                                    [cId]: String(rVal),
                                                                }))
                                                            }
                                                            className="mt-0.5 accent-orange-600"
                                                        />
                                                        <div className="flex-1">
                                                            <div className="font-bold text-slate-900 flex items-center justify-between">
                                                                <span>Rating {rVal}</span>
                                                                <span className="text-[11px] text-orange-700 font-extrabold">
                                                                    {wVal}%
                                                                </span>
                                                            </div>
                                                            <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                                                                {RATING_DESCRIPTIONS[rVal][cId]}
                                                            </p>
                                                        </div>
                                                    </label>
                                                );
                                            })}
                                        </div>

                                        {/* Remarks / Specific Comments */}
                                        <div className="lg:col-span-4 flex flex-col">
                                            <label className="text-xs font-bold text-slate-600 mb-1.5">
                                                Remarks / Specific Comments
                                            </label>
                                            <textarea
                                                rows={4}
                                                value={remarks[cId] || ''}
                                                readOnly={isReadOnly}
                                                onChange={(e) =>
                                                    setRemarks((prev) => ({
                                                        ...prev,
                                                        [cId]: e.target.value,
                                                    }))
                                                }
                                                placeholder="Provide details of any incidents, commendations, or deviations..."
                                                className={`w-full flex-1 rounded-xl border p-3 text-xs outline-none ${
                                                    isReadOnly
                                                        ? 'bg-slate-50 border-slate-200 text-slate-600'
                                                        : 'bg-white border-slate-300 focus:border-orange-500 focus:ring-2 focus:ring-orange-200'
                                                }`}
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Representative Staff Authorization PDF selector when approving */}
                    {!isReadOnly && effectiveRole === 'presentative_staff' && evaluation.status === 'head review' && (
                        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 text-xs">
                            <h4 className="font-bold text-emerald-900 mb-2">
                                Representative Staff Authorization Letter
                            </h4>
                            {approvedPdfs.length > 0 ? (
                                <select
                                    value={selectedPdfId}
                                    onChange={(e) => setSelectedPdfId(e.target.value)}
                                    className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2"
                                >
                                    {approvedPdfs.map((p) => (
                                        <option key={p.id} value={p.id}>
                                            Approved Authorization PDF #{p.id} ({p.user?.name || user?.name})
                                        </option>
                                    ))}
                                </select>
                            ) : (
                                <p className="text-emerald-700">
                                    Your digital signature on file will be applied on behalf of the Office Head.
                                </p>
                            )}
                        </div>
                    )}

                    {/* Admin option to immediately mark as Approved/Submitted */}
                    {!isReadOnly &&
                        effectiveRole === 'administrator' &&
                        evaluation.status !== 'submitted' && (
                            <label className="flex items-center gap-2.5 p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs font-semibold text-amber-900 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={approveAsHead}
                                    onChange={(e) => setApproveAsHead(e.target.checked)}
                                    className="w-4 h-4 accent-orange-600"
                                />
                                <span>
                                    Immediately finalize and mark status as <strong>Approved / Submitted</strong>
                                </span>
                            </label>
                        )}

                    {/* Section 3: Digital Authorization Signatories */}
                    <div className="bg-white border border-slate-200/90 rounded-3xl p-5 shadow-xs">
                        <div className={`grid gap-5 ${repApproval ? 'grid-cols-1 md:grid-cols-3' : 'grid-cols-1 md:grid-cols-2'}`}>
                            {/* Prepared By (END-USER) */}
                            <div className="rounded-2xl overflow-hidden shadow-xs border border-slate-200 flex flex-col justify-between bg-white">
                                <div className="bg-[#059669] text-white px-4 py-3 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                                        <CheckCircle2 className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold leading-tight">Prepared by (END-USER)</div>
                                        <div className="text-[11px] text-emerald-100 font-normal leading-tight mt-0.5">
                                            Digitally signed and verified evaluator information
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 flex-1 flex flex-col justify-between">
                                    <div className="border border-slate-200 rounded-2xl p-4 bg-white text-center flex-1 flex flex-col justify-between">
                                        <div>
                                            <div className="h-16 flex items-center justify-center my-1">
                                                {(preparedBy?.signed_by || (!isReadOnly && evaluation.status === 'pending' && user?.id)) && (
                                                    <img
                                                        src={`/api/users/${preparedBy?.signed_by || user?.id}/signature`}
                                                        alt="Signature"
                                                        className="max-h-14 object-contain"
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                        }}
                                                    />
                                                )}
                                            </div>
                                            <div className="border-b border-slate-200 w-4/5 mx-auto my-2" />
                                            <div className="text-sm font-bold text-slate-800">
                                                {preparedBy?.full_name || (evaluation.status === 'pending' ? user?.name : '-')}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-0.5">
                                                {preparedBy?.designation || (evaluation.status === 'pending' ? user?.designation : '-')}
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-2">
                                            {preparedDateStr ? (
                                                <div className="text-xs font-medium text-emerald-600 flex items-center justify-center gap-1.5">
                                                    <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                    <span>Signed: {preparedDateStr}</span>
                                                </div>
                                            ) : (!isReadOnly && evaluation.status === 'pending') ? (
                                                <div className="text-xs font-medium text-amber-700 flex items-center justify-center gap-1.5">
                                                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0 animate-pulse" />
                                                    <span>Signing Time: {livePhTime}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Pending Signature</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Head Authorization */}
                            <div className="rounded-2xl overflow-hidden shadow-xs border border-slate-200 flex flex-col justify-between bg-white">
                                <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-3 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                                        <ShieldCheck className="w-4 h-4 text-white" />
                                    </div>
                                    <div>
                                        <div className="text-sm font-bold leading-tight">Head Authorization</div>
                                        <div className="text-[11px] text-blue-100 font-normal leading-tight mt-0.5">
                                            Final approval and digital authorization
                                        </div>
                                    </div>
                                </div>
                                <div className="p-4 flex-1 flex flex-col justify-between">
                                    <div className="border border-slate-200 rounded-2xl p-4 bg-white text-center flex-1 flex flex-col justify-between">
                                        <div>
                                            <div className="h-16 flex items-center justify-center my-1">
                                                {(headApproval?.signed_by || repApproval?.signed_by) && (
                                                    <img
                                                        src={`/api/users/${headApproval?.signed_by || repApproval?.signed_by}/signature`}
                                                        alt="Head Signature"
                                                        className="max-h-14 object-contain"
                                                        onError={(e) => {
                                                            e.target.style.display = 'none';
                                                        }}
                                                    />
                                                )}
                                            </div>
                                            <div className="border-b border-slate-200 w-4/5 mx-auto my-2" />
                                            <div className="text-sm font-bold text-slate-800">
                                                {headApproval?.full_name ||
                                                    evaluation.office_head_name ||
                                                    evaluation.office?.head ||
                                                    '-'}
                                            </div>
                                            <div className="text-xs text-slate-500 mt-0.5">
                                                {headApproval?.designation ||
                                                    evaluation.office_head_designation ||
                                                    evaluation.office?.designation ||
                                                    'Department Head'}
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-2">
                                            {headDateStr ? (
                                                <div className="text-xs font-medium text-blue-600 flex items-center justify-center gap-1.5">
                                                    <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                                                    <span>Approved: {headDateStr}</span>
                                                </div>
                                            ) : (isHeadReviewApproval && !headApproval) ? (
                                                <div className="text-xs font-medium text-amber-700 flex items-center justify-center gap-1.5">
                                                    <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0 animate-pulse" />
                                                    <span>Signing Time: {livePhTime}</span>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-slate-400 italic">Pending Head Approval</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Representative Staff */}
                            {repApproval && (
                                <div className="rounded-2xl overflow-hidden shadow-xs border border-slate-200 flex flex-col justify-between bg-white">
                                    <div className="bg-gradient-to-r from-teal-600 to-emerald-700 text-white px-4 py-3 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                                            <ShieldCheck className="w-4 h-4 text-white" />
                                        </div>
                                        <div>
                                            <div className="text-sm font-bold leading-tight">Representative Staff</div>
                                            <div className="text-[11px] text-teal-100 font-normal leading-tight mt-0.5">
                                                Authorized representative digital authorization
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 flex-1 flex flex-col justify-between">
                                        <div className="border border-slate-200 rounded-2xl p-4 bg-white text-center flex-1 flex flex-col justify-between">
                                            <div>
                                                <div className="h-16 flex items-center justify-center my-1">
                                                    {repApproval.signed_by && (
                                                        <img
                                                            src={`/api/users/${repApproval.signed_by}/signature`}
                                                            alt="Rep Signature"
                                                            className="max-h-14 object-contain"
                                                            onError={(e) => {
                                                                e.target.style.display = 'none';
                                                            }}
                                                        />
                                                    )}
                                                </div>
                                                <div className="border-b border-slate-200 w-4/5 mx-auto my-2" />
                                                <div className="text-sm font-bold text-slate-800">
                                                    {repApproval.full_name || '-'}
                                                </div>
                                                <div className="text-xs text-slate-500 mt-0.5">
                                                    {repApproval.designation || 'Representative Staff'}
                                                </div>
                                            </div>
                                            <div className="mt-4 pt-2">
                                                {repDateStr ? (
                                                    <div className="text-xs font-medium text-teal-700 flex items-center justify-center gap-1.5">
                                                        <Clock className="w-3.5 h-3.5 text-teal-700 shrink-0" />
                                                        <span>Approved: {repDateStr}</span>
                                                    </div>
                                                ) : (isHeadReviewApproval && effectiveRole === 'presentative_staff') ? (
                                                    <div className="text-xs font-medium text-amber-700 flex items-center justify-center gap-1.5">
                                                        <Clock className="w-3.5 h-3.5 text-amber-600 shrink-0 animate-pulse" />
                                                        <span>Signing Time: {livePhTime}</span>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-slate-400 italic">Pending Signature</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer Buttons */}
                    <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-5 py-2.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold transition cursor-pointer"
                        >
                            Close
                        </button>
                        {!isReadOnly && (
                            <button
                                type="submit"
                                disabled={submitting}
                                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white text-xs font-bold shadow-md transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                            >
                                {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                                <span>
                                    {isHeadReviewApproval
                                        ? effectiveRole === 'head'
                                            ? '✓ Approve & Sign as Office Head'
                                            : '✓ Approve & Sign as Representative Staff'
                                        : evaluation.status === 'pending'
                                        ? '✓ Submit Evaluation to Head Review'
                                        : '✓ Save Updated Evaluation'}
                                </span>
                            </button>
                        )}
                    </div>
                </form>
            </div>
        </div>
    );
}

/**
 * 2. Add New Evaluation Modal (+ Evaluation button for Admin / PGSO)
 */
export function AddEvaluationModal({ offices = [], suppliers = [], onClose, onSuccess }) {
    const [poNo, setPoNo] = useState('');
    const [supplierName, setSupplierName] = useState('');
    const [officeId, setOfficeId] = useState(offices[0]?.id ? String(offices[0].id) : '');
    const [coveredPeriod, setCoveredPeriod] = useState(`CY ${new Date().getFullYear()}`);
    const [dateEvaluation, setDateEvaluation] = useState(new Date().toISOString().slice(0, 10));
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            const res = await supplierEvaluationService.createEvaluation({
                po_no: poNo,
                supplier_name: supplierName,
                office_id: Number(officeId),
                covered_period: coveredPeriod,
                date_evaluation: dateEvaluation,
            });
            if (onSuccess) onSuccess(res.data);
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to create evaluation.');
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200">
                <div className="bg-gradient-to-r from-orange-500 to-amber-600 px-6 py-4 text-white flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-black">+ Add Supplier Evaluation</h3>
                        <p className="text-xs text-orange-100">Create a new pending evaluation record</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
                    {error && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                            {error}
                        </div>
                    )}

                    <div>
                        <label className="block font-bold text-slate-700 mb-1">P.O. / Contract Number *</label>
                        <input
                            type="text"
                            required
                            value={poNo}
                            onChange={(e) => setPoNo(e.target.value)}
                            placeholder="e.g. 0001-AM-26"
                            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 font-mono"
                        />
                    </div>

                    <div>
                        <label className="block font-bold text-slate-700 mb-1">Supplier / Company Name *</label>
                        <input
                            type="text"
                            required
                            list="supplier-datalist"
                            value={supplierName}
                            onChange={(e) => setSupplierName(e.target.value)}
                            placeholder="Enter or select supplier name"
                            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5"
                        />
                        <datalist id="supplier-datalist">
                            {suppliers.map((s, idx) => (
                                <option key={idx} value={s} />
                            ))}
                        </datalist>
                    </div>

                    <div>
                        <label className="block font-bold text-slate-700 mb-1">End-User Office / Department *</label>
                        <select
                            required
                            value={officeId}
                            onChange={(e) => setOfficeId(e.target.value)}
                            className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 bg-white"
                        >
                            <option value="">Select Office</option>
                            {offices.map((o) => (
                                <option key={o.id} value={o.id}>
                                    {o.code ? `${o.code} — ${o.name}` : o.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block font-bold text-slate-700 mb-1">Covered Period (CY) *</label>
                            <input
                                type="text"
                                required
                                value={coveredPeriod}
                                onChange={(e) => setCoveredPeriod(e.target.value)}
                                placeholder="e.g. CY 2026"
                                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5"
                            />
                        </div>
                        <div>
                            <label className="block font-bold text-slate-700 mb-1">Date of Evaluation *</label>
                            <input
                                type="date"
                                required
                                value={dateEvaluation}
                                onChange={(e) => setDateEvaluation(e.target.value)}
                                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5"
                            />
                        </div>
                    </div>

                    <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 font-bold cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                        >
                            {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            <span>Create Evaluation</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}

/**
 * 3. Purchase Order List & Bulk PO Add Modal (polist.blade.php + editPo.blade.php + pobulk.blade.php)
 */
export function PurchaseOrdersModal({
    effectiveRole,
    userOffice = null,
    offices = [],
    endUsers = [],
    suppliers = [],
    onClose,
    onEvaluationAdded,
}) {
    const [tab, setTab] = useState('list'); // 'list' | 'bulk_add' | 'create_po'
    const [pos, setPos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [pdfSort, setPdfSort] = useState('');
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);

    // Edit PO state
    const [editingPo, setEditingPo] = useState(null);
    const [editForm, setEditForm] = useState({
        po_no: '',
        pr_no: '',
        supplier: '',
        item: '',
        end_user: '',
        status: 'Pending',
        remove_pdf: '0',
        pdf_file: null,
    });
    const [savingPo, setSavingPo] = useState(false);

    // Bulk Add PO state
    const [bulkEndUser, setBulkEndUser] = useState('');
    const [bulkSupplier, setBulkSupplier] = useState('');
    const [bulkPos, setBulkPos] = useState([]);
    const [selectedPoIds, setSelectedPoIds] = useState([]);
    const [loadingBulk, setLoadingBulk] = useState(false);
    const [scopedSuppliers, setScopedSuppliers] = useState(suppliers);
    const [scopedEndUsers, setScopedEndUsers] = useState(endUsers);

    useEffect(() => {
        if (suppliers && suppliers.length > 0) {
            setScopedSuppliers(suppliers);
        }
    }, [suppliers]);

    useEffect(() => {
        if (endUsers && endUsers.length > 0) {
            setScopedEndUsers(endUsers);
        }
    }, [endUsers]);

    // Create PO state
    const [newPo, setNewPo] = useState({
        po_no: '',
        pr_no: '',
        supplier: '',
        end_user: '',
        item: `CY ${new Date().getFullYear()}`,
        pdf_file: null,
    });

    const [perPage, setPerPage] = useState(10);
    const [bulkPage, setBulkPage] = useState(1);
    const [bulkPageSize, setBulkPageSize] = useState(10);

    const isAdminOrPgso = effectiveRole === 'administrator' || effectiveRole === 'pgso';

    const fetchPos = async (targetPage = page, customPerPage = perPage) => {
        setLoading(true);
        try {
            const res = await supplierEvaluationService.getPurchaseOrders({
                page: targetPage,
                search,
                pdf_sort: pdfSort,
                per_page: customPerPage,
            });
            setPos(res.data.data || []);
            setPage(res.data.current_page || 1);
            setLastPage(res.data.last_page || 1);
            setTotal(res.data.total || 0);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const t = setTimeout(() => fetchPos(1), 200);
        return () => clearTimeout(t);
    }, [search, pdfSort]);

    const loadBulkAvailablePos = async () => {
        setLoadingBulk(true);
        try {
            const res = await supplierEvaluationService.getBulkPoList({
                end_user: bulkEndUser,
                supplier: bulkSupplier,
            });
            const list = Array.isArray(res.data) ? res.data : (res.data?.data || []);
            setBulkPos(list);
            if (res.data?.suppliers && res.data.suppliers.length > 0) {
                setScopedSuppliers(res.data.suppliers);
            }
            if (res.data?.end_users && res.data.end_users.length > 0) {
                setScopedEndUsers(res.data.end_users);
            }
            setSelectedPoIds([]);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingBulk(false);
        }
    };

    useEffect(() => {
        if (tab === 'bulk_add') {
            loadBulkAvailablePos();
        }
    }, [tab, bulkEndUser, bulkSupplier]);

    const handleAddSinglePoToEval = async (po) => {
        try {
            await supplierEvaluationService.createEvaluation({
                po_no: po.po_no,
                supplier_name: po.supplier,
                end_user: po.end_user,
                covered_period: po.item || `CY ${new Date().getFullYear()}`,
                date_evaluation: new Date().toISOString().slice(0, 10),
            });
            fetchPos(page);
            if (onEvaluationAdded) onEvaluationAdded();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to add PO to evaluations.');
        }
    };

    const handleQuickPdfUpload = async (poId, file) => {
        if (!file) return;
        const fd = new FormData();
        fd.append('pdf_po', file);
        try {
            await supplierEvaluationService.uploadPoPdf(poId, fd);
            fetchPos(page);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to upload PDF.');
        }
    };

    const handleSaveEditPo = async (e) => {
        e.preventDefault();
        if (!editingPo) return;
        setSavingPo(true);
        try {
            const fd = new FormData();
            fd.append('po_no', editForm.po_no);
            fd.append('pr_no', editForm.pr_no || '');
            fd.append('supplier', editForm.supplier);
            fd.append('item', editForm.item || '');
            fd.append('end_user', editForm.end_user);
            fd.append('status', editForm.status);
            fd.append('remove_pdf', editForm.remove_pdf);
            if (editForm.pdf_file) {
                fd.append('pdf_po', editForm.pdf_file);
            }
            await supplierEvaluationService.updatePurchaseOrder(editingPo.id, fd);
            setEditingPo(null);
            fetchPos(page);
            if (onEvaluationAdded) onEvaluationAdded();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to update Purchase Order.');
        } finally {
            setSavingPo(false);
        }
    };

    const handleCreatePo = async (e) => {
        e.preventDefault();
        setSavingPo(true);
        try {
            const fd = new FormData();
            fd.append('po_no', newPo.po_no);
            fd.append('pr_no', newPo.pr_no || '');
            fd.append('supplier', newPo.supplier);
            fd.append('end_user', newPo.end_user);
            fd.append('item', newPo.item || '');
            if (newPo.pdf_file) {
                fd.append('pdf_po', newPo.pdf_file);
            }
            await supplierEvaluationService.createPurchaseOrder(fd);
            setNewPo({
                po_no: '',
                pr_no: '',
                supplier: '',
                end_user: '',
                item: `CY ${new Date().getFullYear()}`,
                pdf_file: null,
            });
            setTab('list');
            fetchPos(1);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to create Purchase Order.');
        } finally {
            setSavingPo(false);
        }
    };

    const handleBulkSubmitPos = async () => {
        if (selectedPoIds.length === 0) return;
        setSavingPo(true);
        try {
            await supplierEvaluationService.storeBulkPoEvaluations({
                po_ids: selectedPoIds,
            });
            loadBulkAvailablePos();
            if (onEvaluationAdded) onEvaluationAdded();
            setTab('list');
            fetchPos(page);
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to add selected POs.');
        } finally {
            setSavingPo(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
                {/* Header */}
                <div className="bg-gradient-to-r from-orange-500 to-amber-600 px-6 py-4 text-white flex items-center justify-between shrink-0">
                    <div>
                        <h2 className="text-lg font-black">📦 Purchase Orders Management</h2>
                        <p className="text-xs text-orange-100">
                            Total Purchase Orders: {total.toLocaleString()} • View PDF, Add to Evaluation, or Bulk Select
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setTab('list')}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                                tab === 'list' ? 'bg-white text-orange-700 shadow-xs' : 'bg-white/20 text-white hover:bg-white/30'
                            }`}
                        >
                            P.O. List
                        </button>
                        <button
                            type="button"
                            onClick={() => setTab('bulk_add')}
                            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                                tab === 'bulk_add'
                                    ? 'bg-white text-emerald-700 shadow-xs'
                                    : 'bg-emerald-600/80 text-white hover:bg-emerald-600'
                            }`}
                        >
                            📋 Bulk Add Evaluation
                        </button>
                        {isAdminOrPgso && (
                            <button
                                type="button"
                                onClick={() => setTab('create_po')}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                                    tab === 'create_po'
                                        ? 'bg-white text-orange-700 shadow-xs'
                                        : 'bg-white/20 text-white hover:bg-white/30'
                                }`}
                            >
                                + Add P.O.
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* TAB 1: PO LIST */}
                {tab === 'list' && (
                    <div className="flex-1 flex flex-col overflow-hidden p-5">
                        {/* Search & Sort Bar */}
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                            <div className="relative flex-1 min-w-[260px]">
                                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Search P.O. No., P.R. No., Supplier, End User, or Status..."
                                    className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-300 text-xs outline-none focus:border-orange-500"
                                />
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setPdfSort((prev) =>
                                            prev === 'has_pdf' ? 'no_pdf' : prev === 'no_pdf' ? '' : 'has_pdf'
                                        )
                                    }
                                    className="px-3.5 py-2 rounded-xl border border-orange-200 bg-orange-50 text-orange-700 text-xs font-bold cursor-pointer hover:bg-orange-100"
                                >
                                    {pdfSort === 'has_pdf'
                                        ? '📄 Showing: Has PDF First'
                                        : pdfSort === 'no_pdf'
                                        ? '⚠️ Showing: No PDF First'
                                        : '↕ Sort by PDF Status'}
                                </button>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="flex-1 overflow-auto border border-slate-200 rounded-2xl">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-100 text-slate-600 uppercase text-[11px] sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3">P.O. Number</th>
                                        <th className="px-4 py-3">P.R. Number</th>
                                        <th className="px-4 py-3">Supplier</th>
                                        <th className="px-4 py-3">End User</th>
                                        <th className="px-4 py-3 text-center">P.O. PDF</th>
                                        <th className="px-4 py-3 text-center">Status</th>
                                        <th className="px-4 py-3 text-center">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loading ? (
                                        <tr>
                                            <td colSpan={7} className="py-12 text-center text-slate-400">
                                                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-orange-500" />
                                                Loading Purchase Orders...
                                            </td>
                                        </tr>
                                    ) : pos.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="py-12 text-center text-slate-400">
                                                No Purchase Orders found.
                                            </td>
                                        </tr>
                                    ) : (
                                        pos.map((po) => (
                                            <tr key={po.id} className="hover:bg-orange-50/40 transition">
                                                <td className="px-4 py-3 font-mono font-bold text-slate-900">
                                                    {po.po_no}
                                                </td>
                                                <td className="px-4 py-3 font-mono text-slate-600">
                                                    {po.pr_no || '-'}
                                                </td>
                                                <td className="px-4 py-3 font-medium text-slate-800">{po.supplier}</td>
                                                <td className="px-4 py-3 font-semibold text-slate-700">
                                                    {po.end_user}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {po.has_pdf ? (
                                                        <a
                                                            href={po.pdf_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700 font-bold hover:bg-rose-200 transition"
                                                        >
                                                            <FileText className="w-3.5 h-3.5" />
                                                            <span>View PDF</span>
                                                        </a>
                                                    ) : (
                                                        <label className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-orange-100 text-slate-600 hover:text-orange-700 font-semibold cursor-pointer transition">
                                                            <Upload className="w-3.5 h-3.5" />
                                                            <span>Upload PDF</span>
                                                            <input
                                                                type="file"
                                                                accept="application/pdf"
                                                                className="hidden"
                                                                onChange={(e) =>
                                                                    handleQuickPdfUpload(po.id, e.target.files?.[0])
                                                                }
                                                            />
                                                        </label>
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <span
                                                        className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${
                                                            po.status === 'Approved'
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : po.status === 'Added'
                                                                ? 'bg-blue-100 text-blue-700'
                                                                : 'bg-amber-100 text-amber-700'
                                                        }`}
                                                    >
                                                        {po.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        {po.status === 'Pending' && (
                                                            <button
                                                                type="button"
                                                                onClick={() => handleAddSinglePoToEval(po)}
                                                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px] cursor-pointer"
                                                            >
                                                                + Evaluate
                                                            </button>
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                setEditingPo(po);
                                                                setEditForm({
                                                                    po_no: po.po_no || '',
                                                                    pr_no: po.pr_no || '',
                                                                    supplier: po.supplier || '',
                                                                    item: po.item || `CY ${new Date().getFullYear()}`,
                                                                    end_user: po.end_user || '',
                                                                    status: po.status || 'Pending',
                                                                    remove_pdf: '0',
                                                                    pdf_file: null,
                                                                });
                                                            }}
                                                            className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-[11px] cursor-pointer"
                                                        >
                                                            {isAdminOrPgso ? 'View / Edit' : 'Details'}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Footer */}
                        <div className="pt-4 border-t border-slate-200">
                            <PaginationControl
                                currentPage={page}
                                totalPages={lastPage}
                                onPageChange={(p) => fetchPos(p, perPage)}
                                perPage={perPage}
                                onPerPageChange={(size) => {
                                    setPerPage(size);
                                    fetchPos(1, size);
                                }}
                                totalEntries={total}
                                startIndex={(page - 1) * perPage}
                                endIndex={Math.min(page * perPage, total)}
                                theme="orange"
                                perPageOptions={[10, 25, 50]}
                            />
                        </div>
                    </div>
                )}

                {/* TAB 2: BULK ADD EVALUATION FROM POs (pobulk.blade.php) */}
                {tab === 'bulk_add' && (
                    <div className="flex-1 flex flex-col overflow-hidden p-6">
                        {/* Respective Office Scope Notification for End Users */}
                        {!isAdminOrPgso && userOffice && (
                            <div className="mb-3.5 px-4 py-2.5 bg-blue-50/90 border border-blue-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-blue-900 shadow-2xs">
                                <span className="flex items-center gap-2">
                                    <span className="w-2.5 h-2.5 rounded-full bg-blue-600 animate-pulse shrink-0" />
                                    <span>
                                        Scoped to your respective office:{' '}
                                        <strong className="font-extrabold text-blue-950">
                                            {userOffice.name || userOffice.code}
                                            {userOffice.code ? ` (${userOffice.code})` : ''}
                                        </strong>
                                    </span>
                                </span>
                                <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-100/80 px-2.5 py-0.5 rounded-lg border border-blue-200 self-start sm:self-center">
                                    {bulkPos.length} Pending PO{bulkPos.length === 1 ? '' : 's'}
                                </span>
                            </div>
                        )}

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200 mb-4 text-xs">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    {isAdminOrPgso ? 'Filter by End User' : 'Filter by Office Unit'}
                                </label>
                                <select
                                    value={bulkEndUser}
                                    onChange={(e) => setBulkEndUser(e.target.value)}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-medium"
                                >
                                    <option value="">
                                        {isAdminOrPgso
                                            ? 'All End Users'
                                            : `All ${userOffice?.code || 'Office'} Units`}
                                    </option>
                                    {scopedEndUsers.map((eu, i) => (
                                        <option key={i} value={eu}>
                                            {eu}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Filter by Supplier
                                </label>
                                <select
                                    value={bulkSupplier}
                                    onChange={(e) => setBulkSupplier(e.target.value)}
                                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-medium"
                                >
                                    <option value="">All Suppliers ({scopedSuppliers.length})</option>
                                    {scopedSuppliers.map((s, i) => (
                                        <option key={i} value={s}>
                                            {s}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="flex-1 overflow-auto border border-slate-200 rounded-2xl">
                            <table className="w-full text-xs text-left">
                                <thead className="bg-slate-100 text-slate-600 uppercase sticky top-0">
                                    <tr>
                                        <th className="px-4 py-3 text-center w-12">
                                            <input
                                                type="checkbox"
                                                checked={
                                                    bulkPos.length > 0 && selectedPoIds.length === bulkPos.length
                                                }
                                                onChange={(e) =>
                                                    setSelectedPoIds(
                                                        e.target.checked ? bulkPos.map((p) => p.id) : []
                                                    )
                                                }
                                                className="w-4 h-4 accent-emerald-600"
                                            />
                                        </th>
                                        <th className="px-4 py-3">PO No</th>
                                        <th className="px-4 py-3">PR No</th>
                                        <th className="px-4 py-3">End User</th>
                                        <th className="px-4 py-3">Supplier</th>
                                        <th className="px-4 py-3 text-center">Status</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {loadingBulk ? (
                                        <tr>
                                            <td colSpan={6} className="py-10 text-center text-slate-400">
                                                Loading available Purchase Orders...
                                            </td>
                                        </tr>
                                    ) : bulkPos.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="py-10 text-center text-slate-400">
                                                No pending Purchase Orders found for your respective office with the selected filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        (() => {
                                            const totalBulkPages = Math.ceil(bulkPos.length / bulkPageSize) || 1;
                                            const validBulkPage = Math.min(bulkPage, totalBulkPages);
                                            const bulkStartIndex = (validBulkPage - 1) * bulkPageSize;
                                            const bulkEndIndex = bulkStartIndex + bulkPageSize;
                                            const paginatedBulkPos = bulkPos.slice(bulkStartIndex, bulkEndIndex);

                                            return paginatedBulkPos.map((po) => {
                                                const checked = selectedPoIds.includes(po.id);
                                                return (
                                                    <tr
                                                        key={po.id}
                                                        onClick={() =>
                                                            setSelectedPoIds((prev) =>
                                                                checked
                                                                    ? prev.filter((id) => id !== po.id)
                                                                    : [...prev, po.id]
                                                            )
                                                        }
                                                        className="hover:bg-emerald-50/50 cursor-pointer"
                                                    >
                                                        <td className="px-4 py-2.5 text-center">
                                                            <input
                                                                type="checkbox"
                                                                checked={checked}
                                                                onChange={() => {}}
                                                                className="w-4 h-4 accent-emerald-600"
                                                            />
                                                        </td>
                                                        <td className="px-4 py-2.5 font-mono font-bold">{po.po_no}</td>
                                                        <td className="px-4 py-2.5 font-mono">{po.pr_no || '-'}</td>
                                                        <td className="px-4 py-2.5">{po.end_user}</td>
                                                        <td className="px-4 py-2.5 font-medium">{po.supplier}</td>
                                                        <td className="px-4 py-2.5 text-center">
                                                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-bold text-[10px]">
                                                                ✓ Available
                                                            </span>
                                                        </td>
                                                    </tr>
                                                );
                                            });
                                        })()
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Bulk POs Pagination */}
                        {bulkPos.length > 0 && (
                            <div className="pt-3 border-t border-slate-200">
                                <PaginationControl
                                    currentPage={Math.min(bulkPage, Math.ceil(bulkPos.length / bulkPageSize) || 1)}
                                    totalPages={Math.ceil(bulkPos.length / bulkPageSize) || 1}
                                    onPageChange={(p) => setBulkPage(p)}
                                    perPage={bulkPageSize}
                                    onPerPageChange={(size) => {
                                        setBulkPageSize(size);
                                        setBulkPage(1);
                                    }}
                                    totalEntries={bulkPos.length}
                                    startIndex={(Math.min(bulkPage, Math.ceil(bulkPos.length / bulkPageSize) || 1) - 1) * bulkPageSize}
                                    endIndex={Math.min(Math.min(bulkPage, Math.ceil(bulkPos.length / bulkPageSize) || 1) * bulkPageSize, bulkPos.length)}
                                    theme="orange"
                                    perPageOptions={[10, 25, 50]}
                                />
                            </div>
                        )}

                        <div className="flex items-center justify-between pt-4 text-xs">
                            <div>
                                Selected POs:{' '}
                                <span className="px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 font-black">
                                    {selectedPoIds.length}
                                </span>
                            </div>
                            <button
                                type="button"
                                disabled={selectedPoIds.length === 0 || savingPo}
                                onClick={handleBulkSubmitPos}
                                className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold shadow-xs disabled:opacity-50 cursor-pointer"
                            >
                                ✓ Add Selected ({selectedPoIds.length}) to Evaluations
                            </button>
                        </div>
                    </div>
                )}

                {/* TAB 3: CREATE NEW PO */}
                {tab === 'create_po' && (
                    <form onSubmit={handleCreatePo} className="p-6 space-y-4 text-xs max-w-xl mx-auto w-full">
                        <h3 className="text-sm font-black text-slate-800">Create New Purchase Order</h3>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">P.O. Number *</label>
                                <input
                                    type="text"
                                    required
                                    value={newPo.po_no}
                                    onChange={(e) => setNewPo({ ...newPo, po_no: e.target.value })}
                                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                                />
                            </div>
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">P.R. Number</label>
                                <input
                                    type="text"
                                    value={newPo.pr_no}
                                    onChange={(e) => setNewPo({ ...newPo, pr_no: e.target.value })}
                                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block font-bold text-slate-700 mb-1">Supplier *</label>
                            <input
                                type="text"
                                required
                                value={newPo.supplier}
                                onChange={(e) => setNewPo({ ...newPo, supplier: e.target.value })}
                                className="w-full rounded-xl border border-slate-300 px-3 py-2"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    End User (Office Code/Abbr) *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={newPo.end_user}
                                    onChange={(e) => setNewPo({ ...newPo, end_user: e.target.value })}
                                    placeholder="e.g. PGSO, PBO, PMO"
                                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                                />
                            </div>
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Covered Period (CY)</label>
                                <input
                                    type="text"
                                    value={newPo.item}
                                    onChange={(e) => setNewPo({ ...newPo, item: e.target.value })}
                                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block font-bold text-slate-700 mb-1">Purchase Order PDF (Optional)</label>
                            <input
                                type="file"
                                accept="application/pdf"
                                onChange={(e) => setNewPo({ ...newPo, pdf_file: e.target.files?.[0] || null })}
                                className="w-full rounded-xl border border-slate-300 p-2"
                            />
                        </div>
                        <div className="flex justify-end gap-2 pt-3">
                            <button
                                type="button"
                                onClick={() => setTab('list')}
                                className="px-4 py-2 rounded-xl border border-slate-300 font-bold"
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={savingPo}
                                className="px-5 py-2 rounded-xl bg-orange-600 text-white font-bold cursor-pointer"
                            >
                                Save Purchase Order
                            </button>
                        </div>
                    </form>
                )}

                {/* EDIT PO SUB-MODAL (editPo.blade.php) */}
                {editingPo && (
                    <div className="fixed inset-0 z-60 bg-black/50 flex items-center justify-center p-4">
                        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                            <div className="bg-gradient-to-r from-orange-500 to-amber-500 px-5 py-4 text-white flex items-center justify-between">
                                <h3 className="font-bold text-sm">Purchase Order Details — {editingPo.po_no}</h3>
                                <button
                                    type="button"
                                    onClick={() => setEditingPo(null)}
                                    className="text-white cursor-pointer"
                                >
                                    ✕
                                </button>
                            </div>
                            <form onSubmit={handleSaveEditPo} className="p-5 space-y-3.5 text-xs">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-bold text-slate-700 mb-1">P.O. Number</label>
                                        <input
                                            type="text"
                                            readOnly={!isAdminOrPgso}
                                            value={editForm.po_no}
                                            onChange={(e) => setEditForm({ ...editForm, po_no: e.target.value })}
                                            className="w-full rounded-xl border border-slate-300 px-3 py-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-bold text-slate-700 mb-1">P.R. Number</label>
                                        <input
                                            type="text"
                                            readOnly={!isAdminOrPgso}
                                            value={editForm.pr_no}
                                            onChange={(e) => setEditForm({ ...editForm, pr_no: e.target.value })}
                                            className="w-full rounded-xl border border-slate-300 px-3 py-2"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Supplier</label>
                                    <input
                                        type="text"
                                        readOnly={!isAdminOrPgso}
                                        value={editForm.supplier}
                                        onChange={(e) => setEditForm({ ...editForm, supplier: e.target.value })}
                                        className="w-full rounded-xl border border-slate-300 px-3 py-2"
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block font-bold text-slate-700 mb-1">End User</label>
                                        <input
                                            type="text"
                                            readOnly={!isAdminOrPgso}
                                            value={editForm.end_user}
                                            onChange={(e) => setEditForm({ ...editForm, end_user: e.target.value })}
                                            className="w-full rounded-xl border border-slate-300 px-3 py-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-bold text-slate-700 mb-1">Covered Period (CY)</label>
                                        <input
                                            type="text"
                                            readOnly={!isAdminOrPgso}
                                            value={editForm.item}
                                            onChange={(e) => setEditForm({ ...editForm, item: e.target.value })}
                                            className="w-full rounded-xl border border-slate-300 px-3 py-2"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Status</label>
                                    <select
                                        disabled={!isAdminOrPgso}
                                        value={editForm.status}
                                        onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                                        className="w-full rounded-xl border border-slate-300 px-3 py-2 bg-white"
                                    >
                                        <option value="Pending">Pending</option>
                                        <option value="Added">Added</option>
                                        <option value="Approved">Approved</option>
                                        <option value="Cancelled">Cancelled</option>
                                    </select>
                                </div>

                                {isAdminOrPgso && (
                                    <div>
                                        <label className="block font-bold text-slate-700 mb-1">
                                            Replace / Upload Purchase Order PDF
                                        </label>
                                        <input
                                            type="file"
                                            accept="application/pdf"
                                            onChange={(e) =>
                                                setEditForm({ ...editForm, pdf_file: e.target.files?.[0] || null })
                                            }
                                            className="w-full rounded-xl border border-slate-300 p-2"
                                        />
                                    </div>
                                )}

                                <div className="flex justify-end gap-2 pt-3 border-t">
                                    <button
                                        type="button"
                                        onClick={() => setEditingPo(null)}
                                        className="px-4 py-2 rounded-xl border border-slate-300 font-bold cursor-pointer"
                                    >
                                        Close
                                    </button>
                                    {isAdminOrPgso && (
                                        <button
                                            type="submit"
                                            disabled={savingPo}
                                            className="px-5 py-2 rounded-xl bg-orange-600 text-white font-bold cursor-pointer"
                                        >
                                            Update P.O.
                                        </button>
                                    )}
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/**
 * 4. Evaluation Update / Delete Requests Modal (request.blade.php)
 */
export function RequestsModal({ effectiveRole, onClose, onUpdated }) {
    const [requests, setRequests] = useState([]);
    const [evalDropdown, setEvalDropdown] = useState([]);
    const [loading, setLoading] = useState(true);
    const [evaluationId, setEvaluationId] = useState('');
    const [requestType, setRequestType] = useState('update');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [requestPage, setRequestPage] = useState(1);
    const [requestPageSize, setRequestPageSize] = useState(10);

    const isAdminOrPgso = effectiveRole === 'administrator' || effectiveRole === 'pgso';

    const loadData = async () => {
        setLoading(true);
        try {
            const res = await supplierEvaluationService.getRequests();
            setRequests(res.data.requests || []);
            setEvalDropdown(res.data.evaluations_dropdown || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleSubmitRequest = async (e) => {
        e.preventDefault();
        if (!evaluationId || !reason.trim()) return;
        setSubmitting(true);
        try {
            await supplierEvaluationService.createRequest({
                evaluation_id: Number(evaluationId),
                request_type: requestType,
                reason,
            });
            setEvaluationId('');
            setReason('');
            loadData();
            if (onUpdated) onUpdated();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to submit request.');
        } finally {
            setSubmitting(false);
        }
    };

    const handleApprove = async (id) => {
        await supplierEvaluationService.approveRequest(id);
        loadData();
        if (onUpdated) onUpdated();
    };

    const handleReject = async (id) => {
        await supplierEvaluationService.rejectRequest(id);
        loadData();
        if (onUpdated) onUpdated();
    };

    const handleCancel = async (id) => {
        await supplierEvaluationService.cancelRequest(id);
        loadData();
        if (onUpdated) onUpdated();
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 to-amber-600 px-6 py-4 text-white flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-black">📩 Evaluation Edit / Delete Requests</h3>
                        <p className="text-xs text-orange-100">
                            {isAdminOrPgso
                                ? 'Review and approve or reject evaluation modification requests from End Users'
                                : 'Request permission from the Administrator to update or delete an evaluation'}
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
                    {/* Create Request Form (for End Users / Staff) */}
                    {!isAdminOrPgso && (
                        <form
                            onSubmit={handleSubmitRequest}
                            className="bg-orange-50/70 border border-orange-200 rounded-2xl p-4 space-y-3"
                        >
                            <h4 className="font-black text-slate-800">Submit New Request</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                <div className="md:col-span-2">
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Select Evaluation (P.O. No. — Supplier) *
                                    </label>
                                    <select
                                        required
                                        value={evaluationId}
                                        onChange={(e) => setEvaluationId(e.target.value)}
                                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                    >
                                        <option value="">-- Choose Evaluation --</option>
                                        {evalDropdown.map((ev) => (
                                            <option key={ev.id} value={ev.id}>
                                                {ev.po_no} — {ev.supplier_name} ({ev.status})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">Request Type *</label>
                                    <select
                                        value={requestType}
                                        onChange={(e) => setRequestType(e.target.value)}
                                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                    >
                                        <option value="update">Update / Edit Evaluation</option>
                                        <option value="delete">Delete Evaluation</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <label className="block font-bold text-slate-700 mb-1">Reason for Request *</label>
                                <textarea
                                    rows={2}
                                    required
                                    value={reason}
                                    onChange={(e) => setReason(e.target.value)}
                                    placeholder="Explain why this evaluation needs to be updated or deleted..."
                                    className="w-full rounded-xl border border-slate-300 bg-white p-2.5"
                                />
                            </div>
                            <div className="flex justify-end">
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-5 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold cursor-pointer"
                                >
                                    Submit Request
                                </button>
                            </div>
                        </form>
                    )}

                    {/* Requests Table */}
                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 text-slate-600 uppercase text-[11px]">
                                <tr>
                                    <th className="px-4 py-3">P.O. No.</th>
                                    <th className="px-4 py-3">Supplier</th>
                                    <th className="px-4 py-3">Requested By</th>
                                    <th className="px-4 py-3">Type</th>
                                    <th className="px-4 py-3">Reason</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                    <th className="px-4 py-3 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="py-8 text-center text-slate-400">
                                            Loading requests...
                                        </td>
                                    </tr>
                                ) : requests.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="py-8 text-center text-slate-400">
                                            No requests found.
                                        </td>
                                    </tr>
                                ) : (
                                    (() => {
                                        const totalRequestPages = Math.ceil(requests.length / requestPageSize) || 1;
                                        const validRequestPage = Math.min(requestPage, totalRequestPages);
                                        const reqStartIndex = (validRequestPage - 1) * requestPageSize;
                                        const reqEndIndex = reqStartIndex + requestPageSize;
                                        const paginatedRequests = requests.slice(reqStartIndex, reqEndIndex);

                                        return paginatedRequests.map((r) => (
                                            <tr key={r.id} className="hover:bg-slate-50">
                                                <td className="px-4 py-3 font-mono font-bold">{r.po_no}</td>
                                                <td className="px-4 py-3">{r.supplier_name}</td>
                                                <td className="px-4 py-3">
                                                    <div className="font-semibold text-slate-800">{r.user_name}</div>
                                                    <div className="text-[10px] text-slate-500">{r.office_name}</div>
                                                </td>
                                                <td className="px-4 py-3 uppercase font-bold text-[10px]">
                                                    <span
                                                        className={`px-2 py-0.5 rounded-md ${
                                                            r.request_type === 'delete'
                                                                ? 'bg-rose-100 text-rose-700'
                                                                : 'bg-blue-100 text-blue-700'
                                                        }`}
                                                    >
                                                        {r.request_type}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 max-w-xs">{r.reason}</td>
                                                <td className="px-4 py-3 text-center">
                                                    <span
                                                        className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                            r.status === 'approved' || r.status === 'completed'
                                                                ? 'bg-emerald-100 text-emerald-700'
                                                                : r.status === 'rejected'
                                                                ? 'bg-rose-100 text-rose-700'
                                                                : 'bg-amber-100 text-amber-700'
                                                        }`}
                                                    >
                                                        {r.status}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3 text-center">
                                                    {isAdminOrPgso && r.status === 'pending' && (
                                                        <div className="flex items-center justify-center gap-1.5">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleApprove(r.id)}
                                                                className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] cursor-pointer"
                                                            >
                                                                Approve
                                                            </button>
                                                            <button
                                                                type="button"
                                                                onClick={() => handleReject(r.id)}
                                                                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-[10px] cursor-pointer"
                                                            >
                                                                Reject
                                                            </button>
                                                        </div>
                                                    )}
                                                    {!isAdminOrPgso && r.status === 'pending' && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleCancel(r.id)}
                                                            className="px-2.5 py-1 rounded-lg bg-slate-200 hover:bg-rose-100 text-slate-700 hover:text-rose-700 font-bold text-[10px] cursor-pointer"
                                                        >
                                                            Cancel
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ));
                                    })()
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Requests Pagination */}
                    {requests.length > 0 && (
                        <div className="pt-2 border-t border-slate-200">
                            <PaginationControl
                                currentPage={Math.min(requestPage, Math.ceil(requests.length / requestPageSize) || 1)}
                                totalPages={Math.ceil(requests.length / requestPageSize) || 1}
                                onPageChange={(p) => setRequestPage(p)}
                                perPage={requestPageSize}
                                onPerPageChange={(size) => {
                                    setRequestPageSize(size);
                                    setRequestPage(1);
                                }}
                                totalEntries={requests.length}
                                startIndex={(Math.min(requestPage, Math.ceil(requests.length / requestPageSize) || 1) - 1) * requestPageSize}
                                endIndex={Math.min(Math.min(requestPage, Math.ceil(requests.length / requestPageSize) || 1) * requestPageSize, requests.length)}
                                theme="orange"
                                perPageOptions={[10, 25, 50]}
                            />
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

/**
 * 5. Import Files & Authorize Personnel PDF Modal (import.blade.php + autorize.blade.php)
 */
export function ImportAndAuthorizeModal({ effectiveRole, onClose, onSuccess }) {
    const isAdminOrPgso = effectiveRole === 'administrator' || effectiveRole === 'pgso';
    const [poFile, setPoFile] = useState(null);
    const [authPdfFile, setAuthPdfFile] = useState(null);
    const [importing, setImporting] = useState(false);
    const [importResult, setImportResult] = useState(null);
    const [pdfs, setPdfs] = useState([]);

    const loadPdfs = async () => {
        try {
            const res = await supplierEvaluationService.getAuthorizePdfs();
            setPdfs(res.data.data || []);
        } catch (err) {
            console.error(err);
        }
    };

    useEffect(() => {
        loadPdfs();
    }, []);

    const handleImportPos = async (e) => {
        e.preventDefault();
        if (!poFile) return;
        setImporting(true);
        try {
            const fd = new FormData();
            fd.append('file', poFile);
            const res = await supplierEvaluationService.importPurchaseOrders(fd);
            setImportResult(res.data);
            setPoFile(null);
            if (onSuccess) onSuccess();
        } catch (err) {
            alert(err.response?.data?.message || 'Import failed.');
        } finally {
            setImporting(false);
        }
    };

    const handleUploadAuthPdf = async (e) => {
        e.preventDefault();
        if (!authPdfFile) return;
        setImporting(true);
        try {
            const fd = new FormData();
            fd.append('pdf_file', authPdfFile);
            await supplierEvaluationService.uploadAuthorizePdf(fd);
            setAuthPdfFile(null);
            loadPdfs();
            if (onSuccess) onSuccess();
        } catch (err) {
            alert(err.response?.data?.message || 'Upload failed.');
        } finally {
            setImporting(false);
        }
    };

    const handlePdfStatus = async (id, status) => {
        await supplierEvaluationService.updateAuthorizePdfStatus(id, status);
        loadPdfs();
        if (onSuccess) onSuccess();
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 to-amber-600 px-6 py-4 text-white flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-black">
                            {isAdminOrPgso
                                ? '📂 Import Purchase Orders & Authorize Personnel PDFs'
                                : '📄 Authorize Personnel PDF Upload'}
                        </h3>
                        <p className="text-xs text-orange-100">
                            Upload batch Purchase Orders (.xlsx / .csv) or manage Authorization Letter PDFs
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
                    {/* Import PO Excel/CSV (Admin/PGSO) */}
                    {isAdminOrPgso && (
                        <form
                            onSubmit={handleImportPos}
                            className="bg-slate-50 border border-slate-200 rounded-2xl p-5 space-y-3"
                        >
                            <h4 className="font-black text-slate-800 text-sm">
                                1. Import Purchase Orders (.xlsx / .csv)
                            </h4>
                            <p className="text-slate-500">
                                Required columns: <code className="font-mono font-bold">po_no</code>,{' '}
                                <code className="font-mono font-bold">pr_no</code>,{' '}
                                <code className="font-mono font-bold">end_user</code>,{' '}
                                <code className="font-mono font-bold">supplier</code>
                            </p>
                            <div className="flex items-center gap-3">
                                <input
                                    type="file"
                                    accept=".xlsx,.csv"
                                    onChange={(e) => setPoFile(e.target.files?.[0] || null)}
                                    className="flex-1 rounded-xl border border-slate-300 bg-white p-2"
                                />
                                <button
                                    type="submit"
                                    disabled={!poFile || importing}
                                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold disabled:opacity-50 cursor-pointer"
                                >
                                    Upload & Import POs
                                </button>
                            </div>
                            {importResult && (
                                <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                                    <div className="font-bold">{importResult.message}</div>
                                    {importResult.duplicates?.length > 0 && (
                                        <div className="mt-1 text-[11px]">
                                            Duplicates skipped: {importResult.duplicates.slice(0, 15).join(', ')}
                                        </div>
                                    )}
                                </div>
                            )}
                        </form>
                    )}

                    {/* Upload Authorize Personnel PDF */}
                    <form
                        onSubmit={handleUploadAuthPdf}
                        className="bg-orange-50/60 border border-orange-200 rounded-2xl p-5 space-y-3"
                    >
                        <h4 className="font-black text-slate-800 text-sm">
                            {isAdminOrPgso ? '2. Upload Authorize Personnel PDF' : 'Upload Authorize Personnel PDF'}
                        </h4>
                        <div className="flex items-center gap-3">
                            <input
                                type="file"
                                accept="application/pdf"
                                onChange={(e) => setAuthPdfFile(e.target.files?.[0] || null)}
                                className="flex-1 rounded-xl border border-slate-300 bg-white p-2"
                            />
                            <button
                                type="submit"
                                disabled={!authPdfFile || importing}
                                className="px-5 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-700 text-white font-bold disabled:opacity-50 cursor-pointer"
                            >
                                Upload PDF
                            </button>
                        </div>
                    </form>

                    {/* List of Uploaded Authorize PDFs */}
                    <div className="border border-slate-200 rounded-2xl overflow-hidden">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-100 text-slate-600 uppercase text-[11px]">
                                <tr>
                                    <th className="px-4 py-3">User</th>
                                    <th className="px-4 py-3">Office</th>
                                    <th className="px-4 py-3">Document</th>
                                    <th className="px-4 py-3 text-center">Status</th>
                                    {isAdminOrPgso && <th className="px-4 py-3 text-center">Action</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {pdfs.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="py-6 text-center text-slate-400">
                                            No authorization PDFs uploaded yet.
                                        </td>
                                    </tr>
                                ) : (
                                    pdfs.map((p) => (
                                        <tr key={p.id}>
                                            <td className="px-4 py-2.5 font-bold">{p.user_name}</td>
                                            <td className="px-4 py-2.5">{p.office_name}</td>
                                            <td className="px-4 py-2.5">
                                                <a
                                                    href={p.file_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-blue-600 hover:underline font-bold"
                                                >
                                                    View Authorization PDF
                                                </a>
                                            </td>
                                            <td className="px-4 py-2.5 text-center">
                                                <span
                                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                        p.status === 'approved'
                                                            ? 'bg-emerald-100 text-emerald-700'
                                                            : p.status === 'rejected'
                                                            ? 'bg-rose-100 text-rose-700'
                                                            : 'bg-amber-100 text-amber-700'
                                                    }`}
                                                >
                                                    {p.status}
                                                </span>
                                            </td>
                                            {isAdminOrPgso && (
                                                <td className="px-4 py-2.5 text-center">
                                                    <div className="flex items-center justify-center gap-1.5">
                                                        <button
                                                            type="button"
                                                            onClick={() => handlePdfStatus(p.id, 'approved')}
                                                            className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px] cursor-pointer"
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => handlePdfStatus(p.id, 'rejected')}
                                                            className="px-2.5 py-1 rounded-lg bg-rose-600 text-white font-bold text-[10px] cursor-pointer"
                                                        >
                                                            Reject
                                                        </button>
                                                    </div>
                                                </td>
                                            )}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * 6. Recycle Bin Modal (delete.blade.php)
 */
export function RecycleBinModal({ onClose, onRestored }) {
    const [deletedList, setDeletedList] = useState([]);
    const [loading, setLoading] = useState(true);

    const loadDeleted = async () => {
        setLoading(true);
        try {
            const res = await supplierEvaluationService.getRecycleBin();
            setDeletedList(res.data.data || []);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadDeleted();
    }, []);

    const handleRestore = async (id) => {
        await supplierEvaluationService.restoreEvaluation(id);
        loadDeleted();
        if (onRestored) onRestored();
    };

    const handleForceDelete = async (id) => {
        if (!window.confirm('Permanently delete this evaluation? This action cannot be undone.')) return;
        await supplierEvaluationService.forceDeleteEvaluation(id);
        loadDeleted();
        if (onRestored) onRestored();
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[88vh] flex flex-col overflow-hidden">
                <div className="bg-gradient-to-r from-rose-600 to-orange-600 px-6 py-4 text-white flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-black">🗑️ Recycle Bin — Deleted Evaluations</h3>
                        <p className="text-xs text-rose-100">Restore evaluations or permanently remove them</p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="flex-1 overflow-auto p-6">
                    <table className="w-full text-xs text-left border border-slate-200 rounded-2xl overflow-hidden">
                        <thead className="bg-slate-100 text-slate-600 uppercase text-[11px]">
                            <tr>
                                <th className="px-4 py-3">P.O. No.</th>
                                <th className="px-4 py-3">Supplier Name</th>
                                <th className="px-4 py-3">Office</th>
                                <th className="px-4 py-3 text-center">Score</th>
                                <th className="px-4 py-3 text-center">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="py-10 text-center text-slate-400">
                                        Loading Recycle Bin...
                                    </td>
                                </tr>
                            ) : deletedList.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-10 text-center text-slate-400">
                                        Recycle Bin is empty.
                                    </td>
                                </tr>
                            ) : (
                                deletedList.map((ev) => (
                                    <tr key={ev.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-3 font-mono font-bold">{ev.po_no}</td>
                                        <td className="px-4 py-3 font-semibold">{ev.supplier_name}</td>
                                        <td className="px-4 py-3">{ev.office_name}</td>
                                        <td className="px-4 py-3 text-center font-bold">{ev.total_score}%</td>
                                        <td className="px-4 py-3 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={() => handleRestore(ev.id)}
                                                    className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold flex items-center gap-1 cursor-pointer"
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5" />
                                                    <span>Restore</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleForceDelete(ev.id)}
                                                    className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold flex items-center gap-1 cursor-pointer"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                    <span>Delete Permanently</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

/**
 * 7. Audit & Activity Logs Modal (activitylog.blade.php)
 */
export function ActivityLogsModal({ onClose }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [fromDate, setFromDate] = useState('');
    const [toDate, setToDate] = useState('');
    const [search, setSearch] = useState('');

    const fetchLogs = async (targetPage = page) => {
        setLoading(true);
        try {
            const res = await supplierEvaluationService.getActivityLogs({
                page: targetPage,
                role: roleFilter,
                status: statusFilter,
                from_date: fromDate,
                to_date: toDate,
                search,
            });
            setLogs(res.data.data || []);
            setPage(res.data.current_page || 1);
            setLastPage(res.data.last_page || 1);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const t = setTimeout(() => fetchLogs(1), 200);
        return () => clearTimeout(t);
    }, [roleFilter, statusFilter, fromDate, toDate, search]);

    const handleExportCsv = () => {
        const url = supplierEvaluationService.getExportActivityLogsUrl({
            role: roleFilter,
            status: statusFilter,
            from_date: fromDate,
            to_date: toDate,
            search,
        });
        window.open(url, '_blank');
    };

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-3xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
                <div className="bg-gradient-to-r from-orange-500 to-amber-600 px-6 py-4 text-white flex items-center justify-between">
                    <div>
                        <h3 className="text-base font-black flex items-center gap-2">
                            <History className="w-5 h-5" />
                            <span>Audit Logs & Activity Monitoring</span>
                        </h3>
                        <p className="text-xs text-orange-100">
                            Comprehensive record of user actions and Supplier Evaluation activities
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={handleExportCsv}
                            className="px-3.5 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                            <Download className="w-4 h-4" />
                            <span>Export CSV</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex flex-wrap items-center gap-2.5">
                        <select
                            value={roleFilter}
                            onChange={(e) => setRoleFilter(e.target.value)}
                            className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white"
                        >
                            <option value="all">All Roles</option>
                            <option value="administrator">Administrator</option>
                            <option value="pgso">PGSO</option>
                            <option value="head">Head</option>
                            <option value="presentative_staff">Representative Staff</option>
                            <option value="end_user">End User</option>
                        </select>
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white"
                        >
                            <option value="all">All Statuses</option>
                            <option value="success">Success</option>
                            <option value="failed">Failed</option>
                            <option value="warning">Warning</option>
                        </select>
                        <input
                            type="date"
                            value={fromDate}
                            onChange={(e) => setFromDate(e.target.value)}
                            className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white"
                        />
                        <input
                            type="date"
                            value={toDate}
                            onChange={(e) => setToDate(e.target.value)}
                            className="px-3 py-1.5 rounded-xl border border-slate-300 bg-white"
                        />
                    </div>
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search user, activity, IP..."
                        className="px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white w-64"
                    />
                </div>

                {/* Table */}
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-xs text-left">
                        <thead className="bg-slate-100 text-slate-600 uppercase text-[11px] sticky top-0">
                            <tr>
                                <th className="px-5 py-3">User</th>
                                <th className="px-5 py-3">Role</th>
                                <th className="px-5 py-3">Activity</th>
                                <th className="px-5 py-3">Description</th>
                                <th className="px-5 py-3">IP Address</th>
                                <th className="px-5 py-3">Time</th>
                                <th className="px-5 py-3 text-center">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="py-10 text-center text-slate-400">
                                        Loading activity logs...
                                    </td>
                                </tr>
                            ) : logs.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-10 text-center text-slate-400">
                                        No matching audit logs found.
                                    </td>
                                </tr>
                            ) : (
                                logs.map((log) => (
                                    <tr key={log.id} className="hover:bg-slate-50">
                                        <td className="px-5 py-3 font-bold text-slate-800">
                                            {log.user?.name || 'System/Guest'}
                                        </td>
                                        <td className="px-5 py-3 capitalize">{(log.role || '').replace('_', ' ')}</td>
                                        <td className="px-5 py-3 font-semibold text-slate-900">{log.activity}</td>
                                        <td className="px-5 py-3 text-slate-600 max-w-xs truncate" title={log.description}>
                                            {log.description || '-'}
                                        </td>
                                        <td className="px-5 py-3 font-mono text-slate-500">{log.ip_address || '-'}</td>
                                        <td className="px-5 py-3 text-slate-500">
                                            {log.created_at ? new Date(log.created_at).toLocaleString() : '-'}
                                        </td>
                                        <td className="px-5 py-3 text-center">
                                            <span
                                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                                    log.status === 'failed'
                                                        ? 'bg-rose-100 text-rose-700'
                                                        : log.status === 'warning'
                                                        ? 'bg-amber-100 text-amber-700'
                                                        : 'bg-emerald-100 text-emerald-700'
                                                }`}
                                            >
                                                {log.status || 'success'}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                <div className="px-6 py-3 bg-slate-50 border-t border-slate-200">
                    <PaginationControl
                        currentPage={page}
                        totalPages={lastPage}
                        onPageChange={(p) => fetchLogs(p)}
                        totalEntries={lastPage * 15}
                        startIndex={(page - 1) * 15}
                        endIndex={page * 15}
                        theme="orange"
                    />
                </div>
            </div>
        </div>
    );
}

