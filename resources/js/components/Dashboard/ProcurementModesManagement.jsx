import React, { useState, useEffect, useMemo } from 'react';
import {
    Tags,
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
    FileSpreadsheet,
    Activity,
    Layers,
    ShieldAlert,
    HelpCircle,
    Check,
} from 'lucide-react';
import { procurementModeService } from '../../services/api';

export const ProcurementModesManagement = () => {
    const [modes, setModes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'

    // Form Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingMode, setEditingMode] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        description: '',
        is_active: true,
        display_order: 0,
    });
    const [saving, setSaving] = useState(false);
    const [modalError, setModalError] = useState('');

    // Delete Modal state
    const [deleteModalMode, setDeleteModalMode] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    // Toggle status state
    const [togglingId, setTogglingId] = useState(null);

    // Feedback notification
    const [feedback, setFeedback] = useState({ type: '', text: '' });

    const showFeedback = (type, text) => {
        setFeedback({ type, text });
        setTimeout(() => setFeedback({ type: '', text: '' }), 5000);
    };

    const fetchModes = async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        else setRefreshing(true);

        try {
            const res = await procurementModeService.getAll({ active_only: false });
            setModes(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            showFeedback('error', err.response?.data?.message || 'Failed to load Modes of Procurement.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchModes();
    }, []);

    // Filtered list
    const filteredModes = useMemo(() => {
        return modes.filter((m) => {
            const matchesSearch =
                !searchQuery ||
                m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (m.code && m.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (m.description && m.description.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesStatus =
                statusFilter === 'ALL' ||
                (statusFilter === 'ACTIVE' && m.is_active) ||
                (statusFilter === 'INACTIVE' && !m.is_active);

            return matchesSearch && matchesStatus;
        });
    }, [modes, searchQuery, statusFilter]);

    // Statistics
    const totalModes = modes.length;
    const activeModes = modes.filter((m) => m.is_active).length;
    const inactiveModes = totalModes - activeModes;
    const totalUsage = modes.reduce((acc, m) => acc + (m.usage_count || 0), 0);

    // Open Modal for Add
    const handleOpenAddModal = () => {
        setEditingMode(null);
        setFormData({
            name: '',
            code: '',
            description: '',
            is_active: true,
            display_order: modes.length > 0 ? Math.max(...modes.map((m) => m.display_order || 0)) + 1 : 1,
        });
        setModalError('');
        setIsModalOpen(true);
    };

    // Open Modal for Edit
    const handleOpenEditModal = (mode) => {
        setEditingMode(mode);
        setFormData({
            name: mode.name,
            code: mode.code || '',
            description: mode.description || '',
            is_active: Boolean(mode.is_active),
            display_order: mode.display_order || 0,
        });
        setModalError('');
        setIsModalOpen(true);
    };

    // Save (Create or Update)
    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setModalError('Mode name is required.');
            return;
        }

        setSaving(true);
        setModalError('');

        try {
            if (editingMode) {
                await procurementModeService.update(editingMode.id, formData);
                showFeedback('success', `Mode "${formData.name}" updated successfully.`);
            } else {
                await procurementModeService.create(formData);
                showFeedback('success', `Mode "${formData.name}" added successfully.`);
            }
            setIsModalOpen(false);
            fetchModes(true);
        } catch (err) {
            const msg = err.response?.data?.message || (err.response?.data?.errors ? Object.values(err.response.data.errors).flat().join(' ') : 'Failed to save mode of procurement.');
            setModalError(msg);
        } finally {
            setSaving(false);
        }
    };

    // Toggle active status
    const handleToggleStatus = async (mode) => {
        setTogglingId(mode.id);
        try {
            const res = await procurementModeService.toggleStatus(mode.id);
            showFeedback('success', res.data?.message || 'Status updated.');
            fetchModes(true);
        } catch (err) {
            showFeedback('error', err.response?.data?.message || 'Failed to toggle status.');
        } finally {
            setTogglingId(null);
        }
    };

    // Delete
    const handleDelete = async () => {
        if (!deleteModalMode) return;
        setDeleting(true);
        setDeleteError('');

        try {
            await procurementModeService.delete(deleteModalMode.id);
            showFeedback('success', `Mode "${deleteModalMode.name}" deleted successfully.`);
            setDeleteModalMode(null);
            fetchModes(true);
        } catch (err) {
            setDeleteError(err.response?.data?.message || 'Failed to delete mode.');
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
                        className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* Header & Action Banner */}
            <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-indigo-500/20 text-indigo-300 rounded-full text-xs font-bold border border-indigo-400/30">
                        <Tags className="w-3.5 h-3.5" />
                        <span>Procurement Masterlist Governance</span>
                    </div>
                    <h2 className="text-xl font-black tracking-tight text-white">
                        Modes of Procurement (RA 12009 Masterlist)
                    </h2>
                    <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                        Centrally configure and maintain standard modes of procurement pursuant to Republic Act No. 12009. Any additions, updates, or deactivations here dynamically synchronize with both the <strong>PPMP Plan Table</strong> and the <strong>OPPMO Monitoring System</strong> dropdowns.
                    </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={() => fetchModes(true)}
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
                        <span>Add Mode of Procurement</span>
                    </button>
                </div>
            </div>

            {/* Metrics Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <div className="text-xs font-semibold text-slate-500">Total Modes</div>
                    <div className="text-2xl font-black text-slate-900 mt-1">{totalModes}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">RA 12009 Registered</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <div className="text-xs font-semibold text-emerald-600">Active in Dropdowns</div>
                    <div className="text-2xl font-black text-emerald-600 mt-1">{activeModes}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Available for selection</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <div className="text-xs font-semibold text-slate-500">Inactive / Archived</div>
                    <div className="text-2xl font-black text-slate-700 mt-1">{inactiveModes}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">Hidden from end-users</div>
                </div>
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <div className="text-xs font-semibold text-indigo-600">Total System References</div>
                    <div className="text-2xl font-black text-indigo-600 mt-1">{totalUsage}</div>
                    <div className="text-[11px] text-slate-400 mt-0.5">PPMP items &amp; Monitoring</div>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="relative w-full sm:w-96">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search by mode name, code, or description..."
                        className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
                    <span className="text-xs font-semibold text-slate-500">Status:</span>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="border border-slate-300 rounded-lg text-xs py-1.5 px-3 focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white font-medium text-slate-700"
                    >
                        <option value="ALL">All Modes ({modes.length})</option>
                        <option value="ACTIVE">Active Only ({activeModes})</option>
                        <option value="INACTIVE">Inactive Only ({inactiveModes})</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="py-3 px-4 w-12 text-center">Order</th>
                                <th className="py-3 px-4">Mode of Procurement</th>
                                <th className="py-3 px-4">Short Code</th>
                                <th className="py-3 px-4">Legal Basis / Description</th>
                                <th className="py-3 px-4 text-center">System Usage</th>
                                <th className="py-3 px-4 text-center">Status</th>
                                <th className="py-3 px-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                            {loading ? (
                                <tr>
                                    <td colSpan="7" className="py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                                            <span>Loading Modes of Procurement...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredModes.length === 0 ? (
                                <tr>
                                    <td colSpan="7" className="py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <Info className="w-8 h-8 text-slate-300" />
                                            <p className="font-semibold text-slate-600">No modes of procurement found</p>
                                            <p className="text-xs text-slate-400">
                                                {searchQuery ? 'Try clearing your search query.' : 'Click "Add Mode of Procurement" above to create one.'}
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredModes.map((mode) => (
                                    <tr key={mode.id} className="hover:bg-slate-50/70 transition">
                                        <td className="py-3.5 px-4 text-center font-bold text-slate-400">
                                            {mode.display_order ?? 0}
                                        </td>
                                        <td className="py-3.5 px-4 font-bold text-slate-900">
                                            <div className="flex items-center gap-2">
                                                <span>{mode.name}</span>
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            {mode.code ? (
                                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-black uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                                                    {mode.code}
                                                </span>
                                            ) : (
                                                <span className="text-slate-400 italic">None</span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 text-slate-600 max-w-xs">
                                            <p className="line-clamp-2" title={mode.description}>
                                                {mode.description || <span className="text-slate-400 italic">No description provided</span>}
                                            </p>
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            <div className="inline-flex flex-col items-center gap-0.5">
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                                    <FileSpreadsheet className="w-3 h-3 text-emerald-600" />
                                                    {mode.ppmp_items_count ?? 0} PPMP
                                                </span>
                                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                                    <Activity className="w-3 h-3 text-blue-600" />
                                                    {mode.monitoring_projects_count ?? 0} Monitored
                                                </span>
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleStatus(mode)}
                                                disabled={togglingId === mode.id}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold cursor-pointer transition ${
                                                    mode.is_active
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100'
                                                        : 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                                                }`}
                                                title="Click to toggle active status"
                                            >
                                                {togglingId === mode.id ? (
                                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                                ) : mode.is_active ? (
                                                    <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                ) : (
                                                    <XCircle className="w-3 h-3 text-rose-600" />
                                                )}
                                                <span>{mode.is_active ? 'Active' : 'Inactive'}</span>
                                            </button>
                                        </td>
                                        <td className="py-3.5 px-4 text-right">
                                            <div className="inline-flex items-center gap-1 justify-end">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenEditModal(mode)}
                                                    className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                                    title="Edit Mode"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setDeleteModalMode(mode);
                                                        setDeleteError('');
                                                    }}
                                                    className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                                    title="Delete Mode"
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
            </div>

            {/* Modal: Create / Edit Mode */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Tags className="w-4 h-4 text-indigo-400" />
                                <h3 className="font-bold text-sm">
                                    {editingMode ? 'Edit Mode of Procurement' : 'Add New Mode of Procurement'}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 hover:text-white cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            {modalError && (
                                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{modalError}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Mode Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. Competitive Bidding (RA 12009)"
                                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                                <p className="text-[11px] text-slate-400 mt-1">
                                    This exact name will be displayed in PPMP and Monitoring system dropdowns.
                                </p>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                        Short Code (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                        placeholder="e.g. CB, SVP, LV"
                                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none uppercase"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                        Display Order
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.display_order}
                                        onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value, 10) || 0 })}
                                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                                    Description / Legal Basis (RA 12009)
                                </label>
                                <textarea
                                    rows="3"
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    placeholder="Explain application criteria, threshold limits, or legal guidelines under RA 12009..."
                                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                                />
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="is_active_mode"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 h-4 w-4 cursor-pointer"
                                />
                                <label htmlFor="is_active_mode" className="text-xs font-semibold text-slate-700 cursor-pointer">
                                    Active (immediately visible in PPMP &amp; Monitoring dropdowns)
                                </label>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                    <span>{editingMode ? 'Update Mode' : 'Create Mode'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Delete Confirmation */}
            {deleteModalMode && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="p-4 bg-rose-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <ShieldAlert className="w-4 h-4 text-rose-300" />
                                <h3 className="font-bold text-sm">Delete Mode of Procurement</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDeleteModalMode(null)}
                                className="text-rose-200 hover:text-white cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {deleteError ? (
                                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{deleteError}</span>
                                </div>
                            ) : (
                                <p className="text-xs text-slate-600 leading-relaxed">
                                    Are you sure you want to permanently delete{' '}
                                    <strong className="text-slate-900">"{deleteModalMode.name}"</strong>? If this mode is referenced by existing PPMPs or Monitoring projects, deletion will be blocked and you will be advised to deactivate it instead.
                                </p>
                            )}

                            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setDeleteModalMode(null)}
                                    className="px-4 py-2 border border-slate-300 text-slate-700 rounded-lg text-xs font-bold hover:bg-slate-50 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleDelete}
                                    disabled={deleting}
                                    className="px-5 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold hover:bg-rose-700 cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                                >
                                    {deleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                    <span>Confirm Delete</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
