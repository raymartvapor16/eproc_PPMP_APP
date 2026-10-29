import React from 'react';
import { Printer, X } from 'lucide-react';

export const CRITERIA_WEIGHT_MAP = {
    1: { 4: 20, 3: 15, 2: 10, 1: 5 },
    2: { 4: 30, 3: 22.5, 2: 15, 1: 7.5 },
    3: { 4: 25, 3: 18.75, 2: 12.5, 1: 6.25 },
    4: { 4: 25, 3: 18.75, 2: 12.5, 1: 6.25 },
};

export const RATING_DESCRIPTIONS = {
    1: {
        1: 'Bid amount is higher than the prevailing market price against the brand/services delivered.',
        2: 'Goods delivered with recurring or significant damages, defects, or workmanship issues, affecting functionality.',
        3: 'If any three (3) of the details given in item #4 is lacking.',
        4: 'Goods / Services delivered, eleven (11) or more days after the expiration of the delivery period.',
    },
    2: {
        1: 'Some mismatch between bid amount and brand/services delivered; notably higher than market range. Moderately Reasonable.',
        2: 'Goods delivered in accordance with specs but of low quality.',
        3: 'If any two (2) of the customer care details are lacking.',
        4: 'Goods/Services delivered six (6) to ten (10) days after expiration.',
    },
    3: {
        1: 'Bid amount generally aligns with brand/services delivered; Minor discrepancies in pricing but still within acceptable market range; and No significant cost or overpricing based on brand/services delivered.',
        2: 'Goods delivered in accordance with specifications, with minor damages, defects, or workmanship issues, which were immediately corrected without affecting functionality or project timeline.',
        3: 'If one (1) of the customer care details is lacking.',
        4: 'Goods / Services delivered, One (1) to Five (5) days after the expiration of the delivery period.',
    },
    4: {
        1: 'Bid amount is reasonable based on the brand/services delivered; Pricing is consistent with current market rates (brand or market scoping / historical data); Competitive.',
        2: 'Goods delivered according to specifications, and acceptable quality.',
        3: 'Accessible and easy to contact, responsive to inquiries / complaints, adaptable to certain needs of the end-user and has competent staff to handle end-user concerns.',
        4: 'Goods / Services delivered on Time.',
    },
};

export const CRITERIA_LABELS = {
    1: { name: 'A. PRICE', maxWeight: 20 },
    2: { name: 'B. QUALITY / SERVICE LEVEL', maxWeight: 30 },
    3: { name: 'C. CUSTOMER CARE / AFTER SALES SERVICE', maxWeight: 25 },
    4: { name: 'D. DELIVERY FULFILLMENT', maxWeight: 25 },
};

const formatDateLong = (dateStr) => {
    if (!dateStr) return '-';
    try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return dateStr;
        return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
    } catch (_) {
        return dateStr;
    }
};

export const parseToDate = (dateStr) => {
    if (!dateStr) return null;
    let s = String(dateStr).trim();
    // If raw SQL format without timezone (e.g. "2026-10-15 13:01:47"), attach +08:00 (Manila)
    if (/^\d{4}-\d{2}-\d{2}[\sT]\d{2}:\d{2}(:\d{2})?(\.\d+)?$/.test(s)) {
        s = s.replace(' ', 'T') + '+08:00';
    }
    const d = new Date(s);
    if (isNaN(d.getTime())) return null;
    return d;
};

export const formatPhDateTime = (dateStr) => {
    if (!dateStr) return '-';
    try {
        const d = parseToDate(dateStr);
        if (!d) return dateStr;
        return new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Manila',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        }).format(d).replace(' at ', ' ');
    } catch (_) {
        return dateStr;
    }
};

export const getNowPhDateTime = () => {
    try {
        const d = new Date();
        return new Intl.DateTimeFormat('en-US', {
            timeZone: 'Asia/Manila',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true,
        }).format(d).replace(' at ', ' ');
    } catch (_) {
        return new Date().toLocaleString();
    }
};

const formatDateTime = formatPhDateTime;

/**
 * 1. Official Single Supplier Evaluation Form Print/PDF Modal (matches resources/views/pdf/download.blade.php)
 */
export function EvaluationFormPrintModal({ evaluation, onClose }) {
    if (!evaluation) return null;

    const scoresMap = {};
    (evaluation.criteria_scores || []).forEach((s) => {
        scoresMap[s.criteria_id] = s;
    });

    let overallScore = 0;
    const rows = [1, 2, 3, 4].map((cId) => {
        const scoreObj = scoresMap[cId];
        const rating = Number(scoreObj?.number_rating || 0);
        const weighted = CRITERIA_WEIGHT_MAP[cId]?.[rating] || 0;
        overallScore += weighted;
        return {
            criteriaId: cId,
            name: CRITERIA_LABELS[cId].name,
            maxWeight: CRITERIA_LABELS[cId].maxWeight,
            rating,
            weighted,
            description: RATING_DESCRIPTIONS[rating]?.[cId] || '',
            remarks: scoreObj?.remarks || '',
        };
    });

    const approvals = evaluation.digital_approvals || [];
    const preparedBy = approvals.find((a) => (a.role || '').toLowerCase() === 'prepared by');
    const headApproval = approvals.find((a) => ['head', 'office head'].includes((a.role || '').toLowerCase().trim()));
    const repApproval = approvals.find((a) =>
        ['presentative_staff', 'representative_staff', 'representative staff', 'presentative staff'].includes(
            (a.role || '').toLowerCase().trim()
        )
    );

    const headName = headApproval?.full_name || evaluation.office_head_name || evaluation.office?.head || '-';
    const headDesignation = headApproval?.designation || evaluation.office_head_designation || evaluation.office?.designation || '-';
    const headNote = headApproval
        ? 'Electronically approved by Office Head'
        : repApproval
        ? 'Electronically signed by Representative Staff on behalf of the Office Head'
        : 'Office Head';

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="eval-print-modal-overlay fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <style>{`
                @media print {
                    @page {
                        size: portrait;
                        margin: 10mm 12mm 10mm 12mm !important;
                    }
                    html, body {
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        height: auto !important;
                        overflow: visible !important;
                        font-size: 11px !important;
                    }
                    header, nav, footer, main, .no-print, [data-no-print] {
                        display: none !important;
                    }
                    .eval-print-modal-overlay {
                        position: static !important;
                        display: block !important;
                        background: transparent !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        overflow: visible !important;
                        backdrop-filter: none !important;
                        z-index: auto !important;
                    }
                    .eval-print-modal-container {
                        position: static !important;
                        display: block !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        border-radius: 0 !important;
                        height: auto !important;
                        max-height: none !important;
                        overflow: visible !important;
                    }
                    .eval-print-sheet {
                        padding: 4mm 6mm 4mm 6mm !important;
                        margin: 0 auto !important;
                        overflow: visible !important;
                        box-sizing: border-box !important;
                        width: 100% !important;
                    }
                    .eval-avoid-break {
                        break-inside: avoid !important;
                        page-break-inside: avoid !important;
                    }
                }
            `}</style>
            <div className="eval-print-modal-container bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
                {/* Top Action Bar (Hidden in Print) */}
                <div className="no-print bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
                    <div>
                        <h3 className="text-base font-bold">Official Supplier's Evaluation Form</h3>
                        <p className="text-xs text-slate-400">
                            P.O. No. {evaluation.po_no} — {evaluation.supplier_name}
                        </p>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer shadow-xs"
                        >
                            <Printer className="w-4 h-4" />
                            <span>Print / Save as PDF</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Printable Document Body */}
                <div className="eval-print-sheet p-6 sm:p-8 overflow-y-auto text-slate-900 text-xs leading-relaxed">
                    {/* Official Header */}
                    <table className="w-full border-collapse mb-2.5">
                        <tbody>
                            <tr>
                                <td className="w-16 text-center align-middle">
                                    <img
                                        src="/images/logo.png"
                                        alt="Province Seal"
                                        className="w-16 h-16 object-contain mx-auto"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                        }}
                                    />
                                </td>
                                <td className="text-center align-middle leading-tight px-3">
                                    <div className="text-[10px] text-slate-700 font-medium">Republic of the Philippines</div>
                                    <div className="text-sm font-extrabold text-slate-950 tracking-wide mt-0.5">PROVINCE OF DAVAO DEL SUR</div>
                                    <div className="text-[10px] text-slate-700">Provincial Government</div>
                                    <div className="text-[10px] text-slate-700">Matti, City of Digos</div>
                                    <div className="mt-1.5">
                                        <div className="text-xs font-black tracking-wider uppercase text-slate-900">SUPPLIER'S EVALUATION FORM</div>
                                        <div className="text-[9px] text-slate-500">Performance Assessment &amp; Rating System</div>
                                    </div>
                                </td>
                                <td className="w-16"></td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Evaluation Details */}
                    <div className="eval-avoid-break mb-2.5">
                        <div className="font-bold mb-1 bg-slate-100 px-2.5 py-1 border-l-4 border-blue-600 text-[11px] uppercase tracking-wide">
                            Evaluation Details
                        </div>
                        <table className="w-full border-collapse border border-slate-400 text-[11px]">
                            <tbody>
                                <tr>
                                    <th className="border border-slate-400 px-2.5 py-1.5 text-left bg-slate-50 w-1/4 font-bold text-slate-700">
                                        NAME OF SUPPLIER
                                    </th>
                                    <td className="border border-slate-400 px-2.5 py-1.5 w-1/4 font-bold text-slate-900">
                                        {evaluation.supplier_name}
                                    </td>
                                    <th className="border border-slate-400 px-2.5 py-1.5 text-left bg-slate-50 w-1/4 font-bold text-slate-700">
                                        Purchase Order / Contract No.
                                    </th>
                                    <td className="border border-slate-400 px-2.5 py-1.5 w-1/4 font-mono font-bold text-slate-900">
                                        {evaluation.po_no}
                                    </td>
                                </tr>
                                <tr>
                                    <th className="border border-slate-400 px-2.5 py-1.5 text-left bg-slate-50 font-bold text-slate-700">
                                        Date of Evaluation
                                    </th>
                                    <td className="border border-slate-400 px-2.5 py-1.5 text-slate-800">
                                        {formatDateLong(evaluation.date_evaluation)}
                                    </td>
                                    <th className="border border-slate-400 px-2.5 py-1.5 text-left bg-slate-50 font-bold text-slate-700">
                                        Covered Period
                                    </th>
                                    <td className="border border-slate-400 px-2.5 py-1.5 text-slate-800">
                                        {evaluation.covered_period}
                                    </td>
                                </tr>
                                <tr>
                                    <th className="border border-slate-400 px-2.5 py-1.5 text-left bg-slate-50 font-bold text-slate-700">
                                        Evaluated by (Office Name)
                                    </th>
                                    <td colSpan={3} className="border border-slate-400 px-2.5 py-1.5 font-medium text-slate-800">
                                        {evaluation.office?.name || evaluation.office_name || '-'}
                                    </td>
                                </tr>
                            </tbody>
                        </table>
                    </div>

                    {/* Evaluation Criteria Table */}
                    <div className="eval-avoid-break mb-2.5">
                        <table className="w-full border-collapse border border-slate-400 text-[11px]">
                            <thead>
                                <tr className="bg-slate-100">
                                    <th className="border border-slate-400 px-2.5 py-1.5 text-left font-bold w-3/5 text-slate-800 uppercase tracking-wide">
                                        EVALUATION CRITERIA
                                    </th>
                                    <th className="border border-slate-400 px-2.5 py-1.5 text-left font-bold w-2/5 text-slate-800 uppercase tracking-wide">
                                        REMARKS / SPECIFIC COMMENTS
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((r) => (
                                    <tr key={r.criteriaId}>
                                        <td className="border border-slate-400 px-2.5 py-1.5 align-top">
                                            <div className="font-bold text-slate-900">
                                                {r.name} ({r.maxWeight}%)
                                            </div>
                                            <div className="font-bold text-blue-900 text-[10.5px]">
                                                Rate: &nbsp;{r.weighted.toFixed(2)}% {r.rating ? `(Rating: ${r.rating})` : '(Not rated)'}
                                            </div>
                                            {r.description && (
                                                <div className="italic text-slate-600 text-[10px] leading-snug mt-0.5">{r.description}</div>
                                            )}
                                        </td>
                                        <td className="border border-slate-400 px-2.5 py-1.5 align-top">
                                            <div className="text-[10.5px] leading-snug text-slate-700">
                                                {r.remarks || <span className="text-slate-400 italic">No remarks</span>}
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Overall Rating */}
                    <div className="eval-avoid-break mb-2.5">
                        <div
                            className={`py-1.5 px-3 text-center font-bold text-xs rounded-lg border ${
                                overallScore >= 60
                                    ? 'bg-emerald-100 border-emerald-400 text-emerald-950'
                                    : 'bg-rose-100 border-rose-400 text-rose-950'
                            }`}
                        >
                            <span className="text-sm font-extrabold">{overallScore.toFixed(2)}%</span> —{' '}
                            <span className="font-extrabold uppercase">{overallScore >= 60 ? 'Passed' : 'Failed'}</span>
                            <span className="text-[10px] font-normal ml-2 text-slate-600">(Passing Rate: 60%)</span>
                        </div>
                    </div>

                    {/* Digital Authorization */}
                    <div className="eval-avoid-break">
                        <div className="font-bold mb-1.5 bg-slate-100 px-2.5 py-1 border-l-4 border-blue-600 text-[11px] uppercase tracking-wide">
                            Digital Authorization
                        </div>

                        <div
                            className={`grid gap-2.5 ${
                                repApproval ? 'grid-cols-3' : 'grid-cols-2'
                            }`}
                        >
                            {/* Prepared By */}
                            <div className="border border-slate-300 rounded-xl p-2.5 text-center bg-white">
                                <div className="text-[9.5px] font-bold tracking-wider text-blue-800 uppercase mb-0.5">
                                    PREPARED BY
                                </div>
                                <div className="h-10 flex items-center justify-center">
                                    {preparedBy?.signed_by && (
                                        <img
                                            src={`/api/users/${preparedBy.signed_by}/signature`}
                                            alt="Prepared Signature"
                                            className="max-h-9 max-w-[120px] object-contain"
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                            }}
                                        />
                                    )}
                                </div>
                                <div className="border-b border-slate-800 w-4/5 mx-auto my-0.5"></div>
                                <div className="font-bold text-[11px] text-slate-900">
                                    {preparedBy?.full_name || '-'}
                                </div>
                                <div className="text-[9.5px] text-slate-600">
                                    {preparedBy?.designation || '-'}
                                </div>
                                <div className="text-[8.5px] text-slate-500 mt-0.5">
                                    Electronically signed &amp; verified
                                </div>
                                {(preparedBy?.updated_at || preparedBy?.created_at) && (
                                    <div className="text-[8.5px] text-slate-600 font-medium">
                                        Signed: {formatPhDateTime(preparedBy.updated_at || preparedBy.created_at)}
                                    </div>
                                )}
                            </div>

                            {/* Head Authorization */}
                            <div className="border border-slate-300 rounded-xl p-2.5 text-center bg-white">
                                <div className="text-[9.5px] font-bold tracking-wider text-blue-800 uppercase mb-0.5">
                                    HEAD AUTHORIZATION
                                </div>
                                <div className="h-10 flex items-center justify-center">
                                    {(headApproval?.signed_by || repApproval?.signed_by) && (
                                        <img
                                            src={`/api/users/${headApproval?.signed_by || repApproval?.signed_by}/signature`}
                                            alt="Head Signature"
                                            className="max-h-9 max-w-[120px] object-contain"
                                            onError={(e) => {
                                                e.target.style.display = 'none';
                                            }}
                                        />
                                    )}
                                </div>
                                <div className="border-b border-slate-800 w-4/5 mx-auto my-0.5"></div>
                                <div className="font-bold text-[11px] text-slate-900">{headName}</div>
                                <div className="text-[9.5px] text-slate-600">{headDesignation}</div>
                                <div className="text-[8.5px] text-slate-500 mt-0.5">{headNote}</div>
                                {(headApproval?.updated_at || headApproval?.created_at || (evaluation.status === 'submitted' && !repApproval ? evaluation.updated_at : null)) && (
                                    <div className="text-[8.5px] text-slate-600 font-medium">
                                        Approved: {formatPhDateTime(headApproval?.updated_at || headApproval?.created_at || evaluation.updated_at)}
                                    </div>
                                )}
                            </div>

                            {/* Representative Staff (Optional Column) */}
                            {repApproval && (
                                <div className="border border-slate-300 rounded-xl p-2.5 text-center bg-white">
                                    <div className="text-[9.5px] font-bold tracking-wider text-emerald-700 uppercase mb-0.5">
                                        REPRESENTATIVE STAFF
                                    </div>
                                    <div className="h-10 flex items-center justify-center">
                                        {repApproval.signed_by && (
                                            <img
                                                src={`/api/users/${repApproval.signed_by}/signature`}
                                                alt="Representative Signature"
                                                className="max-h-9 max-w-[120px] object-contain"
                                                onError={(e) => {
                                                    e.target.style.display = 'none';
                                                }}
                                            />
                                        )}
                                    </div>
                                    <div className="border-b border-slate-800 w-4/5 mx-auto my-0.5"></div>
                                    <div className="font-bold text-[11px] text-slate-900">
                                        {repApproval.full_name || '-'}
                                    </div>
                                    <div className="text-[9.5px] text-slate-600">
                                        {repApproval.designation || '-'}
                                    </div>
                                    <div className="text-[8.5px] text-slate-500 mt-0.5">
                                        Electronically signed on behalf of the Office Head
                                    </div>
                                    {(repApproval.updated_at || repApproval.created_at) && (
                                        <div className="text-[8.5px] text-slate-600 font-medium">
                                            Approved: {formatPhDateTime(repApproval.updated_at || repApproval.created_at)}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="text-center mt-2 text-[9px] text-slate-500 italic">
                            This document is electronically signed using a secure electronic signature system and is valid without a handwritten signature.
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * 2. Official Analytics Summary / Semester / Missing-PDF Print Modal
 *    Matches summary.blade.php, semester_summary.blade.php, and missing_pdf_pos.blade.php
 */
export function AnalyticsReportPrintModal({ reportType, data, filters, onClose }) {
    if (!reportType) return null;

    const today = new Date().toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' });

    const handlePrint = () => {
        window.print();
    };

    const summary = data?.summary || [];
    const semesterData = data?.semester_data || [];
    const missingPdfPos = data?.missing_pdf_pos || [];

    return (
        <div className="analytics-print-modal-overlay fixed inset-0 z-50 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <style>{`
                @media print {
                    @page {
                        size: landscape;
                        margin: 10mm 12mm 10mm 12mm !important;
                    }
                    html, body {
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                        color: #000000 !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        height: auto !important;
                        overflow: visible !important;
                    }
                    header, nav, footer, main, .no-print, [data-no-print] {
                        display: none !important;
                    }
                    .analytics-print-modal-overlay {
                        position: static !important;
                        display: block !important;
                        background: transparent !important;
                        padding: 0 !important;
                        margin: 0 !important;
                        overflow: visible !important;
                        backdrop-filter: none !important;
                        z-index: auto !important;
                    }
                    .analytics-print-modal-container {
                        position: static !important;
                        display: block !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        box-shadow: none !important;
                        border: none !important;
                        border-radius: 0 !important;
                        height: auto !important;
                        max-height: none !important;
                        overflow: visible !important;
                    }
                    .analytics-print-sheet {
                        padding: 4mm 6mm 4mm 6mm !important;
                        margin: 0 auto !important;
                        overflow: visible !important;
                        box-sizing: border-box !important;
                        width: 100% !important;
                    }
                }
            `}</style>
            <div className="analytics-print-modal-container bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
                {/* Action Bar */}
                <div className="no-print bg-slate-900 text-white px-6 py-4 flex items-center justify-between shrink-0">
                    <div>
                        <h3 className="text-base font-bold">
                            {reportType === 'summary' && 'Supplier Evaluation Summary Report'}
                            {reportType === 'semester' && 'Supplier Semester Evaluation Summary Report'}
                            {reportType === 'missing_pdf' && 'Purchase Orders Pending PDF Upload Report'}
                        </h3>
                        <p className="text-xs text-slate-400">Official Printable Report — Province of Davao del Sur</p>
                    </div>
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={handlePrint}
                            className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition cursor-pointer"
                        >
                            <Printer className="w-4 h-4" />
                            <span>Print / Save as PDF</span>
                        </button>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                {/* Printable Report Content */}
                <div className="analytics-print-sheet p-8 overflow-y-auto text-black font-serif text-xs">
                    {/* Official Header */}
                    <table className="w-full border-b-2 border-black pb-2 mb-3">
                        <tbody>
                            <tr>
                                <td className="w-[15%] text-center align-middle">
                                    <img
                                        src="/images/logo.png"
                                        alt="Seal"
                                        className="w-16 h-16 object-contain mx-auto"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                        }}
                                    />
                                </td>
                                <td className="w-[70%] text-center align-middle">
                                    <div className="text-[11px] uppercase">Republic of the Philippines</div>
                                    <div className="text-base font-bold tracking-wide">PROVINCE OF DAVAO DEL SUR</div>
                                    <div className="text-[11px] uppercase">Provincial Government | Matti, City of Digos</div>
                                    <div className="text-[11px] font-bold mt-0.5">
                                        OFFICE OF THE PROVINCIAL PROCUREMENT MANAGEMENT OFFICER
                                    </div>
                                </td>
                                <td className="w-[15%] text-right align-middle text-[10px]">
                                    Date Generated:
                                    <br />
                                    <strong>{today}</strong>
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    {/* SUMMARY REPORT */}
                    {reportType === 'summary' && (
                        <>
                            <div className="text-center text-sm font-bold uppercase underline my-3">
                                Supplier Evaluation Summary Report
                            </div>

                            <div className="grid grid-cols-3 gap-3 mb-4">
                                <div className="border border-black p-2 text-center">
                                    <div className="text-[10px] font-bold uppercase">Total Suppliers Evaluated</div>
                                    <div className="text-sm font-bold mt-0.5">{summary.length}</div>
                                </div>
                                <div className="border border-black p-2 text-center">
                                    <div className="text-[10px] font-bold uppercase">Total Purchase Orders</div>
                                    <div className="text-sm font-bold mt-0.5">
                                        {summary.reduce((acc, s) => acc + (s.total_evaluations || 0), 0)}
                                    </div>
                                </div>
                                <div className="border border-black p-2 text-center">
                                    <div className="text-[10px] font-bold uppercase">Overall Average Score</div>
                                    <div className="text-sm font-bold mt-0.5">
                                        {summary.length > 0
                                            ? (
                                                  summary.reduce((acc, s) => acc + Number(s.average_score || 0), 0) /
                                                  summary.length
                                              ).toFixed(2)
                                            : '0.00'}
                                        %
                                    </div>
                                </div>
                            </div>

                            <table className="w-full border-collapse border border-black text-[11px] mb-5">
                                <thead>
                                    <tr className="bg-gray-200">
                                        <th className="border border-black p-1.5 text-center w-[5%]">#</th>
                                        <th className="border border-black p-1.5 text-left w-[28%]">Department</th>
                                        <th className="border border-black p-1.5 text-left w-[30%]">Supplier Name</th>
                                        <th className="border border-black p-1.5 text-center w-[12%]">Evaluations</th>
                                        <th className="border border-black p-1.5 text-center w-[12%]">Average Score</th>
                                        <th className="border border-black p-1.5 text-center w-[13%]">Rating Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {summary.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="border border-black p-3 text-center">
                                                No supplier evaluation records found.
                                            </td>
                                        </tr>
                                    ) : (
                                        summary.map((item, idx) => (
                                            <tr key={idx} className="even:bg-gray-50">
                                                <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                                                <td className="border border-black p-1.5 font-bold">{item.department}</td>
                                                <td className="border border-black p-1.5 font-bold">{item.supplier}</td>
                                                <td className="border border-black p-1.5 text-center">
                                                    {item.total_evaluations} PO(s)
                                                </td>
                                                <td className="border border-black p-1.5 text-center font-bold">
                                                    {Number(item.average_score).toFixed(2)}%
                                                </td>
                                                <td className="border border-black p-1.5 text-center">
                                                    <span className="border border-black px-1.5 py-0.5 text-[9px] font-bold uppercase">
                                                        {item.rating_label}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>

                            {/* Detailed Remarks */}
                            {summary.some((s) => (s.remarks || []).length > 0) && (
                                <>
                                    <div className="font-bold text-xs border-b border-black pb-1 mb-2 uppercase">
                                        Detailed Remarks & Feedback
                                    </div>
                                    <table className="w-full border-collapse border border-black text-[11px] mb-4">
                                        <thead>
                                            <tr className="bg-gray-200">
                                                <th className="border border-black p-1.5 text-left w-[32%]">
                                                    Department & Supplier
                                                </th>
                                                <th className="border border-black p-1.5 text-left w-[68%]">
                                                    Evaluation Feedback / Remarks
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {summary
                                                .filter((s) => (s.remarks || []).length > 0)
                                                .map((item, idx) => (
                                                    <tr key={idx}>
                                                        <td className="border border-black p-1.5 align-top">
                                                            <strong>{item.department}</strong>
                                                            <br />
                                                            {item.supplier}
                                                        </td>
                                                        <td className="border border-black p-1.5 align-top">
                                                            {item.remarks.map((rem, rIdx) => (
                                                                <div key={rIdx} className="mb-1">
                                                                    <strong>• {rem.criteria}:</strong> {rem.remarks}
                                                                </div>
                                                            ))}
                                                        </td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </>
                            )}
                        </>
                    )}

                    {/* SEMESTER SUMMARY REPORT */}
                    {reportType === 'semester' && (
                        <>
                            <div className="text-center text-sm font-bold uppercase underline mt-3 mb-1">
                                Supplier Semester Evaluation Summary Report
                            </div>
                            <div className="text-center text-[11px] mb-3">
                                Department:{' '}
                                <strong>
                                    {!filters?.department || filters.department === 'all'
                                        ? 'All Departments'
                                        : filters.department}
                                </strong>{' '}
                                &nbsp;|&nbsp; Period Year:{' '}
                                <strong>{!filters?.year || filters.year === 'all' ? 'All Years' : filters.year}</strong>
                            </div>

                            <div className="grid grid-cols-4 gap-2.5 mb-4">
                                <div className="border border-black p-2 text-center">
                                    <div className="text-[9px] font-bold uppercase">Total Suppliers</div>
                                    <div className="text-sm font-bold mt-0.5">{semesterData.length}</div>
                                </div>
                                <div className="border border-black p-2 text-center">
                                    <div className="text-[9px] font-bold uppercase">1st Sem POs (Jan - Jun)</div>
                                    <div className="text-sm font-bold mt-0.5">
                                        {semesterData.reduce((a, b) => a + (b.sem1_count || 0), 0)}
                                    </div>
                                </div>
                                <div className="border border-black p-2 text-center">
                                    <div className="text-[9px] font-bold uppercase">2nd Sem POs (Jul - Dec)</div>
                                    <div className="text-sm font-bold mt-0.5">
                                        {semesterData.reduce((a, b) => a + (b.sem2_count || 0), 0)}
                                    </div>
                                </div>
                                <div className="border border-black p-2 text-center">
                                    <div className="text-[9px] font-bold uppercase">Overall Average Score</div>
                                    <div className="text-sm font-bold mt-0.5">
                                        {semesterData.length > 0
                                            ? (
                                                  semesterData.reduce((a, b) => a + Number(b.overall_avg || 0), 0) /
                                                  semesterData.length
                                              ).toFixed(2)
                                            : '0.00'}
                                        %
                                    </div>
                                </div>
                            </div>

                            <table className="w-full border-collapse border border-black text-[11px] mb-5">
                                <thead>
                                    <tr className="bg-gray-200">
                                        <th className="border border-black p-1.5 text-center w-[5%]">#</th>
                                        <th className="border border-black p-1.5 text-left w-[30%]">Supplier Name</th>
                                        <th className="border border-black p-1.5 text-center w-[22%]">
                                            1st Semester (Jan - Jun)
                                        </th>
                                        <th className="border border-black p-1.5 text-center w-[22%]">
                                            2nd Semester (Jul - Dec)
                                        </th>
                                        <th className="border border-black p-1.5 text-center w-[11%]">Overall Avg</th>
                                        <th className="border border-black p-1.5 text-center w-[10%]">Rating</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {semesterData.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="border border-black p-3 text-center">
                                                No evaluation data available for the selected filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        semesterData.map((item, idx) => (
                                            <tr key={idx} className="even:bg-gray-50">
                                                <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                                                <td className="border border-black p-1.5 font-bold">{item.supplier}</td>
                                                <td className="border border-black p-1.5 text-center">
                                                    {item.sem1_avg !== null
                                                        ? `${Number(item.sem1_avg).toFixed(2)}% (${item.sem1_count} POs)`
                                                        : 'N/A'}
                                                </td>
                                                <td className="border border-black p-1.5 text-center">
                                                    {item.sem2_avg !== null
                                                        ? `${Number(item.sem2_avg).toFixed(2)}% (${item.sem2_count} POs)`
                                                        : 'N/A'}
                                                </td>
                                                <td className="border border-black p-1.5 text-center font-bold">
                                                    {item.overall_avg !== null
                                                        ? `${Number(item.overall_avg).toFixed(2)}%`
                                                        : 'N/A'}
                                                </td>
                                                <td className="border border-black p-1.5 text-center">
                                                    <span className="border border-black px-1.5 py-0.5 text-[9px] font-bold uppercase">
                                                        {item.rating_label}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </>
                    )}

                    {/* MISSING PDF POs REPORT */}
                    {reportType === 'missing_pdf' && (
                        <>
                            <div className="text-center text-sm font-bold uppercase underline mt-3 mb-1">
                                Purchase Orders Pending PDF Upload Report
                            </div>
                            <div className="text-center text-[11px] mb-3">
                                Department:{' '}
                                <strong>
                                    {!filters?.department || filters.department === 'all'
                                        ? 'All Departments'
                                        : filters.department}
                                </strong>{' '}
                                &nbsp;|&nbsp; Supplier:{' '}
                                <strong>
                                    {!filters?.supplier || filters.supplier === 'all' ? 'All Suppliers' : filters.supplier}
                                </strong>{' '}
                                &nbsp;|&nbsp; Total Missing PDF POs: <strong>{missingPdfPos.length}</strong>
                            </div>

                            <table className="w-full border-collapse border border-black text-[11px] mb-5">
                                <thead>
                                    <tr className="bg-gray-200">
                                        <th className="border border-black p-1.5 text-center w-[6%]">#</th>
                                        <th className="border border-black p-1.5 text-center w-[16%]">PO Number</th>
                                        <th className="border border-black p-1.5 text-center w-[16%]">PR Number</th>
                                        <th className="border border-black p-1.5 text-left w-[20%]">
                                            End User / Department
                                        </th>
                                        <th className="border border-black p-1.5 text-left w-[28%]">Supplier Name</th>
                                        <th className="border border-black p-1.5 text-center w-[14%]">PDF Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {missingPdfPos.length === 0 ? (
                                        <tr>
                                            <td colSpan={6} className="border border-black p-3 text-center italic">
                                                No Purchase Orders found without PDF uploads for the selected filters.
                                            </td>
                                        </tr>
                                    ) : (
                                        missingPdfPos.map((po, idx) => (
                                            <tr key={po.id || idx} className="even:bg-gray-50">
                                                <td className="border border-black p-1.5 text-center">{idx + 1}</td>
                                                <td className="border border-black p-1.5 text-center font-bold">
                                                    {po.po_no || '-'}
                                                </td>
                                                <td className="border border-black p-1.5 text-center">
                                                    {po.pr_no || '-'}
                                                </td>
                                                <td className="border border-black p-1.5">{po.end_user || '-'}</td>
                                                <td className="border border-black p-1.5">{po.supplier || '-'}</td>
                                                <td className="border border-black p-1.5 text-center text-red-700 font-bold uppercase text-[9px]">
                                                    No PDF Uploaded
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </>
                    )}

                    {/* Official Footer */}
                    <div className="mt-6 border-t border-black pt-2 text-center text-[10px]">
                        This report is official and computer-generated by the Supplier Evaluation System | Province of Davao del Sur.
                        <br />
                        Confidential - For official procurement management and evaluation reference only.
                    </div>
                </div>
            </div>
        </div>
    );
}

