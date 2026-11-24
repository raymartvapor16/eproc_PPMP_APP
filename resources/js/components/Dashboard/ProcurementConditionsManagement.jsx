import React, { useState, useEffect, useMemo } from 'react';
import {
    FileText,
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
    Truck,
    MapPin,
    CreditCard,
    Calendar,
} from 'lucide-react';
import { procurementConditionService } from '../../services/api';

export const ProcurementConditionsManagement = () => {
    const [conditions, setConditions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingCondition, setEditingCondition] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        place_of_delivery: '',
        delivery_period: '',
        payment_method: '',
        other_terms: '',
        is_active: true,
        display_order: 0,
    });
    const [saving, setSaving] = useState(false);
    const [modalError, setModalError] = useState('');

    const [deleteModalCondition, setDeleteModalCondition] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    const [feedback, setFeedback] = useState({ type: '', text: '' });

    const showFeedback = (type, text) => {
        setFeedback({ type, text });
        setTimeout(() => setFeedback({ type: '', text: '' }), 5000);
    };

    const fetchConditions = async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        else setRefreshing(true);

        try {
            const res = await procurementConditionService.getAll();
            setConditions(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            showFeedback('error', err.response?.data?.message || 'Failed to load Procurement Conditions.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchConditions();
    }, []);

    const filteredConditions = useMemo(() => {
        return conditions.filter((c) => {
            const matchesSearch =
                !searchQuery ||
                c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (c.place_of_delivery && c.place_of_delivery.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (c.delivery_period && c.delivery_period.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (c.payment_method && c.payment_method.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (c.other_terms && c.other_terms.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesStatus =
                statusFilter === 'ALL' ||
                (statusFilter === 'ACTIVE' && c.is_active) ||
                (statusFilter === 'INACTIVE' && !c.is_active);

            return matchesSearch && matchesStatus;
        });
    }, [conditions, searchQuery, statusFilter]);

    const handleOpenAddModal = () => {
        setEditingCondition(null);
        setFormData({
            name: '',
            place_of_delivery: 'PGSO Warehouse/On-site',
            delivery_period: '',
            payment_method: '',
            other_terms: '',
            is_active: true,
            display_order: conditions.length > 0 ? (Math.max(...conditions.map(c => c.display_order || 0)) + 1) : 1,
        });
        setModalError('');
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (condition) => {
        setEditingCondition(condition);
        setFormData({
            name: condition.name,
            place_of_delivery: condition.place_of_delivery || '',
            delivery_period: condition.delivery_period || '',
            payment_method: condition.payment_method || '',
            other_terms: condition.other_terms || '',
            is_active: Boolean(condition.is_active),
            display_order: condition.display_order || 0,
        });
        setModalError('');
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setModalError('Condition Name is required.');
            return;
        }

        setSaving(true);
        setModalError('');

        try {
            if (editingCondition) {
                const res = await procurementConditionService.update(editingCondition.id, formData);
                showFeedback('success', res.data?.message || 'Condition updated successfully.');
            } else {
                const res = await procurementConditionService.create(formData);
                showFeedback('success', res.data?.message || 'Condition created successfully.');
            }
            setIsModalOpen(false);
            fetchConditions(true);
        } catch (err) {
            setModalError(
                err.response?.data?.errors?.name?.[0] ||
                err.response?.data?.message ||
                'Failed to save Condition.'
            );
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (condition) => {
        try {
            await procurementConditionService.update(condition.id, {
                ...condition,
                is_active: !condition.is_active,
            });
            showFeedback('success', `Condition "${condition.name}" marked as ${!condition.is_active ? 'Active' : 'Inactive'}.`);
            fetchConditions(true);
        } catch (err) {
            showFeedback('error', err.response?.data?.message || 'Failed to update status.');
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteModalCondition) return;

        setDeleting(true);
        setDeleteError('');

        try {
            const res = await procurementConditionService.delete(deleteModalCondition.id);
            showFeedback('success', res.data?.message || 'Condition deleted successfully.');
            setDeleteModalCondition(null);
            fetchConditions(true);
        } catch (err) {
            setDeleteError(err.response?.data?.message || 'Failed to delete Condition.');
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-6">

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

            <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 rounded-2xl p-6 text-white shadow-md border border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-bold border border-blue-400/30">
                        <Truck className="w-3.5 h-3.5" />
                        <span>Delivery &amp; Payment Specifications</span>
                    </div>
                    <h2 className="text-xl font-black tracking-tight text-white">
                        Procurement Conditions &amp; Delivery Terms
                    </h2>
                    <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
                        Manage pre-defined condition templates for <strong>Delivery Period</strong>, <strong>Place of Delivery</strong>, and <strong>Payment Method</strong> (e.g. Catering Services, POL Condition, Water, Travelling). These templates appear as one-click dropdown presets when end-users prepare PPMPs.
                    </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={() => fetchConditions(true)}
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
                        <span>Add New Condition</span>
                    </button>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search conditions, delivery place, payment..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                    />
                </div>

                <div className="flex items-center gap-2.5 w-full sm:w-auto">
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="ACTIVE">Active Only</option>
                        <option value="INACTIVE">Inactive Only</option>
                    </select>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                                <th className="px-5 py-3.5 w-12 text-center">#</th>
                                <th className="px-5 py-3.5">Condition Name</th>
                                <th className="px-5 py-3.5">Place of Delivery</th>
                                <th className="px-5 py-3.5">Delivery Period</th>
                                <th className="px-5 py-3.5">Payment Method</th>
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
                                            <span>Loading procurement conditions...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredConditions.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-5 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <FileText className="w-8 h-8 text-slate-300" />
                                            <span className="font-semibold text-slate-600">No Procurement Conditions found.</span>
                                            <span className="text-[11px] text-slate-400">Try adjusting your search query or filters.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredConditions.map((condition) => (
                                    <tr key={condition.id} className="hover:bg-slate-50/70 transition">

                                        <td className="px-5 py-4 font-mono font-bold text-slate-400 text-center">
                                            {condition.display_order ?? 0}
                                        </td>

                                        <td className="px-5 py-4 min-w-[200px]">
                                            <div className="font-bold text-slate-900 flex items-center gap-2">
                                                <span>{condition.name}</span>
                                            </div>
                                            {condition.other_terms && (
                                                <div className="text-[11px] text-slate-500 mt-1 max-w-xs truncate" title={condition.other_terms}>
                                                    <span className="font-semibold text-slate-600">Notes:</span> {condition.other_terms}
                                                </div>
                                            )}
                                        </td>

                                        <td className="px-5 py-4 max-w-[220px]">
                                            <div className="flex items-start gap-1.5 text-slate-700">
                                                <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                                <span className="line-clamp-2 leading-relaxed" title={condition.place_of_delivery}>
                                                    {condition.place_of_delivery || <span className="text-slate-300 italic">Not set</span>}
                                                </span>
                                            </div>
                                        </td>

                                        <td className="px-5 py-4 max-w-[240px]">
                                            <div className="flex items-start gap-1.5 text-slate-700">
                                                <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                                <span className="line-clamp-2 leading-relaxed whitespace-pre-line" title={condition.delivery_period}>
                                                    {condition.delivery_period || <span className="text-slate-300 italic">Not set</span>}
                                                </span>
                                            </div>
                                        </td>

                                        <td className="px-5 py-4 max-w-[240px]">
                                            <div className="flex items-start gap-1.5 text-slate-700">
                                                <CreditCard className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                                                <span className="line-clamp-2 leading-relaxed" title={condition.payment_method}>
                                                    {condition.payment_method || <span className="text-slate-300 italic">Not set</span>}
                                                </span>
                                            </div>
                                        </td>

                                        <td className="px-5 py-4 text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleActive(condition)}
                                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer border ${
                                                    condition.is_active
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                                        : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                                                }`}
                                                title={`Click to ${condition.is_active ? 'deactivate' : 'activate'}`}
                                            >
                                                {condition.is_active ? (
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

                                        <td className="px-5 py-4 text-right">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenEditModal(condition)}
                                                    className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition cursor-pointer"
                                                    title="Edit Condition"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setDeleteModalCondition(condition);
                                                        setDeleteError('');
                                                    }}
                                                    className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                                    title="Delete Condition"
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

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden max-h-[90vh] flex flex-col">

                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center font-bold">
                                    <Truck className="w-4 h-4" />
                                </div>
                                <div>
                                    <h3 className="text-sm font-bold text-slate-900">
                                        {editingCondition ? 'Edit Procurement Condition' : 'Add New Procurement Condition'}
                                    </h3>
                                    <p className="text-[11px] text-slate-500">
                                        Configure automated presets for Delivery Period, Place, and Payment Method
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4 overflow-y-auto">
                            {modalError && (
                                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                                    <span>{modalError}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Condition Name / Title <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Catering Services: With Date/Schedule, POL Condition, Water, Travelling"
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                <p className="text-[10px] text-slate-400 mt-1">
                                    Label displayed in the "Additional Condition" dropdown on the PPMP form.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Place of Delivery
                                </label>
                                <input
                                    type="text"
                                    placeholder="e.g. PGSO Warehouse/On-site or At Gasoline Station"
                                    value={formData.place_of_delivery || ''}
                                    onChange={(e) => setFormData({ ...formData, place_of_delivery: e.target.value })}
                                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Delivery Period
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="e.g. Date of Activity, As Per Demand by the End-User, On the Schedule date..."
                                    value={formData.delivery_period || ''}
                                    onChange={(e) => setFormData({ ...formData, delivery_period: e.target.value })}
                                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Payment Method
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="e.g. Staggered Delivery/Credit-basis, One-time Payment/cash-basis, Staggered Payment..."
                                    value={formData.payment_method || ''}
                                    onChange={(e) => setFormData({ ...formData, payment_method: e.target.value })}
                                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Other Terms / Detailed Specifications <span className="text-slate-400 font-normal">(Optional)</span>
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="Specific contract clauses, warranty notes, or billing terms..."
                                    value={formData.other_terms || ''}
                                    onChange={(e) => setFormData({ ...formData, other_terms: e.target.value })}
                                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4 items-center pt-2">
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
                                <div className="flex items-center gap-2 pt-4">
                                    <input
                                        type="checkbox"
                                        id="cond_is_active"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                        className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                    />
                                    <label htmlFor="cond_is_active" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                                        Active for selection
                                    </label>
                                </div>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
                                >
                                    {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                    <span>{editingCondition ? 'Update Condition' : 'Create Condition'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {deleteModalCondition && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                                <Trash2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">
                                    Delete Condition?
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Are you sure you want to delete <strong>"{deleteModalCondition.name}"</strong>?
                                </p>
                            </div>
                        </div>

                        {deleteError && (
                            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                                <span>{deleteError}</span>
                            </div>
                        )}

                        <p className="text-xs text-slate-500 leading-relaxed">
                            Deleting this condition will remove it from the preset dropdown in future PPMP creations. Existing PPMPs that have already adopted these specifications will not be altered.
                        </p>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeleteModalCondition(null)}
                                className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleConfirmDelete}
                                disabled={deleting}
                                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5 cursor-pointer"
                            >
                                {deleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                <span>Confirm Delete</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ProcurementConditionsManagement;
