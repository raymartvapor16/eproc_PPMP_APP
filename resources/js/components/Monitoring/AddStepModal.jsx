import React, { useState } from 'react';
import { X, Plus, Sparkles, AlertCircle } from 'lucide-react';
import { monitoringService } from '../../services/api';

export const AddStepModal = ({
    isOpen,
    onClose,
    projectId,
    division,
    onSuccess,
}) => {
    if (!isOpen) return null;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [stepName, setStepName] = useState('');
    const [handledBy, setHandledBy] = useState('');
    const [actionDate, setActionDate] = useState(new Date().toISOString().split('T')[0]);
    const [notes, setNotes] = useState('');

    const divisionLabels = {
        pr_division: 'PR Division',
        technical_division: 'Technical Division',
        bac_support_division: 'BAC Support Division',
        contracting_division: 'Contracting Division',
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!stepName.trim()) {
            setError('Please enter a step title / description.');
            return;
        }

        setLoading(true);
        setError('');
        try {
            const res = await monitoringService.addStep(projectId, {
                division,
                step_name: stepName.trim(),
                handled_by: handledBy.trim() || null,
                action_date: actionDate || null,
                notes: notes.trim() || null,
            });

            if (onSuccess) {
                onSuccess(res.data.project);
            }
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

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                                Target / Action Date
                            </label>
                            <input
                                type="date"
                                value={actionDate}
                                onChange={(e) => setActionDate(e.target.value)}
                                style={{ color: '#000000' }}
                                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-none transition font-medium text-black"
                            />
                        </div>
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
