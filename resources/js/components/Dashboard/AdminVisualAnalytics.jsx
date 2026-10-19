import React, { useState, useMemo } from 'react';
import {
    BarChart3,
    TrendingUp,
    PieChart,
    Building2,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Layers,
    DollarSign,
    RefreshCw,
    Download,
    Eye,
    Calendar,
    ChevronRight,
    Filter,
    ArrowUpRight,
    ShieldCheck,
    Award,
    Briefcase,
    Package,
    Hammer,
    Sparkles,
    Zap,
    Check,
    ExternalLink,
    FileText,
    SlidersHorizontal,
    Search,
    Landmark,
    Compass,
    CheckCircle,
} from 'lucide-react';
import { formatCurrency } from '../UI/StatusBadge';

// Curated vibrant color palette for SVG donut charts and graphs
const CHART_PALETTE = [
    '#3b82f6', // blue-500
    '#10b981', // emerald-500
    '#8b5cf6', // purple-500
    '#f59e0b', // amber-500
    '#06b6d4', // cyan-500
    '#ec4899', // pink-500
    '#6366f1', // indigo-500
    '#14b8a6', // teal-500
    '#f97316', // orange-500
    '#64748b', // slate-500
];

export const AdminVisualAnalytics = ({ analytics, metrics, recentPpmps = [], onSelectPpmp }) => {
    const [selectedFiscalYear, setSelectedFiscalYear] = useState('ALL');
    const [timelineView, setTimelineView] = useState('monthly'); // 'monthly' | 'quarterly'
    const [officeSearch, setOfficeSearch] = useState('');
    const [hoveredMonth, setHoveredMonth] = useState(null);
    const [hoveredModality, setHoveredModality] = useState(null);

    // Active dataset based on selected fiscal year
    const activeData = useMemo(() => {
        if (selectedFiscalYear !== 'ALL' && analytics?.by_fiscal_year?.[selectedFiscalYear]) {
            return analytics.by_fiscal_year[selectedFiscalYear];
        }
        return null;
    }, [selectedFiscalYear, analytics]);

    // Active metrics dynamically responding to selected Fiscal Year
    const activeMetrics = activeData?.metrics || metrics || {};
    const totalBudget = activeMetrics?.total_budget ?? 0;
    const totalPpmps = activeMetrics?.total_ppmps ?? 0;
    const readyToPrint = activeMetrics?.ready_to_print ?? 0;
    const inReview = activeMetrics?.in_review ?? 0;
    const draft = activeMetrics?.draft ?? 0;
    const headPending = activeMetrics?.head_pending ?? 0;
    const pendingAmendments = activeMetrics?.pending_amendments ?? 0;

    // Analytics data payloads from active scope (filtered by FY if selected)
    const budgetByOffice = activeData?.budget_by_office ?? analytics?.budget_by_office ?? [];
    const procurementModes = activeData?.procurement_modes ?? analytics?.procurement_modes ?? [];
    const fundSources = activeData?.fund_sources ?? analytics?.fund_sources ?? [];
    const projectTypes = activeData?.project_types ?? analytics?.project_types ?? [];
    const monthlySchedule = activeData?.monthly_schedule ?? analytics?.monthly_schedule ?? [];
    const quarterlySchedule = activeData?.quarterly_schedule ?? analytics?.quarterly_schedule ?? {};
    const topProjects = activeData?.top_projects ?? analytics?.top_projects ?? [];
    const workflowStages = activeData?.workflow_stages ?? analytics?.workflow_stages ?? [
        { stage: 'DRAFT', label: 'End-User Drafting', count: draft, color: '#64748b' },
        { stage: 'HEAD_PENDING', label: 'Office Head Approval', count: headPending, color: '#f59e0b' },
        { stage: 'BUDGET_OFFICER_REVIEW', label: 'Provincial Budget (PBO)', count: 0, color: '#3b82f6' },
        { stage: 'PACCO_REVIEW', label: 'Accounting Office (PACCO)', count: 0, color: '#06b6d4' },
        { stage: 'OPPMO_REVIEW', label: 'Procurement Management (OPPMO)', count: 0, color: '#8b5cf6' },
        { stage: 'TWG_REVIEW', label: 'Technical Working Group (TWG)', count: 0, color: '#ec4899' },
        { stage: 'READY_TO_PRINT', label: 'Cleared / Ready to Print', count: readyToPrint, color: '#10b981' },
    ];
    const statusDistribution = activeData?.status_distribution ?? analytics?.status_distribution ?? [
        { status: 'DRAFT', label: 'Drafts', count: draft, color: '#64748b' },
        { status: 'HEAD_PENDING', label: 'Pending Office Head', count: headPending, color: '#f59e0b' },
        { status: 'IN_REVIEW', label: 'Under Review', count: inReview, color: '#6366f1' },
        { status: 'READY_TO_PRINT', label: 'Approved / Ready to Print', count: readyToPrint, color: '#10b981' },
        { status: 'PENDING_AMENDMENTS', label: 'Pending Amendments', count: pendingAmendments, color: '#a855f7' },
    ];
    const fiscalYears = analytics?.fiscal_years || [];
    const compliance = analytics?.compliance || {
        pre_proc_count: 0,
        pre_proc_budget: 0,
        competitive_count: 0,
        competitive_budget: 0,
    };

    // Filtered calculations if fiscal year is chosen
    const activeBudget = totalBudget;
    const completionRate = totalPpmps > 0 ? Math.round((readyToPrint / totalPpmps) * 100) : 0;
    const inReviewRate = totalPpmps > 0 ? Math.round((inReview / totalPpmps) * 100) : 0;
    const averagePlanSize = totalPpmps > 0 ? totalBudget / totalPpmps : 0;

    // Filter offices by search query
    const filteredOffices = useMemo(() => {
        if (!officeSearch.trim()) return budgetByOffice;
        const q = officeSearch.toLowerCase();
        return budgetByOffice.filter(
            (o) => o.code?.toLowerCase().includes(q) || o.name?.toLowerCase().includes(q)
        );
    }, [budgetByOffice, officeSearch]);

    // Max office budget for scaling horizontal bars
    const maxOfficeBudget = Math.max(...budgetByOffice.map((o) => o.total_budget), 1);
    // Max procurement mode amount for scaling
    const maxProcurementBudget = Math.max(...procurementModes.map((p) => p.total_amount), 1);

    // Max monthly schedule amount for scaling timeline bars
    const maxMonthAmount = Math.max(...monthlySchedule.map((m) => m.amount), 1);
    const totalScheduledAmount = monthlySchedule.reduce((acc, m) => acc + m.amount, 0) || 1;

    // Find peak procurement month
    const peakMonth = useMemo(() => {
        if (!monthlySchedule.length) return null;
        return [...monthlySchedule].sort((a, b) => b.amount - a.amount)[0];
    }, [monthlySchedule]);

    // Total procurement modes valuation
    const totalModesValuation = procurementModes.reduce((acc, p) => acc + p.total_amount, 0) || 1;

    // SVG Donut Slices for Procurement Modes
    const donutSlices = useMemo(() => {
        const radius = 38;
        const circumference = 2 * Math.PI * radius;
        let cumulativePercent = 0;

        return procurementModes.map((mode, index) => {
            const percent = mode.total_amount > 0 ? (mode.total_amount / totalModesValuation) * 100 : 0;
            const strokeDasharray = `${(percent * circumference) / 100} ${circumference}`;
            const strokeDashoffset = -((cumulativePercent * circumference) / 100);
            cumulativePercent += percent;

            return {
                ...mode,
                color: CHART_PALETTE[index % CHART_PALETTE.length],
                percent: percent.toFixed(1),
                strokeDasharray,
                strokeDashoffset,
            };
        });
    }, [procurementModes, totalModesValuation]);

    // Project types aggregation
    const goodsType = projectTypes.find((p) => p.project_type?.toLowerCase() === 'goods') || {
        project_type: 'Goods',
        count: 0,
        total_amount: 0,
    };
    const infraType = projectTypes.find((p) => p.project_type?.toLowerCase().includes('infra')) || {
        project_type: 'Infrastructure',
        count: 0,
        total_amount: 0,
    };
    const consultType = projectTypes.find((p) => p.project_type?.toLowerCase().includes('consult')) || {
        project_type: 'Consulting Services',
        count: 0,
        total_amount: 0,
    };
    const totalProjectTypeAmount = (goodsType.total_amount + infraType.total_amount + consultType.total_amount) || 1;

    return (
        <div className="space-y-6">
            {/* Header / Summary banner with interactive Fiscal Year Controls */}
            <div className="relative overflow-hidden bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white p-6 sm:p-7 rounded-2xl shadow-xl border border-slate-800">
                {/* Background decorative glow elements */}
                <div className="absolute top-0 right-0 -mr-16 -mt-16 w-80 h-80 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
                <div className="absolute bottom-0 left-1/3 -mb-20 w-80 h-80 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

                <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-2">
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 border border-blue-400/30 text-xs font-semibold uppercase tracking-wider">
                            <BarChart3 className="w-3.5 h-3.5 text-blue-400" />
                            Executive Procurement Intelligence • Live Visual Analytics
                        </div>
                        <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                            Provincial Procurement Visual Intelligence
                        </h2>
                        <p className="text-xs sm:text-sm text-slate-300 max-w-3xl leading-relaxed">
                            Comprehensive visual intelligence covering annual procurement plans, 12-month expenditure projections, procurement modalities (RA 12009 / RA 9184), fund source allocations, and review pipeline velocity.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 shrink-0">
                        {/* Fiscal Year Filter Selector */}
                        <div className="bg-white/10 backdrop-blur-md px-3.5 py-2.5 rounded-xl border border-white/10 flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-blue-300 shrink-0" />
                            <div className="text-left">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="block text-[10px] font-bold text-blue-200 uppercase tracking-wider">
                                        Fiscal Year
                                    </span>
                                    {selectedFiscalYear !== 'ALL' && (
                                        <button
                                            type="button"
                                            onClick={() => setSelectedFiscalYear('ALL')}
                                            className="text-[9px] text-blue-300 hover:text-white underline font-medium cursor-pointer"
                                        >
                                            Show All
                                        </button>
                                    )}
                                </div>
                                <select
                                    value={selectedFiscalYear}
                                    onChange={(e) => setSelectedFiscalYear(e.target.value)}
                                    className="bg-transparent text-xs font-bold text-white focus:outline-none cursor-pointer pr-4"
                                >
                                    <option value="ALL" className="bg-slate-900 text-white">All Fiscal Years</option>
                                    {fiscalYears.map((fy) => (
                                        <option key={fy.fiscal_year} value={fy.fiscal_year} className="bg-slate-900 text-white">
                                            FY {fy.fiscal_year} ({fy.count} plans)
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Total Approved Budget Highlight */}
                        <div className="bg-white/10 backdrop-blur-md px-5 py-3 rounded-xl border border-white/10 text-right">
                            <div className="text-[10px] font-bold text-blue-200 uppercase tracking-wider flex items-center justify-end gap-1">
                                <DollarSign className="w-3 h-3 text-emerald-400" />
                                {selectedFiscalYear === 'ALL' ? 'Total Procurement Budget' : `FY ${selectedFiscalYear} Budget`}
                            </div>
                            <div className="text-xl sm:text-2xl font-black font-mono text-emerald-400">
                                {formatCurrency(activeBudget)}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Metrics Bar inside Header */}
                <div className="relative z-10 mt-6 pt-5 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                    <div>
                        <span className="text-slate-400 block text-[11px]">
                            {selectedFiscalYear === 'ALL' ? 'Total Active Plans' : `FY ${selectedFiscalYear} Plans`}
                        </span>
                        <span className="font-bold text-white text-sm">{totalPpmps} PPMPs</span>
                    </div>
                    <div>
                        <span className="text-slate-400 block text-[11px]">APP Readiness Rate</span>
                        <span className="font-bold text-emerald-400 text-sm">{completionRate}% Cleared</span>
                    </div>
                    <div>
                        <span className="text-slate-400 block text-[11px]">Average Plan Value</span>
                        <span className="font-bold text-blue-300 text-sm font-mono">{formatCurrency(averagePlanSize)}</span>
                    </div>
                    <div>
                        <span className="text-slate-400 block text-[11px]">Review Pipeline Load</span>
                        <span className="font-bold text-amber-300 text-sm">{inReview} Pending Reviews</span>
                    </div>
                </div>
            </div>

            {/* KPI Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Card 1: Total Registered Plans */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 hover:shadow-md transition group">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Registered PPMPs
                        </span>
                        <div className="p-2.5 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition">
                            <Layers className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-slate-900">{totalPpmps}</span>
                        <span className="text-xs font-semibold text-emerald-600">Active Plans</span>
                    </div>
                    <div className="mt-3">
                        <div className="flex justify-between text-[11px] font-medium text-slate-600 mb-1">
                            <span>Ready to Print</span>
                            <span className="font-bold text-emerald-600">{completionRate}% Completed</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                style={{ width: `${completionRate}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Card 2: In Review Pipeline */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-indigo-400 hover:shadow-md transition group">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Active Review Pipeline
                        </span>
                        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-600 group-hover:text-white transition">
                            <Clock className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-indigo-900">{inReview}</span>
                        <span className="text-xs font-semibold text-indigo-600">in PBO / OPPMO / TWG</span>
                    </div>
                    <div className="mt-3">
                        <div className="flex justify-between text-[11px] font-medium text-slate-600 mb-1">
                            <span>Review Volume</span>
                            <span className="font-bold text-indigo-600">{inReviewRate}% of total</span>
                        </div>
                        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                                style={{ width: `${inReviewRate}%` }}
                            />
                        </div>
                    </div>
                </div>

                {/* Card 3: Ready to Print (Approved for APP) */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-emerald-400 hover:shadow-md transition group">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Fully Cleared (Ready to Print)
                        </span>
                        <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-600 group-hover:text-white transition">
                            <CheckCircle2 className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-emerald-900">{readyToPrint}</span>
                        <span className="text-xs font-semibold text-emerald-600">APP Eligible</span>
                    </div>
                    <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        Eligible for official APP consolidation & export
                    </div>
                </div>

                {/* Card 4: Pending Amendments */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-purple-400 hover:shadow-md transition group">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                            Pending Amendments
                        </span>
                        <div className="p-2.5 bg-purple-50 text-purple-600 rounded-lg group-hover:bg-purple-600 group-hover:text-white transition">
                            <RefreshCw className="w-5 h-5" />
                        </div>
                    </div>
                    <div className="mt-3 flex items-baseline gap-2">
                        <span className="text-3xl font-black text-purple-900">{pendingAmendments}</span>
                        <span className="text-xs font-semibold text-purple-600">Requires Head Review</span>
                    </div>
                    <div className="mt-3 text-[11px] text-slate-500 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                        Formal requests for scope or line item adjustment
                    </div>
                </div>
            </div>

            {/* ─── NEW CHART 1: MONTHLY & QUARTERLY PROCUREMENT EXPENDITURE TIMELINE ─── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-blue-600" />
                            Procurement Expenditure Forecast & Timeline (Jan - Dec)
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Projected provincial procurement spending schedule and milestone distribution across the fiscal cycle
                        </p>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {peakMonth && peakMonth.amount > 0 && (
                            <div className="hidden md:flex items-center gap-1.5 px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-xs font-semibold">
                                <Sparkles className="w-3.5 h-3.5 text-amber-600" />
                                <span>Peak Month: <strong>{peakMonth.name}</strong> ({formatCurrency(peakMonth.amount)})</span>
                            </div>
                        )}
                        <div className="bg-slate-100 p-1 rounded-lg flex items-center gap-1 text-xs font-semibold">
                            <button
                                type="button"
                                onClick={() => setTimelineView('monthly')}
                                className={`px-2.5 py-1 rounded-md transition ${
                                    timelineView === 'monthly'
                                        ? 'bg-white text-blue-700 shadow-xs font-bold'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Monthly (12 M)
                            </button>
                            <button
                                type="button"
                                onClick={() => setTimelineView('quarterly')}
                                className={`px-2.5 py-1 rounded-md transition ${
                                    timelineView === 'quarterly'
                                        ? 'bg-white text-blue-700 shadow-xs font-bold'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Quarterly (Q1-Q4)
                            </button>
                        </div>
                    </div>
                </div>

                {timelineView === 'monthly' ? (
                    <div className="mt-6">
                        {/* 12 Months Interactive Bar Graph */}
                        <div className="relative pt-6 pb-2">
                            {/* Hover info badge */}
                            <div className="min-h-6 mb-3 text-xs flex items-center justify-between text-slate-600">
                                {hoveredMonth ? (
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg animate-fadeIn font-medium">
                                        <Calendar className="w-3.5 h-3.5 text-blue-600" />
                                        <span><strong>{hoveredMonth.name}</strong>: {formatCurrency(hoveredMonth.amount)}</span>
                                        <span className="text-slate-400">•</span>
                                        <span>{hoveredMonth.count} line items scheduled</span>
                                        <span className="text-slate-400">•</span>
                                        <span className="text-blue-700 font-bold">
                                            {totalScheduledAmount > 0 ? ((hoveredMonth.amount / totalScheduledAmount) * 100).toFixed(1) : 0}% of schedule
                                        </span>
                                    </div>
                                ) : (
                                    <span className="text-slate-400 text-[11px] italic">
                                        Hover over any monthly bar below to inspect scheduled budget and item counts.
                                    </span>
                                )}
                                <span className="text-[11px] text-slate-400 font-mono">
                                    Total Forecast: {formatCurrency(totalScheduledAmount)}
                                </span>
                            </div>

                            {/* Chart Bar Columns */}
                            <div className="h-56 flex items-end justify-between gap-1 sm:gap-3 px-1 border-b border-slate-200">
                                {monthlySchedule.map((m) => {
                                    const percent = maxMonthAmount > 0 ? (m.amount / maxMonthAmount) * 100 : 0;
                                    const barHeight = Math.max(Math.round(percent), 6);
                                    const isPeak = peakMonth && peakMonth.month === m.month && m.amount > 0;
                                    const isHovered = hoveredMonth?.month === m.month;

                                    return (
                                        <div
                                            key={m.month}
                                            className="flex-1 flex flex-col items-center h-full justify-end group cursor-pointer"
                                            onMouseEnter={() => setHoveredMonth(m)}
                                            onMouseLeave={() => setHoveredMonth(null)}
                                        >
                                            {/* Bar container */}
                                            <div className="w-full flex items-end justify-center h-full pb-1">
                                                <div
                                                    className={`w-full max-w-[42px] rounded-t-lg transition-all duration-300 relative ${
                                                        isHovered
                                                            ? 'bg-blue-600 shadow-md ring-2 ring-blue-400'
                                                            : isPeak
                                                            ? 'bg-gradient-to-t from-amber-500 to-amber-400 shadow-xs'
                                                            : m.amount > 0
                                                            ? 'bg-gradient-to-t from-blue-600 to-indigo-500 group-hover:from-blue-500 group-hover:to-indigo-400'
                                                            : 'bg-slate-100 group-hover:bg-slate-200'
                                                    }`}
                                                    style={{ height: `${barHeight}%` }}
                                                >
                                                    {isPeak && (
                                                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-amber-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-xs whitespace-nowrap">
                                                            PEAK
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Month Label */}
                                            <div className="pt-2 text-center">
                                                <span className={`block text-[11px] font-bold ${
                                                    isHovered ? 'text-blue-700 font-black' : isPeak ? 'text-amber-700' : 'text-slate-600'
                                                }`}>
                                                    {m.name}
                                                </span>
                                                <span className="block text-[9px] text-slate-400 font-mono">
                                                    {m.count > 0 ? `${m.count} items` : '-'}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Quarterly Breakdown Strip */
                    <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {['Q1', 'Q2', 'Q3', 'Q4'].map((qKey) => {
                            const q = quarterlySchedule[qKey] || { label: qKey, amount: 0, count: 0 };
                            const qPercent = totalScheduledAmount > 0 ? Math.round((q.amount / totalScheduledAmount) * 100) : 0;
                            return (
                                <div key={qKey} className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-blue-300 transition">
                                    <div className="flex items-center justify-between text-xs text-slate-500 mb-1 font-semibold">
                                        <span>{q.label}</span>
                                        <span className="font-mono text-blue-600 font-bold">{qPercent}%</span>
                                    </div>
                                    <div className="text-lg font-black font-mono text-slate-900">
                                        {formatCurrency(q.amount)}
                                    </div>
                                    <div className="text-[11px] text-slate-500 mt-1">
                                        {q.count} scheduled procurement items
                                    </div>
                                    <div className="w-full h-2 bg-slate-200 rounded-full mt-3 overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full"
                                            style={{ width: `${qPercent}%` }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ─── NEW CHART 2: MODALITIES DONUT + PROJECT CATEGORY SPLIT ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                {/* Modality SVG Donut Chart (7 cols) */}
                <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                    <PieChart className="w-4 h-4 text-emerald-600" />
                                    Procurement Modalities Market Share (RA 12009 / RA 9184)
                                </h3>
                                <span className="text-xs text-slate-500">
                                    Distribution by legal procurement method and valuation share
                                </span>
                            </div>
                            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg">
                                {procurementModes.length} Modalities
                            </span>
                        </div>

                        {procurementModes.length === 0 ? (
                            <div className="py-12 text-center text-slate-400 text-xs italic">
                                No procurement modalities assigned yet.
                            </div>
                        ) : (
                            <div className="mt-6 grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
                                {/* SVG Ring Donut */}
                                <div className="md:col-span-5 flex flex-col items-center justify-center relative">
                                    <div className="w-44 h-44 relative">
                                        <svg viewBox="0 0 100 100" className="w-full h-full transform -rotate-90">
                                            {/* Background circle track */}
                                            <circle
                                                cx="50"
                                                cy="50"
                                                r="38"
                                                fill="transparent"
                                                stroke="#f1f5f9"
                                                strokeWidth="12"
                                            />
                                            {/* Dynamic Colored Slices */}
                                            {donutSlices.map((slice, idx) => (
                                                <circle
                                                    key={idx}
                                                    cx="50"
                                                    cy="50"
                                                    r="38"
                                                    fill="transparent"
                                                    stroke={slice.color}
                                                    strokeWidth="12"
                                                    strokeDasharray={slice.strokeDasharray}
                                                    strokeDashoffset={slice.strokeDashoffset}
                                                    className="transition-all duration-500 cursor-pointer hover:stroke-width-[14]"
                                                    onMouseEnter={() => setHoveredModality(slice)}
                                                    onMouseLeave={() => setHoveredModality(null)}
                                                />
                                            ))}
                                        </svg>
                                        {/* Center Information */}
                                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-2">
                                            <span className="text-[10px] uppercase font-bold text-slate-400">
                                                Modalities
                                            </span>
                                            <span className="text-base font-black text-slate-900 font-mono">
                                                {procurementModes.length}
                                            </span>
                                            <span className="text-[9px] text-emerald-600 font-bold">
                                                Active Methods
                                            </span>
                                        </div>
                                    </div>
                                    <span className="text-[11px] text-slate-400 mt-2 text-center">
                                        Hover slices for details
                                    </span>
                                </div>

                                {/* Legend & List */}
                                <div className="md:col-span-7 space-y-2.5 max-h-64 overflow-y-auto pr-1">
                                    {donutSlices.map((slice, idx) => {
                                        const isHovered = hoveredModality?.mode === slice.mode;
                                        return (
                                            <div
                                                key={idx}
                                                className={`p-2 rounded-lg border transition cursor-pointer ${
                                                    isHovered
                                                        ? 'bg-blue-50/70 border-blue-300'
                                                        : 'bg-slate-50/50 border-slate-100 hover:bg-slate-50'
                                                }`}
                                                onMouseEnter={() => setHoveredModality(slice)}
                                                onMouseLeave={() => setHoveredModality(null)}
                                            >
                                                <div className="flex items-center justify-between text-xs">
                                                    <div className="flex items-center gap-2 min-w-0 pr-2">
                                                        <span
                                                            className="w-3 h-3 rounded-full shrink-0 shadow-xs"
                                                            style={{ backgroundColor: slice.color }}
                                                        />
                                                        <span className="font-semibold text-slate-800 truncate" title={slice.mode}>
                                                            {slice.mode}
                                                        </span>
                                                    </div>
                                                    <div className="text-right shrink-0">
                                                        <span className="font-mono font-bold text-slate-900">
                                                            {formatCurrency(slice.total_amount)}
                                                        </span>
                                                        <span className="text-slate-400 text-[11px] ml-1.5 font-bold font-mono">
                                                            ({slice.percent}%)
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-[10px] text-slate-500 mt-0.5 pl-5">
                                                    {slice.item_count} items assigned
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                        <span>Framework: <strong>RA 12009 Modernized Standards</strong></span>
                        <span className="font-mono font-bold text-slate-800">
                            Total: {formatCurrency(totalModesValuation)}
                        </span>
                    </div>
                </div>

                {/* Project Category Allocation Split (Goods / Infra / Consulting) (5 cols) */}
                <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                            <div>
                                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                    <Briefcase className="w-4 h-4 text-indigo-600" />
                                    Project Categories Split
                                </h3>
                                <span className="text-xs text-slate-500">
                                    Expenditure across Goods, Infrastructure &amp; Consulting
                                </span>
                            </div>
                        </div>

                        {/* 3 Categories Cards */}
                        <div className="mt-5 space-y-3.5">
                            {/* Goods */}
                            {(() => {
                                const goodsPercent = Math.round((goodsType.total_amount / totalProjectTypeAmount) * 100) || 0;
                                return (
                                    <div className="p-3.5 rounded-xl bg-blue-50/50 border border-blue-200/60 hover:border-blue-300 transition">
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2 font-bold text-blue-950">
                                                <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                                                    <Package className="w-4 h-4" />
                                                </div>
                                                <span>Goods &amp; General Supplies</span>
                                            </div>
                                            <span className="font-mono font-black text-blue-700">{goodsPercent}%</span>
                                        </div>
                                        <div className="mt-2 flex items-baseline justify-between text-xs">
                                            <span className="text-slate-500 font-medium">{goodsType.count} procurement items</span>
                                            <span className="font-mono font-black text-slate-900 text-sm">
                                                {formatCurrency(goodsType.total_amount)}
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-blue-100 rounded-full mt-2 overflow-hidden">
                                            <div
                                                className="h-full bg-blue-600 rounded-full transition-all duration-500"
                                                style={{ width: `${goodsPercent}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Infrastructure */}
                            {(() => {
                                const infraPercent = Math.round((infraType.total_amount / totalProjectTypeAmount) * 100) || 0;
                                return (
                                    <div className="p-3.5 rounded-xl bg-amber-50/50 border border-amber-200/60 hover:border-amber-300 transition">
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2 font-bold text-amber-950">
                                                <div className="p-1.5 bg-amber-100 text-amber-700 rounded-lg">
                                                    <Hammer className="w-4 h-4" />
                                                </div>
                                                <span>Civil Works &amp; Infrastructure</span>
                                            </div>
                                            <span className="font-mono font-black text-amber-700">{infraPercent}%</span>
                                        </div>
                                        <div className="mt-2 flex items-baseline justify-between text-xs">
                                            <span className="text-slate-500 font-medium">{infraType.count} procurement items</span>
                                            <span className="font-mono font-black text-slate-900 text-sm">
                                                {formatCurrency(infraType.total_amount)}
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-amber-100 rounded-full mt-2 overflow-hidden">
                                            <div
                                                className="h-full bg-amber-500 rounded-full transition-all duration-500"
                                                style={{ width: `${infraPercent}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Consulting Services */}
                            {(() => {
                                const consultPercent = Math.round((consultType.total_amount / totalProjectTypeAmount) * 100) || 0;
                                return (
                                    <div className="p-3.5 rounded-xl bg-purple-50/50 border border-purple-200/60 hover:border-purple-300 transition">
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2 font-bold text-purple-950">
                                                <div className="p-1.5 bg-purple-100 text-purple-700 rounded-lg">
                                                    <Briefcase className="w-4 h-4" />
                                                </div>
                                                <span>Consulting &amp; Expert Services</span>
                                            </div>
                                            <span className="font-mono font-black text-purple-700">{consultPercent}%</span>
                                        </div>
                                        <div className="mt-2 flex items-baseline justify-between text-xs">
                                            <span className="text-slate-500 font-medium">{consultType.count} procurement items</span>
                                            <span className="font-mono font-black text-slate-900 text-sm">
                                                {formatCurrency(consultType.total_amount)}
                                            </span>
                                        </div>
                                        <div className="w-full h-2 bg-purple-100 rounded-full mt-2 overflow-hidden">
                                            <div
                                                className="h-full bg-purple-600 rounded-full transition-all duration-500"
                                                style={{ width: `${consultPercent}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400">
                        Categorized pursuant to Section 5, Republic Act No. 12009.
                    </div>
                </div>
            </div>

            {/* ─── NEW CHART 3: SOURCES OF FUND DISTRIBUTION ─── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                            <Landmark className="w-4 h-4 text-blue-600" />
                            Source of Fund Distribution
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Financing composition across General Fund, Trust Fund accounts, Special Education Fund, and external grants
                        </p>
                    </div>
                    <span className="text-xs font-mono font-bold text-slate-700 bg-slate-100 px-3 py-1 rounded-lg">
                        {fundSources.length} Active Funding Sources
                    </span>
                </div>

                {/* Fund Source Stacked Visual Progress Bar */}
                {fundSources.length > 0 && (
                    <div className="mt-4">
                        <div className="w-full h-4 bg-slate-100 rounded-full overflow-hidden flex shadow-inner">
                            {fundSources.map((f, idx) => {
                                const percent = totalBudget > 0 ? (f.total_amount / totalBudget) * 100 : 0;
                                const color = CHART_PALETTE[idx % CHART_PALETTE.length];
                                return (
                                    <div
                                        key={idx}
                                        style={{ width: `${percent}%`, backgroundColor: color }}
                                        className="h-full transition-all duration-500 hover:opacity-90"
                                        title={`${f.source}: ${formatCurrency(f.total_amount)} (${percent.toFixed(1)}%)`}
                                    />
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* Fund Source Individual Cards Grid */}
                <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {fundSources.map((f, idx) => {
                        const percent = totalBudget > 0 ? ((f.total_amount / totalBudget) * 100).toFixed(1) : '0.0';
                        const color = CHART_PALETTE[idx % CHART_PALETTE.length];
                        return (
                            <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 hover:border-slate-300 transition group">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="w-3 h-3 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: color }} />
                                    <span className="text-xs font-bold text-slate-900 truncate" title={f.source}>
                                        {f.source}
                                    </span>
                                </div>
                                <div className="text-lg font-black font-mono text-slate-900">
                                    {formatCurrency(f.total_amount)}
                                </div>
                                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                                    <span>{f.count} items</span>
                                    <span className="font-bold text-blue-600 font-mono">{percent}% of budget</span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ─── NEW CHART 4: WORKFLOW PIPELINE VELOCITY & BOTTLENECK FUNNEL ─── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                            <Compass className="w-4 h-4 text-purple-600" />
                            Procurement Workflow Pipeline &amp; Stage Velocity
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Stage-by-stage progression from End-User creation through Review Offices to final APP consolidation
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                        <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg font-bold">
                            {completionRate}% Reached Final Clearance
                        </span>
                    </div>
                </div>

                {/* Workflow Horizontal Funnel Steps */}
                <div className="mt-6 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
                    {workflowStages.map((stage, idx) => {
                        const isCleared = stage.stage === 'READY_TO_PRINT';
                        const isUnderReview = ['BUDGET_OFFICER_REVIEW', 'PACCO_REVIEW', 'OPPMO_REVIEW', 'TWG_REVIEW'].includes(stage.stage);
                        const hasItems = stage.count > 0;

                        return (
                            <div
                                key={stage.stage}
                                className={`relative p-3 rounded-xl border transition flex flex-col justify-between ${
                                    isCleared && hasItems
                                        ? 'bg-emerald-50/60 border-emerald-300'
                                        : isUnderReview && hasItems
                                        ? 'bg-indigo-50/60 border-indigo-300 ring-1 ring-indigo-200'
                                        : 'bg-slate-50/60 border-slate-200'
                                }`}
                            >
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="text-[10px] font-black text-slate-400 font-mono">
                                            0{idx + 1}
                                        </span>
                                        <span
                                            className="w-2.5 h-2.5 rounded-full"
                                            style={{ backgroundColor: stage.color }}
                                        />
                                    </div>
                                    <div className="text-xs font-bold text-slate-800 leading-snug">
                                        {stage.label}
                                    </div>
                                </div>

                                <div className="mt-4 pt-2 border-t border-slate-200/60 flex items-baseline justify-between">
                                    <span className="text-2xl font-black font-mono text-slate-900">
                                        {stage.count}
                                    </span>
                                    <span className="text-[10px] text-slate-400 font-semibold">
                                        {stage.count === 1 ? 'plan' : 'plans'}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* ─── NEW CHART 5: TOP HIGH-VALUE PROCUREMENT PROJECTS LEADERBOARD ─── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                            <Award className="w-4 h-4 text-amber-500" />
                            Top High-Value Procurement Projects &amp; Items
                        </h3>
                        <p className="text-xs text-slate-500 mt-0.5">
                            Largest estimated budgetary allocations across active provincial procurement line items
                        </p>
                    </div>
                    <span className="text-xs font-mono font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-lg">
                        {topProjects.length} Flagship Items
                    </span>
                </div>

                <div className="mt-4 overflow-x-auto">
                    {topProjects.length === 0 ? (
                        <div className="py-8 text-center text-slate-400 text-xs italic">
                            No high-value items recorded in the current dataset.
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                                <tr>
                                    <th className="p-3 w-12 text-center">Rank</th>
                                    <th className="p-3">Project / Item Description</th>
                                    <th className="p-3">Office</th>
                                    <th className="p-3">Procurement Mode</th>
                                    <th className="p-3">Fund Source</th>
                                    <th className="p-3 text-right">Estimated Budget</th>
                                    {onSelectPpmp && <th className="p-3 text-center w-24">Action</th>}
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {topProjects.map((proj, idx) => {
                                    const rankMedal =
                                        idx === 0
                                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                                            : idx === 1
                                            ? 'bg-slate-200 text-slate-800 border-slate-300'
                                            : idx === 2
                                            ? 'bg-orange-100 text-orange-800 border-orange-300'
                                            : 'bg-blue-50 text-blue-800 border-blue-200';

                                    // Find matching PPMP if available
                                    const matchedPpmp = recentPpmps.find((p) => p.id === proj.ppmp_id);

                                    return (
                                        <tr key={proj.id || idx} className="hover:bg-slate-50 transition">
                                            <td className="p-3 text-center">
                                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full font-mono text-xs font-black border ${rankMedal}`}>
                                                    {idx + 1}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <div className="font-bold text-slate-900 max-w-md truncate" title={proj.description}>
                                                    {proj.description?.replace(/\n/g, ' ')}
                                                </div>
                                                {proj.ppmp_title && (
                                                    <div className="text-[11px] text-slate-400 truncate mt-0.5">
                                                        Plan: {proj.ppmp_title} (FY {proj.fiscal_year})
                                                    </div>
                                                )}
                                            </td>
                                            <td className="p-3">
                                                <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded text-[11px]">
                                                    {proj.office_code}
                                                </span>
                                            </td>
                                            <td className="p-3 text-slate-700">
                                                <span className="inline-block max-w-[180px] truncate" title={proj.procurement_mode}>
                                                    {proj.procurement_mode}
                                                </span>
                                            </td>
                                            <td className="p-3">
                                                <span className="font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                                                    {proj.source_of_fund}
                                                </span>
                                            </td>
                                            <td className="p-3 text-right font-mono font-black text-slate-900">
                                                {formatCurrency(proj.estimated_budget)}
                                            </td>
                                            {onSelectPpmp && (
                                                <td className="p-3 text-center">
                                                    {matchedPpmp ? (
                                                        <button
                                                            type="button"
                                                            onClick={() => onSelectPpmp(matchedPpmp)}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-lg text-[11px] font-bold transition cursor-pointer"
                                                        >
                                                            <Eye className="w-3 h-3" />
                                                            View
                                                        </button>
                                                    ) : (
                                                        <span className="text-[11px] text-slate-400">Archived</span>
                                                    )}
                                                </td>
                                            )}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>

            {/* ─── EXISTING SECTION: OFFICE BUDGET BREAKDOWN & STATUS PROGRESSION ─── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Office Budget Ranking with Search Filter */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                <Building2 className="w-4 h-4 text-blue-600" />
                                Budget Allocation by Implementing Office
                            </h3>
                            <span className="text-xs text-slate-500">
                                Ranked by total estimated budget from active procurement plans
                            </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                            {budgetByOffice.length} Offices
                        </span>
                    </div>

                    {/* Search box for offices */}
                    {budgetByOffice.length > 5 && (
                        <div className="mt-3 relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                placeholder="Search office by code or name..."
                                value={officeSearch}
                                onChange={(e) => setOfficeSearch(e.target.value)}
                                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
                            />
                        </div>
                    )}

                    <div className="mt-4 space-y-4 max-h-96 overflow-y-auto pr-1">
                        {filteredOffices.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-xs italic">
                                No matching office records found.
                            </div>
                        ) : (
                            filteredOffices.map((off, idx) => {
                                const percentage = totalBudget > 0 ? Math.round((off.total_budget / totalBudget) * 100) : 0;
                                const barWidth = Math.max(Math.round((off.total_budget / maxOfficeBudget) * 100), 4);
                                return (
                                    <div key={off.office_id || idx} className="space-y-1.5 group">
                                        <div className="flex items-center justify-between text-xs">
                                            <div className="flex items-center gap-2 min-w-0 pr-2">
                                                <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 font-mono text-[10px] font-bold flex items-center justify-center shrink-0">
                                                    {idx + 1}
                                                </span>
                                                <span className="font-mono font-bold text-blue-700 shrink-0">
                                                    {off.code}
                                                </span>
                                                <span className="text-slate-800 font-medium truncate" title={off.name}>
                                                    {off.name}
                                                </span>
                                                <span className="text-[10px] text-slate-400 shrink-0">
                                                    ({off.ppmp_count} {off.ppmp_count === 1 ? 'plan' : 'plans'})
                                                </span>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <span className="font-mono font-bold text-slate-900">
                                                    {formatCurrency(off.total_budget)}
                                                </span>
                                                <span className="text-[11px] text-slate-400 ml-1 font-semibold">
                                                    ({percentage}%)
                                                </span>
                                            </div>
                                        </div>
                                        {/* Visual Progress Bar */}
                                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-600 rounded-full transition-all duration-500 group-hover:from-blue-600 group-hover:to-indigo-700"
                                                style={{ width: `${barWidth}%` }}
                                            />
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Status Progression Distribution */}
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6">
                    <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                        <div>
                            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                                <PieChart className="w-4 h-4 text-indigo-600" />
                                PPMP Lifecycle &amp; Status Breakdown
                            </h3>
                            <span className="text-xs text-slate-500">
                                Distribution of plans across submission, review, and approval phases
                            </span>
                        </div>
                        <span className="text-xs font-mono font-bold text-slate-600 bg-slate-100 px-2 py-1 rounded">
                            {totalPpmps} Total
                        </span>
                    </div>

                    <div className="mt-4 space-y-4">
                        {statusDistribution.map((item) => {
                            const percent = totalPpmps > 0 ? Math.round((item.count / totalPpmps) * 100) : 0;
                            return (
                                <div key={item.status} className="space-y-1.5">
                                    <div className="flex items-center justify-between text-xs">
                                        <div className="flex items-center gap-2">
                                            <span
                                                className="w-2.5 h-2.5 rounded-full"
                                                style={{ backgroundColor: item.color }}
                                            />
                                            <span className="font-semibold text-slate-800">{item.label}</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="font-bold text-slate-900">{item.count}</span>
                                            <span className="text-slate-400 text-[11px] ml-1.5 font-mono">
                                                ({percent}%)
                                            </span>
                                        </div>
                                    </div>
                                    <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{
                                                width: `${percent}%`,
                                                backgroundColor: item.color,
                                            }}
                                        />
                                    </div>
                                </div>
                            );
                        })}

                        {/* Summary Box */}
                        <div className="mt-6 p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                            <div className="text-xs text-slate-600">
                                <span className="font-bold text-slate-800">Overall Clearance Rate: </span>
                                {completionRate}% of all plans have received final readiness certification.
                            </div>
                            <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-xs font-bold">
                                {readyToPrint} Cleared
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ─── BOTTOM SECTION: MODALITIES BREAKDOWN FULL TABLE ─── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 sm:p-6">
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                    <div>
                        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-emerald-600" />
                            Procurement Modalities Breakdown (RA 12009 / RA 9184)
                        </h3>
                        <span className="text-xs text-slate-500">
                            Line item volume and budgetary distribution grouped by procurement method
                        </span>
                    </div>
                </div>

                <div className="mt-4 overflow-x-auto">
                    {procurementModes.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-xs italic">
                            No procurement items recorded with assigned procurement modes.
                        </div>
                    ) : (
                        <table className="w-full text-left text-xs">
                            <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                                <tr>
                                    <th className="p-3">Procurement Modality</th>
                                    <th className="p-3 text-center">Item Count</th>
                                    <th className="p-3">Visual Distribution</th>
                                    <th className="p-3 text-right">Total Estimated Value</th>
                                    <th className="p-3 text-right">% of Total</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {procurementModes.map((item, idx) => {
                                    const percent = totalBudget > 0 ? ((item.total_amount / totalBudget) * 100).toFixed(1) : '0.0';
                                    const barWidth = Math.max(Math.round((item.total_amount / maxProcurementBudget) * 100), 5);
                                    return (
                                        <tr key={idx} className="hover:bg-slate-50 transition">
                                            <td className="p-3 font-semibold text-slate-900">
                                                <div className="flex items-center gap-2">
                                                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                                                    {item.mode}
                                                </div>
                                            </td>
                                            <td className="p-3 text-center font-mono font-bold text-slate-700">
                                                {item.item_count} items
                                            </td>
                                            <td className="p-3 w-48">
                                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-emerald-500 rounded-full"
                                                        style={{ width: `${barWidth}%` }}
                                                    />
                                                </div>
                                            </td>
                                            <td className="p-3 text-right font-mono font-bold text-slate-900">
                                                {formatCurrency(item.total_amount)}
                                            </td>
                                            <td className="p-3 text-right font-mono font-bold text-blue-600">
                                                {percent}%
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>
            </div>
        </div>
    );
};
