import React, { useState, useMemo } from 'react';
import * as XLSX from 'xlsx';
import {
    FileSpreadsheet,
    Download,
    Printer,
    Filter,
    Calendar,
    Building,
    CheckCircle2,
    Eye,
    Search,
    RotateCcw,
} from 'lucide-react';
import { StatusBadge, formatCurrency, formatDate } from '../UI/StatusBadge';
import { getStandardFiscalYears } from '../../utils/fiscalYears';

export const AdminReportsView = ({ recentPpmps, offices, onSelectPpmp }) => {
    const [selectedYear, setSelectedYear] = useState('');
    const [selectedOffice, setSelectedOffice] = useState('');
    const [selectedStatus, setSelectedStatus] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const reportYearOptions = useMemo(() => {
        return getStandardFiscalYears([selectedYear, ...(recentPpmps || []).map((p) => p.fiscal_year)]);
    }, [recentPpmps, selectedYear]);

    // Filter PPMPs according to report criteria
    const filteredReports = (recentPpmps || []).filter((ppmp) => {
        if (selectedYear && String(ppmp.fiscal_year) !== String(selectedYear)) {
            return false;
        }
        if (selectedOffice && String(ppmp.office_id) !== String(selectedOffice)) {
            return false;
        }
        if (selectedStatus && ppmp.status !== selectedStatus) {
            return false;
        }
        if (searchTerm.trim()) {
            const q = searchTerm.trim().toLowerCase();
            const track = (ppmp.tracking_number || '').toLowerCase();
            const no = String(ppmp.ppmp_number || '').toLowerCase();
            const title = (ppmp.title || '').toLowerCase();
            const office = (ppmp.office?.name || '').toLowerCase();
            const code = (ppmp.office?.code || '').toLowerCase();
            if (!track.includes(q) && !no.includes(q) && !title.includes(q) && !office.includes(q) && !code.includes(q)) {
                return false;
            }
        }
        return true;
    });

    // Summary calculations
    const totalFilteredBudget = filteredReports.reduce((sum, p) => sum + parseFloat(p.total_budget || 0), 0);
    const readyToPrintCount = filteredReports.filter((p) => p.status === 'READY_TO_PRINT').length;

    // Export to Excel / CSV
    const exportToExcel = () => {
        const rows = filteredReports.map((p, idx) => ({
            'No.': idx + 1,
            'Tracking Number': p.tracking_number || 'N/A',
            'PPMP Number': p.ppmp_number || 'N/A',
            'Fiscal Year': p.fiscal_year || 'N/A',
            'Plan Type': p.plan_type || 'N/A',
            'Office / Department': p.office ? `${p.office.code} - ${p.office.name}` : 'N/A',
            'Project Title': p.title || 'Untitled',
            'Total Budget (PHP)': parseFloat(p.total_budget || 0),
            'Status': p.status,
            'Date Created': p.created_at ? new Date(p.created_at).toLocaleDateString() : 'N/A',
            'Last Updated': p.updated_at ? new Date(p.updated_at).toLocaleDateString() : 'N/A',
        }));

        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, 'PPMP_Report');

        const dateStr = new Date().toISOString().slice(0, 10);
        XLSX.writeFile(workbook, `PPMP_Consolidated_Report_${dateStr}.xlsx`);
    };

    const handlePrint = () => {
        window.print();
    };

    const handleReset = () => {
        setSelectedYear('');
        setSelectedOffice('');
        setSelectedStatus('');
        setSearchTerm('');
    };

    return (
        <div className="space-y-6">
            {/* Header / Report Configuration Banner */}
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                        <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
                        Consolidated Procurement Reports & Data Exports
                    </h2>
                    <p className="text-xs text-slate-500 mt-1">
                        Filter, inspect, and export comprehensive procurement status and budget utilization sheets across all provincial departments.
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                    <button
                        type="button"
                        onClick={handlePrint}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                    >
                        <Printer className="w-4 h-4 text-slate-600" />
                        Print Report
                    </button>

                    <button
                        type="button"
                        onClick={exportToExcel}
                        disabled={filteredReports.length === 0}
                        className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition shadow-xs disabled:opacity-50 cursor-pointer"
                    >
                        <Download className="w-4 h-4" />
                        Export to Excel (.xlsx)
                    </button>
                </div>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                        <Filter className="w-3.5 h-3.5 text-blue-600" />
                        Report Filtering Controls
                    </span>
                    {(selectedYear || selectedOffice || selectedStatus || searchTerm) && (
                        <button
                            type="button"
                            onClick={handleReset}
                            className="text-xs text-rose-600 hover:text-rose-700 font-semibold flex items-center gap-1 cursor-pointer"
                        >
                            <RotateCcw className="w-3 h-3" />
                            Reset All Filters
                        </button>
                    )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {/* Search query */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Search Document
                        </label>
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                placeholder="Tracker, PPMP No, title..."
                                className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-none"
                            />
                        </div>
                    </div>

                    {/* Fiscal Year */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Fiscal Year
                        </label>
                        <select
                            value={selectedYear}
                            onChange={(e) => setSelectedYear(e.target.value)}
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800"
                        >
                            <option value="">All Fiscal Years</option>
                            {reportYearOptions.map((year) => (
                                <option key={year} value={year}>CY {year}</option>
                            ))}
                        </select>
                    </div>

                    {/* Office / Department */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Implementing Office
                        </label>
                        <select
                            value={selectedOffice}
                            onChange={(e) => setSelectedOffice(e.target.value)}
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800"
                        >
                            <option value="">All Implementing Offices</option>
                            {(offices || []).map((off) => (
                                <option key={off.id} value={off.id}>
                                    {off.code} - {off.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Status */}
                    <div>
                        <label className="block text-[11px] font-bold text-slate-600 uppercase mb-1">
                            Document Status
                        </label>
                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-white focus:ring-2 focus:ring-blue-500 focus:outline-none text-slate-800"
                        >
                            <option value="">All Statuses</option>
                            <option value="READY_TO_PRINT">Ready to Print (Approved)</option>
                            <option value="HEAD_PENDING">Pending Head Approval</option>
                            <option value="HEAD_APPROVED">Head Endorsed</option>
                            <option value="BUDGET_OFFICER_REVIEW">Budget Officer Review</option>
                            <option value="OPPMO_REVIEW">OPPMO Review</option>
                            <option value="TWG_REVIEW">TWG Review</option>
                            <option value="DRAFT">Draft</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Filtered Metrics Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <div className="text-[11px] font-bold text-slate-500 uppercase">
                        Matched Plans Count
                    </div>
                    <div className="text-xl font-black text-slate-900 mt-1">
                        {filteredReports.length} <span className="text-xs font-normal text-slate-500">plans</span>
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <div className="text-[11px] font-bold text-slate-500 uppercase">
                        Subtotal Estimated Budget
                    </div>
                    <div className="text-xl font-black font-mono text-blue-900 mt-1">
                        {formatCurrency(totalFilteredBudget)}
                    </div>
                </div>

                <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
                    <div className="text-[11px] font-bold text-slate-500 uppercase">
                        Approved / Ready to Print Plans
                    </div>
                    <div className="text-xl font-black text-emerald-700 mt-1">
                        {readyToPrintCount}{' '}
                        <span className="text-xs font-normal text-slate-500">
                            ({filteredReports.length > 0 ? Math.round((readyToPrintCount / filteredReports.length) * 100) : 0}%)
                        </span>
                    </div>
                </div>
            </div>

            {/* Data Table */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
                <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                        Generated Report Entries ({filteredReports.length})
                    </span>
                    <span className="text-[11px] text-slate-500 font-medium">
                        Province of Davao del Sur • E-Procurement PPMP/APP System
                    </span>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                        <thead className="bg-slate-100 text-slate-700 uppercase font-semibold border-b border-slate-200">
                            <tr>
                                <th className="p-3 w-12 text-center">#</th>
                                <th className="p-3">Tracking / PPMP No.</th>
                                <th className="p-3">Office / Sector</th>
                                <th className="p-3">Project Title</th>
                                <th className="p-3">Period</th>
                                <th className="p-3 text-right">Budget (PHP)</th>
                                <th className="p-3">Current Status</th>
                                <th className="p-3 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredReports.length === 0 ? (
                                <tr>
                                    <td colSpan={8} className="p-8 text-center text-slate-400 italic">
                                        No PPMP records match your selected report filter parameters.
                                    </td>
                                </tr>
                            ) : (
                                filteredReports.map((p, idx) => (
                                    <tr key={p.id} className="hover:bg-slate-50 transition">
                                        <td className="p-3 text-center text-slate-400 font-mono text-[11px]">
                                            {idx + 1}
                                        </td>
                                        <td className="p-3">
                                            <div className="font-mono font-bold text-blue-900">
                                                {p.tracking_number || '-'}
                                            </div>
                                            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                                                <span className="text-[10px] text-slate-500 font-mono">
                                                    PPMP: {p.ppmp_number !== undefined && p.ppmp_number !== null ? p.ppmp_number : '-'}
                                                </span>
                                                {p.ppmp_number !== undefined && p.ppmp_number !== null && (
                                                    !p.parent_id ? (
                                                        <span className="inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold tracking-tight uppercase border bg-blue-100 text-blue-800 border-blue-300">
                                                            Annual
                                                        </span>
                                                    ) : (
                                                        <span className={`inline-flex items-center px-1.5 py-0.2 rounded text-[9px] font-bold tracking-tight uppercase border ${
                                                            p.amendment_type === 'AMENDMENT'
                                                                ? 'bg-purple-100 text-purple-800 border-purple-300'
                                                                : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                                                        }`}>
                                                            {p.amendment_type === 'AMENDMENT' ? 'Amended' : 'Supplemental'}
                                                        </span>
                                                    )
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-3">
                                            <span className="font-bold text-slate-900 block">
                                                {p.office?.code || '-'}
                                            </span>
                                            <span className="text-[11px] text-slate-500 truncate max-w-xs block">
                                                {p.office?.name || '-'}
                                            </span>
                                        </td>
                                        <td className="p-3 font-semibold text-slate-900 max-w-xs truncate" title={p.title}>
                                            {p.title || 'Untitled'}
                                        </td>
                                        <td className="p-3 text-slate-600">
                                            CY {p.fiscal_year} ({p.plan_type})
                                        </td>
                                        <td className="p-3 text-right font-mono font-bold text-slate-900">
                                            {formatCurrency(p.total_budget)}
                                        </td>
                                        <td className="p-3">
                                            <StatusBadge status={p.status} />
                                        </td>
                                        <td className="p-3 text-right">
                                            <button
                                                type="button"
                                                onClick={() => onSelectPpmp && onSelectPpmp(p.uuid)}
                                                className="inline-flex items-center gap-1 px-2.5 py-1 text-blue-600 hover:bg-blue-50 rounded text-xs font-semibold transition cursor-pointer"
                                            >
                                                <Eye className="w-3.5 h-3.5" />
                                                View
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};
