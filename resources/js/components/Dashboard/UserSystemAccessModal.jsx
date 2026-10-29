import React, { useState, useEffect } from 'react';
import { X, Layers, Check, Shield, AlertCircle, Loader2, Sparkles, CheckCircle2 } from 'lucide-react';
import { userService, portalSystemService } from '../../services/api';

const DEFAULT_SYSTEMS = [
    { id: 1, name: 'E-Procurement PPMP & APP System', link_url: '/eprocrementppmpapp', badge: 'Primary System', description: 'PPMP preparation, annual procurement planning, reviews, and BAC approvals.' },
    { id: 2, name: 'OPPMO Real-Time Monitoring System', link_url: '/monitoringsystem', badge: 'Live Monitoring', description: 'Milestone tracking, and purchase request timelines.' },
    { id: 3, name: 'Supplier Evaluation System', link_url: '/supplierevaluation', badge: 'Supplier Rating', description: 'Province-wide Supplier Performance Evaluation, Purchase Order Management, and Semester Analytics.' },
];

export const UserSystemAccessModal = ({
    isOpen,
    onClose,
    targetUser,
    onSuccess,
}) => {
    if (!isOpen || !targetUser) return null;

    const [systems, setSystems] = useState(DEFAULT_SYSTEMS);
    const [selectedUrls, setSelectedUrls] = useState([]);
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    // Fetch latest portal systems
    useEffect(() => {
        let isMounted = true;
        const fetchSystems = async () => {
            setLoading(true);
            try {
                const res = await portalSystemService.getPublic();
                if (isMounted && res.data && res.data.length > 0) {
                    setSystems(res.data);
                }
            } catch (err) {
                console.warn('Failed to fetch public systems for access modal, using defaults', err);
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        fetchSystems();
        return () => { isMounted = false; };
    }, []);

    // Initialize user's current accessible systems
    useEffect(() => {
        if (!targetUser) return;
        setError('');
        setSuccessMessage('');

        if (Array.isArray(targetUser.accessible_systems) && targetUser.accessible_systems.length > 0) {
            setSelectedUrls(targetUser.accessible_systems);
        } else {
            // Default based on role
            if (targetUser.role === 'super_admin' || targetUser.role === 'admin' || targetUser.role === 'administrator') {
                setSelectedUrls(['/eprocrementppmpapp', '/monitoringsystem', '/supplierevaluation']);
            } else if (targetUser.role === 'monitor') {
                setSelectedUrls(['/monitoringsystem']);
            } else if (targetUser.role === 'pgso' || targetUser.role === 'presentative_staff') {
                setSelectedUrls(['/supplierevaluation']);
            } else {
                setSelectedUrls(['/eprocrementppmpapp']);
            }
        }
    }, [targetUser]);

    const handleToggleSystem = (url) => {
        setSelectedUrls((prev) => {
            if (prev.includes(url)) {
                return prev.filter((u) => u !== url);
            } else {
                return [...prev, url];
            }
        });
    };

    const handleSelectAll = () => {
        setSelectedUrls(systems.map((s) => s.link_url));
    };

    const handleClearAll = () => {
        setSelectedUrls([]);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        if (selectedUrls.length === 0) {
            setError('Please grant access to at least one system so the user can use their account.');
            return;
        }

        setSaving(true);
        try {
            const res = await userService.updateSystemAccess(targetUser.id, selectedUrls);
            setSuccessMessage(res.data?.message || 'System access permissions updated successfully.');
            if (onSuccess) {
                onSuccess(res.data?.user || { ...targetUser, accessible_systems: selectedUrls });
            }
            setTimeout(() => {
                onClose();
            }, 1200);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update system access permissions.');
        } finally {
            setSaving(false);
        }
    };

    const isSuperOrAdmin = targetUser.role === 'super_admin' || targetUser.role === 'admin';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-150">
            <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-purple-500/20 border border-purple-400/30 flex items-center justify-center text-purple-300">
                            <Layers className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold text-white tracking-wide">
                                Manage Digital Systems Access
                            </h3>
                            <p className="text-[11px] text-slate-300">
                                Face-to-Face Employee Request Management
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-4 text-xs">
                    {/* User Profile Card */}
                    <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                        <div>
                            <div className="font-bold text-slate-900 text-sm">
                                {targetUser.name}
                            </div>
                            <div className="text-[11px] text-slate-500">
                                {targetUser.email} • {targetUser.designation || 'Staff'}
                            </div>
                            <div className="text-[10px] text-slate-400 mt-0.5">
                                Office: <span className="font-semibold text-slate-600">{targetUser.office?.name || 'Provincial Government'}</span>
                            </div>
                        </div>
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-100 text-blue-800 border border-blue-200">
                            {targetUser.role?.replace('_', ' ')}
                        </span>
                    </div>

                    {/* Notice */}
                    <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-purple-900 flex items-start gap-2.5">
                        <Shield className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
                        <div className="text-[11px] leading-relaxed">
                            <strong className="font-bold">In-Person Access Management:</strong> When personnel visit the OPPMO office in person requesting permission to use specific digital systems, toggle their permitted systems below to update their credentials immediately.
                        </div>
                    </div>

                    {isSuperOrAdmin && (
                        <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>This user is an Administrator. Administrators inherently possess master access to all provincial digital systems.</span>
                        </div>
                    )}

                    {error && (
                        <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}

                    {successMessage && (
                        <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs flex items-center gap-2">
                            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                            <span className="font-semibold">{successMessage}</span>
                        </div>
                    )}

                    {/* Systems Checklist */}
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                                Permitted Digital Systems ({selectedUrls.length} selected)
                            </label>
                            <div className="flex items-center gap-2 text-[11px]">
                                <button
                                    type="button"
                                    onClick={handleSelectAll}
                                    className="text-blue-600 hover:text-blue-800 font-bold hover:underline"
                                >
                                    Select All
                                </button>
                                <span className="text-slate-300">•</span>
                                <button
                                    type="button"
                                    onClick={handleClearAll}
                                    className="text-slate-500 hover:text-slate-700 font-medium hover:underline"
                                >
                                    Clear All
                                </button>
                            </div>
                        </div>

                        {loading ? (
                            <div className="py-8 text-center text-slate-400">
                                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-purple-600" />
                                <span>Loading provincial systems catalog...</span>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                {systems.map((sys) => {
                                    const isChecked = selectedUrls.includes(sys.link_url);
                                    return (
                                        <label
                                            key={sys.id || sys.link_url}
                                            className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition ${
                                                isChecked
                                                    ? 'bg-purple-50/70 border-purple-300 shadow-2xs'
                                                    : 'bg-white border-slate-200 hover:bg-slate-50'
                                            }`}
                                        >
                                            <input
                                                type="checkbox"
                                                checked={isChecked}
                                                onChange={() => handleToggleSystem(sys.link_url)}
                                                className="mt-0.5 w-4 h-4 text-purple-600 rounded border-slate-300 focus:ring-purple-500 cursor-pointer shrink-0"
                                            />
                                            <div className="min-w-0 flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="text-xs font-bold text-slate-900 leading-snug">
                                                        {sys.name}
                                                    </span>
                                                    {sys.badge && (
                                                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-200">
                                                            {sys.badge}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                                                    Target URL: <span className="text-blue-600 font-semibold">{sys.link_url}</span>
                                                </div>
                                                {sys.description && (
                                                    <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                                                        {sys.description}
                                                    </p>
                                                )}
                                            </div>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Footer Buttons */}
                    <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-2.5">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={saving}
                            className="px-4 py-2 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-100 font-bold transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving}
                            className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition shadow-md shadow-purple-600/20 disabled:opacity-50"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Saving Permissions...</span>
                                </>
                            ) : (
                                <>
                                    <Check className="w-4 h-4" />
                                    <span>Save System Permissions</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
