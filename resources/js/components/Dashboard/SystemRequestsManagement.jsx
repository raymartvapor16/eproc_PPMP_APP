import React, { useState, useEffect, useCallback } from 'react';
import {
    Ticket,
    Bug,
    Sparkles,
    Search,
    RefreshCw,
    Loader2,
    Image as ImageIcon,
    ExternalLink,
    CheckCircle2,
    Clock,
    XCircle,
    Trash2,
    X,
    Save,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { systemRequestService } from '../../services/api';
import { showConfirm } from '../../utils/modalAlert';

const MODULE_LABELS = {
    eproc_ppmp_app: 'E-Procurement (PPMP/APP)',
    pims: 'PIMS',
    monitoring: 'Project Monitoring',
    supplier_evaluation: 'Supplier Evaluation',
    general: 'General / Portal',
};

const STATUS_BADGE = {
    pending: 'bg-amber-100 text-amber-800 border-amber-300',
    in_progress: 'bg-blue-100 text-blue-800 border-blue-300',
    resolved: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    rejected: 'bg-rose-100 text-rose-800 border-rose-300',
};

const PRIORITY_BADGE = {
    low: 'bg-slate-100 text-slate-700',
    medium: 'bg-blue-100 text-blue-700',
    high: 'bg-amber-100 text-amber-800',
    urgent: 'bg-rose-100 text-rose-700',
};

export const SystemRequestsManagement = () => {
    const [requests, setRequests] = useState([]);
    const [counts, setCounts] = useState({ total: 0, pending: 0, in_progress: 0, resolved: 0, rejected: 0 });
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [typeFilter, setTypeFilter] = useState('all');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);

    const [selectedRequest, setSelectedRequest] = useState(null);
    const [editStatus, setEditStatus] = useState('pending');
    const [editRemarks, setEditRemarks] = useState('');
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState({ type: '', text: '' });

    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedSearch(search.trim());
            setPage(1);
        }, 300);
        return () => clearTimeout(t);
    }, [search]);

    const fetchRequests = useCallback(async () => {
        setLoading(true);
        try {
            const res = await systemRequestService.getAll({
                search: debouncedSearch || undefined,
                status: statusFilter !== 'all' ? statusFilter : undefined,
                request_type: typeFilter !== 'all' ? typeFilter : undefined,
                priority: priorityFilter !== 'all' ? priorityFilter : undefined,
                page,
                per_page: 15,
            });
            setRequests(res.data?.data || []);
            if (res.data?.counts) setCounts(res.data.counts);
            setLastPage(res.data?.last_page || 1);
            setTotal(res.data?.total || 0);
        } catch (err) {
            setFeedback({ type: 'error', text: err.response?.data?.message || 'Failed to load system requests.' });
        } finally {
            setLoading(false);
        }
    }, [debouncedSearch, statusFilter, typeFilter, priorityFilter, page]);

    useEffect(() => {
        fetchRequests();
    }, [fetchRequests]);

    const openReviewModal = (req) => {
        setSelectedRequest(req);
        setEditStatus(req.status || 'pending');
        setEditRemarks(req.admin_remarks || '');
    };

    const handleSaveStatus = async (e) => {
        e.preventDefault();
        if (!selectedRequest) return;
        setSaving(true);
        setFeedback({ type: '', text: '' });
        try {
            const res = await systemRequestService.updateStatus(selectedRequest.id, {
                status: editStatus,
                admin_remarks: editRemarks,
            });
            setFeedback({ type: 'success', text: res.data?.message || 'Ticket updated.' });
            setSelectedRequest(null);
            await fetchRequests();
        } catch (err) {
            setFeedback({ type: 'error', text: err.response?.data?.message || 'Failed to update ticket.' });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (req) => {
        const confirmed = await showConfirm({
            title: 'Delete System Request',
            message: `Permanently delete ticket ${req.ticket_number} ("${req.subject}")?`,
            confirmText: 'Yes, Delete Ticket',
            type: 'danger',
        });
        if (!confirmed) return;

        try {
            await systemRequestService.delete(req.id);
            setFeedback({ type: 'success', text: `Deleted ticket ${req.ticket_number}.` });
            if (selectedRequest?.id === req.id) setSelectedRequest(null);
            await fetchRequests();
        } catch (err) {
            setFeedback({ type: 'error', text: err.response?.data?.message || 'Failed to delete ticket.' });
        }
    };

    return (
        <div className="space-y-5">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 rounded-2xl p-5 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-center gap-3.5">
                    <div className="p-3 rounded-xl bg-blue-500/20 border border-blue-400/30 text-blue-300">
                        <Ticket className="w-6 h-6" />
                    </div>
                    <div>
                        <h2 className="text-base sm:text-lg font-extrabold tracking-tight">
                            System Enhancement &amp; Bug Fix Requests
                        </h2>
                        <p className="text-xs text-blue-200/80 mt-0.5">
                            Manage user-submitted tickets, bug reports, and new feature implementation requests
                        </p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={fetchRequests}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold border border-white/15 transition cursor-pointer self-start sm:self-auto"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    <span>Refresh Tickets</span>
                </button>
            </div>

            {feedback.text && (
                <div className={`flex items-center justify-between gap-2 px-4 py-3 rounded-xl text-xs font-semibold border ${
                    feedback.type === 'error'
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}>
                    <div className="flex items-center gap-2">
                        {feedback.type === 'error' ? <AlertCircle className="w-4 h-4" /> : <CheckCircle2 className="w-4 h-4" />}
                        <span>{feedback.text}</span>
                    </div>
                    <button type="button" onClick={() => setFeedback({ type: '', text: '' })} className="cursor-pointer">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                    { key: 'all', label: 'Total Tickets', val: counts.total, color: 'text-slate-900', ring: 'border-slate-200' },
                    { key: 'pending', label: 'Pending', val: counts.pending, color: 'text-amber-700', ring: 'border-amber-200' },
                    { key: 'in_progress', label: 'In Progress', val: counts.in_progress, color: 'text-blue-700', ring: 'border-blue-200' },
                    { key: 'resolved', label: 'Resolved', val: counts.resolved, color: 'text-emerald-700', ring: 'border-emerald-200' },
                    { key: 'rejected', label: 'Rejected', val: counts.rejected, color: 'text-rose-700', ring: 'border-rose-200' },
                ].map((c) => (
                    <button
                        key={c.key}
                        type="button"
                        onClick={() => {
                            setStatusFilter(c.key);
                            setPage(1);
                        }}
                        className={`p-3.5 rounded-xl bg-white border text-left transition cursor-pointer hover:shadow-xs ${
                            statusFilter === c.key ? 'ring-2 ring-blue-500 border-blue-500' : c.ring
                        }`}
                    >
                        <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{c.label}</div>
                        <div className={`text-2xl font-black mt-1 ${c.color}`}>{c.val}</div>
                    </button>
                ))}
            </div>

            {/* Filters */}
            <div className="bg-white rounded-2xl border border-slate-200 p-4 flex flex-col md:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search ticket no., subject, user, or office..."
                        className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-300 text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                </div>
                <select
                    value={typeFilter}
                    onChange={(e) => { setTypeFilter(e.target.value); setPage(1); }}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 bg-white"
                >
                    <option value="all">All Types</option>
                    <option value="bug_fix">Bug / Error Fix</option>
                    <option value="enhancement">New Implementation</option>
                </select>
                <select
                    value={priorityFilter}
                    onChange={(e) => { setPriorityFilter(e.target.value); setPage(1); }}
                    className="px-3 py-2 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 bg-white"
                >
                    <option value="all">All Priorities</option>
                    <option value="urgent">Urgent</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>
            </div>

            {/* Table */}
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black uppercase tracking-wider text-slate-500">
                                <th className="px-4 py-3">Ticket</th>
                                <th className="px-4 py-3">Requestor</th>
                                <th className="px-4 py-3">Type / Module</th>
                                <th className="px-4 py-3">Subject &amp; Attachment</th>
                                <th className="px-4 py-3 text-center">Priority</th>
                                <th className="px-4 py-3 text-center">Status</th>
                                <th className="px-4 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-slate-400">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                                        Loading system requests...
                                    </td>
                                </tr>
                            ) : requests.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-slate-400">
                                        <Ticket className="w-7 h-7 mx-auto mb-2 text-slate-300" />
                                        No system requests match the current filters.
                                    </td>
                                </tr>
                            ) : (
                                requests.map((req) => (
                                    <tr key={req.id} className="hover:bg-slate-50/70 transition">
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <div className="font-mono font-black text-slate-900">{req.ticket_number}</div>
                                            <div className="text-[10px] text-slate-400 mt-0.5">{req.created_at}</div>
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-slate-800">{req.user?.name || 'Unknown'}</div>
                                            <div className="text-[10px] text-slate-500">
                                                {req.office?.code ? `${req.office.code} · ` : ''}{req.user?.role || ''}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 whitespace-nowrap">
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                req.request_type === 'bug_fix'
                                                    ? 'bg-rose-100 text-rose-700'
                                                    : 'bg-blue-100 text-blue-700'
                                            }`}>
                                                {req.request_type === 'bug_fix' ? <Bug className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                                                {req.request_type === 'bug_fix' ? 'Bug / Fix' : 'Enhancement'}
                                            </span>
                                            <div className="text-[10px] text-slate-500 mt-1">
                                                {MODULE_LABELS[req.system_module] || req.system_module}
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 max-w-xs">
                                            <div className="font-bold text-slate-900 truncate" title={req.subject}>
                                                {req.subject}
                                            </div>
                                            <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                                {req.description}
                                            </div>
                                            {req.has_attachment && req.attachment_url && (
                                                <button
                                                    type="button"
                                                    onClick={() => systemRequestService.openSecureAttachment(req.attachment_url)}
                                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-blue-600 hover:underline mt-1 cursor-pointer"
                                                >
                                                    <ImageIcon className="w-3 h-3" />
                                                    <span>View Image</span>
                                                    <ExternalLink className="w-2.5 h-2.5" />
                                                </button>
                                            )}
                                        </td>
                                        <td className="px-4 py-3 text-center whitespace-nowrap">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${PRIORITY_BADGE[req.priority] || 'bg-slate-100 text-slate-700'}`}>
                                                {req.priority}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-center whitespace-nowrap">
                                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${STATUS_BADGE[req.status] || 'bg-slate-100 text-slate-700'}`}>
                                                {String(req.status || 'pending').replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right whitespace-nowrap">
                                            <div className="inline-flex items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => openReviewModal(req)}
                                                    className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold transition cursor-pointer"
                                                >
                                                    Review
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(req)}
                                                    className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                                    title="Delete ticket"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {lastPage > 1 && (
                    <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
                        <span>Showing page {page} of {lastPage} ({total} total tickets)</span>
                        <div className="flex items-center gap-1.5">
                            <button
                                type="button"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                                className="p-1.5 rounded-lg border border-slate-300 bg-white disabled:opacity-40 cursor-pointer"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                type="button"
                                disabled={page >= lastPage}
                                onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
                                className="p-1.5 rounded-lg border border-slate-300 bg-white disabled:opacity-40 cursor-pointer"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Review Modal */}
            {selectedRequest && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto"
                    onClick={() => setSelectedRequest(null)}
                >
                    <div
                        className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-slate-900 px-5 py-4 text-white flex items-center justify-between">
                            <div>
                                <div className="font-mono text-xs text-blue-300 font-bold">{selectedRequest.ticket_number}</div>
                                <h3 className="text-sm font-extrabold mt-0.5">{selectedRequest.subject}</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setSelectedRequest(null)}
                                className="p-1 rounded-lg hover:bg-white/10 cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveStatus} className="p-5 space-y-4">
                            <div className="grid grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-200">
                                <div>
                                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Submitted By</span>
                                    <span className="font-bold text-slate-800">{selectedRequest.user?.name}</span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Office / Role</span>
                                    <span className="font-semibold text-slate-700">
                                        {selectedRequest.office?.code || 'N/A'} · {selectedRequest.user?.role}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Module</span>
                                    <span className="font-semibold text-slate-700">
                                        {MODULE_LABELS[selectedRequest.system_module] || selectedRequest.system_module}
                                    </span>
                                </div>
                                <div>
                                    <span className="text-[10px] font-bold uppercase text-slate-400 block">Priority</span>
                                    <span className="font-bold uppercase text-slate-800">{selectedRequest.priority}</span>
                                </div>
                            </div>

                            <div>
                                <span className="text-[11px] font-bold uppercase text-slate-500 block mb-1">Description</span>
                                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 whitespace-pre-line max-h-40 overflow-y-auto">
                                    {selectedRequest.description}
                                </div>
                            </div>

                            {selectedRequest.has_attachment && selectedRequest.attachment_url && (
                                <div>
                                    <button
                                        type="button"
                                        onClick={() => systemRequestService.openSecureAttachment(selectedRequest.attachment_url)}
                                        className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-bold transition cursor-pointer"
                                    >
                                        <ImageIcon className="w-4 h-4" />
                                        <span>Open Attached Image ({selectedRequest.attachment_original_name || 'Screenshot'})</span>
                                        <ExternalLink className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">Ticket Status</label>
                                <select
                                    value={editStatus}
                                    onChange={(e) => setEditStatus(e.target.value)}
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-800 bg-white"
                                >
                                    <option value="pending">Pending</option>
                                    <option value="in_progress">In Progress</option>
                                    <option value="resolved">Resolved / Implemented</option>
                                    <option value="rejected">Rejected / Declined</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Super Admin Remarks / Resolution Notes
                                </label>
                                <textarea
                                    rows={3}
                                    maxLength={2000}
                                    value={editRemarks}
                                    onChange={(e) => setEditRemarks(e.target.value)}
                                    placeholder="Add notes or resolution details visible to the requestor..."
                                    className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setSelectedRequest(null)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
                                >
                                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                    <span>Save Update</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
