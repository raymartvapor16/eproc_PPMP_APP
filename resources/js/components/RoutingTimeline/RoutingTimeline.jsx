import React, { useState } from 'react';
import { formatDate } from '../UI/StatusBadge';
import { Clock, ExternalLink, X, ChevronRight, History, Printer, Edit3 } from 'lucide-react';

export const cleanFieldName = (field) => {
    if (!field) return 'Field';
    return String(field)
        .replace(/[._]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase())
        .trim();
};

/**
 * Returns accurate recipient / next office information strictly following the official PPMP route flow:
 * 1. End User creates Draft (DRAFT_CREATED) & prepares requirements (APP, Attachment List, Market Scoping PDF)
 * 2. End User submits for review -> Provincial Budget Officer (General Fund) OR PACCO (Trust Fund) OR BAC-TWG (Attachment List only)
 * 3. Budget Officer / PACCO certifies & releases -> OPPMO
 * 4. OPPMO approves & releases -> BAC-TWG (or Office Head if PPMP_APP only)
 * 5. BAC-TWG conducts technical review & approves -> Office Head (Final Approval & Endorsement)
 * 6. Office Head grants Final Approval (READY_TO_PRINT) -> Implementing Unit / End User
 * 7. End User acknowledges & receives document for procurement execution
 */
export const getAccurateRouteRecipient = (route, ppmp) => {
    if (!route) return { name: '—', role: '', designation: '' };

    const action = route.action || '';
    const isTrust = Boolean(
        ppmp?.source_of_fund?.toLowerCase()?.includes('trust') ||
        ppmp?.items?.some(i => i.source_of_fund?.toLowerCase()?.includes('trust'))
    );
    const isAttachOnly = ppmp?.amendment_scope === 'ATTACHMENT_LIST';
    const isPpmpAppOnly = ppmp?.amendment_scope === 'PPMP_APP';

    // 1. Initial Draft Created -> next reviewing office upon submission
    if (action === 'DRAFT_CREATED') {
        if (isAttachOnly) {
            return {
                name: 'BAC-TWG',
                role: 'twg',
                designation: 'Bids and Awards Committee - Technical Working Group',
            };
        }
        if (isTrust) {
            return {
                name: ppmp?.default_signatories?.pacco_requirement?.name || 'MAY FERNANDO-UY, CPA',
                role: 'pacco',
                designation: ppmp?.default_signatories?.pacco_requirement?.position || 'Provincial Accountant (PACCO Review)',
            };
        }
        return {
            name: ppmp?.default_signatories?.budget_requirement?.name || 'Provincial Budget Officer',
            role: 'budget_officer',
            designation: ppmp?.default_signatories?.budget_requirement?.position || 'Provincial Budget Office',
        };
    }

    // 2. Desk receipt by Budget Officer or PACCO -> next office is OPPMO
    if (action === 'PACCO_RECEIVED' || action === 'BUDGET_RECEIVED') {
        return {
            name: 'OPPMO REVIEW',
            role: 'oppmo',
            designation: 'Provincial Procurement Management Office',
        };
    }

    // 3. Desk receipt by OPPMO -> next office is BAC-TWG (or Office Head if PPMP_APP only)
    if (action === 'OPPMO_RECEIVED') {
        if (isPpmpAppOnly) {
            return {
                name: ppmp?.office?.head?.name || 'Office Head',
                role: 'head',
                designation: ppmp?.office?.head?.designation || 'Office Head / Implementing Unit Head',
            };
        }
        return {
            name: 'BAC-TWG',
            role: 'twg',
            designation: 'Bids and Awards Committee - Technical Working Group',
        };
    }

    // 4. Desk receipt by BAC-TWG -> next office is OPPMO to generate APP
    if (action === 'TWG_RECEIVED') {
        return {
            name: route.to_user?.name || 'OPPMO REVIEW',
            role: 'oppmo',
            designation: route.to_user?.designation || 'Provincial Procurement Management Office (APP Generation)',
        };
    }

    // 5. Desk receipt by Office Head -> next recipient is End User (Ready to Print)
    if (action === 'HEAD_RECEIVED') {
        return {
            name: ppmp?.creator?.name || 'Implementing Unit / End User',
            role: 'end_user',
            designation: ppmp?.creator?.designation || 'End User (Implementing Unit - Ready to Print)',
        };
    }

    // 6. BAC-TWG Approved -> routed back to OPPMO for APP generation
    if (action === 'TWG_APPROVED') {
        return {
            name: route.to_user?.name || 'OPPMO Reviewer',
            role: 'oppmo',
            designation: route.to_user?.designation || 'Provincial Procurement Management Office',
        };
    }

    // 7. OPPMO APP Generated -> forwarded to Office Head for approval
    if (action === 'OPPMO_APP_GENERATED') {
        return {
            name: route.to_user?.name || ppmp?.office?.head?.name || 'Office Head',
            role: 'head',
            designation: route.to_user?.designation || ppmp?.office?.head?.designation || 'Office Head / Implementing Unit Head',
        };
    }

    // 8. Office Head Approved or Ready to Print -> released to Implementing Unit / End User
    if (action === 'HEAD_APPROVED' || action === 'READY_TO_PRINT' || action === 'TWG_APPROVED_ATTACHMENT_LIST') {
        return {
            name: ppmp?.creator?.name || 'Implementing Unit / End User',
            role: 'end_user',
            designation: ppmp?.creator?.designation || 'End User (Implementing Unit)',
        };
    }

    // 8. End User Acknowledged
    if (action === 'END_USER_RECEIVED') {
        return {
            name: ppmp?.creator?.name || 'Implementing Unit / End User',
            role: 'end_user',
            designation: ppmp?.creator?.designation || 'End User (Document Released & Active)',
        };
    }

    if (action === 'ADMIN_RECEIVED_REQUEST') {
        return {
            name: ppmp?.creator?.name || 'Implementing Unit / End User',
            role: 'end_user',
            designation: 'Implementing Unit (Administrative Review)',
        };
    }

    // Role-based fallbacks for to_role:
    if (route.to_role === 'pacco') {
        return {
            name: (route.to_user?.name && route.to_user.name !== 'PACCO Reviewer') ? route.to_user.name : (ppmp?.default_signatories?.pacco_requirement?.name || 'MAY FERNANDO-UY, CPA'),
            role: 'pacco',
            designation: (route.to_user?.designation && route.to_user.designation !== 'Provincial Accounting Reviewer') ? route.to_user.designation : (ppmp?.default_signatories?.pacco_requirement?.position || 'Provincial Accountant'),
        };
    }

    if (route.to_role === 'budget_officer') {
        return {
            name: route.to_user?.name || ppmp?.default_signatories?.budget_requirement?.name || 'Provincial Budget Officer',
            role: 'budget_officer',
            designation: route.to_user?.designation || ppmp?.default_signatories?.budget_requirement?.position || 'Provincial Budget Office',
        };
    }

    if (route.to_role === 'oppmo') {
        return {
            name: route.to_user?.name || 'Provincial Procurement Management Office (OPPMO)',
            role: 'oppmo',
            designation: route.to_user?.designation || 'OPPMO Reviewer',
        };
    }

    if (route.to_role === 'twg') {
        return {
            name: route.to_user?.name || 'BAC - Technical Working Group',
            role: 'twg',
            designation: route.to_user?.designation || 'Bids and Awards Committee - Technical Working Group',
        };
    }

    if (route.to_role === 'head') {
        return {
            name: route.to_user?.name || ppmp?.office?.head?.name || 'Office Head',
            role: 'head',
            designation: route.to_user?.designation || ppmp?.office?.head?.designation || 'Office Head / Implementing Unit Head',
        };
    }

    if (route.to_role === 'end_user') {
        return {
            name: route.to_user?.name || ppmp?.creator?.name || 'Implementing Unit / End User',
            role: 'end_user',
            designation: route.to_user?.designation || ppmp?.creator?.designation || 'End User (Implementing Unit)',
        };
    }

    // Default: use to_user or to_role
    return {
        name: route.to_user?.name || (route.to_role ? route.to_role.replace(/_/g, ' ').toUpperCase() : '—'),
        role: route.to_role,
        designation: route.to_user?.designation || (route.to_role ? `Role: ${route.to_role.replace(/_/g, ' ')}` : ''),
    };
};

export const getAccurateRouteOrigin = (route, ppmp) => {
    if (!route) return { name: '—', role: '', designation: '' };

    if (route.from_role === 'pacco') {
        return {
            name: (route.from_user?.name && route.from_user.name !== 'PACCO Reviewer') ? route.from_user.name : (ppmp?.default_signatories?.pacco_requirement?.name || 'MAY FERNANDO-UY, CPA'),
            role: 'pacco',
            designation: (route.from_user?.designation && route.from_user.designation !== 'Provincial Accounting Reviewer') ? route.from_user.designation : (ppmp?.default_signatories?.pacco_requirement?.position || 'Provincial Accountant'),
        };
    }

    if (route.from_role === 'budget_officer') {
        return {
            name: route.from_user?.name || ppmp?.default_signatories?.budget_requirement?.name || 'Provincial Budget Officer',
            role: 'budget_officer',
            designation: route.from_user?.designation || ppmp?.default_signatories?.budget_requirement?.position || 'Provincial Budget Office',
        };
    }

    if (route.from_role === 'oppmo') {
        return {
            name: route.from_user?.name || 'Provincial Procurement Management Office (OPPMO)',
            role: 'oppmo',
            designation: route.from_user?.designation || 'OPPMO Reviewer',
        };
    }

    if (route.from_role === 'twg') {
        return {
            name: route.from_user?.name || 'BAC - Technical Working Group',
            role: 'twg',
            designation: route.from_user?.designation || 'Bids and Awards Committee - Technical Working Group',
        };
    }

    if (route.from_role === 'head') {
        return {
            name: route.from_user?.name || ppmp?.office?.head?.name || 'Office Head',
            role: 'head',
            designation: route.from_user?.designation || ppmp?.office?.head?.designation || 'Office Head / Implementing Unit Head',
        };
    }

    if (route.from_role === 'end_user') {
        return {
            name: route.from_user?.name || ppmp?.creator?.name || 'Implementing Unit / End User',
            role: 'end_user',
            designation: route.from_user?.designation || ppmp?.creator?.designation || 'End User (Implementing Unit)',
        };
    }

    return {
        name: route.from_user?.name || (route.from_role ? route.from_role.replace(/_/g, ' ').toUpperCase() : '—'),
        role: route.from_role,
        designation: route.from_user?.designation || (route.from_role ? `Role: ${route.from_role.replace(/_/g, ' ')}` : ''),
    };
};

export const RoutingTimeline = ({
    routes = [],
    reviews = [],
    changeLogs = [],
    ppmp = null,
    historicalPpmps = [],
    onPrint = null,
    isOpen: controlledIsOpen = null,
    onClose = null,
    initialPpmp = null,
}) => {
    const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(false);
    const isOpen = controlledIsOpen !== null ? controlledIsOpen : uncontrolledIsOpen;
    const setIsOpen = (val) => {
        if (controlledIsOpen !== null) {
            if (!val && onClose) onClose();
        } else {
            setUncontrolledIsOpen(val);
        }
    };

    // Available PPMPs to select from: active ppmp + all historical baseline revisions
    const allPpmps = React.useMemo(() => {
        const list = [];
        if (ppmp) list.push(ppmp);
        if (Array.isArray(historicalPpmps)) {
            historicalPpmps.forEach(h => {
                if (h && !list.some(p => p.id === h.id)) {
                    list.push(h);
                }
            });
        }
        return list;
    }, [ppmp, historicalPpmps]);

    const [selectedPpmpId, setSelectedPpmpId] = useState(initialPpmp?.id || ppmp?.id);

    // Sync selected PPMP if initialPpmp changes
    React.useEffect(() => {
        if (initialPpmp?.id) {
            setSelectedPpmpId(initialPpmp.id);
        } else if (ppmp?.id && !selectedPpmpId) {
            setSelectedPpmpId(ppmp.id);
        }
    }, [initialPpmp, ppmp]);

    const activeSelectedPpmp = allPpmps.find(p => p.id === selectedPpmpId) || ppmp;
    const isViewingHistorical = activeSelectedPpmp && ppmp && (activeSelectedPpmp.id !== ppmp.id);

    // Get routes, reviews, and logs for currently selected PPMP
    const activeRoutes = isViewingHistorical
        ? (activeSelectedPpmp.routes || [])
        : (routes.length > 0 ? routes : (ppmp?.routes || []));

    const activeChangeLogs = isViewingHistorical
        ? (activeSelectedPpmp.change_logs || [])
        : (changeLogs.length > 0 ? changeLogs : (ppmp?.change_logs || []));

    // Reverse routes so that the latest event is on the first (top), descending down to the oldest
    const sortedRoutes = React.useMemo(() => {
        return [...activeRoutes].reverse();
    }, [activeRoutes]);

    const latestRoute = activeRoutes.length > 0 ? activeRoutes[activeRoutes.length - 1] : null;

    return (
        <>
            {/* Clickable Card / Summary trigger */}
            <div className="bg-white rounded-lg border border-slate-200 shadow-sm p-4 hover:border-indigo-300 transition">
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                    <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-indigo-600" />
                        <h3 className="font-bold text-sm text-slate-800 uppercase tracking-wide">
                            PPMP Workflow & Routing
                        </h3>
                    </div>
                    <span className="text-[11px] font-mono font-semibold px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-full border border-indigo-200">
                        {routes.length} {routes.length === 1 ? 'Action' : 'Actions'}
                    </span>
                </div>

                {latestRoute ? (
                    (() => {
                        const latestOrigin = getAccurateRouteOrigin(latestRoute, activeSelectedPpmp);
                        const latestRecipient = getAccurateRouteRecipient(latestRoute, activeSelectedPpmp);

                        return (
                            <div className="mt-3 text-xs text-slate-600">
                                <div className="flex items-center justify-between text-[11px] text-slate-500 mb-1">
                                    <span className="font-semibold uppercase tracking-wider text-slate-700">Latest Event</span>
                                    <span>{formatDate(latestRoute.acted_at || latestRoute.submitted_at)}</span>
                                </div>
                                <div className="p-2.5 bg-slate-50 rounded border border-slate-200 font-medium text-slate-800 flex items-center justify-between">
                                    <span className="truncate">{latestRoute.action.replace(/_/g, ' ')}</span>
                                    <span className="text-[10px] text-slate-500 shrink-0 font-mono ml-2">
                                        {latestOrigin.role || latestRoute.from_role} → {latestRecipient.role || latestRoute.to_role}
                                    </span>
                                </div>
                            </div>
                        );
                    })()
                ) : (
                    <div className="mt-3 text-xs text-slate-400 italic">
                        No routing actions recorded yet.
                    </div>
                )}

                <div className="mt-4 flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setIsOpen(true)}
                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold text-xs uppercase tracking-wider rounded-md border border-indigo-200 transition shadow-2xs cursor-pointer"
                    >
                        <History className="w-4 h-4" />
                        View History
                    </button>
                    {onPrint && (
                        <button
                            type="button"
                            onClick={() => onPrint(activeSelectedPpmp || ppmp)}
                            className="flex items-center justify-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-md border border-slate-300 transition shadow-2xs cursor-pointer"
                            title="Print Official Document Routing Slip"
                        >
                            <Printer className="w-4 h-4 text-slate-600" />
                            Print
                        </button>
                    )}
                </div>
            </div>

            {/* Modal Dialog */}
            {isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
                    <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[85vh] flex flex-col border border-slate-200 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
                        {/* Modal Header */}
                        <div className="p-4 sm:px-6 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800">
                            <div className="flex items-center gap-2.5">
                                <Clock className="w-5 h-5 text-indigo-400" />
                                <div>
                                    <h3 className="font-bold text-sm tracking-wide uppercase">
                                        PPMP Workflow & Routing History
                                    </h3>
                                    <p className="text-[11px] text-slate-400">
                                        Workflow audit trail &bull; Latest events first
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                {onPrint && (
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsOpen(false);
                                            onPrint(activeSelectedPpmp || ppmp);
                                        }}
                                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                                        title="Print Official Document Routing Slip"
                                    >
                                        <Printer className="w-3.5 h-3.5" />
                                        <span>Print Routing Slip</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        {/* Modal Body: Two-column layout with scrollable Sidebar for versions and scrollable Main Content for timeline */}
                        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                            {/* Left Sidebar: Select Version (Scrollable if many versions) */}
                            {allPpmps.length > 1 && (
                                <div className="w-full md:w-64 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 p-3.5 flex flex-col shrink-0">
                                    <div className="flex items-center justify-between mb-2.5 px-1">
                                        <span className="text-[11px] uppercase font-bold text-slate-400 tracking-wider flex items-center gap-1.5">
                                            <History className="w-3.5 h-3.5 text-indigo-400" />
                                            Select Version
                                        </span>
                                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                                            {allPpmps.length} versions
                                        </span>
                                    </div>
                                    <div className="flex md:flex-col gap-1.5 overflow-x-auto md:overflow-y-auto max-h-36 md:max-h-none flex-1 custom-scrollbar pr-0.5">
                                        {allPpmps.map((p) => {
                                            const isSelected = p.id === activeSelectedPpmp?.id;
                                            const isAnnual = !p.parent_id;
                                            const isCurrent = p.id === ppmp?.id;

                                            return (
                                                <button
                                                    key={p.id}
                                                    type="button"
                                                    onClick={() => setSelectedPpmpId(p.id)}
                                                    className={`w-full text-left p-2.5 rounded-lg text-xs font-semibold transition flex items-center justify-between gap-2 cursor-pointer border shrink-0 ${
                                                        isSelected
                                                            ? 'bg-indigo-600 text-white border-indigo-500 shadow-xs'
                                                            : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border-slate-700/80'
                                                    }`}
                                                >
                                                    <div className="truncate">
                                                        <div className="font-bold flex items-center gap-1.5 truncate">
                                                            <span>PPMP No. {p.ppmp_number}</span>
                                                            <span className="text-[10px] font-normal opacity-90">
                                                                ({isAnnual ? 'Annual' : (p.amendment_type === 'AMENDMENT' ? 'Amended' : 'Supplemental')})
                                                            </span>
                                                        </div>
                                                        <div className={`text-[10px] font-mono truncate mt-0.5 ${isSelected ? 'text-indigo-200' : 'text-slate-400'}`}>
                                                            {p.tracking_number}
                                                        </div>
                                                    </div>
                                                    {isCurrent ? (
                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono font-bold shrink-0 ${
                                                            isSelected ? 'bg-indigo-700 text-white' : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                                        }`}>
                                                            Active
                                                        </span>
                                                    ) : (
                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-mono shrink-0 ${
                                                            isSelected ? 'bg-indigo-700 text-indigo-100' : 'bg-slate-700/60 text-slate-400'
                                                        }`}>
                                                            Old
                                                        </span>
                                                    )}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Right / Main Timeline Content Area */}
                            <div className="p-6 overflow-y-auto custom-scrollbar flex-1 space-y-6 bg-white">
                            {sortedRoutes.length === 0 ? (
                                <div className="text-center py-8 text-xs text-slate-400 italic">
                                    No routing history recorded for this version yet.
                                </div>
                            ) : (
                                <div className="relative pl-6 space-y-5 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                                    {sortedRoutes.map((route, idx) => {
                                        const actionStr = route.action || '';
                                        const statusStr = route.status || '';
                                        const isLatest = idx === 0;

                                        // Classify the nature of the step
                                        const isReceiptCard = actionStr.endsWith('_RECEIVED') || actionStr === 'ADMIN_RECEIVED_REQUEST';
                                        const isSuspendedCard = actionStr.includes('RETURNED') || statusStr.includes('RETURNED') || actionStr.includes('REJECTED');
                                        const isApprovedCard = !isReceiptCard && !isSuspendedCard && (actionStr.includes('APPROVED') || statusStr.includes('APPROVED') || actionStr === 'OPPMO_APP_GENERATED' || actionStr === 'READY_TO_PRINT' || statusStr === 'READY_TO_PRINT');
                                        const isSubmissionCard = !isReceiptCard && !isSuspendedCard && !isApprovedCard;

                                        // Dot styling
                                        let dotClass = 'bg-blue-500 ring-2 ring-blue-200';
                                        let cardBorder = 'border-slate-200 bg-white';
                                        let badgeColor = 'bg-blue-50 text-blue-700 border-blue-200';
                                        let stageCategory = 'Handover / Submission';

                                        if (isReceiptCard) {
                                            dotClass = 'bg-amber-500 ring-2 ring-amber-200';
                                            cardBorder = 'border-amber-200 bg-amber-50/30';
                                            badgeColor = 'bg-amber-100 text-amber-800 border-amber-300';
                                            stageCategory = 'Desk Receipt';
                                        } else if (isSuspendedCard) {
                                            dotClass = 'bg-rose-500 ring-2 ring-rose-200';
                                            cardBorder = 'border-rose-200 bg-rose-50/25';
                                            badgeColor = 'bg-rose-100 text-rose-800 border-rose-300';
                                            stageCategory = 'Review Finding / Returned';
                                        } else if (isApprovedCard) {
                                            dotClass = 'bg-emerald-500 ring-2 ring-emerald-200';
                                            cardBorder = 'border-emerald-200 bg-emerald-50/20';
                                            badgeColor = 'bg-emerald-100 text-emerald-800 border-emerald-300';
                                            stageCategory = 'Approved & Released';
                                        }

                                        if (isLatest) {
                                            cardBorder += ' ring-2 ring-indigo-500/20 shadow-sm';
                                        }

                                        // Clean readable title
                                        const getStepTitle = () => {
                                            switch (actionStr) {
                                                case 'DRAFT_CREATED':
                                                    return 'PPMP Draft Created & Initialized';
                                                case 'SUBMITTED_TO_HEAD':
                                                    return 'Passed & Submitted to Office Head';
                                                case 'HEAD_RECEIVED':
                                                    return 'Received by Office Head (Awaiting Final Approval)';
                                                case 'HEAD_APPROVED':
                                                    return 'Office Head Final Approved & Ready to Print';
                                                case 'HEAD_RETURNED':
                                                    return 'Suspended & Returned by Office Head';
                                                case 'SUBMITTED_FOR_REVIEW':
                                                    return `Passed & Submitted to ${route.to_role ? route.to_role.replace(/_/g, ' ').toUpperCase() : 'Reviewer'} for Review`;
                                                case 'BUDGET_RECEIVED':
                                                    return 'Received by Provincial Budget Officer';
                                                case 'BUDGET_APPROVED':
                                                    return 'Budget Certified & Released to OPPMO';
                                                case 'BUDGET_RETURNED':
                                                    return 'Suspended & Returned by Budget Officer';
                                                case 'PACCO_RECEIVED':
                                                    return 'Received by Provincial Accountant (PACCO)';
                                                case 'PACCO_APPROVED':
                                                    return 'Accounting Requirements Certified & Released to OPPMO';
                                                case 'PACCO_RETURNED':
                                                    return 'Suspended & Returned by PACCO Reviewer';
                                                case 'OPPMO_RECEIVED':
                                                    return route.remarks?.includes('Annual Procurement Plan') || route.remarks?.includes('APP')
                                                        ? 'Received by OPPMO (Awaiting APP Generation)'
                                                        : 'Received by OPPMO';
                                                case 'OPPMO_APPROVED':
                                                    return 'OPPMO Approved & Released to BAC-TWG';
                                                case 'OPPMO_APP_GENERATED':
                                                    return 'Annual Procurement Plan (APP) Generated & Released to Office Head';
                                                case 'OPPMO_RETURNED':
                                                    return 'Suspended & Returned by OPPMO';
                                                case 'TWG_RECEIVED':
                                                    return 'Received by BAC-TWG';
                                                case 'TWG_APPROVED':
                                                    return 'BAC-TWG Technical Review Approved & Released to OPPMO';
                                                case 'TWG_RETURNED':
                                                    return 'Suspended & Returned by BAC-TWG';
                                                case 'READY_TO_PRINT':
                                                    return 'Office Head Final Approved & Ready to Print';
                                                case 'END_USER_RECEIVED':
                                                    return 'Acknowledged & Received by Implementing Unit';
                                                case 'ADMIN_RECEIVED_REQUEST':
                                                    return 'Request Received by Administrator';
                                                default:
                                                    if (actionStr.startsWith('REQUESTED_')) {
                                                        return `Requested ${actionStr.replace('REQUESTED_', '')} to Administrator`;
                                                    }
                                                    if (actionStr.startsWith('ADMIN_APPROVED_')) {
                                                        return `Administrator Approved ${actionStr.replace('ADMIN_APPROVED_', '')}`;
                                                    }
                                                    if (actionStr.startsWith('ADMIN_REJECTED_')) {
                                                        return `Administrator Rejected ${actionStr.replace('ADMIN_REJECTED_', '')}`;
                                                    }
                                                    return actionStr.replace(/_/g, ' ');
                                            }
                                        };

                                        return (
                                            <div key={route.id || idx} className="relative group">
                                                {/* Dot on timeline */}
                                                <div
                                                    className={`absolute -left-[27px] top-1.5 w-4 h-4 rounded-full border-2 border-white shadow-xs flex items-center justify-center ${dotClass} ${isLatest ? 'animate-pulse' : ''}`}
                                                />

                                                <div className={`border rounded-xl p-4 transition ${cardBorder}`}>
                                                    {/* Header with Title and Category Badge */}
                                                    <div className="flex items-start justify-between gap-2 flex-wrap">
                                                        <div>
                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${badgeColor}`}>
                                                                    {stageCategory}
                                                                </span>
                                                                {isLatest && (
                                                                    <span className="text-[9px] font-bold px-2 py-0.5 bg-indigo-600 text-white rounded-full uppercase tracking-tight shadow-2xs">
                                                                        Latest Event
                                                                    </span>
                                                                )}
                                                            </div>
                                                            <h4 className="mt-1.5 font-bold text-xs uppercase tracking-wide text-slate-900">
                                                                {getStepTitle()}
                                                            </h4>
                                                        </div>
                                                        <span className="text-[10px] font-mono font-medium text-slate-500 bg-white px-2 py-1 rounded-md border border-slate-200 shrink-0">
                                                            {formatDate(route.acted_at || route.submitted_at || route.created_at)}
                                                        </span>
                                                    </div>

                                                    {/* Routing Flow / Custody movement */}
                                                    {(() => {
                                                        const originInfo = getAccurateRouteOrigin(route, activeSelectedPpmp);
                                                        const recipientInfo = getAccurateRouteRecipient(route, activeSelectedPpmp);

                                                        return (
                                                            <>
                                                                <div className="mt-2.5 p-2 bg-slate-50/80 rounded-lg border border-slate-200/80 flex items-center justify-between gap-2 text-xs">
                                                                    <div className="truncate">
                                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Origin / Handled By</span>
                                                                        <span className="font-semibold text-slate-900 truncate block">
                                                                            {originInfo.name}
                                                                        </span>
                                                                        <span className="text-[10px] text-slate-500 block truncate">
                                                                            {originInfo.designation}
                                                                        </span>
                                                                    </div>
                                                                    <span className="text-slate-400 font-bold px-1.5">→</span>
                                                                    <div className="text-right truncate">
                                                                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Recipient / Next Office</span>
                                                                        <span className="font-semibold text-slate-900 truncate block">
                                                                            {recipientInfo.name}
                                                                        </span>
                                                                        <span className="text-[10px] text-slate-500 block truncate">
                                                                            {recipientInfo.designation}
                                                                        </span>
                                                                    </div>
                                                                </div>

                                                                {/* Contextual Timestamps Breakdown */}
                                                                <div className="mt-3 pt-2.5 border-t border-slate-200/80">
                                                                    {isReceiptCard ? (
                                                                        // Receipt Card breakdown
                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                                                            <div className="p-2 bg-amber-50/60 rounded border border-amber-200/70">
                                                                                <span className="font-bold text-amber-900 block">Date & Time Received in Office:</span>
                                                                                <span className="font-mono text-amber-950 font-semibold">
                                                                                    {formatDate(route.received_at || route.submitted_at || route.acted_at)}
                                                                                </span>
                                                                            </div>
                                                                            <div className="p-2 bg-slate-50 rounded border border-slate-200 flex flex-col justify-center">
                                                                                <span className="font-bold text-slate-600 block">Document Custody Status:</span>
                                                                                <span className="text-emerald-700 font-semibold">Under Active Review</span>
                                                                            </div>
                                                                        </div>
                                                                    ) : isApprovedCard ? (
                                                                        // Approved & Released Card breakdown
                                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                                                            <div className="p-2 bg-emerald-50/60 rounded border border-emerald-200/70">
                                                                                <span className="font-bold text-emerald-900 block">Date & Time Approved:</span>
                                                                                <span className="font-mono text-emerald-950 font-semibold">
                                                                                    {formatDate(route.acted_at || route.submitted_at)}
                                                                                </span>
                                                                            </div>
                                                                            <div className="p-2 bg-blue-50/60 rounded border border-blue-200/70">
                                                                                <span className="font-bold text-blue-900 block">Forwarded / Released To:</span>
                                                                                <span className="font-semibold text-blue-950 truncate block">
                                                                                    {recipientInfo.name}
                                                                                </span>
                                                                                <span className="text-[10px] text-blue-700 font-mono">
                                                                                    {route.received_at ? `Received: ${formatDate(route.received_at)}` : 'Pending office receipt'}
                                                                                </span>
                                                                            </div>
                                                                        </div>
                                                                    ) : isSuspendedCard ? (
                                                            // Suspended / Returned Card breakdown
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                                                <div className="p-2 bg-rose-50/60 rounded border border-rose-200/70">
                                                                    <span className="font-bold text-rose-900 block">Date & Time Suspended / Returned:</span>
                                                                    <span className="font-mono text-rose-950 font-semibold">
                                                                        {formatDate(route.acted_at || route.submitted_at)}
                                                                    </span>
                                                                </div>
                                                                <div className="p-2 bg-slate-50 rounded border border-slate-200 flex flex-col justify-center">
                                                                    <span className="font-bold text-slate-600 block">Return Target:</span>
                                                                    <span className="text-slate-900 font-semibold">Returned to Implementing Unit</span>
                                                                </div>
                                                            </div>
                                                        ) : actionStr === 'DRAFT_CREATED' ? (
                                                            // Draft Created Card breakdown
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                                                <div className="p-2 bg-blue-50/60 rounded border border-blue-200/70">
                                                                    <span className="font-bold text-blue-900 block">Date & Time Draft Initialized:</span>
                                                                    <span className="font-mono text-blue-950 font-semibold">
                                                                        {formatDate(route.submitted_at || route.created_at)}
                                                                    </span>
                                                                </div>
                                                                <div className="p-2 bg-slate-50 rounded border border-slate-200 flex flex-col justify-center">
                                                                    <span className="font-bold text-slate-700 block">Current Document Status:</span>
                                                                    <span className="text-blue-800 font-semibold">
                                                                        Draft Created &bull; In Preparation by Implementing Unit
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            // Submission / Transfer Card breakdown
                                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
                                                                <div className="p-2 bg-blue-50/60 rounded border border-blue-200/70">
                                                                    <span className="font-bold text-blue-900 block">Date & Time Dispatched / Submitted:</span>
                                                                    <span className="font-mono text-blue-950 font-semibold">
                                                                        {formatDate(route.submitted_at || route.created_at)}
                                                                    </span>
                                                                </div>
                                                                <div className="p-2 bg-slate-50 rounded border border-slate-200">
                                                                    <span className="font-bold text-slate-700 block">Office Receipt Acknowledgment:</span>
                                                                    {route.received_at ? (
                                                                        <span className="text-emerald-700 font-semibold font-mono">
                                                                            Received: {formatDate(route.received_at)}
                                                                        </span>
                                                                    ) : (
                                                                        <span className="text-amber-600 font-semibold italic">
                                                                            Pending Receipt by Recipient
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </>
                                            );
                                        })()}

                                                    {/* Action Remarks / Justification */}
                                                    {route.remarks && (
                                                        <div className="mt-3 p-2.5 bg-white rounded-lg border border-slate-200 text-xs text-slate-700 italic">
                                                            <span className="not-italic font-bold text-slate-500 text-[10px] uppercase tracking-wider block mb-0.5">
                                                                Remarks / Instructions:
                                                            </span>
                                                            "{route.remarks}"
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Field Level Change Logs */}
                            {activeChangeLogs.length > 0 && (
                                <div className="mt-6 pt-5 border-t border-slate-200">
                                    <div className="flex items-center justify-between mb-3">
                                        <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                                            <Edit3 className="w-4 h-4 text-amber-600" />
                                            <span>Document Change Logs (Reviewer & Item Modifications)</span>
                                        </h4>
                                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold border border-amber-300">
                                            {activeChangeLogs.length} {activeChangeLogs.length === 1 ? 'Change' : 'Changes'}
                                        </span>
                                    </div>
                                    <div className="space-y-2">
                                        {activeChangeLogs.map((log) => (
                                            <div key={log.id} className="p-3 bg-amber-50/70 border border-amber-200 rounded-lg text-xs shadow-2xs">
                                                <div className="flex items-center justify-between text-[11px] font-medium text-amber-900 mb-1.5 flex-wrap gap-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span>Field: <strong className="text-slate-900 font-bold">{cleanFieldName(log.field_name)}</strong></span>
                                                        {log.action && !['update', 'field_correction'].includes(log.action) && (
                                                            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200/80 text-amber-950 border border-amber-300">
                                                                {log.action}
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-200 text-amber-900 uppercase">
                                                            {log.role ? log.role.replace(/_/g, ' ') : 'Reviewer'}
                                                        </span>
                                                        <span className="text-slate-600 font-semibold">{log.user?.name || 'Authorized User'}</span>
                                                        {log.created_at && (
                                                            <span className="text-[10px] text-slate-400 font-mono">• {formatDate(log.created_at)}</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] font-mono">
                                                    <div className="p-1.5 bg-rose-50 border border-rose-200 rounded text-rose-800">
                                                        <span className="text-[10px] font-sans font-bold uppercase text-rose-600 block">Previous:</span>
                                                        <span className="line-through break-words">{log.old_value || '(none)'}</span>
                                                    </div>
                                                    <div className="p-1.5 bg-emerald-50 border border-emerald-200 rounded text-emerald-900 font-semibold">
                                                        <span className="text-[10px] font-sans font-bold uppercase text-emerald-600 block">Updated / New:</span>
                                                        <span className="break-words">{log.new_value || '(removed)'}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Modal Footer */}
                    <div className="p-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between">
                            <div>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsOpen(false)}
                                className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold text-xs rounded transition cursor-pointer"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
