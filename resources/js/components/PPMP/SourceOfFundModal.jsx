import React, { useState, useEffect } from 'react';
import { X, Landmark, ShieldCheck, ArrowRight, CheckCircle2, ChevronRight, RefreshCw } from 'lucide-react';
import { fundSourceService } from '../../services/api';

export const FUND_SOURCES = {
    GENERAL_FUND: 'General Fund',
    TRUST_FUND: 'Trust Fund',
};

export const SourceOfFundModal = ({ isOpen, onClose, onSelect }) => {
    const [fundOptions, setFundOptions] = useState([
        {
            id: 'default_gf',
            name: FUND_SOURCES.GENERAL_FUND,
            workflow_route: 'budget',
            description: 'General Fund, 20% Development Fund, Special Education Fund (SEF), and standard budgetary allocations.',
        },
        {
            id: 'default_tf',
            name: FUND_SOURCES.TRUST_FUND,
            workflow_route: 'pacco',
            description: 'National agency subsidies, grants, trust deposits, and fiduciary funds requiring Provincial Accounting Office (PACCO) certification.',
        },
    ]);
    const [selectedFund, setSelectedFund] = useState(FUND_SOURCES.GENERAL_FUND);
    const [loading, setLoading] = useState(false);

    // Fetch dynamic active fund sources when modal opens
    useEffect(() => {
        if (!isOpen) return;

        let isMounted = true;
        const loadSources = async () => {
            setLoading(true);
            try {
                const res = await fundSourceService.getAll({ active_only: 1 });
                if (isMounted && Array.isArray(res.data) && res.data.length > 0) {
                    setFundOptions(res.data);
                    // If current selection is not in list, select the first option
                    const currentExists = res.data.some((f) => f.name === selectedFund);
                    if (!currentExists) {
                        setSelectedFund(res.data[0].name);
                    }
                }
            } catch (err) {
                // Keep default fallback options
            } finally {
                if (isMounted) setLoading(false);
            }
        };

        loadSources();
        return () => {
            isMounted = false;
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleConfirm = () => {
        if (!selectedFund) return;
        onSelect(selectedFund);
    };

    const selectedOption = fundOptions.find((f) => f.name === selectedFund) || fundOptions[0];
    const isPaccoRoute = selectedOption?.workflow_route === 'pacco';

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
                onClick={onClose}
            />

            <div className="flex min-h-full items-center justify-center p-4 text-center sm:p-0">
                <div
                    className="relative transform overflow-hidden rounded-2xl bg-white text-left shadow-2xl transition-all sm:my-8 sm:w-full sm:max-w-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 px-6 py-5 text-white">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="p-2.5 bg-blue-500/20 border border-blue-400/30 rounded-xl">
                                    <Landmark className="w-5 h-5 text-blue-300" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-bold tracking-tight text-white">
                                        Select Source of Fund
                                    </h3>
                                    <p className="text-xs text-blue-200/80 mt-0.5">
                                        Determine the official review and approval route for this PPMP
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-lg p-1.5 text-blue-200/70 hover:bg-white/10 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="p-6 space-y-4 bg-slate-50/50 max-h-[70vh] overflow-y-auto">
                        <div className="flex items-center justify-between">
                            <p className="text-xs text-slate-600">
                                Please select the funding type for this procurement plan. The system will automatically configure the correct review hierarchy:
                            </p>
                            {loading && (
                                <span className="inline-flex items-center gap-1 text-[11px] text-slate-400">
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    <span>Syncing...</span>
                                </span>
                            )}
                        </div>

                        <div className="grid grid-cols-1 gap-3.5">
                            {fundOptions.map((option) => {
                                const isSelected = selectedFund === option.name;
                                const isPacco = option.workflow_route === 'pacco';

                                return (
                                    <div
                                        key={option.id || option.name}
                                        onClick={() => setSelectedFund(option.name)}
                                        onDoubleClick={handleConfirm}
                                        className={`relative group cursor-pointer rounded-xl p-4.5 transition-all border-2 ${
                                            isSelected
                                                ? isPacco
                                                    ? 'bg-teal-50/70 border-teal-600 shadow-md ring-2 ring-teal-500/20'
                                                    : 'bg-blue-50/70 border-blue-600 shadow-md ring-2 ring-blue-500/20'
                                                : isPacco
                                                    ? 'bg-white border-slate-200 hover:border-teal-300 hover:bg-slate-50/80 shadow-xs'
                                                    : 'bg-white border-slate-200 hover:border-blue-300 hover:bg-slate-50/80 shadow-xs'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-3">
                                            <div className="flex items-start gap-3.5">
                                                <div
                                                    className={`p-3 rounded-xl transition-colors ${
                                                        isSelected
                                                            ? isPacco
                                                                ? 'bg-teal-600 text-white shadow-xs'
                                                                : 'bg-blue-600 text-white shadow-xs'
                                                            : isPacco
                                                                ? 'bg-teal-100/70 text-teal-700'
                                                                : 'bg-blue-100/70 text-blue-700'
                                                    }`}
                                                >
                                                    {isPacco ? (
                                                        <ShieldCheck className="w-6 h-6" />
                                                    ) : (
                                                        <Landmark className="w-6 h-6" />
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <h4 className="font-bold text-sm text-slate-900">
                                                            {option.name}
                                                        </h4>
                                                        {option.code && (
                                                            <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-100 border border-slate-200 font-bold text-slate-600">
                                                                {option.code}
                                                            </span>
                                                        )}
                                                        <span
                                                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                                                isPacco
                                                                    ? 'bg-teal-100 text-teal-800 border-teal-200'
                                                                    : 'bg-blue-100 text-blue-800 border-blue-200'
                                                            }`}
                                                        >
                                                            {isPacco ? 'PACCO Review Route' : 'Budget Officer Route'}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                                                        {option.description || (isPacco
                                                            ? 'Trust fund and fiduciary allocation requiring PACCO review certification.'
                                                            : 'Standard budgetary appropriations requiring Budget Office review.')}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="shrink-0 mt-0.5">
                                                <div
                                                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                                        isSelected
                                                            ? isPacco
                                                                ? 'border-teal-600 bg-teal-600 text-white'
                                                                : 'border-blue-600 bg-blue-600 text-white'
                                                            : 'border-slate-300 bg-white'
                                                    }`}
                                                >
                                                    {isSelected && (
                                                        <CheckCircle2 className="w-4 h-4 fill-current text-white" />
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Routing Diagram */}
                                        <div className="mt-3.5 pt-3 border-t border-slate-200/70">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                                                Review Routing Flow:
                                            </span>
                                            <div className="flex items-center flex-wrap gap-1.5 text-[11px] font-medium text-slate-700">
                                                <span
                                                    className={`inline-flex items-center px-2 py-0.5 rounded border font-semibold ${
                                                        isPacco
                                                            ? 'bg-teal-100 text-teal-900 border-teal-200'
                                                            : 'bg-indigo-100 text-indigo-900 border-indigo-200'
                                                    }`}
                                                >
                                                    {isPacco ? 'PACCO Reviewer' : 'Budget Officer'}
                                                </span>
                                                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-100 text-purple-900 border border-purple-200 font-semibold">
                                                    OPPMO
                                                </span>
                                                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-cyan-100 text-cyan-900 border border-cyan-200 font-semibold">
                                                    BAC-TWG
                                                </span>
                                                <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                                <span className="inline-flex items-center px-2 py-0.5 rounded bg-emerald-100 text-emerald-900 border border-emerald-200 font-semibold">
                                                    Ready to Print
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="bg-slate-100/80 px-6 py-4 flex items-center justify-end gap-3 border-t border-slate-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            onClick={handleConfirm}
                            className={`inline-flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white rounded-lg shadow-xs transition-all cursor-pointer ${
                                isPaccoRoute
                                    ? 'bg-teal-600 hover:bg-teal-700 shadow-teal-500/25'
                                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/25'
                            }`}
                        >
                            <span>Proceed to Prepare PPMP</span>
                            <ArrowRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SourceOfFundModal;
