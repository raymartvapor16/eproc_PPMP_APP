import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
    Printer,
    Download,
    FileStack,
    Files,
    Search,
    Building2,
    Calendar,
    Filter,
    RotateCcw,
    CheckSquare,
    Square,
    Loader2,
    Eye,
    FileText,
    FileSpreadsheet,
    X,
    CheckCircle2,
    AlertCircle,
    ChevronLeft,
    ChevronRight,
    ChevronDown,
} from 'lucide-react';
import { ppmpService } from '../../services/api';
import { formatCurrency, formatDate } from '../UI/StatusBadge';
import { PPMPPrintView } from '../PPMP/PPMPPrintView';
import { APPPrintView } from '../PPMP/APPPrintView';
import {
    createBulkPdfSession,
    exportElementsToPdf,
    printBulkHtmlDocuments,
    sanitizePdfFilename,
} from '../../utils/pdfExport';

const waitNextFrame = () =>
    new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
    });

const waitImagesLoaded = (container) =>
    new Promise((resolve) => {
        if (!container) return resolve();
        const imgs = Array.from(container.querySelectorAll('img'));
        if (imgs.length === 0) return resolve();
        let remaining = imgs.length;
        const done = () => {
            remaining--;
            if (remaining <= 0) resolve();
        };
        const timeout = setTimeout(resolve, 2500);
        imgs.forEach((img) => {
            if (img.complete) {
                done();
            } else {
                img.addEventListener('load', done, { once: true });
                img.addEventListener('error', done, { once: true });
            }
        });
        if (remaining <= 0) {
            clearTimeout(timeout);
            resolve();
        }
    });

const isInfraPpmp = (ppmp) => {
    const tn = String(ppmp?.tracking_number || '').toUpperCase();
    if (tn.includes('INFRA')) return true;
    const items = Array.isArray(ppmp?.items) ? ppmp.items : [];
    return items.some((it) => String(it?.project_type || '').toLowerCase().includes('infra'));
};

const getReadyDateIso = (ppmp) => {
    const raw = ppmp?.oppmo_approved_at || ppmp?.updated_at || ppmp?.created_at || '';
    if (!raw) return '';
    return String(raw).slice(0, 10);
};

export const AdminBulkPrintExportView = ({ user, onSelectPpmp }) => {
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [ppmps, setPpmps] = useState([]);
    const [offices, setOffices] = useState([]);

    const [searchQuery, setSearchQuery] = useState('');
    const [officeFilter, setOfficeFilter] = useState('');
    const [officeSearch, setOfficeSearch] = useState('');
    const [officeDropdownOpen, setOfficeDropdownOpen] = useState(false);
    const officeComboRef = useRef(null);
    const [docTypeFilter, setDocTypeFilter] = useState('ALL');
    const [fiscalYearFilter, setFiscalYearFilter] = useState('');
    const [planTypeFilter, setPlanTypeFilter] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(20);

    const [selectedKeys, setSelectedKeys] = useState(() => new Set());

    const fullPpmpCacheRef = useRef(new Map());

    const stagingRef = useRef(null);
    const cancelRef = useRef(false);
    const [stagingDoc, setStagingDoc] = useState(null);
    const [bulkProgress, setBulkProgress] = useState(null);
    const [feedback, setFeedback] = useState(null);

    const loadReadyToPrint = useCallback(async () => {
        setLoading(true);
        setError('');
        try {
            const res = await ppmpService.getAdminReadyToPrint();
            setPpmps(Array.isArray(res.data?.ppmps) ? res.data.ppmps : []);
            setOffices(Array.isArray(res.data?.offices) ? res.data.offices : []);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load Ready-to-Print PPMP & APP list.');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadReadyToPrint();
    }, [loadReadyToPrint]);

    useEffect(() => {
        if (!officeDropdownOpen) return;
        const onDocClick = (e) => {
            if (officeComboRef.current && !officeComboRef.current.contains(e.target)) {
                setOfficeDropdownOpen(false);
            }
        };
        document.addEventListener('mousedown', onDocClick);
        return () => document.removeEventListener('mousedown', onDocClick);
    }, [officeDropdownOpen]);

    const filteredOffices = useMemo(() => {
        const q = officeSearch.trim().toLowerCase();
        if (!q) return offices;
        return offices.filter((o) => {
            const label = o.code ? `(${o.code}) ${o.name}` : (o.name || '');
            return label.toLowerCase().includes(q) || String(o.code || '').toLowerCase().includes(q);
        });
    }, [offices, officeSearch]);

    const selectedOfficeLabel = useMemo(() => {
        if (!officeFilter) return '';
        const found = offices.find((o) => String(o.id) === String(officeFilter));
        if (!found) return '';
        return found.code ? `(${found.code}) ${found.name}` : found.name;
    }, [offices, officeFilter]);

    const expandedDocs = useMemo(() => {
        const list = [];
        for (const ppmp of ppmps) {
            const readyDate = getReadyDateIso(ppmp);
            const infra = isInfraPpmp(ppmp);
            const officeName = ppmp.office?.name || ppmp.implementing_unit || 'Unassigned Office';
            const officeCode = ppmp.office?.code || '';
            const searchBlob = [
                ppmp.tracking_number,
                ppmp.ppmp_number,
                ppmp.title,
                officeName,
                officeCode,
                ppmp.account_code,
                ppmp.program_name,
                ppmp.fiscal_year,
            ]
                .filter(Boolean)
                .join(' ')
                .toLowerCase();

            const base = {
                ppmpUuid: ppmp.uuid,
                trackingNumber: ppmp.tracking_number || ppmp.ppmp_number || ppmp.uuid,
                ppmpNumber: ppmp.ppmp_number,
                title: ppmp.title || 'Untitled Procurement Plan',
                officeId: ppmp.office_id ? String(ppmp.office_id) : '',
                officeName,
                officeCode,
                fiscalYear: String(ppmp.fiscal_year || ''),
                planType: String(ppmp.plan_type || '').toUpperCase(),
                amendmentType: ppmp.amendment_type || 'ANNUAL',
                totalBudget: Number(ppmp.total_budget || 0),
                readyDate,
                updatedAt: ppmp.oppmo_approved_at || ppmp.updated_at || ppmp.created_at,
                isInfra: infra,
                searchBlob,
            };

            list.push({
                ...base,
                key: `${ppmp.uuid}:PPMP`,
                docType: 'PPMP',
                docLabel: 'PPMP',
            });
            list.push({
                ...base,
                key: `${ppmp.uuid}:APP`,
                docType: 'APP',
                docLabel: 'APP',
            });
        }
        return list;
    }, [ppmps]);

    const fiscalYearOptions = useMemo(() => {
        const set = new Set();
        ppmps.forEach((p) => {
            if (p.fiscal_year) set.add(String(p.fiscal_year));
        });
        return Array.from(set).sort((a, b) => b.localeCompare(a));
    }, [ppmps]);

    const filteredDocs = useMemo(() => {
        const q = searchQuery.trim().toLowerCase();
        return expandedDocs.filter((doc) => {
            if (docTypeFilter !== 'ALL' && doc.docType !== docTypeFilter) return false;
            if (officeFilter && doc.officeId !== officeFilter) return false;
            if (fiscalYearFilter && doc.fiscalYear !== fiscalYearFilter) return false;
            if (planTypeFilter && doc.planType !== planTypeFilter) return false;
            if (categoryFilter === 'infra' && !doc.isInfra) return false;
            if (categoryFilter === 'goods_consulting' && doc.isInfra) return false;
            if (dateFrom && (!doc.readyDate || doc.readyDate < dateFrom)) return false;
            if (dateTo && (!doc.readyDate || doc.readyDate > dateTo)) return false;
            if (q && !doc.searchBlob.includes(q) && !doc.docLabel.toLowerCase().includes(q)) return false;
            return true;
        });
    }, [expandedDocs, docTypeFilter, officeFilter, fiscalYearFilter, planTypeFilter, categoryFilter, dateFrom, dateTo, searchQuery]);

    useEffect(() => {
        setPage(1);
    }, [searchQuery, officeFilter, docTypeFilter, fiscalYearFilter, planTypeFilter, categoryFilter, dateFrom, dateTo, perPage]);

    const totalPages = Math.max(1, Math.ceil(filteredDocs.length / perPage));
    const safePage = Math.min(page, totalPages);
    const paginatedDocs = useMemo(() => {
        const start = (safePage - 1) * perPage;
        return filteredDocs.slice(start, start + perPage);
    }, [filteredDocs, safePage, perPage]);

    const selectedFilteredDocs = useMemo(
        () => filteredDocs.filter((d) => selectedKeys.has(d.key)),
        [filteredDocs, selectedKeys]
    );

    const allFilteredSelected = filteredDocs.length > 0 && selectedFilteredDocs.length === filteredDocs.length;

    const targetDocs = selectedFilteredDocs.length > 0 ? selectedFilteredDocs : filteredDocs;
    const targetPpmpCount = targetDocs.filter((d) => d.docType === 'PPMP').length;
    const targetAppCount = targetDocs.filter((d) => d.docType === 'APP').length;

    const toggleRow = (key) => {
        setSelectedKeys((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
        });
    };

    const toggleAllFiltered = () => {
        setSelectedKeys((prev) => {
            const next = new Set(prev);
            if (allFilteredSelected) {
                filteredDocs.forEach((d) => next.delete(d.key));
            } else {
                filteredDocs.forEach((d) => next.add(d.key));
            }
            return next;
        });
    };

    const selectByDocType = (type) => {
        setSelectedKeys((prev) => {
            const next = new Set(prev);
            filteredDocs.forEach((d) => {
                if (type === 'ALL' || d.docType === type) {
                    next.add(d.key);
                }
            });
            return next;
        });
    };

    const clearSelection = () => setSelectedKeys(new Set());

    const hasActiveFilters = Boolean(
        searchQuery ||
        officeFilter ||
        docTypeFilter !== 'ALL' ||
        fiscalYearFilter ||
        planTypeFilter ||
        categoryFilter ||
        dateFrom ||
        dateTo
    );

    const resetFilters = () => {
        setSearchQuery('');
        setOfficeFilter('');
        setOfficeSearch('');
        setOfficeDropdownOpen(false);
        setDocTypeFilter('ALL');
        setFiscalYearFilter('');
        setPlanTypeFilter('');
        setCategoryFilter('');
        setDateFrom('');
        setDateTo('');
    };

    const ensureFullPpmpsLoaded = async (docsToProcess) => {
        const uniqueUuids = Array.from(new Set(docsToProcess.map((d) => d.ppmpUuid)));
        const missingUuids = uniqueUuids.filter((u) => !fullPpmpCacheRef.current.has(u));

        const CHUNK_SIZE = 50;
        for (let i = 0; i < missingUuids.length; i += CHUNK_SIZE) {
            if (cancelRef.current) return false;
            const chunk = missingUuids.slice(i, i + CHUNK_SIZE);
            setBulkProgress((prev) =>
                prev
                    ? {
                          ...prev,
                          label: `Loading official document data (${Math.min(i + chunk.length, missingUuids.length)}/${missingUuids.length})...`,
                      }
                    : prev
            );
            const res = await ppmpService.getAdminReadyToPrintBatch(chunk);
            const map = res.data?.ppmps_by_uuid || {};
            Object.entries(map).forEach(([uuid, fullPpmp]) => {
                fullPpmpCacheRef.current.set(uuid, fullPpmp);
            });
        }
        return true;
    };

    const mountStagingDocument = async (doc, fullPpmp) => {
        setStagingDoc({ key: `${doc.key}:${Date.now()}`, docType: doc.docType, ppmp: fullPpmp });
        await waitNextFrame();
        await waitNextFrame();
        const rootEl = stagingRef.current?.querySelector('.pdf-export-root');
        await waitImagesLoaded(rootEl);
        await waitNextFrame();
        return rootEl;
    };

    const handleBulkAction = async (mode) => {

        if (bulkProgress || targetDocs.length === 0) return;

        cancelRef.current = false;
        setFeedback(null);
        setBulkProgress({
            mode,
            current: 0,
            total: targetDocs.length,
            label: 'Preparing documents...',
        });

        try {
            const loaded = await ensureFullPpmpsLoaded(targetDocs);
            if (!loaded || cancelRef.current) {
                setBulkProgress(null);
                setStagingDoc(null);
                return;
            }

            if (mode === 'merge_pdf') {
                const session = createBulkPdfSession({
                    orientation: 'landscape',
                    format: 'legal',
                    marginMm: 6,
                });

                let processed = 0;
                for (let i = 0; i < targetDocs.length; i++) {
                    if (cancelRef.current) break;
                    const doc = targetDocs[i];
                    const fullPpmp = fullPpmpCacheRef.current.get(doc.ppmpUuid);
                    if (!fullPpmp) continue;

                    setBulkProgress({
                        mode,
                        current: i + 1,
                        total: targetDocs.length,
                        label: `Merging ${doc.docLabel} — ${doc.trackingNumber}`,
                    });

                    const rootEl = await mountStagingDocument(doc, fullPpmp);
                    if (rootEl) {
                        await session.appendElement(rootEl);
                        processed++;
                    }

                    await new Promise((r) => setTimeout(r, 20));
                }

                if (!cancelRef.current && processed > 0) {
                    const today = new Date().toISOString().slice(0, 10);
                    const officeTag = officeFilter
                        ? `_${offices.find((o) => String(o.id) === officeFilter)?.code || 'OFFICE'}`
                        : '';
                    const typeTag = docTypeFilter !== 'ALL' ? `_${docTypeFilter}` : '_PPMP_APP';
                    session.save(sanitizePdfFilename(`Bulk${typeTag}${officeTag}_${today}.pdf`));
                    setFeedback({
                        type: 'success',
                        text: `Merged PDF downloaded successfully (${processed} document${processed === 1 ? '' : 's'}, ${session.getPageCount()} page${session.getPageCount() === 1 ? '' : 's'}).`,
                    });
                }
            } else if (mode === 'separate_pdf') {
                let processed = 0;
                for (let i = 0; i < targetDocs.length; i++) {
                    if (cancelRef.current) break;
                    const doc = targetDocs[i];
                    const fullPpmp = fullPpmpCacheRef.current.get(doc.ppmpUuid);
                    if (!fullPpmp) continue;

                    setBulkProgress({
                        mode,
                        current: i + 1,
                        total: targetDocs.length,
                        label: `Downloading ${doc.docLabel} — ${doc.trackingNumber}`,
                    });

                    const rootEl = await mountStagingDocument(doc, fullPpmp);
                    if (rootEl) {
                        await exportElementsToPdf({
                            element: rootEl,
                            filename: `${doc.docLabel}_${doc.trackingNumber}.pdf`,
                            orientation: 'landscape',
                            format: 'legal',
                            marginMm: 6,
                        });
                        processed++;
                    }

                    await new Promise((r) => setTimeout(r, 260));
                }

                if (!cancelRef.current && processed > 0) {
                    setFeedback({
                        type: 'success',
                        text: `Downloaded ${processed} separate PDF file${processed === 1 ? '' : 's'} successfully.`,
                    });
                }
            } else if (mode === 'print_all') {
                const htmlSections = [];
                for (let i = 0; i < targetDocs.length; i++) {
                    if (cancelRef.current) break;
                    const doc = targetDocs[i];
                    const fullPpmp = fullPpmpCacheRef.current.get(doc.ppmpUuid);
                    if (!fullPpmp) continue;

                    setBulkProgress({
                        mode,
                        current: i + 1,
                        total: targetDocs.length,
                        label: `Preparing print sheet for ${doc.docLabel} — ${doc.trackingNumber}`,
                    });

                    const rootEl = await mountStagingDocument(doc, fullPpmp);
                    if (rootEl) {
                        htmlSections.push(rootEl.outerHTML);
                    }
                    await new Promise((r) => setTimeout(r, 15));
                }

                if (!cancelRef.current && htmlSections.length > 0) {
                    setStagingDoc(null);
                    setBulkProgress(null);
                    await printBulkHtmlDocuments(htmlSections, {
                        orientation: 'landscape',
                        pageSize: 'legal',
                        title: `Bulk Print (${htmlSections.length} Documents)`,
                    });
                    setFeedback({
                        type: 'success',
                        text: `Opened print dialog for ${htmlSections.length} document${htmlSections.length === 1 ? '' : 's'}.`,
                    });
                    return;
                }
            }
        } catch (err) {
            console.error('Bulk export failed:', err);
            setFeedback({
                type: 'error',
                text: err?.message || 'Bulk export failed. Please try again with fewer items or check your connection.',
            });
        } finally {
            setStagingDoc(null);
            setBulkProgress(null);
        }
    };

    const handleCancelBulk = () => {
        cancelRef.current = true;
    };

    return (
        <div className="space-y-5">

            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700">
                                <Printer className="w-5 h-5" />
                            </span>
                            <div>
                                <h2 className="text-lg font-extrabold text-slate-900 tracking-tight">
                                    Ready to Print — Bulk PPMP &amp; APP Center
                                </h2>
                                <p className="text-xs text-slate-500 font-medium">
                                    Every Ready-to-Print PPMP pairs with its official APP ({ppmps.length} PPMP{ppmps.length === 1 ? '' : 's'} = {expandedDocs.length} printable documents). Filter, select via checkboxes, and bulk download or print.
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                        <button
                            type="button"
                            disabled={loading || !!bulkProgress || targetDocs.length === 0}
                            onClick={() => handleBulkAction('merge_pdf')}
                            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Combine all selected (or filtered) PPMP & APP documents into one single PDF file"
                        >
                            <FileStack className="w-4 h-4" />
                            <span>Merge PDF ({targetDocs.length})</span>
                        </button>

                        <button
                            type="button"
                            disabled={loading || !!bulkProgress || targetDocs.length === 0}
                            onClick={() => handleBulkAction('separate_pdf')}
                            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Download each selected (or filtered) PPMP & APP as its own separate PDF file"
                        >
                            <Files className="w-4 h-4" />
                            <span>Separate PDFs ({targetDocs.length})</span>
                        </button>

                        <button
                            type="button"
                            disabled={loading || !!bulkProgress || targetDocs.length === 0}
                            onClick={() => handleBulkAction('print_all')}
                            className="inline-flex items-center gap-2 px-3.5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold uppercase tracking-wider rounded-xl shadow-sm transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Print all selected (or filtered) PPMP & APP documents in one print job"
                        >
                            <Printer className="w-4 h-4" />
                            <span>Print All ({targetDocs.length})</span>
                        </button>
                    </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
                    <div className="flex flex-wrap items-center gap-3 font-semibold text-slate-700">
                        <span>
                            Showing <strong className="text-slate-900">{filteredDocs.length}</strong> of {expandedDocs.length} docs
                        </span>
                        <span className="text-slate-300">|</span>
                        <span>
                            Target for Export/Print:{' '}
                            <strong className="text-blue-700">
                                {selectedFilteredDocs.length > 0 ? 'Checked Selection' : 'All Filtered'}
                            </strong>{' '}
                            (<strong className="text-slate-900">{targetPpmpCount}</strong> PPMP,{' '}
                            <strong className="text-slate-900">{targetAppCount}</strong> APP)
                        </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                        <button
                            type="button"
                            onClick={() => selectByDocType('PPMP')}
                            className="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 text-[11px] font-bold transition cursor-pointer"
                        >
                            + Check All PPMPs
                        </button>
                        <button
                            type="button"
                            onClick={() => selectByDocType('APP')}
                            className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[11px] font-bold transition cursor-pointer"
                        >
                            + Check All APPs
                        </button>
                        <button
                            type="button"
                            onClick={() => selectByDocType('ALL')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-[11px] font-bold transition cursor-pointer"
                        >
                            + Check All Filtered
                        </button>
                        {selectedKeys.size > 0 && (
                            <button
                                type="button"
                                onClick={clearSelection}
                                className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold transition cursor-pointer"
                            >
                                Clear ({selectedKeys.size})
                            </button>
                        )}
                    </div>
                </div>

                {feedback && (
                    <div
                        className={`p-3 rounded-xl border text-xs font-bold flex items-center justify-between gap-2 ${
                            feedback.type === 'success'
                                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                                : 'bg-rose-50 border-rose-200 text-rose-800'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            {feedback.type === 'success' ? (
                                <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
                            ) : (
                                <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                            )}
                            <span>{feedback.text}</span>
                        </div>
                        <button
                            type="button"
                            onClick={() => setFeedback(null)}
                            className="p-1 hover:bg-black/5 rounded cursor-pointer"
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-2.5 pt-1">

                    <div className="relative sm:col-span-2">
                        <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search tracker no., title, office, account..."
                            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                    </div>

                    <div className="relative" ref={officeComboRef}>
                        <Building2 className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none z-10" />
                        <input
                            type="text"
                            value={officeDropdownOpen ? officeSearch : (selectedOfficeLabel || officeSearch)}
                            onFocus={() => {
                                setOfficeDropdownOpen(true);
                                if (officeFilter) setOfficeSearch('');
                            }}
                            onChange={(e) => {
                                setOfficeSearch(e.target.value);
                                setOfficeDropdownOpen(true);
                                if (!e.target.value.trim()) setOfficeFilter('');
                            }}
                            placeholder="All Offices (type to search...)"
                            className="w-full pl-8 pr-8 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none truncate"
                        />
                        {officeFilter || officeSearch ? (
                            <button
                                type="button"
                                onClick={() => {
                                    setOfficeFilter('');
                                    setOfficeSearch('');
                                    setOfficeDropdownOpen(false);
                                }}
                                title="Clear office filter"
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-rose-600 rounded cursor-pointer"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>
                        ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        )}

                        {officeDropdownOpen && (
                            <div className="absolute left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-xl max-h-60 overflow-y-auto z-50 py-1 text-xs">
                                <button
                                    type="button"
                                    onMouseDown={(e) => {
                                        e.preventDefault();
                                        setOfficeFilter('');
                                        setOfficeSearch('');
                                        setOfficeDropdownOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 font-bold transition cursor-pointer ${
                                        !officeFilter
                                            ? 'bg-blue-50 text-blue-700'
                                            : 'text-slate-700 hover:bg-slate-100'
                                    }`}
                                >
                                    All Offices
                                </button>
                                {filteredOffices.length === 0 ? (
                                    <div className="px-3 py-2 text-slate-400 italic">No matching office found.</div>
                                ) : (
                                    filteredOffices.map((o) => {
                                        const label = o.code ? `(${o.code}) ${o.name}` : o.name;
                                        const isSelected = String(officeFilter) === String(o.id);
                                        return (
                                            <button
                                                key={o.id}
                                                type="button"
                                                onMouseDown={(e) => {
                                                    e.preventDefault();
                                                    setOfficeFilter(String(o.id));
                                                    setOfficeSearch(label);
                                                    setOfficeDropdownOpen(false);
                                                }}
                                                className={`w-full text-left px-3 py-2 font-semibold transition cursor-pointer truncate ${
                                                    isSelected
                                                        ? 'bg-blue-50 text-blue-800 font-bold'
                                                        : 'text-slate-700 hover:bg-slate-100'
                                                }`}
                                                title={label}
                                            >
                                                {label}
                                            </button>
                                        );
                                    })
                                )}
                            </div>
                        )}
                    </div>

                    <div>
                        <select
                            value={docTypeFilter}
                            onChange={(e) => setDocTypeFilter(e.target.value)}
                            className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                            <option value="ALL">All Docs (PPMP &amp; APP)</option>
                            <option value="PPMP">PPMP Only</option>
                            <option value="APP">APP Only</option>
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                        <select
                            value={fiscalYearFilter}
                            onChange={(e) => setFiscalYearFilter(e.target.value)}
                            className="w-full px-2 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                            <option value="">All Years</option>
                            {fiscalYearOptions.map((fy) => (
                                <option key={fy} value={fy}>
                                    CY {fy}
                                </option>
                            ))}
                        </select>
                        <select
                            value={categoryFilter}
                            onChange={(e) => setCategoryFilter(e.target.value)}
                            className="w-full px-2 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        >
                            <option value="">All Types</option>
                            <option value="goods_consulting">Goods/Cons.</option>
                            <option value="infra">Infra</option>
                        </select>
                    </div>

                    <div className="relative">
                        <input
                            type="date"
                            value={dateFrom}
                            onChange={(e) => setDateFrom(e.target.value)}
                            title="Ready Date From"
                            className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                    </div>

                    <div className="flex items-center gap-1.5">
                        <input
                            type="date"
                            value={dateTo}
                            onChange={(e) => setDateTo(e.target.value)}
                            title="Ready Date To"
                            className="w-full px-2.5 py-2 border border-slate-300 rounded-xl text-xs font-semibold bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none"
                        />
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={resetFilters}
                                title="Reset all filters"
                                className="p-2 rounded-xl bg-slate-100 hover:bg-rose-50 text-slate-600 hover:text-rose-600 border border-slate-200 transition cursor-pointer shrink-0"
                            >
                                <RotateCcw className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                {loading ? (
                    <div className="p-12 text-center text-slate-500 flex flex-col items-center gap-2">
                        <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                        <span className="text-xs font-semibold">Loading Ready-to-Print PPMP &amp; APP records...</span>
                    </div>
                ) : error ? (
                    <div className="p-8 text-center text-rose-700 text-xs font-bold">{error}</div>
                ) : filteredDocs.length === 0 ? (
                    <div className="p-12 text-center text-slate-500 space-y-2">
                        <Filter className="w-8 h-8 mx-auto text-slate-300" />
                        <div className="text-sm font-bold text-slate-700">No Ready-to-Print documents match your filters.</div>
                        {hasActiveFilters && (
                            <button
                                type="button"
                                onClick={resetFilters}
                                className="px-3 py-1.5 bg-blue-600 text-white text-xs font-bold rounded-lg cursor-pointer"
                            >
                                Reset Filters
                            </button>
                        )}
                    </div>
                ) : (
                    <>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse text-xs">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-600">
                                        <th className="py-3 px-4 w-10 text-center">
                                            <button
                                                type="button"
                                                onClick={toggleAllFiltered}
                                                className="inline-flex items-center justify-center text-slate-600 hover:text-blue-600 cursor-pointer"
                                                title={allFilteredSelected ? 'Deselect all filtered' : 'Select all filtered'}
                                            >
                                                {allFilteredSelected ? (
                                                    <CheckSquare className="w-4 h-4 text-blue-600" />
                                                ) : (
                                                    <Square className="w-4 h-4" />
                                                )}
                                            </button>
                                        </th>
                                        <th className="py-3 px-3 w-24">Doc Type</th>
                                        <th className="py-3 px-3">Tracker / PPMP No.</th>
                                        <th className="py-3 px-3">Office / Implementing Unit</th>
                                        <th className="py-3 px-3">Project Title</th>
                                        <th className="py-3 px-3 whitespace-nowrap">CY / Plan</th>
                                        <th className="py-3 px-3 text-right whitespace-nowrap">Total Budget</th>
                                        <th className="py-3 px-3 whitespace-nowrap">Date Ready</th>
                                        <th className="py-3 px-4 text-right whitespace-nowrap">Action</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {paginatedDocs.map((doc) => {
                                        const checked = selectedKeys.has(doc.key);
                                        const isPpmp = doc.docType === 'PPMP';
                                        return (
                                            <tr
                                                key={doc.key}
                                                onClick={() => toggleRow(doc.key)}
                                                className={`transition cursor-pointer ${
                                                    checked
                                                        ? 'bg-blue-50/70 hover:bg-blue-50'
                                                        : 'hover:bg-slate-50/80'
                                                }`}
                                            >
                                                <td className="py-2.5 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                                                    <input
                                                        type="checkbox"
                                                        checked={checked}
                                                        onChange={() => toggleRow(doc.key)}
                                                        className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                                                    />
                                                </td>
                                                <td className="py-2.5 px-3">
                                                    <span
                                                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
                                                            isPpmp
                                                                ? 'bg-blue-100 text-blue-800 border-blue-200'
                                                                : 'bg-indigo-100 text-indigo-800 border-indigo-200'
                                                        }`}
                                                    >
                                                        {isPpmp ? (
                                                            <FileText className="w-3 h-3" />
                                                        ) : (
                                                            <FileSpreadsheet className="w-3 h-3" />
                                                        )}
                                                        {doc.docLabel}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 font-bold text-slate-900 whitespace-nowrap">
                                                    <div>{doc.trackingNumber}</div>
                                                    <div className="text-[10px] text-slate-500 font-semibold">
                                                        PPMP No. {doc.ppmpNumber || '—'} &bull; {doc.isInfra ? 'INFRA' : 'GOODS/CONS'}
                                                    </div>
                                                </td>
                                                <td className="py-2.5 px-3 font-semibold text-slate-700 max-w-[210px]">
                                                    <div className="truncate" title={doc.officeName}>
                                                        {doc.officeCode ? `(${doc.officeCode}) ` : ''}
                                                        {doc.officeName}
                                                    </div>
                                                </td>
                                                <td className="py-2.5 px-3 font-semibold text-slate-800 max-w-[260px]">
                                                    <div className="line-clamp-2" title={doc.title}>
                                                        {doc.title}
                                                    </div>
                                                </td>
                                                <td className="py-2.5 px-3 whitespace-nowrap font-bold text-slate-700">
                                                    CY {doc.fiscalYear}
                                                    <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600">
                                                        {doc.planType || 'FINAL'}
                                                    </span>
                                                </td>
                                                <td className="py-2.5 px-3 text-right font-extrabold tabular-nums text-slate-900 whitespace-nowrap">
                                                    {formatCurrency(doc.totalBudget)}
                                                </td>
                                                <td className="py-2.5 px-3 whitespace-nowrap text-slate-600 font-semibold">
                                                    {doc.updatedAt ? formatDate(doc.updatedAt) : '—'}
                                                </td>
                                                <td className="py-2.5 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                                                    {onSelectPpmp && (
                                                        <button
                                                            type="button"
                                                            onClick={() => onSelectPpmp(doc.ppmpUuid)}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-100 hover:bg-blue-600 hover:text-white text-slate-700 rounded-lg text-[11px] font-bold transition cursor-pointer"
                                                        >
                                                            <Eye className="w-3.5 h-3.5" />
                                                            Open
                                                        </button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
                            <div className="flex items-center gap-2 text-slate-600 font-semibold">
                                <span>
                                    Showing {(safePage - 1) * perPage + 1} to {Math.min(safePage * perPage, filteredDocs.length)} of{' '}
                                    {filteredDocs.length} documents
                                </span>
                                <select
                                    value={perPage}
                                    onChange={(e) => setPerPage(Number(e.target.value))}
                                    className="px-2 py-1 border border-slate-300 rounded-lg bg-white text-xs font-bold"
                                >
                                    <option value={10}>10 / page</option>
                                    <option value={20}>20 / page</option>
                                    <option value={50}>50 / page</option>
                                    <option value={100}>100 / page</option>
                                </select>
                            </div>

                            <div className="flex items-center gap-1.5">
                                <button
                                    type="button"
                                    disabled={safePage <= 1}
                                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                                    className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="px-2.5 font-bold text-slate-700">
                                    Page {safePage} / {totalPages}
                                </span>
                                <button
                                    type="button"
                                    disabled={safePage >= totalPages}
                                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                                    className="p-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-40 cursor-pointer"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            {bulkProgress && (
                <div className="fixed inset-0 z-[9999] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center shrink-0">
                                <Loader2 className="w-5 h-5 animate-spin" />
                            </div>
                            <div className="min-w-0">
                                <h3 className="text-sm font-extrabold text-slate-900 uppercase tracking-wide">
                                    {bulkProgress.mode === 'merge_pdf'
                                        ? 'Merging Official PDFs'
                                        : bulkProgress.mode === 'separate_pdf'
                                        ? 'Downloading Separate PDFs'
                                        : 'Preparing Bulk Print Sheets'}
                                </h3>
                                <p className="text-xs text-slate-500 font-semibold truncate">{bulkProgress.label}</p>
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-bold text-slate-700">
                                <span>
                                    Document {bulkProgress.current} of {bulkProgress.total}
                                </span>
                                <span>
                                    {bulkProgress.total > 0
                                        ? Math.round((bulkProgress.current / bulkProgress.total) * 100)
                                        : 0}
                                    %
                                </span>
                            </div>
                            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-blue-600 rounded-full transition-all duration-200"
                                    style={{
                                        width: `${
                                            bulkProgress.total > 0
                                                ? Math.min(100, Math.round((bulkProgress.current / bulkProgress.total) * 100))
                                                : 0
                                        }%`,
                                    }}
                                />
                            </div>
                        </div>

                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={handleCancelBulk}
                                className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-xs font-bold rounded-xl transition cursor-pointer"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {stagingDoc && (
                <div
                    ref={stagingRef}
                    aria-hidden="true"
                    style={{
                        position: 'fixed',
                        left: '-100000px',
                        top: 0,
                        width: '1400px',
                        backgroundColor: '#ffffff',
                        pointerEvents: 'none',
                        zIndex: -1,
                    }}
                >
                    {stagingDoc.docType === 'PPMP' ? (
                        <PPMPPrintView key={stagingDoc.key} ppmp={stagingDoc.ppmp} onBack={() => {}} />
                    ) : (
                        <APPPrintView
                            key={stagingDoc.key}
                            ppmp={stagingDoc.ppmp}
                            user={user}
                            canEdit={false}
                            onBack={() => {}}
                        />
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminBulkPrintExportView;
