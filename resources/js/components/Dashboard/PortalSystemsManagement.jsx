import React, { useState, useEffect } from 'react';
import { portalSystemService } from '../../services/api';
import {
    Globe,
    Plus,
    Edit2,
    Trash2,
    Check,
    X,
    ExternalLink,
    AlertCircle,
    Loader2,
    Layers,
    FileSpreadsheet,
    Activity,
    Shield,
    Sparkles,
    ArrowUpDown,
} from 'lucide-react';

const ICON_OPTIONS = [
    { value: 'FileSpreadsheet', label: 'File / Spreadsheet' },
    { value: 'Activity', label: 'Activity / Real-Time' },
    { value: 'Shield', label: 'Shield / BAC' },
    { value: 'Layers', label: 'Layers / Platform' },
    { value: 'Globe', label: 'Globe / Public Web' },
    { value: 'Sparkles', label: 'Sparkles / AI' },
];

const COLOR_OPTIONS = [
    { value: 'blue', label: 'Blue (Corporate / Navy)' },
    { value: 'emerald', label: 'Emerald (Green / Live)' },
    { value: 'amber', label: 'Amber (Gold / BAC)' },
    { value: 'purple', label: 'Purple (Executive)' },
    { value: 'indigo', label: 'Indigo (Modern)' },
    { value: 'cyan', label: 'Cyan (Digital / Tech)' },
];

export const isExternalLink = (url, isExternalFlag = false) => {
    if (isExternalFlag) return true;
    if (!url) return false;
    const str = String(url).trim();
    if (str.startsWith('/') || str.startsWith('#')) return false;
    if (/^https?:\/\//i.test(str) || str.startsWith('//')) return true;
    if (str.includes('.') && !str.startsWith('/')) return true;
    return false;
};

export const normalizeDestinationUrl = (url) => {
    if (!url) return '/';
    const str = String(url).trim();
    if (str.startsWith('/') || str.startsWith('#')) return str;
    if (/^https?:\/\//i.test(str) || str.startsWith('//')) return str;
    return `https://${str}`;
};

export const PortalSystemsManagement = () => {
    const [systems, setSystems] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingSystem, setEditingSystem] = useState(null);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [feedback, setFeedback] = useState({ type: '', text: '' });

    const [form, setForm] = useState({
        name: '',
        description: '',
        link_url: '',
        badge: '',
        icon: 'FileSpreadsheet',
        color: 'blue',
        status: 'active',
        sort_order: 1,
        is_external: false,
    });

    const fetchSystems = async () => {
        setLoading(true);
        try {
            const res = await portalSystemService.getAll();
            setSystems(res.data || []);
        } catch (e) {
            console.error('Failed to load systems', e);
            setFeedback({ type: 'error', text: 'Failed to load systems catalog.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSystems();
    }, []);

    const handleOpenCreate = () => {
        setEditingSystem(null);
        setForm({
            name: '',
            description: '',
            link_url: '',
            badge: 'Online System',
            icon: 'FileSpreadsheet',
            color: 'blue',
            status: 'active',
            sort_order: (systems.length > 0 ? Math.max(...systems.map(s => s.sort_order || 0)) + 1 : 1),
            is_external: false,
        });
        setModalOpen(true);
    };

    const handleOpenEdit = (system) => {
        setEditingSystem(system);
        setForm({
            name: system.name || '',
            description: system.description || '',
            link_url: system.link_url || '',
            badge: system.badge || '',
            icon: system.icon || 'FileSpreadsheet',
            color: system.color || 'blue',
            status: system.status || 'active',
            sort_order: system.sort_order || 1,
            is_external: Boolean(system.is_external || isExternalLink(system.link_url)),
        });
        setModalOpen(true);
    };

    const handleUrlChange = (val) => {
        const isExt = isExternalLink(val);
        setForm(prev => ({
            ...prev,
            link_url: val,
            is_external: isExt ? true : (val.startsWith('/') ? false : prev.is_external),
        }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setFeedback({ type: '', text: '' });

        let cleanUrl = (form.link_url || '').trim();
        let isExt = Boolean(form.is_external);

        if (/^(https?:\/\/|\/\/)/i.test(cleanUrl)) {
            isExt = true;
        } else if (!cleanUrl.startsWith('/') && !cleanUrl.startsWith('#') && cleanUrl.includes('.')) {
            cleanUrl = `https://${cleanUrl}`;
            isExt = true;
        } else if (isExt && !cleanUrl.startsWith('/') && !cleanUrl.startsWith('http')) {
            cleanUrl = `https://${cleanUrl}`;
        }

        const payload = {
            ...form,
            link_url: cleanUrl,
            is_external: isExt,
        };

        try {
            if (editingSystem) {
                await portalSystemService.update(editingSystem.id, payload);
                setFeedback({ type: 'success', text: `System "${form.name}" updated successfully.` });
            } else {
                await portalSystemService.create(payload);
                setFeedback({ type: 'success', text: `System "${form.name}" created successfully.` });
            }
            setModalOpen(false);
            await fetchSystems();
        } catch (err) {
            setFeedback({
                type: 'error',
                text: err.response?.data?.message || 'Failed to save system.',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Are you sure you want to delete "${name}" from the system catalog?`)) return;
        setDeletingId(id);
        try {
            await portalSystemService.delete(id);
            setFeedback({ type: 'success', text: `System "${name}" deleted.` });
            await fetchSystems();
        } catch (err) {
            setFeedback({ type: 'error', text: err.response?.data?.message || 'Failed to delete system.' });
        } finally {
            setDeletingId(null);
        }
    };

    const handleToggleStatus = async (id) => {
        try {
            const res = await portalSystemService.toggleStatus(id);
            setSystems(prev => prev.map(s => s.id === id ? res.data.system : s));
            setFeedback({ type: 'success', text: res.data.message || 'Status updated.' });
        } catch (err) {
            setFeedback({ type: 'error', text: err.response?.data?.message || 'Failed to update status.' });
        }
    };

    return (
        <div className="space-y-6">
            {/* Header Tile */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-blue-50 text-blue-700">
                            <Globe className="w-5 h-5" />
                        </span>
                        <h2 className="text-xl font-bold text-slate-900">Portal Systems Catalog</h2>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                        Manage the digital systems and provincial application cards displayed on the public landing page.
                    </p>
                </div>
                <button
                    onClick={handleOpenCreate}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold text-xs tracking-wider uppercase shadow-md shadow-blue-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    <Plus className="w-4 h-4" />
                    Add New System
                </button>
            </div>

            {feedback.text && (
                <div
                    className={`p-4 rounded-xl border text-sm flex items-center justify-between ${
                        feedback.type === 'error'
                            ? 'bg-rose-50 border-rose-200 text-rose-800'
                            : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}
                >
                    <div className="flex items-center gap-2">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{feedback.text}</span>
                    </div>
                    <button onClick={() => setFeedback({ type: '', text: '' })} className="hover:opacity-75">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

            {/* List Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-500">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mb-3" />
                        <p className="text-sm font-medium">Loading systems catalog...</p>
                    </div>
                ) : systems.length === 0 ? (
                    <div className="py-20 text-center text-slate-400">
                        <Globe className="w-12 h-12 mx-auto stroke-[1.2] mb-3 text-slate-300" />
                        <p className="text-base font-semibold text-slate-700">No systems configured yet</p>
                        <p className="text-sm text-slate-400 mt-1">Click "Add New System" to publish a provincial system card.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-700">
                            <thead className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                <tr>
                                    <th className="py-3.5 px-4 w-12 text-center">#</th>
                                    <th className="py-3.5 px-4">System Name & Description</th>
                                    <th className="py-3.5 px-4">Badge / Theme</th>
                                    <th className="py-3.5 px-4">Destination Link</th>
                                    <th className="py-3.5 px-4 text-center">Status</th>
                                    <th className="py-3.5 px-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {systems.map((system) => (
                                    <tr key={system.id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="py-3.5 px-4 text-center text-xs font-bold text-slate-400">
                                            {system.sort_order}
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <div className="font-bold text-slate-900 flex items-center gap-2">
                                                <span>{system.name}</span>
                                                {(system.is_external || isExternalLink(system.link_url)) && (
                                                    <span className="inline-flex items-center gap-1 text-[10px] bg-amber-50 text-amber-700 border border-amber-200/60 px-1.5 py-0.5 rounded font-normal">
                                                        <ExternalLink className="w-2.5 h-2.5" /> External
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-slate-500 line-clamp-1 max-w-md mt-0.5">
                                                {system.description || 'No description provided'}
                                            </div>
                                        </td>
                                        <td className="py-3.5 px-4">
                                            <span
                                                className={`inline-block px-2.5 py-1 rounded-full text-[11px] font-bold ${
                                                    system.color === 'emerald'
                                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                                        : system.color === 'amber'
                                                        ? 'bg-amber-50 text-amber-800 border border-amber-200'
                                                        : system.color === 'purple'
                                                        ? 'bg-purple-50 text-purple-700 border border-purple-200'
                                                        : 'bg-blue-50 text-blue-700 border border-blue-200'
                                                }`}
                                            >
                                                {system.badge || 'General'}
                                            </span>
                                        </td>
                                        <td className="py-3.5 px-4 font-mono text-xs max-w-xs">
                                            {isExternalLink(system.link_url, system.is_external) ? (
                                                <a
                                                    href={normalizeDestinationUrl(system.link_url)}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 hover:underline text-blue-600 hover:text-blue-800 font-semibold"
                                                    title={`Opens external: ${normalizeDestinationUrl(system.link_url)}`}
                                                >
                                                    <span className="truncate">{system.link_url}</span>
                                                    <ExternalLink className="w-3 h-3 shrink-0 opacity-70" />
                                                </a>
                                            ) : (
                                                <span className="text-slate-700">{system.link_url}</span>
                                            )}
                                        </td>
                                        <td className="py-3.5 px-4 text-center">
                                            <button
                                                onClick={() => handleToggleStatus(system.id)}
                                                className={`px-2.5 py-1 rounded-full text-xs font-semibold cursor-pointer transition ${
                                                    system.status === 'active'
                                                        ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                                        : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                                                }`}
                                            >
                                                {system.status === 'active' ? 'Active' : 'Inactive'}
                                            </button>
                                        </td>
                                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                                            <div className="inline-flex items-center gap-1.5">
                                                <button
                                                    onClick={() => handleOpenEdit(system)}
                                                    className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-blue-50 transition"
                                                    title="Edit System"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(system.id, system.name)}
                                                    disabled={deletingId === system.id}
                                                    className="p-1.5 rounded-lg text-slate-500 hover:text-rose-600 hover:bg-rose-50 transition disabled:opacity-50"
                                                    title="Delete System"
                                                >
                                                    {deletingId === system.id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                                                    ) : (
                                                        <Trash2 className="w-4 h-4" />
                                                    )}
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-5 bg-gradient-to-r from-slate-900 to-blue-950 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <Globe className="w-5 h-5 text-blue-400" />
                                <h3 className="font-bold text-base">
                                    {editingSystem ? 'Edit Portal System' : 'Add New Portal System'}
                                </h3>
                            </div>
                            <button
                                onClick={() => setModalOpen(false)}
                                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                    System Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="e.g., E-Procurement PPMP & APP System"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                    Short Description
                                </label>
                                <textarea
                                    rows="2"
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="Brief overview of features and purpose..."
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                        Destination URL / Path *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={form.link_url}
                                        onChange={(e) => handleUrlChange(e.target.value)}
                                        placeholder="e.g. /eprocrementppmpapp or https://..."
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm font-mono text-xs"
                                    />
                                    {form.link_url && (
                                        <div className="mt-1.5 text-[11px]">
                                            {isExternalLink(form.link_url, form.is_external) ? (
                                                <span className="text-amber-600 font-medium flex items-center gap-1">
                                                    <ExternalLink className="w-3 h-3 shrink-0" />
                                                    External link &bull; will open: <span className="underline font-mono">{normalizeDestinationUrl(form.link_url)}</span>
                                                </span>
                                            ) : (
                                                <span className="text-emerald-600 font-medium flex items-center gap-1">
                                                    <Check className="w-3 h-3 shrink-0" />
                                                    Internal system route &bull; opens within portal
                                                </span>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                        Card Badge Text
                                    </label>
                                    <input
                                        type="text"
                                        value={form.badge}
                                        onChange={(e) => setForm({ ...form, badge: e.target.value })}
                                        placeholder="e.g., Primary System, Live Monitoring"
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                        Color Theme
                                    </label>
                                    <select
                                        value={form.color}
                                        onChange={(e) => setForm({ ...form, color: e.target.value })}
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 text-sm"
                                    >
                                        {COLOR_OPTIONS.map(c => (
                                            <option key={c.value} value={c.value}>{c.label}</option>
                                        ))}
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                        Sort Order
                                    </label>
                                    <input
                                        type="number"
                                        value={form.sort_order}
                                        onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                        Status
                                    </label>
                                    <select
                                        value={form.status}
                                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 text-sm"
                                    >
                                        <option value="active">Active</option>
                                        <option value="inactive">Inactive</option>
                                    </select>
                                </div>
                            </div>

                            <div className="pt-2 flex items-center justify-between">
                                <label className="inline-flex items-center gap-2 cursor-pointer text-xs font-semibold text-slate-700">
                                    <input
                                        type="checkbox"
                                        checked={form.is_external}
                                        onChange={(e) => setForm({ ...form, is_external: e.target.checked })}
                                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 w-4 h-4"
                                    />
                                    <span>Opens in new tab (External Website)</span>
                                </label>
                            </div>

                            <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
                                <button
                                    type="button"
                                    onClick={() => setModalOpen(false)}
                                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider shadow-md shadow-blue-500/20 disabled:opacity-50"
                                >
                                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {editingSystem ? 'Save Changes' : 'Create System'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
