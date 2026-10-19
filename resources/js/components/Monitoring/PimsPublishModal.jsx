import React, { useState, useEffect } from 'react';
import { X, Send, Sparkles, Building2, User, FileText, Banknote, ShieldAlert, CheckCircle2, Layers } from 'lucide-react';
import { monitoringService } from '../../services/api';

export const PimsPublishModal = ({
    isOpen,
    onClose,
    ppmp = null,
    onSuccess,
}) => {
    if (!isOpen) return null;

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        project_title: '',
        category: 'GOODS_CONSULTING', // 'GOODS_CONSULTING' or 'INFRA'
        procurement_mode: 'SVP',
        abc_amount: '',
        pr_number: '',
        pims_pr_id: '',
        implementing_unit: '',
        end_user_name: '',
        remarks: '',
        ppmp_uuid: '',
    });

    useEffect(() => {
        if (ppmp) {
            // Determine project category from items or default
            let detectedCategory = 'GOODS_CONSULTING';
            let detectedMode = 'SVP';
            const firstItem = ppmp.items?.find((i) => !i.is_header);

            if (firstItem) {
                if (firstItem.project_type?.toLowerCase().includes('infra')) {
                    detectedCategory = 'INFRA';
                }
                if (firstItem.procurement_mode) {
                    if (firstItem.procurement_mode.toLowerCase().includes('bidding') || firstItem.procurement_mode.toLowerCase().includes('cb')) {
                        detectedMode = 'CB';
                    } else {
                        detectedMode = firstItem.procurement_mode;
                    }
                }
            }

            setFormData({
                project_title: ppmp.title || firstItem?.description || '',
                category: detectedCategory,
                procurement_mode: detectedMode,
                abc_amount: ppmp.total_budget || '',
                pr_number: ppmp.tracking_number || ppmp.ppmp_number || '',
                pims_pr_id: ppmp.pims_pr_id || '',
                implementing_unit: ppmp.implementing_unit || ppmp.office?.name || '',
                end_user_name: ppmp.creator?.name || '',
                remarks: `Published to PIMS from PPMP Tracker No. ${ppmp.tracking_number || ppmp.ppmp_number || ''}`,
                ppmp_uuid: ppmp.uuid || '',
            });
        } else {
            setFormData({
                project_title: '',
                category: 'GOODS_CONSULTING',
                procurement_mode: 'SVP',
                abc_amount: '',
                pr_number: '',
                pims_pr_id: '',
                implementing_unit: '',
                end_user_name: '',
                remarks: '',
                ppmp_uuid: '',
            });
        }
    }, [ppmp]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!formData.project_title.trim()) {
            setError('Please specify what the end-user is procuring (Project Title).');
            return;
        }

        setLoading(true);
        try {
            const res = await monitoringService.publishPims(formData);

            // Also mark local storage so the reminder card updates
            if (formData.ppmp_uuid) {
                try {
                    const stored = localStorage.getItem('pims_published_ppmps');
                    const map = stored ? JSON.parse(stored) : {};
                    map[formData.ppmp_uuid] = {
                        publishedAt: new Date().toISOString(),
                        monitoredProjectId: res.data.project?.id,
                        projectTitle: formData.project_title,
                    };
                    localStorage.setItem('pims_published_ppmps', JSON.stringify(map));
                } catch (e) {
                    console.error(e);
                }
            }

            window.dispatchEvent(new CustomEvent('monitoring:updated', { detail: res.data }));
            window.dispatchEvent(new CustomEvent('pims:published', { detail: { ppmp_uuid: formData.ppmp_uuid } }));

            if (onSuccess) {
                onSuccess(res.data.project);
            }
            onClose();
        } catch (err) {
            console.error(err);
            setError(err.response?.data?.message || 'Failed to record PIMS publication and monitoring entry.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Modal Header */}
                <div className="px-6 py-4.5 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-400/30 flex items-center justify-center text-blue-300">
                            <Sparkles className="w-5 h-5 text-amber-300" />
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-white tracking-tight">
                                PIMS Publish Confirmation & Procurement Input
                            </h2>
                            <p className="text-xs text-blue-200">
                                Enter procurement details to register and initiate OPPMO monitoring workflow
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-1.5 rounded-lg text-blue-200 hover:text-white hover:bg-white/10 transition cursor-pointer"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Form Content */}
                <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 pims-modal-content">
                    {error && (
                        <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-700 flex items-start gap-2">
                            <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <div className="bg-amber-50/80 border border-amber-200 rounded-xl p-3 text-xs text-amber-900 flex items-start gap-2.5">
                        <CheckCircle2 className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <span className="font-bold">OPPMO Process Initiation: </span>
                            Confirming this will mark the PPMP as published to the PIMS system and automatically start the 4-division monitoring process (PR, Technical, BAC Support, and Contracting divisions).
                        </div>
                    </div>

                    {/* What the enduser procure is */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            What is the End-User Procuring? (Project Title / Description) <span className="text-rose-500">*</span>
                        </label>
                        <div className="relative">
                            <textarea
                                required
                                rows={3}
                                value={formData.project_title}
                                onChange={(e) => setFormData({ ...formData, project_title: e.target.value })}
                                placeholder="e.g., Procurement of Medical and Hospital Supplies for Davao del Sur Provincial Hospital"
                                style={{ color: '#000000' }}
                                className="w-full text-xs p-3 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-none transition shadow-2xs font-medium resize-none text-black placeholder:text-slate-400"
                            />
                        </div>
                    </div>

                    {/* Category: GOODS/CONSULTING vs INFRA */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                Procurement Classification <span className="text-rose-500">*</span>
                            </label>
                            <div className="grid grid-cols-2 gap-2">
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, category: 'GOODS_CONSULTING' })}
                                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                        formData.category === 'GOODS_CONSULTING'
                                            ? 'bg-blue-50 border-blue-500 text-blue-700 shadow-xs'
                                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    <Layers className="w-3.5 h-3.5" />
                                    Goods & Consulting
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setFormData({ ...formData, category: 'INFRA' })}
                                    className={`px-3 py-2.5 rounded-xl border text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer ${
                                        formData.category === 'INFRA'
                                            ? 'bg-amber-50 border-amber-500 text-amber-800 shadow-xs'
                                            : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                                    }`}
                                >
                                    <Building2 className="w-3.5 h-3.5" />
                                    Infrastructure (INFRA)
                                </button>
                            </div>
                        </div>

                        {/* Mode of Procurement */}
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                Mode of Procurement <span className="text-rose-500">*</span>
                            </label>
                            <select
                                required
                                value={formData.procurement_mode}
                                onChange={(e) => setFormData({ ...formData, procurement_mode: e.target.value })}
                                style={{ color: '#000000' }}
                                className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-none transition font-semibold text-black"
                            >
                                <option value="SVP" style={{ color: '#000000' }}>Small Value Procurement (SVP)</option>
                                <option value="CB" style={{ color: '#000000' }}>Competitive Bidding (CB / Public Bidding)</option>
                                <option value="DIRECT_CONTRACTING" style={{ color: '#000000' }}>Direct Contracting</option>
                                <option value="REPEAT_ORDER" style={{ color: '#000000' }}>Repeat Order</option>
                                <option value="SHOPPING" style={{ color: '#000000' }}>Shopping (Section 52.1b)</option>
                                <option value="NEGOTIATED" style={{ color: '#000000' }}>Negotiated Procurement (Two-Failed Biddings, etc.)</option>
                                <option value="AGENCY_TO_AGENCY" style={{ color: '#000000' }}>Agency-to-Agency</option>
                            </select>
                        </div>
                    </div>

                    {/* PPMP / Tracker No, PIMS PR ID & ABC Amount */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                PPMP / Tracker No
                            </label>
                            <div className="relative">
                                <FileText className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                                <input
                                    type="text"
                                    value={formData.pr_number}
                                    onChange={(e) => setFormData({ ...formData, pr_number: e.target.value })}
                                    placeholder="e.g., PPMOGOODS-2026-..."
                                    style={{ color: '#000000' }}
                                    className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-none transition font-medium text-black placeholder:text-slate-400"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-indigo-700 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                                <span>PIMS PR ID</span>
                                <span className="text-[10px] text-indigo-600 font-semibold">(From PIMS)</span>
                            </label>
                            <div className="relative">
                                <FileText className="w-4 h-4 text-indigo-500 absolute left-3 top-3" />
                                <input
                                    type="text"
                                    value={formData.pims_pr_id}
                                    onChange={(e) => setFormData({ ...formData, pims_pr_id: e.target.value })}
                                    placeholder="e.g., PPMOGOODS-2026-001"
                                    style={{ color: '#000000' }}
                                    className="w-full text-xs pl-9 pr-3 py-2.5 bg-indigo-50/60 border border-indigo-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 focus:outline-none transition font-bold text-black placeholder:text-slate-400"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                ABC Budget (₱)
                            </label>
                            <div className="relative">
                                <Banknote className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                                <input
                                    type="number"
                                    step="0.01"
                                    value={formData.abc_amount}
                                    onChange={(e) => setFormData({ ...formData, abc_amount: e.target.value })}
                                    placeholder="0.00"
                                    style={{ color: '#000000' }}
                                    className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-none transition font-mono font-semibold text-black placeholder:text-slate-400"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Implementing Unit & End User */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                Implementing Unit / Department
                            </label>
                            <div className="relative">
                                <Building2 className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                                <input
                                    type="text"
                                    value={formData.implementing_unit}
                                    onChange={(e) => setFormData({ ...formData, implementing_unit: e.target.value })}
                                    placeholder="e.g., Provincial Health Office"
                                    style={{ color: '#000000' }}
                                    className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-none transition font-medium text-black placeholder:text-slate-400"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                                End-User Contact / Officer
                            </label>
                            <div className="relative">
                                <User className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                                <input
                                    type="text"
                                    value={formData.end_user_name}
                                    onChange={(e) => setFormData({ ...formData, end_user_name: e.target.value })}
                                    placeholder="e.g., Dr. Juan Dela Cruz"
                                    style={{ color: '#000000' }}
                                    className="w-full text-xs pl-9 pr-3 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-none transition font-medium text-black placeholder:text-slate-400"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Remarks */}
                    <div>
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                            Initial Notes / Remarks
                        </label>
                        <input
                            type="text"
                            value={formData.remarks}
                            onChange={(e) => setFormData({ ...formData, remarks: e.target.value })}
                            placeholder="Optional notes or reference details..."
                            style={{ color: '#000000' }}
                            className="w-full text-xs p-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 focus:outline-none transition font-medium text-black placeholder:text-slate-400"
                        />
                    </div>

                    {/* Modal Footer */}
                    <div className="pt-4 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold tracking-wide transition shadow-md shadow-blue-500/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Processing...</span>
                                </>
                            ) : (
                                <>
                                    <Send className="w-3.5 h-3.5" />
                                    <span>Confirm Publish & Start Monitoring</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
