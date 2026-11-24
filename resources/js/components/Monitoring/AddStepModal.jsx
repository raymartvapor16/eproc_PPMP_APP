import React, { useState } from 'react';
import { X, Plus, Sparkles, AlertCircle, ArrowUp, ArrowDown, Trash2, CheckSquare } from 'lucide-react';
import { monitoringService } from '../../services/api';

export const AddStepModal = ({
    isOpen,
    onClose,
    projectId,
    division,
    isAdminOrSuperAdmin = false,
    onSuccess,
}) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [stepName, setStepName] = useState('');
    const [handledBy, setHandledBy] = useState('');
    const [notes, setNotes] = useState('');
    const [enableChecklist, setEnableChecklist] = useState(false);
    const [checklistItems, setChecklistItems] = useState([
        { id: `chk-${Date.now()}`, label: '' },
    ]);

    if (!isOpen) return null;

    const divisionLabels = {
        pr_division: 'PR Division',
        technical_division: 'Technical Division',
        bac_support_division: 'BAC Support Division',
        contracting_division: 'Contracting Division',
    };

    const handleAddChecklistItem = () => {
        setChecklistItems((prev) => [
            ...prev,
            { id: `chk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, label: '' },
        ]);
    };

    const handleUpdateChecklistLabel = (idx, label) => {
        setChecklistItems((prev) => prev.map((item, i) => (i === idx ? { ...item, label } : item)));
    };

    const handleMoveChecklistItem = (idx, direction) => {
        setChecklistItems((prev) => {
            const targetIdx = idx + direction;
            if (targetIdx < 0 || targetIdx >= prev.length) return prev;
            const copy = [...prev];
            const [moved] = copy.splice(idx, 1);
            copy.splice(targetIdx, 0, moved);
            return copy;
        });
    };

    const handleRemoveChecklistItem = (idx) => {
        setChecklistItems((prev) => prev.filter((_, i) => i !== idx));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!stepName.trim()) {
            setError('Please enter a step title / description.');
            return;
        }

        const validChecklistItems = isAdminOrSuperAdmin && enableChecklist
            ? checklistItems
                .map((item) => ({ ...item, label: item.label.trim() }))
                .filter((item) => item.label.length > 0)
            : [];

        if (isAdminOrSuperAdmin && enableChecklist && validChecklistItems.length === 0) {
            setError('Please enter at least one checkbox label or disable the checklist option.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const payload = {
                division,
                step_name: stepName.trim(),
                handled_by: handledBy.trim() || null,
                notes: notes.trim() || null,
            };
            if (validChecklistItems.length > 0) {
                payload.checklist_data = {
                    items: validChecklistItems.map((item) => ({
                        id: item.id,
                        label: item.label,
                        checked: false,
                        date: null,
                    })),
                };
            }

            const res = await monitoringService.addStep(projectId, payload);

            if (onSuccess) {
                onSuccess(res.data.project);
            }
            setStepName('');
            setHandledBy('');
            setNotes('');
            setEnableChecklist(false);
            setChecklistItems([{ id: `chk-${Date.now()}`, label: '' }]);
            onClose();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Failed to add step to this division.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col">
                <div className="px-6 py-4 bg-gradient-to-r from-slate-900 to-blue-950 text-white flex items-center justify-between">
                    <div>
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <Plus className="w-4 h-4 text-emerald-400" />
                            Add Step to {divisionLabels[division] || division}
                        </h3>
                        <p className="text-[11px] text-slate-300">
                            Custom step will be added to the division workflow
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 transition"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            Step Title / Action <span className="text-rose-500">*</span>
                        </label>
                        <input
                            type="text"
                            required
                            value={stepName}
                            onChange={(e) => setStepName(e.target.value)}
                            placeholder="e.g., Conduct Site Inspection, Supplier Compliance Validation"
                            style={{ color: '#000000' }}
                            className="w-full text-xs p-3 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-none transition font-medium text-black placeholder:text-slate-400"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            Assigned / Handled By
                        </label>
                        <input
                            type="text"
                            value={handledBy}
                            onChange={(e) => setHandledBy(e.target.value)}
                            placeholder="e.g., Engr. Reyes / Staff"
                            style={{ color: '#000000' }}
                            className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-none transition font-medium text-black placeholder:text-slate-400"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            Notes / Instructions
                        </label>
                        <textarea
                            rows={3}
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Optional notes or details for this step..."
                            style={{ color: '#000000' }}
                            className="w-full text-xs p-3 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-none transition font-medium resize-none text-black placeholder:text-slate-400"
                        />
                    </div>

                    {isAdminOrSuperAdmin && (
                        <div className="p-3.5 rounded-xl border border-blue-200 bg-blue-50/50 space-y-3">
                            <label className="flex items-center justify-between gap-2 cursor-pointer">
                                <span className="flex items-center gap-2 text-xs font-bold text-slate-800">
                                    <CheckSquare className="w-4 h-4 text-blue-600" />
                                    <span>Include Checklist Checkboxes (with Date)</span>
                                </span>
                                <input
                                    type="checkbox"
                                    checked={enableChecklist}
                                    onChange={(e) => setEnableChecklist(e.target.checked)}
                                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                                />
                            </label>

                            {enableChecklist && (
                                <div className="space-y-2 pt-1">
                                    <div className="text-[11px] text-slate-600">
                                        Add checkbox items and use the arrows to arrange their display order:
                                    </div>
                                    <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
                                        {checklistItems.map((item, idx) => (
                                            <div key={item.id} className="flex items-center gap-1.5">
                                                <span className="text-[10px] font-bold text-slate-400 w-4 text-center shrink-0">
                                                    {idx + 1}.
                                                </span>
                                                <input
                                                    type="text"
                                                    value={item.label}
                                                    onChange={(e) => handleUpdateChecklistLabel(idx, e.target.value)}
                                                    placeholder={`Checkbox ${idx + 1} label (e.g., Document Verified)`}
                                                    style={{ color: '#000000' }}
                                                    className="flex-1 text-xs p-2 bg-white border border-slate-300 rounded-lg font-medium text-black placeholder:text-slate-400"
                                                />
                                                <button
                                                    type="button"
                                                    disabled={idx === 0}
                                                    onClick={() => handleMoveChecklistItem(idx, -1)}
                                                    title="Move Up"
                                                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                                                >
                                                    <ArrowUp className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={idx === checklistItems.length - 1}
                                                    onClick={() => handleMoveChecklistItem(idx, 1)}
                                                    title="Move Down"
                                                    className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 cursor-pointer"
                                                >
                                                    <ArrowDown className="w-3.5 h-3.5" />
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={checklistItems.length <= 1}
                                                    onClick={() => handleRemoveChecklistItem(idx)}
                                                    title="Remove Checkbox"
                                                    className="p-1.5 rounded-lg border border-rose-200 bg-white text-rose-600 hover:bg-rose-50 disabled:opacity-30 cursor-pointer"
                                                >
                                                    <Trash2 className="w-3.5 h-3.5" />
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleAddChecklistItem}
                                        className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-blue-700 bg-white border border-blue-300 rounded-lg hover:bg-blue-50 cursor-pointer"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                        <span>Add More Checkbox</span>
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-2"
                        >
                            {loading ? 'Adding...' : 'Add Step to Division'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
