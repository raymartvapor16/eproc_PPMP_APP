import React, { useState, useEffect, useMemo } from 'react';
import {
    LayoutDashboard,
    FileSpreadsheet,
    FileCheck2,
    Clock,
    AlertCircle,
    CheckCircle2,
    Paperclip,
    Filter,
    RotateCcw,
    Printer,
    Eye,
    ShieldCheck,
    Layers,
    Search,
    ChevronRight,
    TrendingUp,
    Calendar,
    ArrowUpRight,
    Sparkles,
    Building2,
    RefreshCw,
    Loader2,
    LogOut,
} from 'lucide-react';
import { pimsService } from '../../services/api';
import { formatCurrency, formatDate } from '../../components/UI/StatusBadge';
import { GeneratePurchaseRequestModal } from '../../components/PIMS/GeneratePurchaseRequestModal';
import { PurchaseRequestPrintView } from '../../components/PIMS/PurchaseRequestPrintView';
import { PurchaseRequestReviewModal } from '../../components/PIMS/PurchaseRequestReviewModal';
import { PurchaseRequestDetailModal } from '../../components/PIMS/PurchaseRequestDetailModal';
import { PimsPublishModal } from '../../components/Monitoring/PimsPublishModal';
import { SystemSwitcherDropdown } from '../../components/Layout/SystemSwitcherDropdown';

export const PimsDashboard = ({
    user = null,
    onNavigate = null,
    onLogout = null,
    onNavigatePpmp = null,
    onNavigateMonitoring = null,
}) => {
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState(null);
    const [error, setError] = useState('');

    // Filter states
    const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedSource, setSelectedSource] = useState('ALL'); // 'ALL' | 'PPMP' | 'APP'
    const [selectedCategory, setSelectedCategory] = useState('ALL'); // 'ALL' | 'GOODS_CONSULTING' | 'INFRA'
    const [selectedStatus, setSelectedStatus] = useState('ALL');
    const [searchQuery, setSearchQuery] = useState('');

    // Modals state
    const [selectedPpmpForMonitoring, setSelectedPpmpForMonitoring] = useState(null);
    const [isMonitoringModalOpen, setIsMonitoringModalOpen] = useState(false);

    const [selectedPpmpUuidForPr, setSelectedPpmpUuidForPr] = useState(null);
    const [selectedMonitoringProjectIdForPr, setSelectedMonitoringProjectIdForPr] = useState(null);
    const [isGeneratePrModalOpen, setIsGeneratePrModalOpen] = useState(false);

    const [selectedPrForView, setSelectedPrForView] = useState(null);
    const [isPrDetailModalOpen, setIsPrDetailModalOpen] = useState(false);

    const [selectedPrForReview, setSelectedPrForReview] = useState(null);
    const [isPrReviewModalOpen, setIsPrReviewModalOpen] = useState(false);

    const [selectedPrForPrint, setSelectedPrForPrint] = useState(null);

    // Active status filter toggle from clicking summary cards
    const [activeFilterCard, setActiveFilterCard] = useState(null);

    const loadDashboardData = async (isManual = false) => {
        if (isManual) setRefreshing(true);
        else setLoading(true);
        setError('');

        try {
            const params = {
                year: selectedYear,
                start_date: startDate || undefined,
                end_date: endDate || undefined,
                source: selectedSource !== 'ALL' ? selectedSource : undefined,
                category: selectedCategory !== 'ALL' ? selectedCategory : undefined,
                status: selectedStatus !== 'ALL' ? selectedStatus : undefined,
            };

            const res = await pimsService.getDashboard(params);
            setData(res.data);
        } catch (err) {
            console.error('Failed to load PIMS dashboard data', err);
            setError(err.response?.data?.message || 'Failed to load PIMS Dashboard data.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadDashboardData();
    }, [selectedYear, startDate, endDate, selectedSource, selectedCategory, selectedStatus]);

    // Listen to real-time events across the system
    useEffect(() => {
        const handleSync = () => {
            loadDashboardData(true);
        };
        window.addEventListener('pims:published', handleSync);
        window.addEventListener('pims:pr_generated', handleSync);
        window.addEventListener('pims:pr_updated', handleSync);
        window.addEventListener('monitoring:updated', handleSync);
        return () => {
            window.removeEventListener('pims:published', handleSync);
            window.removeEventListener('pims:pr_generated', handleSync);
            window.removeEventListener('pims:pr_updated', handleSync);
            window.removeEventListener('monitoring:updated', handleSync);
        };
    }, [selectedYear, selectedSource, selectedCategory, selectedStatus]);

    // Handle Card Click Filter
    const handleCardClick = (filterType) => {
        if (activeFilterCard === filterType) {
            setActiveFilterCard(null);
            setSelectedStatus('ALL');
        } else {
            setActiveFilterCard(filterType);
            if (filterType === 'pending_monitoring') {
                setSelectedStatus('AWAITING_MONITORING');
            } else if (filterType === 'pr_approved') {
                setSelectedStatus('PR_APPROVED');
            } else if (filterType === 'under_review') {
                setSelectedStatus('PR_DIVISION_REVIEW');
            }
        }
    };

    // Filtered Recent Activities Table
    const filteredActivities = useMemo(() => {
        const list = data?.recent_activities || [];
        if (!searchQuery.trim()) return list;
        const q = searchQuery.toLowerCase();
        return list.filter((item) =>
            (item.tracker_id && item.tracker_id.toLowerCase().includes(q)) ||
            (item.title && item.title.toLowerCase().includes(q)) ||
            (item.department && item.department.toLowerCase().includes(q)) ||
            (item.pr_status && item.pr_status.toLowerCase().includes(q))
        );
    }, [data?.recent_activities, searchQuery]);

    // Full Print View Screen
    if (selectedPrForPrint) {
        return (
            <PurchaseRequestPrintView
                purchaseRequest={selectedPrForPrint}
                onBack={() => setSelectedPrForPrint(null)}
                user={user}
                onReview={(pr) => {
                    setSelectedPrForReview(pr);
                    setIsPrReviewModalOpen(true);
                }}
            />
        );
    }

    const summary = data?.summary || {
        total_requirements: 0,
        total_published: 0,
        pending_monitoring: 0,
        monitoring_completed: 0,
        pending_pr_generation: 0,
        generated_prs: 0,
        total_attachments: 0,
        pending_actions: 0,
    };

    const charts = data?.charts || {};
    const pendingActionsList = data?.pending_actions_list || [];

    return (
        <div className="min-h-screen bg-slate-100/80 text-slate-800 flex flex-col font-sans selection:bg-purple-600 selection:text-white">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-40 bg-gradient-to-r from-slate-900 via-slate-900 to-purple-950 text-white border-b border-purple-500/30 px-4 sm:px-6 py-3 shadow-md">
                <div className="max-w-[1600px] mx-auto flex items-center justify-between gap-4">
                    {/* Brand / Logo */}
                    <div className="flex items-center gap-3">
                        <img
                            src="/images/logo.png"
                            alt="Province Seal"
                            className="w-10 h-10 object-contain"
                            onError={(e) => { e.target.style.display = 'none'; }}
                        />
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 via-indigo-600 to-purple-700 flex items-center justify-center text-white shadow-lg shadow-purple-500/25 shrink-0">
                            <Layers className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-sm sm:text-base font-black tracking-tight text-white uppercase">
                                    PIMS • Procurement Information Management System
                                </h1>
                                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-500/20 text-purple-300 border border-purple-400/30">
                                    Official
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-400 hidden sm:block">
                                Province of Davao del Sur • Office of the Provincial Procurement Management Officer
                            </p>
                        </div>
                    </div>

                    {/* Navigation Actions */}
                    <div className="flex items-center gap-2.5">
                        <SystemSwitcherDropdown
                            user={user}
                            currentSystem="pims"
                            onNavigate={onNavigate || ((view) => {
                                if (view === 'dashboard' || view === 'ppmps') onNavigatePpmp && onNavigatePpmp();
                                else if (view === 'monitoring') onNavigateMonitoring && onNavigateMonitoring();
                            })}
                        />

                        <button
                            type="button"
                            onClick={() => loadDashboardData(true)}
                            disabled={refreshing}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer border border-slate-700 shadow-xs"
                            title="Refresh Data"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-purple-400' : ''}`} />
                        </button>

                        {/* User Badge */}
                        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                            <div className="text-right hidden md:block">
                                <div className="text-xs font-bold text-white leading-tight">{user?.name}</div>
                                <div className="text-[10px] text-purple-400 font-semibold uppercase tracking-wider">
                                    {user?.role === 'super_admin' ? 'Super Admin' : user?.designation || user?.role}
                                </div>
                            </div>
                            {onLogout && (
                                <button
                                    type="button"
                                    onClick={onLogout}
                                    className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold transition cursor-pointer flex items-center gap-1.5"
                                >
                                    <LogOut className="w-3.5 h-3.5" />
                                    <span>Logout</span>
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 max-w-[1600px] w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
                {/* Top Section */}
                <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 sm:p-6">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="flex items-start gap-3.5">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-700 via-indigo-600 to-blue-500 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
                            <Layers className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5">
                                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                                    PIMS Dashboard
                                </h1>
                                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200/80">
                                    Procurement Information Management
                                </span>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-500 mt-1">
                                Centralized procurement surveillance, monitoring progression, and Purchase Request (PR) workflow management.
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
                        <button
                            type="button"
                            onClick={() => loadDashboardData(true)}
                            className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-xl flex items-center gap-1.5 transition cursor-pointer"
                            title="Refresh data"
                        >
                            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
                            <span>Refresh</span>
                        </button>
                    </div>
                </div>

                {/* Filters Row */}
                <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {/* Year */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Fiscal Year</label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="ALL">All Years</option>
                            <option value="2027">2027</option>
                            <option value="2026">2026</option>
                            <option value="2025">2025</option>
                        </select>
                    </div>

                    {/* Source */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Source</label>
                        <select
                            value={selectedSource}
                            onChange={(e) => setSelectedSource(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="ALL">All Sources (PPMP & APP)</option>
                            <option value="PPMP">PPMP Requirements</option>
                            <option value="APP">APP Requirements</option>
                        </select>
                    </div>

                    {/* Category */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Category</label>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="ALL">All Categories</option>
                            <option value="GOODS_CONSULTING">Goods & Consulting</option>
                            <option value="INFRA">Infrastructure Projects</option>
                        </select>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">PR Status</label>
                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 font-semibold focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="ALL">All Statuses</option>
                            <option value="PR_DIVISION_REVIEW">PR Division Review</option>
                            <option value="BAC_TWG_REVIEW">BAC-TWG Review</option>
                            <option value="PR_CONTROL_REVIEW">PR Control Review</option>
                            <option value="PR_APPROVED">PR Approved</option>
                            <option value="RETURNED">Returned</option>
                        </select>
                    </div>

                    {/* Date From */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Date From</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500"
                        />
                    </div>

                    {/* Date To */}
                    <div>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Date To</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="w-full px-2 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>
            </div>

            {/* Second Section: 8 Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
                {/* 1. Total Requirements */}
                <div
                    onClick={() => handleCardClick('total')}
                    className="p-4 bg-white rounded-2xl shadow-xs border border-slate-200/80 hover:border-blue-400 hover:shadow-md transition cursor-pointer group"
                >
                    <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Req.</div>
                    <div className="mt-2 text-2xl font-extrabold text-slate-900 group-hover:text-blue-600 transition">
                        {summary.total_requirements}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">PPMP & APP</div>
                </div>

                {/* 2. Total Published */}
                <div
                    onClick={() => handleCardClick('published')}
                    className="p-4 bg-white rounded-2xl shadow-xs border border-slate-200/80 hover:border-blue-400 hover:shadow-md transition cursor-pointer group"
                >
                    <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Published</div>
                    <div className="mt-2 text-2xl font-extrabold text-blue-700">
                        {summary.total_published}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">On PIMS System</div>
                </div>

                {/* 3. Pending Monitoring */}
                <div
                    onClick={() => handleCardClick('pending_monitoring')}
                    className="p-4 bg-white rounded-2xl shadow-xs border border-slate-200/80 hover:border-amber-400 hover:shadow-md transition cursor-pointer group"
                >
                    <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider">Pending Monitor</div>
                    <div className="mt-2 text-2xl font-extrabold text-amber-600">
                        {summary.pending_monitoring}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Needs Form</div>
                </div>

                {/* 4. Monitoring Completed */}
                <div
                    onClick={() => handleCardClick('monitoring_completed')}
                    className="p-4 bg-white rounded-2xl shadow-xs border border-slate-200/80 hover:border-emerald-400 hover:shadow-md transition cursor-pointer group"
                >
                    <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Monitored</div>
                    <div className="mt-2 text-2xl font-extrabold text-emerald-600">
                        {summary.monitoring_completed}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Completed Steps</div>
                </div>

                {/* 5. Pending PR Generation */}
                <div
                    onClick={() => handleCardClick('pending_pr')}
                    className="p-4 bg-white rounded-2xl shadow-xs border border-slate-200/80 hover:border-purple-400 hover:shadow-md transition cursor-pointer group"
                >
                    <div className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Pending PR</div>
                    <div className="mt-2 text-2xl font-extrabold text-purple-600">
                        {summary.pending_pr_generation}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Awaiting PR</div>
                </div>

                {/* 6. Generated Purchase Requests */}
                <div
                    onClick={() => handleCardClick('generated_prs')}
                    className="p-4 bg-white rounded-2xl shadow-xs border border-slate-200/80 hover:border-indigo-400 hover:shadow-md transition cursor-pointer group"
                >
                    <div className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">Generated PRs</div>
                    <div className="mt-2 text-2xl font-extrabold text-indigo-700">
                        {summary.generated_prs}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">PR Documents</div>
                </div>

                {/* 7. Total Attachments */}
                <div
                    onClick={() => handleCardClick('attachments')}
                    className="p-4 bg-white rounded-2xl shadow-xs border border-slate-200/80 hover:border-slate-400 hover:shadow-md transition cursor-pointer group"
                >
                    <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">Attachments</div>
                    <div className="mt-2 text-2xl font-extrabold text-slate-700">
                        {summary.total_attachments}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-1">Supporting Files</div>
                </div>

                {/* 8. Pending Actions */}
                <div
                    onClick={() => handleCardClick('pending_actions')}
                    className="p-4 bg-rose-50/70 rounded-2xl shadow-xs border border-rose-200 hover:border-rose-400 hover:shadow-md transition cursor-pointer group"
                >
                    <div className="text-[11px] font-bold text-rose-600 uppercase tracking-wider">Actions Needed</div>
                    <div className="mt-2 text-2xl font-extrabold text-rose-700">
                        {summary.pending_actions}
                    </div>
                    <div className="text-[10px] text-rose-500 mt-1 font-semibold">Immediate Attention</div>
                </div>
            </div>

            {/* Middle Section: Dashboard Charts and Analytics */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Chart 1: Status Distribution */}
                <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                            <TrendingUp className="w-4 h-4 text-blue-600" />
                            <span>Requirements by Status</span>
                        </div>
                    </div>
                    <div className="space-y-3 pt-2">
                        {(charts.status?.labels || []).map((label, idx) => {
                            const val = charts.status?.data?.[idx] || 0;
                            const maxVal = Math.max(...(charts.status?.data || [1]), 1);
                            const pct = Math.round((val / maxVal) * 100);
                            const color = charts.status?.colors?.[idx] || '#3b82f6';
                            return (
                                <div key={idx} className="space-y-1">
                                    <div className="flex justify-between text-xs font-semibold text-slate-700">
                                        <span>{label}</span>
                                        <span className="font-extrabold text-slate-900">{val}</span>
                                    </div>
                                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full rounded-full transition-all duration-500"
                                            style={{ width: `${pct}%`, backgroundColor: color }}
                                        />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Chart 2: Source Distribution (PPMP vs APP) & Category */}
                <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 space-y-4">
                    <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <FileSpreadsheet className="w-4 h-4 text-indigo-600" />
                        <span>Source & Category Distribution</span>
                    </div>

                    <div className="grid grid-cols-2 gap-3 pt-2">
                        <div className="p-3.5 bg-blue-50/70 border border-blue-200/70 rounded-xl text-center">
                            <div className="text-[10px] font-bold text-blue-700 uppercase">PPMP Source</div>
                            <div className="text-2xl font-black text-blue-900 mt-1">{charts.source?.data?.[0] || 0}</div>
                        </div>
                        <div className="p-3.5 bg-teal-50/70 border border-teal-200/70 rounded-xl text-center">
                            <div className="text-[10px] font-bold text-teal-700 uppercase">APP Source</div>
                            <div className="text-2xl font-black text-teal-900 mt-1">{charts.source?.data?.[1] || 0}</div>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 space-y-2.5">
                        <div className="text-[11px] font-bold text-slate-600 uppercase">Procurement Categories</div>
                        {(charts.category?.labels || []).map((cat, idx) => {
                            const val = charts.category?.data?.[idx] || 0;
                            return (
                                <div key={idx} className="flex items-center justify-between text-xs font-medium text-slate-700 p-2 bg-slate-50 rounded-lg">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: charts.category?.colors?.[idx] || '#3b82f6' }} />
                                        <span>{cat}</span>
                                    </div>
                                    <span className="font-extrabold text-slate-900">{val}</span>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Chart 3: Monthly Procurement Activity */}
                <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 space-y-4">
                    <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-emerald-600" />
                        <span>Monthly Activity Trends ({selectedYear})</span>
                    </div>

                    <div className="h-48 overflow-x-auto flex items-end gap-2 pt-4 px-2 border-b border-slate-200">
                        {(charts.monthly?.labels || []).map((month, idx) => {
                            const submitted = charts.monthly?.submitted?.[idx] || 0;
                            const monitored = charts.monthly?.monitored?.[idx] || 0;
                            const prGenerated = charts.monthly?.pr_generated?.[idx] || 0;
                            const maxVal = Math.max(...(charts.monthly?.submitted || [1]), 5);
                            const hSubmitted = Math.min(100, (submitted / maxVal) * 100);
                            const hMonitored = Math.min(100, (monitored / maxVal) * 100);
                            const hPr = Math.min(100, (prGenerated / maxVal) * 100);

                            return (
                                <div key={idx} className="flex-1 min-w-[20px] flex flex-col items-center gap-1">
                                    <div className="w-full flex items-end justify-center gap-0.5 h-36">
                                        <div className="w-1.5 bg-blue-500 rounded-t-xs" style={{ height: `${Math.max(4, hSubmitted)}%` }} title={`Submitted: ${submitted}`} />
                                        <div className="w-1.5 bg-amber-500 rounded-t-xs" style={{ height: `${Math.max(4, hMonitored)}%` }} title={`Monitored: ${monitored}`} />
                                        <div className="w-1.5 bg-emerald-500 rounded-t-xs" style={{ height: `${Math.max(4, hPr)}%` }} title={`PR: ${prGenerated}`} />
                                    </div>
                                    <span className="text-[9px] font-bold text-slate-500">{month}</span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="flex items-center justify-center gap-4 text-[10px] text-slate-600 font-semibold pt-1">
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-xs bg-blue-500" />
                            <span>PPMP Submissions</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-xs bg-amber-500" />
                            <span>PIMS Monitored</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-xs bg-emerald-500" />
                            <span>PR Generated</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Pending Actions Section */}
            {pendingActionsList.length > 0 && (
                <div className="bg-gradient-to-r from-rose-500/10 via-amber-500/5 to-white rounded-2xl shadow-xs border border-rose-200/80 p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <AlertCircle className="w-5 h-5 text-rose-600" />
                            <h2 className="text-sm font-bold text-slate-900 tracking-tight">
                                Pending Procurement Actions ({pendingActionsList.length})
                            </h2>
                        </div>
                        <span className="text-[11px] text-slate-500">Requires review or publication</span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {pendingActionsList.map((actionItem, idx) => (
                            <div key={idx} className="p-3.5 bg-white rounded-xl border border-slate-200/90 shadow-2xs flex flex-col justify-between gap-3">
                                <div>
                                    <div className="flex items-center justify-between gap-2 mb-1">
                                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                            {actionItem.badge}
                                        </span>
                                        <span className="text-[10px] text-slate-400 font-semibold">{actionItem.source}</span>
                                    </div>
                                    <div className="font-bold text-xs text-slate-900 line-clamp-1">{actionItem.title}</div>
                                    <div className="text-[11px] text-slate-500 mt-0.5">{actionItem.department} &bull; {actionItem.tracker_id}</div>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        if (actionItem.type === 'AWAITING_MONITORING') {
                                            setSelectedPpmpForMonitoring(actionItem.ppmp);
                                            setIsMonitoringModalOpen(true);
                                        } else if (actionItem.type === 'READY_FOR_PR') {
                                            setSelectedPpmpUuidForPr(actionItem.ppmp?.uuid);
                                            setSelectedMonitoringProjectIdForPr(actionItem.monitoring_project?.id);
                                            setIsGeneratePrModalOpen(true);
                                        } else if (actionItem.type === 'PR_IN_REVIEW') {
                                            setSelectedPrForReview(actionItem.pr);
                                            setIsPrReviewModalOpen(true);
                                        }
                                    }}
                                    className="w-full py-1.5 px-3 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs flex items-center justify-center gap-1.5 transition cursor-pointer"
                                >
                                    <span>{actionItem.action_label}</span>
                                    <ArrowUpRight className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Bottom Section: Recent Procurement Activities Table */}
            <div className="bg-white rounded-2xl shadow-xs border border-slate-200/80 p-5 space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <h2 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-2">
                            <span>Recent Procurement Activities & PR Transactions</span>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">
                                {filteredActivities.length}
                            </span>
                        </h2>
                        <p className="text-xs text-slate-500">
                            Transactions progressing through PIMS surveillance and Purchase Request review.
                        </p>
                    </div>

                    <div className="relative w-full sm:w-64">
                        <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                        <input
                            type="text"
                            placeholder="Search Tracker, Title, Office..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                    <table className="w-full text-left text-xs divide-y divide-slate-200">
                        <thead className="bg-slate-50 text-slate-600 font-bold text-[10px] uppercase">
                            <tr>
                                <th className="px-3.5 py-3">Reference / PR ID</th>
                                <th className="px-3.5 py-3">Procurement Title / Department</th>
                                <th className="px-3.5 py-3">Source</th>
                                <th className="px-3.5 py-3">Published Date</th>
                                <th className="px-3.5 py-3">Monitoring Status</th>
                                <th className="px-3.5 py-3">PR Review Status</th>
                                <th className="px-3.5 py-3">Total Cost</th>
                                <th className="px-3.5 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredActivities.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                                        No transactions match the selected filters.
                                    </td>
                                </tr>
                            ) : (
                                filteredActivities.map((act) => (
                                    <tr key={act.id} className="hover:bg-slate-50/70 transition">
                                        <td className="px-3.5 py-2.5 font-bold text-slate-800">
                                            {act.tracker_id}
                                        </td>
                                        <td className="px-3.5 py-2.5">
                                            <div className="font-semibold text-slate-900 line-clamp-1 max-w-xs">{act.title}</div>
                                            <div className="text-[11px] text-slate-500">{act.department}</div>
                                        </td>
                                        <td className="px-3.5 py-2.5">
                                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                                                {act.source}
                                            </span>
                                        </td>
                                        <td className="px-3.5 py-2.5 text-slate-600 whitespace-nowrap">
                                            {act.date_published}
                                        </td>
                                        <td className="px-3.5 py-2.5">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                act.monitoring_status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-800' : 'bg-blue-100 text-blue-800'
                                            }`}>
                                                {act.monitoring_status}
                                            </span>
                                        </td>
                                        <td className="px-3.5 py-2.5">
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                                act.pr_status === 'PR_APPROVED'
                                                    ? 'bg-emerald-100 text-emerald-800'
                                                    : act.pr_status === 'RETURNED'
                                                    ? 'bg-rose-100 text-rose-800'
                                                    : 'bg-purple-100 text-purple-800'
                                            }`}>
                                                {act.pr_status ? act.pr_status.replace(/_/g, ' ') : ''}
                                            </span>
                                        </td>
                                        <td className="px-3.5 py-2.5 font-bold text-slate-800 whitespace-nowrap">
                                            {formatCurrency(act.total_cost || 0)}
                                        </td>
                                        <td className="px-3.5 py-2.5 text-right whitespace-nowrap">
                                            <div className="flex items-center justify-end gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        const res = await pimsService.getPurchaseRequest(act.uuid || act.id);
                                                        setSelectedPrForView(res.data.purchase_request);
                                                        setIsPrDetailModalOpen(true);
                                                    }}
                                                    className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition cursor-pointer"
                                                >
                                                    <Eye className="w-3.5 h-3.5" />
                                                    <span>Details</span>
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={async () => {
                                                        const res = await pimsService.getPurchaseRequest(act.uuid || act.id);
                                                        setSelectedPrForPrint(res.data.purchase_request);
                                                    }}
                                                    className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                                                    title="Print Purchase Request"
                                                >
                                                    <Printer className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modals */}
            {/* 1. Monitoring Publish Modal */}
            <PimsPublishModal
                isOpen={isMonitoringModalOpen}
                onClose={() => {
                    setIsMonitoringModalOpen(false);
                    setSelectedPpmpForMonitoring(null);
                }}
                ppmp={selectedPpmpForMonitoring}
                onSuccess={(project) => {
                    loadDashboardData(true);
                    // Automatically transition to Generate PR popup as required by Step 4!
                    if (selectedPpmpForMonitoring?.uuid) {
                        setSelectedPpmpUuidForPr(selectedPpmpForMonitoring.uuid);
                        setSelectedMonitoringProjectIdForPr(project?.id);
                        setIsGeneratePrModalOpen(true);
                    }
                }}
            />

            {/* 2. Generate PR Modal */}
            <GeneratePurchaseRequestModal
                isOpen={isGeneratePrModalOpen}
                onClose={() => {
                    setIsGeneratePrModalOpen(false);
                    setSelectedPpmpUuidForPr(null);
                    setSelectedMonitoringProjectIdForPr(null);
                }}
                ppmpUuid={selectedPpmpUuidForPr}
                monitoringProjectId={selectedMonitoringProjectIdForPr}
                onSuccess={(pr) => {
                    loadDashboardData(true);
                    // Offer direct print preview
                    setSelectedPrForPrint(pr);
                }}
            />

            {/* 3. PR Detail Modal */}
            <PurchaseRequestDetailModal
                isOpen={isPrDetailModalOpen}
                onClose={() => {
                    setIsPrDetailModalOpen(false);
                    setSelectedPrForView(null);
                }}
                purchaseRequest={selectedPrForView}
                user={user}
                onPrint={(pr) => {
                    setIsPrDetailModalOpen(false);
                    setSelectedPrForPrint(pr);
                }}
                onReview={(pr) => {
                    setIsPrDetailModalOpen(false);
                    setSelectedPrForReview(pr);
                    setIsPrReviewModalOpen(true);
                }}
            />

            {/* 4. PR Review Modal */}
            <PurchaseRequestReviewModal
                isOpen={isPrReviewModalOpen}
                onClose={() => {
                    setIsPrReviewModalOpen(false);
                    setSelectedPrForReview(null);
                }}
                purchaseRequest={selectedPrForReview}
                onSuccess={(updatedPr) => {
                    loadDashboardData(true);
                }}
            />
            </main>
        </div>
    );
};

