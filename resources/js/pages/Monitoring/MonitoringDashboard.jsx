import React, { useState, useEffect, useMemo } from 'react';
import {
    Layers,
    Building2,
    Search,
    Filter,
    Plus,
    Clock,
    CheckCircle2,
    AlertTriangle,
    RotateCcw,
    Shield,
    Sparkles,
    Eye,
    ChevronRight,
    ChevronLeft,
    Banknote,
    FileText,
    User,
    Calendar,
    ArrowLeft,
    RefreshCw,
    TrendingUp,
    ExternalLink,
    Bell,
    Check
} from 'lucide-react';
import { monitoringService, ppmpService } from '../../services/api';
import { formatCurrency } from '../../components/UI/StatusBadge';
import { PimsPublishModal } from '../../components/Monitoring/PimsPublishModal';
import { MonitoringProjectDetailModal } from '../../components/Monitoring/MonitoringProjectDetailModal';

export const MonitoringDashboard = ({
    user,
    onBackToPpmpSystem,
    onLogout,
}) => {
    const [projects, setProjects] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);

    // Filters
    const [selectedCategory, setSelectedCategory] = useState('ALL'); // 'ALL' | 'GOODS_CONSULTING' | 'INFRA'
    const [selectedMode, setSelectedMode] = useState('ALL'); // 'ALL' | 'SVP' | 'CB'
    const [selectedDivision, setSelectedDivision] = useState('ALL'); // 'ALL' | 'pr_division' | 'technical_division' | 'bac_support_division' | 'contracting_division'
    const [searchQuery, setSearchQuery] = useState('');

    // Modals
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [selectedProjectForDetail, setSelectedProjectForDetail] = useState(null);
    const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

    // Pagination State (Default 9 cards per page)
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(9);
    const projectsGridRef = React.useRef(null);

    // Pending PIMS reminders
    const [pendingPpmps, setPendingPpmps] = useState([]);
    const [pimsSearchQuery, setPimsSearchQuery] = useState('');
    const [isPimsQueueOpen, setIsPimsQueueOpen] = useState(false);
    const [selectedPpmpForPublish, setSelectedPpmpForPublish] = useState(null);
    const [isPublishModalOpen, setIsPublishModalOpen] = useState(false);

    // Filter pending PPMPs by Tracker Number, title, or office unit
    const filteredPendingPpmps = useMemo(() => {
        if (!pimsSearchQuery.trim()) return pendingPpmps;
        const q = pimsSearchQuery.trim().toLowerCase();
        return pendingPpmps.filter((ppmp) => {
            const tracker = (ppmp.tracking_number || ppmp.ppmp_number || '').toLowerCase();
            const title = (ppmp.title || '').toLowerCase();
            const unit = (ppmp.office?.name || ppmp.implementing_unit || '').toLowerCase();
            return tracker.includes(q) || title.includes(q) || unit.includes(q);
        });
    }, [pendingPpmps, pimsSearchQuery]);

    // Inline PR ID editing on cards
    const [prIdInputs, setPrIdInputs] = useState({});
    const [savingPrId, setSavingPrId] = useState({});
    const [prIdErrors, setPrIdErrors] = useState({});
    const [editingPrIdFor, setEditingPrIdFor] = useState(null);

    const handleSavePrId = async (projId, e) => {
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }
        const val = (prIdInputs[projId] !== undefined ? prIdInputs[projId] : '').trim();
        if (!val) {
            setPrIdErrors((prev) => ({ ...prev, [projId]: 'Please input a PR ID' }));
            return;
        }

        setSavingPrId((prev) => ({ ...prev, [projId]: true }));
        setPrIdErrors((prev) => ({ ...prev, [projId]: null }));

        try {
            await monitoringService.updatePrId(projId, val);
            setProjects((prev) =>
                prev.map((p) => (p.id === projId ? { ...p, pims_pr_id: val } : p))
            );
            if (selectedProjectForDetail?.id === projId) {
                setSelectedProjectForDetail((prev) => ({ ...prev, pims_pr_id: val }));
            }
            setEditingPrIdFor(null);
        } catch (err) {
            console.error('Failed to update PIMS PR ID:', err);
            setPrIdErrors((prev) => ({
                ...prev,
                [projId]: err.response?.data?.message || 'Failed to save PR ID'
            }));
        } finally {
            setSavingPrId((prev) => ({ ...prev, [projId]: false }));
        }
    };

    const loadData = async (isSilent = false) => {
        if (!isSilent) setLoading(true);
        else setRefreshing(true);

        try {
            const [statsRes, projectsRes, pendingRes] = await Promise.all([
                monitoringService.getStats(),
                monitoringService.getProjects({
                    category: selectedCategory,
                    procurement_mode: selectedMode,
                    current_division: selectedDivision,
                }),
                monitoringService.getPendingPims(),
            ]);

            setStats(statsRes.data);
            setProjects(projectsRes.data.projects || []);
            setPendingPpmps(pendingRes.data.pending_ppmps || []);
        } catch (err) {
            console.error('Failed to load monitoring data', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        loadData();
    }, [selectedCategory, selectedMode, selectedDivision]);

    // Listen to updates from other tabs / modals
    useEffect(() => {
        const handleUpdate = () => loadData(true);
        window.addEventListener('monitoring:updated', handleUpdate);
        window.addEventListener('pims:published', handleUpdate);
        return () => {
            window.removeEventListener('monitoring:updated', handleUpdate);
            window.removeEventListener('pims:published', handleUpdate);
        };
    }, []);

    // Instant real-time fast search (0ms latency, zero delay)
    const filteredProjects = useMemo(() => {
        if (!searchQuery.trim()) return projects;
        const q = searchQuery.trim().toLowerCase();
        return projects.filter((p) => {
            const tracker = (p.pr_number || p.ppmp?.tracking_number || p.ppmp?.ppmp_number || '').toLowerCase();
            const title = (p.project_title || '').toLowerCase();
            const pimsPrId = (p.pims_pr_id || '').toLowerCase();
            const dept = (p.implementing_unit || p.office?.name || '').toLowerCase();
            const endUser = (p.end_user_name || '').toLowerCase();
            const mode = (p.procurement_mode || '').toLowerCase();
            const status = (p.ppmp?.status || p.status || '').toLowerCase();
            return (
                tracker.includes(q) ||
                title.includes(q) ||
                pimsPrId.includes(q) ||
                dept.includes(q) ||
                endUser.includes(q) ||
                mode.includes(q) ||
                status.includes(q)
            );
        });
    }, [projects, searchQuery]);

    // Reset to page 1 whenever filters or search query change
    useEffect(() => {
        setCurrentPage(1);
    }, [selectedCategory, selectedMode, selectedDivision, searchQuery]);

    // Pagination calculations based on instant filtered projects
    const totalEntries = filteredProjects.length;
    const totalPages = Math.max(1, Math.ceil(totalEntries / perPage));
    const startIndex = (currentPage - 1) * perPage;
    const endIndex = Math.min(startIndex + perPage, totalEntries);

    const paginatedProjects = useMemo(() => {
        return filteredProjects.slice(startIndex, endIndex);
    }, [filteredProjects, startIndex, endIndex]);

    const handlePageChange = (newPage) => {
        const page = Math.max(1, Math.min(newPage, totalPages));
        setCurrentPage(page);
        if (projectsGridRef.current) {
            projectsGridRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    };

    const handlePerPageChange = (newPerPage) => {
        setPerPage(newPerPage);
        setCurrentPage(1);
    };

    const getPages = (current, total) => {
        if (total <= 7) {
            return Array.from({ length: total }, (_, i) => i + 1);
        }
        if (current <= 4) {
            return [1, 2, 3, 4, 5, '...', total];
        }
        if (current >= total - 3) {
            return [1, '...', total - 4, total - 3, total - 2, total - 1, total];
        }
        return [1, '...', current - 1, current, current + 1, '...', total];
    };

    const openProjectDetails = (project) => {
        setSelectedProjectForDetail(project);
        setIsDetailModalOpen(true);
    };

    const handlePublishPimsDone = (ppmp) => {
        setSelectedPpmpForPublish(ppmp);
        setIsPublishModalOpen(true);
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-blue-600 selection:text-white">
            {/* Top Navigation Bar */}
            <header className="sticky top-0 z-40 bg-slate-900/90 backdrop-blur-md border-b border-slate-800/80 px-4 sm:px-6 py-3.5">
                <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
                    {/* Brand / Logo */}
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-blue-500/20 shrink-0">
                            <Layers className="w-5 h-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-sm sm:text-base font-extrabold tracking-tight text-white uppercase">
                                    OPPMO Monitoring System
                                </h1>
                                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-blue-500/20 text-blue-300 border border-blue-400/30">
                                    Official
                                </span>
                            </div>
                            <p className="text-[11px] text-slate-400 hidden sm:block">
                                Office of the Provincial Procurement Management Officer • Davao del Sur
                            </p>
                        </div>
                    </div>

                    {/* Navigation Actions */}
                    <div className="flex items-center gap-2.5">
                        <button
                            type="button"
                            onClick={() => loadData(true)}
                            disabled={refreshing}
                            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
                            title="Refresh Data"
                        >
                            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin text-blue-400' : ''}`} />
                        </button>

                        {/* User Badge */}
                        <div className="flex items-center gap-2 pl-2 border-l border-slate-800">
                            <div className="text-right hidden md:block">
                                <div className="text-xs font-bold text-white leading-tight">{user?.name}</div>
                                <div className="text-[10px] text-blue-400 font-semibold uppercase tracking-wider">
                                    {user?.role === 'monitor' ? 'OPPMO Monitor' : user?.designation || user?.role}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={onLogout}
                                className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-500/30 text-xs font-bold transition cursor-pointer"
                            >
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            {/* Main Content Area */}
            <main className="flex-1 max-w-7xl w-full mx-auto p-4 sm:p-6 space-y-6">
                {/* Hero / Welcome Banner */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 border border-blue-900/50 p-6 shadow-xl">
                    <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-radial from-blue-500/10 to-transparent pointer-events-none" />
                    <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
                        <div className="space-y-1.5">
                            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-bold">
                                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                                <span>OPPMO Office Process Tracking Dashboard</span>
                            </div>
                            <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                                Goods, Consulting Services & Infrastructure Monitoring
                            </h2>
                            <p className="text-xs sm:text-sm text-slate-300 max-w-2xl">
                                Real-time workflow governance across all OPPMO office divisions: PR Division, Technical Division (SVP & CB modes), BAC Support Division (Meeting, Opening & Decision), and Contracting Division.
                            </p>
                        </div>

                        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                            {/* PIMS Queue Button */}
                            <button
                                type="button"
                                onClick={() => setIsPimsQueueOpen(!isPimsQueueOpen)}
                                className="px-4 py-2.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-400/30 text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs"
                            >
                                <Bell className="w-4 h-4 text-amber-400" />
                                <span>PIMS Publish Reminders</span>
                                {pendingPpmps.length > 0 && (
                                    <span className="w-5 h-5 rounded-full bg-amber-500 text-slate-950 text-[10px] font-black flex items-center justify-center">
                                        {pendingPpmps.length}
                                    </span>
                                )}
                            </button>

                            {/* New Monitored Procurement */}
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(true)}
                                className="px-4.5 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold transition flex items-center gap-2 shadow-lg shadow-blue-500/20 cursor-pointer"
                            >
                                <Plus className="w-4 h-4" />
                                <span>+ New Procurement Project</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* KPI Metrics Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    {/* Total Projects */}
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            Total Monitored
                        </div>
                        <div className="text-xl sm:text-2xl font-extrabold text-white font-mono">
                            {stats?.total_projects || projects.length}
                        </div>
                        <div className="text-[11px] text-blue-400 font-semibold">
                            All Active & Completed
                        </div>
                    </div>

                    {/* Goods & Consulting */}
                    <div className="bg-slate-900/80 border border-blue-900/40 rounded-xl p-3.5 space-y-1">
                        <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1">
                            <Layers className="w-3 h-3" /> Goods / Consulting
                        </div>
                        <div className="text-xl sm:text-2xl font-extrabold text-blue-200 font-mono">
                            {stats?.goods_consulting_count || 0}
                        </div>
                        <div className="text-[11px] text-slate-400">Class 1 Procurements</div>
                    </div>

                    {/* INFRA */}
                    <div className="bg-slate-900/80 border border-amber-900/40 rounded-xl p-3.5 space-y-1">
                        <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                            <Building2 className="w-3 h-3" /> Infrastructure
                        </div>
                        <div className="text-xl sm:text-2xl font-extrabold text-amber-200 font-mono">
                            {stats?.infra_count || 0}
                        </div>
                        <div className="text-[11px] text-slate-400">Civil & Infra Works</div>
                    </div>

                    {/* PR Division */}
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            1. PR Division
                        </div>
                        <div className="text-xl sm:text-2xl font-extrabold text-white font-mono">
                            {stats?.pr_division_count || 0}
                        </div>
                        <div className="text-[11px] text-slate-400">Review & Compliance</div>
                    </div>

                    {/* Technical & BAC Support */}
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1">
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                            2 & 3. Tech / BAC
                        </div>
                        <div className="text-xl sm:text-2xl font-extrabold text-white font-mono">
                            {(stats?.tech_division_count || 0) + (stats?.bac_division_count || 0)}
                        </div>
                        <div className="text-[11px] text-slate-400">Canvass & Decision</div>
                    </div>

                    {/* Contracting & Completed */}
                    <div className="bg-slate-900/80 border border-slate-800 rounded-xl p-3.5 space-y-1">
                        <div className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">
                            4. Contracting / Awarded
                        </div>
                        <div className="text-xl sm:text-2xl font-extrabold text-emerald-300 font-mono">
                            {(stats?.contracting_division_count || 0) + (stats?.completed_count || 0)}
                        </div>
                        <div className="text-[11px] text-emerald-400 font-medium">Finalizing Contract</div>
                    </div>
                </div>

                {/* Optional PIMS Reminder Queue Drawer */}
                {isPimsQueueOpen && (
                    <div className="bg-slate-900 rounded-2xl border border-amber-500/30 p-5 shadow-xl space-y-3 animate-in fade-in duration-150">
                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 flex items-center justify-center font-bold shrink-0">
                                    <Bell className="w-4 h-4" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h3 className="text-sm font-bold text-white">
                                            PIMS Publishing Reminders from E-PROCUREMENT PPMP SYSTEM
                                        </h3>
                                        <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                            {filteredPendingPpmps.length} {filteredPendingPpmps.length === 1 ? 'item' : 'items'}
                                        </span>
                                    </div>
                                    <p className="text-xs text-slate-400">
                                        If the end-user forgot to click "Publish Done", the OPPMO Monitor can click below to record publication and start monitoring:
                                    </p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2.5 shrink-0">
                                {/* Search PPMP Tracker Number */}
                                <div className="relative min-w-[220px] sm:min-w-[280px]">
                                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                                    <input
                                        type="text"
                                        value={pimsSearchQuery}
                                        onChange={(e) => setPimsSearchQuery(e.target.value)}
                                        placeholder="Search PPMP Tracker No..."
                                        style={{ color: '#000000' }}
                                        className="w-full text-xs pl-8 pr-7 py-1.5 bg-white text-black font-semibold rounded-xl border border-amber-400/60 focus:border-amber-400 focus:ring-2 focus:ring-amber-500/30 focus:outline-none placeholder:text-slate-500 placeholder:font-normal shadow-xs"
                                    />
                                    {pimsSearchQuery && (
                                        <button
                                            type="button"
                                            onClick={() => setPimsSearchQuery('')}
                                            className="absolute right-2.5 top-1.5 text-slate-400 hover:text-black font-bold text-xs cursor-pointer"
                                            title="Clear search"
                                        >
                                            ✕
                                        </button>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsPimsQueueOpen(false);
                                        setPimsSearchQuery('');
                                    }}
                                    className="text-xs text-slate-400 hover:text-white px-2.5 py-1.5 rounded-xl border border-slate-800 hover:bg-slate-800 transition cursor-pointer"
                                >
                                    Close Queue
                                </button>
                            </div>
                        </div>

                        {pendingPpmps.length === 0 ? (
                            <div className="text-xs text-slate-400 py-4 text-center bg-slate-950/50 rounded-xl border border-slate-800">
                                All available PPMPs have already been recorded as published to PIMS.
                            </div>
                        ) : filteredPendingPpmps.length === 0 ? (
                            <div className="text-xs text-amber-200/90 py-6 text-center bg-slate-950/50 rounded-xl border border-amber-500/20 space-y-2">
                                <div>No pending PPMPs found matching tracker number "<strong className="text-white">{pimsSearchQuery}</strong>".</div>
                                <button
                                    type="button"
                                    onClick={() => setPimsSearchQuery('')}
                                    className="px-3 py-1 text-[11px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 font-bold rounded-lg border border-amber-400/30 cursor-pointer transition"
                                >
                                    Clear Tracker Search
                                </button>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-64 overflow-y-auto pr-1">
                                {filteredPendingPpmps.map((ppmp) => (
                                    <div
                                        key={ppmp.id}
                                        className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 hover:border-amber-500/40 transition space-y-2 flex flex-col justify-between"
                                    >
                                        <div>
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="text-[10px] font-mono font-bold text-amber-400 truncate">
                                                    {ppmp.tracking_number || ppmp.ppmp_number}
                                                </span>
                                                <span className="text-[10px] font-mono text-emerald-400 font-bold">
                                                    {formatCurrency(ppmp.total_budget)}
                                                </span>
                                            </div>
                                            <h4 className="text-xs font-bold text-slate-200 mt-1 line-clamp-2">
                                                {ppmp.title}
                                            </h4>
                                            <p className="text-[10px] text-slate-400 mt-0.5">
                                                Office: {ppmp.office?.name || ppmp.implementing_unit || 'Provincial Unit'}
                                            </p>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => handlePublishPimsDone(ppmp)}
                                            className="w-full mt-2 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                                        >
                                            <Check className="w-3.5 h-3.5" />
                                            <span>Monitor: Click "Publish Done"</span>
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Filter and Search Bar */}
                <div className="bg-slate-900/90 rounded-2xl border border-slate-800 p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                    {/* Category Tabs: Goods & Consulting vs INFRA */}
                    <div className="flex items-center gap-1 p-1 bg-slate-950 rounded-xl border border-slate-800 shrink-0">
                        <button
                            type="button"
                            onClick={() => setSelectedCategory('ALL')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                                selectedCategory === 'ALL'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            All Categories
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedCategory('GOODS_CONSULTING')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                selectedCategory === 'GOODS_CONSULTING'
                                    ? 'bg-blue-600 text-white shadow-xs'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Layers className="w-3.5 h-3.5" />
                            Goods & Consulting
                        </button>
                        <button
                            type="button"
                            onClick={() => setSelectedCategory('INFRA')}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                                selectedCategory === 'INFRA'
                                    ? 'bg-amber-600 text-white shadow-xs'
                                    : 'text-slate-400 hover:text-white'
                            }`}
                        >
                            <Building2 className="w-3.5 h-3.5" />
                            INFRA (Infrastructure)
                        </button>
                    </div>

                    {/* Mode & Division Selectors & Search */}
                    <div className="flex flex-wrap items-center gap-2.5 flex-1 justify-end">
                        {/* Mode Filter */}
                        <select
                            value={selectedMode}
                            onChange={(e) => setSelectedMode(e.target.value)}
                            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
                        >
                            <option value="ALL">All Modes of Procurement</option>
                            <option value="SVP">Small Value Procurement (SVP)</option>
                            <option value="CB">Competitive Bidding (CB)</option>
                            <option value="DIRECT_CONTRACTING">Direct Contracting</option>
                            <option value="NEGOTIATED">Negotiated Procurement</option>
                        </select>

                        {/* Division Filter */}
                        <select
                            value={selectedDivision}
                            onChange={(e) => setSelectedDivision(e.target.value)}
                            className="bg-slate-950 border border-slate-800 text-slate-300 text-xs font-semibold rounded-xl px-3 py-2 focus:outline-none focus:border-blue-500"
                        >
                            <option value="ALL">All OPPMO Divisions</option>
                            <option value="pr_division">1. PR Division</option>
                            <option value="technical_division">2. Technical Division</option>
                            <option value="bac_support_division">3. BAC Support Division</option>
                            <option value="contracting_division">4. Contracting Division</option>
                        </select>

                        {/* Search Input */}
                        <div className="relative min-w-[220px] flex-1 max-w-xs">
                            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5 pointer-events-none" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search PPMP Tracker No, title..."
                                style={{ color: '#000000' }}
                                className="w-full text-xs pl-9 pr-8 py-2 bg-white text-black font-semibold rounded-xl border border-slate-700 focus:border-blue-500 focus:outline-none placeholder:text-slate-500 shadow-xs"
                            />
                            {searchQuery && (
                                <button
                                    type="button"
                                    onClick={() => setSearchQuery('')}
                                    className="absolute right-2.5 top-2 text-slate-400 hover:text-black font-bold text-xs cursor-pointer"
                                    title="Clear search"
                                >
                                    ✕
                                </button>
                            )}
                        </div>
                    </div>
                </div>

                {/* Projects Grid / List */}
                {loading ? (
                    <div className="py-20 text-center space-y-3">
                        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
                        <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                            Loading OPPMO Monitoring Projects...
                        </div>
                    </div>
                ) : filteredProjects.length === 0 ? (
                    <div className="bg-slate-900 rounded-2xl border border-slate-800 p-12 text-center space-y-4">
                        <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-400/20 text-blue-400 flex items-center justify-center mx-auto">
                            {searchQuery ? <Search className="w-8 h-8 text-amber-400" /> : <Layers className="w-8 h-8" />}
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-base font-bold text-white">
                                {searchQuery ? 'No Matching Monitored Procurements' : 'No Monitored Procurements Found'}
                            </h3>
                            <p className="text-xs text-slate-400 max-w-md mx-auto">
                                {searchQuery ? (
                                    <>
                                        No procurement tracker found matching "<strong className="text-white">{searchQuery}</strong>". Please check the PPMP Tracker Number or project title.
                                    </>
                                ) : (
                                    'There are no procurement monitoring projects matching your filter. Start monitoring by registering a new project or recording a PIMS publication!'
                                )}
                            </p>
                        </div>
                        {searchQuery ? (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold transition inline-flex items-center gap-2 cursor-pointer shadow-md"
                            >
                                <span>Clear Search</span>
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setIsCreateModalOpen(true)}
                                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition inline-flex items-center gap-2 cursor-pointer shadow-md"
                            >
                                <Plus className="w-4 h-4" />
                                <span>Register New Monitored Procurement</span>
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <div ref={projectsGridRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {paginatedProjects.map((proj) => {
                                const steps = proj.steps || [];
                                const completedSteps = steps.filter((s) => s.status === 'COMPLETED' || s.status === 'APPROVED').length;
                                const progressPercent = steps.length ? Math.round((completedSteps / steps.length) * 100) : 0;

                                const isInfra = proj.category === 'INFRA';
                                const isCb = proj.procurement_mode === 'CB' || proj.procurement_mode?.toLowerCase().includes('competitive');

                                const divisionDisplayNames = {
                                    pr_division: 'PR Division',
                                    technical_division: 'Technical Division',
                                    bac_support_division: 'BAC Support Division',
                                    contracting_division: 'Contracting Division',
                                    completed: 'Completed / Awarded',
                                };

                                return (
                                    <div
                                        key={proj.id}
                                        onClick={() => openProjectDetails(proj)}
                                        className="bg-slate-900 rounded-2xl border border-slate-800 hover:border-blue-500/50 p-5 shadow-lg transition duration-200 flex flex-col justify-between cursor-pointer group hover:bg-slate-900/95"
                                    >
                                        <div className="space-y-3">
                                            {/* Top Badges */}
                                            <div className="flex items-center justify-between gap-2">
                                                <span
                                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold tracking-wider border ${
                                                        isInfra
                                                            ? 'bg-amber-400/10 text-amber-300 border-amber-400/30'
                                                            : 'bg-blue-400/10 text-blue-300 border-blue-400/30'
                                                    }`}
                                                >
                                                    {isInfra ? 'Infrastructure (INFRA)' : 'Goods & Consulting'}
                                                </span>

                                                <span
                                                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                                        isCb
                                                            ? 'bg-purple-500/10 text-purple-300 border-purple-400/30'
                                                            : 'bg-teal-500/10 text-teal-300 border-teal-400/30'
                                                    }`}
                                                >
                                                    Mode: {proj.procurement_mode}
                                                </span>
                                            </div>

                                            {/* Title / Description (What enduser procure is) */}
                                            <div>
                                                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-0.5">
                                                    What End-User Is Procuring:
                                                </div>
                                                <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors line-clamp-2">
                                                    {proj.project_title}
                                                </h3>
                                            </div>

                                            {/* Project Meta Information */}
                                            <div className="space-y-1.5 pt-1 text-xs text-slate-400">
                                                {proj.abc_amount && (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] text-slate-500 font-medium">ABC Budget:</span>
                                                        <span className="font-mono font-bold text-emerald-400">
                                                            {formatCurrency(proj.abc_amount)}
                                                        </span>
                                                    </div>
                                                )}
                                                {proj.pr_number && (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] text-slate-500 font-medium">PPMP / Tracker No:</span>
                                                        <span className="font-mono text-slate-300 font-semibold">{proj.pr_number}</span>
                                                    </div>
                                                )}

                                                {/* PIMS PR ID (From Provincial PIMS System) */}
                                                {proj.pims_pr_id && editingPrIdFor !== proj.id ? (
                                                    <div
                                                        className="flex items-center justify-between pt-0.5"
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <span className="text-[11px] text-slate-400 font-semibold flex items-center gap-1">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
                                                            PIMS PR ID:
                                                        </span>
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="font-mono font-bold text-xs text-emerald-300 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/30">
                                                                {proj.pims_pr_id}
                                                            </span>
                                                            <button
                                                                type="button"
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setEditingPrIdFor(proj.id);
                                                                    setPrIdInputs((prev) => ({ ...prev, [proj.id]: proj.pims_pr_id }));
                                                                }}
                                                                className="text-[10px] font-semibold text-blue-400 hover:text-blue-300 underline cursor-pointer"
                                                                title="Edit PR ID"
                                                            >
                                                                Edit
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div
                                                        className={`mt-1.5 p-2 rounded-xl transition-all ${
                                                            proj.pims_pr_id
                                                                ? 'bg-slate-800/80 border border-slate-700'
                                                                : 'bg-amber-500/10 border border-amber-500/40 shadow-sm'
                                                        }`}
                                                        onClick={(e) => e.stopPropagation()}
                                                    >
                                                        <div className="flex items-center justify-between mb-1">
                                                            <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                                                                <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                                                                <span>PIMS PR ID:</span>
                                                            </span>
                                                            <span className="text-[9px] uppercase font-extrabold text-amber-300 tracking-wider bg-amber-400/20 px-1.5 py-0.5 rounded border border-amber-400/30">
                                                                {proj.pims_pr_id ? 'Update ID' : 'Required from PIMS'}
                                                            </span>
                                                        </div>

                                                        <form
                                                            onSubmit={(e) => handleSavePrId(proj.id, e)}
                                                            className="flex items-center gap-1.5"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <input
                                                                type="text"
                                                                value={prIdInputs[proj.id] !== undefined ? prIdInputs[proj.id] : (proj.pims_pr_id || '')}
                                                                onChange={(e) => setPrIdInputs((prev) => ({ ...prev, [proj.id]: e.target.value }))}
                                                                placeholder="Input PR ID..."
                                                                style={{ color: '#000000' }}
                                                                className="flex-1 min-w-0 px-2 py-1 text-xs bg-white text-black font-bold rounded-lg border border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 placeholder:text-slate-400 placeholder:font-normal"
                                                            />
                                                            <button
                                                                type="submit"
                                                                disabled={savingPrId[proj.id] || !(prIdInputs[proj.id] !== undefined ? prIdInputs[proj.id] : (proj.pims_pr_id || '')).trim()}
                                                                className="px-2.5 py-1 text-xs bg-amber-400 hover:bg-amber-300 text-slate-950 font-extrabold rounded-lg shadow transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0 flex items-center gap-1 cursor-pointer"
                                                            >
                                                                {savingPrId[proj.id] ? (
                                                                    <span className="animate-pulse">Saving...</span>
                                                                ) : (
                                                                    <>
                                                                        <Check className="w-3.5 h-3.5" />
                                                                        <span>Save</span>
                                                                    </>
                                                                )}
                                                            </button>
                                                            {editingPrIdFor === proj.id && proj.pims_pr_id && (
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setEditingPrIdFor(null);
                                                                    }}
                                                                    className="px-1.5 py-1 text-xs text-slate-400 hover:text-white cursor-pointer"
                                                                    title="Cancel edit"
                                                                >
                                                                    ✕
                                                                </button>
                                                            )}
                                                        </form>
                                                        {prIdErrors[proj.id] && (
                                                            <p className="text-[10px] text-red-400 font-bold mt-1">{prIdErrors[proj.id]}</p>
                                                        )}
                                                    </div>
                                                )}
                                                {(proj.implementing_unit || proj.office?.name) && (
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] text-slate-500 font-medium">Department:</span>
                                                        <span className="text-slate-300 truncate max-w-[170px]">
                                                            {proj.implementing_unit || proj.office?.name}
                                                        </span>
                                                    </div>
                                                )}
                                                {proj.ppmp?.status && (
                                                    <div className="flex items-center justify-between pt-0.5">
                                                        <span className="text-[11px] text-slate-500 font-medium">PPMP Status:</span>
                                                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-300 border border-blue-400/20">
                                                            {proj.ppmp.status.replace(/_/g, ' ')}
                                                        </span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* 4 Division Visual Pipeline Stepper */}
                                            <div className="pt-2">
                                                <div className="flex items-center justify-between text-[10px] text-slate-400 font-bold mb-1.5">
                                                    <span>Current Stage:</span>
                                                    <span className="text-blue-400 uppercase">
                                                        {divisionDisplayNames[proj.current_division] || proj.current_division}
                                                    </span>
                                                </div>

                                                {/* Progress Bar */}
                                                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className="bg-gradient-to-r from-blue-500 to-emerald-400 h-full rounded-full transition-all duration-300"
                                                        style={{ width: `${progressPercent}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>

                                        {/* Card Footer */}
                                        <div className="pt-4 mt-3 border-t border-slate-800/80 flex items-center justify-between">
                                            <span className="text-[11px] font-mono text-slate-400">
                                                {completedSteps}/{steps.length} steps completed
                                            </span>

                                            <button
                                                type="button"
                                                className="px-3 py-1.5 rounded-lg bg-blue-600/20 group-hover:bg-blue-600 text-blue-300 group-hover:text-white text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                                            >
                                                <span>Open Workflow</span>
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Pagination & Entries Control Bar */}
                        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4 mt-6">
                            {/* Left: Entries Info & Per-Page Selector */}
                            <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                                <span>
                                    Showing <span className="font-bold text-white">{totalEntries === 0 ? 0 : startIndex + 1}</span> to{' '}
                                    <span className="font-bold text-white">{endIndex}</span> of{' '}
                                    <span className="font-bold text-blue-400">{totalEntries}</span> entries
                                </span>

                                <div className="flex items-center gap-2 pl-3 border-l border-slate-800">
                                    <span className="text-slate-400 font-medium">Show:</span>
                                    <select
                                        value={perPage}
                                        onChange={(e) => handlePerPageChange(Number(e.target.value))}
                                        className="py-1 px-2.5 rounded-xl border border-slate-700 bg-slate-950 text-slate-200 text-xs font-bold focus:outline-none focus:border-blue-500 cursor-pointer shadow-xs"
                                    >
                                        <option value={9}>9 entries</option>
                                        <option value={18}>18 entries</option>
                                        <option value={27}>27 entries</option>
                                        <option value={45}>45 entries</option>
                                    </select>
                                </div>
                            </div>

                            {/* Right: Page Navigation Buttons */}
                            {totalPages > 1 && (
                                <div className="flex items-center gap-1.5 flex-wrap justify-center">
                                    {/* First Button */}
                                    <button
                                        type="button"
                                        disabled={currentPage <= 1}
                                        onClick={() => handlePageChange(1)}
                                        className="px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs font-semibold cursor-pointer"
                                    >
                                        First
                                    </button>

                                    {/* Prev Button */}
                                    <button
                                        type="button"
                                        disabled={currentPage <= 1}
                                        onClick={() => handlePageChange(currentPage - 1)}
                                        className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                                        title="Previous Page"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>

                                    {/* Page Number Buttons */}
                                    {getPages(currentPage, totalPages).map((p, idx) =>
                                        p === '...' ? (
                                            <span key={`ellipsis-${idx}`} className="px-1.5 text-slate-600 font-black">
                                                ...
                                            </span>
                                        ) : (
                                            <button
                                                key={`page-${p}`}
                                                type="button"
                                                onClick={() => handlePageChange(p)}
                                                className={`min-w-[32px] h-8 px-2 rounded-lg text-xs font-bold transition cursor-pointer ${
                                                    currentPage === p
                                                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-md shadow-blue-500/25 border border-blue-500/50'
                                                        : 'border border-slate-800 bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-800'
                                                }`}
                                            >
                                                {p}
                                            </button>
                                        )
                                    )}

                                    {/* Next Button */}
                                    <button
                                        type="button"
                                        disabled={currentPage >= totalPages}
                                        onClick={() => handlePageChange(currentPage + 1)}
                                        className="p-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition cursor-pointer"
                                        title="Next Page"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>

                                    {/* Last Button */}
                                    <button
                                        type="button"
                                        disabled={currentPage >= totalPages}
                                        onClick={() => handlePageChange(totalPages)}
                                        className="px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-400 hover:text-white hover:bg-slate-800 disabled:opacity-30 disabled:cursor-not-allowed transition text-xs font-semibold cursor-pointer"
                                    >
                                        Last
                                    </button>
                                </div>
                            )}
                        </div>
                    </>
                )}
            </main>

            {/* Project Details Modal with all 4 divisions & timeline */}
            {selectedProjectForDetail && (
                <MonitoringProjectDetailModal
                    isOpen={isDetailModalOpen}
                    onClose={() => {
                        setIsDetailModalOpen(false);
                        setSelectedProjectForDetail(null);
                    }}
                    projectId={selectedProjectForDetail.id}
                    onProjectUpdated={() => loadData(true)}
                />
            )}

            {/* Direct Create / Register Procurement Project Modal */}
            <PimsPublishModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                ppmp={null}
                onSuccess={() => loadData(true)}
            />

            {/* PIMS Queue Publish Modal */}
            <PimsPublishModal
                isOpen={isPublishModalOpen}
                onClose={() => {
                    setIsPublishModalOpen(false);
                    setSelectedPpmpForPublish(null);
                }}
                ppmp={selectedPpmpForPublish}
                onSuccess={() => loadData(true)}
            />
        </div>
    );
};
