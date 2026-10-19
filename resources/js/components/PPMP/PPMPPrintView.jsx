import React from 'react';
import { formatCurrency, formatDate } from '../UI/StatusBadge';
import { Printer, ArrowLeft } from 'lucide-react';
import { formatDescription6Words, formatMonthYear } from './ProcurementPlanTable';
import { useSignatureSettings } from '../../utils/signatureController';

export const PPMPPrintView = ({ ppmp, onBack }) => {
    const { isEnabled } = useSignatureSettings();
    const isSignatureEnabled = ppmp?.signature_settings?.ppmp !== undefined
        ? Boolean(ppmp.signature_settings.ppmp)
        : isEnabled('ppmp');

    const handlePrint = () => {
        window.print();
    };

    const items = ppmp.items || [];
    // Only render actual PPMP items with no extra blank placeholder rows
    const displayRows = items;

    const signatures = ppmp?.signatures || [];

    // If scope is ATTACHMENT_LIST only, PPMP / APP were NOT changed and retain approved baseline signatures from parent.
    // If scope is PPMP_APP, ALL, or initial plan: PPMP / APP ARE being changed, so budget & oppmo reviewer signatures MUST BE NONE until they approve this child PPMP!
    const isScopeAttachmentOnly = ppmp?.amendment_scope === 'ATTACHMENT_LIST';

    // Reviewer signatures require review approval before their initial/signature is valid
    const hasHeadApproved = Boolean(
        ppmp?.head_approved_at ||
        ppmp?.status === 'READY_TO_PRINT'
    );
    const hasTwgApproved = Boolean(
        ppmp?.twg_approved_at ||
        ['HEAD_PENDING', 'HEAD_RETURNED', 'READY_TO_PRINT'].includes(ppmp?.status)
    );
    const hasOppmoApproved = Boolean(
        ppmp?.oppmo_approved_at ||
        ['TWG_REVIEW', 'TWG_RETURNED', 'HEAD_PENDING', 'HEAD_RETURNED', 'READY_TO_PRINT'].includes(ppmp?.status)
    );
    const hasBudgetApproved = Boolean(
        ppmp?.budget_approved_at ||
        ['OPPMO_REVIEW', 'OPPMO_RETURNED', 'TWG_REVIEW', 'TWG_RETURNED', 'HEAD_PENDING', 'HEAD_RETURNED', 'READY_TO_PRINT'].includes(ppmp?.status)
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
    const hasPaccoApproved = Boolean(
        ppmp?.pacco_approved_at ||
        ['OPPMO_REVIEW', 'OPPMO_RETURNED', 'TWG_REVIEW', 'TWG_RETURNED', 'HEAD_PENDING', 'HEAD_RETURNED', 'READY_TO_PRINT'].includes(ppmp?.status)
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

    const twgSig = hasTwgApproved ? signatures.find(s => s.role === 'twg') : null;

    return (
        <div className="bg-white min-h-screen font-sans text-black">
            {/* Force landscape printing without browser header/footer margins */}
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

            {/* Top Action Bar (Hidden in Print) */}
            <div className="no-print bg-slate-900 text-white px-6 py-3 flex items-center justify-between shadow-md">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded border border-slate-700 transition cursor-pointer"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to Workspace
                    </button>
                    <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-200">
                            Official Print Layout — Province of Davao del Sur PPMP
                        </div>
                        <div className="text-[11px] text-emerald-400 font-mono">
                            Ready for Landscape / Legal / A4 Printing
                        </div>
                    </div>
                </div>

                <button
                    onClick={handlePrint}
                    className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded shadow transition cursor-pointer"
                >
                    <Printer className="w-4 h-4" />
                    PRINT PPMP NOW
                </button>
            </div>

            {/* Exact PDF Layout Container - Zero margin & full width on print */}
            <div className="p-4 sm:p-8 max-w-[1550px] mx-auto text-black bg-white print:p-3 print:m-0 print:max-w-none print:w-full">
                {/* Top-left Tracker No. */}
                <div className="text-xs font-mono font-bold text-slate-800 print:text-black mb-1">
                    Tracker No.: <span className="font-bold text-black">{ppmp?.tracking_number || ppmp?.ppmp_number || '—'}</span>
                </div>

                {/* Header matching PDF with Logo beside the header text */}
                <div className="flex items-center justify-center gap-4 mb-2">
                    <img
                        src="/images/logo.png"
                        alt="Province of Davao del Sur Official Seal"
                        className="w-16 h-16 object-contain flex-shrink-0"
                    />
                    <div className="text-center">
                        <div className="text-xs uppercase font-normal tracking-wide leading-tight">Republic of the Philippines</div>
                        <div className="text-base font-bold uppercase tracking-wider leading-tight">PROVINCIAL GOVERNMENT OF DAVAO DEL SUR</div>
                        <div className="text-sm font-normal tracking-tight mt-0.5">
                            Matti, Digos City
                        </div>
                        <div className="text-sm font-bold tracking-tight mt-0.5">
                            PROJECT PROCUREMENT MANAGEMENT PLAN (PPMP) NO. <span className="font-mono">{ppmp.ppmp_number}</span>
                        </div>
                        <div className="flex items-center justify-center gap-10 text-xs font-bold mt-1">
                            <label className="flex items-center gap-1.5 cursor-default">
                                <span className={`w-3.5 h-3.5 border border-black inline-flex items-center justify-center text-[10px] leading-none ${ppmp.plan_type === 'INDICATIVE' ? 'bg-black text-white font-black' : 'bg-white'}`}>
                                    {ppmp.plan_type === 'INDICATIVE' ? '✓' : ''}
                                </span>
                                <span>INDICATIVE</span>
                            </label>
                            <label className="flex items-center gap-1.5 cursor-default">
                                <span className={`w-3.5 h-3.5 border border-black inline-flex items-center justify-center text-[10px] leading-none ${ppmp.plan_type === 'FINAL' ? 'bg-black text-white font-black' : 'bg-white'}`}>
                                    {ppmp.plan_type === 'FINAL' ? '✓' : ''}
                                </span>
                                <span>FINAL</span>
                            </label>
                        </div>
                    </div>
                </div>

                {/* Fiscal Year & End-User Subheaders */}
                <div className="text-xs mb-1">
                    <div className="font-bold">
                        Fiscal Year : <span className="font-normal">(CY {ppmp.fiscal_year})</span>
                    </div>
                    <div className="font-bold mt-0.5">
                        End-User or Implementing Unit: <span className="font-normal uppercase">({ppmp.implementing_unit || ppmp.office?.name || ppmp.title})</span>
                    </div>
                </div>

                {/* Exact 12-column Table Structure from PDF */}
                <table className="w-full border-collapse border border-black text-black text-[9px] leading-tight print-table">
                    <thead>
                        <tr className="text-center font-bold border-b border-black">
                            <th className="border border-black p-1 w-[22%]">
                                General Description and Objective of the<br />
                                Project to be Procured
                            </th>
                            <th className="border border-black p-1 w-[5%]">
                                Type of the Project to be<br />
                                Procured (whether Goods, Infrastructure and<br />
                                Consulting Services)
                            </th>
                            <th className="border border-black p-1 w-[7%]">
                                Quantity and Size of the Project<br />
                                to be Procured
                            </th>
                            <th className="border border-black p-1 w-[9%]">
                                Recommended Mode of<br />
                                Procurement
                            </th>
                            <th className="border border-black p-1 w-[5%]">
                                Pre-Procurement Conference, if<br />
                                applicable (Yes/No)
                            </th>
                            <th className="border border-black p-1 w-[6%]">
                                Start of Procurement<br />
                                Activity
                            </th>
                            <th className="border border-black p-1 w-[6%]">
                                End of Procurement<br />
                                Activity
                            </th>
                            <th className="border border-black p-1 w-[7%]">
                                Expected Delivery/<br />
                                Implementation Period
                            </th>
                            <th className="border border-black p-1 w-[7%]">
                                Source of Funds
                            </th>
                            <th className="border border-black p-1 w-[9%]">
                                Estimated Budget / Authorized<br />
                                Budgetary Allocation (PhP)
                            </th>
                            <th className="border border-black p-1 w-[9%]">
                                ATTACHED SUPPORTING<br />
                                DOCUMENTS
                            </th>
                            <th className="border border-black p-1 w-[8%]">
                                REMARKS
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {/* 2nd row immediately after table header row: Category / Account Title */}
                        <tr className="min-h-6 font-bold bg-white">
                            <td className="border border-black px-2 py-1.5 align-top text-center font-bold text-[9px] leading-tight whitespace-pre-wrap">
                                {ppmp.program_name && (
                                    <div className="underline font-bold text-black pb-0.5 mb-0.5">
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
                            <tr key={idx} className="min-h-6">
                                <td className="border border-black px-2 py-1.5 align-top text-center font-bold text-[9px] uppercase leading-relaxed whitespace-pre-wrap">
                                    {formatDescription6Words(row.description)}
                                </td>
                                <td className="border border-black px-1 py-1 align-top text-center">
                                    {row.project_type}
                                </td>
                                <td className="border border-black px-1 py-1 align-top text-center">
                                    {row.quantity_size}
                                </td>
                                <td className="border border-black px-1 py-1 align-top text-center">
                                    {row.procurement_mode}
                                </td>
                                <td className="border border-black px-1 py-1 align-top text-center font-bold">
                                    {row.pre_proc_conference === true ? 'Yes' : row.pre_proc_conference === false ? 'No' : ''}
                                </td>
                                <td className="border border-black px-1 py-1 align-top text-center">
                                    {row.start_date ? formatMonthYear(row.start_date) : ''}
                                </td>
                                <td className="border border-black px-1 py-1 align-top text-center">
                                    {row.end_date ? formatMonthYear(row.end_date) : ''}
                                </td>
                                <td className="border border-black px-1 py-1 align-top text-center">
                                    {row.delivery_period ? formatMonthYear(row.delivery_period) : ''}
                                </td>
                                <td className="border border-black px-1 py-1 align-top text-center">
                                    {row.source_of_fund}
                                </td>
                                <td className="border border-black px-1.5 py-1 align-top text-right font-mono font-bold">
                                    {row.estimated_budget !== null && row.estimated_budget !== undefined && row.estimated_budget > 0 ? formatCurrency(row.estimated_budget) : ''}
                                </td>
                                <td className="border border-black px-1 py-1 align-top text-left text-[8px]">
                                    {row.supporting_docs_text}
                                </td>
                                <td className="border border-black px-1 py-1 align-top text-left text-[8px]">
                                    {row.remarks}
                                </td>
                            </tr>
                        ))}

                        {/* Bottom Total Budget Summary Row */}
                        <tr className="border-t border-black font-semibold text-xs bg-slate-50">
                            <td colSpan={9} className="border border-black p-2 text-right font-bold uppercase tracking-wider align-middle">
                                Total Estimated Budget:
                            </td>
                            <td colSpan={3} className="border border-black p-2 text-center align-middle bg-slate-100">
                                <div className="text-[10px] font-extrabold uppercase tracking-wider text-black">TOTAL BUDGET:</div>
                                <div className="text-sm font-extrabold font-mono mt-0.5">
                                    {formatCurrency(ppmp.total_budget)}
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* Signature Block matching exact 4 sections from the PDF without cell outlines and compressed */}
                <table className="w-full border-collapse border-0 text-black text-[9px] mt-1 print-signature-box">
                    <tbody>
                        {/* Top row: Prepared By & Submitted By */}
                        <tr>
                            <td className="w-1/2 p-1 align-top">
                                <div className="font-bold text-[9px]">Prepared By:</div>
                                <div className="text-center flex flex-col items-center justify-end">
                                    {isSignatureEnabled && preparedSig?.user?.signature_path ? (
                                        <div className="h-8 flex items-center justify-center">
                                            <img
                                                src={`/api/users/${preparedSig.user.id}/signature`}
                                                alt="Signature"
                                                className="max-h-8 max-w-[120px] object-contain"
                                            />
                                        </div>
                                    ) : (
                                        <div className="h-2" />
                                    )}
                                    <div className="font-bold text-xs uppercase underline">
                                        {preparedSig?.signer_name || 'NAME'}
                                    </div>
                                    <div className="text-[9px] uppercase">
                                        {preparedSig?.signer_designation || 'Designation'}
                                    </div>
                                    {isSignatureEnabled && preparedSig && (
                                        <div className="text-[8px] font-mono text-slate-600">
                                            [{preparedSig.signature_indicator}] • {formatDate(preparedSig.signed_at)}
                                        </div>
                                    )}
                                </div>
                            </td>
                            <td className="w-1/2 p-1 align-top">
                                <div className="font-bold text-[9px]">Submitted By:</div>
                                <div className="text-center flex flex-col items-center justify-end">
                                    {isSignatureEnabled && headSig?.user?.signature_path ? (
                                        <div className="h-8 flex items-center justify-center">
                                            <img
                                                src={`/api/users/${headSig.user.id}/signature`}
                                                alt="Signature"
                                                className="max-h-8 max-w-[120px] object-contain"
                                            />
                                        </div>
                                    ) : (
                                        <div className="h-2" />
                                    )}
                                    <div className="font-bold text-xs uppercase underline">
                                        {headSig?.signer_name || ppmp?.office?.head_name || ppmp?.office?.head?.name || 'NAME'}
                                    </div>
                                    <div className="text-[9px] uppercase font-bold">
                                        {headSig?.signer_designation || ppmp?.office?.designation || ppmp?.office?.head?.designation || 'HEAD OF OFFICE'}
                                    </div>
                                    {isSignatureEnabled && headSig && (
                                        <div className="text-[8px] font-mono text-slate-600">
                                            [{headSig.signature_indicator}] • {formatDate(headSig.signed_at)}
                                        </div>
                                    )}
                                </div>
                            </td> 
                        </tr>

                        {/* Spacer row between signature tiers */}
                        <tr>
                            <td colSpan={2} className="py-1 print:py-0.5"></td>
                        </tr>

                        {/* Bottom row: Reviewed as to Budgetary Requirement (General Fund OR Trust Fund by PACCO) & Reviewed by BAC-Secretariat */}
                        <tr>
                            <td className="w-1/2 p-1 align-top pt-1 print:pt-0.5">
                                <div className="font-bold text-[9px] mb-1">
                                    Reviewed as to Budgetary Requirement
                                </div>
                                <div className="text-center flex flex-col items-center justify-end">
                                    {isTrustFund ? (
                                        <>
                                            <div className="relative inline-flex items-center justify-center">
                                                <div className="font-bold text-xs uppercase underline text-center">
                                                    {ppmp?.default_signatories?.pacco_requirement?.name || (paccoSig?.signer_name && paccoSig.signer_name !== 'PACCO Reviewer' ? paccoSig.signer_name : 'MAY FERNANDO-UY, CPA')}
                                                </div>
                                                {isSignatureEnabled && paccoSig?.user?.signature_path && (
                                                    <img
                                                        src={`/api/users/${paccoSig.user.id}/signature`}
                                                        alt="Initial Signature"
                                                        className="h-7 max-w-[65px] object-contain absolute left-full ml-1.5 bottom-0 pointer-events-none"
                                                    />
                                                )}
                                            </div>
                                            <div className="text-[9px] uppercase mt-0.5">
                                                {ppmp?.default_signatories?.pacco_requirement?.position || (paccoSig?.signer_designation && paccoSig.signer_designation !== 'Provincial Accounting Reviewer' ? paccoSig.signer_designation : 'Provincial Accountant')}
                                            </div>
                                            {isSignatureEnabled && (
                                                paccoSig ? (
                                                    <div className="text-[8px] font-mono text-slate-600">
                                                        [{paccoSig.signature_indicator}] • {formatDate(paccoSig.signed_at)}
                                                    </div>
                                                ) : (
                                                    <div className="text-[8px] text-slate-400 italic">
                                                        Awaiting Certification
                                                    </div>
                                                )
                                            )}
                                        </>
                                    ) : (
                                        <>
                                            <div className="relative inline-flex items-center justify-center">
                                                <div className="font-bold text-xs uppercase underline text-center">
                                                    {ppmp?.default_signatories?.budget_requirement?.name || 'DESSAMIE BUAT-SANCHEZ, CPA, JD'}
                                                </div>
                                                {isSignatureEnabled && budgetSig?.user?.signature_path && (
                                                    <img
                                                        src={`/api/users/${budgetSig.user.id}/signature`}
                                                        alt="Initial Signature"
                                                        className="h-7 max-w-[65px] object-contain absolute left-full ml-1.5 bottom-0 pointer-events-none"
                                                    />
                                                )}
                                            </div>
                                            <div className="text-[9px] uppercase mt-0.5">
                                                {ppmp?.default_signatories?.budget_requirement?.position || 'PGDH - PBO / BAC - Chairman'}
                                            </div>
                                            {isSignatureEnabled && (
                                                budgetSig ? (
                                                    <div className="text-[8px] font-mono text-slate-600">
                                                        [{budgetSig.signature_indicator}] • {formatDate(budgetSig.signed_at)}
                                                    </div>
                                                ) : (
                                                    <div className="text-[8px] text-slate-400 italic">
                                                        Awaiting Certification
                                                    </div>
                                                )
                                            )}
                                        </>
                                    )}
                                </div>
                            </td>
                            <td className="w-1/2 p-1 align-top pt-1 print:pt-0.5">
                                <div className="font-bold text-[9px] mb-1">Reviewed by BAC- Secretariat</div>
                                <div className="text-center flex flex-col items-center justify-end">
                                    <div className="relative inline-flex items-center justify-center">
                                        <div className="font-bold text-xs uppercase underline text-center">
                                            {ppmp?.default_signatories?.bac_secretariat?.name || 'NORJANNA M. CAMAGUIN, MPA'}
                                        </div>
                                        {isSignatureEnabled && oppmoSig?.user?.signature_path && (
                                            <img
                                                src={`/api/users/${oppmoSig.user.id}/signature`}
                                                alt="Initial Signature"
                                                className="h-7 max-w-[65px] object-contain absolute left-full ml-1.5 bottom-0 pointer-events-none"
                                            />
                                        )}
                                    </div>
                                    <div className="text-[9px] uppercase font-bold mt-0.5">
                                        {ppmp?.default_signatories?.bac_secretariat?.position || 'PGDH - OPPMO'}
                                    </div>
                                    {isSignatureEnabled && (
                                        oppmoSig ? (
                                            <div className="text-[8px] font-mono text-slate-600">
                                                [{oppmoSig.signature_indicator}] • {formatDate(oppmoSig.signed_at)}
                                            </div>
                                        ) : (
                                            <div className="text-[8px] text-slate-400 italic">
                                                Awaiting Verification
                                            </div>
                                        )
                                    )}
                                </div>
                            </td>
                        </tr>
                    </tbody>
                </table>

                {/* System Generated / E-Signature Validity Notice */}
                {isSignatureEnabled && (
                    <div className="mt-2 pt-1 border-t border-dotted border-slate-300 text-center print:mt-1 print:pt-0.5">
                        <p className="text-[8px] italic text-slate-600 font-sans tracking-wide">
                            * This is an electronically generated and certified document under the Electronic Procurement Management System. Valid even without a physical or handwritten signature.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
};
