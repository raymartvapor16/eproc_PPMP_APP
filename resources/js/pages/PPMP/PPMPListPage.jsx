import React, { useState, useEffect, useMemo } from 'react';
import { ppmpService } from '../../services/api';
import { StatusBadge, formatCurrency, formatDate } from '../../components/UI/StatusBadge';
import { PaginationControl } from '../../components/UI/PaginationControl';
import { isAwaitingReceive } from '../../utils/workflowHelpers';
import { getStandardFiscalYears } from '../../utils/fiscalYears';
import {
    getPpmpStartOfActivity,
    getPimsReminderInfo
} from '../../components/Dashboard/PimsPublishReminderCard';
import { Search, Filter, Plus, FileSpreadsheet, Eye, Inbox, Loader2, ChevronLeft, ChevronRight, Clock, AlertTriangle } from 'lucide-react';

export const PPMPListPage = ({ user, onSelectPpmp, onNavigate }) => {
    const [ppmps, setPpmps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [yearFilter, setYearFilter] = useState('');
    const [availableFiscalYears, setAvailableFiscalYears] = useState([]);
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(5); // 5 and 10 entries show only
    const [totalEntries, setTotalEntries] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [receivingUuids, setReceivingUuids] = useState({});
    const [openingUuids, setOpeningUuids] = useState({});

    const handleOpenDetails = async (uuid) => {
        if (!onSelectPpmp) return;
        setOpeningUuids(prev => ({ ...prev, [uuid]: true }));
        try {
            await onSelectPpmp(uuid);
        } finally {
            setOpeningUuids(prev => ({ ...prev, [uuid]: false }));
        }
    };

    const handleReceive = async (uuid) => {
        setReceivingUuids(prev => ({ ...prev, [uuid]: true }));
        try {
            await ppmpService.receive(uuid);
            await fetchPpmps();
            window.dispatchEvent(new CustomEvent('notifications:reload'));
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to mark document as received.');
        } finally {
            setReceivingUuids(prev => ({ ...prev, [uuid]: false }));
        }
    };

    const fetchPpmps = async () => {
        setLoading(true);
        try {
            const params = {
                page,
                per_page: perPage,
            };
            if (search) params.search = search;
            if (statusFilter) params.status = statusFilter;
            if (yearFilter) params.fiscal_year = yearFilter;

            const res = await ppmpService.getAll(params);
            if (res.data?.available_fiscal_years) {
                setAvailableFiscalYears(res.data.available_fiscal_years);
            }
            if (res.data && res.data.data !== undefined) {
                // Laravel LengthAwarePaginator response
                setPpmps(res.data.data);
                setTotalEntries(res.data.total || 0);
                setTotalPages(res.data.last_page || 1);
            } else {
                const list = Array.isArray(res.data) ? res.data : [];
                setPpmps(list);
                setTotalEntries(list.length);
                setTotalPages(Math.ceil(list.length / perPage) || 1);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timeout = setTimeout(fetchPpmps, 300);
        return () => clearTimeout(timeout);
    }, [search, statusFilter, yearFilter, page, perPage]);

    useEffect(() => {
        const handleDataReload = () => {
            fetchPpmps();
        };
        window.addEventListener('app:data_reload', handleDataReload);
        return () => window.removeEventListener('app:data_reload', handleDataReload);
    }, [search, statusFilter, yearFilter, page, perPage]);

    const yearOptions = useMemo(() => {
        return getStandardFiscalYears([yearFilter, ...ppmps.map(p => p.fiscal_year), ...availableFiscalYears]);
    }, [ppmps, availableFiscalYears, yearFilter]);

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
                <div>
                    <h1 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-blue-600" />
                        Project Procurement Management Plans (PPMPs)
                    </h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Overview of procurement packages, workflow stages, and budgetary status
                    </p>
                </div>

                {user.role === 'end_user' && (
                    <button
                        onClick={() => onNavigate('create')}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider shadow-sm transition self-start sm:self-auto"
                    >
                        <Plus className="w-4 h-4" /> Prepare PPMP
                    </button>
                )}
            </div>

            {/* Filter & Search Toolbar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Search */}
                <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setPage(1);
                        }}
                        placeholder="Search PPMP # or Title..."
                        className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                </div>

                {/* Status Filter */}
                <select
                    value={statusFilter}
                    onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setPage(1);
                    }}
                    className="text-xs p-2 border border-slate-300 rounded-md bg-white focus:outline-none"
                >
                    <option value="">All Statuses</option>
                    <option value="DRAFT">Draft</option>
                    <option value="HEAD_PENDING">Pending Head Approval</option>
                    <option value="HEAD_APPROVED">Head Endorsed</option>
                    <option value="BUDGET_OFFICER_REVIEW">Budget Officer Review</option>
                    <option value="OPPMO_REVIEW">OPPMO Review</option>
                    <option value="TWG_REVIEW">TWG Review</option>
                    <option value="READY_TO_PRINT">Ready to Print</option>
                    <option value="HEAD_RETURNED">Returned by Head</option>
                    <option value="BUDGET_OFFICER_RETURNED">Returned by Budget</option>
                    <option value="OPPMO_RETURNED">Returned by OPPMO</option>
                    <option value="TWG_RETURNED">Returned by TWG</option>
                </select>

                {/* Fiscal Year Filter */}
                <select
                    value={yearFilter}
                    onChange={(e) => {
                        setYearFilter(e.target.value);
                        setPage(1);
                    }}
                    className="text-xs p-2 border border-slate-300 rounded-md bg-white focus:outline-none"
                >
                    <option value="">All Fiscal Years</option>
                    {yearOptions.map((year) => (
                        <option key={year} value={year}>CY {year}</option>
                    ))}
                </select>
            </div>

            {/* PPMP List Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                            <tr>
                                <th className="p-3.5">Tracker No.</th>
                                <th className="p-3.5">Title / General Description</th>
                                <th className="p-3.5">Office / Unit</th>
                                <th className="p-3.5">Fiscal Year</th>
                                <th className="p-3.5">Total Allocation</th>
                                <th className="p-3.5">Status</th>
                                <th className="p-3.5 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-400">
                                        Loading PPMP documents...
                                    </td>
                                </tr>
                            ) : ppmps.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="p-8 text-center text-slate-400 italic">
                                        No PPMP records match your criteria.
                                    </td>
                                </tr>
                            ) : (
                                ppmps.map((ppmp) => (
                                    <tr key={ppmp.id} className="hover:bg-slate-50 transition">
                                        <td className="p-3.5">
                                            <div className="font-mono font-bold text-blue-900">
                                                {ppmp.tracking_number || ppmp.ppmp_number}
                                            </div>
                                            {ppmp.ppmp_number !== undefined && ppmp.ppmp_number !== null && (
                                                <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                    <span className="font-mono text-[11px] text-slate-600 font-semibold" title="PPMP Number">
                                                        PPMP No. {ppmp.ppmp_number}
                                                    </span>
                                                    {!ppmp.parent_id ? (
                                                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold tracking-tight uppercase border bg-blue-100 text-blue-800 border-blue-300">
                                                            Annual
                                                        </span>
                                                    ) : (
                                                        <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold tracking-tight uppercase border ${
                                                            ppmp.amendment_type === 'AMENDMENT'
                                                                ? 'bg-purple-100 text-purple-800 border-purple-300'
                                                                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                                        }`}>
                                                            {ppmp.amendment_type === 'AMENDMENT' ? 'Amended' : 'Supplemental'}
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-3.5 font-medium text-slate-800 max-w-sm" title={ppmp.title}>
                                            <div className="font-semibold text-slate-900 truncate">{ppmp.title}</div>
                                            {(() => {
                                                const schedule = getPpmpStartOfActivity(ppmp);
                                                if (!schedule) return null;
                                                const rem = getPimsReminderInfo(schedule);
                                                if (!rem) return null;
                                                return (
                                                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                                        <span
                                                            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${
                                                                rem.isUrgent
                                                                    ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse'
                                                                    : 'bg-amber-50 text-amber-900 border border-amber-200'
                                                            }`}
                                                            title={rem.message}
                                                        >
                                                            {rem.isUrgent ? <AlertTriangle className="w-2.5 h-2.5 text-rose-600" /> : <Clock className="w-2.5 h-2.5 text-amber-600" />}
                                                            PIMS: Start {schedule.summaryLabel} {rem.isNearEnd && '(Near End of Month)'}
                                                        </span>
                                                    </div>
                                                );
                                            })()}
                                        </td>
                                        <td className="p-3.5 text-slate-600 max-w-xs truncate">
                                            {ppmp.office?.name || 'Provincial Office'}
                                        </td>
                                        <td className="p-3.5 text-slate-600">
                                            CY {ppmp.fiscal_year} ({ppmp.plan_type})
                                        </td>
                                        <td className="p-3.5 font-mono font-bold text-slate-900">
                                            {formatCurrency(ppmp.total_budget)}
                                        </td>
                                        <td className="p-3.5">
                                            <div className="flex flex-col items-start gap-1">
                                                <StatusBadge status={ppmp.status} />
                                                {ppmp.amendment_status === 'PENDING_APPROVAL' && (
                                                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                                                        Pending {(ppmp.requested_amendment_type || ppmp.amendment_type) === 'SUPPLEMENTAL' ? 'Supplemental' : 'Amendment'}
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3.5 text-right">
                                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                                                {isAwaitingReceive(ppmp, user) ? (
                                                    <button
                                                        onClick={() => handleReceive(ppmp.uuid)}
                                                        disabled={receivingUuids[ppmp.uuid]}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded font-semibold transition text-xs shadow-xs disabled:opacity-50 cursor-pointer"
                                                        title="Click to acknowledge receipt of this document before viewing details"
                                                    >
                                                        {receivingUuids[ppmp.uuid] ? (
                                                            <>
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                <span>Receiving...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Inbox className="w-3.5 h-3.5" />
                                                                <span>Receive</span>
                                                            </>
                                                        )}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => handleOpenDetails(ppmp.uuid)}
                                                        disabled={openingUuids[ppmp.uuid]}
                                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded font-semibold transition text-xs shadow-xs cursor-pointer disabled:opacity-75"
                                                    >
                                                        {openingUuids[ppmp.uuid] ? (
                                                            <>
                                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                                <span>Opening...</span>
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Eye className="w-3.5 h-3.5" />
                                                                <span>Open Details</span>
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination Controls & Entries Per Page */}
                {!loading && totalEntries > 0 && (() => {
                    const safePage = Math.min(page, totalPages);
                    const startIndex = (safePage - 1) * perPage;
                    const endIndex = Math.min(safePage * perPage, totalEntries);

                    return (
                        <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70">
                            <PaginationControl
                                currentPage={safePage}
                                totalPages={totalPages}
                                onPageChange={setPage}
                                perPage={perPage}
                                onPerPageChange={(val) => {
                                    setPerPage(val);
                                    setPage(1);
                                }}
                                totalEntries={totalEntries}
                                startIndex={startIndex}
                                endIndex={endIndex}
                            />
                        </div>
                    );
                })()}
            </div>
        </div>
    );
};
