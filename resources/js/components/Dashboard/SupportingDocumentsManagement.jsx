import React, { useState, useEffect, useMemo } from 'react';
import {
    FileCheck2,
    Plus,
    Search,
    Edit2,
    Trash2,
    CheckCircle2,
    AlertCircle,
    RefreshCw,
    X,
    FileText,
    Layers,
    Check,
} from 'lucide-react';
import { supportingDocumentService } from '../../services/api';

export const SupportingDocumentsManagement = () => {
    const [documents, setDocuments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState('ALL'); // 'ALL' | 'ACTIVE' | 'INACTIVE'

    // Form Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingDoc, setEditingDoc] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        is_active: true,
        display_order: 0,
    });
    const [saving, setSaving] = useState(false);
    const [modalError, setModalError] = useState('');

    // Delete Modal state
    const [deleteModalDoc, setDeleteModalDoc] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    // Feedback notification
    const [feedback, setFeedback] = useState({ type: '', text: '' });

    const showFeedback = (type, text) => {
        setFeedback({ type, text });
        setTimeout(() => setFeedback({ type: '', text: '' }), 5000);
    };

    const fetchDocuments = async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        else setRefreshing(true);

        try {
            const res = await supportingDocumentService.getAll();
            setDocuments(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            showFeedback('error', err.response?.data?.message || 'Failed to load Supporting Documents.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchDocuments();
    }, []);

    // Filtered list
    const filteredDocuments = useMemo(() => {
        return documents.filter((doc) => {
            const matchesSearch =
                !searchQuery ||
                doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (doc.description && doc.description.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesStatus =
                statusFilter === 'ALL' ||
                (statusFilter === 'ACTIVE' && doc.is_active) ||
                (statusFilter === 'INACTIVE' && !doc.is_active);

            return matchesSearch && matchesStatus;
        });
    }, [documents, searchQuery, statusFilter]);

    // Open Modal for Add
    const handleOpenAddModal = () => {
        setEditingDoc(null);
        setFormData({
            name: '',
            description: '',
            is_active: true,
            display_order: documents.length > 0 ? (Math.max(...documents.map((d) => d.display_order || 0)) + 1) : 1,
        });
        setModalError('');
        setIsModalOpen(true);
    };

    // Open Modal for Edit
    const handleOpenEditModal = (doc) => {
        setEditingDoc(doc);
        setFormData({
            name: doc.name,
            description: doc.description || '',
            is_active: Boolean(doc.is_active),
            display_order: doc.display_order || 0,
        });
        setModalError('');
        setIsModalOpen(true);
    };

    // Save Doc (Create / Update)
    const handleSaveDoc = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setModalError('Document name is required.');
            return;
        }

        setSaving(true);
        setModalError('');

        try {
            if (editingDoc) {
                await supportingDocumentService.update(editingDoc.id, {
                    name: formData.name.trim(),
                    description: formData.description ? formData.description.trim() : null,
                    is_active: formData.is_active,
                    display_order: parseInt(formData.display_order, 10) || 0,
                });
                showFeedback('success', `Supporting document "${formData.name.trim()}" updated successfully.`);
            } else {
                await supportingDocumentService.create({
                    name: formData.name.trim(),
                    description: formData.description ? formData.description.trim() : null,
                    is_active: formData.is_active,
                    display_order: parseInt(formData.display_order, 10) || 0,
                });
                showFeedback('success', `Supporting document "${formData.name.trim()}" created successfully.`);
            }

            setIsModalOpen(false);
            fetchDocuments(true);
        } catch (err) {
            setModalError(
                err.response?.data?.errors?.name?.[0] ||
                err.response?.data?.message ||
                'An error occurred while saving the document option.'
            );
        } finally {
            setSaving(false);
        }
    };

    // Quick toggle active status
    const handleToggleStatus = async (doc) => {
        try {
            await supportingDocumentService.update(doc.id, {
                name: doc.name,
                description: doc.description,
                is_active: !doc.is_active,
                display_order: doc.display_order,
            });
            showFeedback('success', `"${doc.name}" is now ${!doc.is_active ? 'Active' : 'Inactive'}.`);
            fetchDocuments(true);
        } catch (err) {
            showFeedback('error', err.response?.data?.message || 'Failed to update document status.');
        }
    };

    // Confirm Delete
    const handleDelete = async () => {
        if (!deleteModalDoc) return;
        setDeleting(true);
        setDeleteError('');

        try {
            await supportingDocumentService.delete(deleteModalDoc.id);
            showFeedback('success', `Supporting document "${deleteModalDoc.name}" deleted.`);
            setDeleteModalDoc(null);
            fetchDocuments(true);
        } catch (err) {
            setDeleteError(err.response?.data?.message || 'Failed to delete supporting document.');
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

            {/* Header Banner */}
            <div className="bg-gradient-to-r from-blue-950 via-indigo-950 to-slate-900 rounded-2xl p-6 text-white shadow-md border border-blue-900 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="space-y-1">
                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-500/20 text-blue-300 rounded-full text-xs font-bold border border-blue-400/30">
                        <FileCheck2 className="w-3.5 h-3.5" />
                        <span>Procurement Requirements &amp; Attachments</span>
                    </div>
                    <h2 className="text-xl font-black tracking-tight text-white">
                        Attached Supporting Documents Management
                    </h2>
                    <p className="text-xs text-blue-100/80 max-w-2xl leading-relaxed">
                        Manage options for the <strong>Attached Supporting Documents</strong> column (e.g. 3 Pre Canvass, Market Scoping, Latest PO, List of Attachment). These appear as multi-select checkboxes for end-users when adding or editing PPMP line items.
                    </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    <button
                        type="button"
                        onClick={() => fetchDocuments(true)}
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
                        <span>Add Supporting Document</span>
                    </button>
                </div>
            </div>

            {/* Filter and Search Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="relative w-full sm:w-80">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search document names or descriptions..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                    />
                </div>

                <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                    <div className="flex items-center gap-1 text-xs text-slate-500 font-semibold">
                        <Layers className="w-3.5 h-3.5" />
                        <span>Status:</span>
                    </div>
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                        <option value="ALL">All Statuses ({documents.length})</option>
                        <option value="ACTIVE">Active Only</option>
                        <option value="INACTIVE">Inactive Only</option>
                    </select>
                </div>
            </div>

            {/* Documents Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                        <thead>
                            <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-bold uppercase tracking-wider">
                                <th className="px-4 py-3.5 w-16 text-center">#</th>
                                <th className="px-4 py-3.5">Document Name</th>
                                <th className="px-4 py-3.5">Description / Purpose</th>
                                <th className="px-4 py-3.5 w-28 text-center">Status</th>
                                <th className="px-4 py-3.5 w-32 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <RefreshCw className="w-6 h-6 animate-spin text-blue-600" />
                                            <span className="font-medium text-xs">Loading supporting documents...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : filteredDocuments.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-slate-400">
                                        <div className="flex flex-col items-center justify-center gap-2">
                                            <FileText className="w-8 h-8 text-slate-300" />
                                            <span className="font-semibold text-slate-600">No supporting documents found</span>
                                            <span className="text-[11px] text-slate-400">
                                                {searchQuery
                                                    ? 'Try adjusting your search criteria.'
                                                    : 'Click "Add Supporting Document" to create the first option.'}
                                            </span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                filteredDocuments.map((doc, idx) => (
                                    <tr key={doc.id} className="hover:bg-slate-50/60 transition group">
                                        <td className="px-4 py-3 text-center text-slate-400 font-mono text-[11px]">
                                            {doc.display_order ?? idx + 1}
                                        </td>
                                        <td className="px-4 py-3">
                                            <div className="font-bold text-slate-800 flex items-center gap-2">
                                                <FileCheck2 className="w-4 h-4 text-blue-600 shrink-0" />
                                                <span>{doc.name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-3 text-slate-600 text-[11px] max-w-md">
                                            {doc.description || <span className="text-slate-300 italic">No description provided</span>}
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button
                                                type="button"
                                                onClick={() => handleToggleStatus(doc)}
                                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold cursor-pointer transition border ${
                                                    doc.is_active
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                                        : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                                                }`}
                                                title="Click to toggle status"
                                            >
                                                {doc.is_active ? (
                                                    <>
                                                        <Check className="w-3 h-3 text-emerald-600" /> Active
                                                    </>
                                                ) : (
                                                    <>
                                                        <X className="w-3 h-3 text-slate-400" /> Inactive
                                                    </>
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <div className="flex items-center justify-end gap-1.5 opacity-90 group-hover:opacity-100">
                                                <button
                                                    type="button"
                                                    onClick={() => handleOpenEditModal(doc)}
                                                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                                    title="Edit Document"
                                                >
                                                    <Edit2 className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        setDeleteModalDoc(doc);
                                                        setDeleteError('');
                                                    }}
                                                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                                    title="Delete Document"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="px-4 py-3 bg-slate-50/50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                    <span>
                        Showing <strong>{filteredDocuments.length}</strong> of <strong>{documents.length}</strong> items
                    </span>
                    <span className="text-[11px] text-slate-400">
                        Active items appear in PPMP form dropdowns
                    </span>
                </div>
            </div>

            {/* Modal: Add / Edit Document */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
                        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div className="flex items-center gap-2">
                                <FileCheck2 className="w-5 h-5 text-blue-600" />
                                <h3 className="text-base font-bold text-slate-900">
                                    {editingDoc ? 'Edit Supporting Document' : 'Add Supporting Document'}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveDoc} className="p-6 space-y-4">
                            {modalError && (
                                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{modalError}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Document Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder="e.g. 3 Pre Canvass, Market Scoping, Latest PO..."
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                                />
                                <p className="text-[11px] text-slate-400 mt-1">
                                    This label appears in the multi-select checkbox list in the PPMP items table.
                                </p>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Description / Guidelines (Optional)
                                </label>
                                <textarea
                                    rows={3}
                                    placeholder="Optional notes or details about when this document is required..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4 pt-1">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Display Order
                                    </label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={formData.display_order}
                                        onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
                                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                                    />
                                    <p className="text-[10px] text-slate-400 mt-1">Order in dropdown list.</p>
                                </div>

                                <div className="flex flex-col justify-center">
                                    <label className="block text-xs font-bold text-slate-700 mb-2">Status</label>
                                    <label className="inline-flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.is_active}
                                            onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                            className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500"
                                        />
                                        <span className="text-xs font-semibold text-slate-700">
                                            Active for PPMP selection
                                        </span>
                                    </label>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition shadow-xs cursor-pointer disabled:opacity-50"
                                >
                                    {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                    <span>{editingDoc ? 'Save Changes' : 'Create Option'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal: Confirm Delete */}
            {deleteModalDoc && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-sm overflow-hidden p-6 space-y-4">
                        <div className="flex items-center gap-3 text-rose-600">
                            <div className="p-2.5 rounded-full bg-rose-50 border border-rose-100">
                                <AlertCircle className="w-6 h-6" />
                            </div>
                            <h3 className="text-base font-bold text-slate-900">Delete Supporting Document?</h3>
                        </div>

                        {deleteError && (
                            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs">
                                {deleteError}
                            </div>
                        )}

                        <p className="text-xs text-slate-600 leading-relaxed">
                            Are you sure you want to delete <strong>"{deleteModalDoc.name}"</strong>? Existing PPMPs referencing this document will retain their text record, but it will no longer be available in the dropdown selection.
                        </p>

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                            <button
                                type="button"
                                onClick={() => setDeleteModalDoc(null)}
                                className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-100 transition cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={deleting}
                                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 transition shadow-xs cursor-pointer disabled:opacity-50"
                            >
                                {deleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                <span>Delete Option</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
