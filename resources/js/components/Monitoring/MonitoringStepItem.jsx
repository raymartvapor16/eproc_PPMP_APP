import React, { useState } from 'react';
import {
    CheckCircle2,
    Clock,
    AlertTriangle,
    RotateCcw,
    Trash2,
    Edit3,
    Check,
    X,
    User,
    Calendar,
    Award,
    FileText,
    ShieldAlert,
    ChevronDown,
    ChevronUp,
    Sparkles,
    ArrowRight
} from 'lucide-react';
import { monitoringService } from '../../services/api';

export const MonitoringStepItem = ({
    step,
    index,
    projectId,
    isBacDecision = false,
    isTechnicalCb = false,
    onStepUpdated,
}) => {
    const [isEditing, setIsEditing] = useState(false);
    const [loading, setLoading] = useState(false);

    // Form fields
    const [status, setStatus] = useState(step.status || 'PENDING');
    const [decision, setDecision] = useState(step.decision || '');
    const [notes, setNotes] = useState(step.notes || '');
    const [handledBy, setHandledBy] = useState(step.handled_by || '');
    const [actionDate, setActionDate] = useState(step.action_date ? step.action_date.split('T')[0] : '');

    const handleSave = async () => {
        setLoading(true);
        try {
            const res = await monitoringService.updateStep(step.id, {
                status,
                decision: isBacDecision ? decision : step.decision,
                notes,
                handled_by: handledBy,
                action_date: actionDate || null,
            });
            setIsEditing(false);
            if (onStepUpdated) onStepUpdated(res.data.project);
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || 'Failed to update step.');
        } finally {
            setLoading(false);
        }
    };

    const handleQuickStatus = async (newStatus) => {
        setLoading(true);
        try {
            const res = await monitoringService.updateStep(step.id, {
                status: newStatus,
            });
            setStatus(newStatus);
            if (onStepUpdated) onStepUpdated(res.data.project);
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || 'Failed to update status.');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm(`Are you sure you want to delete step: "${step.step_name}"?`)) return;
        setLoading(true);
        try {
            const res = await monitoringService.deleteStep(step.id);
            if (onStepUpdated) onStepUpdated(res.data.project);
        } catch (err) {
            console.error(err);
            alert(err.response?.data?.message || 'Failed to delete step.');
        } finally {
            setLoading(false);
        }
    };

    const getStatusStyle = () => {
        switch (step.status) {
            case 'COMPLETED':
            case 'APPROVED':
                return {
                    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
                    icon: <CheckCircle2 className="w-4 h-4 text-emerald-600" />,
                    bar: 'bg-emerald-500',
                };
            case 'IN_PROGRESS':
                return {
                    badge: 'bg-blue-100 text-blue-800 border-blue-200',
                    icon: <Clock className="w-4 h-4 text-blue-600 animate-pulse" />,
                    bar: 'bg-blue-500',
                };
            case 'SUSPENDED':
                return {
                    badge: 'bg-amber-100 text-amber-900 border-amber-300',
                    icon: <AlertTriangle className="w-4 h-4 text-amber-600" />,
                    bar: 'bg-amber-500',
                };
            case 'RETURNED':
                return {
                    badge: 'bg-rose-100 text-rose-800 border-rose-300',
                    icon: <RotateCcw className="w-4 h-4 text-rose-600" />,
                    bar: 'bg-rose-500',
                };
            default:
                return {
                    badge: 'bg-slate-100 text-slate-600 border-slate-200',
                    icon: <Clock className="w-4 h-4 text-slate-400" />,
                    bar: 'bg-slate-300',
                };
        }
    };

    const style = getStatusStyle();

    return (
        <div className="relative pl-7 pb-6 last:pb-1 group">
            {/* Timeline vertical connector */}
            <div className="absolute left-[11px] top-5 bottom-0 w-0.5 bg-slate-200 group-last:hidden" />

            {/* Timeline icon node */}
            <div
                className={`absolute left-0 top-1 w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-xs ${
                    step.status === 'COMPLETED' || step.status === 'APPROVED'
                        ? 'bg-emerald-600 text-white'
                        : step.status === 'IN_PROGRESS'
                        ? 'bg-blue-600 text-white'
                        : step.status === 'SUSPENDED'
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-200 text-slate-500'
                }`}
            >
                <span className="text-[10px] font-bold">{index + 1}</span>
            </div>

            {/* Card Content */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs hover:shadow-xs transition duration-150">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-bold text-slate-900">
                                {step.step_name}
                            </span>
                            <span
                                className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${style.badge}`}
                            >
                                {step.status}
                            </span>
                            {step.is_custom && (
                                <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-purple-100 text-purple-700 border border-purple-200">
                                    Custom Step
                                </span>
                            )}
                        </div>

                        {/* Special CB Notice */}
                        {(isTechnicalCb || step.special_badge) && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-900 text-[11px] font-semibold mt-1">
                                <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                                <span>Note: For CB only Miss Sharia release the documents</span>
                            </div>
                        )}

                        {/* Decision badge if present */}
                        {step.decision && (
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-teal-50 border border-teal-200 text-teal-900 text-[11px] font-bold mt-1">
                                <Award className="w-3.5 h-3.5 text-teal-600" />
                                <span>
                                    Decision: {step.decision === 'awarded' && 'Awarded (Release to TWG & Transmit to Contracting)'}
                                    {step.decision === 're_canvass_1st' && '1st Opening Re-canvass'}
                                    {step.decision === 're_canvass_2nd' && '2nd Opening For Mandatory'}
                                    {step.decision === 're_canvass_3rd' && '3rd Opening Returned to End-user'}
                                    {step.decision === 'approved' && 'Approved'}
                                    {step.decision === 'suspended' && 'Suspended / Hold'}
                                </span>
                            </div>
                        )}

                        {/* Handled by & Action date */}
                        <div className="flex flex-wrap items-center gap-4 text-[11px] text-slate-500 pt-1">
                            {step.handled_by && (
                                <span className="flex items-center gap-1">
                                    <User className="w-3 h-3 text-slate-400" />
                                    <span>Handled by: <strong className="text-slate-700 font-semibold">{step.handled_by}</strong></span>
                                </span>
                            )}
                            {step.action_date && (
                                <span className="flex items-center gap-1">
                                    <Calendar className="w-3 h-3 text-slate-400" />
                                    <span>Target / Date: <strong className="text-slate-700 font-semibold">{new Date(step.action_date).toLocaleDateString()}</strong></span>
                                </span>
                            )}
                            {step.completed_at && (
                                <span className="text-emerald-700 font-medium">
                                    ✓ Completed: {new Date(step.completed_at).toLocaleDateString()}
                                </span>
                            )}
                        </div>

                        {step.notes && (
                            <div className="text-[11px] text-slate-600 bg-slate-50 p-2 rounded-lg border border-slate-100 mt-2">
                                <span className="font-semibold text-slate-700">Remarks: </span>
                                {step.notes}
                            </div>
                        )}
                    </div>

                    {/* Quick Actions & Edit Toggle */}
                    <div className="flex items-center gap-1 shrink-0 self-end sm:self-start">
                        {step.status !== 'COMPLETED' && step.status !== 'APPROVED' && (
                            <button
                                type="button"
                                disabled={loading}
                                onClick={() => handleQuickStatus('COMPLETED')}
                                title="Mark Completed / Approved"
                                className="p-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                            >
                                <Check className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Done</span>
                            </button>
                        )}

                        <button
                            type="button"
                            onClick={() => setIsEditing(!isEditing)}
                            className="p-1.5 rounded-lg text-slate-500 hover:text-blue-600 hover:bg-slate-100 transition cursor-pointer"
                            title="Edit Step Details"
                        >
                            <Edit3 className="w-3.5 h-3.5" />
                        </button>

                        <button
                            type="button"
                            disabled={loading}
                            onClick={handleDelete}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                            title="Delete Step (Add/Delete supported across all divisions)"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>

                {/* Inline Editing Form */}
                {isEditing && (
                    <div className="mt-4 pt-4 border-t border-slate-100 bg-slate-50/80 -mx-4 -mb-4 p-4 rounded-b-xl space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                    Step Status
                                </label>
                                <select
                                    value={status}
                                    onChange={(e) => setStatus(e.target.value)}
                                    style={{ color: '#000000' }}
                                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-medium text-black"
                                >
                                    <option value="PENDING" style={{ color: '#000000' }}>Pending</option>
                                    <option value="IN_PROGRESS" style={{ color: '#000000' }}>In Progress</option>
                                    <option value="APPROVED" style={{ color: '#000000' }}>Approved</option>
                                    <option value="COMPLETED" style={{ color: '#000000' }}>Completed</option>
                                    <option value="SUSPENDED" style={{ color: '#000000' }}>Suspended / Need to Comply</option>
                                    <option value="RETURNED" style={{ color: '#000000' }}>Returned to End-user</option>
                                </select>
                            </div>

                            {/* BAC Decision selector */}
                            {isBacDecision ? (
                                <div>
                                    <label className="block text-[11px] font-bold text-indigo-700 uppercase mb-1">
                                        BAC Decision (Awarded / Re-canvass)
                                    </label>
                                    <select
                                        value={decision}
                                        onChange={(e) => {
                                            setDecision(e.target.value);
                                            if (e.target.value === 'awarded') {
                                                setStatus('COMPLETED');
                                            } else if (e.target.value === 're_canvass_3rd') {
                                                setStatus('RETURNED');
                                            } else if (e.target.value) {
                                                setStatus('IN_PROGRESS');
                                            }
                                        }}
                                        style={{ color: '#000000' }}
                                        className="w-full text-xs p-2 bg-indigo-50/60 border border-indigo-300 rounded-lg font-bold text-black"
                                    >
                                        <option value="" style={{ color: '#000000' }}>-- Select Decision --</option>
                                        <option value="awarded" style={{ color: '#000000' }}>Awarded (BAC Support received docs from TWG)</option>
                                        <option value="re_canvass_1st" style={{ color: '#000000' }}>1st Opening: Re-canvass</option>
                                        <option value="re_canvass_2nd" style={{ color: '#000000' }}>2nd Opening: For mandatory</option>
                                        <option value="re_canvass_3rd" style={{ color: '#000000' }}>3rd Opening: Returned to End-user</option>
                                    </select>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                        Target / Action Date
                                    </label>
                                    <input
                                        type="date"
                                        value={actionDate}
                                        onChange={(e) => setActionDate(e.target.value)}
                                        style={{ color: '#000000' }}
                                        className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-medium text-black"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            <div>
                                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                    Assigned / Handled By
                                </label>
                                <input
                                    type="text"
                                    value={handledBy}
                                    onChange={(e) => setHandledBy(e.target.value)}
                                    placeholder="Name of personnel or unit"
                                    style={{ color: '#000000' }}
                                    className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-medium text-black placeholder:text-slate-400"
                                />
                            </div>

                            {isBacDecision && (
                                <div>
                                    <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                        Action Date
                                    </label>
                                    <input
                                        type="date"
                                        value={actionDate}
                                        onChange={(e) => setActionDate(e.target.value)}
                                        style={{ color: '#000000' }}
                                        className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-medium text-black"
                                    />
                                </div>
                            )}
                        </div>

                        <div>
                            <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                                Notes & Compliance Remarks
                            </label>
                            <input
                                type="text"
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                placeholder="Add notes, requirements to comply, or transmittal references..."
                                style={{ color: '#000000' }}
                                className="w-full text-xs p-2 bg-white border border-slate-300 rounded-lg font-medium text-black placeholder:text-slate-400"
                            />
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setIsEditing(false)}
                                className="px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg cursor-pointer"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                disabled={loading}
                                onClick={handleSave}
                                className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg cursor-pointer shadow-xs"
                            >
                                {loading ? 'Saving...' : 'Save Step Details'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
