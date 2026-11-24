import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    BookOpen,
    Plus,
    Search,
    Edit2,
    Trash2,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Info,
    RefreshCw,
    X,
    Layers,
    ShieldAlert,
    Check,
    Filter,
    ChevronLeft,
    ChevronRight,
    TrendingUp,
    FileSpreadsheet,
    FileText,
} from 'lucide-react';
import { accountCodeService } from '../../services/api';

export const AccountCodesManagement = () => {

    const [accountCodes, setAccountCodes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [classFilter, setClassFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(20);
    const [paginationMeta, setPaginationMeta] = useState({
        total: 0,
        from: 0,
        to: 0,
        last_page: 1,
    });

    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingAccount, setEditingAccount] = useState(null);
    const [formData, setFormData] = useState({
        code: '',
        name: '',
        sub_code: '',
        parent_name: '',
        account_class: 'Expenses',
        is_active: true,
        display_order: 0,
    });
    const [saving, setSaving] = useState(false);
    const [modalError, setModalError] = useState('');

    const [deleteModalAccount, setDeleteModalAccount] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    const [togglingId, setTogglingId] = useState(null);

    const [feedback, setFeedback] = useState({ type: '', text: '' });

    const showFeedback = (type, text) => {
        setFeedback({ type, text });
        setTimeout(() => setFeedback({ type: '', text: '' }), 5000);
    };

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchQuery.trim());
            setCurrentPage(1);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    const fetchStats = async () => {
        try {
            const res = await accountCodeService.getStats();
            setStats(res.data);
        } catch (err) {
            console.error('Failed to load account code stats:', err);
        }
    };

    const fetchCodes = useCallback(async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        else setRefreshing(true);

        try {
            const params = {
                page: currentPage,
                per_page: perPage,
                search: debouncedSearch || undefined,
                class: classFilter !== 'ALL' ? classFilter : undefined,
                status: statusFilter !== 'ALL' ? statusFilter.toLowerCase() : undefined,
            };

            const res = await accountCodeService.getAll(params);
            const data = res.data;

            if (data && Array.isArray(data.data)) {
                setAccountCodes(data.data);
                setPaginationMeta({
                    total: data.total || 0,
                    from: data.from || 0,
                    to: data.to || 0,
                    last_page: data.last_page || 1,
                });
            } else if (Array.isArray(data)) {
                setAccountCodes(data);
            }
        } catch (err) {
            showFeedback('error', err.response?.data?.message || 'Failed to load Chart of Accounts.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [currentPage, perPage, debouncedSearch, classFilter, statusFilter]);

    useEffect(() => {
        fetchCodes();
    }, [fetchCodes]);

    useEffect(() => {
        fetchStats();
    }, []);

    const handleOpenAdd = () => {
        setEditingAccount(null);
        setFormData({
            code: '',
            name: '',
            sub_code: '',
            parent_name: '',
            account_class: 'Expenses',
            is_active: true,
            display_order: 0,
        });
        setModalError('');
        setIsFormModalOpen(true);
    };

    const handleOpenEdit = (acc) => {
        setEditingAccount(acc);
        setFormData({
            code: acc.code || '',
            name: acc.name || '',
            sub_code: acc.sub_code || '',
            parent_name: acc.parent_name || '',
            account_class: acc.account_class || 'Expenses',
            is_active: acc.is_active,
            display_order: acc.display_order || 0,
        });
        setModalError('');
        setIsFormModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setModalError('');

        if (!formData.name.trim()) {
            setModalError('Account Title / Name is required.');
            setSaving(false);
            return;
        }

        try {
            if (editingAccount) {
                await accountCodeService.update(editingAccount.id, formData);
                showFeedback('success', `Account code [${formData.code || 'Sub-Item'}] updated successfully.`);
            } else {
                await accountCodeService.create(formData);
                showFeedback('success', `Account code [${formData.code || 'Sub-Item'}] created successfully.`);
            }

            setIsFormModalOpen(false);
            fetchCodes(true);
            fetchStats();
        } catch (err) {
            const msg = err.response?.data?.message ||
                (err.response?.data?.errors ? Object.values(err.response.data.errors).flat().join(' ') : 'Failed to save account code.');
            setModalError(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStatus = async (acc) => {
        setTogglingId(acc.id);
        try {
            await accountCodeService.toggleStatus(acc.id);
            setAccountCodes(prev => prev.map(item =>
                item.id === acc.id ? { ...item, is_active: !item.is_active } : item
            ));
            fetchStats();
            showFeedback('success', `Account code ${acc.code || acc.name} status updated.`);
        } catch (err) {
            showFeedback('error', err.response?.data?.message || 'Failed to toggle status.');
        } finally {
            setTogglingId(null);
        }
    };

    const handleDelete = async () => {
        if (!deleteModalAccount) return;
        setDeleting(true);
        setDeleteError('');

        try {
            await accountCodeService.delete(deleteModalAccount.id);
            showFeedback('success', `Account code [${deleteModalAccount.code || deleteModalAccount.name}] deleted successfully.`);
            setDeleteModalAccount(null);
            fetchCodes(true);
            fetchStats();
        } catch (err) {
            setDeleteError(err.response?.data?.message || 'Failed to delete account code.');
        } finally {
            setDeleting(false);
        }
    };

    const getClassBadge = (cls) => {
        switch (cls) {
            case 'Expenses':
                return 'bg-purple-100 text-purple-800 border-purple-200';
            case 'Assets':
                return 'bg-emerald-100 text-emerald-800 border-emerald-200';
            case 'Liabilities':
                return 'bg-amber-100 text-amber-800 border-amber-200';
            case 'Income':
                return 'bg-blue-100 text-blue-800 border-blue-200';
            case 'Equity':
                return 'bg-indigo-100 text-indigo-800 border-indigo-200';
            default:
                return 'bg-slate-100 text-slate-700 border-slate-200';
        }
    };

    return (
        <div className="space-y-6">

            {feedback.text && (
                <div
                    className={`p-4 rounded-xl border flex items-center justify-between shadow-xs animate-in fade-in ${
                        feedback.type === 'success'
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-900'
                            : 'bg-rose-50 border-rose-300 text-rose-900'
                    }`}
                >
                    <div className="flex items-center gap-2 text-sm font-semibold">
                        {feedback.type === 'success' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        ) : (
                            <AlertCircle className="w-5 h-5 text-rose-600" />
                        )}
                        <span>{feedback.text}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setFeedback({ type: '', text: '' })}
                        className="text-slate-400 hover:text-slate-600"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            <div className="flex items-center justify-between flex-wrap gap-4 pb-4 border-b border-slate-200">
                <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-blue-100 text-blue-800 rounded-xl">
                            <BookOpen className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-slate-900">
                                Chart of Accounts & Account Codes
                            </h2>
                            <p className="text-xs text-slate-500">
                                Official Commission on Audit (COA) Account Codes normalized with Davao del Sur PPMP projects
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2.5">
                    <button
                        type="button"
                        onClick={() => {
                            fetchCodes(true);
                            fetchStats();
                        }}
                        disabled={refreshing}
                        className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold text-slate-700 transition shadow-2xs cursor-pointer disabled:opacity-50"
                        title="Refresh Account Codes"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
                        <span>Refresh</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleOpenAdd}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition shadow-sm cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add Account Code</span>
                    </button>
                </div>
            </div>

            {stats && (
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                        <div className="text-[11px] font-bold text-slate-500 uppercase">Total Accounts</div>
                        <div className="text-xl font-extrabold text-slate-900 mt-1 font-mono">{stats.total}</div>
                    </div>
                    <div className="p-3.5 bg-emerald-50/60 border border-emerald-200 rounded-xl shadow-2xs">
                        <div className="text-[11px] font-bold text-emerald-800 uppercase">Active</div>
                        <div className="text-xl font-extrabold text-emerald-900 mt-1 font-mono">{stats.active}</div>
                    </div>
                    <div className="p-3.5 bg-purple-50/60 border border-purple-200 rounded-xl shadow-2xs">
                        <div className="text-[11px] font-bold text-purple-800 uppercase">Expenses (5-xx)</div>
                        <div className="text-xl font-extrabold text-purple-900 mt-1 font-mono">
                            {stats.classes?.Expenses || 0}
                        </div>
                    </div>
                    <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl shadow-2xs">
                        <div className="text-[11px] font-bold text-blue-800 uppercase">Assets (1-xx)</div>
                        <div className="text-xl font-extrabold text-blue-900 mt-1 font-mono">
                            {stats.classes?.Assets || 0}
                        </div>
                    </div>
                    <div className="p-3.5 bg-amber-50/60 border border-amber-200 rounded-xl shadow-2xs">
                        <div className="text-[11px] font-bold text-amber-800 uppercase">Liabilities (2-xx)</div>
                        <div className="text-xl font-extrabold text-amber-900 mt-1 font-mono">
                            {stats.classes?.Liabilities || 0}
                        </div>
                    </div>
                    <div className="p-3.5 bg-white border border-slate-200 rounded-xl shadow-2xs">
                        <div className="text-[11px] font-bold text-slate-500 uppercase">PPMPs Linked</div>
                        <div className="text-xl font-extrabold text-blue-950 mt-1 font-mono">
                            {stats.total_ppmps_linked || 0}
                        </div>
                    </div>
                </div>
            )}

            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-2xs space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">

                    <div className="sm:col-span-6 relative">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by code (e.g. 5-02-03-220), title, or parent..."
                            className="w-full text-xs pl-9 pr-8 py-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    <div className="sm:col-span-3">
                        <select
                            value={classFilter}
                            onChange={(e) => {
                                setClassFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full text-xs py-2 px-3 border border-slate-300 rounded-xl bg-slate-50 text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                            <option value="ALL">All Account Classes</option>
                            <option value="Expenses">Expenses (5-xx)</option>
                            <option value="Assets">Assets (1-xx)</option>
                            <option value="Liabilities">Liabilities (2-xx)</option>
                            <option value="Income">Income (4-xx)</option>
                            <option value="Equity">Equity (3-xx)</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>

                    <div className="sm:col-span-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => {
                                setStatusFilter(e.target.value);
                                setCurrentPage(1);
                            }}
                            className="w-full text-xs py-2 px-3 border border-slate-300 rounded-xl bg-slate-50 text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                        >
                            <option value="ALL">All Status</option>
                            <option value="ACTIVE">Active Only</option>
                            <option value="INACTIVE">Inactive Only</option>
                        </select>
                    </div>

                    <div className="sm:col-span-1">
                        <select
                            value={perPage}
                            onChange={(e) => {
                                setPerPage(parseInt(e.target.value, 10));
                                setCurrentPage(1);
                            }}
                            className="w-full text-xs py-2 px-2 border border-slate-300 rounded-xl bg-slate-50 text-slate-800 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            title="Rows per page"
                        >
                            <option value="15">15</option>
                            <option value="20">20</option>
                            <option value="50">50</option>
                            <option value="100">100</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[11px]">
                                <th className="p-3 w-40">Code</th>
                                <th className="p-3 min-w-[280px]">Account Title / Description</th>
                                <th className="p-3 w-28">Class</th>
                                <th className="p-3 w-24 text-center">PPMP Usage</th>
                                <th className="p-3 w-24 text-center">Status</th>
                                <th className="p-3 w-32 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-slate-400">
                                        <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
                                        Loading Chart of Accounts...
                                    </td>
                                </tr>
                            ) : accountCodes.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-slate-500">
                                        <BookOpen className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                                        No account codes found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                accountCodes.map((acc) => (
                                    <tr
                                        key={acc.id}
                                        className={`hover:bg-blue-50/30 transition ${!acc.is_active ? 'opacity-60 bg-slate-50/50' : ''}`}
                                    >
                                        <td className="p-3 align-top">
                                            {acc.code ? (
                                                <span className="font-mono font-extrabold text-blue-900 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                                    {acc.code}
                                                </span>
                                            ) : (
                                                <span className="text-[10px] text-slate-400 font-mono bg-slate-100 px-1.5 py-0.5 rounded">
                                                    (No Code)
                                                </span>
                                            )}
                                            {acc.sub_code && (
                                                <span className="block mt-1 font-mono text-[10px] font-bold text-amber-800">
                                                    Sub: {acc.sub_code}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3 align-top space-y-0.5">
                                            <div className="font-bold text-slate-900 leading-snug">
                                                {acc.name}
                                            </div>
                                            {acc.parent_name && acc.parent_name !== acc.name && (
                                                <div className="text-[11px] text-slate-500 italic">
                                                    Parent: {acc.parent_name}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3 align-top">
                                            <span className={`inline-block text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded border ${getClassBadge(acc.account_class)}`}>
                                                {acc.account_class || 'Other'}
                                            </span>
                                        </td>
                                        <td className="p-3 align-top text-center">
                                            {acc.ppmps_count > 0 ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200" title={`Linked to ${acc.ppmps_count} PPMP records`}>
                                                    {acc.ppmps_count} PPMP{acc.ppmps_count !== 1 ? 's' : ''}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 text-[11px]">—</span>
                                            )}
                                        </td>
                                        <td className="p-3 align-top text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleStatus(acc)}
                                                disabled={togglingId === acc.id}
                                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold transition cursor-pointer ${
                                                    acc.is_active
                                                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border border-emerald-300'
                                                        : 'bg-slate-200 text-slate-600 hover:bg-slate-300 border border-slate-300'
                                                }`}
                                                title="Click to toggle Active / Inactive"
                                            >
                                                {acc.is_active ? 'Active' : 'Inactive'}
                                            </button>
                                        </td>
                                        <td className="p-3 align-top text-right space-x-1.5 whitespace-nowrap">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenEdit(acc)}
                                                className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                                title="Edit Account Code"
                                            >
                                                <Edit2 className="w-3.5 h-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setDeleteModalAccount(acc);
                                                    setDeleteError('');
                                                }}
                                                className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                                title="Delete Account Code"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2 text-xs text-slate-600">
                    <div>
                        Showing <span className="font-bold text-slate-900">{paginationMeta.from || 0}</span> to{' '}
                        <span className="font-bold text-slate-900">{paginationMeta.to || 0}</span> of{' '}
                        <span className="font-bold text-slate-900">{paginationMeta.total}</span> entries
                    </div>

                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            disabled={currentPage <= 1 || loading}
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                            title="Previous Page"
                        >
                            <ChevronLeft className="w-4 h-4" />
                        </button>

                        <span className="px-3 py-1 font-semibold text-slate-800">
                            Page {currentPage} of {paginationMeta.last_page}
                        </span>

                        <button
                            type="button"
                            disabled={currentPage >= paginationMeta.last_page || loading}
                            onClick={() => setCurrentPage(prev => Math.min(paginationMeta.last_page, prev + 1))}
                            className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer"
                            title="Next Page"
                        >
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {isFormModalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden my-8">
                        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
                            <div className="flex items-center gap-2">
                                <BookOpen className="w-5 h-5 text-blue-600" />
                                <h3 className="font-bold text-slate-900 text-sm">
                                    {editingAccount ? 'Edit Account Code' : 'Add New Account Code'}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsFormModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-5 space-y-4 text-xs">
                            {modalError && (
                                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs font-medium flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                                    <span>{modalError}</span>
                                </div>
                            )}

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Account Code (e.g. 5-02-03-220)
                                </label>
                                <input
                                    type="text"
                                    value={formData.code}
                                    onChange={(e) => setFormData(prev => ({ ...prev, code: e.target.value }))}
                                    placeholder="5-02-03-220"
                                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono font-bold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <span className="text-[10px] text-slate-400">Leave blank if this is an unnumbered subsidiary ledger sub-item.</span>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Account Title / Name <span className="text-rose-500">*</span>
                                </label>
                                <textarea
                                    rows={2}
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                                    placeholder="Semi-Expendable Furnitures, Fixtures & Books Expenses"
                                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-y"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Account Classification
                                    </label>
                                    <select
                                        value={formData.account_class}
                                        onChange={(e) => setFormData(prev => ({ ...prev, account_class: e.target.value }))}
                                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                                    >
                                        <option value="Expenses">Expenses (5-xx)</option>
                                        <option value="Assets">Assets (1-xx)</option>
                                        <option value="Liabilities">Liabilities (2-xx)</option>
                                        <option value="Income">Income (4-xx)</option>
                                        <option value="Equity">Equity (3-xx)</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block font-bold text-slate-700 mb-1">
                                        Sub-Code (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.sub_code}
                                        onChange={(e) => setFormData(prev => ({ ...prev, sub_code: e.target.value }))}
                                        placeholder="-02 or -0001"
                                        className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs font-mono focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block font-bold text-slate-700 mb-1">
                                    Parent / Main Account Title (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={formData.parent_name}
                                    onChange={(e) => setFormData(prev => ({ ...prev, parent_name: e.target.value }))}
                                    placeholder="Machinery and Equipment"
                                    className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl text-xs focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                                <div>
                                    <div className="font-bold text-slate-800 text-xs">Active Status</div>
                                    <div className="text-[11px] text-slate-500">Available for selection in PPMP create/edit forms</div>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                                        className="sr-only peer"
                                    />
                                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                </label>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsFormModalOpen(false)}
                                    className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition shadow-sm cursor-pointer disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : (editingAccount ? 'Update Account Code' : 'Save Account Code')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {deleteModalAccount && (
                <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden p-6 space-y-4">
                        <div className="flex items-center gap-3 text-rose-600">
                            <div className="p-3 bg-rose-100 rounded-xl">
                                <Trash2 className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-bold text-slate-900 text-base">Delete Account Code</h3>
                                <p className="text-xs text-slate-500">Confirm permanent deletion from Chart of Accounts</p>
                            </div>
                        </div>

                        {deleteError ? (
                            <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs font-medium">
                                {deleteError}
                            </div>
                        ) : deleteModalAccount.ppmps_count > 0 ? (
                            <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs space-y-1">
                                <div className="font-bold flex items-center gap-1.5">
                                    <AlertCircle className="w-4 h-4 text-amber-700 shrink-0" />
                                    <span>Active PPMP Links Detected</span>
                                </div>
                                <p>
                                    This account code is currently linked to <strong>{deleteModalAccount.ppmps_count} PPMP record(s)</strong>.
                                    Database integrity prevents deleting it while PPMPs reference it.
                                </p>
                                <p className="text-[11px] text-amber-800 font-semibold">
                                    Recommendation: Deactivate it instead so it is hidden from new PPMP forms.
                                </p>
                            </div>
                        ) : (
                            <p className="text-xs text-slate-600">
                                Are you sure you want to delete account code{' '}
                                <strong className="text-slate-900">[{deleteModalAccount.code || 'Sub-Item'}] {deleteModalAccount.name}</strong>?
                                This action cannot be undone.
                            </p>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeleteModalAccount(null)}
                                className="px-4 py-2 border border-slate-300 rounded-xl font-bold text-slate-700 hover:bg-slate-50 transition cursor-pointer text-xs"
                            >
                                Close
                            </button>
                            {deleteModalAccount.ppmps_count === 0 && (
                                <button
                                    type="button"
                                    disabled={deleting}
                                    onClick={handleDelete}
                                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition shadow-sm cursor-pointer text-xs disabled:opacity-50"
                                >
                                    {deleting ? 'Deleting...' : 'Confirm Delete'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
