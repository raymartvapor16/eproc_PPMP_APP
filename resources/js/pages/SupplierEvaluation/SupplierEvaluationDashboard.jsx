import React, { useState, useEffect, useCallback } from 'react';
import {
    Shield,
    Search,
    Filter,
    Plus,
    Layers,
    FileText,
    CheckCircle2,
    Clock,
    AlertTriangle,
    Trash2,
    Edit3,
    Eye,
    Printer,
    BarChart3,
    Upload,
    History,
    Package,
    LogOut,
    Globe,
    ArrowLeft,
    Loader2,
    Calculator,
    TrendingUp,
    Calendar,
    Award,
    Building2,
    RefreshCw,
    X,
    ExternalLink,
    ChevronDown,
    Sparkles,
} from 'lucide-react';
import { supplierEvaluationService } from '../../services/api';
import {
    EvaluationFormPrintModal,
    AnalyticsReportPrintModal,
    CRITERIA_WEIGHT_MAP,
    CRITERIA_LABELS,
} from './SupplierEvaluationPrintTemplates';
import {
    EvaluateOrViewModal,
    AddEvaluationModal,
    PurchaseOrdersModal,
    RequestsModal,
    ImportAndAuthorizeModal,
    RecycleBinModal,
    ActivityLogsModal,
} from './SupplierEvaluationModals';
import { PaginationControl } from '../../components/UI/PaginationControl';

const ROLE_BADGES = {
    administrator: { label: 'System Administrator', bg: 'bg-rose-500/20 text-rose-200 border-rose-400/40' },
    pgso: { label: 'PGSO Evaluator', bg: 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40' },
    head: { label: 'Office Head', bg: 'bg-purple-500/20 text-purple-200 border-purple-400/40' },
    presentative_staff: { label: 'Representative Staff', bg: 'bg-blue-500/20 text-blue-200 border-blue-400/40' },
    end_user: { label: 'End-User Evaluator', bg: 'bg-amber-500/20 text-amber-200 border-amber-400/40' },
};

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function SupplierEvaluationDashboard({
    user,
    onNavigateToPortal,
    onBackToPpmpSystem,
    onLogout,
}) {
    const [initData, setInitData] = useState(null);
    const [effectiveRole, setEffectiveRole] = useState('end_user');
    const [counts, setCounts] = useState({
        pending: 0,
        review: 0,
        approved: 0,
        deleted: 0,
        requests_pending: 0,
        po_total: 0,
        pdfs_pending: 0,
    });

    // Main workspace view: 'evaluations' | 'bulk' | 'analytics'
    const [workspaceView, setWorkspaceView] = useState('evaluations');

    // Evaluations table status tab: 'pending' | 'head review' | 'submitted'
    const [statusTab, setStatusTab] = useState('pending');
    const [evaluations, setEvaluations] = useState([]);
    const [loadingEvals, setLoadingEvals] = useState(true);

    // Evaluations table pagination (10 rows per page default)
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Search & Filters
    const [search, setSearch] = useState('');
    const [filterOpen, setFilterOpen] = useState(false);
    const [deptFilter, setDeptFilter] = useState('all');
    const [yearFilter, setYearFilter] = useState('all');
    const [minScore, setMinScore] = useState('');
    const [maxScore, setMaxScore] = useState('');
    const [openActionDropdownId, setOpenActionDropdownId] = useState(null);

    // Active Modals
    const [activeEvalModal, setActiveEvalModal] = useState(null); // { evaluation, mode: 'view'|'evaluate'|'edit' }
    const [printEval, setPrintEval] = useState(null);
    const [printReport, setPrintReport] = useState(null); // 'summary' | 'semester' | 'missing_pdf'
    const [showAddModal, setShowAddModal] = useState(false);
    const [showPoModal, setShowPoModal] = useState(false);
    const [showRequestsModal, setShowRequestsModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [showRecycleModal, setShowRecycleModal] = useState(false);
    const [showLogsModal, setShowLogsModal] = useState(false);
    const [calculateModalGroup, setCalculateModalGroup] = useState(null);

    // Bulk Evaluation Workspace state
    const [bulkSuppliers, setBulkSuppliers] = useState([]);
    const [selectedBulkSupplier, setSelectedBulkSupplier] = useState('');
    const [bulkEvaluations, setBulkEvaluations] = useState([]);
    const [bulkForms, setBulkForms] = useState({});
    const [loadingBulk, setLoadingBulk] = useState(false);
    const [submittingBulk, setSubmittingBulk] = useState(false);

    // Analytics state
    const [analyticsSubTab, setAnalyticsSubTab] = useState('summary'); // 'summary' | 'semester' | 'charts' | 'missing_pdf'
    const [analyticsData, setAnalyticsData] = useState({
        summary: [],
        semester_data: [],
        monthly_counts: Array(12).fill(0),
        supplier_scores: [],
        missing_pdf_pos: [],
    });
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);
    const [analyticsDept, setAnalyticsDept] = useState('all');
    const [analyticsYear, setAnalyticsYear] = useState('all');
    const [analyticsSupplier, setAnalyticsSupplier] = useState('all');
    const [missingPdfSearch, setMissingPdfSearch] = useState('');

    const loadInit = useCallback(async () => {
        try {
            const res = await supplierEvaluationService.getInit();
            const d = res.data;
            setInitData(d);
            setEffectiveRole(d.effective_role || 'end_user');
            setCounts(d.counts || {});

            // Set sensible default tab for Office Head
            if (d.effective_role === 'head' && d.counts?.review > 0) {
                setStatusTab((prev) => (prev === 'pending' ? 'head review' : prev));
            }
        } catch (err) {
            console.error('Failed to initialize Supplier Evaluation dashboard:', err);
        }
    }, []);

    const loadEvaluations = useCallback(async () => {
        setLoadingEvals(true);
        try {
            const res = await supplierEvaluationService.getEvaluations({
                status: statusTab,
                search,
                department: deptFilter,
                year: yearFilter,
                min_score: minScore,
                max_score: maxScore,
            });
            setEvaluations(res.data.data || []);
        } catch (err) {
            console.error('Failed to load evaluations:', err);
        } finally {
            setLoadingEvals(false);
        }
    }, [statusTab, search, deptFilter, yearFilter, minScore, maxScore]);

    useEffect(() => {
        loadInit();
    }, [loadInit]);

    // Close action dropdown when clicking outside or pressing Escape
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (!e.target.closest('[data-action-dropdown]')) {
                setOpenActionDropdownId(null);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setOpenActionDropdownId(null);
            }
        };
        document.addEventListener('click', handleClickOutside);
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('click', handleClickOutside);
            document.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    useEffect(() => {
        const t = setTimeout(() => {
            if (workspaceView === 'evaluations') {
                loadEvaluations();
            }
        }, 180);
        return () => clearTimeout(t);
    }, [workspaceView, loadEvaluations]);

    // Reset pagination to first page whenever tab, search, or filters change
    useEffect(() => {
        setCurrentPage(1);
    }, [statusTab, search, deptFilter, yearFilter, minScore, maxScore]);

    const refreshAll = () => {
        loadInit();
        loadEvaluations();
        if (workspaceView === 'analytics') {
            loadAnalyticsData();
        }
        if (workspaceView === 'bulk') {
            loadBulkWorkspaceSuppliers();
        }
    };

    // Bulk Evaluation Workspace loaders
    const loadBulkWorkspaceSuppliers = async () => {
        setLoadingBulk(true);
        try {
            const res = await supplierEvaluationService.getBulkSuppliers();
            const supps = res.data.suppliers || [];
            setBulkSuppliers(supps);
            if (supps.length > 0 && !selectedBulkSupplier) {
                setSelectedBulkSupplier(supps[0].supplier_name);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingBulk(false);
        }
    };

    const loadBulkEvaluationsForSupplier = async (supplierName) => {
        if (!supplierName) {
            setBulkEvaluations([]);
            return;
        }
        setLoadingBulk(true);
        try {
            const res = await supplierEvaluationService.fetchBulkEvaluations({ supplier_name: supplierName });
            const evals = res.data.evaluations || [];
            setBulkEvaluations(evals);
            const initialForms = {};
            evals.forEach((ev) => {
                initialForms[ev.id] = {
                    selected: true,
                    ratings: {
                        1: ev.scores?.[1] ? String(ev.scores[1]) : '4',
                        2: ev.scores?.[2] ? String(ev.scores[2]) : '4',
                        3: ev.scores?.[3] ? String(ev.scores[3]) : '4',
                        4: ev.scores?.[4] ? String(ev.scores[4]) : '4',
                    },
                    remarks: {
                        1: ev.remarks?.[1] || '',
                        2: ev.remarks?.[2] || '',
                        3: ev.remarks?.[3] || '',
                        4: ev.remarks?.[4] || '',
                    },
                };
            });
            setBulkForms(initialForms);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingBulk(false);
        }
    };

    useEffect(() => {
        if (workspaceView === 'bulk') {
            loadBulkWorkspaceSuppliers();
        }
    }, [workspaceView]);

    useEffect(() => {
        if (workspaceView === 'bulk' && selectedBulkSupplier) {
            loadBulkEvaluationsForSupplier(selectedBulkSupplier);
        }
    }, [workspaceView, selectedBulkSupplier]);

    const handleApplyQuickRatingToAllBulk = (ratingVal) => {
        setBulkForms((prev) => {
            const next = { ...prev };
            Object.keys(next).forEach((id) => {
                next[id] = {
                    ...next[id],
                    ratings: { 1: String(ratingVal), 2: String(ratingVal), 3: String(ratingVal), 4: String(ratingVal) },
                };
            });
            return next;
        });
    };

    const handleSubmitBulkWorkspace = async () => {
        const selectedItems = bulkEvaluations
            .filter((ev) => bulkForms[ev.id]?.selected)
            .map((ev) => ({
                id: ev.id,
                ratings: bulkForms[ev.id].ratings,
                remarks: bulkForms[ev.id].remarks,
            }));

        if (selectedItems.length === 0) {
            alert('Please select at least one Purchase Order evaluation to submit.');
            return;
        }

        setSubmittingBulk(true);
        try {
            await supplierEvaluationService.submitBulkEvaluations({ evaluations: selectedItems });
            await loadInit();
            await loadBulkWorkspaceSuppliers();
            if (selectedBulkSupplier) {
                await loadBulkEvaluationsForSupplier(selectedBulkSupplier);
            }
            setWorkspaceView('evaluations');
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to submit bulk evaluations.');
        } finally {
            setSubmittingBulk(false);
        }
    };

    // Analytics loader
    const loadAnalyticsData = useCallback(async () => {
        setLoadingAnalytics(true);
        try {
            const res = await supplierEvaluationService.getAnalytics({
                department: analyticsDept,
                year: analyticsYear,
                supplier: analyticsSupplier,
                missing_pdf_search: missingPdfSearch,
            });
            setAnalyticsData(res.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingAnalytics(false);
        }
    }, [analyticsDept, analyticsYear, analyticsSupplier, missingPdfSearch]);

    useEffect(() => {
        if (workspaceView === 'analytics') {
            const t = setTimeout(() => loadAnalyticsData(), 150);
            return () => clearTimeout(t);
        }
    }, [workspaceView, loadAnalyticsData]);

    const handleOpenEvaluationModal = async (evalRow, mode = 'view') => {
        try {
            const res = await supplierEvaluationService.getEvaluation(evalRow.id);
            setActiveEvalModal({
                evaluation: res.data.evaluation,
                mode,
            });
        } catch (err) {
            setActiveEvalModal({
                evaluation: evalRow,
                mode,
            });
        }
    };

    const handleOpenPrintEvaluation = async (evalRow) => {
        try {
            const res = await supplierEvaluationService.getEvaluation(evalRow.id);
            setPrintEval(res.data.evaluation);
        } catch (_) {
            setPrintEval(evalRow);
        }
    };

    const handleSoftDeleteEvaluation = async (evalRow) => {
        if (!window.confirm(`Move evaluation for P.O. ${evalRow.po_no} (${evalRow.supplier_name}) to the Recycle Bin?`)) {
            return;
        }
        try {
            await supplierEvaluationService.deleteEvaluation(evalRow.id);
            refreshAll();
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to delete evaluation.');
        }
    };

    const isAdminOrPgso = effectiveRole === 'administrator' || effectiveRole === 'pgso';
    const roleBadge = ROLE_BADGES[effectiveRole] || ROLE_BADGES.end_user;

    const getScoreBadgeClass = (score) => {
        if (score >= 90) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
        if (score >= 75) return 'bg-blue-100 text-blue-800 border-blue-300';
        if (score >= 60) return 'bg-amber-100 text-amber-800 border-amber-300';
        return 'bg-rose-100 text-rose-800 border-rose-300';
    };

    return (
        <div className="min-h-screen bg-slate-100 text-slate-800 flex flex-col font-sans">
            {/* ─────────────────────────────────────────────────────────────
                1. TOP BRAND & ROLE HEADER BAR
            ───────────────────────────────────────────────────────────── */}
            <header className={`bg-gradient-to-r from-slate-900 via-slate-900 to-orange-950 text-white border-b border-orange-500/30 shadow-md sticky top-0 z-30 ${printEval || printReport ? 'no-print' : ''}`}>
                <div className="max-w-[1600px] mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
                    {/* Left Brand */}
                    <div className="flex items-center gap-3">
                        <img
                            src="/images/logo.png"
                            alt="Province Seal"
                            className="w-10 h-10 object-contain"
                            onError={(e) => {
                                e.target.style.display = 'none';
                            }}
                        />
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm sm:text-base font-black tracking-tight text-white">
                                    SUPPLIER EVALUATION SYSTEM
                                </span>
                                <span
                                    className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border ${roleBadge.bg}`}
                                >
                                    {roleBadge.label}
                                </span>
                            </div>
                            <div className="text-[11px] text-slate-300">
                                Province of Davao del Sur •{' '}
                                <span className="text-orange-300 font-semibold">
                                    {user?.office?.name || 'Provincial Government Office'}
                                </span>
                            </div>
                        </div>
                    </div>

                    {/* Right Navigation & User Controls */}
                    <div className="flex flex-wrap items-center gap-2">
                        {onBackToPpmpSystem && (
                            <button
                                type="button"
                                onClick={onBackToPpmpSystem}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
                            >
                                <ArrowLeft className="w-3.5 h-3.5 text-blue-400" />
                                <span>PPMP System</span>
                            </button>
                        )}
                        {onNavigateToPortal && (
                            <button
                                type="button"
                                onClick={onNavigateToPortal}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
                            >
                                <Globe className="w-3.5 h-3.5 text-amber-400" />
                                <span>Portal Home</span>
                            </button>
                        )}
                        <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-xl bg-slate-800/90 border border-slate-700 text-xs">
                            <div className="w-6 h-6 rounded-full bg-orange-500 text-white font-black flex items-center justify-center text-[11px]">
                                {(user?.name || 'U').charAt(0).toUpperCase()}
                            </div>
                            <div className="leading-tight">
                                <div className="font-bold text-white text-[11px]">{user?.name}</div>
                                <div className="text-[10px] text-slate-400">{user?.designation || user?.role}</div>
                            </div>
                        </div>
                        {onLogout && (
                            <button
                                type="button"
                                onClick={onLogout}
                                className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                            >
                                <LogOut className="w-3.5 h-3.5" />
                                <span>Sign Out</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Role-Based Module Bar */}
                <div className="bg-slate-950/70 border-t border-slate-800 px-4 sm:px-6 py-2">
                    <div className="max-w-[1600px] mx-auto flex flex-wrap items-center justify-between gap-2">
                        {/* Primary Workspace Switcher */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            <button
                                type="button"
                                onClick={() => setWorkspaceView('evaluations')}
                                className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                                    workspaceView === 'evaluations'
                                        ? 'bg-orange-500 text-white shadow-xs'
                                        : 'text-slate-300 hover:bg-slate-800'
                                }`}
                            >
                                <Shield className="w-3.5 h-3.5" />
                                <span>Evaluations Table</span>
                            </button>

                            {effectiveRole !== 'pgso' && (
                                <button
                                    type="button"
                                    onClick={() => setWorkspaceView('bulk')}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                                        workspaceView === 'bulk'
                                            ? 'bg-orange-500 text-white shadow-xs'
                                            : 'text-slate-300 hover:bg-slate-800'
                                    }`}
                                >
                                    <Layers className="w-3.5 h-3.5" />
                                    <span>
                                        {effectiveRole === 'head' || effectiveRole === 'presentative_staff'
                                            ? 'Bulk Approve Evaluations'
                                            : 'Bulk Evaluate'}
                                    </span>
                                </button>
                            )}

                            {isAdminOrPgso && (
                                <button
                                    type="button"
                                    onClick={() => setWorkspaceView('analytics')}
                                    className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                                        workspaceView === 'analytics'
                                            ? 'bg-orange-500 text-white shadow-xs'
                                            : 'text-slate-300 hover:bg-slate-800'
                                    }`}
                                >
                                    <BarChart3 className="w-3.5 h-3.5" />
                                    <span>Analytics & Reports</span>
                                </button>
                            )}
                        </div>

                        {/* Secondary Action Modals by Role */}
                        <div className="flex flex-wrap items-center gap-1.5">
                            {isAdminOrPgso && (
                                <button
                                    type="button"
                                    onClick={() => setShowAddModal(true)}
                                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1 transition cursor-pointer shadow-2xs"
                                >
                                    <Plus className="w-3.5 h-3.5" />
                                    <span>+ Evaluation</span>
                                </button>
                            )}

                            <button
                                type="button"
                                onClick={() => setShowPoModal(true)}
                                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
                            >
                                <Package className="w-3.5 h-3.5 text-orange-400" />
                                <span>P.O. List</span>
                                <span className="px-1.5 py-0.2 rounded-full bg-orange-500/20 text-orange-300 text-[10px]">
                                    {counts.po_total || 0}
                                </span>
                            </button>

                            {effectiveRole !== 'head' && (
                                <button
                                    type="button"
                                    onClick={() => setShowRequestsModal(true)}
                                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
                                >
                                    <FileText className="w-3.5 h-3.5 text-blue-400" />
                                    <span>Requests</span>
                                    {counts.requests_pending > 0 && (
                                        <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-black">
                                            {counts.requests_pending}
                                        </span>
                                    )}
                                </button>
                            )}

                            {(isAdminOrPgso ||
                                effectiveRole === 'end_user' ||
                                effectiveRole === 'presentative_staff') && (
                                <button
                                    type="button"
                                    onClick={() => setShowImportModal(true)}
                                    className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
                                >
                                    <Upload className="w-3.5 h-3.5 text-emerald-400" />
                                    <span>{isAdminOrPgso ? 'Import / Authorize PDF' : 'Authorize PDF'}</span>
                                </button>
                            )}

                            {isAdminOrPgso && (
                                <>
                                    <button
                                        type="button"
                                        onClick={() => setShowRecycleModal(true)}
                                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
                                    >
                                        <Trash2 className="w-3.5 h-3.5 text-rose-400" />
                                        <span>Recycle Bin</span>
                                        {counts.deleted > 0 && (
                                            <span className="px-1.5 py-0.2 rounded-full bg-rose-500/30 text-rose-300 text-[10px]">
                                                {counts.deleted}
                                            </span>
                                        )}
                                    </button>

                                    <button
                                        type="button"
                                        onClick={() => setShowLogsModal(true)}
                                        className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer border border-slate-700"
                                    >
                                        <History className="w-3.5 h-3.5 text-amber-400" />
                                        <span>Activity Logs</span>
                                    </button>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {/* ─────────────────────────────────────────────────────────────
                2. MAIN CONTENT CONTAINER
            ───────────────────────────────────────────────────────────── */}
            <main className={`flex-1 max-w-[1600px] w-full mx-auto px-4 sm:px-6 py-6 space-y-6 ${printEval || printReport ? 'no-print' : ''}`}>
                {/* =========================================================
                    WORKSPACE 1: EVALUATIONS TABLE (Pending / Head Review / Approved)
                ========================================================= */}
                {workspaceView === 'evaluations' && (
                    <>
                        {/* 3 Status KPI / Tab Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <button
                                type="button"
                                onClick={() => setStatusTab('pending')}
                                className={`text-left p-5 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                                    statusTab === 'pending'
                                        ? 'bg-gradient-to-br from-amber-500 to-orange-600 text-white border-orange-600 shadow-lg shadow-orange-500/20'
                                        : 'bg-white border-slate-200 hover:border-orange-300 text-slate-800'
                                }`}
                            >
                                <div>
                                    <div
                                        className={`text-xs font-bold uppercase tracking-wider ${
                                            statusTab === 'pending' ? 'text-orange-100' : 'text-slate-500'
                                        }`}
                                    >
                                        1. Pending Evaluation
                                    </div>
                                    <div className="text-3xl font-black mt-1">{counts.pending || 0}</div>
                                    <div
                                        className={`text-[11px] mt-1 ${
                                            statusTab === 'pending' ? 'text-orange-100' : 'text-slate-400'
                                        }`}
                                    >
                                        Awaiting End-User Criteria Rating
                                    </div>
                                </div>
                                <div
                                    className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                                        statusTab === 'pending' ? 'bg-white/20 text-white' : 'bg-amber-100 text-amber-600'
                                    }`}
                                >
                                    <Clock className="w-6 h-6" />
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setStatusTab('head review')}
                                className={`text-left p-5 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                                    statusTab === 'head review'
                                        ? 'bg-gradient-to-br from-blue-600 to-indigo-700 text-white border-blue-700 shadow-lg shadow-blue-500/20'
                                        : 'bg-white border-slate-200 hover:border-blue-300 text-slate-800'
                                }`}
                            >
                                <div>
                                    <div
                                        className={`text-xs font-bold uppercase tracking-wider ${
                                            statusTab === 'head review' ? 'text-blue-100' : 'text-slate-500'
                                        }`}
                                    >
                                        2. Head Review
                                    </div>
                                    <div className="text-3xl font-black mt-1">{counts.review || 0}</div>
                                    <div
                                        className={`text-[11px] mt-1 ${
                                            statusTab === 'head review' ? 'text-blue-100' : 'text-slate-400'
                                        }`}
                                    >
                                        Awaiting Office Head / Representative Signature
                                    </div>
                                </div>
                                <div
                                    className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                                        statusTab === 'head review' ? 'bg-white/20 text-white' : 'bg-blue-100 text-blue-600'
                                    }`}
                                >
                                    <Shield className="w-6 h-6" />
                                </div>
                            </button>

                            <button
                                type="button"
                                onClick={() => setStatusTab('submitted')}
                                className={`text-left p-5 rounded-2xl border transition cursor-pointer flex items-center justify-between ${
                                    statusTab === 'submitted'
                                        ? 'bg-gradient-to-br from-emerald-600 to-teal-700 text-white border-emerald-700 shadow-lg shadow-emerald-500/20'
                                        : 'bg-white border-slate-200 hover:border-emerald-300 text-slate-800'
                                }`}
                            >
                                <div>
                                    <div
                                        className={`text-xs font-bold uppercase tracking-wider ${
                                            statusTab === 'submitted' ? 'text-emerald-100' : 'text-slate-500'
                                        }`}
                                    >
                                        3. Approved / Submitted
                                    </div>
                                    <div className="text-3xl font-black mt-1">{counts.approved || 0}</div>
                                    <div
                                        className={`text-[11px] mt-1 ${
                                            statusTab === 'submitted' ? 'text-emerald-100' : 'text-slate-400'
                                        }`}
                                    >
                                        Digitally Signed & Ready for Print/PDF
                                    </div>
                                </div>
                                <div
                                    className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                                        statusTab === 'submitted'
                                            ? 'bg-white/20 text-white'
                                            : 'bg-emerald-100 text-emerald-600'
                                    }`}
                                >
                                    <CheckCircle2 className="w-6 h-6" />
                                </div>
                            </button>
                        </div>

                        {/* Search & Filter Card */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div className="relative flex-1 min-w-[260px]">
                                    <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                                    <input
                                        type="text"
                                        value={search}
                                        onChange={(e) => setSearch(e.target.value)}
                                        placeholder="Search by P.O. No., Supplier Name, Office, or Covered Period..."
                                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-300 text-xs outline-none focus:border-orange-500"
                                    />
                                </div>

                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setFilterOpen(!filterOpen)}
                                        className={`px-4 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                                            filterOpen || deptFilter !== 'all' || yearFilter !== 'all' || minScore || maxScore
                                                ? 'border-orange-500 bg-orange-50 text-orange-700'
                                                : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                                        }`}
                                    >
                                        <Filter className="w-4 h-4" />
                                        <span>Filter Evaluations</span>
                                    </button>

                                    <button
                                        type="button"
                                        onClick={refreshAll}
                                        className="p-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-600 cursor-pointer"
                                        title="Refresh Table"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            {/* Collapsible Filter Drawer */}
                            {filterOpen && (
                                <div className="mt-4 pt-4 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
                                    {isAdminOrPgso && (
                                        <div>
                                            <label className="block font-bold text-slate-600 mb-1">Department / Office</label>
                                            <select
                                                value={deptFilter}
                                                onChange={(e) => setDeptFilter(e.target.value)}
                                                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                            >
                                                <option value="all">All Departments</option>
                                                {(initData?.offices || []).map((o) => (
                                                    <option key={o.id} value={o.name}>
                                                        {o.code ? `${o.code} — ${o.name}` : o.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}
                                    <div>
                                        <label className="block font-bold text-slate-600 mb-1">Covered Year</label>
                                        <select
                                            value={yearFilter}
                                            onChange={(e) => setYearFilter(e.target.value)}
                                            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                        >
                                            <option value="all">All Years</option>
                                            {(initData?.years || [2026]).map((y) => (
                                                <option key={y} value={y}>
                                                    CY {y}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block font-bold text-slate-600 mb-1">Min Score (%)</label>
                                        <input
                                            type="number"
                                            min="0"
                                            max="100"
                                            value={minScore}
                                            onChange={(e) => setMinScore(e.target.value)}
                                            placeholder="0"
                                            className="w-full rounded-xl border border-slate-300 px-3 py-2"
                                        />
                                    </div>
                                    <div>
                                        <label className="block font-bold text-slate-600 mb-1">Max Score (%)</label>
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="number"
                                                min="0"
                                                max="100"
                                                value={maxScore}
                                                onChange={(e) => setMaxScore(e.target.value)}
                                                placeholder="100"
                                                className="w-full rounded-xl border border-slate-300 px-3 py-2"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setDeptFilter('all');
                                                    setYearFilter('all');
                                                    setMinScore('');
                                                    setMaxScore('');
                                                }}
                                                className="px-3 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold cursor-pointer"
                                            >
                                                Reset
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Evaluations Data Table */}
                        {(() => {
                            const totalEvaluationPages = Math.ceil(evaluations.length / pageSize) || 1;
                            const validCurrentPage = Math.min(currentPage, totalEvaluationPages);
                            const startIndex = (validCurrentPage - 1) * pageSize;
                            const endIndex = startIndex + pageSize;
                            const paginatedEvaluations = evaluations.slice(startIndex, endIndex);

                            return (
                                <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-visible">
                                    {/* Table Card Header */}
                                    <div className="px-6 py-4.5 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-slate-50 via-white to-orange-50/20 rounded-t-2xl">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white shadow-md shadow-orange-500/20 shrink-0">
                                                {statusTab === 'pending' && <Clock className="w-5 h-5" />}
                                                {statusTab === 'head review' && <Shield className="w-5 h-5" />}
                                                {statusTab === 'submitted' && <CheckCircle2 className="w-5 h-5" />}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                                                        {statusTab === 'pending' && 'Pending Supplier Evaluations'}
                                                        {statusTab === 'head review' && 'Evaluations Under Head Review'}
                                                        {statusTab === 'submitted' && 'Approved & Submitted Evaluations'}
                                                    </h3>
                                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-black bg-orange-100 text-orange-800 border border-orange-200">
                                                        {evaluations.length} Record{evaluations.length === 1 ? '' : 's'}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-slate-500 mt-0.5">
                                                    {statusTab === 'pending' && 'Stage 1: Awaiting end-user criteria assessment and scoring'}
                                                    {statusTab === 'head review' && 'Stage 2: Awaiting Office Head or Authorized Representative digital approval'}
                                                    {statusTab === 'submitted' && 'Stage 3: Approved and finalized records with digital signatures ready for print/export'}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="overflow-x-auto min-h-[360px] pb-8">
                                        <table className="w-full text-xs text-left">
                                            <thead className="bg-slate-100/80 text-slate-600 uppercase text-[11px] font-bold border-b border-slate-200">
                                                <tr>
                                                    <th className="px-5 py-3.5">Purchase Order</th>
                                                    <th className="px-5 py-3.5">Company / Supplier Name</th>
                                                    <th className="px-5 py-3.5">Evaluator / Office</th>
                                                    <th className="px-5 py-3.5 text-center">Average Score</th>
                                                    <th className="px-5 py-3.5 text-center">Covered Period</th>
                                                    <th className="px-5 py-3.5 text-center">Evaluation Date</th>
                                                    <th className="px-5 py-3.5 text-center w-36">Action</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100/90">
                                                {loadingEvals ? (
                                                    <tr>
                                                        <td colSpan={7} className="py-20 text-center text-slate-400">
                                                            <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-orange-500" />
                                                            <span className="text-xs font-semibold">Loading supplier evaluations...</span>
                                                        </td>
                                                    </tr>
                                                ) : evaluations.length === 0 ? (
                                                    <tr>
                                                        <td colSpan={7} className="py-20 text-center text-slate-400">
                                                            <Package className="w-8 h-8 mx-auto mb-2 text-slate-300" />
                                                            <span className="text-xs font-semibold">No supplier evaluations found in this stage.</span>
                                                        </td>
                                                    </tr>
                                                ) : (
                                                    paginatedEvaluations.map((ev, index) => {
                                                        const score = Number(ev.total_score || 0);
                                                        const canEvaluatePending =
                                                            ev.status === 'pending' &&
                                                            ['end_user', 'administrator', 'pgso'].includes(effectiveRole);
                                                        const canHeadApprove =
                                                            ev.status === 'head review' &&
                                                            ['head', 'presentative_staff', 'administrator'].includes(
                                                                effectiveRole
                                                            );
                                                        const canEditReviewed =
                                                            (ev.status === 'head review' || ev.status === 'submitted') &&
                                                            (effectiveRole === 'administrator' ||
                                                                (effectiveRole === 'end_user' &&
                                                                    ev.has_approved_update_request));

                                                        const isMenuOpen = openActionDropdownId === ev.id;
                                                        const openUpward = index >= paginatedEvaluations.length - 2 && paginatedEvaluations.length > 2;

                                                return (
                                                    <tr
                                                        key={ev.id}
                                                        className="hover:bg-orange-50/30 transition-colors duration-150"
                                                    >
                                                        {/* PO No + PDF badge */}
                                                        <td className="px-5 py-3.5">
                                                            <div className="flex flex-col gap-1">
                                                                <span className="font-mono font-bold text-slate-900 bg-slate-100 border border-slate-200/80 px-2 py-0.5 rounded-lg text-xs inline-block w-fit">
                                                                    {ev.po_no}
                                                                </span>
                                                                {ev.po_record?.pr_no && (
                                                                    <span className="text-[10px] text-slate-400 font-mono">
                                                                        PR: {ev.po_record.pr_no}
                                                                    </span>
                                                                )}
                                                                {ev.po_record?.has_pdf ? (
                                                                    <a
                                                                        href={ev.po_record.pdf_url}
                                                                        target="_blank"
                                                                        rel="noopener noreferrer"
                                                                        className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:underline w-fit mt-0.5"
                                                                    >
                                                                        <FileText className="w-3 h-3 text-rose-500" />
                                                                        <span>View PO PDF</span>
                                                                    </a>
                                                                ) : (
                                                                    <span className="text-[10px] text-slate-400 italic">
                                                                        No PO PDF
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </td>

                                                        {/* Supplier Name */}
                                                        <td className="px-5 py-3.5">
                                                            <div className="font-bold text-slate-900 leading-snug">
                                                                {ev.supplier_name}
                                                            </div>
                                                            {ev.po_record?.item && (
                                                                <div className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">
                                                                    {ev.po_record.item}
                                                                </div>
                                                            )}
                                                        </td>

                                                        {/* Evaluator / Office */}
                                                        <td className="px-5 py-3.5">
                                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                                {ev.office_code && (
                                                                    <span className="px-1.5 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-blue-700 font-mono font-bold text-[10px]">
                                                                        {ev.office_code}
                                                                    </span>
                                                                )}
                                                                <span className="font-semibold text-slate-800 text-xs">
                                                                    {ev.office_name}
                                                                </span>
                                                            </div>
                                                            {ev.end_user && (
                                                                <div className="text-[11px] text-slate-500 mt-1">
                                                                    <span className="text-slate-400">End User:</span> {ev.end_user}
                                                                </div>
                                                            )}
                                                        </td>

                                                        {/* Score Badge */}
                                                        <td className="px-5 py-3.5 text-center">
                                                            {ev.status === 'pending' && score === 0 ? (
                                                                <div className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-bold text-[11px] border border-slate-200">
                                                                    <Clock className="w-3 h-3 text-slate-400" />
                                                                    <span>Not Rated</span>
                                                                </div>
                                                            ) : (
                                                                <div className="inline-flex flex-col items-center gap-0.5">
                                                                    <span
                                                                        className={`inline-block px-3 py-0.5 rounded-full font-black text-xs border shadow-2xs ${getScoreBadgeClass(
                                                                            score
                                                                        )}`}
                                                                    >
                                                                        {score.toFixed(2)}%
                                                                    </span>
                                                                    <span className={`text-[10px] font-bold ${score >= 60 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                                                        {ev.rating_status || (score >= 60 ? 'Passed' : 'Failed')}
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </td>

                                                        {/* Covered Period */}
                                                        <td className="px-5 py-3.5 text-center font-semibold text-slate-700">
                                                            <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 text-xs font-bold border border-slate-200">
                                                                {ev.covered_period}
                                                            </span>
                                                        </td>

                                                        {/* Date */}
                                                        <td className="px-5 py-3.5 text-center text-slate-600 font-medium">
                                                            {ev.date_evaluation
                                                                ? String(ev.date_evaluation).slice(0, 10)
                                                                : '-'}
                                                        </td>

                                                        {/* Role-based Action Dropdown */}
                                                        <td className="px-5 py-3.5 text-center">
                                                            <div className="relative inline-block text-left" data-action-dropdown>
                                                                <button
                                                                    type="button"
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setOpenActionDropdownId(isMenuOpen ? null : ev.id);
                                                                    }}
                                                                    className={`px-3 py-1.5 rounded-xl border text-xs font-bold flex items-center justify-between gap-1.5 transition-all duration-150 cursor-pointer shadow-xs min-w-[96px] ${
                                                                        isMenuOpen
                                                                            ? 'bg-orange-600 text-white border-orange-600 shadow-md ring-2 ring-orange-500/30'
                                                                            : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-300 hover:border-slate-400'
                                                                    }`}
                                                                >
                                                                    <span>Action</span>
                                                                    <ChevronDown
                                                                        className={`w-3.5 h-3.5 transition-transform duration-200 ${
                                                                            isMenuOpen ? 'rotate-180' : ''
                                                                        }`}
                                                                    />
                                                                </button>

                                                                {isMenuOpen && (
                                                                    <div
                                                                        onClick={(e) => e.stopPropagation()}
                                                                        className={`absolute right-0 w-52 rounded-2xl bg-white border border-slate-200 shadow-2xl py-1.5 z-50 text-left animate-in fade-in zoom-in-95 divide-y divide-slate-100 ${
                                                                            openUpward
                                                                                ? 'bottom-full mb-1.5 origin-bottom-right'
                                                                                : 'top-full mt-1.5 origin-top-right'
                                                                        }`}
                                                                    >
                                                                        {/* Section 1: Main Actions */}
                                                                        <div className="p-1 space-y-0.5">
                                                                            {/* View Details */}
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    setOpenActionDropdownId(null);
                                                                                    handleOpenEvaluationModal(ev, 'view');
                                                                                }}
                                                                                className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-100/80 flex items-center gap-2.5 transition cursor-pointer text-left"
                                                                            >
                                                                                <Eye className="w-4 h-4 text-slate-500 shrink-0" />
                                                                                <span>View Details</span>
                                                                            </button>

                                                                            {/* Evaluate (Pending Stage) */}
                                                                            {canEvaluatePending && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setOpenActionDropdownId(null);
                                                                                        handleOpenEvaluationModal(ev, 'evaluate');
                                                                                    }}
                                                                                    className="w-full px-3 py-2 rounded-xl text-xs font-bold text-orange-700 bg-orange-50 hover:bg-orange-100 flex items-center gap-2.5 transition cursor-pointer text-left"
                                                                                >
                                                                                    <Sparkles className="w-4 h-4 text-orange-600 shrink-0" />
                                                                                    <span>Evaluate Supplier</span>
                                                                                </button>
                                                                            )}

                                                                            {/* Approve & Sign (Head Review Stage) */}
                                                                            {canHeadApprove && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setOpenActionDropdownId(null);
                                                                                        handleOpenEvaluationModal(ev, 'evaluate');
                                                                                    }}
                                                                                    className="w-full px-3 py-2 rounded-xl text-xs font-bold text-blue-700 bg-blue-50 hover:bg-blue-100 flex items-center gap-2.5 transition cursor-pointer text-left"
                                                                                >
                                                                                    <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                                                                                    <span>
                                                                                        {effectiveRole === 'administrator'
                                                                                            ? 'Evaluate / Approve'
                                                                                            : 'Approve & Sign'}
                                                                                    </span>
                                                                                </button>
                                                                            )}

                                                                            {/* Edit Evaluation */}
                                                                            {canEditReviewed && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setOpenActionDropdownId(null);
                                                                                        handleOpenEvaluationModal(ev, 'edit');
                                                                                    }}
                                                                                    className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-amber-700 hover:bg-amber-50 flex items-center gap-2.5 transition cursor-pointer text-left"
                                                                                >
                                                                                    <Edit3 className="w-4 h-4 text-amber-600 shrink-0" />
                                                                                    <span>Edit Evaluation</span>
                                                                                </button>
                                                                            )}

                                                                            {/* Download / Print Official PDF (Submitted) */}
                                                                            {ev.status === 'submitted' && (
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setOpenActionDropdownId(null);
                                                                                        handleOpenPrintEvaluation(ev);
                                                                                    }}
                                                                                    className="w-full px-3 py-2 rounded-xl text-xs font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 flex items-center gap-2.5 transition cursor-pointer text-left"
                                                                                >
                                                                                    <Printer className="w-4 h-4 text-emerald-600 shrink-0" />
                                                                                    <span>Official Form PDF</span>
                                                                                </button>
                                                                            )}
                                                                        </div>

                                                                        {/* Section 2: Related Documents */}
                                                                        {ev.po_record?.has_pdf && (
                                                                            <div className="p-1">
                                                                                <a
                                                                                    href={ev.po_record.pdf_url}
                                                                                    target="_blank"
                                                                                    rel="noopener noreferrer"
                                                                                    onClick={() => setOpenActionDropdownId(null)}
                                                                                    className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-100/80 flex items-center gap-2.5 transition text-left"
                                                                                >
                                                                                    <FileText className="w-4 h-4 text-rose-500 shrink-0" />
                                                                                    <span>View PO PDF</span>
                                                                                </a>
                                                                            </div>
                                                                        )}

                                                                        {/* Section 3: Modification Request */}
                                                                        {effectiveRole === 'end_user' &&
                                                                            ['head review', 'submitted'].includes(ev.status) &&
                                                                            !ev.has_approved_update_request &&
                                                                            !ev.has_approved_delete_request && (
                                                                                <div className="p-1">
                                                                                    <button
                                                                                        type="button"
                                                                                        onClick={() => {
                                                                                            setOpenActionDropdownId(null);
                                                                                            setShowRequestsModal(true);
                                                                                        }}
                                                                                        className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-amber-700 hover:bg-amber-50 flex items-center gap-2.5 transition cursor-pointer text-left"
                                                                                    >
                                                                                        <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                                                                                        <span>Request Update</span>
                                                                                    </button>
                                                                                </div>
                                                                            )}

                                                                        {/* Section 4: Delete Action */}
                                                                        {(isAdminOrPgso || ev.has_approved_delete_request) && (
                                                                            <div className="p-1">
                                                                                <button
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        setOpenActionDropdownId(null);
                                                                                        handleSoftDeleteEvaluation(ev);
                                                                                    }}
                                                                                    className="w-full px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 hover:text-rose-700 flex items-center gap-2.5 transition cursor-pointer text-left"
                                                                                >
                                                                                    <Trash2 className="w-4 h-4 text-rose-500 shrink-0" />
                                                                                    <span>Delete Evaluation</span>
                                                                                </button>
                                                                            </div>
                                                                        )}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination Footer */}
                            {evaluations.length > 0 && (
                                <div className="px-6 py-4 border-t border-slate-200/80 bg-slate-50/60 rounded-b-2xl">
                                    <PaginationControl
                                        currentPage={validCurrentPage}
                                        totalPages={totalEvaluationPages}
                                        onPageChange={(p) => setCurrentPage(p)}
                                        perPage={pageSize}
                                        onPerPageChange={(size) => {
                                            setPageSize(size);
                                            setCurrentPage(1);
                                        }}
                                        totalEntries={evaluations.length}
                                        startIndex={startIndex}
                                        endIndex={Math.min(endIndex, evaluations.length)}
                                        theme="orange"
                                        perPageOptions={[10, 25, 50]}
                                    />
                                </div>
                            )}
                        </div>
                    );
                })()}
            </>
        )}

                {/* =========================================================
                    WORKSPACE 2: BULK EVALUATION WORKSPACE (bulkpage.blade.php)
                ========================================================= */}
                {workspaceView === 'bulk' && (
                    <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                        <div className="bg-gradient-to-r from-orange-500 to-amber-600 px-6 py-5 text-white flex flex-wrap items-center justify-between gap-3">
                            <div>
                                <h2 className="text-lg font-black">
                                    {effectiveRole === 'head' || effectiveRole === 'presentative_staff'
                                        ? '📋 Bulk Head Review & Digital Approval Workspace'
                                        : '📋 Bulk Supplier Evaluation Workspace'}
                                </h2>
                                <p className="text-xs text-orange-100">
                                    Select a Supplier to evaluate or approve all of its Purchase Orders in one batch
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setWorkspaceView('evaluations')}
                                className="px-4 py-2 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold cursor-pointer"
                            >
                                ← Back to Evaluations Table
                            </button>
                        </div>

                        <div className="p-6 space-y-6 text-xs">
                            {/* Step 1: Select Supplier + Quick Rating Fill */}
                            <div className="flex flex-wrap items-end justify-between gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                                <div className="flex-1 min-w-[260px]">
                                    <label className="block font-black text-slate-700 mb-1.5 uppercase">
                                        Step 1: Select Supplier ({bulkSuppliers.length} Available)
                                    </label>
                                    <select
                                        value={selectedBulkSupplier}
                                        onChange={(e) => setSelectedBulkSupplier(e.target.value)}
                                        className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 font-bold"
                                    >
                                        <option value="">-- Select Supplier --</option>
                                        {bulkSuppliers.map((s, idx) => (
                                            <option key={idx} value={s.supplier_name}>
                                                {s.supplier_name} ({s.po_count} P.O.{s.po_count > 1 ? 's' : ''})
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {bulkEvaluations.length > 0 && (
                                    <div className="flex items-center gap-2">
                                        <span className="font-bold text-slate-600">Quick-Set All Ratings:</span>
                                        {[4, 3, 2, 1].map((r) => (
                                            <button
                                                key={r}
                                                type="button"
                                                onClick={() => handleApplyQuickRatingToAllBulk(r)}
                                                className="px-3 py-2 rounded-xl border border-orange-300 bg-orange-50 hover:bg-orange-100 text-orange-800 font-black cursor-pointer"
                                            >
                                                All Rating {r}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            {/* Step 2: Multi-PO Evaluation Cards */}
                            {loadingBulk ? (
                                <div className="py-12 text-center text-slate-400">
                                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-orange-500" />
                                    Loading supplier evaluations...
                                </div>
                            ) : bulkEvaluations.length === 0 ? (
                                <div className="py-12 text-center text-slate-400 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                    No evaluations waiting for bulk processing for the selected supplier.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {bulkEvaluations.map((ev) => {
                                        const form = bulkForms[ev.id] || {
                                            selected: true,
                                            ratings: { 1: '4', 2: '4', 3: '4', 4: '4' },
                                            remarks: { 1: '', 2: '', 3: '', 4: '' },
                                        };
                                        let score = 0;
                                        [1, 2, 3, 4].forEach((cId) => {
                                            const r = Number(form.ratings[cId] || 0);
                                            if (CRITERIA_WEIGHT_MAP[cId]?.[r]) score += CRITERIA_WEIGHT_MAP[cId][r];
                                        });

                                        return (
                                            <div
                                                key={ev.id}
                                                className={`border rounded-2xl p-4 transition ${
                                                    form.selected
                                                        ? 'border-orange-300 bg-white shadow-2xs'
                                                        : 'border-slate-200 bg-slate-50 opacity-60'
                                                }`}
                                            >
                                                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 mb-3 border-b border-slate-100">
                                                    <label className="flex items-center gap-2.5 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={form.selected}
                                                            onChange={(e) =>
                                                                setBulkForms((prev) => ({
                                                                    ...prev,
                                                                    [ev.id]: {
                                                                        ...form,
                                                                        selected: e.target.checked,
                                                                    },
                                                                }))
                                                            }
                                                            className="w-4 h-4 accent-orange-600"
                                                        />
                                                        <span className="font-mono font-black text-sm text-slate-900">
                                                            P.O. No. {ev.po_no}
                                                        </span>
                                                        <span className="text-slate-500">
                                                            ({ev.office_name} • {ev.covered_period})
                                                        </span>
                                                    </label>

                                                    <div className="flex items-center gap-2">
                                                        {ev.has_pdf && (
                                                            <a
                                                                href={ev.pdf_url}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="px-2.5 py-1 rounded-lg bg-rose-100 text-rose-700 font-bold"
                                                            >
                                                                View PO PDF
                                                            </a>
                                                        )}
                                                        <span
                                                            className={`px-3 py-1 rounded-full font-black border ${getScoreBadgeClass(
                                                                score
                                                            )}`}
                                                        >
                                                            Score: {score.toFixed(2)}%
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                                                    {[1, 2, 3, 4].map((cId) => (
                                                        <div
                                                            key={cId}
                                                            className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2"
                                                        >
                                                            <div className="font-bold text-slate-800 text-[11px]">
                                                                {CRITERIA_LABELS[cId].name} (
                                                                {CRITERIA_LABELS[cId].maxWeight}%)
                                                            </div>
                                                            <select
                                                                value={form.ratings[cId] || '4'}
                                                                onChange={(e) =>
                                                                    setBulkForms((prev) => ({
                                                                        ...prev,
                                                                        [ev.id]: {
                                                                            ...form,
                                                                            ratings: {
                                                                                ...form.ratings,
                                                                                [cId]: e.target.value,
                                                                            },
                                                                        },
                                                                    }))
                                                                }
                                                                className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-bold"
                                                            >
                                                                <option value="4">
                                                                    Rating 4 ({CRITERIA_WEIGHT_MAP[cId][4]}%)
                                                                </option>
                                                                <option value="3">
                                                                    Rating 3 ({CRITERIA_WEIGHT_MAP[cId][3]}%)
                                                                </option>
                                                                <option value="2">
                                                                    Rating 2 ({CRITERIA_WEIGHT_MAP[cId][2]}%)
                                                                </option>
                                                                <option value="1">
                                                                    Rating 1 ({CRITERIA_WEIGHT_MAP[cId][1]}%)
                                                                </option>
                                                            </select>
                                                            <input
                                                                type="text"
                                                                value={form.remarks[cId] || ''}
                                                                onChange={(e) =>
                                                                    setBulkForms((prev) => ({
                                                                        ...prev,
                                                                        [ev.id]: {
                                                                            ...form,
                                                                            remarks: {
                                                                                ...form.remarks,
                                                                                [cId]: e.target.value,
                                                                            },
                                                                        },
                                                                    }))
                                                                }
                                                                placeholder="Optional remarks..."
                                                                className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px]"
                                                            />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        );
                                    })}

                                    <div className="flex justify-end pt-3">
                                        <button
                                            type="button"
                                            disabled={submittingBulk}
                                            onClick={handleSubmitBulkWorkspace}
                                            className="px-6 py-3 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-xs shadow-lg flex items-center gap-2 cursor-pointer"
                                        >
                                            {submittingBulk && <Loader2 className="w-4 h-4 animate-spin" />}
                                            <span>
                                                {effectiveRole === 'head' || effectiveRole === 'presentative_staff'
                                                    ? '✓ Approve & Digitally Sign Selected Evaluations'
                                                    : '✓ Submit Selected Bulk Evaluations'}
                                            </span>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* =========================================================
                    WORKSPACE 3: ANALYTICS & REPORTS (analytics.blade.php)
                ========================================================= */}
                {workspaceView === 'analytics' && (
                    <div className="space-y-6">
                        {/* Analytics Header & Global Filters */}
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-xs p-5">
                            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-200">
                                <div>
                                    <h2 className="text-lg font-black text-slate-900 flex items-center gap-2">
                                        <BarChart3 className="w-5 h-5 text-orange-600" />
                                        <span>Supplier Performance Analytics & Official Reports</span>
                                    </h2>
                                    <p className="text-xs text-slate-500">
                                        Summary Reports, Semester Score Comparisons, Monthly Trends, and Pending PDF POs
                                    </p>
                                </div>

                                {/* 4 Analytics View Tabs */}
                                <div className="flex flex-wrap gap-1.5 bg-slate-100 p-1.5 rounded-2xl text-xs font-bold">
                                    <button
                                        type="button"
                                        onClick={() => setAnalyticsSubTab('summary')}
                                        className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
                                            analyticsSubTab === 'summary'
                                                ? 'bg-white text-orange-600 shadow-2xs'
                                                : 'text-slate-600'
                                        }`}
                                    >
                                        1. Summary & Calculate
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAnalyticsSubTab('semester')}
                                        className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
                                            analyticsSubTab === 'semester'
                                                ? 'bg-white text-orange-600 shadow-2xs'
                                                : 'text-slate-600'
                                        }`}
                                    >
                                        2. Semester Comparison
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAnalyticsSubTab('charts')}
                                        className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
                                            analyticsSubTab === 'charts'
                                                ? 'bg-white text-orange-600 shadow-2xs'
                                                : 'text-slate-600'
                                        }`}
                                    >
                                        3. Monthly & Supplier Charts
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setAnalyticsSubTab('missing_pdf')}
                                        className={`px-3.5 py-1.5 rounded-xl transition cursor-pointer ${
                                            analyticsSubTab === 'missing_pdf'
                                                ? 'bg-white text-orange-600 shadow-2xs'
                                                : 'text-slate-600'
                                        }`}
                                    >
                                        4. POs Pending PDF ({analyticsData.missing_pdf_pos?.length || 0})
                                    </button>
                                </div>
                            </div>

                            {/* Filters Row */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 text-xs">
                                <div>
                                    <label className="block font-bold text-slate-600 mb-1">Filter Department</label>
                                    <select
                                        value={analyticsDept}
                                        onChange={(e) => setAnalyticsDept(e.target.value)}
                                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                    >
                                        <option value="all">All Departments</option>
                                        {(initData?.offices || []).map((o) => (
                                            <option key={o.id} value={o.name}>
                                                {o.code ? `${o.code} — ${o.name}` : o.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-600 mb-1">Period Year</label>
                                    <select
                                        value={analyticsYear}
                                        onChange={(e) => setAnalyticsYear(e.target.value)}
                                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                    >
                                        <option value="all">All Years</option>
                                        {(initData?.years || [2026]).map((y) => (
                                            <option key={y} value={y}>
                                                CY {y}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block font-bold text-slate-600 mb-1">Filter Supplier</label>
                                    <select
                                        value={analyticsSupplier}
                                        onChange={(e) => setAnalyticsSupplier(e.target.value)}
                                        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                                    >
                                        <option value="all">All Suppliers</option>
                                        {(initData?.suppliers || []).map((s, idx) => (
                                            <option key={idx} value={s}>
                                                {s}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* SUB-TAB 1: SUMMARY & CALCULATE EVALUATIONS */}
                        {analyticsSubTab === 'summary' && (
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800">
                                            Supplier Evaluation Summary by Department & Supplier
                                        </h3>
                                        <p className="text-xs text-slate-500">
                                            Click "Calculate PO Breakdown" on any row to inspect individual PO progress bars
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setPrintReport('summary')}
                                        className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                                    >
                                        <Printer className="w-4 h-4" />
                                        <span>Download Summary PDF</span>
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-100 text-slate-600 uppercase text-[11px]">
                                            <tr>
                                                <th className="px-5 py-3">#</th>
                                                <th className="px-5 py-3">Department</th>
                                                <th className="px-5 py-3">Supplier Name</th>
                                                <th className="px-5 py-3 text-center">Evaluations</th>
                                                <th className="px-5 py-3 text-center">Average Score</th>
                                                <th className="px-5 py-3 text-center">Rating Status</th>
                                                <th className="px-5 py-3 text-center">Calculate</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {(analyticsData.summary || []).length === 0 ? (
                                                <tr>
                                                    <td colSpan={7} className="py-12 text-center text-slate-400">
                                                        No submitted evaluation records found.
                                                    </td>
                                                </tr>
                                            ) : (
                                                analyticsData.summary.map((item, idx) => (
                                                    <tr key={idx} className="hover:bg-orange-50/40">
                                                        <td className="px-5 py-3 font-bold">{idx + 1}</td>
                                                        <td className="px-5 py-3 font-semibold text-slate-800">
                                                            {item.department}
                                                        </td>
                                                        <td className="px-5 py-3 font-bold text-slate-900">
                                                            {item.supplier}
                                                        </td>
                                                        <td className="px-5 py-3 text-center font-bold">
                                                            {item.total_evaluations} PO(s)
                                                        </td>
                                                        <td className="px-5 py-3 text-center">
                                                            <span
                                                                className={`px-3 py-1 rounded-full font-black border ${getScoreBadgeClass(
                                                                    item.average_score
                                                                )}`}
                                                            >
                                                                {Number(item.average_score).toFixed(2)}%
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3 text-center font-bold text-slate-700">
                                                            {item.rating_label}
                                                        </td>
                                                        <td className="px-5 py-3 text-center">
                                                            <button
                                                                type="button"
                                                                onClick={() => setCalculateModalGroup(item)}
                                                                className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-[11px] inline-flex items-center gap-1 cursor-pointer"
                                                            >
                                                                <Calculator className="w-3.5 h-3.5" />
                                                                <span>Calculate POs</span>
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* SUB-TAB 2: SEMESTER EVALUATION SCORE COMPARISON */}
                        {analyticsSubTab === 'semester' && (
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800">
                                            Supplier Evaluation Score by Semester (1st Sem Jan–Jun vs 2nd Sem Jul–Dec)
                                        </h3>
                                        <p className="text-xs text-slate-500">
                                            Comparing 1st Semester and 2nd Semester average scores across suppliers
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setPrintReport('semester')}
                                        className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-xs"
                                    >
                                        <Printer className="w-4 h-4" />
                                        <span>Download Semester PDF</span>
                                    </button>
                                </div>

                                <div className="overflow-x-auto">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-100 text-slate-600 uppercase text-[11px]">
                                            <tr>
                                                <th className="px-5 py-3">#</th>
                                                <th className="px-5 py-3">Supplier Name</th>
                                                <th className="px-5 py-3 text-center">1st Semester (Jan - Jun)</th>
                                                <th className="px-5 py-3 text-center">2nd Semester (Jul - Dec)</th>
                                                <th className="px-5 py-3 text-center">Overall Avg</th>
                                                <th className="px-5 py-3 text-center">Rating</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {(analyticsData.semester_data || []).length === 0 ? (
                                                <tr>
                                                    <td colSpan={6} className="py-12 text-center text-slate-400">
                                                        No semester data available.
                                                    </td>
                                                </tr>
                                            ) : (
                                                analyticsData.semester_data.map((s, idx) => (
                                                    <tr key={idx} className="hover:bg-slate-50">
                                                        <td className="px-5 py-3 font-bold">{idx + 1}</td>
                                                        <td className="px-5 py-3 font-bold text-slate-900">
                                                            {s.supplier}
                                                        </td>
                                                        <td className="px-5 py-3 text-center">
                                                            {s.sem1_avg !== null ? (
                                                                <span className="font-semibold text-blue-700">
                                                                    {Number(s.sem1_avg).toFixed(2)}% ({s.sem1_count}{' '}
                                                                    POs)
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-400">N/A</span>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-3 text-center">
                                                            {s.sem2_avg !== null ? (
                                                                <span className="font-semibold text-indigo-700">
                                                                    {Number(s.sem2_avg).toFixed(2)}% ({s.sem2_count}{' '}
                                                                    POs)
                                                                </span>
                                                            ) : (
                                                                <span className="text-slate-400">N/A</span>
                                                            )}
                                                        </td>
                                                        <td className="px-5 py-3 text-center">
                                                            <span
                                                                className={`px-3 py-1 rounded-full font-black border ${getScoreBadgeClass(
                                                                    s.overall_avg || 0
                                                                )}`}
                                                            >
                                                                {s.overall_avg !== null
                                                                    ? `${Number(s.overall_avg).toFixed(2)}%`
                                                                    : 'N/A'}
                                                            </span>
                                                        </td>
                                                        <td className="px-5 py-3 text-center font-bold">
                                                            {s.rating_label}
                                                        </td>
                                                    </tr>
                                                ))
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* SUB-TAB 3: MONTHLY EVALUATION COUNT & SUPPLIER RANKINGS */}
                        {analyticsSubTab === 'charts' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Monthly Evaluation Count */}
                                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs">
                                    <h3 className="text-sm font-black text-slate-800 mb-1">
                                        Monthly Evaluation Count (Jan – Dec)
                                    </h3>
                                    <p className="text-xs text-slate-500 mb-5">
                                        Number of submitted evaluations per month
                                    </p>

                                    <div className="grid grid-cols-12 gap-2 items-end h-52 pt-6 px-2 border-b border-slate-200">
                                        {(analyticsData.monthly_counts || Array(12).fill(0)).map((cnt, idx) => {
                                            const maxCnt = Math.max(...(analyticsData.monthly_counts || [1]), 1);
                                            const heightPct = Math.max((cnt / maxCnt) * 100, cnt > 0 ? 12 : 4);
                                            return (
                                                <div
                                                    key={idx}
                                                    className="flex flex-col items-center justify-end h-full"
                                                >
                                                    <span className="text-[10px] font-bold text-slate-700 mb-1">
                                                        {cnt}
                                                    </span>
                                                    <div
                                                        style={{ height: `${heightPct}%` }}
                                                        className={`w-full rounded-t-lg transition-all ${
                                                            cnt > 0
                                                                ? 'bg-gradient-to-t from-orange-600 to-amber-400'
                                                                : 'bg-slate-200'
                                                        }`}
                                                    />
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="grid grid-cols-12 gap-2 pt-2 text-center text-[10px] font-bold text-slate-500">
                                        {MONTHS_SHORT.map((m) => (
                                            <span key={m}>{m}</span>
                                        ))}
                                    </div>
                                </div>

                                {/* Supplier Score Rankings */}
                                <div className="bg-white rounded-3xl border border-slate-200 p-6 shadow-xs flex flex-col">
                                    <h3 className="text-sm font-black text-slate-800 mb-1">
                                        Supplier Average Score Rankings
                                    </h3>
                                    <p className="text-xs text-slate-500 mb-4">
                                        Highest to lowest rated suppliers
                                    </p>

                                    <div className="flex-1 overflow-y-auto max-h-64 space-y-3 pr-2">
                                        {(analyticsData.supplier_scores || []).map((s, idx) => (
                                            <div key={idx} className="space-y-1 text-xs">
                                                <div className="flex items-center justify-between font-bold">
                                                    <span className="truncate max-w-[70%] text-slate-800">
                                                        {idx + 1}. {s.supplier} ({s.total_evaluations} POs)
                                                    </span>
                                                    <span className="text-orange-700">{s.average_score}%</span>
                                                </div>
                                                <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                                    <div
                                                        style={{ width: `${Math.min(s.average_score, 100)}%` }}
                                                        className={`h-full rounded-full ${
                                                            s.average_score >= 90
                                                                ? 'bg-emerald-500'
                                                                : s.average_score >= 75
                                                                ? 'bg-blue-500'
                                                                : 'bg-amber-500'
                                                        }`}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* SUB-TAB 4: PURCHASE ORDERS PENDING PDF UPLOAD */}
                        {analyticsSubTab === 'missing_pdf' && (
                            <div className="bg-white rounded-3xl border border-slate-200 shadow-xs overflow-hidden">
                                <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-sm font-black text-slate-800">
                                            Purchase Orders Pending PDF Upload (
                                            {analyticsData.missing_pdf_pos?.length || 0})
                                        </h3>
                                        <p className="text-xs text-slate-500">
                                            Purchase Orders without an attached scanned PDF copy
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="text"
                                            value={missingPdfSearch}
                                            onChange={(e) => setMissingPdfSearch(e.target.value)}
                                            placeholder="Search PO No, Supplier..."
                                            className="px-3.5 py-1.5 rounded-xl border border-slate-300 bg-white text-xs"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setPrintReport('missing_pdf')}
                                            className="px-4 py-2 rounded-xl bg-orange-600 hover:bg-orange-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                                        >
                                            <Printer className="w-4 h-4" />
                                            <span>Download Report PDF</span>
                                        </button>
                                    </div>
                                </div>

                                <div className="overflow-x-auto max-h-[500px]">
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-100 text-slate-600 uppercase text-[11px] sticky top-0">
                                            <tr>
                                                <th className="px-5 py-3">#</th>
                                                <th className="px-5 py-3">PO Number</th>
                                                <th className="px-5 py-3">PR Number</th>
                                                <th className="px-5 py-3">End User / Dept</th>
                                                <th className="px-5 py-3">Supplier Name</th>
                                                <th className="px-5 py-3 text-center">PDF Status</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {(analyticsData.missing_pdf_pos || []).map((po, idx) => (
                                                <tr key={po.id || idx} className="hover:bg-slate-50">
                                                    <td className="px-5 py-2.5">{idx + 1}</td>
                                                    <td className="px-5 py-2.5 font-mono font-bold">{po.po_no}</td>
                                                    <td className="px-5 py-2.5 font-mono">{po.pr_no || '-'}</td>
                                                    <td className="px-5 py-2.5">{po.end_user}</td>
                                                    <td className="px-5 py-2.5 font-medium">{po.supplier}</td>
                                                    <td className="px-5 py-2.5 text-center">
                                                        <span className="px-2.5 py-0.5 rounded-full bg-rose-100 text-rose-700 font-bold text-[10px]">
                                                            No PDF Uploaded
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </main>

            {/* ─────────────────────────────────────────────────────────────
                3. MODALS & PRINT VIEWS
            ───────────────────────────────────────────────────────────── */}
            {activeEvalModal && (
                <EvaluateOrViewModal
                    evaluation={activeEvalModal.evaluation}
                    mode={activeEvalModal.mode}
                    effectiveRole={effectiveRole}
                    user={user}
                    offices={initData?.offices || []}
                    approvedPdfs={initData?.approved_pdfs || []}
                    onClose={() => setActiveEvalModal(null)}
                    onSuccess={() => refreshAll()}
                    onOpenPrint={(ev) => {
                        setActiveEvalModal(null);
                        handleOpenPrintEvaluation(ev);
                    }}
                />
            )}

            {printEval && (
                <EvaluationFormPrintModal evaluation={printEval} onClose={() => setPrintEval(null)} />
            )}

            {printReport && (
                <AnalyticsReportPrintModal
                    reportType={printReport}
                    data={analyticsData}
                    filters={{
                        department: analyticsDept,
                        year: analyticsYear,
                        supplier: analyticsSupplier,
                    }}
                    onClose={() => setPrintReport(null)}
                />
            )}

            {showAddModal && (
                <AddEvaluationModal
                    offices={initData?.offices || []}
                    suppliers={initData?.suppliers || []}
                    onClose={() => setShowAddModal(false)}
                    onSuccess={() => refreshAll()}
                />
            )}

            {showPoModal && (
                <PurchaseOrdersModal
                    effectiveRole={effectiveRole}
                    userOffice={initData?.user?.office || null}
                    offices={initData?.offices || []}
                    endUsers={initData?.end_users || []}
                    suppliers={initData?.suppliers || []}
                    onClose={() => setShowPoModal(false)}
                    onEvaluationAdded={() => refreshAll()}
                />
            )}

            {showRequestsModal && (
                <RequestsModal
                    effectiveRole={effectiveRole}
                    onClose={() => setShowRequestsModal(false)}
                    onUpdated={() => refreshAll()}
                />
            )}

            {showImportModal && (
                <ImportAndAuthorizeModal
                    effectiveRole={effectiveRole}
                    onClose={() => setShowImportModal(false)}
                    onSuccess={() => refreshAll()}
                />
            )}

            {showRecycleModal && (
                <RecycleBinModal
                    onClose={() => setShowRecycleModal(false)}
                    onRestored={() => refreshAll()}
                />
            )}

            {showLogsModal && <ActivityLogsModal onClose={() => setShowLogsModal(false)} />}

            {/* Calculate Evaluations Breakdown Modal (analytics.blade.php) */}
            {calculateModalGroup && (
                <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden">
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4 text-white flex items-center justify-between">
                            <div>
                                <h3 className="text-base font-black">
                                    📊 Calculate Evaluations Breakdown — {calculateModalGroup.supplier}
                                </h3>
                                <p className="text-xs text-blue-100">
                                    Department: {calculateModalGroup.department} • Total POs:{' '}
                                    {calculateModalGroup.total_evaluations}
                                </p>
                            </div>
                            <button
                                type="button"
                                onClick={() => setCalculateModalGroup(null)}
                                className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center text-white cursor-pointer"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="p-6 space-y-4 text-xs max-h-[75vh] overflow-y-auto">
                            <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200 flex items-center justify-between">
                                <div>
                                    <div className="text-slate-600 font-bold uppercase text-[10px]">
                                        Computed Overall Average Score
                                    </div>
                                    <div className="text-2xl font-black text-blue-900 mt-0.5">
                                        {Number(calculateModalGroup.average_score).toFixed(2)}%
                                    </div>
                                </div>
                                <span className="px-3.5 py-1.5 rounded-full bg-blue-600 text-white font-black uppercase text-xs">
                                    {calculateModalGroup.rating_label}
                                </span>
                            </div>

                            <div className="space-y-3">
                                {(calculateModalGroup.evaluations || []).map((ev, i) => (
                                    <div key={ev.id || i} className="p-3 rounded-xl border border-slate-200 space-y-1.5">
                                        <div className="flex items-center justify-between font-bold">
                                            <span className="font-mono text-slate-900">
                                                {i + 1}. P.O. No. {ev.po_no} ({ev.covered_period})
                                            </span>
                                            <span className="text-blue-700">{Number(ev.score).toFixed(2)}%</span>
                                        </div>
                                        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                            <div
                                                style={{ width: `${Math.min(ev.score, 100)}%` }}
                                                className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 rounded-full"
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

