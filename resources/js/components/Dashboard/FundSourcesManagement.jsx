import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    Landmark,
    Plus,
    Search,
    Edit2,
    Trash2,
    CheckCircle2,
    XCircle,
    AlertCircle,
    ArrowRight,
    Shield,
    Layers,
    Info,
    RefreshCw,
    X,
    Filter,
    Download,
    FileSpreadsheet,
    Printer,
    FileText,
    ExternalLink,
} from 'lucide-react';
import { fundSourceService } from '../../services/api';
import { PaginationControl } from '../UI/PaginationControl';

export const FundSourcesManagement = ({ user: propUser }) => {
    const user = propUser || window.App?.user || null;
    const userRole = user?.role;
    const isPacco = userRole === 'pacco';
    const isBudgetOfficer = userRole === 'budget_officer';
    const isAdmin = ['admin', 'super_admin'].includes(userRole);

    const [fundSources, setFundSources] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [routeFilter, setRouteFilter] = useState(() => (isPacco ? 'pacco' : (isBudgetOfficer ? 'budget' : 'ALL')));
    const [categoryFilter, setCategoryFilter] = useState(() => (isPacco ? 'Trust Fund' : 'ALL'));
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(10);

    useEffect(() => {
        if (isPacco) {
            setRouteFilter('pacco');
            setCategoryFilter('Trust Fund');
        } else if (isBudgetOfficer) {
            setRouteFilter('budget');
            setCategoryFilter('ALL');
        }
    }, [isPacco, isBudgetOfficer]);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSource, setEditingSource] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        category: isPacco ? 'Trust Fund' : 'General Fund',
        workflow_route: isPacco ? 'pacco' : 'budget',
        description: '',
        is_active: true,
        display_order: 0,
    });
    const [saving, setSaving] = useState(false);
    const [modalError, setModalError] = useState('');

    const [deleteModalSource, setDeleteModalSource] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
    const [isExportingExcel, setIsExportingExcel] = useState(false);

    const [feedback, setFeedback] = useState({ type: '', text: '' });

    const showFeedback = (type, text) => {
        setFeedback({ type, text });
        setTimeout(() => setFeedback({ type: '', text: '' }), 5000);
    };

    const fetchFundSources = async (isBackground = false) => {
        if (!isBackground) setLoading(true);
        else setRefreshing(true);

        try {
            const params = {};
            if (isPacco) {
                params.route = 'pacco';
            } else if (isBudgetOfficer) {
                params.route = 'budget';
            }
            const res = await fundSourceService.getAll(params);
            setFundSources(Array.isArray(res.data) ? res.data : []);
        } catch (err) {
            showFeedback('error', err.response?.data?.message || 'Failed to load Fund Sources.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchFundSources();
    }, [isPacco, isBudgetOfficer]);

    const filteredSources = useMemo(() => {
        return fundSources.filter((fs) => {

            if (isPacco && fs.workflow_route !== 'pacco' && fs.category !== 'Trust Fund') {
                return false;
            }

            if (isBudgetOfficer && (fs.workflow_route === 'pacco' || fs.category === 'Trust Fund')) {
                return false;
            }

            const matchesSearch =
                !searchQuery ||
                fs.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                (fs.code && fs.code.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (fs.description && fs.description.toLowerCase().includes(searchQuery.toLowerCase())) ||
                (fs.category && fs.category.toLowerCase().includes(searchQuery.toLowerCase()));

            const matchesRoute =
                isPacco ? fs.workflow_route === 'pacco' || fs.category === 'Trust Fund' :
                isBudgetOfficer ? fs.workflow_route === 'budget' :
                (routeFilter === 'ALL' || fs.workflow_route === routeFilter);

            const matchesCategory =
                categoryFilter === 'ALL' ||
                (categoryFilter === 'General Fund' && (fs.category === 'General Fund' || (!fs.category && fs.workflow_route === 'budget'))) ||
                (categoryFilter === 'Trust Fund' && (fs.category === 'Trust Fund' || fs.workflow_route === 'pacco')) ||
                (categoryFilter === 'Special Fund' && fs.category === 'Special Fund');

            const matchesStatus =
                statusFilter === 'ALL' ||
                (statusFilter === 'ACTIVE' && fs.is_active) ||
                (statusFilter === 'INACTIVE' && !fs.is_active);

            return matchesSearch && matchesRoute && matchesCategory && matchesStatus;
        });
    }, [fundSources, searchQuery, routeFilter, categoryFilter, statusFilter, isPacco, isBudgetOfficer]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, routeFilter, categoryFilter, statusFilter]);

    const totalEntries = filteredSources.length;
    const totalPages = Math.max(1, Math.ceil(totalEntries / perPage));
    const safePage = Math.min(currentPage, totalPages) || 1;
    const startIndex = (safePage - 1) * perPage;
    const endIndex = Math.min(startIndex + perPage, totalEntries);
    const paginatedSources = useMemo(() => {
        return filteredSources.slice(startIndex, endIndex);
    }, [filteredSources, startIndex, endIndex]);

    const handleOpenAddModal = () => {
        setEditingSource(null);
        setFormData({
            name: '',
            code: '',
            category: isPacco ? 'Trust Fund' : 'General Fund',
            workflow_route: isPacco ? 'pacco' : 'budget',
            description: '',
            is_active: true,
            display_order: fundSources.length > 0 ? (Math.max(...fundSources.map(f => f.display_order || 0)) + 1) : 0,
        });
        setModalError('');
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (source) => {
        setEditingSource(source);
        setFormData({
            name: source.name,
            code: source.code || '',
            category: source.category || (source.workflow_route === 'pacco' ? 'Trust Fund' : 'General Fund'),
            workflow_route: isPacco ? 'pacco' : (isBudgetOfficer ? 'budget' : (source.workflow_route || 'budget')),
            description: source.description || '',
            is_active: Boolean(source.is_active),
            display_order: source.display_order || 0,
        });
        setModalError('');
        setIsModalOpen(true);
    };

    const handleSave = async (e) => {
        e.preventDefault();
        if (!formData.name.trim()) {
            setModalError('Fund Source Name is required.');
            return;
        }

        setSaving(true);
        setModalError('');

        try {
            if (editingSource) {
                const res = await fundSourceService.update(editingSource.id, formData);
                showFeedback('success', res.data?.message || 'Fund Source updated successfully.');
            } else {
                const res = await fundSourceService.create(formData);
                showFeedback('success', res.data?.message || 'Fund Source created successfully.');
            }
            setIsModalOpen(false);
            window.dispatchEvent(new CustomEvent('fund-sources:changed'));
            fetchFundSources(true);
        } catch (err) {
            setModalError(
                err.response?.data?.errors?.name?.[0] ||
                err.response?.data?.message ||
                'Failed to save Fund Source.'
            );
        } finally {
            setSaving(false);
        }
    };

    const handleToggleActive = async (source) => {
        try {
            const nextStatus = !source.is_active;
            await fundSourceService.update(source.id, {
                ...source,
                is_active: nextStatus,
            });
            showFeedback('success', `Fund Source "${source.name}" is now ${nextStatus ? 'Active' : 'Inactive'}.`);
            window.dispatchEvent(new CustomEvent('fund-sources:changed'));
            fetchFundSources(true);
        } catch (err) {
            showFeedback('error', 'Failed to change status.');
        }
    };

    const handleDelete = async () => {
        if (!deleteModalSource) return;
        setDeleting(true);
        setDeleteError('');

        try {
            await fundSourceService.delete(deleteModalSource.id);
            showFeedback('success', `Source of Fund "${deleteModalSource.name}" deleted.`);
            setDeleteModalSource(null);
            window.dispatchEvent(new CustomEvent('fund-sources:changed'));
            fetchFundSources(true);
        } catch (err) {
            setDeleteError(err.response?.data?.message || 'Failed to delete fund source.');
        } finally {
            setDeleting(false);
        }
    };

    const handleExportExcel = async () => {
        setIsExportingExcel(true);
        try {
            const exportRoute = isPacco ? 'pacco' : (isBudgetOfficer ? 'budget' : routeFilter);
            const exportCategory = isPacco ? 'Trust Fund' : categoryFilter;
            const res = await fundSourceService.export({
                category: exportCategory,
                route: exportRoute,
            });
            const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const filenamePrefix = isPacco
                ? 'Davao_del_Sur_PACCO_Trust_Funds_'
                : isBudgetOfficer
                    ? 'Davao_del_Sur_PBO_Sources_of_Fund_'
                    : 'Davao_del_Sur_Sources_of_Fund_';
            link.setAttribute('download', `${filenamePrefix}${new Date().toISOString().slice(0, 10)}.csv`);
            document.body.appendChild(link);
            link.click();
            link.remove();
            window.URL.revokeObjectURL(url);
            showFeedback('success', 'Excel/CSV file exported successfully.');
        } catch (err) {

            try {
                let csvContent = '\uFEFFID,Source of Fund Name,Code,Category,Review Route,Status,PPMP Usage Count,Description,Display Order\n';
                filteredSources.forEach(s => {
                    const cleanName = `"${(s.name || '').replace(/"/g, '""')}"`;
                    const cleanDesc = `"${(s.description || '').replace(/"/g, '""')}"`;
                    const routeName = s.workflow_route === 'pacco' ? 'PACCO Reviewer' : 'Budget Officer';
                    const category = s.category || (s.workflow_route === 'pacco' ? 'Trust Fund' : 'General Fund');
                    const status = s.is_active ? 'Active' : 'Inactive';
                    csvContent += `${s.id},${cleanName},${s.code || ''},${category},${routeName},${status},${s.ppmps_count || 0},${cleanDesc},${s.display_order || 0}\n`;
                });
                const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
                const url = window.URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                const filenamePrefix = isPacco
                    ? 'Davao_del_Sur_PACCO_Trust_Funds_'
                    : isBudgetOfficer
                        ? 'Davao_del_Sur_PBO_Sources_of_Fund_'
                        : 'Davao_del_Sur_Sources_of_Fund_';
                link.setAttribute('download', `${filenamePrefix}${new Date().toISOString().slice(0, 10)}.csv`);
                document.body.appendChild(link);
                link.click();
                link.remove();
                window.URL.revokeObjectURL(url);
                showFeedback('success', 'Excel file exported successfully.');
            } catch (fallbackErr) {
                showFeedback('error', 'Failed to export Excel file.');
            }
        } finally {
            setIsExportingExcel(false);
        }
    };

    const handlePrintDocument = () => {
        window.print();
    };

    const trustSources = useMemo(() => fundSources.filter(f => f.workflow_route === 'pacco' || f.category === 'Trust Fund'), [fundSources]);
    const generalSources = useMemo(() => fundSources.filter(f => f.workflow_route === 'budget' || (f.category !== 'Trust Fund' && f.workflow_route !== 'pacco')), [fundSources]);

    const trustCount = trustSources.length;
    const generalCount = generalSources.length;

    return (
        <div className="space-y-6 animate-in fade-in duration-150">

            {feedback.text && (
                <div className={`p-4 rounded-xl border flex items-center justify-between text-xs font-semibold shadow-xs ${
                    feedback.type === 'error'
                        ? 'bg-rose-50 border-rose-200 text-rose-800'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                }`}>
                    <div className="flex items-center gap-2">
                        {feedback.type === 'error' ? <AlertCircle className="w-4 h-4 text-rose-600" /> : <CheckCircle2 className="w-4 h-4 text-emerald-600" />}
                        <span>{feedback.text}</span>
                    </div>
                    <button type="button" onClick={() => setFeedback({ type: '', text: '' })} className="text-slate-400 hover:text-slate-600">
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            <div className={`text-white rounded-2xl p-6 border shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                isPacco
                    ? 'bg-gradient-to-r from-slate-900 via-teal-950 to-slate-900 border-teal-800/40'
                    : isBudgetOfficer
                        ? 'bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 border-blue-800/40'
                        : 'bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 border-slate-800'
            }`}>
                <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-inner border ${
                            isPacco
                                ? 'bg-teal-600/30 border-teal-400/30 text-teal-300'
                                : isBudgetOfficer
                                    ? 'bg-blue-600/30 border-blue-400/30 text-blue-300'
                                    : 'bg-blue-600/30 border-blue-400/30 text-blue-400'
                        }`}>
                            <Landmark className="w-5 h-5" />
                        </div>
                        <div>
                            <h2 className="text-lg font-black tracking-tight text-white uppercase flex items-center gap-2">
                                {isPacco ? 'Trust Funds Management' : 'Sources of Fund Management'}
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                    isPacco
                                        ? 'bg-teal-500/20 text-teal-300 border-teal-500/30'
                                        : isBudgetOfficer
                                            ? 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                            : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                                }`}>
                                    {isPacco ? 'PACCO Trust Fund Catalog' : isBudgetOfficer ? 'Budget Office Catalog' : 'Normalized Catalog'}
                                </span>
                            </h2>
                            <p className="text-xs text-slate-300">
                                {isPacco
                                    ? 'Official Provincial Accounting Office (PACCO) Trust Fund Management'
                                    : isBudgetOfficer
                                        ? 'Official Provincial Budget Office (PBO) Fund Management'
                                        : 'Official Provincial Accounting Office (PACCO) & Provincial Budget Office Fund Catalog'}
                            </p>
                        </div>
                    </div>
                    <p className="text-xs text-slate-400 max-w-2xl leading-relaxed mt-1">
                        {isPacco
                            ? 'Manages official Trust Fund procurement sources: National Subsidies, Grants, Trust Deposits & Fiduciary Funds automatically routed to the PACCO Reviewer.'
                            : isBudgetOfficer
                                ? 'Manages official Regular Provincial Appropriations: General Fund, 20% Development Fund, and Special Health & Education Funds automatically routed to the Budget Officer.'
                                : 'Defines automated review routing: Budget Officer (General Fund, 20% DF, Special Health & Education) or PACCO Reviewer (National Subsidies, Grants, Trust Deposits & Fiduciary Funds).'}
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <button
                        type="button"
                        onClick={() => fetchFundSources(true)}
                        disabled={refreshing || loading}
                        className="p-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-white transition border border-white/10 cursor-pointer disabled:opacity-50"
                        title="Refresh List"
                    >
                        <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    </button>

                    <button
                        type="button"
                        onClick={handleExportExcel}
                        disabled={isExportingExcel || loading}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition shadow-xs border border-emerald-400/30 cursor-pointer disabled:opacity-50"
                        title="Download as Excel/CSV spreadsheet"
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        <span>Export Excel</span>
                    </button>

                    <button
                        type="button"
                        onClick={() => setIsPrintModalOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition shadow-xs border border-indigo-400/30 cursor-pointer"
                        title="Open official printable PDF view"
                    >
                        <Printer className="w-4 h-4" />
                        <span>Export PDF / Print</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleOpenAddModal}
                        className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white text-xs font-bold transition shadow-lg border cursor-pointer ${
                            isPacco
                                ? 'bg-teal-600 hover:bg-teal-500 shadow-teal-600/30 border-teal-400/30'
                                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-600/30 border-blue-400/30'
                        }`}
                    >
                        <Plus className="w-4 h-4" />
                        <span>{isPacco ? 'Add Trust Fund' : 'Add Fund Source'}</span>
                    </button>
                </div>
            </div>

            <div className={`grid gap-4 ${isAdmin ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>

                {!isPacco && (
                    <div className="bg-white p-4 rounded-xl border border-blue-100 shadow-xs flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xs">
                                    GF
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-900">Budget Officer Pipeline ({generalCount})</div>
                                    <div className="text-[11px] text-slate-500">General Fund, 20% DF, Special Health &amp; Education</div>
                                </div>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                                Budget Route
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 overflow-x-auto">
                            <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200 shrink-0">BAC-TWG</span>
                            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200 shrink-0">Budget Officer</span>
                            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-200 shrink-0">OPPMO (APP)</span>
                            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200 shrink-0">Ready to Print</span>
                        </div>
                    </div>
                )}

                {!isBudgetOfficer && (
                    <div className="bg-white p-4 rounded-xl border border-teal-100 shadow-xs flex flex-col justify-between">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center font-bold text-xs">
                                    TF
                                </div>
                                <div>
                                    <div className="text-xs font-bold text-slate-900">PACCO Reviewer Pipeline ({trustCount})</div>
                                    <div className="text-[11px] text-slate-500">National Subsidies, Grants &amp; Fiduciary Accounts</div>
                                </div>
                            </div>
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-teal-50 text-teal-800 border border-teal-200">
                                PACCO Route
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 bg-slate-50 p-2.5 rounded-lg border border-slate-100 overflow-x-auto">
                            <span className="px-2 py-0.5 bg-purple-50 text-purple-700 rounded border border-purple-200 shrink-0">BAC-TWG</span>
                            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="px-2 py-0.5 bg-teal-50 text-teal-800 rounded border border-teal-200 shrink-0">PACCO Reviewer</span>
                            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded border border-indigo-200 shrink-0">OPPMO (APP)</span>
                            <ArrowRight className="w-3 h-3 text-slate-400 shrink-0" />
                            <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200 shrink-0">Ready to Print</span>
                        </div>
                    </div>
                )}
            </div>

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs flex flex-col lg:flex-row items-center justify-between gap-3">
                <div className="relative w-full lg:w-80">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder={isPacco ? "Search trust fund name, code, description..." : "Search fund name, code, description..."}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition"
                    />
                </div>

                <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto flex-wrap">

                    {isPacco ? (
                        <div className="flex items-center gap-1.5 bg-teal-50 border border-teal-200 px-3 py-1.5 rounded-lg">
                            <span className="w-2 h-2 rounded-full bg-teal-500" />
                            <span className="text-xs font-bold text-teal-900">PACCO Trust Funds ({filteredSources.length})</span>
                        </div>
                    ) : isBudgetOfficer ? (
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                            <button
                                type="button"
                                onClick={() => setCategoryFilter('ALL')}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                                    categoryFilter === 'ALL'
                                        ? 'bg-white text-slate-900 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                All Regular Funds ({generalCount})
                            </button>
                            <button
                                type="button"
                                onClick={() => setCategoryFilter('General Fund')}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                                    categoryFilter === 'General Fund'
                                        ? 'bg-white text-blue-700 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full bg-blue-500" />
                                <span>General Fund</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setCategoryFilter('Special Fund')}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                                    categoryFilter === 'Special Fund'
                                        ? 'bg-white text-indigo-700 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full bg-indigo-500" />
                                <span>Special Fund</span>
                            </button>
                        </div>
                    ) : (
                        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
                            <button
                                type="button"
                                onClick={() => setCategoryFilter('ALL')}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer ${
                                    categoryFilter === 'ALL'
                                        ? 'bg-white text-slate-900 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                All Categories ({fundSources.length})
                            </button>
                            <button
                                type="button"
                                onClick={() => setCategoryFilter('General Fund')}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                                    categoryFilter === 'General Fund'
                                        ? 'bg-white text-blue-700 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full bg-blue-500" />
                                <span>General / Special ({generalCount})</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setCategoryFilter('Trust Fund')}
                                className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition cursor-pointer flex items-center gap-1 ${
                                    categoryFilter === 'Trust Fund'
                                        ? 'bg-white text-teal-800 shadow-xs'
                                        : 'text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <span className="w-2 h-2 rounded-full bg-teal-500" />
                                <span>Trust Funds ({trustCount})</span>
                            </button>
                        </div>
                    )}

                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="text-xs p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-semibold focus:ring-2 focus:ring-blue-500 cursor-pointer"
                    >
                        <option value="ALL">All Statuses</option>
                        <option value="ACTIVE">Active Only</option>
                        <option value="INACTIVE">Inactive Only</option>
                    </select>

                    <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 px-2 py-1 rounded-lg text-xs">
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wide">Show:</span>
                        <select
                            value={perPage}
                            onChange={(e) => {
                                setPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="bg-transparent text-xs text-slate-700 font-bold focus:outline-none cursor-pointer"
                            title="Entries per page"
                        >
                            <option value={10}>10 entries</option>
                            <option value={25}>25 entries</option>
                            <option value={50}>50 entries</option>
                            <option value={100}>100 entries</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs text-slate-600">
                        <thead className="bg-slate-50/80 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                            <tr>
                                <th className="px-5 py-3 w-12 text-center">#</th>
                                <th className="px-5 py-3">Source of Fund Name &amp; Code</th>
                                <th className="px-5 py-3">Category</th>
                                <th className="px-5 py-3">Review Route</th>
                                <th className="px-5 py-3">Description</th>
                                <th className="px-5 py-3 text-center">PPMP Usage</th>
                                <th className="px-5 py-3 text-center">Status</th>
                                <th className="px-5 py-3 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={8} className="px-5 py-10 text-center text-slate-400 font-medium">
                                        Loading sources of fund...
                                    </td>
                                </tr>
                            ) : filteredSources.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="px-5 py-10 text-center text-slate-400 font-medium">
                                        No fund sources found matching your criteria.
                                    </td>
                                </tr>
                            ) : (
                                paginatedSources.map((source) => {
                                    const isBudgetRoute = source.workflow_route === 'budget';
                                    const category = source.category || (isBudgetRoute ? 'General Fund' : 'Trust Fund');
                                    const isTrust = source.workflow_route === 'pacco' || category === 'Trust Fund';

                                    return (
                                        <tr key={source.id} className="hover:bg-slate-50/70 transition">

                                            <td className="px-5 py-3.5 font-mono font-bold text-slate-400 text-center w-12">
                                                {source.display_order ?? 0}
                                            </td>

                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-2.5">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs shrink-0 ${
                                                        isTrust
                                                            ? 'bg-teal-100 text-teal-800'
                                                            : 'bg-blue-100 text-blue-700'
                                                    }`}>
                                                        {source.code ? source.code.slice(0, 3) : <Landmark className="w-4 h-4" />}
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-slate-900 flex items-center gap-2">
                                                            {source.name}
                                                            {source.code && (
                                                                <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-mono text-[10px] font-semibold border border-slate-200">
                                                                    {source.code}
                                                                </span>
                                                            )}
                                                        </div>
                                                        <div className="text-[10px] text-slate-400 font-medium">
                                                            ID: #{source.id}
                                                        </div>
                                                    </div>
                                                </div>
                                            </td>

                                            <td className="px-5 py-3.5">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                                                    isTrust
                                                        ? 'bg-teal-50 text-teal-900 border-teal-200'
                                                        : 'bg-blue-50 text-blue-900 border-blue-200'
                                                }`}>
                                                    {category}
                                                </span>
                                            </td>

                                            <td className="px-5 py-3.5">
                                                {isBudgetRoute ? (
                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 font-semibold text-[11px]">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                                                        <span>Budget Officer</span>
                                                    </div>
                                                ) : (
                                                    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 text-teal-800 border border-teal-200 font-semibold text-[11px]">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                                                        <span>PACCO Reviewer</span>
                                                    </div>
                                                )}
                                            </td>

                                            <td className="px-5 py-3.5 max-w-xs text-slate-600 text-xs truncate">
                                                {source.description || <span className="text-slate-300 italic">No notes</span>}
                                            </td>

                                            <td className="px-5 py-3.5 text-center">
                                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${
                                                    (source.ppmps_count || 0) > 0
                                                        ? 'bg-slate-100 text-slate-800 border border-slate-200'
                                                        : 'text-slate-400'
                                                }`}>
                                                    {source.ppmps_count || 0}
                                                </span>
                                            </td>

                                            <td className="px-5 py-3.5 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleActive(source)}
                                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer border ${
                                                        source.is_active
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                                                            : 'bg-slate-100 text-slate-500 border-slate-200 hover:bg-slate-200'
                                                    }`}
                                                    title={`Click to ${source.is_active ? 'deactivate' : 'activate'}`}
                                                >
                                                    {source.is_active ? (
                                                        <>
                                                            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                                            <span>Active</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <XCircle className="w-3 h-3 text-slate-400" />
                                                            <span>Inactive</span>
                                                        </>
                                                    )}
                                                </button>
                                            </td>

                                            <td className="px-5 py-3.5 text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEditModal(source)}
                                                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                                        title="Edit Fund Source"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => {
                                                            setDeleteModalSource(source);
                                                            setDeleteError('');
                                                        }}
                                                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                                        title="Delete Fund Source"
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div className="p-3.5 bg-slate-50/70 border-t border-slate-200">
                    <PaginationControl
                        currentPage={safePage}
                        totalPages={totalPages}
                        onPageChange={setCurrentPage}
                        perPage={perPage}
                        onPerPageChange={(val) => {
                            setPerPage(val);
                            setCurrentPage(1);
                        }}
                        totalEntries={totalEntries}
                        startIndex={startIndex}
                        endIndex={endIndex}
                        theme={isPacco ? 'teal' : 'blue'}
                        perPageOptions={[10, 25, 50, 100]}
                    />
                </div>
            </div>

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden animate-in zoom-in-95 duration-150">

                        <div className={`p-5 text-white flex items-center justify-between border-b ${
                            isPacco
                                ? 'bg-gradient-to-r from-slate-900 to-teal-950 border-teal-800'
                                : isBudgetOfficer
                                    ? 'bg-gradient-to-r from-slate-900 to-blue-950 border-blue-800'
                                    : 'bg-gradient-to-r from-slate-900 to-indigo-950 border-slate-800'
                        }`}>
                            <div className="flex items-center gap-2.5">
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                                    isPacco
                                        ? 'bg-teal-500/20 border-teal-400/30 text-teal-400'
                                        : 'bg-blue-500/20 border-blue-400/30 text-blue-400'
                                }`}>
                                    <Landmark className="w-4 h-4" />
                                </div>
                                <h3 className="text-sm font-bold">
                                    {editingSource
                                        ? (isPacco ? 'Edit Trust Fund Source' : isBudgetOfficer ? 'Edit Regular Fund Source' : 'Edit Source of Fund')
                                        : (isPacco ? 'Add New Trust Fund Source' : isBudgetOfficer ? 'Add New Regular Fund Source' : 'Add New Source of Fund')}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsModalOpen(false)}
                                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSave} className="p-6 space-y-4">
                            {modalError && (
                                <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-semibold flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                                    <span>{modalError}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Source of Fund Name <span className="text-rose-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    placeholder={isPacco ? "e.g. PENRO CY 2026 Trust Fund or National Subsidy" : "e.g. CY 2026 Special Health fund or 20% Development Fund"}
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                                />
                            </div>

                            <div className="grid grid-cols-3 gap-3">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Short Code
                                    </label>
                                    <input
                                        type="text"
                                        placeholder={isPacco ? "e.g. TF-PENRO" : "e.g. SHF"}
                                        value={formData.code}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                                        className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 uppercase"
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Category
                                    </label>
                                    {isPacco ? (
                                        <input
                                            type="text"
                                            readOnly
                                            value="Trust Fund"
                                            className="w-full px-2.5 py-2 text-xs font-semibold bg-slate-100 border border-slate-300 rounded-lg text-teal-800 cursor-not-allowed select-none"
                                        />
                                    ) : isBudgetOfficer ? (
                                        <select
                                            value={formData.category}
                                            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                            className="w-full px-2.5 py-2 text-xs font-semibold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="General Fund">General Fund</option>
                                            <option value="Special Fund">Special Fund</option>
                                        </select>
                                    ) : (
                                        <select
                                            value={formData.category}
                                            onChange={(e) => {
                                                const cat = e.target.value;
                                                setFormData({
                                                    ...formData,
                                                    category: cat,
                                                    workflow_route: cat === 'Trust Fund' ? 'pacco' : 'budget',
                                                });
                                            }}
                                            className="w-full px-2.5 py-2 text-xs font-semibold border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="General Fund">General Fund</option>
                                            <option value="Trust Fund">Trust Fund</option>
                                            <option value="Special Fund">Special Fund</option>
                                        </select>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Order
                                    </label>
                                    <input
                                        type="number"
                                        min={0}
                                        value={formData.display_order}
                                        onChange={(e) => setFormData({ ...formData, display_order: parseInt(e.target.value, 10) || 0 })}
                                        className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1.5">
                                    Automated Review Workflow Pipeline <span className="text-rose-500">*</span>
                                </label>
                                {isPacco ? (
                                    <div className="p-3 rounded-xl border border-teal-500 bg-teal-50/60 ring-2 ring-teal-500/20 text-left">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="font-bold text-xs text-teal-950 flex items-center gap-1.5">
                                                <span>PACCO Reviewer Route</span>
                                                <span className="text-[10px] font-bold bg-teal-200 text-teal-900 px-1.5 py-0.2 rounded">Trust Fund</span>
                                            </div>
                                            <CheckCircle2 className="w-4 h-4 text-teal-600" />
                                        </div>
                                        <div className="text-[10px] text-slate-500 mt-1.5">
                                            End User ➔ Head ➔ <strong>BAC-TWG</strong> ➔ <strong>PACCO Reviewer</strong> ➔ OPPMO ➔ Ready to Print
                                        </div>
                                    </div>
                                ) : isBudgetOfficer ? (
                                    <div className="p-3 rounded-xl border border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20 text-left">
                                        <div className="flex items-center justify-between gap-2">
                                            <div className="font-bold text-xs text-blue-950 flex items-center gap-1.5">
                                                <span>Budget Officer Route</span>
                                                <span className="text-[10px] font-bold bg-blue-200 text-blue-900 px-1.5 py-0.2 rounded">Appropriation</span>
                                            </div>
                                            <CheckCircle2 className="w-4 h-4 text-blue-600" />
                                        </div>
                                        <div className="text-[10px] text-slate-500 mt-1.5">
                                            End User ➔ Head ➔ <strong>BAC-TWG</strong> ➔ <strong>Budget Officer</strong> ➔ OPPMO ➔ Ready to Print
                                        </div>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        <label
                                            className={`p-3 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                                                formData.workflow_route === 'budget'
                                                    ? 'border-blue-500 bg-blue-50/60 ring-2 ring-blue-500/20'
                                                    : 'border-slate-200 bg-white hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="font-bold text-xs text-slate-900">
                                                    Budget Officer Route
                                                </div>
                                                <input
                                                    type="radio"
                                                    name="workflow_route"
                                                    value="budget"
                                                    checked={formData.workflow_route === 'budget'}
                                                    onChange={(e) => setFormData({ ...formData, workflow_route: e.target.value })}
                                                    className="text-blue-600 focus:ring-blue-500 mt-0.5"
                                                />
                                            </div>
                                            <div className="text-[10px] text-slate-500 mt-2">
                                                End User ➔ Head ➔ <strong>BAC-TWG</strong> ➔ <strong>Budget Officer</strong> ➔ OPPMO ➔ Ready to Print
                                            </div>
                                        </label>

                                        <label
                                            className={`p-3 rounded-xl border text-left cursor-pointer transition flex flex-col justify-between ${
                                                formData.workflow_route === 'pacco'
                                                    ? 'border-teal-500 bg-teal-50/60 ring-2 ring-teal-500/20'
                                                    : 'border-slate-200 bg-white hover:bg-slate-50'
                                            }`}
                                        >
                                            <div className="flex items-start justify-between gap-2">
                                                <div className="font-bold text-xs text-slate-900">
                                                    PACCO Reviewer Route
                                                </div>
                                                <input
                                                    type="radio"
                                                    name="workflow_route"
                                                    value="pacco"
                                                    checked={formData.workflow_route === 'pacco'}
                                                    onChange={(e) => setFormData({ ...formData, workflow_route: e.target.value })}
                                                    className="text-teal-600 focus:ring-teal-500 mt-0.5"
                                                />
                                            </div>
                                            <div className="text-[10px] text-slate-500 mt-2">
                                                End User ➔ Head ➔ <strong>BAC-TWG</strong> ➔ <strong>PACCO Reviewer</strong> ➔ OPPMO ➔ Ready to Print
                                            </div>
                                        </label>
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Description / Remarks <span className="text-slate-400 font-normal">(Optional)</span>
                                </label>
                                <textarea
                                    rows={2}
                                    placeholder="Brief description of this fund source, eligible items, or notes..."
                                    value={formData.description || ''}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                                />
                            </div>

                            <div className="flex items-center gap-2 pt-1">
                                <input
                                    type="checkbox"
                                    id="fund_is_active"
                                    checked={formData.is_active}
                                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                    className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                                />
                                <label htmlFor="fund_is_active" className="text-xs font-semibold text-slate-700 cursor-pointer select-none">
                                    Active for selection by End Users
                                </label>
                            </div>

                            <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-xs font-bold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-lg transition shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
                                >
                                    {saving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                    <span>{editingSource ? 'Update Fund Source' : 'Create Fund Source'}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {deleteModalSource && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full overflow-hidden p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                                <Trash2 className="w-5 h-5" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-slate-900">Delete Source of Fund</h3>
                                <p className="text-xs text-slate-500">
                                    Are you sure you want to delete "{deleteModalSource.name}"?
                                </p>
                            </div>
                        </div>

                        {deleteError && (
                            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs font-medium">
                                {deleteError}
                            </div>
                        )}

                        <div className="p-3 bg-slate-50 rounded-lg text-xs text-slate-600 border border-slate-200">
                            <strong>Note:</strong> Fund sources linked to existing PPMPs cannot be deleted to maintain historical audit integrity. Deactivate the fund source instead to hide it from new PPMPs.
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-2">
                            <button
                                type="button"
                                onClick={() => setDeleteModalSource(null)}
                                className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-lg transition"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={handleDelete}
                                disabled={deleting}
                                className="px-5 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-500 rounded-lg transition shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5"
                            >
                                {deleting && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                                <span>Delete Permanently</span>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {isPrintModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-xs animate-in fade-in duration-200">
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden">

                        <div className="p-4 bg-slate-900 text-white flex items-center justify-between border-b border-slate-800 no-print">
                            <div className="flex items-center gap-2.5">
                                <Printer className="w-5 h-5 text-indigo-400" />
                                <div>
                                    <h3 className="text-sm font-bold">Official Sources of Fund Report (PDF / Print View)</h3>
                                    <p className="text-[11px] text-slate-300">Ready for printing or PDF export</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    type="button"
                                    onClick={handlePrintDocument}
                                    className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition flex items-center gap-1.5 shadow-xs cursor-pointer"
                                >
                                    <Printer className="w-3.5 h-3.5" />
                                    <span>Print / Save as PDF</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsPrintModalOpen(false)}
                                    className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-8 bg-slate-100 custom-scrollbar">
                            <div className="bg-white p-8 rounded-xl shadow-md border border-slate-200 max-w-3xl mx-auto text-slate-800 space-y-6 print:p-0 print:shadow-none print:border-none">

                                <div className="text-center space-y-1 border-b-2 border-slate-900 pb-4">
                                    <div className="flex items-center justify-center gap-3">
                                        <img src="/images/logo.png" alt="Provincial Seal" className="w-12 h-12 object-contain" />
                                        <div className="text-center">
                                            <div className="text-[11px] uppercase tracking-widest text-slate-500 font-bold">Republic of the Philippines</div>
                                            <div className="text-base font-black tracking-wide text-slate-900 uppercase">Province of Davao del Sur</div>
                                            <div className="text-xs font-bold text-slate-700">
                                                {isPacco
                                                    ? "Office of the Provincial Accountant (PACCO)"
                                                    : isBudgetOfficer
                                                        ? "Provincial Budget Office (PBO)"
                                                        : "Provincial Accountant's Office & Provincial Budget Office"}
                                            </div>
                                        </div>
                                        <img src="/images/pmo.jpeg" alt="OPPMO Seal" className="w-12 h-12 object-contain rounded-full" />
                                    </div>
                                    <div className="pt-2">
                                        <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider">
                                            {isPacco
                                                ? "Official Master Catalog of Trust Funds"
                                                : isBudgetOfficer
                                                    ? "Official Master Catalog of Regular Appropriations"
                                                    : "Official Master Catalog of Sources of Fund"}
                                        </h4>
                                        <div className="text-[10px] text-slate-500">
                                            As of {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} • Total Entries: {filteredSources.length}
                                        </div>
                                    </div>
                                </div>

                                <div className={`grid gap-3 text-center text-xs ${isAdmin ? 'grid-cols-3' : 'grid-cols-2'}`}>
                                    <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
                                        <div className="text-[10px] font-bold text-slate-500 uppercase">
                                            {isPacco ? "Total Trust Funds" : isBudgetOfficer ? "Total Regular Funds" : "Total Catalog Entries"}
                                        </div>
                                        <div className="text-lg font-black text-slate-900 mt-0.5">{filteredSources.length}</div>
                                    </div>
                                    {isAdmin ? (
                                        <>
                                            <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
                                                <div className="text-[10px] font-bold text-blue-700 uppercase">Budget Route (General Funds)</div>
                                                <div className="text-lg font-black text-blue-900 mt-0.5">{generalCount}</div>
                                            </div>
                                            <div className="p-3 bg-teal-50 rounded-lg border border-teal-200">
                                                <div className="text-[10px] font-bold text-teal-800 uppercase">PACCO Route (Trust Funds)</div>
                                                <div className="text-lg font-black text-teal-900 mt-0.5">{trustCount}</div>
                                            </div>
                                        </>
                                    ) : (
                                        <div className={`p-3 rounded-lg border ${isPacco ? 'bg-teal-50 border-teal-200 text-teal-900' : 'bg-blue-50 border-blue-200 text-blue-900'}`}>
                                            <div className="text-[10px] font-bold uppercase">Active for Procurement</div>
                                            <div className="text-lg font-black mt-0.5">
                                                {filteredSources.filter(s => s.is_active).length}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <table className="w-full text-left text-xs border border-slate-300">
                                    <thead className="bg-slate-100 font-bold text-slate-700 border-b border-slate-300">
                                        <tr>
                                            <th className="p-2 border-r border-slate-300 w-10 text-center">#</th>
                                            <th className="p-2 border-r border-slate-300">Source of Fund Name</th>
                                            <th className="p-2 border-r border-slate-300 w-20">Code</th>
                                            <th className="p-2 border-r border-slate-300 w-28">Category</th>
                                            <th className="p-2 border-r border-slate-300 w-28">Review Pipeline</th>
                                            <th className="p-2 w-16 text-center">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {filteredSources.map((s, idx) => (
                                            <tr key={s.id} className="text-[11px]">
                                                <td className="p-2 border-r border-slate-200 text-center font-mono">{idx + 1}</td>
                                                <td className="p-2 border-r border-slate-200 font-semibold text-slate-900">{s.name}</td>
                                                <td className="p-2 border-r border-slate-200 font-mono text-slate-600">{s.code || '—'}</td>
                                                <td className="p-2 border-r border-slate-200 font-medium text-slate-700">{s.category || (s.workflow_route === 'pacco' ? 'Trust Fund' : 'General Fund')}</td>
                                                <td className="p-2 border-r border-slate-200 font-medium">
                                                    {s.workflow_route === 'pacco' ? 'PACCO Reviewer' : 'Budget Officer'}
                                                </td>
                                                <td className="p-2 text-center font-bold">
                                                    {s.is_active ? 'Active' : 'Inactive'}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>

                                <div className="grid grid-cols-2 gap-8 pt-8 border-t border-slate-200 text-xs">
                                    <div className="space-y-8">
                                        <div className="text-[11px] font-bold text-slate-600">Prepared by:</div>
                                        <div>
                                            <div className="font-black text-slate-900 underline uppercase">
                                                {isPacco ? "PACCO Review Specialist" : isBudgetOfficer ? "Budget Review Specialist" : "System Administrator"}
                                            </div>
                                            <div className="text-[11px] text-slate-500">
                                                {isPacco ? "Provincial Accounting Office" : isBudgetOfficer ? "Provincial Budget Office" : "Provincial E-Procurement System"}
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-8 text-right">
                                        <div className="text-[11px] font-bold text-slate-600">Certified by:</div>
                                        <div>
                                            <div className="font-black text-slate-900 underline uppercase">
                                                {isPacco
                                                    ? "MAY FERNANDO-UY, CPA"
                                                    : isBudgetOfficer
                                                        ? "PROVINCIAL BUDGET OFFICER"
                                                        : "MAY FERNANDO-UY, CPA"}
                                            </div>
                                            <div className="text-[11px] text-slate-500">
                                                {isPacco ? "Provincial Accountant" : isBudgetOfficer ? "Provincial Budget Office" : "Provincial Accountant"}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
