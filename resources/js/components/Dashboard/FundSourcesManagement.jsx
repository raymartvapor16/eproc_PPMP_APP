import React, { useState, useEffect, useMemo } from 'react';
import {
    Landmark,
    Plus,
    Search,
    Edit2,
    Trash2,
    CheckCircle2,
    XCircle,
    AlertCircle,
    ArrowRight,
    Shield,
    Layers,
    Info,
    RefreshCw,
    X,
    Filter,
} from 'lucide-react';
import { fundSourceService } from '../../services/api';

export const FundSourcesManagement = () => {
    const [fundSources, setFundSources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [routeFilter, setRouteFilter] = useState('ALL'); // 'ALL' | 'budget' | 'pacco'
    const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'

    // Form Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSource, setEditingSource] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        workflow_route: 'budget',
        description: '',
        is_active: true,
        display_order: 0,
    });
    const [saving, setSaving] = useState(false);
    const [modalError, setModalError] = useState('');

    // Delete Modal state
    const [deleteModalSource, setDeleteModalSource] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    // Feedback notification
    const [feedback, setFeedback] = useState({ type: '', text: '' });

    const showFeedback = (type, text) => {
        setFeedback({ type, text });
        setTimeout(() => setFeedback({ type: '', text: '' }), 5000);
    };

    const fetchFundSources = async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        else setRefreshing(true);

        try {
            const res = await fundSourceService.getAll();
            setFundSources(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            showFeedback('error', err.response?.data?.message || 'Failed to load Fund Sources.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchFundSources();
    }, []);

    // Filtered list
    const filteredSources = useMemo(() => {
        return fundSources.filter((fs) => {
            const matchesSearch =
                !searchQuery ||
                fs.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (fs.code && fs.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (fs.description && fs.description.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesRoute =
                routeFilter === 'ALL' || fs.workflow_route === routeFilter;

            const matchesStatus =
                statusFilter === 'ALL' ||
                (statusFilter === 'ACTIVE' && fs.is_active) ||
                (statusFilter === 'INACTIVE' && !fs.is_active);

            return matchesSearch && matchesRoute && matchesStatus;
        });
    }, [fundSources, searchQuery, routeFilter, statusFilter]);

    // Open Modal for Add
    const handleOpenAddModal = () => {
        setEditingSource(null);
        setFormData({
            name: '',
            code: '',
            workflow_route: 'budget',
            description: '',
            is_active: true,
            display_order: fundSources.length > 0 ? (Math.max(...fundSources.map(f => f.display_order || 0)) + 1) : 0,
        });
        setModalError('');
        setIsModalOpen(true);
    };

    // Open Modal for Edit
    const handleOpenEditModal = (source) => {
        setEditingSource(source);
        setFormData({
            name: source.name,
            code: source.code || '',
            workflow_route: source.workflow_route || 'budget',
            description: source.description || '',
            is_active: Boolean(source.is_active),
            display_order: source.display_order || 0,
        });
        setModalError('');
        setIsModalOpen(true);
    };

    // Save Form (Create or Update)
    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setModalError('Fund Source Name is required.');
            return;
        }

        setSaving(true);
        setModalError('');

        try {
            if (editingSource) {
                const res = await fundSourceService.update(editingSource.id, formData);
                showFeedback('success', res.data?.message || 'Fund Source updated successfully.');
            } else {
                const res = await fundSourceService.create(formData);
                showFeedback('success', res.data?.message || 'Fund Source created successfully.');
            }
            setIsModalOpen(false);
            fetchFundSources(true);
        } catch (err) {
            setModalError(
                err.response?.data?.errors?.name?.[0] ||
                err.response?.data?.message ||
                'Failed to save Fund Source.'
            );
        } finally {
            setSaving(false);
        }
    };

    // Quick toggle active status
    const handleToggleActive = async (source) => {
        try {
            await fundSourceService.update(source.id, {
                ...source,
                is_active: !source.is_active,
            });
            showFeedback('success', `Fund Source "${source.name}" marked as ${!source.is_active ? 'Active' : 'Inactive'}.`);
            fetchFundSources(true);
        } catch (err) {
            showFeedback('error', err.response?.data?.message || 'Failed to update status.');
        }
    };

    // Execute Delete
    const handleConfirmDelete = async () => {
        if (!deleteModalSource) return;

        setDeleting(true);
        setDeleteError('');

        try {
            const res = await fundSourceService.delete(deleteModalSource.id);
            showFeedback('success', res.data?.message || 'Fund Source deleted successfully.');
            setDeleteModalSource(null);
            fetchFundSources(true);
        } catch (err) {
            setDeleteError(err.response?.data?.message || 'Failed to delete Fund Source.');
        } finally {
            setDeleting(false);
        }
    };

    // Quick deactivate from delete dialog if in use
    const handleDeactivateInstead = async () => {
        if (!deleteModalSource) return;
        setDeleting(true);
        try {
            await fundSourceService.update(deleteModalSource.id, {
                ...deleteModalSource,
                is_active: false,
            });
            showFeedback('success', `"${deleteModalSource.name}" has been deactivated.`);
            setDeleteModalSource(null);
            fetchFundSources(true);
        } catch (err) {
            setDeleteError(err.response?.data?.message || 'Failed to deactivate.');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Feedback Alert */}
            {feedback.text && (
                <div
                    className={`p-4 rounded-xl border flex items-center justify-between shadow-xs transition-all ${
                        feedback.type === 'success'
                            ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                            : 'bg-rose-50 border-rose-200 text-rose-800'
                    }`}
                >
                    <div className="flex items-center gap-2.5">
                        {feedback.type === 'success' ? (
                            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                        ) : (
                            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
                        )}
                        <span className="text-sm font-semibold">{feedback.text}</span>
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

            {/* Header & Action Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-xs font-bold border border-indigo-400/30">
                        <Landmark className="w-3.5 h-3.5" />
                        <span>Fund Source Governance</span>
                    </div>
                    <h2 className="text-xl font-black tracking-tight text-white">
                        Sources of Fund &amp; Review Workflow Routes
                    </h2>
                    <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                        Manage available funding sources for PPMPs. Each fund source defines which automated review pipeline is triggered when end-users submit PPMPs: <strong>Budget Officer</strong> (General Fund) or <strong>PACCO Reviewer</strong> (Trust Fund).
                    </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={() => fetchFundSources(true)}
                        disabled={refreshing || loading}
                        className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition border border-white/10 cursor-pointer disabled:opacity-50"
                        title="Refresh List"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        type="button"
                        onClick={handleOpenAddModal}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition shadow-lg shadow-blue-600/30 border border-blue-400/30 cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add Fund Source</span>
                    </button>
                </div>
            </div>

            {/* Workflow Routing Explainer Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Budget Route Card */}
                <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center gap-2.5 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                            GF
                        </div>
                        <div>
                            <div className="text-xs font-bold text-slate-900">Budget Officer Pipeline</div>
                            <div className="text-[11px] text-slate-500">General Fund &amp; Regular Appropriations</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 overflow-x-auto">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200 shrink-0">Budget Officer</span>
                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-200 shrink-0">OPPMO</span>
                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200 shrink-0">BAC-TWG</span>
                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-200 shrink-0">OPPMO (Generate APP)</span>
                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded border border-amber-200 shrink-0">Head (Approval)</span>
                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200 shrink-0">Ready to Print</span>
                    </div>
                </div>

                {/* PACCO Route Card */}
                <div className="bg-white p-4 rounded-xl border border-teal-100 shadow-xs flex flex-col justify-between">
                    <div className="flex items-center gap-2.5 mb-2">
                        <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs">
                            TF
                        </div>
                        <div>
                            <div className="text-xs font-bold text-slate-900">PACCO Reviewer Pipeline</div>
                            <div className="text-[11px] text-slate-500">Trust Fund &amp; Special Fiduciary Projects</div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 overflow-x-auto">
                        <span className="px-2 py-0.5 bg-teal-50 text-teal-800 rounded border border-teal-200 shrink-0">PACCO Reviewer</span>
                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-200 shrink-0">OPPMO</span>
                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200 shrink-0">BAC-TWG</span>
                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-200 shrink-0">OPPMO (Generate APP)</span>
                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded border border-amber-200 shrink-0">Head (Approval)</span>
                        <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                        <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200 shrink-0">Ready to Print</span>
                    </div>
                </div>
            </div>

            {/* Controls Bar: Search & Filters */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-72">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search fund sources..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                    />
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto overflow-x-auto">
                    {/* Route Filter */}
                    <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                        <button
                            type="button"
                            onClick={() => setRouteFilter('ALL')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                                routeFilter === 'ALL'
                                    ? 'bg-white text-slate-900 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            All Routes
                        </button>
                        <button
                            type="button"
                            onClick={() => setRouteFilter('budget')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                                routeFilter === 'budget'
                                    ? 'bg-white text-blue-700 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            Budget Route
                        </button>
                        <button
                            type="button"
                            onClick={() => setRouteFilter('pacco')}
                            className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                                routeFilter === 'pacco'
                                    ? 'bg-white text-teal-700 shadow-xs'
                                    : 'text-slate-600 hover:text-slate-900'
                            }`}
                        >
                            PACCO Route
                        </button>
                    </div>

                    {/* Status Filter */}
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="ACTIVE">Active Only</option>
                        <option value="INACTIVE">Inactive Only</option>
                    </select>
                </div>
            </div>

            {/* Fund Sources Master Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="px-5 py-3.5">Order</th>
                                <th className="px-5 py-3.5">Source of Fund Name</th>
                                <th className="px-5 py-3.5">Workflow Pipeline</th>
                                <th className="px-5 py-3.5">Description</th>
                                <th className="px-5 py-3.5 text-center">PPMPs Count</th>
                                <th className="px-5 py-3.5 text-center">Status</th>
                                <th className="px-5 py-3.5 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                                        <div className="inline-flex items-center gap-2 font-medium">
                                            <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />
                                            <span>Loading sources of fund...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredSources.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Landmark className="w-8 h-8 text-slate-300" />
                                            <span className="font-semibold text-slate-600">No Sources of Fund found.</span>
                                            <span className="text-[11px] text-slate-400">Try adjusting your search query or filters.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredSources.map((source) => {
                                    const isBudgetRoute = source.workflow_route === 'budget';
                                    return (
                                        <tr key={source.id} className="hover:bg-slate-50/70 transition">
                                            {/* Order */}
                                            <td className="px-5 py-4 font-mono font-bold text-slate-400 text-center w-12">
                                                {source.display_order ?? 0}
                                            </td>

                                            {/* Name & Code */}
                                            <td className="px-5 py-4">
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                                        isBudgetRoute
                                                            ? 'bg-blue-100 text-blue-700'
                                                            : 'bg-teal-100 text-teal-700'
                                                    }`}>
                                                        {source.code ? source.code.slice(0, 3) : <Landmark className="w-4 h-4" />}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-900 flex items-center gap-2">
                                                            {source.name}
                                                            {source.code && (
                                                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] font-semibold border border-slate-200">
                                                                    {source.code}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[11px] text-slate-400">
                                                            Created {new Date(source.created_at).toLocaleDateString()}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            {/* Workflow Route Pipeline */}
                                            <td className="px-5 py-4">
                                                {isBudgetRoute ? (
                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 font-semibold text-[11px]">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                        <span>Budget Officer Route</span>
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200 font-semibold text-[11px]">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                                                        <span>PACCO Reviewer Route</span>
                                                    </div>
                                                )}
                                                <div className="text-[10px] text-slate-400 mt-1 pl-1">
                                                    {isBudgetRoute
                                                        ? 'Budget ➔ OPPMO ➔ TWG'
                                                        : 'PACCO ➔ OPPMO ➔ TWG'}
                                                </div>
                                            </td>

                                            {/* Description */}
                                            <td className="px-5 py-4 max-w-xs text-slate-600 text-xs truncate">
                                                {source.description || <span className="text-slate-300 italic">No notes</span>}
                                            </td>

                                            {/* PPMPs Count */}
                                            <td className="px-5 py-4 text-center">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                                    (source.ppmps_count || 0) > 0
                                                        ? 'bg-slate-100 text-slate-800 border border-slate-200'
                                                        : 'text-slate-400'
                                                }`}>
                                                    {source.ppmps_count || 0}
                                                </span>
                                            </td>

                                            {/* Status */}
                                            <td className="px-5 py-4 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleActive(source)}
                                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer border ${
                                                        source.is_active
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                                            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                                                    }`}
                                                    title={`Click to ${source.is_active ? 'deactivate' : 'activate'}`}
                                                >
                                                    {source.is_active ? (
                                                        <>
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                            <span>Active</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <XCircle className="w-3 h-3 text-slate-400" />
                                                            <span>Inactive</span>
                                                        </>
                                                    )}
                                                </button>
                                            </td>

                                            {/* Actions */}
                                            <td className="px-5 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEditModal(source)}
                                                        className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                                                        title="Edit Fund Source"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setDeleteModalSource(source);
                                                            setDeleteError('');
                                                        }}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                                        title="Delete Fund Source"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
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
            </div>

            {/* Modal: Add / Edit Fund Source */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
                        {/* Modal Header */}
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                                    <Landmark className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900">
                                        {editingSource ? 'Edit Source of Fund' : 'Add New Source of Fund'}
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        Configure fund naming and review route assignment
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Modal Body */}
                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            {modalError && (
                                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                                    <span>{modalError}</span>
                                </div>
                            )}

                            {/* Fund Source Name */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Source of Fund Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. General Fund and etc.., Trust Fund, Special Education Fund"
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                    This exact name will be displayed in the end-user selection modal when preparing a new PPMP.
                                </p>
                            </div>

                            {/* Fund Source Code & Display Order */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Abbreviation / Code <span className="text-slate-400 font-normal">(Optional)</span>
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="e.g. GF, TF, SEF"
                                        value={formData.code || ''}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Display Order
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.display_order ?? 0}
                                        onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value, 10) || 0 })}
                                        className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            {/* Workflow Route Pipeline Selector */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Automated Review Workflow Pipeline <span className="text-rose-500">*</span>
                                </label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                    {/* Option: Budget Route */}
                                    <label
                                        className={`p-3 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                                            formData.workflow_route === 'budget'
                                                ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20'
                                                : 'border-slate-200 bg-white hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="font-bold text-xs text-slate-900">
                                                Budget Officer Route
                                            </div>
                                            <input
                                                type="radio"
                                                name="workflow_route"
                                                value="budget"
                                                checked={formData.workflow_route === 'budget'}
                                                onChange={(e) => setFormData({ ...formData, workflow_route: e.target.value })}
                                                className="text-blue-600 focus:ring-blue-500 mt-0.5"
                                            />
                                        </div>
                                        <div className="text-[10px] text-slate-500 mt-2">
                                            End User ➔ Head ➔ <strong>Budget Officer</strong> ➔ OPPMO ➔ BAC-TWG ➔ OPPMO (Generate APP) ➔ Head (Approval) ➔ Ready to Print
                                        </div>
                                    </label>

                                    {/* Option: PACCO Route */}
                                    <label
                                        className={`p-3 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                                            formData.workflow_route === 'pacco'
                                                ? 'border-teal-500 bg-teal-50/60 ring-2 ring-teal-500/20'
                                                : 'border-slate-200 bg-white hover:bg-slate-50'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="font-bold text-xs text-slate-900">
                                                PACCO Reviewer Route
                                            </div>
                                            <input
                                                type="radio"
                                                name="workflow_route"
                                                value="pacco"
                                                checked={formData.workflow_route === 'pacco'}
                                                onChange={(e) => setFormData({ ...formData, workflow_route: e.target.value })}
                                                className="text-teal-600 focus:ring-teal-500 mt-0.5"
                                            />
                                        </div>
                                        <div className="text-[10px] text-slate-500 mt-2">
                                            End User ➔ Head ➔ <strong>PACCO Reviewer</strong> ➔ OPPMO ➔ BAC-TWG ➔ OPPMO (Generate APP) ➔ Head (Approval) ➔ Ready to Print
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Description / Notes */}
                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Description / Remarks <span className="text-slate-400 font-normal">(Optional)</span>
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Brief description of this fund source, eligible items, or notes..."
                                    value={formData.description || ''}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                />
                            </div>

                            {/* Active Checkbox */}
                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="fund_is_active"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                />
                                <label htmlFor="fund_is_active" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                                    Active for selection by End Users
                                </label>
                            </div>

                            {/* Modal Actions */}
                            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
                                >
                                    {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                    <span>{editingSource ? 'Update Fund Source' : 'Create Fund Source'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Delete Confirmation */}
            {deleteModalSource && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                                <Trash2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">
                                    Delete Source of Fund?
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Are you sure you want to delete <strong>"{deleteModalSource.name}"</strong>?
                                </p>
                            </div>
                        </div>

                        {deleteError && (
                            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs space-y-2">
                                <div className="flex items-start gap-2">
                                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                                    <div className="font-semibold leading-relaxed">{deleteError}</div>
                                </div>
                                <button
                                    type="button"
                                    onClick={handleDeactivateInstead}
                                    disabled={deleting}
                                    className="w-full mt-2 py-1.5 px-3 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold transition shadow-xs"
                                >
                                    Deactivate Instead (Recommended)
                                </button>
                            </div>
                        )}

                        {(deleteModalSource.ppmps_count || 0) > 0 && !deleteError && (
                            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                <div>
                                    This Fund Source has <strong>{deleteModalSource.ppmps_count} PPMP(s)</strong> linked to it. The system will prevent deletion to preserve data integrity.
                                </div>
                            </div>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeleteModalSource(null)}
                                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                            >
                                Cancel
                            </button>
                            {((deleteModalSource.ppmps_count || 0) === 0 || deleteError) ? (
                                <button
                                    type="button"
                                    onClick={handleConfirmDelete}
                                    disabled={deleting}
                                    className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
                                >
                                    {deleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                    <span>Confirm Delete</span>
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleDeactivateInstead}
                                    disabled={deleting}
                                    className="px-4 py-2 text-xs font-bold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg transition"
                                >
                                    Deactivate
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default FundSourcesManagement;
