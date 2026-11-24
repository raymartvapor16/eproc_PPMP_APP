import React, { useState, useEffect, useMemo } from 'react';
import {
    ShieldCheck,
    Search,
    RefreshCw,
    FileText,
    Calendar,
    Clock,
    AlertTriangle,
    CheckCircle2,
    History,
    Building2,
    PenTool,
    ChevronDown,
    ChevronUp,
    UserCheck,
} from 'lucide-react';
import { pnpkiService } from '../../services/api';
import { UserSignatureModal } from '../../components/Dashboard/UserSignatureModal';
import { formatDate } from '../../components/UI/StatusBadge';

export const PnpkiRegistryPage = ({ user }) => {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [search, setSearch] = useState('');
    const [filterStatus, setFilterStatus] = useState('all');
    const [expandedHistoryIds, setExpandedHistoryIds] = useState({});
    const [selectedManageUser, setSelectedManageUser] = useState(null);

    const isSuperAdmin = user?.role === 'super_admin';
    const isAdminOrSuperAdmin = user?.role === 'super_admin' || user?.role === 'admin';

    const fetchRegistry = async () => {
        setLoading(true);
        setError('');
        try {
            const res = await pnpkiService.getAll();
            setRecords(res.data?.pnpki_signatures || []);
        } catch (err) {
            console.error('Failed to load PNPKI registry:', err);
            setError(err.response?.data?.message || 'Failed to load registered PNPKI signatures.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRegistry();
        const handleReload = () => fetchRegistry();
        window.addEventListener('app:data_reload', handleReload);
        window.addEventListener('notifications:reload', handleReload);
        return () => {
            window.removeEventListener('app:data_reload', handleReload);
            window.removeEventListener('notifications:reload', handleReload);
        };
    }, []);

    const counts = useMemo(() => {
        return {
            all: records.length,
            active: records.filter((r) => r.effective_signature_type === 'pnpki').length,
            expiring: records.filter((r) => r.effective_signature_type === 'pnpki' && r.is_expiring_soon).length,
            expired: records.filter((r) => r.is_expired).length,
            pending: records.filter((r) => r.is_renewal_pending || r.renewal_status === 'pending').length,
            history: records.filter(
                (r) =>
                    Boolean(r.previous_expiration_date) ||
                    (Array.isArray(r.renewal_history) && r.renewal_history.length > 0)
            ).length,
        };
    }, [records]);

    const filteredRecords = useMemo(() => {
        return records.filter((r) => {
            if (filterStatus === 'active' && r.effective_signature_type !== 'pnpki') {
                return false;
            }
            if (filterStatus === 'expiring' && !(r.effective_signature_type === 'pnpki' && r.is_expiring_soon)) {
                return false;
            }
            if (filterStatus === 'expired' && !r.is_expired) {
                return false;
            }
            if (filterStatus === 'pending' && !(r.is_renewal_pending || r.renewal_status === 'pending')) {
                return false;
            }
            if (
                filterStatus === 'history' &&
                !r.previous_expiration_date &&
                !(Array.isArray(r.renewal_history) && r.renewal_history.length > 0)
            ) {
                return false;
            }

            if (search.trim()) {
                const q = search.toLowerCase();
                const matchName = r.user?.name?.toLowerCase().includes(q);
                const matchEmail = r.user?.email?.toLowerCase().includes(q);
                const matchDesignation = r.user?.designation?.toLowerCase().includes(q);
                const matchOffice = r.user?.office?.name?.toLowerCase().includes(q);
                const matchCode = r.user?.office?.code?.toLowerCase().includes(q);
                return matchName || matchEmail || matchDesignation || matchOffice || matchCode;
            }

            return true;
        });
    }, [records, filterStatus, search]);

    const toggleHistory = (id) => {
        setExpandedHistoryIds((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    const getOldCertificates = (record) => {
        const list = [];
        if (Array.isArray(record.renewal_history) && record.renewal_history.length > 0) {
            record.renewal_history.forEach((entry, idx) => {
                if (entry.expiration_date || entry.proof_pdf_url || entry.proof_original_name) {
                    list.push({
                        key: `hist-${idx}`,
                        expirationDate: entry.expiration_date,
                        proofName: entry.proof_original_name || 'Old PNPKI Proof PDF',
                        proofUrl: entry.proof_pdf_url,
                        archivedAt: entry.archived_at,
                    });
                }
            });
        } else if (record.previous_expiration_date || record.previous_proof_pdf_url) {
            list.push({
                key: 'prev-0',
                expirationDate: record.previous_expiration_date,
                proofName: record.previous_proof_original_name || 'Previous PNPKI Proof PDF',
                proofUrl: record.previous_proof_pdf_url,
                archivedAt: null,
            });
        }
        return list;
    };

    return (
        <div className="space-y-6">

            <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 rounded-2xl p-5 sm:p-6 text-white shadow-md border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start sm:items-center gap-3.5">
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300 shrink-0">
                        <ShieldCheck className="w-6 h-6" />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-lg sm:text-xl font-black tracking-tight text-white">
                                {isAdminOrSuperAdmin ? 'PNPKI Digital E-Signature Registry' : 'My PNPKI Digital E-Signature'}
                            </h1>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-200 border border-emerald-400/30">
                                All Old &amp; New Certificates
                            </span>
                        </div>
                        <p className="text-xs text-slate-300 mt-1 max-w-2xl leading-relaxed">
                            {isAdminOrSuperAdmin
                                ? 'Confidential directory of registered DICT PNPKI Digital E-Signatures across provincial offices, including active certificates, pending renewals, expired certificates, and preserved historical registrations.'
                                : 'Confidential view of your registered DICT PNPKI Digital E-Signature, including your active certificate, pending renewal status, and preserved old certificates.'}
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={fetchRegistry}
                    disabled={loading}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer self-start sm:self-auto shrink-0 disabled:opacity-50"
                >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    <span>Refresh</span>
                </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
                <button
                    type="button"
                    onClick={() => setFilterStatus('all')}
                    className={`bg-white p-4 rounded-xl border text-left transition shadow-xs cursor-pointer ${
                        filterStatus === 'all' ? 'border-blue-500 ring-2 ring-blue-500/20' : 'border-slate-200 hover:border-slate-300'
                    }`}
                >
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Registered</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">{counts.all}</div>
                </button>

                <button
                    type="button"
                    onClick={() => setFilterStatus('active')}
                    className={`bg-white p-4 rounded-xl border text-left transition shadow-xs cursor-pointer ${
                        filterStatus === 'active' ? 'border-emerald-500 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:border-emerald-300'
                    }`}
                >
                    <div className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Active PNPKI</div>
                    <div className="text-2xl font-black text-emerald-900 mt-1">{counts.active}</div>
                </button>

                <button
                    type="button"
                    onClick={() => setFilterStatus('expiring')}
                    className={`bg-white p-4 rounded-xl border text-left transition shadow-xs cursor-pointer ${
                        filterStatus === 'expiring' ? 'border-amber-500 ring-2 ring-amber-500/20' : 'border-slate-200 hover:border-amber-300'
                    }`}
                >
                    <div className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Expiring Soon</div>
                    <div className="text-2xl font-black text-amber-900 mt-1">{counts.expiring}</div>
                </button>

                <button
                    type="button"
                    onClick={() => setFilterStatus('expired')}
                    className={`bg-white p-4 rounded-xl border text-left transition shadow-xs cursor-pointer ${
                        filterStatus === 'expired' ? 'border-rose-500 ring-2 ring-rose-500/20' : 'border-slate-200 hover:border-rose-300'
                    }`}
                >
                    <div className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Expired</div>
                    <div className="text-2xl font-black text-rose-900 mt-1">{counts.expired}</div>
                </button>

                <button
                    type="button"
                    onClick={() => setFilterStatus('pending')}
                    className={`col-span-2 sm:col-span-1 bg-white p-4 rounded-xl border text-left transition shadow-xs cursor-pointer ${
                        filterStatus === 'pending' ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-slate-200 hover:border-indigo-300'
                    }`}
                >
                    <div className="text-[11px] font-bold text-indigo-700 uppercase tracking-wider">Pending Approval</div>
                    <div className="text-2xl font-black text-indigo-900 mt-1">{counts.pending}</div>
                </button>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-4 flex flex-col lg:flex-row gap-3 lg:items-center justify-between">
                <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg text-xs font-semibold overflow-x-auto">
                    {[
                        { key: 'all', label: `All (${counts.all})` },
                        { key: 'active', label: `Active (${counts.active})` },
                        { key: 'expiring', label: `Expiring Soon (${counts.expiring})` },
                        { key: 'expired', label: `Expired (${counts.expired})` },
                        { key: 'pending', label: `Pending Approval (${counts.pending})` },
                        { key: 'history', label: `With Old History (${counts.history})` },
                    ].map((tab) => (
                        <button
                            key={tab.key}
                            type="button"
                            onClick={() => setFilterStatus(tab.key)}
                            className={`px-3 py-1.5 rounded-md transition shrink-0 cursor-pointer ${
                                filterStatus === tab.key
                                    ? 'bg-white text-slate-900 shadow-2xs font-bold'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="relative w-full lg:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search user, office, designation..."
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
                    />
                </div>
            </div>

            {error && (
                <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
                        <RefreshCw className="w-6 h-6 animate-spin text-emerald-600" />
                        <span>Loading PNPKI Digital E-Signature registry...</span>
                    </div>
                ) : filteredRecords.length === 0 ? (
                    <div className="p-12 text-center text-xs text-slate-400 italic">
                        No registered PNPKI Digital E-Signatures match your search or filter.
                    </div>
                ) : (
                    <div className="divide-y divide-slate-100">
                        {filteredRecords.map((record) => {
                            const oldCerts = getOldCertificates(record);
                            const isExpanded = Boolean(expandedHistoryIds[record.id]);
                            const isSelf = record.user_id === user?.id;

                            return (
                                <div key={record.id} className="p-4 sm:p-5 hover:bg-slate-50/70 transition space-y-3">
                                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">

                                        <div className="flex items-start gap-3 min-w-0">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                                                record.is_expired
                                                    ? 'bg-rose-50 border-rose-200 text-rose-600'
                                                    : record.is_expiring_soon
                                                        ? 'bg-amber-50 border-amber-200 text-amber-600'
                                                        : 'bg-emerald-50 border-emerald-200 text-emerald-600'
                                            }`}>
                                                <ShieldCheck className="w-5 h-5" />
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-sm font-extrabold text-slate-900">
                                                        {record.user?.name}
                                                    </span>
                                                    {isSelf && (
                                                        <span className="px-1.5 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                                                            You
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200 uppercase font-bold">
                                                        {record.user?.role?.replace(/_/g, ' ')}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-600 mt-0.5">
                                                    {record.user?.designation || 'Official Signatory'} &bull;{' '}
                                                    <span className="font-mono text-[11px] text-slate-500">{record.user?.email}</span>
                                                </div>
                                                <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                                                    <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                                    <span>
                                                        {record.user?.office?.name || 'Provincial Capitol'}
                                                        {record.user?.office?.code ? ` (${record.user.office.code})` : ''}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-wrap">

                                            {record.is_expired ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
                                                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                                                    Expired (Forced Optional)
                                                </span>
                                            ) : record.is_expiring_soon ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                                                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                                                    Expiring in {record.days_until_expiration} day{record.days_until_expiration === 1 ? '' : 's'}
                                                </span>
                                            ) : record.effective_signature_type === 'pnpki' ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                                    Active PNPKI E-Sig
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-200">
                                                    Optional Mode (PNPKI on File)
                                                </span>
                                            )}

                                            {record.is_renewal_pending && (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-50 text-amber-900 border border-amber-300 animate-pulse">
                                                    <Clock className="w-3.5 h-3.5 text-amber-600" />
                                                    Renewal Pending Super Admin Approval
                                                </span>
                                            )}

                                            {isSelf && (record.is_expired || record.is_expiring_soon) && !record.is_renewal_pending && (
                                                <button
                                                    type="button"
                                                    onClick={() =>
                                                        window.dispatchEvent(
                                                            new CustomEvent('pnpki:open_renewal_modal', {
                                                                detail: { mode: 'renew' },
                                                            })
                                                        )
                                                    }
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition cursor-pointer shadow-2xs"
                                                >
                                                    <RefreshCw className="w-3.5 h-3.5" />
                                                    <span>Renew My PNPKI</span>
                                                </button>
                                            )}

                                            {isSuperAdmin && (
                                                <button
                                                    type="button"
                                                    onClick={() => setSelectedManageUser(record.user)}
                                                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer shadow-2xs ${
                                                        record.is_renewal_pending
                                                            ? 'bg-amber-600 hover:bg-amber-700 text-white'
                                                            : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200'
                                                    }`}
                                                >
                                                    {record.is_renewal_pending ? (
                                                        <>
                                                            <UserCheck className="w-3.5 h-3.5" />
                                                            <span>Review &amp; Approve</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <PenTool className="w-3.5 h-3.5" />
                                                            <span>Manage</span>
                                                        </>
                                                    )}
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">

                                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                                            <div className="space-y-0.5">
                                                <div className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                                                    {record.renewal_count > 0 ? 'Current / Renewed Certificate' : 'Registered PNPKI Certificate'}
                                                </div>
                                                <div className="flex items-center gap-1.5 text-slate-700">
                                                    <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                    <span>
                                                        Expiration:{' '}
                                                        <strong className={record.is_expired ? 'text-rose-700' : 'text-slate-900'}>
                                                            {record.expiration_date || '—'}
                                                        </strong>
                                                    </span>
                                                </div>
                                            </div>
                                            {record.proof_pdf_url && (
                                                <a
                                                    href={record.proof_pdf_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 text-emerald-800 border border-emerald-300 text-[11px] font-bold underline underline-offset-2 transition"
                                                >
                                                    <FileText className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                                    <span className="truncate max-w-[160px]">
                                                        {record.proof_original_name || 'View Proof PDF'}
                                                    </span>
                                                </a>
                                            )}
                                        </div>

                                        {record.is_renewal_pending ? (
                                            <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-300 flex flex-wrap items-center justify-between gap-2 text-xs">
                                                <div className="space-y-0.5">
                                                    <div className="text-[10px] font-black uppercase tracking-wider text-amber-800">
                                                        New Renewal Submitted (Pending Approval)
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-amber-950">
                                                        <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                                        <span>
                                                            Requested Expiration:{' '}
                                                            <strong>{record.pending_expiration_date}</strong>
                                                        </span>
                                                    </div>
                                                </div>
                                                {record.pending_proof_pdf_url && (
                                                    <a
                                                        href={record.pending_proof_pdf_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-amber-100 text-amber-900 border border-amber-300 text-[11px] font-bold underline underline-offset-2 transition"
                                                    >
                                                        <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                                                        <span className="truncate max-w-[160px]">
                                                            {record.pending_proof_original_name || 'View Submitted PDF'}
                                                        </span>
                                                    </a>
                                                )}
                                            </div>
                                        ) : oldCerts.length > 0 ? (
                                            <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                                                <div className="space-y-0.5">
                                                    <div className="text-[10px] font-black uppercase tracking-wider text-indigo-800 flex items-center gap-1">
                                                        <History className="w-3 h-3" />
                                                        <span>Old / Previous Certificate Preserved ({oldCerts.length})</span>
                                                    </div>
                                                    <div className="text-slate-700">
                                                        Previous Expiration:{' '}
                                                        <strong className="text-slate-900">{oldCerts[0].expirationDate || '—'}</strong>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    {oldCerts[0].proofUrl && (
                                                        <a
                                                            href={oldCerts[0].proofUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-indigo-50 text-indigo-800 border border-indigo-300 text-[11px] font-bold underline underline-offset-2 transition"
                                                        >
                                                            <FileText className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                                            <span>View Old PDF</span>
                                                        </a>
                                                    )}
                                                    {oldCerts.length > 1 && (
                                                        <button
                                                            type="button"
                                                            onClick={() => toggleHistory(record.id)}
                                                            className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-indigo-200 text-[11px] font-bold text-indigo-700 hover:bg-indigo-50 cursor-pointer"
                                                        >
                                                            <span>All ({oldCerts.length})</span>
                                                            {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="p-3 rounded-xl bg-slate-50/60 border border-dashed border-slate-200 flex items-center text-[11px] text-slate-400 italic">
                                                No previous / old PNPKI renewal history yet.
                                            </div>
                                        )}
                                    </div>

                                    {(isExpanded || (record.is_renewal_pending && oldCerts.length > 0)) && oldCerts.length > 0 && (
                                        <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                                            <div className="text-[10px] font-black uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                                                <History className="w-3.5 h-3.5 text-indigo-600" />
                                                <span>Preserved Old PNPKI Certificates ({oldCerts.length})</span>
                                            </div>
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                                                {oldCerts.map((oldItem, i) => (
                                                    <div
                                                        key={oldItem.key}
                                                        className="p-2.5 rounded-lg bg-white border border-slate-200 flex items-center justify-between gap-2 text-[11px]"
                                                    >
                                                        <div className="min-w-0">
                                                            <div className="font-bold text-slate-800">
                                                                #{oldCerts.length - i} &bull; Exp: {oldItem.expirationDate || '—'}
                                                            </div>
                                                            {oldItem.archivedAt && (
                                                                <div className="text-[10px] text-slate-400">
                                                                    Archived {formatDate(oldItem.archivedAt)}
                                                                </div>
                                                            )}
                                                        </div>
                                                        {oldItem.proofUrl && (
                                                            <a
                                                                href={oldItem.proofUrl}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[10px] font-bold shrink-0"
                                                            >
                                                                <FileText className="w-3 h-3" />
                                                                <span>PDF</span>
                                                            </a>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <UserSignatureModal
                user={selectedManageUser}
                isOpen={Boolean(selectedManageUser)}
                onClose={() => setSelectedManageUser(null)}
                currentUserRole={user?.role}
                onUpdated={() => {
                    setSelectedManageUser(null);
                    fetchRegistry();
                    window.dispatchEvent(new CustomEvent('notifications:reload'));
                }}
            />
        </div>
    );
};

export default PnpkiRegistryPage;
