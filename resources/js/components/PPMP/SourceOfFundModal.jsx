import React, { useState } from 'react';
import { X, Landmark, ShieldCheck, ArrowRight, CheckCircle2, ChevronRight } from 'lucide-react';

export const FUND_ROUTES = {
    BUDGET: 'budget',
    PACCO: 'pacco',
};

export const FUND_SOURCES = {
    GENERAL_FUND: 'General Fund',
    TRUST_FUND: 'Trust Fund',
};

export const ROUTING_OPTIONS = [
    {
        id: FUND_ROUTES.BUDGET,
        route: FUND_ROUTES.BUDGET,
        name: 'Budget Routing (General Funds and etc.,)',
        badge: 'GF & Special Budget',
        routeLabel: 'Budget Officer Route',
        defaultFund: 'General Fund',
        description: 'Provincial General Fund, 20% Local Development Fund, Special Education Fund (SEF), and standard budgetary allocations.',
        flow: [
            { name: 'BAC-TWG', color: 'bg-cyan-100 text-cyan-900 border-cyan-200' },
            { name: 'Budget Officer', color: 'bg-indigo-100 text-indigo-900 border-indigo-200' },
            { name: 'OPPMO (Generate APP)', color: 'bg-purple-100 text-purple-900 border-purple-200' },
            { name: 'Ready to Print', color: 'bg-emerald-100 text-emerald-900 border-emerald-200' },
        ],
    },
    {
        id: FUND_ROUTES.PACCO,
        route: FUND_ROUTES.PACCO,
        name: 'PACCO Routing (Trust Funds)',
        badge: 'Trust Funds',
        routeLabel: 'PACCO Review Route',
        defaultFund: 'Trust Fund',
        description: 'National agency subsidies, grants, trust deposits, fiduciary accounts, and special projects requiring Provincial Accountant (PACCO) certification.',
        flow: [
            { name: 'BAC-TWG', color: 'bg-cyan-100 text-cyan-900 border-cyan-200' },
            { name: 'PACCO Reviewer', color: 'bg-teal-100 text-teal-900 border-teal-200' },
            { name: 'OPPMO (Generate APP)', color: 'bg-purple-100 text-purple-900 border-purple-200' },
            { name: 'Ready to Print', color: 'bg-emerald-100 text-emerald-900 border-emerald-200' },
        ],
    },
];

export const SourceOfFundModal = ({ isOpen, onClose, onSelect }) => {
    const [selectedRoute, setSelectedRoute] = useState(FUND_ROUTES.BUDGET);

    if (!isOpen) return null;

    const handleConfirm = () => {
        const selected = ROUTING_OPTIONS.find((opt) => opt.route === selectedRoute) || ROUTING_OPTIONS[0];
        if (typeof onSelect === 'function') {
            onSelect(selected.defaultFund, selected.route);
        }
    };

    const isPaccoRoute = selectedRoute === FUND_ROUTES.PACCO;

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
                                        Select Source of Fund Routing
                                    </h3>
                                    <p className="text-xs text-blue-200/80 mt-0.5">
                                        Choose the official review and approval hierarchy for this procurement plan
                                    </p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onClose}
                                className="rounded-lg p-1.5 text-blue-200/70 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Content: Only the 2 routing options */}
                    <div className="p-6 space-y-4 bg-slate-50/50">
                        <p className="text-xs text-slate-600 font-medium">
                            Please select the review route for this PPMP. The table input search will automatically filter the appropriate funds catalog:
                        </p>

                        <div className="grid grid-cols-1 gap-3.5">
                            {ROUTING_OPTIONS.map((option) => {
                                const isSelected = selectedRoute === option.route;
                                const isPacco = option.route === FUND_ROUTES.PACCO;

                                return (
                                    <div
                                        key={option.id}
                                        onClick={() => setSelectedRoute(option.route)}
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
                                                        <span
                                                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                                                                isPacco
                                                                    ? 'bg-teal-100 text-teal-800 border-teal-200'
                                                                    : 'bg-blue-100 text-blue-800 border-blue-200'
                                                            }`}
                                                        >
                                                            {option.routeLabel}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">
                                                        {option.description}
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

                                        {/* Review Routing Flow Diagram */}
                                        <div className="mt-3.5 pt-3 border-t border-slate-200/70">
                                            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-1.5">
                                                Review Routing Flow:
                                            </span>
                                            <div className="flex items-center flex-wrap gap-1.5 text-[11px] font-medium text-slate-700">
                                                {option.flow.map((step, idx) => (
                                                    <React.Fragment key={step.name}>
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded border font-semibold ${step.color}`}>
                                                            {step.name}
                                                        </span>
                                                        {idx < option.flow.length - 1 && (
                                                            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                                                        )}
                                                    </React.Fragment>
                                                ))}
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
