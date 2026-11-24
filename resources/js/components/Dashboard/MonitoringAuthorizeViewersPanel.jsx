import React, { useState, useEffect } from 'react';
import { Eye, Search, Shield, CheckCircle2, Loader2, RefreshCw } from 'lucide-react';
import { monitoringService } from '../../services/api';

export const MonitoringAuthorizeViewersPanel = () => {
    const [users, setUsers] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [search, setSearch] = useState('');
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [feedback, setFeedback] = useState(null);

    const loadUsers = async () => {
        setLoading(true);
        setFeedback(null);
        try {
            const res = await monitoringService.getAuthorizedUsers();
            const list = res.data?.users || [];
            setUsers(list);
            setSelectedIds(
                list.filter((u) => Boolean(u.can_view_all_monitoring_ppmp)).map((u) => u.id)
            );
        } catch (err) {
            console.error('Failed to load monitoring viewer authorizations:', err);
            setFeedback({
                type: 'error',
                message: err.response?.data?.message || 'Failed to load user list.',
            });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const handleToggle = (userId) => {
        setSelectedIds((prev) =>
            prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
        );
    };

    const handleSave = async () => {
        setSaving(true);
        setFeedback(null);
        try {
            const res = await monitoringService.updateAuthorizedUsers(selectedIds);
            setFeedback({
                type: 'success',
                message: res.data?.message || 'Authorized Monitoring System viewers updated successfully.',
            });
            setUsers((prev) =>
                prev.map((u) => ({
                    ...u,
                    can_view_all_monitoring_ppmp: selectedIds.includes(u.id),
                }))
            );
        } catch (err) {
            console.error('Failed to save monitoring viewer authorizations:', err);
            setFeedback({
                type: 'error',
                message: err.response?.data?.message || 'Failed to save authorized viewers.',
            });
        } finally {
            setSaving(false);
        }
    };

    const filteredUsers = users.filter((u) => {
        const q = search.trim().toLowerCase();
        if (!q) return true;
        return (
            u.name?.toLowerCase().includes(q) ||
            u.email?.toLowerCase().includes(q) ||
            u.role?.toLowerCase().includes(q) ||
            u.office?.name?.toLowerCase().includes(q)
        );
    });

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                        <Eye className="w-4 h-4 text-emerald-600" />
                        <span>Authorize Viewer (Monitoring System)</span>
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        By default, users only see PPMPs they created on the Monitoring System. Select users below who are authorized to view <strong>all</strong> PPMPs published to PIMS. (Admins &amp; Super Admins always have full access.)
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={loadUsers}
                        disabled={loading}
                        className="px-3 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1.5 cursor-pointer"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                    </button>
                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={saving || loading}
                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                    >
                        {saving ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                            <Shield className="w-3.5 h-3.5" />
                        )}
                        <span>{saving ? 'Saving...' : `Save Authorization (${selectedIds.length})`}</span>
                    </button>
                </div>
            </div>

            {feedback && (
                <div
                    className={`mx-5 mt-4 p-3 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
                        feedback.type === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                >
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                    <span>{feedback.message}</span>
                </div>
            )}

            <div className="p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="relative flex-1 max-w-md">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Search user by name, email, role, or office..."
                            className="w-full text-xs pl-9 pr-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                    </div>
                    <div className="text-xs text-slate-600 font-semibold">
                        Authorized: <span className="text-emerald-700 font-bold">{selectedIds.length}</span> / {users.length} active users
                    </div>
                </div>

                {loading ? (
                    <div className="py-12 text-center text-xs text-slate-500">Loading users...</div>
                ) : filteredUsers.length === 0 ? (
                    <div className="py-12 text-center text-xs text-slate-400">No matching users found.</div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                        {filteredUsers.map((u) => {
                            const checked = selectedIds.includes(u.id);
                            return (
                                <label
                                    key={u.id}
                                    className={`flex items-center justify-between gap-3 p-3 rounded-xl border cursor-pointer transition ${
                                        checked
                                            ? 'bg-emerald-50/80 border-emerald-300 shadow-2xs'
                                            : 'bg-white border-slate-200 hover:bg-slate-50'
                                    }`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <input
                                            type="checkbox"
                                            checked={checked}
                                            onChange={() => handleToggle(u.id)}
                                            className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                                        />
                                        <div className="min-w-0">
                                            <div className="text-xs font-bold text-slate-900 truncate">
                                                {u.name}
                                            </div>
                                            <div className="text-[11px] text-slate-500 truncate">
                                                {u.email} • {u.office?.name || 'No Office'}
                                            </div>
                                        </div>
                                    </div>
                                    <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                                        {u.role?.replace(/_/g, ' ')}
                                    </span>
                                </label>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};
