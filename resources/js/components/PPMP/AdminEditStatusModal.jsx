import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ppmpService } from '../../services/api';
import { StatusBadge, PPMP_STATUS_OPTIONS, getStatusConfig } from '../UI/StatusBadge';
import { Edit3, X, Loader2, ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';

export const AdminEditStatusModal = ({
    isOpen,
    onClose,
    ppmp,
    onUpdated,
}) => {
    const [selectedStatus, setSelectedStatus] = useState(ppmp?.status || 'DRAFT');
    const [remarks, setRemarks] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isOpen && ppmp) {
            setSelectedStatus(ppmp.status || 'DRAFT');
            setRemarks('');
            setError('');
        }
    }, [isOpen, ppmp]);

    if (!isOpen || !ppmp) return null;

    const currentStatusConfig = getStatusConfig(ppmp.status);
    const targetStatusConfig = getStatusConfig(selectedStatus);
    const isUnchanged = selectedStatus === ppmp.status;

    const groupedOptions = PPMP_STATUS_OPTIONS.reduce((acc, opt) => {
        if (!acc[opt.group]) acc[opt.group] = [];
        acc[opt.group].push(opt);
        return acc;
    }, {});

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (isUnchanged) {
            onClose();
            return;
        }

        setSaving(true);
        setError('');
        try {
            const res = await ppmpService.updateStatus(ppmp.uuid, {
                status: selectedStatus,
                remarks: remarks.trim() || undefined,
            });
            if (onUpdated) {
                await onUpdated(res.data?.ppmp || null);
            }
            window.dispatchEvent(new CustomEvent('notifications:reload'));
            onClose();
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to update PPMP status.');
        } finally {
            setSaving(false);
        }
    };

    const modalContent = (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fade-in-up"
            onClick={() => !saving && onClose()}
        >
            <div
                className="bg-white rounded-2xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden pims-modal-content"
                onClick={(e) => e.stopPropagation()}
            >

                <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
                            <Edit3 className="w-4 h-4" />
                        </div>
                        <div>
                            <h3 className="text-sm font-bold tracking-tight">
                                Change / Override PPMP Status
                            </h3>
                            <p className="text-[11px] text-slate-300">
                                Administrator &amp; Super Administrator Workflow Status Control
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        disabled={saving}
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">

                    <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="font-mono text-xs font-bold text-blue-900">
                                {ppmp.tracking_number || `PPMP No. ${ppmp.ppmp_number}`}
                            </span>
                            {ppmp.ppmp_number !== undefined && ppmp.ppmp_number !== null && (
                                <span className="font-mono text-[11px] font-semibold text-slate-600">
                                    PPMP No. {ppmp.ppmp_number}
                                </span>
                            )}
                        </div>
                        <div className="text-xs font-semibold text-slate-800 line-clamp-2">
                            {ppmp.title}
                        </div>
                        {ppmp.office?.name && (
                            <div className="text-[11px] text-slate-500">
                                Office: {ppmp.office.name}
                            </div>
                        )}
                    </div>

                    <div className="p-3 rounded-xl bg-blue-50/60 border border-blue-200/80 flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Current Status
                            </span>
                            <StatusBadge status={ppmp.status} />
                        </div>
                        <ArrowRight className="w-4 h-4 text-slate-400 shrink-0" />
                        <div className="flex flex-col gap-1 items-end">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">
                                New Status
                            </span>
                            <StatusBadge status={selectedStatus} />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            Select New PPMP Status <span className="text-rose-500">*</span>
                        </label>
                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            disabled={saving}
                            className="w-full text-xs font-semibold p-2.5 border border-slate-300 rounded-lg bg-white text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                        >
                            {Object.entries(groupedOptions).map(([groupName, options]) => (
                                <optgroup key={groupName} label={groupName}>
                                    {options.map((opt) => (
                                        <option key={opt.value} value={opt.value}>
                                            {opt.label} ({opt.value})
                                        </option>
                                    ))}
                                </optgroup>
                            ))}
                        </select>
                        {targetStatusConfig?.desc && (
                            <p className="text-[11px] text-slate-500 mt-1.5">
                                {targetStatusConfig.desc}
                            </p>
                        )}
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            Reason / Audit Remarks <span className="text-slate-400 font-normal">(Optional)</span>
                        </label>
                        <textarea
                            rows={3}
                            value={remarks}
                            onChange={(e) => setRemarks(e.target.value)}
                            disabled={saving}
                            placeholder="Enter reason or remarks for changing this PPMP status (recorded in Routing History & Change Logs)..."
                            className="w-full text-xs p-2.5 border border-slate-300 rounded-lg bg-white text-black focus:ring-2 focus:ring-blue-500 focus:border-blue-500 focus:outline-none"
                        />
                    </div>

                    <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 flex items-start gap-2 text-[11px] text-amber-900">
                        <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <span>
                            Changing the status will update the PPMP workflow stage immediately and record an official entry in the Routing Timeline &amp; Audit Trail.
                        </span>
                    </div>

                    {error && (
                        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs font-semibold text-rose-700">
                            {error}
                        </div>
                    )}

                    <div className="pt-2 flex items-center justify-end gap-2 border-t border-slate-200">
                        <button
                            type="button"
                            disabled={saving}
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-100 text-xs font-bold uppercase tracking-wider transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={saving || isUnchanged}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider shadow-sm transition disabled:opacity-50 cursor-pointer"
                        >
                            {saving ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Updating...</span>
                                </>
                            ) : (
                                <>
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                    <span>Save Status</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );

    return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
