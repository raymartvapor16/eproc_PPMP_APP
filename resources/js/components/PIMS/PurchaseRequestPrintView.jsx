import React from 'react';
import { Printer, ArrowLeft, Download, CheckCircle2, ShieldCheck, Clock, Building2, User, FileText, ExternalLink, Paperclip, Lock } from 'lucide-react';
import { formatCurrency, formatDate } from '../UI/StatusBadge';

export const PurchaseRequestPrintView = ({
    purchaseRequest,
    onBack,
    onReview,
    user = null,
}) => {
    if (!purchaseRequest) return null;

    const pr = purchaseRequest;
    const items = pr.items || [];

    const handlePrint = () => {
        window.print();
    };

    const formatNumber = (val) => {
        const num = parseFloat(val);
        if (isNaN(num)) return '0.00';
        return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    };

    const lotHeader = items.find((i) => i.is_lot_header);
    const lineItems = items.filter((i) => !i.is_lot_header);

    const greenSpecsLines = (pr.green_specifications || '')
        .split('\n')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

    const datePublishedStr = pr.date_published ? formatDate(pr.date_published) : (pr.created_at ? formatDate(pr.created_at) : '');
    const prDateStr = pr.pr_date ? formatDate(pr.pr_date) : '';

    return (
        <div className="bg-slate-100 min-h-screen py-6 px-4 no-print-bg">

            <style>{`
                @media print {
                    @page {
                        size: portrait !important;
                        margin: 10mm 12mm !important;
                    }
                    html, body {
                        background-color: #ffffff !important;
                        background: #ffffff !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        width: 100% !important;
                        height: auto !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .no-print, .no-print * {
                        display: none !important;
                    }
                    .no-print-bg {
                        background: transparent !important;
                        padding: 0 !important;
                    }
                    .print-sheet {
                        box-shadow: none !important;
                        border: none !important;
                        width: 100% !important;
                        max-width: 100% !important;
                        min-height: 100% !important;
                        height: auto !important;
                        margin: 0 auto !important;
                        padding: 0 !important;
                        page-break-after: always !important;
                        break-after: page !important;
                    }
                    .print-sheet:last-of-type {
                        page-break-after: auto !important;
                        break-after: auto !important;
                    }
                }
            `}</style>

            <div className="max-w-[210mm] mx-auto mb-4 bg-white rounded-xl shadow-xs border border-slate-200 p-3 flex items-center justify-between no-print">
                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onBack}
                        className="px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1.5 transition cursor-pointer"
                    >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Back</span>
                    </button>
                    <div className="text-xs text-slate-500 pl-2 border-l border-slate-200">
                        Purchase Request ID: <strong className="text-slate-800">{pr.tracker_id}</strong>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {onReview && (
                        <button
                            type="button"
                            onClick={() => onReview(pr)}
                            className="px-3.5 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                        >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            <span>Review & Action</span>
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={handlePrint}
                        className="px-3.5 py-1.5 text-xs font-bold text-white bg-slate-900 hover:bg-slate-800 rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                    >
                        <Printer className="w-3.5 h-3.5" />
                        <span>Print PR (PDF)</span>
                    </button>
                </div>
            </div>

            <div className="max-w-[210mm] mx-auto space-y-8">

                <div className="bg-white p-8 sm:p-10 shadow-lg border border-slate-300 print-sheet font-serif text-black leading-tight text-[11px] relative w-full max-w-[210mm] min-h-[297mm] mx-auto flex flex-col justify-between">

                    <div className="flex items-start justify-center gap-4 mb-2 relative">
                        <div className="w-16 h-16 shrink-0 absolute left-6 top-0">
                            <img
                                src="/images/logo.png"
                                alt="Province Seal"
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <div className="text-center font-bold">
                            <h1 className="text-lg tracking-wide uppercase">Purchase Request</h1>
                            <h2 className="text-xs uppercase font-bold tracking-normal">
                                Provincial Government of Davao del Sur
                            </h2>
                            <p className="text-[11px] font-normal">Matti, Digos City</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] mb-1 font-sans">
                        <div>
                            <span>Date Submitted/Published: </span>
                            <span className="font-semibold">{datePublishedStr}</span>
                        </div>
                        <div>
                            <span>PR Id.: </span>
                            <span className="font-bold underline">{pr.tracker_id}</span>
                        </div>
                    </div>

                    <table className="w-full border-collapse border border-black text-[10px] mb-[-1px] font-sans">
                        <tbody>
                            <tr>
                                <td className="border border-black p-1 w-1/2">
                                    <span className="font-semibold">Department: </span>
                                    <span className="uppercase">{pr.department}</span>
                                </td>
                                <td className="border border-black p-1 w-1/4">
                                    <span className="font-semibold">P.R No.: </span>
                                    <span>{pr.pr_number || ''}</span>
                                </td>
                                <td className="border border-black p-1 w-1/4">
                                    <span className="font-semibold">Date: </span>
                                    <span>{prDateStr}</span>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={3} className="border border-black p-1">
                                    <span className="font-semibold">Section: </span>
                                    <span>{pr.section || ''}</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <table className="w-full border-collapse border border-black text-[10px] font-sans">
                        <thead>
                            <tr className="text-center font-bold bg-slate-50 print:bg-transparent">
                                <th className="border border-black p-1 w-[8%]">Item<br/>No.</th>
                                <th className="border border-black p-1 w-[10%]">Unit</th>
                                <th className="border border-black p-1 w-[52%]">Item and Description</th>
                                <th className="border border-black p-1 w-[8%]">Qty</th>
                                <th className="border border-black p-1 w-[11%]">Unit Cost</th>
                                <th className="border border-black p-1 w-[11%]">Total Cost</th>
                            </tr>
                        </thead>
                        <tbody>

                            {lotHeader ? (
                                <tr className="align-top">
                                    <td className="border-x border-black px-1.5 py-1 text-center font-bold">{lotHeader.item_no}</td>
                                    <td className="border-x border-black px-1.5 py-1 text-center">{lotHeader.unit}</td>
                                    <td className="border-x border-black px-1.5 py-1 font-bold whitespace-pre-line">{lotHeader.item_description}</td>
                                    <td className="border-x border-black px-1.5 py-1 text-right">{lotHeader.quantity ? formatNumber(lotHeader.quantity) : ''}</td>
                                    <td className="border-x border-black px-1.5 py-1 text-right">{lotHeader.unit_cost ? formatNumber(lotHeader.unit_cost) : ''}</td>
                                    <td className="border-x border-black px-1.5 py-1 text-right font-bold">{lotHeader.total_cost ? formatNumber(lotHeader.total_cost) : ''}</td>
                                </tr>
                            ) : null}

                            {lineItems.map((item, idx) => (
                                <tr key={idx} className="align-top">
                                    <td className="border-x border-black px-1.5 py-0.5 text-center">{item.item_no || ''}</td>
                                    <td className="border-x border-black px-1.5 py-0.5 text-center">{item.unit || ''}</td>
                                    <td className="border-x border-black px-1.5 py-0.5 whitespace-pre-line leading-snug">
                                        {item.item_description}
                                    </td>
                                    <td className="border-x border-black px-1.5 py-0.5 text-right">{item.quantity ? formatNumber(item.quantity) : ''}</td>
                                    <td className="border-x border-black px-1.5 py-0.5 text-right">{item.unit_cost ? formatNumber(item.unit_cost) : ''}</td>
                                    <td className="border-x border-black px-1.5 py-0.5 text-right font-medium">{item.total_cost ? formatNumber(item.total_cost) : ''}</td>
                                </tr>
                            ))}

                            {greenSpecsLines.length > 0 && (
                                <tr className="align-top">
                                    <td className="border-x border-black px-1.5 py-1"></td>
                                    <td className="border-x border-black px-1.5 py-1"></td>
                                    <td className="border-x border-black px-1.5 py-2">
                                        <div className="font-bold mb-1">Green Procurement Technical Specification</div>
                                        {greenSpecsLines.map((line, lIdx) => (
                                            <div key={lIdx} className="text-[9.5px] leading-tight pl-2">
                                                {line.startsWith('-') ? line : `- ${line}`}
                                            </div>
                                        ))}
                                    </td>
                                    <td className="border-x border-black px-1.5 py-1"></td>
                                    <td className="border-x border-black px-1.5 py-1"></td>
                                    <td className="border-x border-black px-1.5 py-1"></td>
                                </tr>
                            )}

                            <tr className="h-44 sm:h-60">
                                <td className="border-x border-black"></td>
                                <td className="border-x border-black"></td>
                                <td className="border-x border-black"></td>
                                <td className="border-x border-black"></td>
                                <td className="border-x border-black"></td>
                                <td className="border-x border-black"></td>
                            </tr>

                            <tr className="border-t border-black font-bold">
                                <td colSpan={5} className="border border-black p-1 text-right">
                                    Total :
                                </td>
                                <td className="border border-black p-1 text-right">
                                    P {formatNumber(pr.total_cost)}
                                </td>
                            </tr>

                            <tr>
                                <td className="border border-black p-1 font-bold">Purpose:</td>
                                <td colSpan={5} className="border border-black p-1 font-semibold leading-normal">
                                    {pr.purpose}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <table className="w-full border-collapse border border-black text-[10px] font-sans mt-[-1px]">
                        <thead>
                            <tr className="text-center font-bold bg-slate-50 print:bg-transparent">
                                <th className="border border-black p-1 w-1/3">Requested by:</th>
                                <th className="border border-black p-1 w-1/3">Cash Availability:</th>
                                <th className="border border-black p-1 w-1/3">Approved by:</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border border-black p-1 text-[9px] text-slate-500">Signature:</td>
                                <td className="border border-black p-1"></td>
                                <td className="border border-black p-1"></td>
                            </tr>
                            <tr className="h-12 align-bottom">
                                <td className="border-x border-black px-2 pb-1 text-center font-bold uppercase underline">
                                    {pr.requested_by_name || 'GERALDINE SANCHEZ-LANO, RSW, MPA'}
                                </td>
                                <td className="border-x border-black px-2 pb-1 text-center font-bold uppercase underline">
                                    {pr.cash_availability_name || 'FARAH GEMMA V. BIDAN, CPA'}
                                </td>
                                <td className="border-x border-black px-2 pb-1 text-center font-bold uppercase underline">
                                    {pr.approved_by_name || 'HON. YVONNE R. CAGAS'}
                                </td>
                            </tr>
                            <tr className="align-top">
                                <td className="border-x border-black px-2 pb-2 text-center text-[9px] uppercase font-semibold">
                                    {pr.requested_by_designation || 'Provincial Social Welfare and Development Officer'}
                                </td>
                                <td className="border-x border-black px-2 pb-2 text-center text-[9px] uppercase font-semibold">
                                    {pr.cash_availability_designation || 'Provincial Treasurer'}
                                </td>
                                <td className="border-x border-black px-2 pb-2 text-center text-[9px] uppercase font-semibold">
                                    {pr.approved_by_designation || 'Provincial Governor'}
                                </td>
                            </tr>
                            <tr>
                                <td className="border border-black p-1 text-[9px]">Date:</td>
                                <td className="border border-black p-1"></td>
                                <td className="border border-black p-1"></td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="flex items-center justify-between text-[9px] mt-2 font-sans font-bold">
                        <span>PAGE 1 OF 2 PAGE/S</span>
                        <span>PR Id.: {pr.tracker_id}</span>
                    </div>
                </div>

                <div className="bg-white p-8 sm:p-10 shadow-lg border border-slate-300 print-sheet font-serif text-black leading-tight text-[11px] relative w-full max-w-[210mm] min-h-[297mm] mx-auto flex flex-col justify-between break-before-page">

                    <div className="flex items-start justify-center gap-4 mb-2 relative">
                        <div className="w-16 h-16 shrink-0 absolute left-6 top-0">
                            <img
                                src="/images/logo.png"
                                alt="Province Seal"
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <div className="text-center font-bold">
                            <h1 className="text-lg tracking-wide uppercase">Purchase Request</h1>
                            <h2 className="text-xs uppercase font-bold tracking-normal">
                                Provincial Government of Davao del Sur
                            </h2>
                            <p className="text-[11px] font-normal">Matti, Digos City</p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between text-[10px] mb-1 font-sans">
                        <div>
                            <span>Date Submitted/Published: </span>
                            <span className="font-semibold">{datePublishedStr}</span>
                        </div>
                        <div>
                            <span>PR Id.: </span>
                            <span className="font-bold underline">{pr.tracker_id}</span>
                        </div>
                    </div>

                    <table className="w-full border-collapse border border-black text-[10px] mb-[-1px] font-sans">
                        <tbody>
                            <tr>
                                <td className="border border-black p-1 w-1/2">
                                    <span className="font-semibold">Department: </span>
                                    <span className="uppercase">{pr.department}</span>
                                </td>
                                <td className="border border-black p-1 w-1/4">
                                    <span className="font-semibold">P.R No.: </span>
                                    <span>{pr.pr_number || ''}</span>
                                </td>
                                <td className="border border-black p-1 w-1/4">
                                    <span className="font-semibold">Date: </span>
                                    <span>{prDateStr}</span>
                                </td>
                            </tr>
                            <tr>
                                <td colSpan={3} className="border border-black p-1">
                                    <span className="font-semibold">Section: </span>
                                    <span>{pr.section || ''}</span>
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <table className="w-full border-collapse border border-black text-[10px] font-sans">
                        <thead>
                            <tr className="text-center font-bold bg-slate-50 print:bg-transparent">
                                <th className="border border-black p-1 w-[8%]">Item<br/>No.</th>
                                <th className="border border-black p-1 w-[10%]">Unit</th>
                                <th className="border border-black p-1 w-[52%]">Item and Description</th>
                                <th className="border border-black p-1 w-[8%]">Qty</th>
                                <th className="border border-black p-1 w-[11%]">Unit Cost</th>
                                <th className="border border-black p-1 w-[11%]">Total Cost</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr className="align-top">
                                <td className="border-x border-black px-1.5 py-1"></td>
                                <td className="border-x border-black px-1.5 py-1"></td>
                                <td className="border-x border-black px-2 py-3 space-y-3">

                                    <div className="space-y-1">
                                        <div><span className="font-bold">Place of Delivery: </span>{pr.place_of_delivery || 'PGSO Warehouse/On Site'}</div>
                                        <div><span className="font-bold">Period of Delivery: </span>{pr.delivery_period || 'Date of activity'}</div>
                                        <div><span className="font-bold">Period of Payment: </span>{pr.payment_method || 'One-Time Payment/ Credit Basis'}</div>
                                    </div>

                                    <div className="pt-2">
                                        <div className="font-bold text-center underline mb-0.5">Charges:</div>
                                        <div className="text-center font-semibold uppercase leading-relaxed">
                                            {pr.charges || 'CY 2026 GENERAL FUND Account Code: 5-02-99-030'}
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t border-slate-300">
                                        <div className="font-bold mb-1">PR Certification:</div>
                                        <p className="leading-snug">
                                            This is to certify that the ABC set is based on the attached pre-canvass conducted by the Authorized Canvasser of this Office as of _________________.
                                        </p>
                                        <p className="mt-2 text-[9px] text-slate-700 italic leading-snug">
                                            Not applicable for the procurement of:<br/>
                                            Rice, Cell Cards, Catering Services, Fuel, Drugs and Medicines listed in the DPRI, Purified Water Refill, Lease of Venue, Lease of Venue with Catering Services, Lease of Venue and Accommodation
                                        </p>
                                        <div className="text-center mt-4">
                                            <div className="font-bold uppercase underline">
                                                {pr.requested_by_name || 'GERALDINE SANCHEZ-LANO, RSW, MPA'}
                                            </div>
                                            <div className="text-[9px] uppercase font-semibold">
                                                {pr.requested_by_designation || 'Provincial Social Welfare and Development Officer'}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-3 border-t border-slate-300">
                                        <div className="font-bold">Certification of Direct End-user:</div>
                                        <div className="text-[9px] italic text-slate-600 mb-1">(Focal Person / Program Manager / Division Head or Equivalent)</div>
                                        <p className="leading-snug mb-3">
                                            I hereby certify that I have reviewed and verify the accuracy of all entries in this Purchase Request, including the unit of measure, specifications, quantities, ABC, and other details, and that these are appropriate and necessary for the intended purpose.
                                        </p>
                                        <div className="space-y-1 text-[9.5px]">
                                            <div>
                                                Name and Signature of Direct End-User: <span className="font-semibold underline">{pr.direct_end_user_name || '_______________________'}</span>
                                            </div>
                                            <div>
                                                Designation: <span className="font-semibold underline">{pr.direct_end_user_designation || '_______________________'}</span>
                                            </div>
                                            <div>
                                                Date of Signing: <span className="font-semibold underline">{pr.direct_end_user_signed_at ? formatDate(pr.direct_end_user_signed_at) : '_______________________'}</span>
                                            </div>
                                        </div>
                                    </div>
                                </td>
                                <td className="border-x border-black px-1.5 py-1"></td>
                                <td className="border-x border-black px-1.5 py-1"></td>
                                <td className="border-x border-black px-1.5 py-1"></td>
                            </tr>

                            <tr className="border-t border-black font-bold">
                                <td colSpan={5} className="border border-black p-1 text-right">
                                    Total :
                                </td>
                                <td className="border border-black p-1 text-right">
                                    P {formatNumber(pr.total_cost)}
                                </td>
                            </tr>

                            <tr>
                                <td className="border border-black p-1 font-bold">Purpose:</td>
                                <td colSpan={5} className="border border-black p-1 font-semibold leading-normal">
                                    {pr.purpose}
                                </td>
                            </tr>
                        </tbody>
                    </table>

                    <table className="w-full border-collapse border border-black text-[10px] font-sans mt-[-1px]">
                        <thead>
                            <tr className="text-center font-bold bg-slate-50 print:bg-transparent">
                                <th className="border border-black p-1 w-1/3">Requested by:</th>
                                <th className="border border-black p-1 w-1/3">Cash Availability:</th>
                                <th className="border border-black p-1 w-1/3">Approved by:</th>
                            </tr>
                        </thead>
                        <tbody>
                            <tr>
                                <td className="border border-black p-1 text-[9px] text-slate-500">Signature:</td>
                                <td className="border border-black p-1"></td>
                                <td className="border border-black p-1"></td>
                            </tr>
                            <tr className="h-12 align-bottom">
                                <td className="border-x border-black px-2 pb-1 text-center font-bold uppercase underline">
                                    {pr.requested_by_name || 'GERALDINE SANCHEZ-LANO, RSW, MPA'}
                                </td>
                                <td className="border-x border-black px-2 pb-1 text-center font-bold uppercase underline">
                                    {pr.cash_availability_name || 'FARAH GEMMA V. BIDAN, CPA'}
                                </td>
                                <td className="border-x border-black px-2 pb-1 text-center font-bold uppercase underline">
                                    {pr.approved_by_name || 'HON. YVONNE R. CAGAS'}
                                </td>
                            </tr>
                            <tr className="align-top">
                                <td className="border-x border-black px-2 pb-2 text-center text-[9px] uppercase font-semibold">
                                    {pr.requested_by_designation || 'Provincial Social Welfare and Development Officer'}
                                </td>
                                <td className="border-x border-black px-2 pb-2 text-center text-[9px] uppercase font-semibold">
                                    {pr.cash_availability_designation || 'Provincial Treasurer'}
                                </td>
                                <td className="border-x border-black px-2 pb-2 text-center text-[9px] uppercase font-semibold">
                                    {pr.approved_by_designation || 'Provincial Governor'}
                                </td>
                            </tr>
                            <tr>
                                <td className="border border-black p-1 text-[9px]">Date:</td>
                                <td className="border border-black p-1"></td>
                                <td className="border border-black p-1"></td>
                            </tr>
                        </tbody>
                    </table>

                    <div className="flex items-center justify-between text-[9px] mt-2 font-sans font-bold">
                        <span>PAGE 2 OF 2 PAGE/S</span>
                        <span>PR Id.: {pr.tracker_id}</span>
                    </div>
                </div>

                {((pr.attachments && pr.attachments.length > 0) || (pr.ppmp?.attachments && pr.ppmp.attachments.length > 0)) && (
                    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 no-print space-y-3 font-sans">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Paperclip className="w-4 h-4 text-blue-600" />
                                <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                                    Official Supporting Documents & Verified Links
                                </h3>
                            </div>
                            <span className="text-[11px] font-semibold text-slate-500">
                                Attached for PR ID: {pr.tracker_id}
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">

                            {(pr.attachments || []).map((att) => (
                                <div
                                    key={att.id || att.uuid}
                                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3 text-xs"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        {att.attachment_type === 'SECURE_LINK' ? (
                                            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                                <Lock className="w-4 h-4" />
                                            </div>
                                        ) : (
                                            <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center shrink-0">
                                                <FileText className="w-4 h-4" />
                                            </div>
                                        )}
                                        <div className="min-w-0">
                                            <p className="truncate font-bold text-slate-800 text-xs">
                                                {att.link_title || att.original_filename}
                                            </p>
                                            <p className="text-[10px] text-slate-500">
                                                {att.attachment_type === 'SECURE_LINK'
                                                    ? 'Verified HTTPS Cloud Link'
                                                    : `${att.file_size ? (att.file_size / (1024 * 1024)).toFixed(2) + ' MB' : 'PDF'} Document`}
                                            </p>
                                        </div>
                                    </div>

                                    {att.attachment_type === 'SECURE_LINK' ? (
                                        <a
                                            href={att.external_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shrink-0 transition"
                                        >
                                            <span>Open Link</span>
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    ) : (
                                        <a
                                            href={`/pims/purchase-requests/${pr.uuid || pr.id}/attachments/${att.uuid}/download`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold shrink-0 transition"
                                        >
                                            <span>View PDF</span>
                                            <Download className="w-3 h-3" />
                                        </a>
                                    )}
                                </div>
                            ))}

                            {(pr.ppmp?.attachments || []).map((att) => (
                                <div
                                    key={`ppmp-${att.id || att.uuid}`}
                                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between gap-3 text-xs"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center shrink-0">
                                            <FileText className="w-4 h-4" />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="truncate font-bold text-slate-800 text-xs">
                                                {att.original_filename}
                                            </p>
                                            <p className="text-[10px] text-slate-500">
                                                Inherited PPMP Requirement &bull; {att.attachment_type || 'PDF'}
                                            </p>
                                        </div>
                                    </div>
                                    <a
                                        href={`/ppmp/attachments/${att.uuid}/download`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[11px] font-bold shrink-0 transition"
                                    >
                                        <span>Download</span>
                                        <Download className="w-3 h-3" />
                                    </a>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
