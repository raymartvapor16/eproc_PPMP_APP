import React, { useState, useEffect, useRef } from 'react';
import { oppmoTeamService } from '../../services/api';
import {
    Users,
    Plus,
    Edit2,
    Trash2,
    X,
    Upload,
    ImageIcon,
    AlertCircle,
    Loader2,
    Award,
} from 'lucide-react';

export const OppmoTeamManagement = () => {
    const [members, setMembers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingMember, setEditingMember] = useState(null);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState(null);
    const [feedback, setFeedback] = useState({ type: '', text: '' });

    const [form, setForm] = useState({
        name: '',
        position: '',
        photo_url: '',
        sort_order: 1,
        status: 'active',
    });

    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const fileInputRef = useRef(null);

    const fetchMembers = async () => {
        setLoading(true);
        try {
            const res = await oppmoTeamService.getAll();
            setMembers(res.data || []);
        } catch (e) {
            console.error('Failed to load team members', e);
            setFeedback({ type: 'error', text: 'Failed to load OPPMO team members.' });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMembers();
    }, []);

    const handleOpenCreate = () => {
        setEditingMember(null);
        setSelectedFile(null);
        setPreviewUrl('');
        setForm({
            name: '',
            position: '',
            photo_url: '',
            sort_order: (members.length > 0 ? Math.max(...members.map(m => m.sort_order || 0)) + 1 : 1),
            status: 'active',
        });
        setModalOpen(true);
    };

    const handleOpenEdit = (member) => {
        setEditingMember(member);
        setSelectedFile(null);
        setPreviewUrl(member.photo_url || '');
        setForm({
            name: member.name || '',
            position: member.position || '',
            photo_url: member.photo_url || '',
            sort_order: member.sort_order || 1,
            status: member.status || 'active',
        });
        setModalOpen(true);
    };

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert('File exceeds 5MB size limit. Please select a smaller image.');
            return;
        }

        setSelectedFile(file);

        // Create base64 preview
        const reader = new FileReader();
        reader.onload = (uploadEvent) => {
            const result = uploadEvent.target.result;
            setPreviewUrl(result);
            setForm(prev => ({ ...prev, photo_url: result }));
        };
        reader.readAsDataURL(file);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setFeedback({ type: '', text: '' });

        try {
            // Using JSON or FormData if file selected
            let payload;
            if (selectedFile) {
                payload = new FormData();
                payload.append('name', form.name);
                payload.append('position', form.position);
                payload.append('sort_order', form.sort_order);
                payload.append('status', form.status);
                payload.append('photo', selectedFile);
            } else {
                payload = { ...form };
            }

            if (editingMember) {
                await oppmoTeamService.update(editingMember.id, payload);
                setFeedback({ type: 'success', text: `Team member "${form.name}" updated successfully.` });
            } else {
                await oppmoTeamService.create(payload);
                setFeedback({ type: 'success', text: `Team member "${form.name}" added successfully.` });
            }
            setModalOpen(false);
            await fetchMembers();
        } catch (err) {
            setFeedback({
                type: 'error',
                text: err.response?.data?.message || 'Failed to save team member.',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id, name) => {
        if (!confirm(`Are you sure you want to remove "${name}" from the OPPMO team roster?`)) return;
        setDeletingId(id);
        try {
            await oppmoTeamService.delete(id);
            setFeedback({ type: 'success', text: `Team member "${name}" removed.` });
            await fetchMembers();
        } catch (err) {
            setFeedback({ type: 'error', text: err.response?.data?.message || 'Failed to remove member.' });
        } finally {
            setDeletingId(null);
        }
    };

    const handleToggleStatus = async (id) => {
        try {
            const res = await oppmoTeamService.toggleStatus(id);
            setMembers(prev => prev.map(m => m.id === id ? res.data.member : m));
            setFeedback({ type: 'success', text: res.data.message || 'Status updated.' });
        } catch (err) {
            setFeedback({ type: 'error', text: err.response?.data?.message || 'Failed to toggle status.' });
        }
    };

    return (
        <div className="space-y-6">
            {/* Header Tile */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <div className="flex items-center gap-2">
                        <span className="p-2 rounded-xl bg-amber-50 text-amber-700">
                            <Users className="w-5 h-5" />
                        </span>
                        <h2 className="text-xl font-bold text-slate-900">OPPMO Office Team & Leadership</h2>
                    </div>
                    <p className="text-sm text-slate-500 mt-1">
                        Manage the department heads, BAC Secretariat officers, and team profiles showcased in the About Us section.
                    </p>
                </div>
                <button
                    onClick={handleOpenCreate}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-700 hover:to-amber-800 text-white font-semibold text-xs tracking-wider uppercase shadow-md shadow-amber-500/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                >
                    <Plus className="w-4 h-4" />
                    Add Team Member
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

            {/* Members Cards Grid */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden p-6">
                {loading ? (
                    <div className="py-20 flex flex-col items-center justify-center text-slate-500">
                        <Loader2 className="w-8 h-8 animate-spin text-amber-600 mb-3" />
                        <p className="text-sm font-medium">Loading OPPMO team roster...</p>
                    </div>
                ) : members.length === 0 ? (
                    <div className="py-20 text-center text-slate-400">
                        <Users className="w-12 h-12 mx-auto stroke-[1.2] mb-3 text-slate-300" />
                        <p className="text-base font-semibold text-slate-700">No team members added yet</p>
                        <p className="text-sm text-slate-400 mt-1">Click "Add Team Member" to add leadership and office staff.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {members.map((member) => (
                            <div
                                key={member.id}
                                className="group relative bg-slate-50/80 hover:bg-white rounded-2xl p-5 border border-slate-200 hover:border-amber-400/80 hover:shadow-lg transition-all duration-200 flex flex-col justify-between"
                            >
                                <div>
                                    {/* Card Top: Avatar & Status */}
                                    <div className="flex items-start justify-between gap-3 mb-4">
                                        <div className="relative">
                                            {member.photo_url ? (
                                                <img
                                                    src={member.photo_url}
                                                    alt={member.name}
                                                    className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md shadow-slate-200/50"
                                                />
                                            ) : (
                                                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 text-white font-bold flex items-center justify-center text-xl shadow-md border-2 border-white">
                                                    {member.name.charAt(0)}
                                                </div>
                                            )}
                                            <span className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-slate-900 text-amber-400 text-[10px] font-black flex items-center justify-center border-2 border-white">
                                                {member.sort_order}
                                            </span>
                                        </div>

                                        <button
                                            onClick={() => handleToggleStatus(member.id)}
                                            className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold transition cursor-pointer ${
                                                member.status === 'active'
                                                    ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200'
                                                    : 'bg-slate-200 text-slate-600 hover:bg-slate-300'
                                            }`}
                                        >
                                            {member.status === 'active' ? 'Active' : 'Inactive'}
                                        </button>
                                    </div>

                                    {/* Member Info: Name and Designation ONLY */}
                                    <h3 className="font-bold text-slate-900 text-base leading-snug">
                                        {member.name}
                                    </h3>
                                    <div className="text-xs font-semibold text-amber-800 mt-1.5 flex items-start gap-1.5">
                                        <Award className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                                        <span className="break-words leading-snug">{member.position}</span>
                                    </div>
                                </div>

                                {/* Card Actions */}
                                <div className="mt-5 pt-3 border-t border-slate-200/80 flex items-center justify-end gap-2">
                                    <button
                                        onClick={() => handleOpenEdit(member)}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50 transition"
                                    >
                                        <Edit2 className="w-3.5 h-3.5" />
                                        <span>Edit</span>
                                    </button>
                                    <button
                                        onClick={() => handleDelete(member.id, member.name)}
                                        disabled={deletingId === member.id}
                                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-slate-700 hover:text-rose-600 hover:bg-rose-50 transition disabled:opacity-50"
                                    >
                                        {deletingId === member.id ? (
                                            <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-600" />
                                        ) : (
                                            <Trash2 className="w-3.5 h-3.5" />
                                        )}
                                        <span>Delete</span>
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Modal */}
            {modalOpen && (
                <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-100 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="p-5 bg-gradient-to-r from-slate-900 to-amber-950 text-white flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <Users className="w-5 h-5 text-amber-400" />
                                <h3 className="font-bold text-base">
                                    {editingMember ? 'Edit OPPMO Team Member' : 'Add New Team Member'}
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
                            {/* Photo Upload / Preview Row */}
                            <div className="flex items-center gap-5 p-4 bg-slate-50 rounded-2xl border border-slate-200">
                                <div className="relative shrink-0">
                                    {previewUrl ? (
                                        <img
                                            src={previewUrl}
                                            alt="Preview"
                                            className="w-20 h-20 rounded-2xl object-cover border-2 border-amber-500 shadow-md"
                                        />
                                    ) : (
                                        <div className="w-20 h-20 rounded-2xl bg-slate-200 border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400">
                                            <ImageIcon className="w-6 h-6 stroke-[1.5]" />
                                            <span className="text-[10px] mt-1 font-semibold">No Image</span>
                                        </div>
                                    )}
                                </div>
                                <div className="space-y-1.5 flex-1 min-w-0">
                                    <div className="text-xs font-bold text-slate-700">Official Portrait Photo</div>
                                    <p className="text-[11px] text-slate-500">
                                        Upload a professional photo (JPG, PNG, WebP max 5MB) or specify image URL below.
                                    </p>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />
                                    <div className="flex items-center gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => fileInputRef.current?.click()}
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white hover:bg-slate-100 border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs"
                                        >
                                            <Upload className="w-3.5 h-3.5 text-amber-600" />
                                            Upload Image File
                                        </button>
                                        {previewUrl && (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setPreviewUrl('');
                                                    setSelectedFile(null);
                                                    setForm(prev => ({ ...prev, photo_url: '' }));
                                                }}
                                                className="px-2.5 py-1.5 text-xs text-rose-600 hover:bg-rose-50 rounded-lg font-medium"
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                    Full Name & Honorifics *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="e.g., NORJANNA M. CAMAGUIN, MPA"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                    Position / Designation *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={form.position}
                                    onChange={(e) => setForm({ ...form, position: e.target.value })}
                                    placeholder="e.g., Provincial Government Department Head"
                                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                        Display Sort Order
                                    </label>
                                    <input
                                        type="number"
                                        value={form.sort_order}
                                        onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 text-sm"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 mb-1">
                                        Status
                                    </label>
                                    <select
                                        value={form.status}
                                        onChange={(e) => setForm({ ...form, status: e.target.value })}
                                        className="w-full px-3 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-amber-500 text-sm"
                                    >
                                        <option value="active">Active (Visible on Landing Page)</option>
                                        <option value="inactive">Inactive (Hidden)</option>
                                    </select>
                                </div>
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
                                    className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider shadow-md shadow-amber-500/20 disabled:opacity-50"
                                >
                                    {saving && <Loader2 className="w-4 h-4 animate-spin" />}
                                    {editingMember ? 'Save Changes' : 'Add Team Member'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
