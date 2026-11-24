import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
    Compass,
    Plus,
    Search,
    Edit2,
    Trash2,
    CheckCircle2,
    XCircle,
    AlertCircle,
    Info,
    RefreshCw,
    X,
    Layers,
    ShieldAlert,
    Check,
    Filter,
    ChevronLeft,
    ChevronRight,
    TrendingUp,
    FileSpreadsheet,
    FileText,
    Bookmark,
} from 'lucide-react';
import { programNameService } from '../../services/api';

const STANDARD_SECTORS = [
    'I. GENERAL PUBLIC SERVICES',
    'II. SPORTS DEVELOPMENT',
    'III. HEALTH SERVICES',
    'IV. PUBLIC EMPLOYMENT SERVICES',
    'V. HOUSING & COMMUNITY DEVELOPMENT',
    'VI. SOCIAL SERVICES',
    'VII. ECONOMIC SERVICES',
    'VIII. OTHER PURPOSES',
];

export const ProgramNamesManagement = () => {

    const [programs, setPrograms] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [stats, setStats] = useState(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [sectorFilter, setSectorFilter] = useState('ALL');
    const [statusFilter, setStatusFilter] = useState('ALL');
    const [currentPage, setCurrentPage] = useState(1);
    const [perPage, setPerPage] = useState(25);
    const [paginationMeta, setPaginationMeta] = useState({
        total: 0,
        from: 0,
        to: 0,
        last_page: 1,
    });

    const [isFormModalOpen, setIsFormModalOpen] = useState(false);
    const [editingProgram, setEditingProgram] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        responsibility_center: '',
        sector: 'I. GENERAL PUBLIC SERVICES',
        is_active: true,
        display_order: 0,
    });
    const [saving, setSaving] = useState(false);
    const [modalError, setModalError] = useState('');

    const [deleteModalProgram, setDeleteModalProgram] = useState(null);
    const [deleting, setDeleting] = useState(false);
    const [deleteError, setDeleteError] = useState('');

    const [togglingId, setTogglingId] = useState(null);

    const [feedback, setFeedback] = useState({ type: '', text: '' });

    const showFeedback = (type, text) => {
        setFeedback({ type, text });
        setTimeout(() => setFeedback({ type: '', text: '' }), 5000);
    };

    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchQuery.trim());
            setCurrentPage(1);
        }, 300);
        return () => clearTimeout(handler);
    }, [searchQuery]);

    const fetchStats = async () => {
        try {
            const res = await programNameService.getStats();
            setStats(res.data);
        } catch (err) {
            console.error('Failed to load program name stats:', err);
        }
    };

    const fetchPrograms = useCallback(async (isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);

        try {
            const params = {
                page: currentPage,
                per_page: perPage,
                search: debouncedSearch || undefined,
                sector: sectorFilter !== 'ALL' ? sectorFilter : undefined,
                status: statusFilter !== 'ALL' ? statusFilter.toLowerCase() : undefined,
            };

            const res = await programNameService.getAll(params);
            const data = res.data;

            if (data?.data && Array.isArray(data.data)) {
                setPrograms(data.data);
                setPaginationMeta({
                    total: data.total || 0,
                    from: data.from || 0,
                    to: data.to || 0,
                    last_page: data.last_page || 1,
                });
            } else if (Array.isArray(data)) {
                setPrograms(data);
                setPaginationMeta({
                    total: data.length,
                    from: 1,
                    to: data.length,
                    last_page: 1,
                });
            }
        } catch (err) {
            console.error('Failed to load program names:', err);
            showFeedback('error', 'Failed to load program names. Please try again.');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [currentPage, perPage, debouncedSearch, sectorFilter, statusFilter]);

    useEffect(() => {
        fetchStats();
    }, []);

    useEffect(() => {
        fetchPrograms();
    }, [fetchPrograms]);

    const handleOpenCreateModal = () => {
        setEditingProgram(null);
        setFormData({
            name: '',
            responsibility_center: '',
            sector: sectorFilter !== 'ALL' ? sectorFilter : 'I. GENERAL PUBLIC SERVICES',
            is_active: true,
            display_order: 0,
        });
        setModalError('');
        setIsFormModalOpen(true);
    };

    const handleOpenEditModal = (prog) => {
        setEditingProgram(prog);
        setFormData({
            name: prog.name || '',
            responsibility_center: prog.responsibility_center || '',
            sector: prog.sector || 'I. GENERAL PUBLIC SERVICES',
            is_active: Boolean(prog.is_active),
            display_order: prog.display_order ?? 0,
        });
        setModalError('');
        setIsFormModalOpen(true);
    };

    const handleSaveForm = async (e) => {
        e.preventDefault();
        setSaving(true);
        setModalError('');

        try {
            const payload = {
                name: formData.name.trim(),
                responsibility_center: formData.responsibility_center.trim() || null,
                sector: formData.sector,
                is_active: formData.is_active,
                display_order: parseInt(formData.display_order, 10) || 0,
            };

            if (editingProgram) {
                await programNameService.update(editingProgram.id, payload);
                showFeedback('success', `Program "${payload.name}" updated successfully.`);
            } else {
                await programNameService.create(payload);
                showFeedback('success', `Program "${payload.name}" created successfully.`);
            }

            setIsFormModalOpen(false);
            fetchPrograms(true);
            fetchStats();
        } catch (err) {
            console.error('Save error:', err);
            const msg = err.response?.data?.message ||
                err.response?.data?.errors?.name?.[0] ||
                'Failed to save program name. Please check inputs.';
            setModalError(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleToggleStatus = async (prog) => {
        setTogglingId(prog.id);
        try {
            const res = await programNameService.toggleStatus(prog.id);
            const newStatus = res.data?.data?.is_active ?? !prog.is_active;

            setPrograms(prev => prev.map(item =>
                item.id === prog.id ? { ...item, is_active: newStatus } : item
            ));

            showFeedback('success', `Program marked as ${newStatus ? 'active' : 'inactive'}.`);
            fetchStats();
        } catch (err) {
            console.error('Toggle error:', err);
            showFeedback('error', 'Failed to toggle status.');
        } finally {
            setTogglingId(null);
        }
    };

    const handleOpenDeleteModal = (prog) => {
        setDeleteModalProgram(prog);
        setDeleteError('');
    };

    const handleConfirmDelete = async () => {
        if (!deleteModalProgram) return;
        setDeleting(true);
        setDeleteError('');

        try {
            await programNameService.delete(deleteModalProgram.id);
            showFeedback('success', `Program "${deleteModalProgram.name}" deleted successfully.`);
            setDeleteModalProgram(null);
            fetchPrograms(true);
            fetchStats();
        } catch (err) {
            console.error('Delete error:', err);
            const msg = err.response?.data?.message || 'Failed to delete program.';
            setDeleteError(msg);
        } finally {
            setDeleting(false);
        }
    };

    return (
        <div className="space-y-6">

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
                <div>
                    <div className="flex items-center gap-2">
                        <div className="p-2 bg-blue-100 text-blue-700 rounded-xl">
                            <Compass className="w-6 h-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-slate-900 tracking-tight">
                                Program Names Directory
                            </h2>
                            <p className="text-xs text-slate-500 font-medium">
                                Manage official provincial programs, sectors, and responsibility centers linked to PPMPs.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => {
                            fetchStats();
                            fetchPrograms(true);
                        }}
                        disabled={refreshing || loading}
                        className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl shadow-2xs transition cursor-pointer disabled:opacity-50"
                        title="Refresh data"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin text-blue-600' : ''}`} />
                        <span>Refresh</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleOpenCreateModal}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm hover:shadow transition cursor-pointer"
                    >
                        <Plus className="w-4 h-4" />
                        <span>Add Program Name</span>
                    </button>
                </div>
            </div>

            {feedback.text && (
                <div className={`p-3.5 rounded-xl text-xs font-semibold flex items-center justify-between border animate-in fade-in slide-in-from-top-1 duration-150 ${
                    feedback.type === 'error'
                        ? 'bg-rose-50 text-rose-800 border-rose-200'
                        : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                }`}>
                    <div className="flex items-center gap-2">
                        {feedback.type === 'error' ? (
                            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                        ) : (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        )}
                        <span>{feedback.text}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setFeedback({ type: '', text: '' })}
                        className="text-slate-400 hover:text-slate-600 p-1"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Total Programs</span>
                        <Layers className="w-4 h-4 text-blue-500" />
                    </div>
                    <div className="text-2xl font-black text-slate-900">
                        {stats ? stats.total.toLocaleString() : '...'}
                    </div>
                    <div className="text-[10px] text-slate-500 font-medium">
                        Standard Provincial Registry
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Active Programs</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    </div>
                    <div className="text-2xl font-black text-emerald-600">
                        {stats ? stats.active.toLocaleString() : '...'}
                    </div>
                    <div className="text-[10px] text-emerald-700 font-medium">
                        Available in PPMP dropdowns
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                        <span className="text-[11px] font-bold uppercase tracking-wider">Inactive</span>
                        <XCircle className="w-4 h-4 text-slate-400" />
                    </div>
                    <div className="text-2xl font-black text-slate-500">
                        {stats ? stats.inactive.toLocaleString() : '...'}
                    </div>
                    <div className="text-[10px] text-slate-400 font-medium">
                        Hidden from new PPMPs
                    </div>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
                    <div className="flex items-center justify-between text-slate-400">
                        <span className="text-[11px] font-bold uppercase tracking-wider">PPMPs Linked</span>
                        <TrendingUp className="w-4 h-4 text-purple-500" />
                    </div>
                    <div className="text-2xl font-black text-purple-600">
                        {stats ? stats.total_ppmps_linked.toLocaleString() : '...'}
                    </div>
                    <div className="text-[10px] text-purple-700 font-medium">
                        Normalized relationships
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">

                    <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by program name, responsibility center, or sector..."
                            className="w-full text-xs pl-9 pr-8 py-2 bg-slate-50 hover:bg-white focus:bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 transition"
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                onClick={() => setSearchQuery('')}
                                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl text-xs font-bold text-slate-600 border border-slate-200">
                            {['ALL', 'ACTIVE', 'INACTIVE'].map((st) => (
                                <button
                                    key={st}
                                    type="button"
                                    onClick={() => {
                                        setStatusFilter(st);
                                        setCurrentPage(1);
                                    }}
                                    className={`px-2.5 py-1 rounded-lg transition cursor-pointer text-[11px] ${
                                        statusFilter === st
                                            ? 'bg-white text-blue-700 shadow-2xs font-extrabold'
                                            : 'hover:text-slate-900'
                                    }`}
                                >
                                    {st}
                                </button>
                            ))}
                        </div>

                        <select
                            value={perPage}
                            onChange={(e) => {
                                setPerPage(Number(e.target.value));
                                setCurrentPage(1);
                            }}
                            className="text-xs font-semibold py-1.5 px-2 bg-slate-50 border border-slate-300 rounded-xl text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            title="Rows per page"
                        >
                            <option value={15}>15 rows</option>
                            <option value={25}>25 rows</option>
                            <option value={50}>50 rows</option>
                            <option value={100}>100 rows</option>
                        </select>
                    </div>
                </div>

                <div
                    className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs font-bold"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    <span className="text-[10px] text-slate-400 uppercase tracking-wider shrink-0 mr-1 flex items-center gap-1">
                        <Filter className="w-3 h-3" />
                        Sector:
                    </span>
                    <button
                        type="button"
                        onClick={() => {
                            setSectorFilter('ALL');
                            setCurrentPage(1);
                        }}
                        className={`px-3 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer whitespace-nowrap shrink-0 ${
                            sectorFilter === 'ALL'
                                ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                    >
                        ALL SECTORS
                    </button>
                    {STANDARD_SECTORS.map((sec) => (
                        <button
                            key={sec}
                            type="button"
                            onClick={() => {
                                setSectorFilter(sec);
                                setCurrentPage(1);
                            }}
                            className={`px-3 py-1 rounded-full text-[11px] font-bold border transition cursor-pointer whitespace-nowrap shrink-0 ${
                                sectorFilter === sec
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                            }`}
                        >
                            {sec.replace(/^(I|II|III|IV|V|VI|VII|VIII)\.\s*/, '')}
                        </button>
                    ))}
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                        <thead>
                            <tr className="bg-slate-100 text-slate-700 font-extrabold uppercase tracking-wider text-[10px] border-b border-slate-200">
                                <th className="py-3 px-4 w-12 text-center">#</th>
                                <th className="py-3 px-4 min-w-[340px]">Program Name</th>
                                <th className="py-3 px-4 min-w-[140px]">Resp. Center</th>
                                <th className="py-3 px-4 min-w-[200px]">Sector</th>
                                <th className="py-3 px-4 w-28 text-center">Linked PPMPs</th>
                                <th className="py-3 px-4 w-24 text-center">Status</th>
                                <th className="py-3 px-4 w-28 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-slate-400">
                                        <div className="inline-flex items-center gap-2">
                                            <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                                            <span>Loading program names...</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : programs.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-slate-400">
                                        <div className="space-y-1">
                                            <Compass className="w-8 h-8 mx-auto text-slate-300" />
                                            <p className="font-semibold text-slate-600">No program names found.</p>
                                            <p className="text-xs text-slate-400">
                                                Try adjusting your search keywords or filter criteria.
                                            </p>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                programs.map((prog, index) => {
                                    const rowNum = (paginationMeta.from || 1) + index;
                                    const isToggling = togglingId === prog.id;

                                    return (
                                        <tr
                                            key={prog.id}
                                            className="hover:bg-blue-50/40 transition-colors group"
                                        >
                                            <td className="py-3 px-4 text-center text-slate-400 font-mono text-[11px]">
                                                {rowNum}
                                            </td>

                                            <td className="py-3 px-4">
                                                <div className="font-bold text-slate-900 text-xs leading-snug">
                                                    {prog.name}
                                                </div>
                                            </td>

                                            <td className="py-3 px-4">
                                                {prog.responsibility_center ? (
                                                    <span className="font-mono text-xs font-extrabold text-blue-900 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg">
                                                        {prog.responsibility_center}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-300 italic text-[11px]">None</span>
                                                )}
                                            </td>

                                            <td className="py-3 px-4">
                                                <span className="text-[11px] font-semibold text-slate-700">
                                                    {prog.sector}
                                                </span>
                                            </td>

                                            <td className="py-3 px-4 text-center">
                                                {prog.ppmps_count > 0 ? (
                                                    <span className="inline-flex items-center gap-1 font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-full text-[11px]">
                                                        <FileText className="w-3 h-3" />
                                                        {prog.ppmps_count} PPMP{prog.ppmps_count !== 1 ? 's' : ''}
                                                    </span>
                                                ) : (
                                                    <span className="text-slate-400 text-[11px]">-</span>
                                                )}
                                            </td>

                                            <td className="py-3 px-4 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => handleToggleStatus(prog)}
                                                    disabled={isToggling}
                                                    className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border transition cursor-pointer select-none ${
                                                        prog.is_active
                                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100'
                                                            : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
                                                    }`}
                                                    title="Click to toggle Active / Inactive"
                                                >
                                                    {prog.is_active ? (
                                                        <>
                                                            <Check className="w-3 h-3" />
                                                            ACTIVE
                                                        </>
                                                    ) : (
                                                        <>
                                                            <X className="w-3 h-3" />
                                                            INACTIVE
                                                        </>
                                                    )}
                                                </button>
                                            </td>

                                            <td className="py-3 px-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenEditModal(prog)}
                                                        className="p-1.5 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition cursor-pointer"
                                                        title="Edit Program"
                                                    >
                                                        <Edit2 className="w-3.5 h-3.5" />
                                                    </button>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleOpenDeleteModal(prog)}
                                                        className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                                                        title="Delete Program"
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

                <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-600">
                    <div>
                        Showing <span className="font-bold text-slate-900">{paginationMeta.from || 0}</span> to{' '}
                        <span className="font-bold text-slate-900">{paginationMeta.to || 0}</span> of{' '}
                        <span className="font-bold text-slate-900">{paginationMeta.total || 0}</span> programs
                    </div>

                    <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <button
                            type="button"
                            disabled={currentPage <= 1 || loading}
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            Previous
                        </button>

                        <span className="px-2 font-bold text-slate-700">
                            Page {currentPage} of {paginationMeta.last_page || 1}
                        </span>

                        <button
                            type="button"
                            disabled={currentPage >= paginationMeta.last_page || loading}
                            onClick={() => setCurrentPage(prev => Math.min(paginationMeta.last_page, prev + 1))}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold disabled:opacity-40 disabled:cursor-not-allowed transition cursor-pointer shadow-2xs"
                        >
                            Next
                            <ChevronRight className="w-3.5 h-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {isFormModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl max-w-lg w-full border border-slate-200 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150">
                        <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg">
                                    <Compass className="w-4 h-4" />
                                </div>
                                <h3 className="font-black text-slate-900 text-sm">
                                    {editingProgram ? 'Edit Program Name' : 'Create New Program Name'}
                                </h3>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsFormModalOpen(false)}
                                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <form onSubmit={handleSaveForm} className="p-5 space-y-4">
                            {modalError && (
                                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-semibold flex items-center gap-2">
                                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                    <span>{modalError}</span>
                                </div>
                            )}

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Program Name <span className="text-rose-600">*</span>
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    placeholder="e.g. SUPPORT TO LOCAL FINANCE COMMITTEE"
                                    className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold"
                                />
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Responsibility Center
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.responsibility_center}
                                        onChange={(e) => setFormData({ ...formData, responsibility_center: e.target.value })}
                                        placeholder="e.g. 1999-25"
                                        className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                    />
                                    <span className="text-[10px] text-slate-400">Optional organizational code</span>
                                </div>

                                <div>
                                    <label className="block text-xs font-bold text-slate-700 mb-1">
                                        Display Order
                                    </label>
                                    <input
                                        type="number"
                                        value={formData.display_order}
                                        onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
                                        className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-slate-700 mb-1">
                                    Sector Classification <span className="text-rose-600">*</span>
                                </label>
                                <select
                                    value={formData.sector}
                                    onChange={(e) => setFormData({ ...formData, sector: e.target.value })}
                                    className="w-full text-xs p-2.5 bg-white border border-slate-300 rounded-xl text-slate-900 font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {STANDARD_SECTORS.map((sec) => (
                                        <option key={sec} value={sec}>
                                            {sec}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="pt-2">
                                <label className="flex items-center gap-2 cursor-pointer select-none">
                                    <input
                                        type="checkbox"
                                        checked={formData.is_active}
                                        onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                                    />
                                    <span className="text-xs font-bold text-slate-700">
                                        Active (available for selection in PPMP create & edit dropdowns)
                                    </span>
                                </label>
                            </div>

                            <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setIsFormModalOpen(false)}
                                    disabled={saving}
                                    className="px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                                >
                                    {saving ? (
                                        <>
                                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Check className="w-3.5 h-3.5" />
                                            {editingProgram ? 'Update Program' : 'Save Program'}
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {deleteModalProgram && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
                    <div className="bg-white rounded-2xl max-w-md w-full border border-slate-200 shadow-2xl overflow-hidden p-5 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-rose-100 text-rose-700 rounded-xl shrink-0">
                                <ShieldAlert className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="font-black text-slate-900 text-sm">
                                    Delete Program Name
                                </h3>
                                <p className="text-xs text-slate-500">
                                    Are you sure you want to permanently delete this program?
                                </p>
                            </div>
                        </div>

                        {deleteError && (
                            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-800 font-semibold flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                                <span>{deleteError}</span>
                            </div>
                        )}

                        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                            <div className="font-bold text-slate-900">{deleteModalProgram.name}</div>
                            {deleteModalProgram.responsibility_center && (
                                <div className="text-[11px] text-slate-500 font-mono">
                                    Resp. Center: {deleteModalProgram.responsibility_center}
                                </div>
                            )}
                            <div className="text-[11px] text-slate-600 font-semibold">
                                Sector: {deleteModalProgram.sector}
                            </div>
                        </div>

                        {deleteModalProgram.ppmps_count > 0 && (
                            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 space-y-1">
                                <div className="font-bold flex items-center gap-1.5 text-amber-800">
                                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                                    Deletion Protected
                                </div>
                                <p className="text-[11px] text-amber-800 leading-relaxed">
                                    This program is currently linked to <strong>{deleteModalProgram.ppmps_count} PPMP record(s)</strong>.
                                    Database integrity protects it from deletion. You can deactivate it instead so it is hidden from future selection without breaking existing procurement records.
                                </p>
                            </div>
                        )}

                        <div className="pt-2 flex items-center justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => setDeleteModalProgram(null)}
                                disabled={deleting}
                                className="px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 rounded-xl transition cursor-pointer"
                            >
                                Cancel
                            </button>

                            {deleteModalProgram.ppmps_count > 0 ? (
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleToggleStatus(deleteModalProgram);
                                        setDeleteModalProgram(null);
                                    }}
                                    className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition cursor-pointer"
                                >
                                    Deactivate Instead
                                </button>
                            ) : (
                                <button
                                    type="button"
                                    onClick={handleConfirmDelete}
                                    disabled={deleting}
                                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-xs transition cursor-pointer disabled:opacity-50"
                                >
                                    {deleting ? 'Deleting...' : 'Confirm Delete'}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
