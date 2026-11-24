import React from 'react';
import {
    X,
    Printer,
    ShieldCheck,
    Building2,
    Calendar,
    FileText,
    Coins,
    Clock,
    User,
    ArrowRight,
    CheckCircle2,
    RotateCcw,
} from 'lucide-react';
import { formatCurrency, formatDate } from '../UI/StatusBadge';

export const PurchaseRequestDetailModal = ({
    isOpen,
    onClose,
    purchaseRequest,
    onPrint,
    onReview,
    user = null,
}) => {
    if (!isOpen || !purchaseRequest) return null;

    const pr = purchaseRequest;
    const items = pr.items || [];
    const routes = pr.routes || [];

    const getStatusBadge = (status) => {
        switch (status) {
            case 'PR_APPROVED':
                return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">APPROVED</span>;
            case 'RETURNED':
                return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-rose-100 text-rose-800 border border-rose-200">RETURNED</span>;
            case 'PR_DIVISION_REVIEW':
                return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800 border border-blue-200">PR DIVISION REVIEW</span>;
            case 'BAC_TWG_REVIEW':
                return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-purple-100 text-purple-800 border border-purple-200">BAC-TWG REVIEW</span>;
            case 'PR_CONTROL_REVIEW':
                return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-200">PR CONTROL REVIEW</span>;
            default:
                return <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-slate-100 text-slate-800 border border-slate-200">{status}</span>;
        }
    };

    const getStageName = (stage) => {
        switch (stage) {
            case 'pr_division': return 'PR Division';
            case 'bac_twg': return 'BAC-TWG';
            case 'pr_control': return 'PR Division (Control)';
            case 'approved': return 'PR Approved';
            case 'end_user': return 'End-User';
            default: return stage ? stage.replace(/_/g, ' ').toUpperCase() : 'Unknown';
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">

                <div className="px-6 py-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
                            <FileText className="w-5 h-5 text-amber-300" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h2 className="text-base font-bold text-white tracking-tight">
                                    Purchase Request Details
                                </h2>
                                {getStatusBadge(pr.status)}
                            </div>
                            <p className="text-xs text-blue-200">
                                Tracker ID: <strong className="text-white">{pr.tracker_id}</strong>
                                {pr.pr_number && <span> &bull; P.R No: <strong className="text-white">{pr.pr_number}</strong></span>}
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {onReview && (
                            <button
                                type="button"
                                onClick={() => onReview(pr)}
                                className="px-3 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                            >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>Review</span>
                            </button>
                        )}
                        {onPrint && (
                            <button
                                type="button"
                                onClick={() => onPrint(pr)}
                                className="px-3 py-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 rounded-lg shadow-xs flex items-center gap-1.5 transition cursor-pointer"
                            >
                                <Printer className="w-3.5 h-3.5" />
                                <span>Print PR</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-white/10 transition cursor-pointer"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-xl text-xs">
                        <div>
                            <span className="text-[10px] text-slate-500 uppercase font-bold block">Department</span>
                            <span className="font-semibold text-slate-800">{pr.department}</span>
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-500 uppercase font-bold block">Source & Category</span>
                            <span className="font-semibold text-slate-800">{pr.source || 'PPMP'} &bull; {pr.category || 'GOODS'}</span>
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-500 uppercase font-bold block">Date Submitted / Published</span>
                            <span className="font-semibold text-slate-800">{pr.date_published ? formatDate(pr.date_published) : 'N/A'}</span>
                        </div>
                        <div>
                            <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Estimated Cost</span>
                            <span className="font-extrabold text-blue-700 text-sm">{formatCurrency(pr.total_cost)}</span>
                        </div>
                    </div>

                    <div className="p-4 bg-white border border-slate-200 rounded-xl">
                        <span className="text-[10px] text-slate-500 uppercase font-bold block mb-1">Purpose / Justification</span>
                        <p className="text-xs text-slate-800 font-semibold leading-relaxed">{pr.purpose}</p>
                    </div>

                    <div className="space-y-2">
                        <div className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                            <Coins className="w-4 h-4 text-emerald-600" />
                            <span>Procurement Items ({items.length})</span>
                        </div>
                        <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                            <table className="w-full text-left text-xs divide-y divide-slate-200">
                                <thead className="bg-slate-100 text-slate-700 font-bold text-[10px] uppercase">
                                    <tr>
                                        <th className="px-3 py-2 w-16 text-center">Item No.</th>
                                        <th className="px-3 py-2 w-20 text-center">Unit</th>
                                        <th className="px-3 py-2">Item and Description</th>
                                        <th className="px-3 py-2 w-20 text-right">Qty</th>
                                        <th className="px-3 py-2 w-28 text-right">Unit Cost</th>
                                        <th className="px-3 py-2 w-32 text-right">Total Cost</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {items.map((item, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/70">
                                            <td className="px-3 py-2 text-center font-medium">{item.item_no}</td>
                                            <td className="px-3 py-2 text-center text-slate-600">{item.unit || '-'}</td>
                                            <td className="px-3 py-2 whitespace-pre-line leading-snug">{item.item_description}</td>
                                            <td className="px-3 py-2 text-right">{item.quantity ? parseFloat(item.quantity).toLocaleString() : '-'}</td>
                                            <td className="px-3 py-2 text-right">{item.unit_cost ? formatCurrency(item.unit_cost) : '-'}</td>
                                            <td className="px-3 py-2 text-right font-bold text-slate-800">{formatCurrency(item.total_cost || 0)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                                <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                                    <tr>
                                        <td colSpan={5} className="px-3 py-2 text-right uppercase text-xs text-slate-700">
                                            Total Amount :
                                        </td>
                                        <td className="px-3 py-2 text-right text-sm text-blue-700">
                                            {formatCurrency(pr.total_cost)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block">Delivery & Payment Terms</span>
                            <div><strong className="text-slate-700">Place of Delivery: </strong>{pr.place_of_delivery || 'PGSO Warehouse/On Site'}</div>
                            <div><strong className="text-slate-700">Period of Delivery: </strong>{pr.delivery_period || 'Date of activity'}</div>
                            <div><strong className="text-slate-700">Period of Payment: </strong>{pr.payment_method || 'Credit Basis'}</div>
                            <div className="pt-2 border-t border-slate-200">
                                <strong className="text-slate-700">Charges: </strong>
                                <span className="font-semibold text-slate-900">{pr.charges || 'General Fund'}</span>
                            </div>
                        </div>

                        <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                            <span className="text-[10px] text-slate-500 uppercase font-bold block">Signatories</span>
                            <div><strong className="text-slate-700">Requested by: </strong>{pr.requested_by_name || 'N/A'} ({pr.requested_by_designation})</div>
                            <div><strong className="text-slate-700">Cash Availability: </strong>{pr.cash_availability_name || 'FARAH GEMMA V. BIDAN, CPA'} ({pr.cash_availability_designation})</div>
                            <div><strong className="text-slate-700">Approved by: </strong>{pr.approved_by_name || 'HON. YVONNE R. CAGAS'} ({pr.approved_by_designation})</div>
                            <div><strong className="text-slate-700">Direct End-User: </strong>{pr.direct_end_user_name || 'N/A'} ({pr.direct_end_user_designation})</div>
                        </div>
                    </div>

                    {routes.length > 0 && (
                        <div className="space-y-2">
                            <div className="text-xs font-bold text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                                <Clock className="w-4 h-4 text-blue-600" />
                                <span>Routing & Evaluation Timeline</span>
                            </div>
                            <div className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-3">
                                {routes.map((rt) => (
                                    <div key={rt.id} className="text-xs border-b border-slate-200 pb-2 last:border-0 last:pb-0">
                                        <div className="flex items-center justify-between text-[11px] mb-1">
                                            <div className="flex items-center gap-1.5 font-bold text-slate-800">
                                                <span>{getStageName(rt.from_stage)}</span>
                                                <ArrowRight className="w-3 h-3 text-slate-400" />
                                                <span className="text-blue-600">{getStageName(rt.to_stage)}</span>
                                                <span className={`ml-2 px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                                    rt.action === 'approve' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                                                }`}>
                                                    {rt.action ? rt.action.toUpperCase() : ''}
                                                </span>
                                            </div>
                                            <span className="text-[10px] text-slate-400">
                                                {rt.acted_at ? formatDate(rt.acted_at) : ''}
                                            </span>
                                        </div>
                                        <p className="text-slate-600 pl-2 border-l-2 border-blue-400 text-[11px] leading-relaxed">
                                            {rt.remarks || 'No remarks recorded.'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
};
