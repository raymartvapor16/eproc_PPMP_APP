import React, { useState, useEffect, useCallback } from 'react';
import {
    ShieldAlert,
    AlertTriangle,
    Globe,
    MapPin,
    Terminal,
    KeyRound,
    UploadCloud,
    Lock,
    Database,
    RotateCcw,
    Download,
    CheckCircle2,
    Search,
    RefreshCw,
    Eye,
    EyeOff,
    X,
    CalendarClock,
    Trash2,
    Loader2,
    ShieldCheck,
} from 'lucide-react';
import { securityThreatService, databaseBackupService } from '../../services/api';
import { showConfirm } from '../../utils/modalAlert';
import { DatabaseBackupManagement } from './DatabaseBackupManagement';

const THREAT_TYPES = [
    { value: 'ALL', label: 'All Attack Vectors' },
    { value: 'FILE_UPLOAD_ATTACK', label: 'Malicious File Upload' },
    { value: 'SESSION_HIJACK', label: 'Session Hijacking / CSRF' },
    { value: 'BRUTE_FORCE', label: 'Brute Force / Rate Limit' },
    { value: 'CLI_API_PROBING', label: 'Terminal / CLI API Probing' },
    { value: 'TOKEN_PROBING', label: 'Token / API Prediction Probe' },
    { value: 'INJECTION_XSS_PROBE', label: 'SQLi / XSS / Path Traversal' },
    { value: 'UNAUTHORIZED_ACCESS', label: 'Unauthorized Feature / IDOR' },
    { value: 'MASS_DELETE_RED_ALERT', label: 'Mass Deletion Red Alert' },
];

const SEVERITY_BADGE = {
    critical: 'bg-rose-600 text-white border-rose-700',
    high: 'bg-orange-100 text-orange-900 border-orange-300',
    medium: 'bg-amber-100 text-amber-900 border-amber-300',
    low: 'bg-slate-100 text-slate-700 border-slate-300',
};

const formatBytes = (bytes) => {
    const b = Number(bytes || 0);
    if (b < 1024) return `${b} B`;
    if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
    return `${(b / (1024 * 1024)).toFixed(2)} MB`;
};

const formatDateTime = (val) => {
    if (!val) return '—';
    try {
        return new Date(val).toLocaleString();
    } catch {
        return String(val);
    }
};

export const SuperAdminSecurityLogsView = ({ initialTab = 'threats' }) => {
    const [activeTab, setActiveTab] = useState(initialTab);
    const [loading, setLoading] = useState(true);
    const [feedback, setFeedback] = useState(null);

    const [downloadTargetBackup, setDownloadTargetBackup] = useState(null);
    const [downloadAccountPassword, setDownloadAccountPassword] = useState('');
    const [downloadBackupPassword, setDownloadBackupPassword] = useState('');
    const [showDownloadAccountPwd, setShowDownloadAccountPwd] = useState(false);
    const [showDownloadBackupPwd, setShowDownloadBackupPwd] = useState(false);
    const [hasManualBackupKey, setHasManualBackupKey] = useState(false);
    const [downloadingSnapshot, setDownloadingSnapshot] = useState(false);
    const [downloadAuthError, setDownloadAuthError] = useState('');

    useEffect(() => {
        if (initialTab) {
            setActiveTab(initialTab);
        }
    }, [initialTab]);

    const openBackupDownloadGate = async (backup) => {
        setDownloadTargetBackup(backup);
        setDownloadAccountPassword('');
        setDownloadBackupPassword('');
        setShowDownloadAccountPwd(false);
        setShowDownloadBackupPwd(false);
        setDownloadAuthError('');
        try {
            const statusRes = await databaseBackupService.getStatus();
            setHasManualBackupKey(Boolean(statusRes.data?.has_password));
        } catch (_) {
            setHasManualBackupKey(false);
        }
    };

    const closeBackupDownloadGate = () => {
        if (downloadingSnapshot) return;
        setDownloadTargetBackup(null);
        setDownloadAccountPassword('');
        setDownloadBackupPassword('');
        setDownloadAuthError('');
    };

    const handleAuthorizedSnapshotDownload = async (e) => {
        e.preventDefault();
        if (!downloadTargetBackup || downloadingSnapshot) return;
        if (!downloadAccountPassword.trim()) {
            setDownloadAuthError('Please enter your Super Admin account password.');
            return;
        }
        if (hasManualBackupKey && !downloadBackupPassword.trim()) {
            setDownloadAuthError('Please enter the Manual Backup Security Master Key.');
            return;
        }

        setDownloadingSnapshot(true);
        setDownloadAuthError('');
        try {
            const payload = {
                account_password: downloadAccountPassword,
                ...(hasManualBackupKey ? { backup_password: downloadBackupPassword } : {}),
            };
            const res = await securityThreatService.downloadScheduledBackup(downloadTargetBackup.id, payload);
            const blob = new Blob([res.data], { type: 'application/sql' });
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = downloadTargetBackup.filename || `backup_${downloadTargetBackup.id}.sql`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);

            setFeedback({ type: 'success', text: `Authorized download started for "${downloadTargetBackup.filename}".` });
            setDownloadTargetBackup(null);
            setDownloadAccountPassword('');
            setDownloadBackupPassword('');
        } catch (err) {
            let msg = 'Authorization failed. Please verify your password and try again.';
            if (err.response?.data instanceof Blob) {
                try {
                    const txt = await err.response.data.text();
                    const parsed = JSON.parse(txt);
                    if (parsed?.message) msg = parsed.message;
                } catch (_) {}
            } else if (err.response?.data?.message) {
                msg = err.response.data.message;
            }
            setDownloadAuthError(msg);
        } finally {
            setDownloadingSnapshot(false);
        }
    };

    const [logs, setLogs] = useState([]);
    const [summary, setSummary] = useState({});
    const [scheduleInfo, setScheduleInfo] = useState({});
    const [threatTypeFilter, setThreatTypeFilter] = useState('ALL');
    const [severityFilter, setSeverityFilter] = useState('ALL');
    const [redAlertOnly, setRedAlertOnly] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedLog, setSelectedLog] = useState(null);

    const [deletedBackups, setDeletedBackups] = useState([]);
    const [deletedSearch, setDeletedSearch] = useState('');
    const [selectedDeletedBackup, setSelectedDeletedBackup] = useState(null);
    const [restoringId, setRestoringId] = useState(null);

    const [scheduledBackups, setScheduledBackups] = useState([]);
    const [runningBackup, setRunningBackup] = useState(false);

    const fetchThreats = useCallback(async () => {
        setLoading(true);
        try {
            const res = await securityThreatService.getThreats({
                threat_type: threatTypeFilter,
                severity: severityFilter,
                red_alert_only: redAlertOnly ? 1 : 0,
                search: searchQuery.trim() || undefined,
            });
            setLogs(res.data?.logs || []);
            setSummary(res.data?.summary || {});
            setScheduleInfo(res.data?.auto_backup_schedule || {});
        } catch (err) {
            setFeedback({ type: 'error', text: err.response?.data?.message || 'Failed to load security threat logs.' });
        } finally {
            setLoading(false);
        }
    }, [threatTypeFilter, severityFilter, redAlertOnly, searchQuery]);

    const fetchDeletedBackups = useCallback(async () => {
        setLoading(true);
        try {
            const res = await securityThreatService.getDeletedBackups({
                search: deletedSearch.trim() || undefined,
            });
            setDeletedBackups(res.data?.backups || []);
        } catch (err) {
            setFeedback({ type: 'error', text: err.response?.data?.message || 'Failed to load deleted data backups.' });
        } finally {
            setLoading(false);
        }
    }, [deletedSearch]);

    const fetchScheduledBackups = useCallback(async () => {
        setLoading(true);
        try {
            const res = await securityThreatService.getScheduledBackups();
            setScheduledBackups(res.data?.backups || []);
            setScheduleInfo({
                interval_days: res.data?.interval_days || 15,
                last_auto_backup_at: res.data?.last_auto_backup_at,
                next_scheduled_at: res.data?.next_scheduled_at,
            });
        } catch (err) {
            setFeedback({ type: 'error', text: err.response?.data?.message || 'Failed to load scheduled database backups.' });
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (activeTab === 'threats') fetchThreats();
        else if (activeTab === 'deleted_backups') fetchDeletedBackups();
        else fetchScheduledBackups();
    }, [activeTab, fetchThreats, fetchDeletedBackups, fetchScheduledBackups]);

    const handleResolveThreat = async (id) => {
        try {
            const res = await securityThreatService.resolveThreat(id);
            setLogs((prev) => prev.map((l) => (l.id === id ? res.data.log : l)));
            if (selectedLog?.id === id) setSelectedLog(res.data.log);
            setFeedback({ type: 'success', text: 'Security alert marked as resolved.' });
        } catch (err) {
            setFeedback({ type: 'error', text: err.response?.data?.message || 'Failed to resolve threat.' });
        }
    };

    const handleRestoreRecord = async (backup) => {
        const confirmed = await showConfirm({
            title: 'Restore Deleted Data',
            message: `Restore "${backup.record_label}" back into table "${backup.table_name}"?`,
            confirmText: 'Yes, Restore Record',
            cancelText: 'Cancel',
        });
        if (!confirmed) return;

        setRestoringId(backup.id);
        try {
            const res = await securityThreatService.restoreDeletedBackup(backup.id);
            setDeletedBackups((prev) => prev.map((b) => (b.id === backup.id ? res.data.backup : b)));
            setFeedback({ type: 'success', text: res.data?.message || 'Record restored successfully.' });
        } catch (err) {
            setFeedback({ type: 'error', text: err.response?.data?.message || 'Failed to restore record.' });
        } finally {
            setRestoringId(null);
        }
    };

    const handleRunBackupNow = async () => {
        setRunningBackup(true);
        setFeedback(null);
        try {
            const res = await securityThreatService.runBackupNow();
            setFeedback({ type: 'success', text: res.data?.message || 'Database snapshot created.' });
            fetchScheduledBackups();
        } catch (err) {
            setFeedback({ type: 'error', text: err.response?.data?.message || 'Failed to create backup snapshot.' });
        } finally {
            setRunningBackup(false);
        }
    };

    return (
        <div className="space-y-5">

            <div className="bg-slate-950 text-white rounded-2xl border border-slate-800 p-5 shadow-lg">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-3">
                        <div className="w-11 h-11 rounded-2xl bg-rose-600/20 border border-rose-500/40 text-rose-400 flex items-center justify-center shrink-0">
                            <ShieldAlert className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h2 className="text-lg font-black tracking-tight">
                                    Intrusion Detection, Threat Intelligence &amp; Auto-Backup Center
                                </h2>
                                {(summary.red_alerts_active || 0) > 0 && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-black uppercase tracking-wider animate-pulse">
                                        <AlertTriangle className="w-3 h-3" />
                                        {summary.red_alerts_active} Active Red Alert{summary.red_alerts_active === 1 ? '' : 's'}
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-slate-300 mt-1">
                                Platform-wide protection across <strong>all systems</strong> (PPMP/APP, OPPMO Monitoring, PIMS, Supplier Evaluation, PNPKI Registry, Portal &amp; Master Data): real-time file upload attacks, session hijacking &amp; token probes, brute force, CLI scanners, real IP &amp; geolocation, deleted-data auto-backups, and 15-day DB backups.
                            </p>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            if (activeTab === 'threats') fetchThreats();
                            else if (activeTab === 'deleted_backups') fetchDeletedBackups();
                            else fetchScheduledBackups();
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-slate-100 transition cursor-pointer shrink-0"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                        Refresh Intel
                    </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mt-4">
                    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                        <div className="text-[10px] font-bold uppercase text-slate-400">Total Threats</div>
                        <div className="text-xl font-black text-white mt-0.5">{summary.total_threats || 0}</div>
                    </div>
                    <div className="bg-rose-950/60 border border-rose-800/70 rounded-xl p-3">
                        <div className="text-[10px] font-bold uppercase text-rose-300">Active Red Alerts</div>
                        <div className="text-xl font-black text-rose-400 mt-0.5">{summary.red_alerts_active || 0}</div>
                    </div>
                    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                        <div className="text-[10px] font-bold uppercase text-slate-400">Unique Attacker IPs</div>
                        <div className="text-xl font-black text-amber-400 mt-0.5">{summary.unique_ips || 0}</div>
                    </div>
                    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                        <div className="text-[10px] font-bold uppercase text-slate-400">CLI / Token / Hijack</div>
                        <div className="text-xl font-black text-cyan-400 mt-0.5">{summary.cli_token_probes || 0}</div>
                    </div>
                    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                        <div className="text-[10px] font-bold uppercase text-slate-400">Deleted Auto-Backups</div>
                        <div className="text-xl font-black text-emerald-400 mt-0.5">{summary.deleted_backups_count || 0}</div>
                    </div>
                    <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-3">
                        <div className="text-[10px] font-bold uppercase text-slate-400">15-Day DB Snapshots</div>
                        <div className="text-xl font-black text-indigo-400 mt-0.5">{summary.scheduled_backups_count || 0}</div>
                    </div>
                </div>
            </div>

            {feedback && (
                <div
                    className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 ${
                        feedback.type === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                >
                    <span>{feedback.text}</span>
                    <button type="button" onClick={() => setFeedback(null)} className="p-1 cursor-pointer">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            <div className="bg-white p-1.5 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => setActiveTab('threats')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition cursor-pointer ${
                        activeTab === 'threats'
                            ? 'bg-rose-600 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <ShieldAlert className="w-4 h-4" />
                    <span>Intrusion &amp; Attack Logs</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('deleted_backups')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition cursor-pointer ${
                        activeTab === 'deleted_backups'
                            ? 'bg-emerald-600 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <Trash2 className="w-4 h-4" />
                    <span>Deleted Data Auto-Backups ({summary.deleted_backups_count || 0})</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('scheduled_backups')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition cursor-pointer ${
                        activeTab === 'scheduled_backups'
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <CalendarClock className="w-4 h-4" />
                    <span>15-Day Auto DB Backups</span>
                </button>

                <button
                    type="button"
                    onClick={() => setActiveTab('manual_backup')}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-extrabold uppercase tracking-wider transition cursor-pointer ${
                        activeTab === 'manual_backup'
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-slate-600 hover:bg-slate-100'
                    }`}
                >
                    <Database className="w-4 h-4" />
                    <span>Database Backup (SQL Dump)</span>
                </button>
            </div>

            {activeTab === 'threats' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="p-4 border-b border-slate-200 bg-slate-50/70 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
                        <div className="relative lg:col-span-2">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search IP, location, API endpoint, token preview, attack vector..."
                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white focus:ring-2 focus:ring-rose-500 focus:outline-none"
                            />
                        </div>

                        <select
                            value={threatTypeFilter}
                            onChange={(e) => setThreatTypeFilter(e.target.value)}
                            className="px-2.5 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                        >
                            {THREAT_TYPES.map((t) => (
                                <option key={t.value} value={t.value}>
                                    {t.label}
                                </option>
                            ))}
                        </select>

                        <select
                            value={severityFilter}
                            onChange={(e) => setSeverityFilter(e.target.value)}
                            className="px-2.5 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                        >
                            <option value="ALL">All Severities</option>
                            <option value="critical">Critical / Red Alert</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                        </select>

                        <label className="inline-flex items-center justify-center gap-2 px-3 py-2 rounded-xl border border-rose-200 bg-rose-50 text-rose-800 text-xs font-bold cursor-pointer">
                            <input
                                type="checkbox"
                                checked={redAlertOnly}
                                onChange={(e) => setRedAlertOnly(e.target.checked)}
                                className="rounded text-rose-600"
                            />
                            <span>Red Alerts Only</span>
                        </label>
                    </div>

                    {loading ? (
                        <div className="p-10 text-center text-slate-500 flex flex-col items-center gap-2">
                            <Loader2 className="w-6 h-6 animate-spin text-rose-600" />
                            <span className="text-xs font-semibold">Loading threat intelligence logs...</span>
                        </div>
                    ) : logs.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 space-y-2">
                            <ShieldCheck className="w-9 h-9 mx-auto text-emerald-500" />
                            <div className="text-sm font-bold text-slate-700">No security threats recorded for the current filter.</div>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                                        <th className="py-3 px-3">Time &amp; Severity</th>
                                        <th className="py-3 px-3">Attack Vector &amp; Feature</th>
                                        <th className="py-3 px-3">Real IP &amp; Location</th>
                                        <th className="py-3 px-3">Target API / Token Used</th>
                                        <th className="py-3 px-3">Status</th>
                                        <th className="py-3 px-3 text-right">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {logs.map((log) => (
                                        <tr
                                            key={log.id}
                                            className={`hover:bg-slate-50/90 transition ${
                                                log.is_red_alert && !log.is_resolved ? 'bg-rose-50/50' : ''
                                            }`}
                                        >
                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <span
                                                        className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase border ${
                                                            SEVERITY_BADGE[log.severity] || SEVERITY_BADGE.medium
                                                        }`}
                                                    >
                                                        {log.is_red_alert ? 'RED ALERT' : log.severity}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-semibold mt-1">
                                                    {formatDateTime(log.created_at)}
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-3 max-w-[280px]">
                                                <div className="font-extrabold text-slate-900">{log.threat_type}</div>
                                                <div className="text-[11px] text-slate-600 line-clamp-2 mt-0.5" title={log.attack_vector}>
                                                    {log.attack_vector}
                                                </div>
                                                <div className="text-[10px] text-indigo-700 font-bold mt-0.5">
                                                    Feature: {log.target_feature || 'System'}
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                <div className="font-mono font-bold text-slate-900 flex items-center gap-1">
                                                    <Globe className="w-3.5 h-3.5 text-rose-500" />
                                                    <span>{log.ip_address || 'Unknown'}</span>
                                                </div>
                                                <div className="text-[11px] text-slate-600 flex items-center gap-1 mt-0.5">
                                                    <MapPin className="w-3 h-3 text-slate-400" />
                                                    <span>
                                                        {[log.city, log.region, log.country].filter(Boolean).join(', ') || 'Unknown Location'}
                                                    </span>
                                                </div>
                                                {log.isp && (
                                                    <div className="text-[10px] text-slate-400 truncate max-w-[180px]" title={log.isp}>
                                                        ISP: {log.isp}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-3 max-w-[260px]">
                                                <div className="font-mono text-[11px] font-bold text-slate-800 truncate" title={`${log.http_method} ${log.endpoint}`}>
                                                    <span className="px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 mr-1 text-[10px]">
                                                        {log.http_method || 'REQ'}
                                                    </span>
                                                    {log.endpoint || '/'}
                                                </div>
                                                {log.token_preview ? (
                                                    <div className="text-[10px] font-mono text-amber-800 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 mt-1 truncate" title={log.token_preview}>
                                                        <KeyRound className="w-3 h-3 inline mr-1" />
                                                        {log.token_type}: {log.token_preview}
                                                    </div>
                                                ) : (
                                                    <div className="text-[10px] text-slate-400 mt-1">Token: {log.token_type || 'None'}</div>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-3 whitespace-nowrap">
                                                {log.is_resolved ? (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold">
                                                        <CheckCircle2 className="w-3 h-3" /> Resolved
                                                    </span>
                                                ) : (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-100 text-rose-800 text-[10px] font-bold">
                                                        <AlertTriangle className="w-3 h-3" /> Open
                                                    </span>
                                                )}
                                            </td>
                                            <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-1">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedLog(log)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer"
                                                >
                                                    <Eye className="w-3 h-3" /> Inspect
                                                </button>
                                                {!log.is_resolved && (
                                                    <button
                                                        type="button"
                                                        onClick={() => handleResolveThreat(log.id)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer"
                                                    >
                                                        Resolve
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'deleted_backups' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="p-4 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
                        <div className="text-xs font-bold text-slate-700">
                            Every deleted or force-deleted record across <strong>all systems</strong> (PPMP/APP, OPPMO Monitoring, PIMS Purchase Requests, Supplier Evaluation, Users, Offices, Master Data) is automatically snapshotted here. Mass deletions (5+ in 5 min) trigger a Red Alert &amp; Emergency DB Backup.
                        </div>
                        <div className="relative w-full sm:w-72">
                            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={deletedSearch}
                                onChange={(e) => setDeletedSearch(e.target.value)}
                                placeholder="Search table, label, deleter, IP..."
                                className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white"
                            />
                        </div>
                    </div>

                    {loading ? (
                        <div className="p-10 text-center text-slate-500">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-emerald-600" />
                        </div>
                    ) : deletedBackups.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 text-xs font-semibold">
                            No deleted record backups captured yet.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                                        <th className="py-3 px-3">Table &amp; Record</th>
                                        <th className="py-3 px-3">Delete Type</th>
                                        <th className="py-3 px-3">Deleted By &amp; IP/Location</th>
                                        <th className="py-3 px-3">Timestamp</th>
                                        <th className="py-3 px-3 text-right">Recovery</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {deletedBackups.map((b) => (
                                        <tr key={b.id} className="hover:bg-slate-50/80">
                                            <td className="py-2.5 px-3">
                                                <div className="font-extrabold text-slate-900">{b.record_label || `#${b.record_id}`}</div>
                                                <div className="text-[10px] font-mono text-slate-500">
                                                    {b.table_name} (ID: {b.record_id})
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                                        b.is_force_delete
                                                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                                                    }`}
                                                >
                                                    {b.is_force_delete ? 'Force Delete' : 'Soft Delete'}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3">
                                                <div className="font-bold text-slate-800">{b.deleted_by_name || 'System'}</div>
                                                <div className="text-[10px] text-slate-500 font-mono">
                                                    {b.ip_address} &bull; {b.location || 'Unknown'}
                                                </div>
                                            </td>
                                            <td className="py-2.5 px-3 text-[11px] text-slate-600 whitespace-nowrap">
                                                {formatDateTime(b.created_at)}
                                            </td>
                                            <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedDeletedBackup(b)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-bold cursor-pointer"
                                                >
                                                    <Eye className="w-3 h-3" /> JSON
                                                </button>
                                                {b.restored_at ? (
                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-bold">
                                                        <CheckCircle2 className="w-3 h-3" /> Restored
                                                    </span>
                                                ) : (
                                                    <button
                                                        type="button"
                                                        disabled={restoringId === b.id}
                                                        onClick={() => handleRestoreRecord(b)}
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold cursor-pointer disabled:opacity-50"
                                                    >
                                                        <RotateCcw className="w-3 h-3" />
                                                        {restoringId === b.id ? 'Restoring...' : 'Restore'}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'scheduled_backups' && (
                <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="p-5 border-b border-slate-200 bg-indigo-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="space-y-1">
                            <div className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
                                <Database className="w-4 h-4 text-indigo-600" />
                                Automatic 15-Day Database Backup Schedule
                            </div>
                            <div className="text-xs text-slate-600 font-semibold flex flex-wrap gap-x-4 gap-y-1">
                                <span>Interval: Every <strong>{scheduleInfo.interval_days || 15} days</strong></span>
                                <span>Last Backup: <strong>{formatDateTime(scheduleInfo.last_auto_backup_at)}</strong></span>
                                <span>Next Scheduled: <strong>{formatDateTime(scheduleInfo.next_scheduled_at)}</strong></span>
                            </div>
                        </div>

                        <button
                            type="button"
                            disabled={runningBackup}
                            onClick={handleRunBackupNow}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider shadow-sm transition cursor-pointer disabled:opacity-50 shrink-0"
                        >
                            {runningBackup ? <Loader2 className="w-4 h-4 animate-spin" /> : <Database className="w-4 h-4" />}
                            <span>{runningBackup ? 'Creating Snapshot...' : 'Run Backup Snapshot Now'}</span>
                        </button>
                    </div>

                    {loading ? (
                        <div className="p-10 text-center text-slate-500">
                            <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-600" />
                        </div>
                    ) : scheduledBackups.length === 0 ? (
                        <div className="p-12 text-center text-slate-500 text-xs font-semibold">
                            No automated snapshots stored yet. Click <strong>Run Backup Snapshot Now</strong> to create the first baseline snapshot.
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-extrabold uppercase tracking-wider text-slate-600">
                                        <th className="py-3 px-4">Snapshot Filename</th>
                                        <th className="py-3 px-3">Trigger Type</th>
                                        <th className="py-3 px-3">Size</th>
                                        <th className="py-3 px-3">Notes</th>
                                        <th className="py-3 px-3">Created</th>
                                        <th className="py-3 px-4 text-right">Download</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {scheduledBackups.map((sb) => (
                                        <tr key={sb.id} className="hover:bg-slate-50/80">
                                            <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{sb.filename}</td>
                                            <td className="py-2.5 px-3">
                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${
                                                        sb.trigger_type === 'mass_delete_emergency'
                                                            ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                                            : sb.trigger_type === 'scheduled_15day'
                                                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                                            : 'bg-indigo-100 text-indigo-800 border border-indigo-200'
                                                    }`}
                                                >
                                                    {sb.trigger_type}
                                                </span>
                                            </td>
                                            <td className="py-2.5 px-3 font-mono font-semibold text-slate-700">
                                                {formatBytes(sb.size_bytes)}
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-600 max-w-xs truncate" title={sb.notes}>
                                                {sb.notes || '—'}
                                            </td>
                                            <td className="py-2.5 px-3 text-slate-500 whitespace-nowrap">
                                                {formatDateTime(sb.created_at)}
                                            </td>
                                            <td className="py-2.5 px-4 text-right">
                                                <button
                                                    type="button"
                                                    onClick={() => openBackupDownloadGate(sb)}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-indigo-600 text-white text-[11px] font-bold transition cursor-pointer"
                                                >
                                                    <Lock className="w-3 h-3" />
                                                    <Download className="w-3.5 h-3.5" />
                                                    Download SQL
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'manual_backup' && (
                <DatabaseBackupManagement />
            )}

            {downloadTargetBackup && (
                <div
                    className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
                    onClick={closeBackupDownloadGate}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-indigo-950 text-white px-5 py-4 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center">
                                    <ShieldCheck className="w-4 h-4 text-indigo-300" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-black uppercase tracking-wide">
                                        Dual-Factor Authorization Gate
                                    </h3>
                                    <p className="text-[11px] text-slate-300">
                                        Verify credentials to download <span className="font-mono text-white">{downloadTargetBackup.filename}</span>
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closeBackupDownloadGate}
                                className="p-1 text-slate-400 hover:text-white cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleAuthorizedSnapshotDownload} className="p-5 space-y-4">
                            {downloadAuthError && (
                                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-start gap-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
                                    <span>{downloadAuthError}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                                    1. Super Admin Account Password <span className="text-rose-500">*</span>
                                </label>
                                <div className="relative">
                                    <input
                                        type={showDownloadAccountPwd ? 'text' : 'password'}
                                        required
                                        autoFocus
                                        value={downloadAccountPassword}
                                        onChange={(e) => setDownloadAccountPassword(e.target.value)}
                                        placeholder="Confirm your active login password"
                                        className="w-full px-3.5 py-2.5 pr-10 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowDownloadAccountPwd((p) => !p)}
                                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                    >
                                        {showDownloadAccountPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                </div>
                                <p className="text-[10.5px] text-slate-500 mt-1">
                                    Required on every database backup download to protect sensitive records.
                                </p>
                            </div>

                            {hasManualBackupKey && (
                                <div>
                                    <label className="block text-xs font-bold text-slate-800 mb-1.5">
                                        2. Manual Backup Security Master Key <span className="text-rose-500">*</span>
                                    </label>
                                    <div className="relative">
                                        <input
                                            type={showDownloadBackupPwd ? 'text' : 'password'}
                                            required
                                            value={downloadBackupPassword}
                                            onChange={(e) => setDownloadBackupPassword(e.target.value)}
                                            placeholder="Enter the secret manual backup key"
                                            className="w-full px-3.5 py-2.5 pr-10 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowDownloadBackupPwd((p) => !p)}
                                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                                        >
                                            {showDownloadBackupPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <p className="text-[10.5px] text-slate-500 mt-1">
                                        The separate manual backup security password you configured.
                                    </p>
                                </div>
                            )}

                            <div className="pt-2 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={closeBackupDownloadGate}
                                    disabled={downloadingSnapshot}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={downloadingSnapshot}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold uppercase tracking-wider shadow-sm transition cursor-pointer disabled:opacity-50"
                                >
                                    {downloadingSnapshot ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Download className="w-3.5 h-3.5" />
                                    )}
                                    <span>{downloadingSnapshot ? 'Verifying...' : 'Authorize & Download'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {selectedLog && (
                <div
                    className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
                    onClick={() => setSelectedLog(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
                            <div>
                                <div className="text-[10px] font-black uppercase text-rose-400">{selectedLog.threat_type}</div>
                                <h3 className="text-sm font-extrabold">Forensic Threat Event #{selectedLog.id}</h3>
                            </div>
                            <button type="button" onClick={() => setSelectedLog(null)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-5 space-y-3 text-xs max-h-[70vh] overflow-y-auto">
                            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 font-bold">
                                {selectedLog.attack_vector}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                                    <div className="text-[10px] font-bold uppercase text-slate-400">Real IP &amp; Geolocation</div>
                                    <div className="font-mono font-bold text-slate-900 mt-0.5">{selectedLog.ip_address}</div>
                                    <div className="text-slate-600">
                                        {[selectedLog.city, selectedLog.region, selectedLog.country].filter(Boolean).join(', ') || 'Unknown'}
                                    </div>
                                    {selectedLog.isp && <div className="text-[11px] text-slate-500">ISP: {selectedLog.isp}</div>}
                                    {selectedLog.forwarded_ips && (
                                        <div className="text-[10px] font-mono text-slate-500 mt-1">XFF: {selectedLog.forwarded_ips}</div>
                                    )}
                                </div>
                                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                                    <div className="text-[10px] font-bold uppercase text-slate-400">Target API &amp; Token Used</div>
                                    <div className="font-mono font-bold text-slate-900 mt-0.5 break-all">
                                        {selectedLog.http_method} {selectedLog.endpoint}
                                    </div>
                                    <div className="text-indigo-700 font-semibold">{selectedLog.target_feature}</div>
                                    <div className="text-[11px] font-mono text-amber-800 mt-1 break-all">
                                        {selectedLog.token_type || 'None'}: {selectedLog.token_preview || '—'}
                                    </div>
                                </div>
                            </div>
                            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                                <div className="text-[10px] font-bold uppercase text-slate-400 mb-1">User-Agent / Client Fingerprint</div>
                                <div className="font-mono text-[11px] text-slate-700 break-all">{selectedLog.user_agent || '—'}</div>
                            </div>
                            {selectedLog.payload_summary && (
                                <div className="p-3 rounded-xl bg-slate-950 text-emerald-300 font-mono text-[11px] overflow-x-auto">
                                    <pre>{JSON.stringify(selectedLog.payload_summary, null, 2)}</pre>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {selectedDeletedBackup && (
                <div
                    className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4"
                    onClick={() => setSelectedDeletedBackup(null)}
                >
                    <div
                        className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
                            <div>
                                <div className="text-[10px] font-bold uppercase text-emerald-400">{selectedDeletedBackup.table_name}</div>
                                <h3 className="text-sm font-extrabold">Deleted Record Snapshot: {selectedDeletedBackup.record_label}</h3>
                            </div>
                            <button type="button" onClick={() => setSelectedDeletedBackup(null)} className="p-1 text-slate-400 hover:text-white cursor-pointer">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-5 max-h-[70vh] overflow-y-auto">
                            <pre className="p-3 rounded-xl bg-slate-950 text-emerald-300 font-mono text-[11px] overflow-x-auto">
                                {(() => {
                                    try {
                                        return JSON.stringify(JSON.parse(selectedDeletedBackup.payload), null, 2);
                                    } catch {
                                        return selectedDeletedBackup.payload;
                                    }
                                })()}
                            </pre>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default SuperAdminSecurityLogsView;
