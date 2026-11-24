import React, { useState, useEffect, useMemo } from 'react';
import { ppmpService } from '../../services/api';
import { StatusBadge, formatCurrency, formatDate } from '../../components/UI/StatusBadge';
import { PaginationControl } from '../../components/UI/PaginationControl';
import {
    isAwaitingReceive,
    getSupplementalKindInfo,
    isInfrastructurePpmp,
    getPpmpProjectTypeLabel,
} from '../../utils/workflowHelpers';
import { getStandardFiscalYears } from '../../utils/fiscalYears';
import {
    getPpmpStartOfActivity,
    getPimsReminderInfo,
} from '../../components/Dashboard/PimsPublishReminderCard';
import { ExpandableText, ExpandableFundBadge } from '../../components/UI/ExpandableCell';
import { AdminEditStatusModal } from '../../components/PPMP/AdminEditStatusModal';
import {
    Search,
    Plus,
    FileSpreadsheet,
    Eye,
    Inbox,
    Loader2,
    Clock,
    AlertTriangle,
    Package,
    HardHat,
} from 'lucide-react';

export const PPMPListPage = ({ user, onSelectPpmp, onNavigate }) => {
    const [ppmps, setPpmps] = useState([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [yearFilter, setYearFilter] = useState('');
    const [availableFiscalYears, setAvailableFiscalYears] = useState([]);

    const [categoryTab, setCategoryTab] = useState('goods_consulting');

    const [goodsPage, setGoodsPage] = useState(1);
    const [goodsPerPage, setGoodsPerPage] = useState(5);
    const [infraPage, setInfraPage] = useState(1);
    const [infraPerPage, setInfraPerPage] = useState(5);

    const [receivingUuids, setReceivingUuids] = useState({});
    const [openingUuids, setOpeningUuids] = useState({});
    const [editingStatusPpmp, setEditingStatusPpmp] = useState(null);

    const isAdmin = ['admin', 'super_admin'].includes(user?.role);

    const handleOpenDetails = async (uuid) => {
        if (!onSelectPpmp) return;
        setOpeningUuids((prev) => ({ ...prev, [uuid]: true }));
        try {
            await onSelectPpmp(uuid);
        } finally {
            setOpeningUuids((prev) => ({ ...prev, [uuid]: false }));
        }
    };

    const handleReceive = async (uuid) => {
        setReceivingUuids((prev) => ({ ...prev, [uuid]: true }));
        try {
            await ppmpService.receive(uuid);
            await fetchPpmps();
            window.dispatchEvent(new CustomEvent('notifications:reload'));
        } catch (err) {
            alert(err.response?.data?.message || 'Failed to mark document as received.');
        } finally {
            setReceivingUuids((prev) => ({ ...prev, [uuid]: false }));
        }
    };

    const fetchPpmps = async () => {
        setLoading(true);
        try {
            const params = {
                page: 1,
                per_page: 100,
            };
            if (search) params.search = search;
            if (statusFilter) params.status = statusFilter;
            if (yearFilter) params.fiscal_year = yearFilter;

            const res = await ppmpService.getAll(params);
            if (res.data?.available_fiscal_years) {
                setAvailableFiscalYears(res.data.available_fiscal_years);
            }
            if (res.data && res.data.data !== undefined) {
                setPpmps(res.data.data);
            } else {
                const list = Array.isArray(res.data) ? res.data : [];
                setPpmps(list);
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
    }, [search, statusFilter, yearFilter]);

    useEffect(() => {
        const handleDataReload = () => {
            fetchPpmps();
        };
        window.addEventListener('app:data_reload', handleDataReload);
        return () => window.removeEventListener('app:data_reload', handleDataReload);
    }, [search, statusFilter, yearFilter]);

    const yearOptions = useMemo(() => {
        return getStandardFiscalYears([yearFilter, ...ppmps.map((p) => p.fiscal_year), ...availableFiscalYears]);
    }, [ppmps, availableFiscalYears, yearFilter]);

    const goodsConsultingPpmps = useMemo(() => {
        return ppmps.filter((p) => !isInfrastructurePpmp(p));
    }, [ppmps]);

    const infrastructurePpmps = useMemo(() => {
        return ppmps.filter((p) => isInfrastructurePpmp(p));
    }, [ppmps]);

    const renderPpmpRows = (rows, emptyMessage) => {
        if (loading) {
            return (
                <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400">
                        Loading PPMP documents...
                    </td>
                </tr>
            );
        }

        if (rows.length === 0) {
            return (
                <tr>
                    <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                        {emptyMessage}
                    </td>
                </tr>
            );
        }

        return rows.map((ppmp) => {
            const suppInfo = getSupplementalKindInfo(ppmp);
            const projectTypeLabel = getPpmpProjectTypeLabel(ppmp);
            const isInfra = projectTypeLabel === 'Infrastructure';

            return (
                <tr key={ppmp.id} className="hover:bg-slate-50 transition">
                    <td className="p-3.5">
                        <div className="font-mono font-bold text-blue-900">
                            {ppmp.tracking_number || ppmp.ppmp_number}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            {ppmp.ppmp_number !== undefined && ppmp.ppmp_number !== null && (
                                <span className="font-mono text-[11px] text-slate-600 font-semibold" title="PPMP Number">
                                    PPMP No. {ppmp.ppmp_number}
                                </span>
                            )}
                            {!ppmp.parent_id ? (
                                <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold tracking-tight uppercase border bg-blue-100 text-blue-800 border-blue-300">
                                    Annual
                                </span>
                            ) : (
                                <span
                                    className={`inline-flex items-center px-1.5 py-0.2 rounded text-[10px] font-bold tracking-tight uppercase border ${
                                        ppmp.amendment_type === 'AMENDMENT'
                                            ? 'bg-purple-100 text-purple-800 border-purple-300'
                                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                    }`}
                                    title={suppInfo.specify ? `Purpose: ${suppInfo.specify}` : ''}
                                >
                                    {ppmp.amendment_type === 'AMENDMENT'
                                        ? 'Amended'
                                        : `Supplemental (${suppInfo.label || 'Continuation'})`}
                                </span>
                            )}
                            <span
                                className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9.5px] font-bold tracking-tight uppercase border ${
                                    isInfra
                                        ? 'bg-amber-100 text-amber-900 border-amber-300'
                                        : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                }`}
                            >
                                {projectTypeLabel}
                            </span>
                        </div>
                    </td>
                    <td className="p-3.5 font-medium text-slate-800 max-w-sm">
                        <ExpandableText text={ppmp.title} maxLength={50} textClassName="font-semibold text-slate-900" />
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
                                        {rem.isUrgent ? (
                                            <AlertTriangle className="w-2.5 h-2.5 text-rose-600" />
                                        ) : (
                                            <Clock className="w-2.5 h-2.5 text-amber-600" />
                                        )}
                                        PIMS: Start {schedule.summaryLabel} {rem.isNearEnd && '(Near End of Month)'}
                                    </span>
                                </div>
                            );
                        })()}
                    </td>
                    <td className="p-3.5 text-slate-600 max-w-xs">
                        <ExpandableText
                            text={ppmp.office?.name || 'Provincial Office'}
                            maxLength={35}
                            textClassName="text-slate-600 font-normal"
                        />
                    </td>
                    <td className="p-3.5 text-slate-600 whitespace-nowrap">
                        CY {ppmp.fiscal_year} ({ppmp.plan_type})
                    </td>
                    <td className="p-3.5 text-slate-700">
                        <ExpandableFundBadge
                            fund={
                                ppmp.source_of_fund ||
                                ppmp.items?.find((i) => i.source_of_fund)?.source_of_fund ||
                                'General Fund'
                            }
                        />
                    </td>
                    <td className="p-3.5 font-mono font-bold text-slate-900">
                        {formatCurrency(ppmp.total_budget)}
                    </td>
                    <td className="p-3.5">
                        <div className="flex flex-col items-start gap-1">
                            <StatusBadge
                                status={ppmp.status}
                                onEditStatus={isAdmin ? () => setEditingStatusPpmp(ppmp) : null}
                            />
                            {ppmp.amendment_status === 'PENDING_APPROVAL' && (
                                <span
                                    className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse"
                                    title={suppInfo.specify ? `Specify: ${suppInfo.specify}` : ''}
                                >
                                    Pending{' '}
                                    {(ppmp.requested_amendment_type || ppmp.amendment_type) === 'SUPPLEMENTAL'
                                        ? `Supplemental (${suppInfo.purpose === 'OTHER' ? (suppInfo.specify ? `Other: ${suppInfo.specify}` : 'Other') : 'Continuation'})`
                                        : 'Amendment'}
                                </span>
                            )}
                        </div>
                    </td>
                    <td className="p-3.5 text-right">
                        <div className="flex items-center justify-end gap-1.5 flex-wrap">
                            {isAdmin ? (
                                <div className="inline-flex items-center gap-1.5">
                                    {(openingUuids[ppmp.uuid] || receivingUuids[ppmp.uuid]) && (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 shrink-0" />
                                    )}
                                    <select
                                        value=""
                                        disabled={Boolean(openingUuids[ppmp.uuid] || receivingUuids[ppmp.uuid])}
                                        onChange={(e) => {
                                            const action = e.target.value;
                                            if (action === 'open_details') {
                                                handleOpenDetails(ppmp.uuid);
                                            } else if (action === 'edit_status') {
                                                setEditingStatusPpmp(ppmp);
                                            } else if (action === 'receive') {
                                                handleReceive(ppmp.uuid);
                                            }
                                        }}
                                        className="text-xs font-semibold px-3 py-1.5 border border-slate-300 rounded-md bg-white text-slate-800 hover:border-blue-500 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-2xs cursor-pointer disabled:opacity-50"
                                    >
                                        <option value="" disabled>
                                            Select Action
                                        </option>
                                        {isAwaitingReceive(ppmp, user) ? (
                                            <option value="receive">Receive Request</option>
                                        ) : (
                                            <option value="open_details">Open Details</option>
                                        )}
                                        <option value="edit_status">Edit Status</option>
                                    </select>
                                </div>
                            ) : isAwaitingReceive(ppmp, user) ? (
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
            );
        });
    };

    const isGoodsTab = categoryTab === 'goods_consulting';
    const activeItems = isGoodsTab ? goodsConsultingPpmps : infrastructurePpmps;
    const activePage = isGoodsTab ? goodsPage : infraPage;
    const setActivePage = isGoodsTab ? setGoodsPage : setInfraPage;
    const activePerPage = isGoodsTab ? goodsPerPage : infraPerPage;
    const setActivePerPage = isGoodsTab ? setGoodsPerPage : setInfraPerPage;

    const totalPages = Math.ceil(activeItems.length / activePerPage) || 1;
    const safePage = Math.min(activePage, totalPages);
    const startIndex = (safePage - 1) * activePerPage;
    const paginatedRows = activeItems.slice(startIndex, startIndex + activePerPage);

    return (
        <div className="space-y-6">

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

            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs grid grid-cols-1 sm:grid-cols-3 gap-3">

                <div className="relative">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => {
                            setSearch(e.target.value);
                            setGoodsPage(1);
                            setInfraPage(1);
                        }}
                        placeholder="Search PPMP # or Title..."
                        className="w-full text-xs pl-9 pr-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:outline-none"
                    />
                </div>

                <select
                    value={statusFilter}
                    onChange={(e) => {
                        setStatusFilter(e.target.value);
                        setGoodsPage(1);
                        setInfraPage(1);
                    }}
                    className="text-xs p-2 border border-slate-300 rounded-md bg-white focus:outline-none"
                >
                    <option value="">All Statuses</option>
                    <option value="DRAFT">Draft</option>
                    <option value="HEAD_PENDING">Pending Head Approval</option>
                    <option value="HEAD_APPROVED">Head Endorsed</option>
                    <option value="TWG_REVIEW">BAC-TWG Review</option>
                    <option value="BUDGET_OFFICER_REVIEW">Budget Officer Review</option>
                    <option value="BUDGET_HEAD_REVIEW">Budget Head Review</option>
                    <option value="PACCO_REVIEW">PACCO Review</option>
                    <option value="PACCO_HEAD_REVIEW">PACCO Head Review</option>
                    <option value="OPPMO_REVIEW">OPPMO Review</option>
                    <option value="OPPMO_HEAD_REVIEW">OPPMO Head Review</option>
                    <option value="APP_PREPARER_REVIEW">APP Preparer Review</option>
                    <option value="GOVERNOR_REVIEW">Governor Approval Review</option>
                    <option value="READY_TO_PRINT">Ready to Print</option>
                    <option value="HEAD_RETURNED">Returned by Head</option>
                    <option value="TWG_RETURNED">Returned by TWG</option>
                    <option value="BUDGET_OFFICER_RETURNED">Returned by Budget</option>
                    <option value="BUDGET_HEAD_RETURNED">Returned by Budget Head</option>
                    <option value="PACCO_RETURNED">Returned by PACCO</option>
                    <option value="PACCO_HEAD_RETURNED">Returned by PACCO Head</option>
                    <option value="OPPMO_RETURNED">Returned by OPPMO</option>
                    <option value="OPPMO_HEAD_RETURNED">Returned by OPPMO Head</option>
                    <option value="APP_PREPARER_RETURNED">Returned by APP Preparer</option>
                    <option value="GOVERNOR_RETURNED">Returned by Governor</option>
                </select>

                <select
                    value={yearFilter}
                    onChange={(e) => {
                        setYearFilter(e.target.value);
                        setGoodsPage(1);
                        setInfraPage(1);
                    }}
                    className="text-xs p-2 border border-slate-300 rounded-md bg-white focus:outline-none"
                >
                    <option value="">All Fiscal Years</option>
                    {yearOptions.map((year) => (
                        <option key={year} value={year}>
                            CY {year}
                        </option>
                    ))}
                </select>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">

                <div className="flex items-center justify-between px-5 pt-3 border-b border-slate-200 bg-slate-50/70 flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={() => setCategoryTab('goods_consulting')}
                            className={`pb-2.5 px-3 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
                                isGoodsTab
                                    ? 'border-blue-600 text-blue-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <Package className="w-3.5 h-3.5" />
                            <span>Goods &amp; Consulting Services PPMPs</span>
                            <span
                                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                    isGoodsTab
                                        ? 'bg-blue-100 text-blue-800'
                                        : 'bg-slate-200 text-slate-700'
                                }`}
                            >
                                {goodsConsultingPpmps.length}
                            </span>
                        </button>

                        <button
                            type="button"
                            onClick={() => setCategoryTab('infrastructure')}
                            className={`pb-2.5 px-3 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 border-b-2 transition cursor-pointer ${
                                !isGoodsTab
                                    ? 'border-amber-600 text-amber-600'
                                    : 'border-transparent text-slate-500 hover:text-slate-800'
                            }`}
                        >
                            <HardHat className="w-3.5 h-3.5" />
                            <span>Infrastructure PPMPs</span>
                            <span
                                className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                                    !isGoodsTab
                                        ? 'bg-amber-100 text-amber-800'
                                        : 'bg-slate-200 text-slate-700'
                                }`}
                            >
                                {infrastructurePpmps.length}
                            </span>
                        </button>
                    </div>

                    <div className="text-[11px] text-slate-500 pb-2 italic">
                        {isGoodsTab
                            ? 'Supplies, materials, equipment, general support services, and consulting services'
                            : 'Civil works, construction, rehabilitation, improvement, and infrastructure projects'}
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-50 text-slate-700 uppercase font-semibold border-b border-slate-200">
                            <tr>
                                <th className="p-3.5">Tracker No.</th>
                                <th className="p-3.5">Title / General Description</th>
                                <th className="p-3.5">Office / Unit</th>
                                <th className="p-3.5">Fiscal Year</th>
                                <th className="p-3.5">Source of Funds</th>
                                <th className="p-3.5">Total Allocation</th>
                                <th className="p-3.5">Status</th>
                                <th className="p-3.5 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {renderPpmpRows(
                                paginatedRows,
                                isGoodsTab
                                    ? 'No Goods & Consulting Services PPMP records match your criteria.'
                                    : 'No Infrastructure PPMP records match your criteria.'
                            )}
                        </tbody>
                    </table>
                </div>

                {!loading && activeItems.length > 0 && (
                    <div className="px-5 py-3 border-t border-slate-200 bg-slate-50/70">
                        <PaginationControl
                            currentPage={safePage}
                            totalPages={totalPages}
                            onPageChange={setActivePage}
                            perPage={activePerPage}
                            onPerPageChange={(val) => {
                                setActivePerPage(val);
                                setActivePage(1);
                            }}
                            totalEntries={activeItems.length}
                            startIndex={startIndex}
                            endIndex={Math.min(safePage * activePerPage, activeItems.length)}
                        />
                    </div>
                )}
            </div>

            {isAdmin && (
                <AdminEditStatusModal
                    isOpen={Boolean(editingStatusPpmp)}
                    onClose={() => setEditingStatusPpmp(null)}
                    ppmp={editingStatusPpmp}
                    onUpdated={async () => {
                        await fetchPpmps();
                    }}
                />
            )}
        </div>
    );
};
