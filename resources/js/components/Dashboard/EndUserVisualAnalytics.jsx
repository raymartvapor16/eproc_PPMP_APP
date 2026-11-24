import React, { useMemo, useState } from 'react';
import { formatCurrency, StatusBadge } from '../UI/StatusBadge';
import {
    BarChart3,
    Coins,
    PiggyBank,
    TrendingUp,
    Sparkles,
    ChevronDown,
    ChevronUp,
    ArrowUpRight,
    PlusCircle,
    Layers,
    CheckCircle2,
    Search,
    Package,
    HardHat,
    Calendar,
} from 'lucide-react';

const formatCompactPeso = (val) => {
    const num = Number(val) || 0;
    if (num >= 1_000_000) return `₱${(num / 1_000_000).toFixed(2)}M`;
    if (num >= 1_000) return `₱${(num / 1_000).toFixed(1)}K`;
    return formatCurrency(num);
};

export const EndUserVisualAnalytics = React.memo(({
    analytics,
    isAdminView = false,
    onSelectPpmp = null,
    onCreateNew = null,
}) => {
    const [collapsed, setCollapsed] = useState(false);
    const [retentionSearch, setRetentionSearch] = useState('');
    const [categoryTab, setCategoryTab] = useState('all');
    const [selectedYear, setSelectedYear] = useState('ALL');

    const availableYears = useMemo(() => {
        if (Array.isArray(analytics?.available_years) && analytics.available_years.length > 0) {
            return analytics.available_years.map(String);
        }
        return (analytics?.by_fiscal_year || []).map((f) => String(f.fiscal_year));
    }, [analytics]);

    const yearScopedAnalytics = useMemo(() => {
        if (selectedYear !== 'ALL' && analytics?.by_year_map?.[selectedYear]) {
            return analytics.by_year_map[selectedYear];
        }
        return analytics;
    }, [analytics, selectedYear]);

    const goodsCat = yearScopedAnalytics?.by_category?.goods_consulting || null;
    const infraCat = yearScopedAnalytics?.by_category?.infrastructure || null;
    const activeSource = categoryTab === 'goods_consulting'
        ? (goodsCat || yearScopedAnalytics)
        : categoryTab === 'infrastructure'
            ? (infraCat || yearScopedAnalytics)
            : yearScopedAnalytics;

    const safe = useMemo(() => {
        const gross = Number(activeSource?.gross_budget || 0);
        const procured = Number(activeSource?.procured_budget || 0);
        const retention = Number(activeSource?.retention_budget || 0);
        const retentionPct = gross > 0 ? Math.min(100, Math.round((retention / gross) * 1000) / 10) : 0;
        const procuredPct = gross > 0 ? Math.max(0, Math.round((100 - retentionPct) * 10) / 10) : 0;
        return {
            gross,
            procured,
            retention,
            retentionPct,
            procuredPct,
            ppmpCount: Number(activeSource?.ppmp_count ?? 0),
            retentionCount: Number(activeSource?.retention_count || 0),
            retentionItems: Array.isArray(activeSource?.retention_items) ? activeSource.retention_items : [],
            statusBreakdown: Array.isArray(activeSource?.status_breakdown) ? activeSource.status_breakdown : [],
            byFiscalYear: Array.isArray(activeSource?.by_fiscal_year) ? activeSource.by_fiscal_year : [],
            byFundSource: Array.isArray(activeSource?.by_fund_source) ? activeSource.by_fund_source : [],
        };
    }, [activeSource]);

    const overallHasData = Boolean(
        analytics && (
            Number(analytics.gross_budget || 0) > 0 ||
            (Array.isArray(analytics.status_breakdown) && analytics.status_breakdown.some((s) => s.count > 0))
        )
    );

    if (!overallHasData) {
        return null;
    }

    const totalStatusCount = safe.statusBreakdown.reduce((s, item) => s + (item.count || 0), 0);
    const radius = 52;
    const circumference = 2 * Math.PI * radius;
    const retentionArc = (safe.retentionPct / 100) * circumference;
    const procuredArc = circumference - retentionArc;
    const maxFundBudget = Math.max(1, ...safe.byFundSource.map((f) => Number(f.gross_budget || 0)));

    return (
        <section className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
            <div className="px-4 sm:px-5 py-3.5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300 shrink-0">
                        <BarChart3 className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="text-xs sm:text-sm font-extrabold uppercase tracking-wider text-white">
                                {isAdminView ? 'All End-Users PPMP Budget & Retention Analytics' : 'My PPMP Budget & Retention Analytics'}
                            </h3>
                            {safe.retention > 0 && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase bg-amber-400/20 text-amber-300 border border-amber-400/40">
                                    <PiggyBank className="w-3 h-3" />
                                    {formatCompactPeso(safe.retention)} Retention Available
                                </span>
                            )}
                        </div>
                        <p className="text-[11px] text-slate-300 truncate">
                            {isAdminView
                                ? 'Province-wide visual summary of all end-user procured budgets & leftover retention funds for future projects'
                                : 'Real-time visual summary of your procured allocations & leftover retention funds for future projects'}
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => setCollapsed((v) => !v)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-xs font-bold text-slate-100 transition cursor-pointer shrink-0"
                >
                    <span>{collapsed ? 'Show Analytics' : 'Hide Analytics'}</span>
                    {collapsed ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
                </button>
            </div>

            {!collapsed && (
                <div className="p-4 sm:p-5 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-200">
                        <div className="inline-flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-xl border border-slate-200">
                            <button
                                type="button"
                                onClick={() => setCategoryTab('all')}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    categoryTab === 'all'
                                        ? 'bg-slate-900 text-white shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
                                }`}
                            >
                                <BarChart3 className="w-3.5 h-3.5" />
                                <span>All Categories</span>
                                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                                    categoryTab === 'all' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                                }`}>
                                    {(goodsCat?.ppmp_count ?? 0) + (infraCat?.ppmp_count ?? 0)}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setCategoryTab('goods_consulting')}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    categoryTab === 'goods_consulting'
                                        ? 'bg-blue-600 text-white shadow-xs'
                                        : 'text-slate-600 hover:text-blue-700 hover:bg-white/70'
                                }`}
                            >
                                <Package className="w-3.5 h-3.5" />
                                <span>Goods &amp; Consulting Services</span>
                                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                                    categoryTab === 'goods_consulting' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-800'
                                }`}>
                                    {goodsCat?.ppmp_count ?? 0}
                                </span>
                            </button>

                            <button
                                type="button"
                                onClick={() => setCategoryTab('infrastructure')}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                    categoryTab === 'infrastructure'
                                        ? 'bg-amber-600 text-white shadow-xs'
                                        : 'text-slate-600 hover:text-amber-700 hover:bg-white/70'
                                }`}
                            >
                                <HardHat className="w-3.5 h-3.5" />
                                <span>Infrastructure</span>
                                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-mono ${
                                    categoryTab === 'infrastructure' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-800'
                                }`}>
                                    {infraCat?.ppmp_count ?? 0}
                                </span>
                            </button>
                        </div>

                        <div className="flex items-center gap-2 flex-wrap">
                            <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs">
                                <Calendar className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                                <span className="text-[11px] font-bold text-slate-600">Year:</span>
                                <select
                                    value={selectedYear}
                                    onChange={(e) => setSelectedYear(e.target.value)}
                                    className="bg-white border border-slate-300 rounded-lg px-2 py-0.5 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-400 cursor-pointer"
                                    aria-label="Filter Analytics by Fiscal Year"
                                >
                                    <option value="ALL">All Years</option>
                                    {availableYears.map((yr) => (
                                        <option key={yr} value={yr}>CY {yr}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {categoryTab === 'all' && (goodsCat || infraCat) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setCategoryTab('goods_consulting')}
                                className="text-left p-3.5 rounded-xl border border-blue-200 bg-blue-50/40 hover:bg-blue-50/80 transition cursor-pointer group"
                            >
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-blue-900">
                                        <Package className="w-4 h-4 text-blue-600" />
                                        Goods &amp; Consulting Services
                                    </span>
                                    <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded-full">
                                        {goodsCat?.ppmp_count ?? 0} PPMP{(goodsCat?.ppmp_count ?? 0) === 1 ? '' : 's'} &rarr;
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-[11px]">
                                    <div>
                                        <span className="text-slate-500 block text-[10px]">Gross</span>
                                        <span className="font-mono font-bold text-slate-900">{formatCompactPeso(goodsCat?.gross_budget || 0)}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 block text-[10px]">Procured</span>
                                        <span className="font-mono font-bold text-emerald-700">{formatCompactPeso(goodsCat?.procured_budget || 0)}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 block text-[10px]">Retention</span>
                                        <span className="font-mono font-bold text-amber-700">{formatCompactPeso(goodsCat?.retention_budget || 0)}</span>
                                    </div>
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setCategoryTab('infrastructure')}
                                className="text-left p-3.5 rounded-xl border border-amber-200 bg-amber-50/40 hover:bg-amber-50/80 transition cursor-pointer group"
                            >
                                <div className="flex items-center justify-between gap-2 mb-2">
                                    <span className="inline-flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-amber-950">
                                        <HardHat className="w-4 h-4 text-amber-600" />
                                        Infrastructure
                                    </span>
                                    <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                                        {infraCat?.ppmp_count ?? 0} PPMP{(infraCat?.ppmp_count ?? 0) === 1 ? '' : 's'} &rarr;
                                    </span>
                                </div>
                                <div className="grid grid-cols-3 gap-2 text-[11px]">
                                    <div>
                                        <span className="text-slate-500 block text-[10px]">Gross</span>
                                        <span className="font-mono font-bold text-slate-900">{formatCompactPeso(infraCat?.gross_budget || 0)}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 block text-[10px]">Procured</span>
                                        <span className="font-mono font-bold text-emerald-700">{formatCompactPeso(infraCat?.procured_budget || 0)}</span>
                                    </div>
                                    <div>
                                        <span className="text-slate-500 block text-[10px]">Retention</span>
                                        <span className="font-mono font-bold text-amber-700">{formatCompactPeso(infraCat?.retention_budget || 0)}</span>
                                    </div>
                                </div>
                            </button>
                        </div>
                    )}
                    {safe.retention > 0 && (
                        <div className="p-3.5 sm:p-4 rounded-xl bg-gradient-to-r from-amber-50 via-orange-50/70 to-emerald-50/60 border border-amber-300/90 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
                                    <Sparkles className="w-5 h-5" />
                                </div>
                                <div className="min-w-0">
                                    <div className="text-xs font-extrabold uppercase tracking-wide text-amber-950">
                                        Leftover Retention Ready for Future Procurement
                                    </div>
                                    <p className="text-xs text-amber-900 mt-0.5 leading-relaxed">
                                        {isAdminView ? 'End-Users currently have ' : 'You have '}
                                        <strong className="font-mono text-amber-950 underline decoration-amber-400">{formatCurrency(safe.retention)}</strong> ({safe.retentionPct}% of gross budget) in leftover retention across <strong>{safe.retentionCount}</strong> PPMP{safe.retentionCount === 1 ? '' : 's'} available for future procurement projects.
                                    </p>
                                </div>
                            </div>
                            {!isAdminView && onCreateNew && (
                                <button
                                    type="button"
                                    onClick={onCreateNew}
                                    className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold uppercase tracking-wider shadow-xs transition cursor-pointer shrink-0"
                                >
                                    <PlusCircle className="w-4 h-4" />
                                    <span>Use for Future PPMP</span>
                                </button>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/90 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                                <Coins className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                    Gross Authorized Budget
                                </div>
                                <div className="text-base sm:text-lg font-mono font-black text-slate-900 truncate">
                                    {formatCurrency(safe.gross)}
                                </div>
                                <div className="text-[10px] text-slate-500">
                                    Across {totalStatusCount} active PPMP{totalStatusCount === 1 ? '' : 's'}
                                </div>
                            </div>
                        </div>

                        <div className="p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200/90 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                                <TrendingUp className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                                    Net Procured Budget
                                </div>
                                <div className="text-base sm:text-lg font-mono font-black text-emerald-950 truncate">
                                    {formatCurrency(safe.procured)}
                                </div>
                                <div className="text-[10px] text-emerald-700 font-semibold">
                                    {safe.procuredPct}% allocated to procurement
                                </div>
                            </div>
                        </div>

                        <div className={`p-3.5 rounded-xl border flex items-center gap-3 ${
                            safe.retention > 0
                                ? 'bg-amber-50/80 border-amber-300'
                                : 'bg-slate-50 border-slate-200/90'
                        }`}>
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                                safe.retention > 0 ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'
                            }`}>
                                <PiggyBank className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                                <div className={`text-[10px] font-bold uppercase tracking-wider ${
                                    safe.retention > 0 ? 'text-amber-800' : 'text-slate-500'
                                }`}>
                                    Leftover Retention Balance
                                </div>
                                <div className={`text-base sm:text-lg font-mono font-black truncate ${
                                    safe.retention > 0 ? 'text-amber-950' : 'text-slate-700'
                                }`}>
                                    {formatCurrency(safe.retention)}
                                </div>
                                <div className={`text-[10px] font-semibold ${
                                    safe.retention > 0 ? 'text-amber-700' : 'text-slate-400'
                                }`}>
                                    {safe.retention > 0
                                        ? `${safe.retentionPct}% available for future projects`
                                        : 'No retention leftover recorded'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                        <div className="lg:col-span-5 p-4 rounded-xl border border-slate-200 bg-slate-50/50 flex flex-col justify-between gap-3">
                            <div className="flex items-center justify-between">
                                <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800">
                                    Procured vs. Retention Split
                                </h4>
                                <span className="text-[10px] font-mono font-bold text-slate-500">
                                    100% Gross
                                </span>
                            </div>

                            <div className="flex items-center justify-center gap-5 py-1 flex-wrap sm:flex-nowrap">
                                <div className="relative w-32 h-32 shrink-0">
                                    <svg viewBox="0 0 128 128" className="w-full h-full -rotate-90">
                                        <circle
                                            cx="64"
                                            cy="64"
                                            r={radius}
                                            fill="none"
                                            stroke="#e2e8f0"
                                            strokeWidth="14"
                                        />
                                        {safe.gross > 0 && (
                                            <circle
                                                cx="64"
                                                cy="64"
                                                r={radius}
                                                fill="none"
                                                stroke="#10b981"
                                                strokeWidth="14"
                                                strokeDasharray={`${procuredArc} ${circumference}`}
                                                strokeLinecap="butt"
                                            />
                                        )}
                                        {safe.retention > 0 && (
                                            <circle
                                                cx="64"
                                                cy="64"
                                                r={radius}
                                                fill="none"
                                                stroke="#f59e0b"
                                                strokeWidth="14"
                                                strokeDasharray={`${retentionArc} ${circumference}`}
                                                strokeDashoffset={-procuredArc}
                                                strokeLinecap="butt"
                                            />
                                        )}
                                    </svg>
                                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                                        <span className="text-[10px] font-bold uppercase text-slate-400">
                                            {safe.retention > 0 ? 'Retention' : 'Procured'}
                                        </span>
                                        <span className={`text-base font-mono font-black ${
                                            safe.retention > 0 ? 'text-amber-700' : 'text-emerald-700'
                                        }`}>
                                            {safe.retention > 0 ? `${safe.retentionPct}%` : `${safe.procuredPct}%`}
                                        </span>
                                    </div>
                                </div>

                                <div className="space-y-2.5 flex-1 min-w-[150px] text-xs">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                                            Procured ({safe.procuredPct}%)
                                        </span>
                                        <span className="font-mono font-bold text-slate-900">
                                            {formatCompactPeso(safe.procured)}
                                        </span>
                                    </div>
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="inline-flex items-center gap-1.5 font-semibold text-slate-700">
                                            <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                                            Retention ({safe.retentionPct}%)
                                        </span>
                                        <span className="font-mono font-bold text-amber-800">
                                            {formatCompactPeso(safe.retention)}
                                        </span>
                                    </div>
                                    {safe.byFiscalYear.length > 0 && (
                                        <div className="pt-2 border-t border-slate-200 space-y-1">
                                            <div className="text-[10px] font-bold uppercase text-slate-400">
                                                By Fiscal Year
                                            </div>
                                            {safe.byFiscalYear.slice(0, 3).map((fy) => (
                                                <div key={fy.fiscal_year} className="flex items-center justify-between text-[11px]">
                                                    <span className="font-semibold text-slate-600">CY {fy.fiscal_year} ({fy.count})</span>
                                                    <span className="font-mono font-bold text-slate-800">
                                                        {formatCompactPeso(fy.gross_budget)}
                                                        {fy.retention_budget > 0 && (
                                                            <span className="text-amber-700 ml-1">
                                                                (+{formatCompactPeso(fy.retention_budget)} ret.)
                                                            </span>
                                                        )}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-7 p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-4">
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                        PPMP Workflow Status Distribution
                                    </h4>
                                    <span className="text-[10px] font-mono font-bold text-slate-500">
                                        {totalStatusCount} Total
                                    </span>
                                </div>
                                <div className="w-full h-3 rounded-full bg-slate-200 overflow-hidden flex">
                                    {safe.statusBreakdown.map((st) => {
                                        const pct = totalStatusCount > 0 ? (st.count / totalStatusCount) * 100 : 0;
                                        if (pct <= 0) return null;
                                        return (
                                            <div
                                                key={st.key}
                                                style={{ width: `${pct}%`, backgroundColor: st.color }}
                                                className="h-full"
                                                title={`${st.label}: ${st.count}`}
                                            />
                                        );
                                    })}
                                </div>
                                <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {safe.statusBreakdown.map((st) => (
                                        <div key={st.key} className="flex items-center justify-between px-2 py-1 rounded-lg bg-white border border-slate-200/80 text-[11px]">
                                            <span className="inline-flex items-center gap-1.5 text-slate-600 font-medium truncate">
                                                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: st.color }} />
                                                <span className="truncate">{st.label}</span>
                                            </span>
                                            <span className="font-mono font-extrabold text-slate-900 ml-1">{st.count}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {safe.byFundSource.length > 0 && (
                                <div className="pt-3 border-t border-slate-200">
                                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-slate-800 flex items-center gap-1.5 mb-2">
                                        <Layers className="w-3.5 h-3.5 text-indigo-600" />
                                        Top Fund Sources
                                    </h4>
                                    <div className="space-y-2">
                                        {safe.byFundSource.slice(0, 4).map((fs) => {
                                            const barPct = Math.max(4, Math.round((fs.gross_budget / maxFundBudget) * 100));
                                            const retBarPct = fs.gross_budget > 0
                                                ? Math.min(100, Math.round((fs.retention_budget / fs.gross_budget) * 100))
                                                : 0;
                                            return (
                                                <div key={fs.source_of_fund} className="space-y-1">
                                                    <div className="flex items-center justify-between gap-2 text-[11px]">
                                                        <span className="font-semibold text-slate-700 truncate" title={fs.source_of_fund}>
                                                            {fs.source_of_fund}
                                                        </span>
                                                        <span className="font-mono font-bold text-slate-900 shrink-0">
                                                            {formatCompactPeso(fs.gross_budget)}
                                                            {fs.retention_budget > 0 && (
                                                                <span className="text-amber-700 font-semibold ml-1.5">
                                                                    ({formatCompactPeso(fs.retention_budget)} ret.)
                                                                </span>
                                                            )}
                                                        </span>
                                                    </div>
                                                    <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                                                        <div
                                                            className="h-full rounded-full bg-indigo-500 flex justify-end overflow-hidden"
                                                            style={{ width: `${barPct}%` }}
                                                        >
                                                            {retBarPct > 0 && (
                                                                <div
                                                                    className="h-full bg-amber-400"
                                                                    style={{ width: `${retBarPct}%` }}
                                                                />
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {safe.retentionItems.length > 0 && (() => {
                        const q = retentionSearch.trim().toLowerCase();
                        const filteredRet = q
                            ? safe.retentionItems.filter((item) =>
                                (item.tracking_number || '').toLowerCase().includes(q) ||
                                (item.title || '').toLowerCase().includes(q) ||
                                (item.creator_name || '').toLowerCase().includes(q) ||
                                (item.office_code || '').toLowerCase().includes(q) ||
                                (item.office_name || '').toLowerCase().includes(q)
                            )
                            : safe.retentionItems;

                        return (
                        <div className="rounded-xl border border-amber-200 bg-amber-50/30 overflow-hidden">
                            <div className="px-3.5 py-2.5 bg-amber-100/70 border-b border-amber-200 flex items-center justify-between gap-2 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <PiggyBank className="w-4 h-4 text-amber-700" />
                                    <h4 className="text-xs font-extrabold uppercase tracking-wider text-amber-950">
                                        {isAdminView ? `All End-User PPMPs with Leftover Retention (${filteredRet.length})` : `PPMPs with Leftover Retention (${safe.retentionItems.length})`}
                                    </h4>
                                </div>
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    {isAdminView && (
                                        <div className="relative">
                                            <Search className="w-3.5 h-3.5 text-amber-700/70 absolute left-2.5 top-1/2 -translate-y-1/2" />
                                            <input
                                                type="text"
                                                value={retentionSearch}
                                                onChange={(e) => setRetentionSearch(e.target.value)}
                                                placeholder="Search end-user, office, tracker..."
                                                className="pl-7 pr-2.5 py-1 text-[11px] bg-white border border-amber-300 rounded-lg text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-400 w-52"
                                            />
                                        </div>
                                    )}
                                    <span className="text-[11px] font-mono font-extrabold text-amber-900">
                                        Total Leftover: {formatCurrency(safe.retention)}
                                    </span>
                                </div>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-xs">
                                    <thead className="bg-white/80 text-[10px] uppercase tracking-wider text-slate-500 border-b border-amber-200/70">
                                        <tr>
                                            <th className="px-3 py-2 font-bold">Tracker No.</th>
                                            {isAdminView && <th className="px-3 py-2 font-bold">End-User / Office</th>}
                                            <th className="px-3 py-2 font-bold">Project Title</th>
                                            <th className="px-3 py-2 font-bold text-right">Gross Budget</th>
                                            <th className="px-3 py-2 font-bold text-right">Procured</th>
                                            <th className="px-3 py-2 font-bold text-right">Retention Leftover</th>
                                            <th className="px-3 py-2 font-bold">Status</th>
                                            <th className="px-3 py-2 font-bold text-right">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-amber-100 bg-white/70">
                                        {filteredRet.map((item) => (
                                            <tr key={item.ppmp_id} className="hover:bg-amber-50/60 transition">
                                                <td className="px-3 py-2 font-mono font-bold text-slate-800 whitespace-nowrap">
                                                    {item.tracking_number}
                                                    <span className="block text-[10px] font-normal text-slate-400">CY {item.fiscal_year}</span>
                                                </td>
                                                {isAdminView && (
                                                    <td className="px-3 py-2 max-w-[190px]">
                                                        <div className="font-bold text-slate-800 truncate" title={item.creator_name}>
                                                            {item.creator_name || 'End-User'}
                                                        </div>
                                                        <div className="text-[10px] text-slate-500 truncate" title={item.office_name || item.office_code}>
                                                            {item.office_code ? `${item.office_code} • ` : ''}{item.office_name || '—'}
                                                        </div>
                                                    </td>
                                                )}
                                                <td className="px-3 py-2 max-w-[260px]">
                                                    <div className="font-semibold text-slate-900 truncate" title={item.title}>
                                                        {item.title}
                                                    </div>
                                                    {item.remarks && (
                                                        <div className="text-[10px] text-amber-700 truncate">{item.remarks}</div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono text-slate-700 whitespace-nowrap">
                                                    {formatCurrency(item.gross_budget)}
                                                </td>
                                                <td className="px-3 py-2 text-right font-mono font-semibold text-emerald-700 whitespace-nowrap">
                                                    {formatCurrency(item.procured_budget)}
                                                </td>
                                                <td className="px-3 py-2 text-right whitespace-nowrap">
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-mono font-extrabold text-[11px] bg-amber-100 text-amber-900 border border-amber-300">
                                                        {formatCurrency(item.retention_amount)}
                                                        {item.retention_percentage > 0 && (
                                                            <span className="text-[10px] font-bold text-amber-700">
                                                                ({item.retention_percentage}%)
                                                            </span>
                                                        )}
                                                    </span>
                                                </td>
                                                <td className="px-3 py-2 whitespace-nowrap">
                                                    <StatusBadge status={item.status} />
                                                </td>
                                                <td className="px-3 py-2 text-right whitespace-nowrap">
                                                    {onSelectPpmp && (
                                                        <button
                                                            type="button"
                                                            onClick={() => onSelectPpmp({ uuid: item.ppmp_uuid, id: item.ppmp_id })}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold transition cursor-pointer"
                                                        >
                                                            <span>Open</span>
                                                            <ArrowUpRight className="w-3 h-3" />
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                        );
                    })()}
                </div>
            )}
        </section>
    );
});
