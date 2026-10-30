import React from 'react';
import { formatDate, formatCurrency } from '../UI/StatusBadge';
import { Printer, ArrowLeft, Clock, CheckCircle2, AlertCircle, ArrowRight } from 'lucide-react';
import { getAccurateRouteRecipient, getAccurateRouteOrigin } from '../RoutingTimeline/RoutingTimeline';

/**
 * PPMPRoutingPrintView:
 * Official printable Document Routing Slip and Complete Workflow Audit Trail
 * for Project Procurement Management Plan (PPMP) in Province of Davao del Sur.
 */
export const PPMPRoutingPrintView = ({ ppmp: rawPpmp, onBack }) => {
    const handlePrint = () => {
        window.print();
    };

    // Protect against React synthetic event objects or invalid inputs
    const ppmp = (rawPpmp && typeof rawPpmp === 'object' && !('nativeEvent' in rawPpmp)) ? rawPpmp : {};

    const rawRoutes = ppmp?.routes || [];
    // Chronological ordering: Step #1 is the initial creation, ascending to latest
    const routes = [...rawRoutes].sort((a, b) => {
        const timeA = new Date(a.submitted_at || a.created_at || 0).getTime();
        const timeB = new Date(b.submitted_at || b.created_at || 0).getTime();
        if (timeA !== timeB) return timeA - timeB;
        return (a.id || 0) - (b.id || 0);
    });

    const changeLogs = ppmp?.change_logs || [];
    const reviews = ppmp?.reviews || [];
    const signatures = ppmp?.signatures || [];
    const creatorSig = signatures.find(s => s.role === 'end_user');
    const headSig = signatures.find(s => s.role === 'head');

    const getStatusBadgeClass = (status = '') => {
        if (status.includes('RETURNED') || status.includes('REJECTED')) {
            return 'bg-rose-100 text-rose-800 border-rose-300';
        }
        if (status.includes('APPROVED') || status === 'READY_TO_PRINT' || status === 'HEAD_PENDING') {
            return 'bg-emerald-100 text-emerald-800 border-emerald-300';
        }
        return 'bg-blue-100 text-blue-800 border-blue-300';
    };

    return (
        <div className="bg-slate-100 min-h-screen text-slate-900 font-sans print:bg-white print:min-h-0">
            {/* Top Action Bar (Hidden in Print) */}
            <div className="no-print sticky top-0 z-40 bg-slate-900 text-white px-6 py-3.5 flex items-center justify-between shadow-lg">
                <div className="flex items-center gap-3">
                    <button
                        onClick={onBack}
                        className="flex items-center gap-1.5 px-3.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-xs font-semibold rounded-lg border border-slate-700 transition cursor-pointer"
                    >
                        <ArrowLeft className="w-4 h-4" /> Back to PPMP Details
                    </button>
                    <div>
                        <div className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-indigo-400" />
                            Official Document Routing Slip & Audit Trail
                        </div>
                        <div className="text-[11px] text-indigo-300 font-mono">
                            PPMP No: {ppmp?.ppmp_number || 'N/A'} • {routes.length} Routing Actions Recorded
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    <button
                        onClick={handlePrint}
                        className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-lg shadow-sm transition cursor-pointer"
                    >
                        <Printer className="w-4 h-4" />
                        Print Routing Slip
                    </button>
                </div>
            </div>

            {/* Printable Document Sheet */}
            <div className="max-w-[1050px] mx-auto my-6 p-8 bg-white border border-slate-300 shadow-md rounded-xl print:m-0 print:p-0 print:border-none print:shadow-none print:max-w-none print:w-full">
                {/* Official Header */}
                <div className="flex items-center justify-between border-b-2 border-slate-900 pb-4 mb-5">
                    <div className="w-20 shrink-0">
                        <img
                            src="/images/logo.png"
                            alt="Province of Davao del Sur Seal"
                            className="w-18 h-18 object-contain"
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                    </div>
                    <div className="text-center flex-1 px-4">
                        <div className="text-xs uppercase font-medium tracking-wider text-slate-600">Republic of the Philippines</div>
                        <div className="text-base font-black uppercase tracking-wide text-slate-900">PROVINCIAL GOVERNMENT OF DAVAO DEL SUR</div>
                        <div className="text-xs font-semibold text-slate-700">Matti, Digos City, Davao del Sur</div>
                        <div className="mt-2 text-sm font-black uppercase tracking-wider text-slate-900 border-t border-slate-300 pt-1.5 inline-block">
                            DOCUMENT ROUTING SLIP & WORKFLOW AUDIT TRAIL
                        </div>
                    </div>
                    <div className="w-20 shrink-0 text-right">
                        <div className="inline-block border border-slate-800 p-1.5 rounded text-center">
                            <div className="text-[9px] font-bold uppercase text-slate-500">Document</div>
                            <div className="text-xs font-black font-mono text-slate-900">PPMP</div>
                        </div>
                    </div>
                </div>

                {/* Document Information Summary */}
                <div className="bg-slate-50 border border-slate-300 rounded-lg p-3.5 mb-5 text-xs grid grid-cols-2 sm:grid-cols-4 gap-3 print:bg-transparent print:border-slate-400">
                    <div>
                        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">PPMP Tracking No.</span>
                        <span className="font-mono font-bold text-slate-900 text-xs">{ppmp?.tracking_number || ppmp?.ppmp_number || '—'}</span>
                    </div>
                    <div>
                        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Fiscal Year / Type</span>
                        <span className="font-semibold text-slate-800">CY {ppmp?.fiscal_year} • {ppmp?.plan_type}</span>
                    </div>
                    <div>
                        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Implementing Unit / Office</span>
                        <span className="font-bold text-slate-900 uppercase truncate block" title={ppmp?.implementing_unit || ppmp?.office?.name || ppmp?.title}>
                            {ppmp?.implementing_unit || ppmp?.office?.name || ppmp?.title || '—'}
                        </span>
                    </div>
                    <div>
                        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Current Document Status</span>
                        <span className="font-mono font-bold text-indigo-700 text-xs">{ppmp?.status?.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="col-span-2 sm:col-span-3 pt-1 border-t border-slate-200">
                        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Project Title</span>
                        <span className="font-medium text-slate-900">{ppmp?.title || '—'}</span>
                    </div>
                    <div className="col-span-2 sm:col-span-1 pt-1 border-t border-slate-200">
                        <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Authorized Budget (ABC)</span>
                        <span className="font-mono font-bold text-slate-900 text-xs">
                            {formatCurrency(ppmp?.total_budget || 0)}
                        </span>
                    </div>
                </div>

                {/* Complete Routing Slip Table */}
                <div className="mb-6">
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-indigo-600 no-print" />
                            Chronological Routing Steps & Actions
                        </h4>
                        <span className="text-[10px] text-slate-500 font-mono">
                            Printed on: {new Date().toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>

                    <table className="w-full border-collapse border border-slate-900 text-xs">
                        <thead>
                            <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-900 text-[10px] uppercase tracking-wider text-center print:bg-slate-100">
                                <th className="border border-slate-900 p-2 w-10">#</th>
                                <th className="border border-slate-900 p-2 w-32">Action / Status</th>
                                <th className="border border-slate-900 p-2 w-44">From</th>
                                <th className="border border-slate-900 p-2 w-44">To</th>
                                <th className="border border-slate-900 p-2 w-36">Date & Time Submitted</th>
                                <th className="border border-slate-900 p-2 w-36">Date & Time Received</th>
                                <th className="border border-slate-900 p-2 w-36">Date Approved / Suspended</th>
                                <th className="border border-slate-900 p-2 text-left">Remarks / Action Taken</th>
                            </tr>
                        </thead>
                        <tbody>
                            {routes.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="border border-slate-900 p-4 text-center text-slate-400 italic text-xs">
                                        No routing movements recorded yet.
                                    </td>
                                </tr>
                            ) : (
                                routes.map((route, idx) => {
                                    const isReturned = route.status?.includes('RETURNED');
                                    const isApproved = route.status?.includes('APPROVED') || route.status === 'READY_TO_PRINT';

                                    const originInfo = getAccurateRouteOrigin(route, ppmp);
                                    const recipientInfo = getAccurateRouteRecipient(route, ppmp);

                                    return (
                                        <tr key={route.id || idx} className="border-b border-slate-900 hover:bg-slate-50/60 print:hover:bg-transparent">
                                            <td className="border border-slate-900 p-2 text-center font-mono font-bold text-slate-700">
                                                {idx + 1}
                                            </td>
                                            <td className="border border-slate-900 p-2 text-center">
                                                <div className="font-bold text-[11px] uppercase tracking-wide text-slate-900">
                                                    {route.action === 'OPPMO_APP_GENERATED'
                                                        ? 'APP Generated & Released to Head'
                                                        : route.action === 'TWG_APPROVED'
                                                            ? 'BAC-TWG Approved & Released to OPPMO'
                                                            : route.action?.replace(/_/g, ' ')}
                                                </div>
                                                <div className="mt-0.5">
                                                    <span className={`inline-block px-1.5 py-0.5 rounded text-[9px] font-mono font-bold border ${getStatusBadgeClass(route.status)}`}>
                                                        {route.status?.replace(/_/g, ' ')}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="border border-slate-900 p-2">
                                                <div className="font-bold text-slate-900">
                                                    {originInfo.name}
                                                </div>
                                                {originInfo.designation && (
                                                    <div className="text-[10px] text-slate-600">
                                                        {originInfo.designation}
                                                    </div>
                                                )}
                                                <div className="text-[9px] font-mono text-slate-500 uppercase">
                                                    Role: {originInfo.role?.replace(/_/g, ' ')}
                                                </div>
                                            </td>
                                            <td className="border border-slate-900 p-2">
                                                <div className="font-bold text-slate-900">
                                                    {recipientInfo.name}
                                                </div>
                                                {recipientInfo.designation && (
                                                    <div className="text-[10px] text-slate-600">
                                                        {recipientInfo.designation}
                                                    </div>
                                                )}
                                                <div className="text-[9px] font-mono text-slate-500 uppercase">
                                                    Role: {recipientInfo.role?.replace(/_/g, ' ')}
                                                </div>
                                            </td>
                                            <td className="border border-slate-900 p-2 text-center font-mono text-[10px] text-slate-700">
                                                {route.submitted_at ? formatDate(route.submitted_at) : '—'}
                                            </td>
                                            <td className="border border-slate-900 p-2 text-center font-mono text-[10px] text-slate-700">
                                                {(() => {
                                                    const isDraft = route.action === 'DRAFT_CREATED';
                                                    const isLatest = idx === routes.length - 1;
                                                    const hasPassedOrActed = !isLatest || Boolean(route.acted_at);
                                                    const effectiveReceivedAt = route.received_at || (isDraft ? (route.submitted_at || route.created_at) : (hasPassedOrActed ? (route.acted_at || route.submitted_at) : null));
                                                    return effectiveReceivedAt ? formatDate(effectiveReceivedAt) : 'Pending Receipt';
                                                })()}
                                            </td>
                                            <td className="border border-slate-900 p-2 text-center font-mono text-[10px]">
                                                {(() => {
                                                    const isDraft = route.action === 'DRAFT_CREATED';
                                                    const isLatest = idx === routes.length - 1;
                                                    const hasPassedOrActed = !isLatest || Boolean(route.acted_at);
                                                    const isSuspendedAction = route.action?.includes('RETURNED') || route.status?.includes('RETURNED') || route.action?.includes('REJECTED');
                                                    const isApprovedAction = route.action?.includes('APPROVED') || route.status?.includes('APPROVED') || route.action === 'READY_TO_PRINT' || route.status === 'READY_TO_PRINT';
                                                    const decisionTimestamp = route.acted_at || (hasPassedOrActed && !isDraft ? route.submitted_at : null);

                                                    if (isSuspendedAction) {
                                                        return decisionTimestamp ? (
                                                            <span className="text-rose-700 font-semibold block">
                                                                Suspended: {formatDate(decisionTimestamp)}
                                                            </span>
                                                        ) : (
                                                            <span className="text-slate-400 italic">—</span>
                                                        );
                                                    }
                                                    if (isApprovedAction && decisionTimestamp) {
                                                        return (
                                                            <span className="text-emerald-700 font-semibold block">
                                                                Approved: {formatDate(decisionTimestamp)}
                                                            </span>
                                                        );
                                                    }
                                                    return <span className="text-slate-400 italic">—</span>;
                                                })()}
                                            </td>
                                            <td className="border border-slate-900 p-2 text-slate-800">
                                                {route.remarks ? (
                                                    <div className="italic text-[11px] leading-relaxed">
                                                        "{route.remarks}"
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic text-[10px]">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Field Level Change Logs (if any reviewer modified items/fields) */}
                {changeLogs.length > 0 && (
                    <div className="mb-6 pt-2 page-break-inside-avoid">
                        <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 mb-2">
                            Reviewer Modification Logs / Field Alterations
                        </h4>
                        <table className="w-full border-collapse border border-slate-900 text-xs">
                            <thead>
                                <tr className="bg-slate-100 text-slate-900 font-bold border-b border-slate-900 text-[10px] uppercase text-center">
                                    <th className="border border-slate-900 p-1.5 w-10">#</th>
                                    <th className="border border-slate-900 p-1.5 w-40">Field Modified</th>
                                    <th className="border border-slate-900 p-1.5 w-48">Modified By</th>
                                    <th className="border border-slate-900 p-1.5">Previous Value</th>
                                    <th className="border border-slate-900 p-1.5">Updated Value</th>
                                    <th className="border border-slate-900 p-1.5 w-32">Timestamp</th>
                                </tr>
                            </thead>
                            <tbody>
                                {changeLogs.map((log, idx) => (
                                    <tr key={log.id || idx} className="border-b border-slate-900">
                                        <td className="border border-slate-900 p-1.5 text-center font-mono">{idx + 1}</td>
                                        <td className="border border-slate-900 p-1.5 font-bold">{log.field_name}</td>
                                        <td className="border border-slate-900 p-1.5">
                                            <span className="font-semibold">{log.user?.name}</span>
                                            <span className="text-[10px] text-slate-500 font-mono block">({log.role})</span>
                                        </td>
                                        <td className="border border-slate-900 p-1.5 text-rose-700 font-mono text-[11px] line-through">
                                            {log.old_value || '(empty)'}
                                        </td>
                                        <td className="border border-slate-900 p-1.5 text-emerald-800 font-mono text-[11px] font-semibold">
                                            {log.new_value}
                                        </td>
                                        <td className="border border-slate-900 p-1.5 text-center font-mono text-[10px] text-slate-600">
                                            {formatDate(log.created_at)}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Sign-off / Verification section */}
                <div className="mt-8 pt-4 border-t border-slate-300 grid grid-cols-2 gap-8 page-break-inside-avoid text-xs">
                    <div>
                        <div className="text-[10px] uppercase font-bold text-slate-500 mb-6">Generated &amp; Certified by:</div>
                        <div className="border-b border-slate-800 w-64 pb-1">
                            <span className="font-bold uppercase">{creatorSig?.signer_name || ppmp?.creator?.name || 'Authorized Personnel'}</span>
                        </div>
                        <div className="text-[10px] text-slate-600 mt-0.5">{creatorSig?.signer_designation || ppmp?.creator?.designation || 'End-User / Project Coordinator'}</div>
                        {creatorSig?.signed_at && (
                            <div className="text-[9px] text-slate-500 mt-0.5 font-mono">
                                Digitally Signed: {formatDate(creatorSig.signed_at)}
                            </div>
                        )}
                    </div>
                    <div className="text-right">
                        <div className="text-[10px] uppercase font-bold text-slate-500 mb-6">Office / Implementing Unit Head:</div>
                        <div className="border-b border-slate-800 w-64 pb-1 ml-auto">
                            <span className="font-bold uppercase">{headSig?.signer_name || ppmp?.office?.head?.name || ppmp?.office?.head_name || 'Department Head'}</span>
                        </div>
                        <div className="text-[10px] text-slate-600 mt-0.5">{headSig?.signer_designation || ppmp?.office?.head?.designation || ppmp?.office?.name || 'Head of Office'}</div>
                        {headSig?.signed_at && (
                            <div className="text-[9px] text-slate-500 mt-0.5 font-mono">
                                Approved: {formatDate(headSig.signed_at)}
                            </div>
                        )}
                    </div>
                </div>

                <div className="mt-6 text-center text-[9px] text-slate-400 uppercase tracking-wider font-mono">
                    Provincial Electronic Procurement Management System (eProc) • Province of Davao del Sur
                </div>
            </div>

            <style>{`
                @media print {
                    @page {
                        size: portrait;
                        margin: 10mm;
                    }
                    body {
                        background: white !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                }
            `}</style>
        </div>
    );
};
