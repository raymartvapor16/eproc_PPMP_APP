import React, { useState, useEffect, useMemo } from 'react';
import {
    Leaf,
    Plus,
    Search,
    Edit2,
    Trash2,
    CheckCircle2,
    AlertCircle,
    RefreshCw,
    X,
    FileText,
    Sparkles,
    Layers,
    Tag,
} from 'lucide-react';
import { otherTermService } from '../../services/api';

export const OtherTermsManagement = () => {
    const [terms, setTerms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingTerm, setEditingTerm] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        category: 'CSE',
        description: '',
        is_active: true,
        display_order: 0,
    });
    const [saving, setSaving] = useState(false);
    const [modalError, setModalError] = useState('');

    const [deleteModalTerm, setDeleteModalTerm] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    const [feedback, setFeedback] = useState({ type: '', text: '' });

    const showFeedback = (type, text) => {
        setFeedback({ type, text });
        setTimeout(() => setFeedback({ type: '', text: '' }), 5000);
    };

    const fetchTerms = async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        else setRefreshing(true);

        try {
            const res = await otherTermService.getAll();
            setTerms(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            showFeedback('error', err.response?.data?.message || 'Failed to load Other Terms.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchTerms();
    }, []);

    const filteredTerms = useMemo(() => {
        return terms.filter((t) => {
            const matchesSearch =
                !searchQuery ||
                t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (t.category && t.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesCategory =
                categoryFilter === 'ALL' ||
                (t.category && t.category.toUpperCase() === categoryFilter.toUpperCase());

            const matchesStatus =
                statusFilter === 'ALL' ||
                (statusFilter === 'ACTIVE' && t.is_active) ||
                (statusFilter === 'INACTIVE' && !t.is_active);

            return matchesSearch && matchesCategory && matchesStatus;
        });
    }, [terms, searchQuery, categoryFilter, statusFilter]);

    const handleOpenAddModal = () => {
        setEditingTerm(null);
        setFormData({
            name: '',
            category: 'CSE',
            description: '',
            is_active: true,
            display_order: terms.length > 0 ? (Math.max(...terms.map((t) => t.display_order || 0)) + 1) : 1,
        });
        setModalError('');
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (term) => {
        setEditingTerm(term);
        setFormData({
            name: term.name,
            category: term.category || 'CSE',
            description: term.description || '',
            is_active: Boolean(term.is_active),
            display_order: term.display_order || 0,
        });
        setModalError('');
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setModalError('Term / Specification Name is required.');
            return;
        }
        if (!formData.description.trim()) {
            setModalError('Specifications / Terms content is required.');
            return;
        }

        setSaving(true);
        setModalError('');

        try {
            if (editingTerm) {
                const res = await otherTermService.update(editingTerm.id, formData);
                showFeedback('success', res.data?.message || 'Other Term updated successfully.');
            } else {
                const res = await otherTermService.create(formData);
                showFeedback('success', res.data?.message || 'Other Term created successfully.');
            }
            setIsModalOpen(false);
            fetchTerms(true);
        } catch (err) {
            setModalError(
                err.response?.data?.errors?.name?.[0] ||
                err.response?.data?.message ||
                'Failed to save Other Term.'
            );
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (term) => {
        try {
            await otherTermService.update(term.id, {
                ...term,
                is_active: !term.is_active,
            });
            showFeedback('success', `"${term.name}" marked as ${!term.is_active ? 'Active' : 'Inactive'}.`);
            fetchTerms(true);
        } catch (err) {
            showFeedback('error', err.response?.data?.message || 'Failed to update status.');
        }
    };

    const handleConfirmDelete = async () => {
        if (!deleteModalTerm) return;

        setDeleting(true);
        setDeleteError('');

        try {
            const res = await otherTermService.delete(deleteModalTerm.id);
            showFeedback('success', res.data?.message || 'Other Term deleted successfully.');
            setDeleteModalTerm(null);
            fetchTerms(true);
        } catch (err) {
            setDeleteError(err.response?.data?.message || 'Failed to delete Other Term.');
        } finally {
            setDeleting(false);
        }
    };

    const getCategoryBadge = (category) => {
        const cat = (category || '').toUpperCase();
        if (cat === 'CSE') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                    <Leaf className="w-2.5 h-2.5" /> CSE (Common-Use)
                </span>
            );
        }
        if (cat === 'NON-CSE') {
            return (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    <Sparkles className="w-2.5 h-2.5" /> NON-CSE
                </span>
            );
        }
        return (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-300">
                <Tag className="w-2.5 h-2.5" /> General / Other
            </span>
        );
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

            <div className="bg-gradient-to-r from-emerald-950 via-teal-950 to-slate-900 rounded-2xl p-6 text-white shadow-md border border-emerald-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-bold border border-emerald-400/30">
                        <Leaf className="w-3.5 h-3.5" />
                        <span>Green Specifications &amp; Procurement Clauses</span>
                    </div>
                    <h2 className="text-xl font-black tracking-tight text-white">
                        Other Terms &amp; Green Specifications Management
                    </h2>
                    <p className="text-xs text-emerald-100/80 max-w-2xl leading-relaxed">
                        Configure official <strong>Green Specifications</strong> (Common-Use &amp; Non-Common Supplies) and standard warranty clauses. These appear in the <strong>Other Terms</strong> dropdown when end-users prepare PPMPs.
                    </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={() => fetchTerms(true)}
                        disabled={refreshing || loading}
                        className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition border border-white/10 cursor-pointer disabled:opacity-50"
                        title="Refresh List"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        type="button"
                        onClick={handleOpenAddModal}
                        className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-lg shadow-emerald-600/30 border border-emerald-400/30 cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add Other Term</span>
                    </button>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search specifications, terms, category..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white transition"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                    <div className="flex items-center gap-1 text-xs text-slate-500 font-semibold">
                        <Layers className="w-3.5 h-3.5" />
                        <span>Category:</span>
                    </div>
                    <select
                        value={categoryFilter}
                        onChange={(e) => setCategoryFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                    >
                        <option value="ALL">All Categories ({terms.length})</option>
                        <option value="CSE">CSE (Common-Use Supplies)</option>
                        <option value="NON-CSE">NON-CSE (Non-Common Supplies)</option>
                        <option value="GENERAL">General / Contractual</option>
                    </select>

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
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
                                <th className="px-5 py-3.5 w-32">Category</th>
                                <th className="px-5 py-3.5 w-72">Name / Title</th>
                                <th className="px-5 py-3.5">Specifications / Terms Content</th>
                                <th className="px-5 py-3.5 w-24 text-center">Status</th>
                                <th className="px-5 py-3.5 w-28 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                                        <div className="inline-flex items-center gap-2 font-medium">
                                            <RefreshCw className="w-4 h-4 animate-spin text-emerald-500" />
                                            <span>Loading other terms and specifications...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredTerms.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-5 py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <FileText className="w-8 h-8 text-slate-300" />
                                            <span className="font-semibold text-slate-600">No Other Terms found.</span>
                                            <span className="text-[11px] text-slate-400">Try adjusting your search query or filters.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredTerms.map((term, index) => (
                                    <tr key={term.id} className="hover:bg-slate-50/70 transition">
                                        <td className="px-5 py-3.5 text-center font-bold text-slate-400">
                                            {term.display_order || index + 1}
                                        </td>
                                        <td className="px-5 py-3.5">
                                            {getCategoryBadge(term.category)}
                                        </td>
                                        <td className="px-5 py-3.5 font-bold text-slate-900">
                                            {term.name}
                                        </td>
                                        <td className="px-5 py-3.5 text-slate-600 font-medium">
                                            <div className="max-w-xl text-[11px] leading-relaxed whitespace-pre-line line-clamp-3 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                                                {term.description}
                                            </div>
                                        </td>
                                        <td className="px-5 py-3.5 text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleActive(term)}
                                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer ${
                                                    term.is_active
                                                        ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200'
                                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200 border border-slate-200'
                                                }`}
                                                title="Click to toggle status"
                                            >
                                                <span className={`w-1.5 h-1.5 rounded-full ${term.is_active ? 'bg-emerald-500' : 'bg-slate-400'}`} />
                                                <span>{term.is_active ? 'Active' : 'Inactive'}</span>
                                            </button>
                                        </td>
                                        <td className="px-5 py-3.5 text-right space-x-1">
                                            <button
                                                type="button"
                                                onClick={() => handleOpenEditModal(term)}
                                                className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                                title="Edit Term"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setDeleteModalTerm(term);
                                                    setDeleteError('');
                                                }}
                                                className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                                title="Delete Term"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="p-4 bg-slate-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Leaf className="w-4 h-4 text-emerald-400" />
                                <h3 className="text-sm font-bold">
                                    {editingTerm ? 'Edit Other Term / Green Spec' : 'Add New Other Term / Green Spec'}
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
                                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{modalError}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    Specification / Term Name: <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. Green Spec: Computer, Monitor & Laptop"
                                    value={formData.name || ''}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-semibold"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                        Category: <span className="text-rose-500">*</span>
                                    </label>
                                    <select
                                        value={formData.category || 'CSE'}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-medium"
                                    >
                                        <option value="CSE">CSE (Common-Use Supplies)</option>
                                        <option value="NON-CSE">NON-CSE (Non-Common Supplies)</option>
                                        <option value="GENERAL">General / Contractual / POL</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                        Display Order:
                                    </label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.display_order ?? 0}
                                        onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value) || 0 })}
                                        className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
                                    Green Specifications / Terms Clauses: <span className="text-rose-500">*</span>
                                </label>
                                <textarea
                                    rows={6}
                                    required
                                    placeholder="Enter bullet points or terms clauses...&#10;- Can be recycled/can be re-used&#10;- Preferably at least Elemental Chlorine Free (ECF)&#10;- Packaging must be recyclable"
                                    value={formData.description || ''}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full text-xs p-2.5 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 font-mono text-slate-800"
                                />
                                <p className="text-[11px] text-slate-400 mt-1">
                                    This exact text will be inserted into the PPMP Other Terms field when selected by the end-user.
                                </p>
                            </div>

                            <div className="flex items-center gap-2 pt-2">
                                <input
                                    type="checkbox"
                                    id="is_active_check"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500 cursor-pointer"
                                />
                                <label htmlFor="is_active_check" className="text-xs font-semibold text-slate-700 cursor-pointer">
                                    Active (Available in Create PPMP dropdowns)
                                </label>
                            </div>

                            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : editingTerm ? 'Update Term' : 'Create Term'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {deleteModalTerm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
                        <div className="p-4 bg-rose-900 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Trash2 className="w-4 h-4 text-rose-300" />
                                <h3 className="text-sm font-bold">Confirm Deletion</h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setDeleteModalTerm(null)}
                                className="text-rose-200 hover:text-white cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            {deleteError && (
                                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{deleteError}</span>
                                </div>
                            )}

                            <p className="text-xs text-slate-600 leading-relaxed">
                                Are you sure you want to permanently delete the term/specification{' '}
                                <strong className="text-slate-900 font-bold">"{deleteModalTerm.name}"</strong>?
                            </p>
                            <p className="text-[11px] text-slate-500">
                                This will remove it from the dropdown choices for future PPMPs. Existing PPMPs that have already copied this term will remain intact.
                            </p>

                            <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-2.5">
                                <button
                                    type="button"
                                    onClick={() => setDeleteModalTerm(null)}
                                    className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="button"
                                    onClick={handleConfirmDelete}
                                    disabled={deleting}
                                    className="px-5 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
                                >
                                    {deleting ? 'Deleting...' : 'Delete Term'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OtherTermsManagement;
