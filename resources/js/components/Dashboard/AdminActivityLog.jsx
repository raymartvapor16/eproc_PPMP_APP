import React, { useState, useEffect, useCallback } from "react";
import * as XLSX from "xlsx";
import {
    Activity,
    Search,
    Filter,
    RefreshCw,
    Download,
    User,
    LogIn,
    LogOut,
    Shield,
    FileText,
    GitBranch,
    Settings,
    Calendar,
    Clock,
    ChevronLeft,
    ChevronRight,
    X,
    AlertTriangle,
    CheckCircle2,
    RotateCcw,
    Loader2,
    Eye,
} from "lucide-react";

const CATEGORY_CONFIG = {
    auth: {
        label: "Authentication",
        bg: "bg-blue-50",
        border: "border-blue-200",
        badge: "bg-blue-100 text-blue-800",
        icon: LogIn,
        iconColor: "text-blue-600",
        dot: "bg-blue-500",
    },
    workflow: {
        label: "Workflow",
        bg: "bg-indigo-50",
        border: "border-indigo-200",
        badge: "bg-indigo-100 text-indigo-800",
        icon: GitBranch,
        iconColor: "text-indigo-600",
        dot: "bg-indigo-500",
    },
    amendment: {
        label: "Amendment",
        bg: "bg-purple-50",
        border: "border-purple-200",
        badge: "bg-purple-100 text-purple-800",
        icon: RotateCcw,
        iconColor: "text-purple-600",
        dot: "bg-purple-500",
    },
    ppmp: {
        label: "PPMP",
        bg: "bg-emerald-50",
        border: "border-emerald-200",
        badge: "bg-emerald-100 text-emerald-800",
        icon: FileText,
        iconColor: "text-emerald-600",
        dot: "bg-emerald-500",
    },
    user: {
        label: "User Mgmt",
        bg: "bg-amber-50",
        border: "border-amber-200",
        badge: "bg-amber-100 text-amber-800",
        icon: User,
        iconColor: "text-amber-600",
        dot: "bg-amber-500",
    },
    admin: {
        label: "Admin",
        bg: "bg-rose-50",
        border: "border-rose-200",
        badge: "bg-rose-100 text-rose-800",
        icon: Shield,
        iconColor: "text-rose-600",
        dot: "bg-rose-500",
    },
    other: {
        label: "System",
        bg: "bg-slate-50",
        border: "border-slate-200",
        badge: "bg-slate-100 text-slate-700",
        icon: Settings,
        iconColor: "text-slate-600",
        dot: "bg-slate-400",
    },
};

const formatDate = (dateString) => {
    if (!dateString) return "—";
    const d = new Date(dateString);
    return d.toLocaleString("en-PH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
    });
};

export const AdminActivityLog = () => {
    const [logs, setLogs] = useState([]);
    const [pagination, setPagination] = useState(null);
    const [availableActions, setAvailableActions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [search, setSearch] = useState("");
    const [actionFilter, setActionFilter] = useState("");
    const [categoryFilter, setCategoryFilter] = useState("");
    const [dateFrom, setDateFrom] = useState("");
    const [dateTo, setDateTo] = useState("");
    const [perPage, setPerPage] = useState(50);
    const [currentPage, setCurrentPage] = useState(1);

    const [selectedLog, setSelectedLog] = useState(null);

    const fetchLogs = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const params = new URLSearchParams();
            if (search) params.set("search", search);
            if (actionFilter) params.set("action", actionFilter);
            if (dateFrom) params.set("date_from", dateFrom);
            if (dateTo) params.set("date_to", dateTo);
            params.set("per_page", perPage);
            params.set("page", currentPage);

            const res = await fetch(`/api/activity-logs?${params.toString()}`, {
                credentials: "include",
            });
            if (!res.ok) throw new Error("Failed to load activity logs");
            const data = await res.json();

            let filtered = data.logs.data;
            if (categoryFilter) {
                filtered = filtered.filter((l) => l.category === categoryFilter);
            }

            setLogs(filtered);
            setPagination(data.logs);
            setAvailableActions(data.available_actions || []);
        } catch (err) {
            setError(err.message || "Unknown error");
        } finally {
            setLoading(false);
        }
    }, [search, actionFilter, categoryFilter, dateFrom, dateTo, perPage, currentPage]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

    const handleExport = () => {
        const rows = logs.map((l) => ({
            ID: l.id,
            DateTime: formatDate(l.created_at),
            Category: l.category || "",
            Action: l.action,
            Description: l.description || "",
            User: l.user?.name || "—",
            Email: l.user?.email || "—",
            Office: l.user?.office?.name || "—",
            "Entity Type": l.entity_type || "",
            "Entity ID": l.entity_id || "",
            "IP Address": l.ip_address || "",
        }));
        const ws = XLSX.utils.json_to_sheet(rows);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Activity Logs");
        XLSX.writeFile(wb, `activity_logs_${new Date().toISOString().slice(0, 10)}.xlsx`);
    };

    const resetFilters = () => {
        setSearch("");
        setActionFilter("");
        setCategoryFilter("");
        setDateFrom("");
        setDateTo("");
        setCurrentPage(1);
    };

    const hasFilters = search || actionFilter || categoryFilter || dateFrom || dateTo;

    return (
        <div className="space-y-4">

            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                    <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                        <Activity className="w-4 h-4 text-indigo-600" />
                        System Activity Logs
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Complete audit trail of all system actions — authentication, workflow transitions, and admin operations
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchLogs}
                        disabled={loading}
                        title="Refresh"
                        className="p-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 transition disabled:opacity-50 cursor-pointer"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                    <button
                        onClick={handleExport}
                        disabled={logs.length === 0}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-sm disabled:opacity-50 cursor-pointer"
                    >
                        <Download className="w-3.5 h-3.5" />
                        Export Excel
                    </button>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4">
                <div className="flex flex-wrap gap-3 items-end">

                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Search</label>
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Search user, action, IP..."
                                value={search}
                                onChange={(e) => { setSearch(e.target.value); setCurrentPage(1); }}
                                className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                            />
                        </div>
                    </div>

                    <div className="min-w-[140px]">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Category</label>
                        <select
                            value={categoryFilter}
                            onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
                            className="w-full text-xs border border-slate-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        >
                            <option value="">All Categories</option>
                            {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => (
                                <option key={key} value={key}>{cfg.label}</option>
                            ))}
                        </select>
                    </div>

                    <div className="min-w-[180px]">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Action Code</label>
                        <select
                            value={actionFilter}
                            onChange={(e) => { setActionFilter(e.target.value); setCurrentPage(1); }}
                            className="w-full text-xs border border-slate-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        >
                            <option value="">All Actions</option>
                            {availableActions.map((a) => (
                                <option key={a} value={a}>{a}</option>
                            ))}
                        </select>
                    </div>

                    <div className="min-w-[140px]">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Date From</label>
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                            className="w-full text-xs border border-slate-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                    </div>

                    <div className="min-w-[140px]">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Date To</label>
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                            className="w-full text-xs border border-slate-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        />
                    </div>

                    <div className="min-w-[80px]">
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Per Page</label>
                        <select
                            value={perPage}
                            onChange={(e) => { setPerPage(Number(e.target.value)); setCurrentPage(1); }}
                            className="w-full text-xs border border-slate-300 rounded-lg py-2 px-3 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                        >
                            <option value={25}>25</option>
                            <option value={50}>50</option>
                            <option value={100}>100</option>
                        </select>
                    </div>

                    {hasFilters && (
                        <button
                            onClick={resetFilters}
                            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-rose-50 hover:border-rose-200 text-slate-600 hover:text-rose-600 border border-slate-200 rounded-lg text-xs font-semibold transition cursor-pointer self-end"
                        >
                            <X className="w-3.5 h-3.5" />
                            Reset
                        </button>
                    )}
                </div>
            </div>

            {pagination && !loading && (
                <div className="flex flex-wrap gap-2">
                    {Object.entries(CATEGORY_CONFIG).map(([key, cfg]) => {
                        const count = logs.filter((l) => l.category === key).length;
                        if (count === 0 && categoryFilter && categoryFilter !== key) return null;
                        return (
                            <button
                                key={key}
                                onClick={() => setCategoryFilter(categoryFilter === key ? "" : key)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border cursor-pointer transition ${
                                    categoryFilter === key
                                        ? `${cfg.bg} ${cfg.border} ${cfg.iconColor} shadow-xs`
                                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                                }`}
                            >
                                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                                {cfg.label}
                                <span className={`px-1 py-0.5 rounded text-[10px] font-bold ${cfg.badge}`}>{count}</span>
                            </button>
                        );
                    })}
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                {error && (
                    <div className="p-4 bg-rose-50 border-b border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        {error}
                    </div>
                )}

                {loading ? (
                    <div className="p-12 flex items-center justify-center gap-3 text-slate-500">
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                        <span className="text-sm">Loading activity logs...</span>
                    </div>
                ) : logs.length === 0 ? (
                    <div className="p-12 text-center text-slate-400">
                        <Activity className="w-8 h-8 mx-auto mb-2 opacity-30" />
                        <p className="text-sm font-medium">No activity logs found</p>
                        <p className="text-xs mt-1">
                            {hasFilters ? "Try adjusting your filters." : "Actions will appear here as users interact with the system."}
                        </p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200 text-[11px]">
                                <tr>
                                    <th className="px-4 py-3">Date &amp; Time</th>
                                    <th className="px-4 py-3">Category</th>
                                    <th className="px-4 py-3">Description</th>
                                    <th className="px-4 py-3">User</th>
                                    <th className="px-4 py-3">IP Address</th>
                                    <th className="px-4 py-3 text-right">Details</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {logs.map((log) => {
                                    const cfg = CATEGORY_CONFIG[log.category] || CATEGORY_CONFIG.other;
                                    const Icon = cfg.icon;
                                    return (
                                        <tr key={log.id} className="hover:bg-slate-50 transition group">

                                            <td className="px-4 py-3 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5 text-slate-700">
                                                    <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                                                    <span className="font-mono text-[11px]">{formatDate(log.created_at)}</span>
                                                </div>
                                            </td>

                                            <td className="px-4 py-3">
                                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.badge}`}>
                                                    <Icon className="w-2.5 h-2.5" />
                                                    {cfg.label}
                                                </span>
                                            </td>

                                            <td className="px-4 py-3 max-w-xs">
                                                <div className="font-medium text-slate-800 truncate" title={log.description}>
                                                    {log.description}
                                                </div>
                                                <div className="font-mono text-[10px] text-slate-400 mt-0.5">{log.action}</div>
                                            </td>

                                            <td className="px-4 py-3">
                                                {log.user ? (
                                                    <div>
                                                        <div className="font-semibold text-slate-800">{log.user.name}</div>
                                                        <div className="text-slate-400 text-[10px]">{log.user.office?.name || log.user.email}</div>
                                                    </div>
                                                ) : (
                                                    <span className="text-slate-400 italic">System</span>
                                                )}
                                            </td>

                                            <td className="px-4 py-3">
                                                <span className="font-mono text-slate-500 text-[11px]">{log.ip_address || "—"}</span>
                                            </td>

                                            <td className="px-4 py-3 text-right">
                                                {(log.old_values || log.new_values) ? (
                                                    <button
                                                        onClick={() => setSelectedLog(log)}
                                                        className="inline-flex items-center gap-1 px-2 py-1 text-indigo-600 hover:bg-indigo-50 rounded text-[11px] font-semibold transition cursor-pointer"
                                                    >
                                                        <Eye className="w-3 h-3" />
                                                        View
                                                    </button>
                                                ) : (
                                                    <span className="text-slate-300">—</span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {pagination && pagination.last_page > 1 && (
                    <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70 flex items-center justify-between text-xs text-slate-600">
                        <span>
                            Showing {pagination.from}–{pagination.to} of {pagination.total} entries
                        </span>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                                disabled={currentPage === 1}
                                className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            {Array.from({ length: Math.min(pagination.last_page, 7) }, (_, i) => {
                                const page = i + 1;
                                return (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={`px-2.5 py-1 rounded-lg font-semibold transition cursor-pointer ${
                                            currentPage === page
                                                ? "bg-indigo-600 text-white"
                                                : "hover:bg-slate-200 text-slate-700"
                                        }`}
                                    >
                                        {page}
                                    </button>
                                );
                            })}
                            {pagination.last_page > 7 && currentPage < pagination.last_page && (
                                <>
                                    <span className="px-1 text-slate-400">...</span>
                                    <button
                                        onClick={() => setCurrentPage(pagination.last_page)}
                                        className="px-2.5 py-1 rounded-lg hover:bg-slate-200 text-slate-700 font-semibold transition cursor-pointer"
                                    >
                                        {pagination.last_page}
                                    </button>
                                </>
                            )}
                            <button
                                onClick={() => setCurrentPage((p) => Math.min(pagination.last_page, p + 1))}
                                disabled={currentPage === pagination.last_page}
                                className="p-1.5 rounded-lg hover:bg-slate-200 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {selectedLog && (
                <div
                    className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={() => setSelectedLog(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[80vh] overflow-y-auto"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                                <Activity className="w-4 h-4 text-indigo-600" />
                                Log Entry #{selectedLog.id}
                            </h3>
                            <button
                                onClick={() => setSelectedLog(null)}
                                className="p-1 text-slate-400 hover:text-slate-700 rounded-lg transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4 text-xs">
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <div className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-1">Action</div>
                                    <code className="bg-slate-100 px-2 py-1 rounded text-slate-800 font-mono">{selectedLog.action}</code>
                                </div>
                                <div>
                                    <div className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-1">Entity</div>
                                    <span className="text-slate-700">{selectedLog.entity_type} #{selectedLog.entity_id || "—"}</span>
                                </div>
                                <div>
                                    <div className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-1">User</div>
                                    <span className="text-slate-800 font-semibold">{selectedLog.user?.name || "System"}</span>
                                </div>
                                <div>
                                    <div className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-1">IP Address</div>
                                    <span className="font-mono text-slate-700">{selectedLog.ip_address || "—"}</span>
                                </div>
                                <div className="col-span-2">
                                    <div className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-1">Timestamp</div>
                                    <span className="font-mono text-slate-700">{formatDate(selectedLog.created_at)}</span>
                                </div>
                            </div>

                            {selectedLog.old_values && Object.keys(selectedLog.old_values).length > 0 && (
                                <div>
                                    <div className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-2">Before</div>
                                    <pre className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-rose-800 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                                        {JSON.stringify(selectedLog.old_values, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {selectedLog.new_values && Object.keys(selectedLog.new_values).length > 0 && (
                                <div>
                                    <div className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-2">After</div>
                                    <pre className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-emerald-800 font-mono text-[11px] overflow-x-auto whitespace-pre-wrap">
                                        {JSON.stringify(selectedLog.new_values, null, 2)}
                                    </pre>
                                </div>
                            )}

                            {selectedLog.user_agent && (
                                <div>
                                    <div className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] mb-1">User Agent</div>
                                    <p className="text-slate-500 break-all">{selectedLog.user_agent}</p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
