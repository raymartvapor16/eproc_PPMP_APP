import React, { useState, useEffect, useMemo } from 'react';
import {
    Shield,
    Plus,
    Search,
    Edit3,
    Trash2,
    CheckCircle2,
    X,
    Loader2,
    FileText,
    FileSpreadsheet,
    Layers,
    Check,
} from 'lucide-react';
import { signatoryService } from '../../services/api';
import { SignatureControllerManagement } from './SignatureControllerManagement';

const SIGNATORY_TYPE_CONFIG = {
    // PPMP Signatories
    budget_requirement: {
        label: 'Reviewed as to Budgetary Requirement (PBO)',
        shortLabel: 'Budgetary Requirement (PBO)',
        scope: 'PPMP',
        defaultName: 'DESSAMIE BUAT-SANCHEZ, CPA, JD',
        defaultPosition: 'PGDH - PBO / BAC - Chairman',
        color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    },
    pacco_requirement: {
        label: 'Reviewed as to Budgetary Requirement (PACCO)',
        shortLabel: 'Budgetary Requirement (PACCO)',
        scope: 'PPMP',
        defaultName: 'MAY FERNANDO-UY, CPA',
        defaultPosition: 'Provincial Accountant',
        color: 'bg-teal-100 text-teal-800 border-teal-200',
    },
    bac_secretariat: {
        label: 'Reviewed by OPPMO - BAC Secretariat',
        shortLabel: 'BAC Secretariat Review',
        scope: 'PPMP',
        defaultName: 'NORJANNA M. CAMAGUIN, MPA',
        defaultPosition: 'PGDH - OPPMO',
        color: 'bg-purple-100 text-purple-800 border-purple-200',
    },
    approved_by: {
        label: 'Approved by: (Governor)',
        shortLabel: 'Governor Approval',
        scope: 'PPMP',
        defaultName: 'HON. YVONNE R. CAGAS',
        defaultPosition: 'Provincial Governor',
        color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    },

    // APP Signatories
    app_prepared_by: {
        label: 'APP: Prepared by',
        shortLabel: 'APP Prepared by',
        scope: 'APP',
        defaultName: 'GINA MAE B. CARBAQUEL',
        defaultPosition: 'ADAS II',
        color: 'bg-blue-100 text-blue-800 border-blue-200',
    },
    app_reviewed_by: {
        label: 'APP: Reviewed by (OPPMO)',
        shortLabel: 'APP Reviewed by',
        scope: 'APP',
        defaultName: 'NORJANNA M. CAMAGUIN, MPA',
        defaultPosition: 'PGDH - OPPMO',
        color: 'bg-violet-100 text-violet-800 border-violet-200',
    },
    app_recommending: {
        label: 'APP: Recommending Approval',
        shortLabel: 'APP Recommending Approval',
        scope: 'APP',
        defaultName: 'DESSAMIE BUAT-SANCHEZ, CPA, JD',
        defaultPosition: 'PGDH - PBO / BAC - Chairman',
        color: 'bg-amber-100 text-amber-800 border-amber-200',
    },
    app_approved_by: {
        label: 'APP: Approved by: (Governor)',
        shortLabel: 'APP Governor Approval',
        scope: 'APP',
        defaultName: 'HON. YVONNE R. CAGAS',
        defaultPosition: 'Provincial Governor',
        color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    },
};

export const SignatoriesManagement = ({ initialSignatories = [], onReload = null }) => {
    const [signatoriesList, setSignatoriesList] = useState(initialSignatories || []);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [scopeFilter, setScopeFilter] = useState('ALL'); // 'ALL' | 'PPMP' | 'APP'
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(10);

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSignatory, setEditingSignatory] = useState(null);
    const [selectedDocScope, setSelectedDocScope] = useState('APP'); // 'PPMP' | 'APP'
    const [formData, setFormData] = useState({
        signatory_type: 'app_prepared_by',
        name: '',
        position: '',
        is_active: true,
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const refreshSignatories = async () => {
        setLoading(true);
        try {
            const res = await signatoryService.getAll();
            setSignatoriesList(res.data);
            if (onReload) onReload();
        } catch (err) {
            console.error('Failed to load signatories:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (initialSignatories && initialSignatories.length > 0) {
            setSignatoriesList(initialSignatories);
        } else {
            refreshSignatories();
        }
    }, [initialSignatories]);

    // Counts
    const counts = useMemo(() => {
        const ppmpCount = signatoriesList.filter(
            (s) => (SIGNATORY_TYPE_CONFIG[s.signatory_type]?.scope || 'PPMP') === 'PPMP'
        ).length;
        const appCount = signatoriesList.filter(
            (s) => SIGNATORY_TYPE_CONFIG[s.signatory_type]?.scope === 'APP'
        ).length;
        return { all: signatoriesList.length, ppmp: ppmpCount, app: appCount };
    }, [signatoriesList]);

    // Filtered list
    const filteredList = useMemo(() => {
        return signatoriesList.filter((sig) => {
            const config = SIGNATORY_TYPE_CONFIG[sig.signatory_type];
            const scope = config?.scope || 'PPMP';

            if (scopeFilter !== 'ALL' && scope !== scopeFilter) {
                return false;
            }

            if (search.trim()) {
                const q = search.toLowerCase();
                const matchName = sig.name?.toLowerCase().includes(q);
                const matchPos = sig.position?.toLowerCase().includes(q);
                const matchRole = config?.label?.toLowerCase().includes(q);
                return matchName || matchPos || matchRole;
            }

            return true;
        });
    }, [signatoriesList, scopeFilter, search]);

    const paginatedList = useMemo(() => {
        const start = (page - 1) * perPage;
        return filteredList.slice(start, start + perPage);
    }, [filteredList, page, perPage]);

    const totalPages = Math.ceil(filteredList.length / perPage) || 1;

    const openCreateModal = (defaultScope = 'APP') => {
        setEditingSignatory(null);
        setSelectedDocScope(defaultScope);
        const defaultType = defaultScope === 'APP' ? 'app_prepared_by' : 'budget_requirement';
        const defaultConfig = SIGNATORY_TYPE_CONFIG[defaultType];
        setFormData({
            signatory_type: defaultType,
            name: defaultConfig?.defaultName || '',
            position: defaultConfig?.defaultPosition || '',
            is_active: true,
        });
        setError('');
        setIsModalOpen(true);
    };

    const openEditModal = (sig) => {
        setEditingSignatory(sig);
        const config = SIGNATORY_TYPE_CONFIG[sig.signatory_type];
        setSelectedDocScope(config?.scope || 'PPMP');
        setFormData({
            signatory_type: sig.signatory_type,
            name: sig.name || '',
            position: sig.position || '',
            is_active: Boolean(sig.is_active),
        });
        setError('');
        setIsModalOpen(true);
    };

    const handleScopeChangeInModal = (newScope) => {
        setSelectedDocScope(newScope);
        const defaultType = newScope === 'APP' ? 'app_prepared_by' : 'budget_requirement';
        const defaultConfig = SIGNATORY_TYPE_CONFIG[defaultType];
        setFormData((prev) => ({
            ...prev,
            signatory_type: defaultType,
            name: prev.name ? prev.name : (defaultConfig?.defaultName || ''),
            position: prev.position ? prev.position : (defaultConfig?.defaultPosition || ''),
        }));
    };

    const handleTypeChangeInModal = (newType) => {
        const defaultConfig = SIGNATORY_TYPE_CONFIG[newType];
        setFormData((prev) => ({
            ...prev,
            signatory_type: newType,
            name: (!prev.name || Object.values(SIGNATORY_TYPE_CONFIG).some(c => c.defaultName === prev.name))
                ? (defaultConfig?.defaultName || prev.name)
                : prev.name,
            position: (!prev.position || Object.values(SIGNATORY_TYPE_CONFIG).some(c => c.defaultPosition === prev.position))
                ? (defaultConfig?.defaultPosition || prev.position)
                : prev.position,
        }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setError('');
        if (!formData.name.trim()) {
            setError('Official full name is required.');
            return;
        }
        if (!formData.position.trim()) {
            setError('Official position / designation is required.');
            return;
        }

        setSaving(true);
        try {
            if (editingSignatory) {
                await signatoryService.update(editingSignatory.id, formData);
                setSuccessMessage(`Signatory "${formData.name}" updated successfully.`);
            } else {
                await signatoryService.create(formData);
                setSuccessMessage(`New signatory "${formData.name}" created successfully.`);
            }
            setIsModalOpen(false);
            await refreshSignatories();
            setTimeout(() => setSuccessMessage(''), 4000);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save signatory.');
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (sig) => {
        try {
            await signatoryService.update(sig.id, {
                name: sig.name,
                position: sig.position,
                is_active: true,
            });
            await refreshSignatories();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to set active signatory.');
        }
    };

    const handleDelete = async (sig) => {
        const config = SIGNATORY_TYPE_CONFIG[sig.signatory_type];
        if (!confirm(`Are you sure you want to remove the signatory "${sig.name}" for ${config?.label || sig.signatory_type}?`)) {
            return;
        }
        try {
            await signatoryService.delete(sig.id);
            await refreshSignatories();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete signatory.');
        }
    };

    return (
        <div className="space-y-6">
            {/* Signature Insertion Controller */}
            <SignatureControllerManagement />

            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                {/* Header */}
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-gradient-to-r from-slate-50 via-white to-slate-50">
                <div>
                    <h2 className="text-base font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                        <Shield className="w-5 h-5 text-blue-600" />
                        Official Signatories Configuration
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        Configure official names &amp; designations for both <strong>PPMP</strong> (Project Procurement Management Plan) and <strong>APP</strong> (Annual Procurement Plan) review &amp; approval boxes.
                    </p>
                </div>
                <div className="flex items-center gap-2 self-start md:self-auto">
                    <button
                        type="button"
                        onClick={() => openCreateModal('APP')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-2xs cursor-pointer"
                        title="Add an Annual Procurement Plan signatory"
                    >
                        <Plus className="w-4 h-4" />
                        Add APP Signatory
                    </button>
                    <button
                        type="button"
                        onClick={() => openCreateModal('PPMP')}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-2xs cursor-pointer"
                        title="Add a PPMP document signatory"
                    >
                        <Plus className="w-4 h-4" />
                        Add PPMP Signatory
                    </button>
                </div>
            </div>

            {/* Success Banner */}
            {successMessage && (
                <div className="mx-6 mt-4 p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-800 text-xs font-semibold flex items-center justify-between animate-in fade-in">
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <span>{successMessage}</span>
                    </div>
                    <button onClick={() => setSuccessMessage('')} className="text-emerald-700 hover:text-emerald-900">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Filter Tabs & Search Bar */}
            <div className="p-4 bg-slate-50/70 border-b border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Scope Filters */}
                <div className="flex items-center gap-1.5 bg-slate-200/70 p-1 rounded-lg">
                    <button
                        type="button"
                        onClick={() => { setScopeFilter('ALL'); setPage(1); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                            scopeFilter === 'ALL'
                                ? 'bg-white text-slate-900 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <Layers className="w-3.5 h-3.5" />
                        <span>All</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-slate-200 text-slate-700">
                            {counts.all}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => { setScopeFilter('APP'); setPage(1); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                            scopeFilter === 'APP'
                                ? 'bg-white text-emerald-700 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <FileText className="w-3.5 h-3.5 text-emerald-600" />
                        <span>APP Signatories</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-emerald-100 text-emerald-800 font-bold">
                            {counts.app}
                        </span>
                    </button>
                    <button
                        type="button"
                        onClick={() => { setScopeFilter('PPMP'); setPage(1); }}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-bold transition cursor-pointer ${
                            scopeFilter === 'PPMP'
                                ? 'bg-white text-blue-700 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                        }`}
                    >
                        <FileSpreadsheet className="w-3.5 h-3.5 text-blue-600" />
                        <span>PPMP Signatories</span>
                        <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-blue-100 text-blue-800 font-bold">
                            {counts.ppmp}
                        </span>
                    </button>
                </div>

                {/* Search Input */}
                <div className="relative w-full sm:w-72">
                    <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input
                        type="text"
                        placeholder="Search name, designation, or box..."
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                        className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    />
                    {search && (
                        <button
                            onClick={() => setSearch('')}
                            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>
            </div>

            {/* Table */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200 tracking-wider text-[11px]">
                        <tr>
                            <th className="p-3.5">Document Scope</th>
                            <th className="p-3.5">Signatory Box / Role</th>
                            <th className="p-3.5">Official Full Name</th>
                            <th className="p-3.5">Position / Designation</th>
                            <th className="p-3.5">Active Status</th>
                            <th className="p-3.5 text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {loading && signatoriesList.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-slate-500">
                                    <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-600" />
                                    <span>Loading signatories configuration...</span>
                                </td>
                            </tr>
                        ) : filteredList.length === 0 ? (
                            <tr>
                                <td colSpan={6} className="p-8 text-center text-slate-400 italic">
                                    No signatories found matching your filter. Click <strong>Add Signatory</strong> to register one.
                                </td>
                            </tr>
                        ) : (
                            paginatedList.map((sig) => {
                                const config = SIGNATORY_TYPE_CONFIG[sig.signatory_type] || {
                                    label: sig.signatory_type,
                                    shortLabel: sig.signatory_type,
                                    scope: 'PPMP',
                                    color: 'bg-slate-100 text-slate-800 border-slate-200',
                                };
                                const isApp = config.scope === 'APP';

                                return (
                                    <tr key={sig.id} className="hover:bg-slate-50/80 transition">
                                        {/* Scope Badge */}
                                        <td className="p-3.5">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                                                isApp
                                                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                                                    : 'bg-blue-50 text-blue-800 border-blue-300'
                                            }`}>
                                                {isApp ? <FileText className="w-3 h-3 text-emerald-600" /> : <FileSpreadsheet className="w-3 h-3 text-blue-600" />}
                                                {config.scope}
                                            </span>
                                        </td>

                                        {/* Box / Role Label */}
                                        <td className="p-3.5">
                                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${config.color}`}>
                                                {config.label}
                                            </span>
                                        </td>

                                        {/* Official Name */}
                                        <td className="p-3.5 font-bold text-slate-900 text-[13px]">
                                            {sig.name}
                                        </td>

                                        {/* Position */}
                                        <td className="p-3.5 text-slate-600 font-medium">
                                            {sig.position}
                                        </td>

                                        {/* Status */}
                                        <td className="p-3.5">
                                            {sig.is_active ? (
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-full font-bold text-[11px]">
                                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                    Active Official
                                                </span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleActive(sig)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-0.5 bg-slate-100 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 border border-slate-200 hover:border-emerald-300 rounded-full text-[11px] font-medium transition cursor-pointer"
                                                    title="Click to set this person as the active official for this signatory box"
                                                >
                                                    <Check className="w-3 h-3" />
                                                    Set as Active
                                                </button>
                                            )}
                                        </td>

                                        {/* Actions */}
                                        <td className="p-3.5 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => openEditModal(sig)}
                                                    className="inline-flex items-center gap-1 px-2.5 py-1 text-blue-600 hover:bg-blue-50 rounded text-xs font-bold transition cursor-pointer"
                                                >
                                                    <Edit3 className="w-3.5 h-3.5" />
                                                    Edit
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => handleDelete(sig)}
                                                    className="p-1 text-rose-600 hover:bg-rose-50 rounded transition cursor-pointer"
                                                    title="Delete this signatory"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {filteredList.length > perPage && (
                <div className="p-4 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                    <div>
                        Showing {(page - 1) * perPage + 1} to {Math.min(page * perPage, filteredList.length)} of {filteredList.length} signatories
                    </div>
                    <div className="flex items-center gap-1">
                        <button
                            type="button"
                            disabled={page <= 1}
                            onClick={() => setPage((p) => Math.max(1, p - 1))}
                            className="px-2.5 py-1 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                        >
                            Previous
                        </button>
                        <span className="px-2 font-semibold text-slate-700">
                            Page {page} of {totalPages}
                        </span>
                        <button
                            type="button"
                            disabled={page >= totalPages}
                            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                            className="px-2.5 py-1 border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 cursor-pointer"
                        >
                            Next
                        </button>
                    </div>
                </div>
            )}

            {/* Modal for Add / Edit Signatory */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
                    <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
                        <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-4">
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                    <Shield className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wide">
                                        {editingSignatory ? 'Edit Official Signatory' : 'Add Official Signatory'}
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        Configure official signatory box details for reports and printed documents.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-semibold">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSave} className="space-y-4">
                            {/* Document Scope Selection (PPMP vs APP) */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                                    Document Scope
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleScopeChangeInModal('APP')}
                                        className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-bold transition cursor-pointer ${
                                            selectedDocScope === 'APP'
                                                ? 'bg-emerald-50 border-emerald-500 text-emerald-800 ring-1 ring-emerald-500'
                                                : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <FileText className="w-4 h-4 text-emerald-600" />
                                        <span>APP (Annual Procurement Plan)</span>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleScopeChangeInModal('PPMP')}
                                        className={`flex items-center justify-center gap-2 py-2 px-3 rounded-lg border text-xs font-bold transition cursor-pointer ${
                                            selectedDocScope === 'PPMP'
                                                ? 'bg-blue-50 border-blue-500 text-blue-800 ring-1 ring-blue-500'
                                                : 'border-slate-300 text-slate-600 hover:bg-slate-50'
                                        }`}
                                    >
                                        <FileSpreadsheet className="w-4 h-4 text-blue-600" />
                                        <span>PPMP Document</span>
                                    </button>
                                </div>
                            </div>

                            {/* Signatory Box Type */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                                    Signatory Box / Role
                                </label>
                                <select
                                    value={formData.signatory_type}
                                    onChange={(e) => handleTypeChangeInModal(e.target.value)}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                >
                                    {selectedDocScope === 'APP' ? (
                                        <>
                                            <option value="app_prepared_by">APP: Prepared by (e.g. GINA MAE B. CARBAQUEL, ADAS II)</option>
                                            <option value="app_reviewed_by">APP: Reviewed by (e.g. NORJANNA M. CAMAGUIN, MPA, PGDH - OPPMO)</option>
                                            <option value="app_recommending">APP: Recommending Approval (e.g. DESSAMIE BUAT-SANCHEZ, CPA, JD)</option>
                                            <option value="app_approved_by">APP: Approved by: (Governor) (e.g. HON. YVONNE R. CAGAS)</option>
                                        </>
                                    ) : (
                                        <>
                                            <option value="budget_requirement">PPMP: Reviewed as to Budgetary Requirement (PBO)</option>
                                            <option value="pacco_requirement">PPMP: Reviewed as to Budgetary Requirement (PACCO)</option>
                                            <option value="bac_secretariat">PPMP: Reviewed by OPPMO - BAC Secretariat</option>
                                            <option value="approved_by">PPMP: Approved by: (Governor)</option>
                                        </>
                                    )}
                                </select>
                            </div>

                            {/* Full Official Name */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                                    Official Full Name
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. GINA MAE B. CARBAQUEL"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value.toUpperCase() })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs uppercase font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            {/* Position / Designation */}
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1">
                                    Position / Designation
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. ADAS II or PGDH - OPPMO"
                                    value={formData.position}
                                    onChange={(e) => setFormData({ ...formData, position: e.target.value })}
                                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                                />
                            </div>

                            {/* Active Official Checkbox */}
                            <div className="pt-2">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                                    />
                                    <span className="text-xs font-semibold text-slate-800">
                                        Set as Active Official for this signatory box
                                    </span>
                                </label>
                                <p className="text-[11px] text-slate-500 ml-6 mt-0.5">
                                    When checked, this person will automatically be used on new documents and print views.
                                </p>
                            </div>

                            {/* Buttons */}
                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition shadow-sm disabled:opacity-50 cursor-pointer"
                                >
                                    {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    <span>{editingSignatory ? 'Update Signatory' : 'Save Signatory'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            </div>
        </div>
    );
};
