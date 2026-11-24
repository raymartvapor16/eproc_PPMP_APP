import React, { useRef, useState } from 'react';
import { formatCurrency, formatDate } from '../UI/StatusBadge';
import { ArrowLeft } from 'lucide-react';
import { formatDescription6Words, formatMonthYear } from './ProcurementPlanTable';
import { useSignatureSettings, isSignatoryPnpkiActive, resolveSubmittedBySignatory } from '../../utils/signatureController';
import { PrintExportDropdown } from '../UI/PrintExportDropdown';
import { ResponsivePrintDocument } from '../UI/ResponsivePrintDocument';
import { exportElementsToPdf } from '../../utils/pdfExport';

export const PPMPPrintView = ({ ppmp, onBack }) => {
    const printContainerRef = useRef(null);
    const [isExportingPdf, setIsExportingPdf] = useState(false);

    const { isEnabled, isPnpkiEnabled: isGlobalPnpkiEnabled } = useSignatureSettings();
    const isSignatureEnabled = ppmp?.signature_settings?.ppmp !== undefined
        ? Boolean(ppmp.signature_settings.ppmp)
        : isEnabled('ppmp');
    const isPnpkiSystemEnabled = ppmp?.signature_settings?.pnpki_enabled !== undefined
        ? Boolean(ppmp.signature_settings.pnpki_enabled)
        : isGlobalPnpkiEnabled;

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPdf = async () => {
        if (!printContainerRef.current || isExportingPdf) return;
        setIsExportingPdf(true);
        try {
            const tracker = ppmp?.tracking_number || ppmp?.ppmp_number || ppmp?.uuid || 'PPMP';
            await exportElementsToPdf({
                element: printContainerRef.current,
                filename: `PPMP_${tracker}.pdf`,
                orientation: 'landscape',
                format: 'legal',
                marginMm: 6,
            });
        } catch (err) {
            console.error('Failed to export PPMP PDF:', err);
            alert('Failed to generate PDF file. Please try printing and choosing Save as PDF.');
        } finally {
            setIsExportingPdf(false);
        }
    };

    const items = ppmp.items || [];

    const displayRows = items;

    const signatures = ppmp?.signatures || [];

    const isScopeAttachmentOnly = ppmp?.amendment_scope === 'ATTACHMENT_LIST';

    const hasTwgApproved = Boolean(
        ppmp?.twg_approved_at ||
        ['BUDGET_OFFICER_REVIEW', 'BUDGET_OFFICER_RETURNED', 'BUDGET_HEAD_REVIEW', 'BUDGET_HEAD_RETURNED', 'PACCO_REVIEW', 'PACCO_RETURNED', 'PACCO_HEAD_REVIEW', 'PACCO_HEAD_RETURNED', 'OPPMO_REVIEW', 'OPPMO_RETURNED', 'OPPMO_HEAD_REVIEW', 'OPPMO_HEAD_RETURNED', 'HEAD_PENDING', 'HEAD_RETURNED', 'READY_TO_PRINT'].includes(ppmp?.status)
    );
    const hasBudgetApproved = Boolean(
        ppmp?.budget_approved_at ||
        ['BUDGET_HEAD_REVIEW', 'BUDGET_HEAD_RETURNED', 'OPPMO_REVIEW', 'OPPMO_RETURNED', 'OPPMO_HEAD_REVIEW', 'OPPMO_HEAD_RETURNED', 'HEAD_PENDING', 'HEAD_RETURNED', 'READY_TO_PRINT'].includes(ppmp?.status)
    );
    const hasPaccoApproved = Boolean(
        ppmp?.pacco_approved_at ||
        ['PACCO_HEAD_REVIEW', 'PACCO_HEAD_RETURNED', 'OPPMO_REVIEW', 'OPPMO_RETURNED', 'OPPMO_HEAD_REVIEW', 'OPPMO_HEAD_RETURNED', 'HEAD_PENDING', 'HEAD_RETURNED', 'READY_TO_PRINT'].includes(ppmp?.status)
    );
    const hasOppmoApproved = Boolean(
        ppmp?.oppmo_approved_at ||
        ['OPPMO_HEAD_REVIEW', 'OPPMO_HEAD_RETURNED', 'HEAD_PENDING', 'HEAD_RETURNED', 'READY_TO_PRINT'].includes(ppmp?.status)
    );
    const hasHeadApproved = Boolean(
        isScopeAttachmentOnly ||
        ppmp?.head_approved_at ||
        ppmp?.status === 'READY_TO_PRINT'
    );

    const preparedSig = signatures.find(s => s.role === 'end_user')
        || (ppmp?.parent?.signatures?.find(s => s.role === 'end_user'))
        || null;
    const headSig = hasHeadApproved
        ? (signatures.find(s => s.role === 'head') || (isScopeAttachmentOnly ? ppmp?.parent?.signatures?.find(s => s.role === 'head') : null))
        : null;

    const isTrustFund = Boolean(
        (ppmp?.source_of_fund && ppmp.source_of_fund.toLowerCase().includes('trust')) ||
        ppmp?.items?.some(i => i.source_of_fund && i.source_of_fund.toLowerCase().includes('trust'))
    );
    const paccoSig = isTrustFund
        ? (isScopeAttachmentOnly
            ? (signatures.find(s => s.role === 'pacco') || ppmp?.parent?.signatures?.find(s => s.role === 'pacco') || null)
            : (hasPaccoApproved ? signatures.find(s => s.role === 'pacco') : null))
        : null;

    const budgetSig = isScopeAttachmentOnly
        ? (signatures.find(s => s.role === 'budget_officer') || ppmp?.parent?.signatures?.find(s => s.role === 'budget_officer') || null)
        : (hasBudgetApproved ? signatures.find(s => s.role === 'budget_officer') : null);

    const oppmoSig = isScopeAttachmentOnly
        ? (signatures.find(s => s.role === 'oppmo') || ppmp?.parent?.signatures?.find(s => s.role === 'oppmo') || null)
        : (hasOppmoApproved ? signatures.find(s => s.role === 'oppmo') : null);

    const paccoHeadSig = isTrustFund
        ? (signatures.find(s => s.role === 'pacco_head') || (isScopeAttachmentOnly ? ppmp?.parent?.signatures?.find(s => s.role === 'pacco_head') : null))
        : null;
    const budgetHeadSig = signatures.find(s => s.role === 'budget_head')
        || (isScopeAttachmentOnly ? ppmp?.parent?.signatures?.find(s => s.role === 'budget_head') : null)
        || null;
    const oppmoHeadSig = signatures.find(s => s.role === 'oppmo_head')
        || (isScopeAttachmentOnly ? ppmp?.parent?.signatures?.find(s => s.role === 'oppmo_head') : null)
        || null;

    const twgSig = hasTwgApproved ? signatures.find(s => s.role === 'twg') : null;

    const isPreparedPnpki = isPnpkiSystemEnabled && isSignatoryPnpkiActive(preparedSig, ppmp?.creator);
    const submittedByResolved = resolveSubmittedBySignatory(ppmp, headSig, [oppmoHeadSig, budgetHeadSig, paccoHeadSig], hasHeadApproved);
    const submittedByUser = submittedByResolved.user;
    const submittedBySignedAt = submittedByResolved.signedAt;
    const isHeadPnpki = isPnpkiSystemEnabled && submittedByResolved.isPnpkiActive;
    const isPaccoPnpki = isPnpkiSystemEnabled && isSignatoryPnpkiActive(paccoSig, ppmp?.budget_reviewer || ppmp?.budgetReviewer);
    const isPaccoHeadPnpki = isPnpkiSystemEnabled && isSignatoryPnpkiActive(paccoHeadSig);
    const isBudgetPnpki = isPnpkiSystemEnabled && isSignatoryPnpkiActive(budgetSig, ppmp?.budget_reviewer || ppmp?.budgetReviewer);
    const isBudgetHeadPnpki = isPnpkiSystemEnabled && isSignatoryPnpkiActive(budgetHeadSig);
    const isOppmoPnpki = isPnpkiSystemEnabled && isSignatoryPnpkiActive(oppmoSig, ppmp?.oppmo_reviewer || ppmp?.oppmoReviewer);
    const isOppmoHeadPnpki = isPnpkiSystemEnabled && isSignatoryPnpkiActive(oppmoHeadSig);
    const hasAnyPnpkiSig = isPreparedPnpki || isHeadPnpki || isPaccoPnpki || isPaccoHeadPnpki || isBudgetPnpki || isBudgetHeadPnpki || isOppmoPnpki || isOppmoHeadPnpki;

    return (
        <div className="bg-white min-h-screen font-sans text-black">

            <style>{`
                @media print {
                    @page {
                        size: landscape !important;
                        margin: 0 !important;
                    }
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                        height: 100% !important;
                        background: white !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .print-signature-box {
                        page-break-inside: avoid !important;
                        break-inside: avoid !important;
                    }
                    .print-table {
                        page-break-inside: auto;
                    }
                    .print-table tr {
                        page-break-inside: avoid;
                        page-break-after: auto;
                    }
                }
            `}</style>

            <div className="no-print bg-slate-900 text-white px-3 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-md">
                <div className="flex items-center justify-between sm:justify-start gap-3 min-w-0">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded border border-slate-700 transition cursor-pointer shrink-0"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Workspace
                    </button>
                    <div className="hidden sm:block min-w-0">
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-200 truncate">
                            Official Print Layout — Province of Davao del Sur PPMP
                        </div>
                        <div className="text-[11px] text-emerald-400 font-mono">
                            Ready for Landscape / Legal / A4 Printing
                        </div>
                    </div>
                </div>

                <div className="sm:hidden text-[11px] font-bold uppercase tracking-wider text-slate-200 leading-snug">
                    Official Print Layout — Province of Davao del Sur PPMP
                    <div className="text-[10px] text-emerald-400 font-mono font-normal normal-case">
                        Ready for Landscape / Legal / A4 Printing
                    </div>
                </div>

                <div className="flex items-center justify-end shrink-0">
                    <PrintExportDropdown
                        label="Print / Download PDF"
                        printLabel="Print PPMP"
                        printSublabel="Open browser print dialog"
                        downloadLabel="Download PPMP (PDF)"
                        downloadSublabel="Save official PPMP as .pdf file"
                        onPrint={handlePrint}
                        onDownloadPdf={handleDownloadPdf}
                        isExporting={isExportingPdf}
                    />
                </div>
            </div>

            <ResponsivePrintDocument paperWidth={1200}>
            <div ref={printContainerRef} className="pdf-export-root p-4 sm:p-6 max-w-[1550px] mx-auto text-black bg-white font-bold print:p-3 print:m-0 print:max-w-none print:w-full">

                <div className="text-sm font-mono font-extrabold text-black mb-1.5">
                    Tracker No.: <span className="font-extrabold text-black">{ppmp?.tracking_number || ppmp?.ppmp_number || '—'}</span>
                </div>

                <div className="flex items-center justify-center gap-4 mb-3">
                    <img
                        src="/images/logo.png"
                        alt="Province of Davao del Sur Official Seal"
                        className="w-18 h-18 object-contain flex-shrink-0"
                    />
                    <div className="text-center space-y-0.5">
                        <div className="text-sm uppercase font-bold tracking-wide leading-snug whitespace-nowrap">Republic of the Philippines</div>
                        <div className="text-lg font-extrabold uppercase tracking-wide leading-snug whitespace-nowrap">PROVINCIAL GOVERNMENT OF DAVAO DEL SUR</div>
                        <div className="text-sm font-bold leading-snug whitespace-nowrap">
                            Matti, Digos City
                        </div>
                        <div className="text-base font-extrabold leading-snug whitespace-nowrap pt-0.5">
                            PROJECT PROCUREMENT MANAGEMENT PLAN (PPMP) NO. <span className="font-mono">{ppmp.ppmp_number}</span>
                        </div>
                        <div className="flex items-center justify-center gap-10 text-xs font-extrabold pt-1 whitespace-nowrap">
                            <label className="inline-flex items-center gap-1.5 cursor-default whitespace-nowrap shrink-0">
                                <span className={`w-4 h-4 shrink-0 border-2 border-black inline-flex items-center justify-center text-xs leading-none ${ppmp.plan_type === 'INDICATIVE' ? 'bg-black text-white font-black' : 'bg-white'}`}>
                                    {ppmp.plan_type === 'INDICATIVE' ? '✓' : ''}
                                </span>
                                <span className="whitespace-nowrap">INDICATIVE</span>
                            </label>
                            <label className="inline-flex items-center gap-1.5 cursor-default whitespace-nowrap shrink-0">
                                <span className={`w-4 h-4 shrink-0 border-2 border-black inline-flex items-center justify-center text-xs leading-none ${ppmp.plan_type === 'FINAL' ? 'bg-black text-white font-black' : 'bg-white'}`}>
                                    {ppmp.plan_type === 'FINAL' ? '✓' : ''}
                                </span>
                                <span className="whitespace-nowrap">FINAL</span>
                            </label>
                        </div>
                    </div>
                </div>

                <div className="text-sm font-bold mb-2 space-y-0.5">
                    <div className="font-extrabold">
                        Fiscal Year : <span className="font-bold">(CY {ppmp.fiscal_year})</span>
                    </div>
                    <div className="font-extrabold">
                        End-User or Implementing Unit: <span className="font-bold uppercase">{(() => {
                            const val = (ppmp.implementing_unit || ppmp.office?.name || ppmp.title || '').trim();
                            if (!val) return '—';
                            return val.startsWith('(') ? val : `(${val})`;
                        })()}</span>
                    </div>
                </div>

                <table className="w-full table-fixed border-collapse border-2 border-black text-black text-xs font-bold leading-snug print-table">
                    <thead>
                        <tr className="text-center font-extrabold border-b-2 border-black bg-slate-50">
                            <th className="border border-black p-1.5 w-[20%]">
                                General Description and Objective of the<br />
                                Project to be Procured
                            </th>
                            <th className="border border-black p-1.5 w-[7%]">
                                Type of the Project to be<br />
                                Procured (Goods, Infra, Consulting)
                            </th>
                            <th className="border border-black p-1.5 w-[7%]">
                                Quantity and Size of the Project<br />
                                to be Procured
                            </th>
                            <th className="border border-black p-1.5 w-[8%]">
                                Recommended Mode of<br />
                                Procurement
                            </th>
                            <th className="border border-black p-1.5 w-[6%]">
                                Pre-Proc Conference<br />
                                (Yes/No)
                            </th>
                            <th className="border border-black p-1.5 w-[6%]">
                                Start of Procurement<br />
                                Activity
                            </th>
                            <th className="border border-black p-1.5 w-[6%]">
                                End of Procurement<br />
                                Activity
                            </th>
                            <th className="border border-black p-1.5 w-[7%]">
                                Expected Delivery/<br />
                                Implementation Period
                            </th>
                            <th className="border border-black p-1.5 w-[7%]">
                                Source of Funds
                            </th>
                            <th className="border border-black p-1.5 w-[10%]">
                                Estimated Budget / Authorized<br />
                                Budgetary Allocation (PhP)
                            </th>
                            <th className="border border-black p-1.5 w-[9%]">
                                ATTACHED SUPPORTING<br />
                                DOCUMENTS
                            </th>
                            <th className="border border-black p-1.5 w-[7%]">
                                REMARKS
                            </th>
                        </tr>
                    </thead>
                    <tbody>

                        <tr className="min-h-7 font-extrabold bg-white">
                            <td className="border border-black px-2 py-2 align-top text-center font-extrabold text-xs leading-snug whitespace-pre-wrap break-words">
                                {ppmp.program_name && (
                                    <div className="underline font-extrabold text-black pb-0.5 mb-0.5">
                                        {formatDescription6Words(ppmp.program_name)}
                                    </div>
                                )}
                                {formatDescription6Words(ppmp.account_code || displayRows.find(r => r.is_header)?.description || '')}
                            </td>
                            <td className="border border-black"></td>
                            <td className="border border-black"></td>
                            <td className="border border-black"></td>
                            <td className="border border-black"></td>
                            <td className="border border-black"></td>
                            <td className="border border-black"></td>
                            <td className="border border-black"></td>
                            <td className="border border-black"></td>
                            <td className="border border-black"></td>
                            <td className="border border-black"></td>
                            <td className="border border-black"></td>
                        </tr>

                        {displayRows.filter(r => !r.is_header).map((row, idx) => (
                            <tr key={idx} className="min-h-7 font-bold">
                                <td className="border border-black px-2 py-2 align-top text-center font-extrabold text-xs uppercase leading-snug whitespace-pre-wrap break-words">
                                    {formatDescription6Words(row.description)}
                                </td>
                                <td className="border border-black px-1.5 py-1.5 align-top text-center font-bold break-words">
                                    {row.project_type}
                                </td>
                                <td className="border border-black px-1.5 py-1.5 align-top text-center font-bold break-words">
                                    {row.quantity_size}
                                </td>
                                <td className="border border-black px-1.5 py-1.5 align-top text-center font-bold break-words">
                                    {row.procurement_mode}
                                </td>
                                <td className="border border-black px-1.5 py-1.5 align-top text-center font-extrabold">
                                    {row.pre_proc_conference === true ? 'Yes' : row.pre_proc_conference === false ? 'No' : ''}
                                </td>
                                <td className="border border-black px-1.5 py-1.5 align-top text-center font-bold">
                                    {row.start_date ? formatMonthYear(row.start_date) : ''}
                                </td>
                                <td className="border border-black px-1.5 py-1.5 align-top text-center font-bold">
                                    {row.end_date ? formatMonthYear(row.end_date) : ''}
                                </td>
                                <td className="border border-black px-1.5 py-1.5 align-top text-center font-bold">
                                    {row.delivery_period ? formatMonthYear(row.delivery_period) : ''}
                                </td>
                                <td className="border border-black px-1.5 py-1.5 align-top text-center font-bold break-words">
                                    {row.source_of_fund}
                                </td>
                                <td className="border border-black px-1.5 py-1.5 align-top text-right tabular-nums font-extrabold break-words">
                                    {row.estimated_budget !== null && row.estimated_budget !== undefined && row.estimated_budget > 0 ? formatCurrency(row.estimated_budget) : ''}
                                </td>
                                <td className="border border-black px-1.5 py-1.5 align-top text-left text-[11px] font-bold break-words">
                                    {row.supporting_docs_text}
                                </td>
                                <td className="border border-black px-1.5 py-1.5 align-top text-left text-[11px] font-bold break-words">
                                    {row.remarks}
                                </td>
                            </tr>
                        ))}

                        <tr className="border-t-2 border-black font-extrabold text-sm bg-slate-50">
                            <td colSpan={9} className="border border-black p-2.5 text-right font-extrabold uppercase tracking-wider align-middle">
                                Total Estimated Budget:
                            </td>
                            <td colSpan={3} className="border border-black p-2.5 text-center align-middle bg-slate-100">
                                <div className="text-xs font-extrabold uppercase tracking-wider text-black">TOTAL BUDGET:</div>
                                <div className="text-base font-extrabold tabular-nums mt-0.5 text-black break-words">
                                    {formatCurrency(ppmp.total_budget)}
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <table className="w-full border-collapse border-0 text-black text-xs font-bold mt-3 print-signature-box">
                    <tbody>

                        <tr>
                            <td className="w-1/2 p-1.5 align-top">
                                <div className="font-extrabold text-xs">Prepared By:</div>
                                <div className="text-center flex flex-col items-center justify-end">
                                    {isSignatureEnabled && preparedSig?.user?.signature_path ? (
                                        <>
                                            <div className={`h-8 flex items-center justify-center ${!isPreparedPnpki ? 'no-print print:hidden' : ''}`}>
                                                <img
                                                    src={`/api/users/${preparedSig.user.id}/signature`}
                                                    alt="Signature"
                                                    className="max-h-8 max-w-[120px] object-contain"
                                                />
                                            </div>
                                            {!isPreparedPnpki && <div className="hidden print:block pdf-export-spacer h-6" />}
                                        </>
                                    ) : (
                                        <div className="h-6" />
                                    )}
                                    <div className="font-extrabold text-sm uppercase underline whitespace-nowrap leading-snug">
                                        {preparedSig?.signer_name || ppmp?.creator?.name || 'NAME'}
                                    </div>
                                    <div className="text-xs font-bold uppercase whitespace-nowrap mt-0.5">
                                        {preparedSig?.signer_designation || ppmp?.creator?.designation || 'Designation'}
                                    </div>
                                    {isSignatureEnabled && preparedSig && (
                                        <div className={`text-[10px] font-mono font-bold text-slate-700 ${!isPreparedPnpki ? 'no-print print:hidden' : ''}`}>
                                            Date/Time: {formatDate(preparedSig.signed_at)}
                                        </div>
                                    )}
                                </div>
                            </td>
                            <td className="w-1/2 p-1.5 align-top">
                                <div className="font-extrabold text-xs">Submitted By:</div>
                                <div className="text-center flex flex-col items-center justify-end">
                                    <div className="h-8" />
                                    <div className="font-extrabold text-sm uppercase underline whitespace-nowrap leading-snug">
                                        {headSig?.signer_name || ppmp?.office_head_name || ppmp?.default_signatories?.submitted_by?.name || ppmp?.default_signatories?.head_of_office?.name || ppmp?.office?.head_name || ppmp?.office?.head?.name || 'NAME'}
                                    </div>
                                    <div className="text-xs uppercase font-bold whitespace-nowrap mt-0.5">
                                        {headSig?.signer_designation || ppmp?.office_head_designation || ppmp?.default_signatories?.submitted_by?.position || ppmp?.default_signatories?.head_of_office?.position || ppmp?.office?.designation || ppmp?.office?.head?.designation || 'HEAD OF OFFICE'}
                                    </div>
                                </div>
                            </td>
                        </tr>

                        <tr>
                            <td colSpan={2} className="py-1.5 print:py-1"></td>
                        </tr>

                        <tr>
                            <td className="w-1/2 p-1.5 align-top pt-1 print:pt-0.5">
                                <div className="font-extrabold text-xs mb-1">
                                    Reviewed as to Budgetary Requirement
                                </div>
                                <div className="text-center flex flex-col items-center justify-end">
                                    {isTrustFund ? (
                                        <>
                                            {isSignatureEnabled && paccoHeadSig?.user?.signature_path ? (
                                                <>
                                                    <div className={`h-8 flex items-center justify-center ${!isPaccoHeadPnpki ? 'no-print print:hidden' : ''}`}>
                                                        <img
                                                            src={`/api/users/${paccoHeadSig.user.id}/signature`}
                                                            alt="PACCO Head Signature"
                                                            className="max-h-8 max-w-[120px] object-contain"
                                                        />
                                                    </div>
                                                    {!isPaccoHeadPnpki && <div className="hidden print:block pdf-export-spacer h-4" />}
                                                </>
                                            ) : (
                                                <div className="h-4" />
                                            )}
                                            <div className="relative inline-flex items-center justify-center">
                                                <div className="font-extrabold text-sm uppercase underline text-center whitespace-nowrap leading-snug">
                                                    {ppmp?.default_signatories?.pacco_requirement?.name || (paccoSig?.signer_name && paccoSig.signer_name !== 'PACCO Reviewer' ? paccoSig.signer_name : 'MAY FERNANDO-UY, CPA')}
                                                </div>
                                                {isSignatureEnabled && paccoSig?.user?.signature_path && (
                                                    <img
                                                        src={`/api/users/${paccoSig.user.id}/signature`}
                                                        alt="Initial Signature"
                                                        className={`h-7 max-w-[65px] object-contain absolute left-full ml-1.5 bottom-0 pointer-events-none ${!isPaccoPnpki ? 'no-print print:hidden' : ''}`}
                                                    />
                                                )}
                                            </div>
                                            <div className="text-xs font-bold uppercase whitespace-nowrap mt-0.5">
                                                {ppmp?.default_signatories?.pacco_requirement?.position || (paccoSig?.signer_designation && paccoSig.signer_designation !== 'Provincial Accounting Reviewer' ? paccoSig.signer_designation : 'Provincial Accountant')}
                                            </div>
                                            {isSignatureEnabled && (paccoHeadSig || paccoSig) && (
                                                <div className={`text-[10px] font-mono font-bold text-slate-700 ${!(isPaccoHeadPnpki || isPaccoPnpki) ? 'no-print print:hidden' : ''}`}>
                                                    Date/Time: {formatDate((paccoHeadSig || paccoSig).signed_at)}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            {isSignatureEnabled && budgetHeadSig?.user?.signature_path ? (
                                                <>
                                                    <div className={`h-8 flex items-center justify-center ${!isBudgetHeadPnpki ? 'no-print print:hidden' : ''}`}>
                                                        <img
                                                            src={`/api/users/${budgetHeadSig.user.id}/signature`}
                                                            alt="Budget Head Signature"
                                                            className="max-h-8 max-w-[120px] object-contain"
                                                        />
                                                    </div>
                                                    {!isBudgetHeadPnpki && <div className="hidden print:block pdf-export-spacer h-4" />}
                                                </>
                                            ) : (
                                                <div className="h-4" />
                                            )}
                                            <div className="relative inline-flex items-center justify-center">
                                                <div className="font-extrabold text-sm uppercase underline text-center whitespace-nowrap leading-snug">
                                                    {ppmp?.default_signatories?.budget_requirement?.name || 'DESSAMIE BUAT-SANCHEZ, CPA, JD'}
                                                </div>
                                                {isSignatureEnabled && budgetSig?.user?.signature_path && (
                                                    <img
                                                        src={`/api/users/${budgetSig.user.id}/signature`}
                                                        alt="Initial Signature"
                                                        className={`h-7 max-w-[65px] object-contain absolute left-full ml-1.5 bottom-0 pointer-events-none ${!isBudgetPnpki ? 'no-print print:hidden' : ''}`}
                                                    />
                                                )}
                                            </div>
                                            <div className="text-xs font-bold uppercase whitespace-nowrap mt-0.5">
                                                {ppmp?.default_signatories?.budget_requirement?.position || 'PGDH - PBO / BAC - Chairman'}
                                            </div>
                                            {isSignatureEnabled && (budgetHeadSig || budgetSig) && (
                                                <div className={`text-[10px] font-mono font-bold text-slate-700 ${!(isBudgetHeadPnpki || isBudgetPnpki) ? 'no-print print:hidden' : ''}`}>
                                                    Date/Time: {formatDate((budgetHeadSig || budgetSig).signed_at)}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </div>
                            </td>
                            <td className="w-1/2 p-1.5 align-top pt-1 print:pt-0.5">
                                <div className="font-extrabold text-xs mb-1">Reviewed by BAC- Secretariat</div>
                                <div className="text-center flex flex-col items-center justify-end">
                                    {isSignatureEnabled && oppmoHeadSig?.user?.signature_path ? (
                                        <>
                                            <div className={`h-8 flex items-center justify-center ${!isOppmoHeadPnpki ? 'no-print print:hidden' : ''}`}>
                                                <img
                                                    src={`/api/users/${oppmoHeadSig.user.id}/signature`}
                                                    alt="OPPMO Head Signature"
                                                    className="max-h-8 max-w-[120px] object-contain"
                                                />
                                            </div>
                                            {!isOppmoHeadPnpki && <div className="hidden print:block pdf-export-spacer h-4" />}
                                        </>
                                    ) : (
                                        <div className="h-4" />
                                    )}
                                    <div className="relative inline-flex items-center justify-center">
                                        <div className="font-extrabold text-sm uppercase underline text-center whitespace-nowrap leading-snug">
                                            {ppmp?.default_signatories?.bac_secretariat?.name || 'NORJANNA M. CAMAGUIN, MPA'}
                                        </div>
                                        {isSignatureEnabled && oppmoSig?.user?.signature_path && (
                                            <img
                                                src={`/api/users/${oppmoSig.user.id}/signature`}
                                                alt="Initial Signature"
                                                className={`h-7 max-w-[65px] object-contain absolute left-full ml-1.5 bottom-0 pointer-events-none ${!isOppmoPnpki ? 'no-print print:hidden' : ''}`}
                                            />
                                        )}
                                    </div>
                                    <div className="text-xs uppercase font-bold whitespace-nowrap mt-0.5">
                                        {ppmp?.default_signatories?.bac_secretariat?.position || 'PGDH - OPPMO'}
                                    </div>
                                    {isSignatureEnabled && (oppmoHeadSig || oppmoSig) && (
                                        <div className={`text-[10px] font-mono font-bold text-slate-700 ${!(isOppmoHeadPnpki || isOppmoPnpki) ? 'no-print print:hidden' : ''}`}>
                                            Date/Time: {formatDate((oppmoHeadSig || oppmoSig).signed_at)}
                                        </div>
                                    )}
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {isSignatureEnabled && (
                    <div className={`mt-2 pt-1 border-t border-dotted border-slate-300 text-center print:mt-1 print:pt-0.5 ${!hasAnyPnpkiSig ? 'no-print print:hidden' : ''}`}>
                        <p className="text-[8px] italic text-slate-600 font-sans tracking-wide">
                            * This is an electronically generated document under the Electronic Procurement Management System. Signatures affixed with a valid PNPKI Digital E-Signature are electronically certified; others require a physical/handwritten signature.
                        </p>
                    </div>
                )}
            </div>
            </ResponsivePrintDocument>
        </div>
    );
};
